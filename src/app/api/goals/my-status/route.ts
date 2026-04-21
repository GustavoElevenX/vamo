import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const adminClient = createAdminClient()
    const { data: appUser } = await adminClient
      .from('users')
      .select('id, organization_id')
      .eq('auth_id', authUser.id)
      .single()

    if (!appUser) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    const { status, progresso } = await req.json() as {
      status: 'pending' | 'in_progress' | 'completed'
      progresso?: string
    }

    if (!status || !['pending', 'in_progress', 'completed'].includes(status)) {
      return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
    }

    // Fetch current program_goals
    const { data: pgRow } = await adminClient
      .from('program_goals')
      .select('individual_goals')
      .eq('organization_id', appUser.organization_id)
      .maybeSingle()

    if (!pgRow) return NextResponse.json({ error: 'Metas não encontradas' }, { status: 404 })

    const goals = (pgRow.individual_goals as Record<string, unknown>[]) ?? []
    const idx = goals.findIndex((g) => g.user_id === appUser.id)

    if (idx === -1) return NextResponse.json({ error: 'Meta individual não encontrada para este usuário' }, { status: 404 })

    const updated = [...goals]
    updated[idx] = {
      ...updated[idx],
      status,
      ...(progresso !== undefined ? { progresso } : {}),
      ...(status === 'completed' ? { completed_at: new Date().toISOString() } : {}),
    }

    const { error } = await adminClient
      .from('program_goals')
      .update({ individual_goals: updated, updated_at: new Date().toISOString() })
      .eq('organization_id', appUser.organization_id)

    if (error) throw new Error(error.message)

    return NextResponse.json({ success: true, status })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
