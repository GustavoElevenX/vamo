import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyCronSecret } from '@/lib/cron-auth'
import { sendEmail } from '@/lib/services/email.service'
import { sendWhatsApp } from '@/lib/services/whatsapp.service'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) return new Response('Unauthorized', { status: 401 })
  const admin = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data: users, error } = await admin
    .from('users')
    .select('id, organization_id, name, email, role, notification_preferences(*)')
    .eq('active', true)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let sent = 0
  for (const user of users ?? []) {
    const prefs = Array.isArray(user.notification_preferences) ? user.notification_preferences[0] : user.notification_preferences
    if (prefs?.notify_daily_digest === false) continue

    const { data: existing } = await admin
      .from('notification_send_log')
      .select('id')
      .eq('user_id', user.id)
      .eq('type', 'daily_digest')
      .eq('reference', `daily_digest:${today}`)
      .maybeSingle()
    if (existing) continue

    const dealsQuery = admin
      .from('crm_deals')
      .select('title,value,stage,last_activity_at')
      .eq('organization_id', user.organization_id)
      .not('stage', 'in', '("closed_won","closed_lost")')
      .order('last_activity_at', { ascending: true, nullsFirst: true })
      .limit(3)

    const { data: deals } = user.role === 'seller'
      ? await dealsQuery.eq('owner_id', user.id)
      : await dealsQuery

    const lines = [
      `Bom dia, ${user.name.split(' ')[0]}.`,
      '',
      'Prioridades de hoje:',
      ...((deals ?? []).map((deal: any, index: number) => `${index + 1}. ${deal.title} - R$ ${Number(deal.value ?? 0).toLocaleString('pt-BR')}`)),
    ]
    const message = lines.join('\n')

    if (prefs?.email_enabled !== false && user.email) {
      await sendEmail({ to: user.email, subject: 'VAMO: digest diario', html: `<pre style="font-family:Inter,Arial,sans-serif">${message}</pre>` }).catch(() => null)
      await admin.from('notification_send_log').insert({ user_id: user.id, type: 'daily_digest', reference: `daily_digest:${today}`, channel: 'email' })
      sent += 1
    }
    if (prefs?.whatsapp_enabled && prefs.whatsapp_number) {
      await sendWhatsApp(prefs.whatsapp_number, message).catch(() => null)
      await admin.from('notification_send_log').insert({ user_id: user.id, type: 'daily_digest', reference: `daily_digest:${today}`, channel: 'whatsapp' })
      sent += 1
    }
  }

  return NextResponse.json({ ok: true, sends_attempted: sent })
}
