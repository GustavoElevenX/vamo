export const APP_NAME = 'GamePerformance'
export const APP_DESCRIPTION = 'Plataforma de Gamificação Comercial'

export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  SELLER: 'seller',
} as const

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  manager: 'Gestor',
  seller: 'Vendedor',
}

export const DIAGNOSTIC_AREAS = {
  lead_generation: 'Geração de Leads',
  sales_process: 'Processo de Vendas',
  team_management: 'Gestão de Equipe',
  tools_technology: 'Ferramentas e Tecnologia',
} as const

export const DIAGNOSTIC_QUADRANTS = {
  critical: { label: 'Crítico', color: '#ef4444', min: 0, max: 25 },
  at_risk: { label: 'Em Risco', color: '#f59e0b', min: 25, max: 50 },
  developing: { label: 'Em Desenvolvimento', color: '#3b82f6', min: 50, max: 75 },
  optimized: { label: 'Otimizado', color: '#22c55e', min: 75, max: 100 },
} as const

export const BADGE_RARITIES = {
  common: { label: 'Comum', color: '#9ca3af' },
  rare: { label: 'Raro', color: '#3b82f6' },
  epic: { label: 'Épico', color: '#a855f7' },
  legendary: { label: 'Lendário', color: '#f59e0b' },
} as const

export const DEFAULT_XP_LEVELS = [
  { level: 1, name: 'Rookie', xp_required: 0 },
  { level: 2, name: 'Aprendiz', xp_required: 100 },
  { level: 3, name: 'Explorador', xp_required: 300 },
  { level: 4, name: 'Competidor', xp_required: 600 },
  { level: 5, name: 'Especialista', xp_required: 1000 },
  { level: 6, name: 'Campeão', xp_required: 1500 },
  { level: 7, name: 'Mestre', xp_required: 2200 },
  { level: 8, name: 'Lenda', xp_required: 3000 },
] as const

export const NAV_ITEMS = {
  seller: [
    { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard' },
    { label: 'Meus KPIs', href: '/kpis', icon: 'Target' },
    { label: 'Ranking', href: '/ranking', icon: 'Trophy' },
    { label: 'Desafios', href: '/desafios', icon: 'Swords' },
    { label: 'Conquistas', href: '/conquistas', icon: 'Medal' },
    { label: 'Loja', href: '/loja', icon: 'ShoppingBag' },
    { label: 'Padronização', href: '/padronizacao', icon: 'BookOpen' },
  ],
  manager: [
    { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard' },
    { label: 'KPIs', href: '/kpis', icon: 'Target' },
    { label: 'Ranking', href: '/ranking', icon: 'Trophy' },
    { label: 'Desafios', href: '/desafios', icon: 'Swords' },
    { label: 'Conquistas', href: '/conquistas', icon: 'Medal' },
    { label: 'Loja', href: '/loja', icon: 'ShoppingBag' },
    { label: 'Padronização', href: '/padronizacao', icon: 'BookOpen' },
    { label: 'Equipe', href: '/equipe', icon: 'Users' },
    { label: 'Diagnóstico', href: '/diagnostico', icon: 'ClipboardCheck' },
    { label: 'Configurações', href: '/configuracoes', icon: 'Settings' },
  ],
  admin: [
    { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard' },
    { label: 'Clientes', href: '/admin/clientes', icon: 'Building2' },
    { label: 'Diagnósticos', href: '/admin/diagnosticos', icon: 'ClipboardCheck' },
    { label: 'Templates', href: '/admin/templates', icon: 'FileText' },
    { label: 'Analytics', href: '/admin/analytics', icon: 'BarChart3' },
  ],
} as const
