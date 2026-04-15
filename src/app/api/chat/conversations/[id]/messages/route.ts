import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendChatMessage } from '@/lib/services/chat.service'

export const runtime = 'nodejs'

/**
 * GET /api/chat/conversations/[id]/messages
 * Lista mensagens de uma conversa. Suporta ?since=ISO para polling incremental.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await ctx.params
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

    // Valida acesso à conversa
    const { data: conv } = await adminClient
      .from('chat_conversations')
      .select('id, organization_id, is_group, name')
      .eq('id', conversationId)
      .single()

    if (!conv || conv.organization_id !== appUser.organization_id) {
      return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 })
    }

    const { data: isPart } = await adminClient
      .from('chat_participants')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('user_id', appUser.id)
      .maybeSingle()

    if (!isPart && !['manager', 'admin'].includes(appUser.role)) {
      return NextResponse.json({ error: 'Sem acesso a esta conversa' }, { status: 403 })
    }

    const url = new URL(req.url)
    const since = url.searchParams.get('since')

    let query = adminClient
      .from('chat_messages')
      .select('id, sender_id, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(200)

    if (since) query = query.gt('created_at', since)

    const { data: messages } = await query

    // Participantes (para renderização de avatar/nome)
    const { data: parts } = await adminClient
      .from('chat_participants')
      .select('user_id')
      .eq('conversation_id', conversationId)

    const userIds = Array.from(new Set((parts || []).map((p) => p.user_id as string)))
    const { data: usersData } = await adminClient
      .from('users')
      .select('id, name, avatar_url, role')
      .in('id', userIds)

    return NextResponse.json({
      conversation: {
        id: conv.id,
        is_group: conv.is_group,
        name: conv.name,
      },
      participants: usersData || [],
      messages: messages || [],
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/chat/conversations/[id]/messages
 * Body: { content: string }
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await ctx.params
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

    const { content } = (await req.json()) as { content: string }
    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 })
    }
    if (content.length > 2000) {
      return NextResponse.json({ error: 'Mensagem muito longa (máx 2000)' }, { status: 400 })
    }

    // Valida acesso
    const { data: conv } = await adminClient
      .from('chat_conversations')
      .select('id, organization_id')
      .eq('id', conversationId)
      .single()

    if (!conv || conv.organization_id !== appUser.organization_id) {
      return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 })
    }

    const { data: isPart } = await adminClient
      .from('chat_participants')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('user_id', appUser.id)
      .maybeSingle()

    // Gestor pode enviar mesmo sem ser participante explícito (auto-adiciona)
    if (!isPart) {
      if (!['manager', 'admin'].includes(appUser.role)) {
        return NextResponse.json({ error: 'Sem acesso a esta conversa' }, { status: 403 })
      }
      await adminClient
        .from('chat_participants')
        .insert({ conversation_id: conversationId, user_id: appUser.id })
    }

    const msg = await sendChatMessage(
      adminClient,
      appUser.organization_id,
      conversationId,
      appUser.id,
      content.trim()
    )

    // Atualiza last_read_at do remetente
    await adminClient
      .from('chat_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', appUser.id)

    return NextResponse.json({ success: true, message: msg })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
