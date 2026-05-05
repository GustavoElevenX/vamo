import { NextRequest, NextResponse } from 'next/server'
import { getAppUser, requireRole } from '@/lib/server/auth'

export const runtime = 'nodejs'

const defaultConfig = {
  syncFrequency: '15min',
  aiTemperature: '0.7',
  aiMaxTokens: '2048',
  logLevel: 'info',
  alertOnErrors: true,
  auditRetentionDays: '90',
}

export async function GET() {
  const auth = await getAppUser()
  if (auth.error) return auth.error

  const { adminClient, appUser } = auth
  const forbidden = requireRole(appUser.role, ['admin', 'manager', 'developer'])
  if (forbidden) return forbidden

  const { data, error } = await adminClient
    .from('organizations')
    .select('settings')
    .eq('id', appUser.organization_id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const settings = (data?.settings ?? {}) as Record<string, any>
  return NextResponse.json({ config: { ...defaultConfig, ...(settings.system ?? {}) } })
}

export async function POST(req: NextRequest) {
  const auth = await getAppUser()
  if (auth.error) return auth.error

  const { adminClient, appUser } = auth
  const forbidden = requireRole(appUser.role, ['admin', 'manager', 'developer'])
  if (forbidden) return forbidden

  const input = await req.json()
  const config = {
    syncFrequency: ['5min', '15min', '30min', '1h'].includes(input.syncFrequency) ? input.syncFrequency : '15min',
    aiTemperature: String(input.aiTemperature ?? '0.7'),
    aiMaxTokens: String(input.aiMaxTokens ?? '2048'),
    logLevel: ['debug', 'info', 'warn', 'error'].includes(input.logLevel) ? input.logLevel : 'info',
    alertOnErrors: Boolean(input.alertOnErrors),
    auditRetentionDays: String(input.auditRetentionDays ?? '90'),
  }

  const { data: org } = await adminClient
    .from('organizations')
    .select('settings')
    .eq('id', appUser.organization_id)
    .single()

  const currentSettings = (org?.settings ?? {}) as Record<string, unknown>
  const { error } = await adminClient
    .from('organizations')
    .update({ settings: { ...currentSettings, system: config } })
    .eq('id', appUser.organization_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await adminClient.from('system_logs').insert({
    organization_id: appUser.organization_id,
    level: 'info',
    source: 'system',
    message: 'Configuracao avancada atualizada',
    metadata: { user_id: appUser.id, config },
  })

  return NextResponse.json({ config })
}
