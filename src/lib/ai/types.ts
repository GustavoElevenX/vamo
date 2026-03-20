// ============ AI Analysis Types ============

export interface AIAnalysisResult {
  executive_summary: string
  bottlenecks: string[]
  financial_implications: string
  strengths: string[]
  weaknesses: string[]
  priority_actions: {
    action: string
    area: string
    impact: 'alto' | 'medio' | 'baixo'
  }[]
}

export interface BehavioralProfile {
  dominant_profile: 'D' | 'I' | 'S' | 'C'
  profile_name: string
  profile_description: string
  scores: {
    D: number
    I: number
    S: number
    C: number
    E?: number
    A?: number
  }
  selling_strengths: string[]
  development_areas: string[]
  communication_style: string
  ideal_sales_role: string
  wellbeing_insight?: string
  performance_insight?: string
}

export interface AIMission {
  id: string
  organization_id: string
  user_id: string
  session_id: string | null
  title: string
  description: string
  area: 'lead_generation' | 'sales_process' | 'team_management' | 'tools_technology'
  difficulty: 1 | 2 | 3
  xp_reward: number
  criteria: Record<string, unknown>
  resources: { title: string; url?: string }[]
  status: 'pending' | 'in_progress' | 'completed' | 'skipped'
  completed_at: string | null
  created_at: string
  mission_type?: 'atividade' | 'habilidade' | 'resultado' | 'habito' | 'coletiva' | 'colaboracao'
  verification_method?: 'automatic' | 'mixed' | 'manual'
  is_collective?: boolean
  collaborator_ids?: string[]
}

export interface CoachTip {
  tip: string
  category: 'motivacional' | 'tecnica' | 'comportamental' | 'estrategica'
}

export interface AIAnalysisRecord {
  id: string
  session_id: string
  organization_id: string
  user_id: string
  analysis_type: 'diagnostic' | 'behavioral'
  result: AIAnalysisResult
  model_used: string
  created_at: string
}

export interface BehavioralProfileRecord {
  id: string
  user_id: string
  organization_id: string
  answers: BehavioralAnswer[]
  profile_result: BehavioralProfile
  model_used: string
  created_at: string
}

export interface BehavioralAnswer {
  question_id: number
  selected_option: 'D' | 'I' | 'S' | 'C' | 'E' | 'A'
}

export interface BehavioralQuestion {
  id: number
  dimension: 'D' | 'I' | 'S' | 'C' | 'E' | 'A'
  question: string
  options: {
    label: string
    trait: 'D' | 'I' | 'S' | 'C' | 'E' | 'A'
    score?: number
  }[]
}
