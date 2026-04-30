import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { adminClient, appUser } = auth

  const { data, error } = await adminClient
    .from('notification_preferences')
    .select('*')
    .eq('user_id', appUser.id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ preferences: data })
}

export async function PUT(request: Request) {
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { adminClient, appUser } = auth
  const input = await request.json()

  const payload = {
    user_id: appUser.id,
    email_enabled: !!input.email_enabled,
    whatsapp_enabled: !!input.whatsapp_enabled,
    whatsapp_number: input.whatsapp_number || null,
    notify_deal_stuck: input.notify_deal_stuck !== false,
    notify_daily_digest: input.notify_daily_digest !== false,
    notify_deal_closed: input.notify_deal_closed !== false,
    notify_ranking_change: !!input.notify_ranking_change,
    digest_hour_utc: Number(input.digest_hour_utc ?? 10),
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await adminClient
    .from('notification_preferences')
    .upsert(payload, { onConflict: 'user_id' })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ preferences: data })
}
