import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  findOrCreateDirectConversation,
  createGroupConversation,
} from '@/lib/services/chat.service'

export const runtime = 'nodejs'

/**
 * GET /api/chat/conversations
 * Lista todas as conversas do usuário atual com última mensagem e contador de não lidas.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()
    if (!authUser) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const adminClient = createAdminClient()
    const { data: appUser } = await adminClient
      .from('users')
      .select('id, organization_id, role')
      .eq('auth_id', authUser.id)
      .single()

    if (!appUser) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    // Busca IDs de conversas onde sou participante
    const { data: myParts } = await adminClient
      .from('chat_participants')
      .select('conversation_id, last_read_at')
      .eq('user_id', appUser.id)

    const convIds = (myParts || []).map((p) => p.conversation_id as string)
    if (convIds.length === 0) {
      return NextResponse.json({ conversations: [] })
    }

    const readMap: Record<string, string> = {}
    for (const p of myParts || []) readMap[p.conversation_id as string] = p.last_read_at as string

    // Carrega conversas
    const { data: convs } = await adminClient
      .from('chat_conversations')
      .select('id, is_group, name, last_message_at, created_at')
      .in('id', convIds)
      .order('last_message_at', { ascending: false, nullsFirst: false })

    // Carrega todos os participantes dessas conversas (para nome/avatar)
    const { data: allParts } = await adminClient
      .from('chat_participants')
      .select('conversation_id, user_id')
      .in('conversation_id', convIds)

    const userIds = Array.from(new Set((allParts || []).map((p) => p.user_id as string)))
    const { data: usersData } = await adminClient
      .from('users')
      .select('id, name, avatar_url, role')
      .in('id', userIds)

    const userById: Record<string, { id: string; name: string; avatar_url: string | null; role: string }> = {}
    for (const u of usersData || []) userById[u.id as string] = u as typeof userById[string]

    const participantsByConv: Record<string, { id: string; name: string; avatar_url: string | null; role: string }[]> = {}
    for (const p of allParts || []) {
      const uid = p.user_id as string
      const cid = p.conversation_id as string
      if (!participantsByConv[cid]) participantsByConv[cid] = []
      if (userById[uid]) participantsByConv[cid].push(userById[uid])
    }

    // Última mensagem por conversa
    const { data: lastMsgs } = await adminClient
      .from('chat_messages')
      .select('conversation_id, content, created_at, sender_id')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: false })

    const lastByConv: Record<string, { content: string; created_at: string; sender_id: string }> = {}
    for (const m of lastMsgs || []) {
      const cid = m.conversation_id as string
      if (!lastByConv[cid]) {
        lastByConv[cid] = {
          content: m.content as string,
          created_at: m.created_at as string,
          sender_id: m.sender_id as string,
        }
      }
    }

    // Contador de não lidas: mensagens com created_at > last_read_at e sender != eu
    const unreadByConv: Record<string, number> = {}
    for (const m of lastMsgs || []) {
      const cid = m.conversation_id as string
      const lastRead = readMap[cid]
      if (!lastRead) continue
      if ((m.sender_id as string) === appUser.id) continue
      if (new Date(m.created_at as string) > new Date(lastRead)) {
        unreadByConv[cid] = (unreadByConv[cid] || 0) + 1
      }
    }

    const result = (convs || []).map((c) => {
      const parts = participantsByConv[c.id as string] || []
      const others = parts.filter((p) => p.id !== appUser.id)
      const displayName = c.is_group
        ? (c.name as string) || 'Grupo'
        : others[0]?.name || 'Conversa'
      return {
        id: c.id,
        is_group: c.is_group,
        name: displayName,
        participants: parts,
        last_message: lastByConv[c.id as string] || null,
        last_message_at: c.last_message_at,
        unread_count: unreadByConv[c.id as string] || 0,
      }
    })

    return NextResponse.json({ conversations: result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/chat/conversations
 * Cria ou recupera uma conversa.
 * Body: { target_user_id?: string, participant_ids?: string[], is_group?: boolean, name?: string }
 *  - 1:1 direto: { target_user_id: "..." }
 *  - Grupo: { is_group: true, name: "...", participant_ids: [...] }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()
    if (!authUser) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const adminClient = createAdminClient()
    const { data: appUser } = await adminClient
      .from('users')
      .select('id, organization_id, role')
      .eq('auth_id', authUser.id)
      .single()

    if (!appUser) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    const body = (await req.json()) as {
      target_user_id?: string
      participant_ids?: string[]
      is_group?: boolean
      name?: string
    }

    // 1:1
    if (!body.is_group && body.target_user_id) {
      // Valida que o destinatário é da mesma org
      const { data: target } = await adminClient
        .from('users')
        .select('id, organization_id')
        .eq('id', body.target_user_id)
        .single()
      if (!target || target.organization_id !== appUser.organization_id) {
        return NextResponse.json({ error: 'Destinatário inválido' }, { status: 400 })
      }

      const convId = await findOrCreateDirectConversation(
        adminClient,
        appUser.organization_id,
        appUser.id,
        body.target_user_id
      )
      return NextResponse.json({ conversation_id: convId })
    }

    // Grupo
    if (body.is_group && body.participant_ids && body.participant_ids.length > 0) {
      // Só gestor/admin pode criar grupos
      if (!['manager', 'admin'].includes(appUser.role)) {
        return NextResponse.json({ error: 'Apenas gestores podem criar grupos' }, { status: 403 })
      }
      // Valida participantes da mesma org
      const { data: validUsers } = await adminClient
        .from('users')
        .select('id')
        .in('id', body.participant_ids)
        .eq('organization_id', appUser.organization_id)

      const validIds = (validUsers || []).map((u) => u.id as string)
      if (validIds.length === 0) {
        return NextResponse.json({ error: 'Nenhum participante válido' }, { status: 400 })
      }

      const convId = await createGroupConversation(
        adminClient,
        appUser.organization_id,
        appUser.id,
        body.name || 'Grupo',
        validIds
      )
      return NextResponse.json({ conversation_id: convId })
    }

    return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
