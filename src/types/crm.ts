export type DealStage =
  | 'prospecting'
  | 'qualification'
  | 'proposal'
  | 'negotiation'
  | 'closed_won'
  | 'closed_lost'

export type ActivityType =
  | 'call'
  | 'email'
  | 'meeting'
  | 'proposal_sent'
  | 'whatsapp'
  | 'follow_up'
  | 'note'

export type NextActionType =
  | 'follow_up'
  | 'call'
  | 'email'
  | 'proposal'
  | 'meeting'
  | 'review'
  | 'other'

export type NextActionStatus = 'open' | 'done' | 'snoozed'

export type ForecastCategory = 'pipeline' | 'best_case' | 'commit' | 'closed'

export const STAGE_LABELS: Record<DealStage, string> = {
  prospecting: 'Prospecção',
  qualification: 'Qualificação',
  proposal: 'Proposta',
  negotiation: 'Negociação',
  closed_won: 'Ganho',
  closed_lost: 'Perdido',
}

export const STAGE_ORDER: DealStage[] = [
  'prospecting',
  'qualification',
  'proposal',
  'negotiation',
  'closed_won',
]

export const STAGE_STUCK_DAYS: Record<DealStage, number> = {
  prospecting: 3,
  qualification: 4,
  proposal: 5,
  negotiation: 7,
  closed_won: 9999,
  closed_lost: 9999,
}

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  call: 'Ligação',
  email: 'E-mail',
  meeting: 'Reunião',
  proposal_sent: 'Proposta',
  whatsapp: 'WhatsApp',
  follow_up: 'Follow-up',
  note: 'Nota',
}

export const NEXT_ACTION_LABELS: Record<NextActionType, string> = {
  follow_up: 'Follow-up',
  call: 'Ligação',
  email: 'E-mail',
  proposal: 'Proposta',
  meeting: 'Reunião',
  review: 'Revisão',
  other: 'Outra ação',
}

export const FORECAST_LABELS: Record<ForecastCategory, string> = {
  pipeline: 'Pipeline',
  best_case: 'Provável',
  commit: 'Comprometido',
  closed: 'Fechado',
}

export interface CrmAccount {
  id: string
  organization_id: string
  name: string
  cnpj: string | null
  segment: string | null
  website: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface PlaybookStep {
  id: string
  organization_id: string
  stage: DealStage
  order_index: number
  title: string
  description: string | null
  is_required: boolean
  created_at: string
}

export interface PlaybookStepCompletion {
  id: string
  step_id: string
  deal_id: string
  user_id: string
  completed_at: string
}

export interface CrmActivity {
  id: string
  deal_id: string
  user_id: string
  type: ActivityType
  title: string
  notes: string | null
  outcome: string | null
  occurred_at: string
  created_at: string
  user?: { id: string; name: string }
}

export interface CrmDeal {
  id: string
  organization_id: string
  account_id: string | null
  owner_id: string
  title: string
  value: number
  stage: DealStage
  probability: number
  expected_close: string | null
  lost_reason: string | null
  notes: string | null
  last_activity_at: string | null
  next_action_title: string | null
  next_action_type: NextActionType | null
  next_action_due_at: string | null
  next_action_status: NextActionStatus
  forecast_category: ForecastCategory
  ai_priority_score: number
  received_amount?: number | null
  received_at?: string | null
  product_id?: string | null
  product_name?: string | null
  category_id?: string | null
  category_name?: string | null
  commercial_table_id?: string | null
  commercial_table_name?: string | null
  created_at: string
  updated_at: string
  account?: Pick<CrmAccount, 'id' | 'name'> | null
  owner?: { id: string; name: string; avatar_url?: string | null } | null
  activities?: CrmActivity[]
  playbook_completions?: PlaybookStepCompletion[]
}
