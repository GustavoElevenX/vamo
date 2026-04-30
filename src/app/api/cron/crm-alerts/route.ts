import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyCronSecret } from '@/lib/cron-auth'
import { sendEmail } from '@/lib/services/email.service'
import { sendWhatsApp } from '@/lib/services/whatsapp.service'
import { STAGE_LABELS, STAGE_STUCK_DAYS } from '@/types/crm'
import type { DealStage } from '@/types/crm'

export const runtime = 'nodejs'

function daysSince(value: string | null) {
  if (!value) return 999
  return Math.floor((Date.now() - new Date(value).getTime()) / 86400000)
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) return new Response('Unauthorized', { status: 401 })
  const admin = createAdminClient()

  const { data: deals, error } = await admin
    .from('crm_deals')
    .select('id, organization_id, owner_id, title, value, stage, last_activity_at, owner:users!crm_deals_owner_id_fkey(id,name,email)')
    .not('stage', 'in', '("closed_won","closed_lost")')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let created = 0
  let sent = 0
  for (const deal of deals ?? []) {
    const stage = deal.stage as DealStage
    const stuckDays = daysSince(deal.last_activity_at)
    if (stuckDays <= (STAGE_STUCK_DAYS[stage] ?? 7)) continue

    const reference = deal.id
    const { data: recentLog } = await admin
      .from('notification_send_log')
      .select('id')
      .eq('user_id', deal.owner_id)
      .eq('type', 'crm_deal_stuck')
      .eq('reference', reference)
      .gte('sent_at', new Date(Date.now() - 24 * 3600_000).toISOString())
      .maybeSingle()
    if (recentLog) continue

    const message = `Deal "${deal.title}" esta parado ha ${stuckDays} dias em ${STAGE_LABELS[stage]}.`
    await admin.from('notifications').insert({
      organization_id: deal.organization_id,
      user_id: deal.owner_id,
      sender_id: null,
      message,
    })
    created += 1

    const { data: prefs } = await admin
      .from('notification_preferences')
      .select('*')
      .eq('user_id', deal.owner_id)
      .maybeSingle()

    if (prefs?.notify_deal_stuck !== false) {
      const owner = deal.owner as any
      if (prefs?.email_enabled && owner?.email) {
        await sendEmail({ to: owner.email, subject: 'VAMO: deal parado', html: `<p>${message}</p>` }).catch(() => null)
        await admin.from('notification_send_log').insert({ user_id: deal.owner_id, type: 'crm_deal_stuck', reference, channel: 'email' })
        sent += 1
      }
      if (prefs?.whatsapp_enabled && prefs.whatsapp_number) {
        await sendWhatsApp(prefs.whatsapp_number, message).catch(() => null)
        await admin.from('notification_send_log').insert({ user_id: deal.owner_id, type: 'crm_deal_stuck', reference, channel: 'whatsapp' })
        sent += 1
      }
    }
  }

  return NextResponse.json({ ok: true, alerts_created: created, sends_attempted: sent })
}
