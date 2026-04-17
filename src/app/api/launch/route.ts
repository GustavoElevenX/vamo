import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

// GET - verifica se a organização já tem um lançamento registrado
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

    const { data: launch } = await adminClient
      .from('program_launches')
      .select('id, launch_message, team_member_ids, created_at, launched_by')
      .eq('organization_id', appUser.organization_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({ launch: launch ?? null })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro interno' }, { status: 500 })
  }
}

// POST - registra o lançamento e envia mensagem via chat nativo da plataforma
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const adminClient = createAdminClient()
    const { data: appUser } = await adminClient
      .from('users')
      .select('id, organization_id, role')
      .eq('auth_id', authUser.id)
      .single()

    if (!appUser) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    if (!['manager', 'admin'].includes(appUser.role)) {
      return NextResponse.json({ error: 'Apenas gestores podem lançar o programa' }, { status: 403 })
    }

    const { launch_message, team_member_ids } = await req.json() as {
      launch_message: string
      team_member_ids: string[]
    }

    if (!launch_message?.trim()) {
      return NextResponse.json({ error: 'Mensagem de lançamento é obrigatória' }, { status: 400 })
    }
    if (!Array.isArray(team_member_ids) || team_member_ids.length === 0) {
      return NextResponse.json({ error: 'Selecione ao menos um vendedor para o lançamento' }, { status: 400 })
    }

    // Registrar o lançamento
    const { data: launch, error: launchError } = await adminClient
      .from('program_launches')
      .insert({
        organization_id: appUser.organization_id,
        launched_by: appUser.id,
        launch_message: launch_message.trim(),
        team_member_ids,
      })
      .select('id, created_at')
      .single()

    if (launchError) {
      return NextResponse.json({ error: launchError.message }, { status: 500 })
    }

    // Criar conversa de grupo no chat nativo
    const { data: conversation, error: convError } = await adminClient
      .from('chat_conversations')
      .insert({
        organization_id: appUser.organization_id,
        is_group: true,
        name: 'Lançamento do Programa',
        created_by: appUser.id,
        last_message_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (convError || !conversation) {
      return NextResponse.json({
        launch,
        warning: 'Programa lançado, mas não foi possível criar o chat de lançamento.',
      })
    }

    // Adicionar todos os participantes: gestor + vendedores selecionados
    const allParticipantIds = Array.from(new Set([appUser.id, ...team_member_ids]))
    const participants = allParticipantIds.map((userId) => ({
      conversation_id: conversation.id,
      user_id: userId,
    }))

    await adminClient.from('chat_participants').insert(participants)

    // Enviar a mensagem de lançamento no chat
    const { error: msgError } = await adminClient.from('chat_messages').insert({
      conversation_id: conversation.id,
      organization_id: appUser.organization_id,
      sender_id: appUser.id,
      content: launch_message.trim(),
    })

    if (msgError) {
      return NextResponse.json({
        launch,
        warning: 'Programa lançado, mas a mensagem no chat não foi enviada.',
      })
    }

    return NextResponse.json({
      launch,
      chat_conversation_id: conversation.id,
      participants_count: team_member_ids.length,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro interno' }, { status: 500 })
  }
}
