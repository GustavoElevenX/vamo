export type ActionType =
  | 'add_seller'
  | 'edit_seller'
  | 'remove_seller'
  | 'create_mission'
  | 'edit_mission'
  | 'delete_mission'
  | 'define_kpi'
  | 'edit_kpi'
  | 'delete_kpi'
  | 'set_goal'
  | 'award_xp'
  | 'generate_briefing'
  | 'generate_retrospective'
  | 'create_challenge'
  | 'register_kpi_value'
  | 'notify_seller'
  | 'send_chat_message'
  | 'set_goal_rewards'
  | 'update_goal_status'

export type ActionStatus = 'pending' | 'approved' | 'rejected' | 'executing' | 'completed' | 'failed'

export interface ActionPayload {
  action: ActionType
  params: Record<string, unknown>
  summary: string
}

export interface ActionResult {
  success: boolean
  message: string
  data?: unknown
}

export interface ActionCard {
  id: string
  action: ActionPayload
  status: ActionStatus
  result?: ActionResult
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  id: number
  actionCard?: ActionCard
}
