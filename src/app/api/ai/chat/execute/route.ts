import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { executeAction } from '@/lib/services/action-executor.service'
import type { ActionType } from '@/types/chat'

const VALID_ACTIONS: ActionType[] = [
  'analyze_operation', 'simulate_decision', 'generate_manager_briefing',
  'generate_meeting_agenda', 'create_action_plan', 'create_pdi_plan',
  'create_recovery_mission', 'create_manager_nudge', 'mark_recommendation_done',
  'add_seller', 'edit_seller', 'remove_seller',
  'create_mission', 'edit_mission', 'delete_mission',
  'define_kpi', 'edit_kpi', 'delete_kpi', 'set_goal',
  'set_goal_rewards', 'update_goal_status',
  'award_xp', 'generate_briefing', 'generate_retrospective',
  'create_challenge', 'register_kpi_value', 'notify_seller',
  'send_chat_message',
]

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()

    if (!authUser) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const adminClient = createAdminClient()
    const { data: appUser } = await adminClient
      .from('users')
      .select('id, organization_id, role')
      .eq('auth_id', authUser.id)
      .single()

    if (!appUser || !['manager', 'admin'].includes(appUser.role)) {
      return NextResponse.json({ error: 'Apenas gestores podem executar ações' }, { status: 403 })
    }

    const { actionType, params } = await req.json() as {
      actionType: ActionType
      params: Record<string, unknown>
    }

    if (!VALID_ACTIONS.includes(actionType)) {
      return NextResponse.json({ error: `Ação inválida: ${actionType}` }, { status: 400 })
    }

    const result = await executeAction(
      adminClient,
      supabase,
      actionType,
      params,
      appUser.organization_id,
      appUser.id
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('Execute action error:', error)
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
