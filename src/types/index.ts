// ============ Auth & Organization ============

export type UserRole = 'admin' | 'manager' | 'seller' | 'developer'

export interface Organization {
  id: string
  name: string
  slug: string
  logo_url: string | null
  primary_color: string
  plan: 'starter' | 'professional' | 'enterprise'
  settings: Record<string, unknown>
  active: boolean
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  auth_id: string
  organization_id: string
  name: string
  email: string
  role: UserRole
  avatar_url: string | null
  active: boolean
  created_at: string
  updated_at: string
}

// ============ Diagnostic ============

export type DiagnosticArea = 'lead_generation' | 'sales_process' | 'team_management' | 'tools_technology'

export type DiagnosticQuadrant = 'critical' | 'at_risk' | 'developing' | 'optimized'

export type DiagnosticStatus = 'draft' | 'in_progress' | 'completed'

export interface DiagnosticTemplate {
  id: string
  name: string
  version: number
  created_at: string
}

export interface DiagnosticQuestion {
  id: string
  template_id: string
  area: DiagnosticArea
  question_text: string
  options: { label: string; value: number }[]
  order_index: number
  weight: number
}

export interface DiagnosticSession {
  id: string
  organization_id: string
  template_id: string | null
  conducted_by: string
  respondent_name: string
  status: DiagnosticStatus
  total_score: number
  max_score: number
  health_pct: number
  quadrant: DiagnosticQuadrant | null
  area_scores: Record<string, { score: number; max: number; pct: number }>
  company_context?: Record<string, unknown> | null
  ai_qa?: { questions: unknown[]; answers: Record<number, number> } | null
  created_at: string
  completed_at: string | null
}

export interface DiagnosticAnswer {
  id: string
  session_id: string
  question_id: string
  score: number
  notes: string | null
}

// ============ Gamification ============

export interface KpiDefinition {
  id: string
  organization_id: string
  name: string
  slug: string
  description: string | null
  unit: string
  points_per_unit: number
  targets: { daily?: number; weekly?: number; monthly?: number } | null
  active: boolean
  created_at: string
}

export interface KpiEntry {
  id: string
  organization_id: string
  user_id: string
  kpi_id: string
  value: number
  points_earned: number
  recorded_at: string
  source: 'manual' | 'api'
  created_at: string
}

export interface XpLevel {
  id: string
  organization_id: string
  level: number
  name: string
  xp_required: number
  icon_url: string | null
}

export interface UserXp {
  id: string
  user_id: string
  organization_id: string
  total_xp: number
  current_level: number
  current_streak: number
  longest_streak: number
  last_activity_date: string | null
}

export interface XpTransaction {
  id: string
  user_id: string
  organization_id: string
  amount: number
  source_type: 'kpi' | 'badge' | 'challenge' | 'checklist' | 'bonus'
  source_id: string | null
  description: string
  created_at: string
}

export type BadgeRarity = 'common' | 'rare' | 'epic' | 'legendary'

export interface Badge {
  id: string
  organization_id: string
  name: string
  description: string
  icon_url: string | null
  category: string
  criteria: Record<string, unknown>
  xp_reward: number
  rarity: BadgeRarity
  active: boolean
  created_at: string
}

export interface UserBadge {
  id: string
  user_id: string
  badge_id: string
  earned_at: string
}

export type ChallengeType = 'individual' | 'team'

export interface Challenge {
  id: string
  organization_id: string
  title: string
  description: string
  type: ChallengeType
  criteria: Record<string, unknown>
  xp_reward: number
  bonus_reward: number
  start_date: string
  end_date: string
  active: boolean
  created_at: string
}

export interface ChallengeParticipant {
  id: string
  challenge_id: string
  user_id: string
  progress: number
  completed: boolean
  completed_at: string | null
}

export interface RewardCatalog {
  id: string
  organization_id: string
  name: string
  description: string
  image_url: string | null
  cost_xp: number
  quantity: number | null
  active: boolean
  created_at: string
}

export type RedemptionStatus = 'pending' | 'approved' | 'rejected' | 'delivered'

export interface RewardRedemption {
  id: string
  user_id: string
  reward_id: string
  organization_id: string
  xp_spent: number
  status: RedemptionStatus
  approved_by: string | null
  created_at: string
}

// ============ Standardization ============

export interface Playbook {
  id: string
  organization_id: string
  title: string
  category: string
  content: string
  order_index: number
  created_at: string
  updated_at: string
}

export interface ChecklistTemplate {
  id: string
  organization_id: string
  title: string
  items: { id: string; text: string; order: number }[]
  frequency: 'daily' | 'weekly' | 'monthly'
  xp_reward: number
  active: boolean
  created_at: string
}

export interface ChecklistCompletion {
  id: string
  template_id: string
  user_id: string
  organization_id: string
  items_completed: Record<string, boolean>
  fully_completed: boolean
  completed_at: string
}

// ============ AI ============

export type {
  AIAnalysisResult,
  BehavioralProfile,
  AIMission,
  CoachTip,
  AIAnalysisRecord,
  BehavioralProfileRecord,
  BehavioralAnswer,
  BehavioralQuestion,
} from '@/lib/ai/types'

// ============ Leaderboard ============

export type PeriodType = 'daily' | 'weekly' | 'monthly'

export interface LeaderboardEntry {
  user_id: string
  user_name: string
  avatar_url: string | null
  total_xp: number
  rank: number
  level: number
}

export interface LeaderboardSnapshot {
  id: string
  organization_id: string
  period_type: PeriodType
  period_start: string
  period_end: string
  rankings: LeaderboardEntry[]
  created_at: string
}
