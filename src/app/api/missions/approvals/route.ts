import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const auth = await getAppUser()
    if (auth.error) return auth.error
    const { adminClient, appUser } = auth

    if (!['manager', 'admin', 'developer', 'consultant'].includes(appUser.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const { data, error } = await adminClient
      .from('ai_missions')
      .select('*, user:users(id,name,avatar_url), kpi:kpi_definitions(id,name,unit,source_event)')
      .eq('organization_id', appUser.organization_id)
      .eq('status', 'awaiting_approval')
      .order('updated_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ approvals: data ?? [] })
  } catch (error) {
    console.error('GET /api/missions/approvals', error)
    return NextResponse.json({ error: 'Erro ao carregar aprovacoes' }, { status: 500 })
  }
}
