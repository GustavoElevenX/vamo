import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Encontra uma conversa 1:1 existente entre exatamente dois usuários da mesma org,
 * ou cria uma nova. Retorna o ID da conversa.
 */
export async function findOrCreateDirectConversation(
  adminClient: SupabaseClient,
  orgId: string,
  userAId: string,
  userBId: string
): Promise<string> {
  if (userAId === userBId) throw new Error('Não é possível criar conversa consigo mesmo')

  // Busca conversas 1:1 onde userA é participante
  const { data: aConvs } = await adminClient
    .from('chat_participants')
    .select('conversation_id, chat_conversations!inner(id, is_group, organization_id)')
    .eq('user_id', userAId)
    .eq('chat_conversations.is_group', false)
    .eq('chat_conversations.organization_id', orgId)

  const candidateIds = (aConvs || []).map((r: { conversation_id: string }) => r.conversation_id)

  if (candidateIds.length > 0) {
    // Dessas, pega as que contêm também userB
    const { data: bMatches } = await adminClient
      .from('chat_participants')
      .select('conversation_id')
      .eq('user_id', userBId)
      .in('conversation_id', candidateIds)

    for (const m of bMatches || []) {
      // Confere que a conversa tem exatamente 2 participantes
      const { count } = await adminClient
        .from('chat_participants')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', m.conversation_id)
      if (count === 2) return m.conversation_id as string
    }
  }

  // Cria nova conversa 1:1
  const { data: conv, error: convErr } = await adminClient
    .from('chat_conversations')
    .insert({
      organization_id: orgId,
      is_group: false,
      created_by: userAId,
    })
    .select('id')
    .single()

  if (convErr || !conv) throw new Error(`Erro ao criar conversa: ${convErr?.message}`)

  const { error: partsErr } = await adminClient
    .from('chat_participants')
    .insert([
      { conversation_id: conv.id, user_id: userAId },
      { conversation_id: conv.id, user_id: userBId },
    ])

  if (partsErr) throw new Error(`Erro ao adicionar participantes: ${partsErr.message}`)

  return conv.id as string
}

/**
 * Cria uma conversa em grupo com um conjunto de participantes.
 */
export async function createGroupConversation(
  adminClient: SupabaseClient,
  orgId: string,
  creatorId: string,
  name: string,
  participantIds: string[]
): Promise<string> {
  const unique = Array.from(new Set([creatorId, ...participantIds]))
  if (unique.length < 2) throw new Error('Grupo precisa de pelo menos 2 participantes')

  const { data: conv, error: convErr } = await adminClient
    .from('chat_conversations')
    .insert({
      organization_id: orgId,
      is_group: true,
      name: name || 'Grupo',
      created_by: creatorId,
    })
    .select('id')
    .single()

  if (convErr || !conv) throw new Error(`Erro ao criar grupo: ${convErr?.message}`)

  const rows = unique.map((uid) => ({ conversation_id: conv.id, user_id: uid }))
  const { error: partsErr } = await adminClient.from('chat_participants').insert(rows)
  if (partsErr) throw new Error(`Erro ao adicionar participantes: ${partsErr.message}`)

  return conv.id as string
}

/**
 * Envia uma mensagem numa conversa. Assume que o sender já é participante.
 */
export async function sendChatMessage(
  adminClient: SupabaseClient,
  orgId: string,
  conversationId: string,
  senderId: string,
  content: string
): Promise<{ id: string; created_at: string }> {
  const { data, error } = await adminClient
    .from('chat_messages')
    .insert({
      conversation_id: conversationId,
      organization_id: orgId,
      sender_id: senderId,
      content,
    })
    .select('id, created_at')
    .single()

  if (error || !data) throw new Error(`Erro ao enviar mensagem: ${error?.message}`)
  return data as { id: string; created_at: string }
}
