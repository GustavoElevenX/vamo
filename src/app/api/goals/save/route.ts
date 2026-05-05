import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRecommendation } from '@/lib/services/action-recommendation.service'
import { createEventWithImpacts } from '@/lib/services/performance-os.service'

export const runtime = 'nodejs'

interface IndividualGoal {
  user_id: string
  goal: string
  xp_reward?: number
  commission_bonus?: number
  status?: string
  progresso?: string
}

interface CompanyGoal {
  kpiFinanceiro: string
  valorAtual: string
  valorMeta: string
  prazo: string
  metrica: string
}

interface TeamGoal {
  kpiComportamental: string
  valorAtual: string
  valorMeta: string
  prazo: string
  medicao: string
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const adminClient = createAdminClient()
    const { data: appUser } = await adminClient
      .from('users')
      .select('id, organization_id, name, role')
      .eq('auth_id', authUser.id)
      .single()

    if (!appUser) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    if (!['manager', 'admin'].includes(appUser.role)) {
      return NextResponse.json({ error: 'Apenas gestores podem definir metas' }, { status: 403 })
    }

    const { company_goal, team_goal, individual_goals } = await req.json() as {
      company_goal: CompanyGoal
      team_goal: TeamGoal
      individual_goals: IndividualGoal[]
    }

    // 1. Upsert program_goals
    const { error: goalsError } = await adminClient
      .from('program_goals')
      .upsert({
        organization_id: appUser.organization_id,
        company_goal,
        team_goal,
        individual_goals,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'organization_id' })

    if (goalsError) throw new Error(goalsError.message)

    const { data: savedGoal } = await adminClient
      .from('program_goals')
      .select('id')
      .eq('organization_id', appUser.organization_id)
      .maybeSingle()

    const { event: goalEvent } = await createEventWithImpacts(
      adminClient,
      {
        organizationId: appUser.organization_id,
        actorUserId: appUser.id,
        targetUserId: appUser.id,
        eventType: 'goal.updated',
        sourceModule: 'goal',
        entityType: 'program_goal',
        entityId: savedGoal?.id ?? null,
        title: 'Metas comerciais atualizadas',
        description: 'Meta da empresa, do time e metas individuais foram conectadas a rotina, ganho e forecast.',
        impactScore: 70,
        priorityScore: 75,
        metadata: { company_goal, team_goal, individual_goals },
      },
      [
        { impactedModule: 'hoje', impactedEntityType: 'program_goal', impactedEntityId: savedGoal?.id ?? null, impactType: 'daily_priority_created' },
        { impactedModule: 'hoje_gestor', impactedEntityType: 'program_goal', impactedEntityId: savedGoal?.id ?? null, impactType: 'manager_decision_context' },
        { impactedModule: 'goal', impactedEntityType: 'program_goal', impactedEntityId: savedGoal?.id ?? null, impactType: 'goal_updated' },
        { impactedModule: 'mission', impactedEntityType: 'program_goal', impactedEntityId: savedGoal?.id ?? null, impactType: 'mission_candidate' },
        { impactedModule: 'commission', impactedEntityType: 'program_goal', impactedEntityId: savedGoal?.id ?? null, impactType: 'bonus_rule_context' },
        { impactedModule: 'forecast', impactedEntityType: 'program_goal', impactedEntityId: savedGoal?.id ?? null, impactType: 'forecast_target_updated' },
      ],
    )

    const now = new Date().toISOString()
    const managerName = appUser.name.split(' ')[0]

    // 2. Individual goal notifications + 1:1 chats
    const sellersWithGoal = individual_goals.filter((g) => g.goal.trim())
    for (const ig of sellersWithGoal) {
      const rewards: string[] = []
      if (ig.xp_reward) rewards.push(`${ig.xp_reward} XP`)
      if (ig.commission_bonus) rewards.push(`R$ ${ig.commission_bonus} de bônus`)
      const rewardStr = rewards.length ? ` | Recompensa: ${rewards.join(' + ')}` : ''
      const message = `${managerName} definiu sua meta: "${ig.goal}"${rewardStr}`

      // Notification (bell)
      await adminClient.from('notifications').insert({
        organization_id: appUser.organization_id,
        user_id: ig.user_id,
        sender_id: appUser.id,
        message,
      })

      // Chat 1:1 — create conversation
      await createRecommendation(adminClient, {
        organizationId: appUser.organization_id,
        eventId: goalEvent.id,
        targetUserId: ig.user_id,
        createdByUserId: appUser.id,
        sourceModule: 'goal',
        recommendationType: 'next_action',
        title: `Prioridade da meta: ${ig.goal}`,
        description: `Transforme esta meta em uma acao no CRM hoje.${rewardStr}`,
        suggestedActionLabel: 'Abrir Hoje',
        suggestedActionHref: '/hoje',
        priority: 'high',
        metadata: { goal: ig, programGoalId: savedGoal?.id ?? null },
      })

      const { data: conv } = await adminClient
        .from('chat_conversations')
        .insert({
          organization_id: appUser.organization_id,
          is_group: false,
          created_by: appUser.id,
          last_message_at: now,
        })
        .select('id')
        .single()

      if (conv) {
        await adminClient.from('chat_participants').insert([
          { conversation_id: conv.id, user_id: appUser.id },
          { conversation_id: conv.id, user_id: ig.user_id },
        ])
        await adminClient.from('chat_messages').insert({
          conversation_id: conv.id,
          organization_id: appUser.organization_id,
          sender_id: appUser.id,
          content: message,
        })
      }
    }

    // 3. Team goal notification + group chat (only if team goal is meaningful)
    const hasTeamGoal = team_goal.kpiComportamental?.trim() || team_goal.valorMeta?.trim()
    if (hasTeamGoal) {
      // Fetch all active sellers in org
      const { data: allSellers } = await adminClient
        .from('users')
        .select('id')
        .eq('organization_id', appUser.organization_id)
        .eq('role', 'seller')
        .eq('active', true)

      const sellerIds = (allSellers ?? []).map((s: { id: string }) => s.id)

      if (sellerIds.length > 0) {
        const teamMsg = [
          `${managerName} definiu a meta do time:`,
          team_goal.kpiComportamental ? `KPI: ${team_goal.kpiComportamental}` : null,
          team_goal.valorAtual ? `Atual: ${team_goal.valorAtual}` : null,
          team_goal.valorMeta ? `Meta: ${team_goal.valorMeta}` : null,
          team_goal.prazo ? `Prazo: ${new Date(team_goal.prazo).toLocaleDateString('pt-BR')}` : null,
        ].filter(Boolean).join(' | ')

        // Bell notifications for all sellers
        await adminClient.from('notifications').insert(
          sellerIds.map((uid: string) => ({
            organization_id: appUser.organization_id,
            user_id: uid,
            sender_id: appUser.id,
            message: teamMsg,
          }))
        )

        // Group chat
        const { data: groupConv } = await adminClient
          .from('chat_conversations')
          .insert({
            organization_id: appUser.organization_id,
            is_group: true,
            name: 'Meta do Time',
            created_by: appUser.id,
            last_message_at: now,
          })
          .select('id')
          .single()

        if (groupConv) {
          const participants = [appUser.id, ...sellerIds].map((uid: string) => ({
            conversation_id: groupConv.id,
            user_id: uid,
          }))
          await adminClient.from('chat_participants').insert(participants)
          await adminClient.from('chat_messages').insert({
            conversation_id: groupConv.id,
            organization_id: appUser.organization_id,
            sender_id: appUser.id,
            content: teamMsg,
          })
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
