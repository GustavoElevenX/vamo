import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const adminClient = createAdminClient()
    const { data: appUser } = await adminClient
      .from('users')
      .select('id, organization_id')
      .eq('auth_id', authUser.id)
      .single()

    if (!appUser) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    const { data: alerts, error } = await adminClient
      .from('ai_alerts')
      .select('*')
      .eq('organization_id', appUser.organization_id)
      .order('created_at', { ascending: false })
      .limit(30)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Enriquecer com nomes das entidades quando aplicável
    const enriched: Record<string, unknown>[] = await Promise.all(
      (alerts || []).map(async (alert: Record<string, unknown>) => {
        if (alert.entity_type === 'user' && alert.entity_id) {
          const { data: entityUser } = await adminClient
            .from('users')
            .select('name')
            .eq('id', alert.entity_id as string)
            .maybeSingle()
          return { ...alert, entity_name: entityUser?.name || null }
        }
        return { ...alert, entity_name: null }
      })
    )

    const unreadCount = enriched.filter((a) => a.read === false).length

    return NextResponse.json({ alerts: enriched, unreadCount })
  } catch (error) {
    console.error('Get alerts error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const adminClient = createAdminClient()
    const { data: appUser } = await adminClient
      .from('users')
      .select('id, organization_id')
      .eq('auth_id', authUser.id)
      .single()

    if (!appUser) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    const { alertId, markAllRead } = await req.json() as { alertId?: string; markAllRead?: boolean }

    if (markAllRead) {
      const { error } = await adminClient
        .from('ai_alerts')
        .update({ read: true })
        .eq('organization_id', appUser.organization_id)
        .eq('read', false)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (!alertId) {
      return NextResponse.json({ error: 'alertId é obrigatório' }, { status: 400 })
    }

    const { error } = await adminClient
      .from('ai_alerts')
      .update({ read: true })
      .eq('id', alertId)
      .eq('organization_id', appUser.organization_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Patch alert error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
