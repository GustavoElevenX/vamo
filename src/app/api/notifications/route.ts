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
      .select('id, organization_id')
      .eq('auth_id', authUser.id)
      .single()

    if (!appUser) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    const { data: notifications, error } = await adminClient
      .from('notifications')
      .select('id, message, read, created_at, sender_id')
      .eq('user_id', appUser.id)
      .eq('organization_id', appUser.organization_id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Enrich with sender name
    const enriched = await Promise.all(
      (notifications || []).map(async (n) => {
        if (!n.sender_id) return { ...n, sender_name: 'Sistema' }
        const { data: sender } = await adminClient
          .from('users').select('name').eq('id', n.sender_id).single()
        return { ...n, sender_name: sender?.name ?? 'Gestor' }
      })
    )

    const unreadCount = enriched.filter((n) => !n.read).length
    return NextResponse.json({ notifications: enriched, unreadCount })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro interno' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const adminClient = createAdminClient()
    const { data: appUser } = await adminClient
      .from('users').select('id').eq('auth_id', authUser.id).single()

    if (!appUser) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    const { notificationId, markAllRead } = await req.json() as { notificationId?: string; markAllRead?: boolean }

    if (markAllRead) {
      await adminClient.from('notifications').update({ read: true }).eq('user_id', appUser.id).eq('read', false)
      return NextResponse.json({ success: true })
    }

    if (!notificationId) return NextResponse.json({ error: 'notificationId é obrigatório' }, { status: 400 })

    await adminClient.from('notifications').update({ read: true }).eq('id', notificationId).eq('user_id', appUser.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro interno' }, { status: 500 })
  }
}
