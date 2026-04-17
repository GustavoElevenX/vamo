import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const adminClient = createAdminClient()
    const { data: appUser } = await adminClient
      .from('users')
      .select('organization_id')
      .eq('auth_id', authUser.id)
      .single()

    if (!appUser?.organization_id) return NextResponse.json({ config: null })

    const { data: org } = await adminClient
      .from('organizations')
      .select('settings')
      .eq('id', appUser.organization_id)
      .single()

    return NextResponse.json({ config: (org?.settings as Record<string, unknown>)?.gamification ?? null })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const adminClient = createAdminClient()
    const { data: appUser } = await adminClient
      .from('users')
      .select('organization_id, role')
      .eq('auth_id', authUser.id)
      .single()

    if (!appUser) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    if (!['manager', 'admin'].includes(appUser.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const gamificationConfig = await req.json()

    // Merge into existing settings to avoid overwriting other keys
    const { data: org } = await adminClient
      .from('organizations')
      .select('settings')
      .eq('id', appUser.organization_id)
      .single()

    const currentSettings = (org?.settings ?? {}) as Record<string, unknown>
    const newSettings = { ...currentSettings, gamification: gamificationConfig }

    const { error } = await adminClient
      .from('organizations')
      .update({ settings: newSettings })
      .eq('id', appUser.organization_id)

    if (error) throw new Error(error.message)

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro interno' }, { status: 500 })
  }
}
