export const APP_NAME = 'VAMO'
export const APP_DESCRIPTION = 'Plataforma de Performance Comercial'

export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  SELLER: 'seller',
  DEVELOPER: 'developer',
} as const

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  manager: 'Gestor',
  seller: 'Vendedor',
  developer: 'Desenvolvedor',
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
  { level: 1, name: 'Recruta', xp_required: 0 },
  { level: 2, name: 'Prospector', xp_required: 500 },
  { level: 3, name: 'Negociador', xp_required: 1500 },
  { level: 4, name: 'Hunter', xp_required: 3000 },
  { level: 5, name: 'Closer', xp_required: 5500 },
  { level: 6, name: 'Elite', xp_required: 9000 },
  { level: 7, name: 'Campeão', xp_required: 14000 },
  { level: 8, name: 'Lenda', xp_required: 21000 },
] as const

// ============ Navigation ============

export interface NavItem {
  label: string
  href: string
  icon: string
  badge?: 'alert'
}

export interface NavGroup {
  key: string
  label: string
  prefix?: string
  items: NavItem[]
}

export const NAV_CONFIG: Record<string, NavGroup[]> = {
  manager: [
    {
      key: 'chat-ia',
      label: 'VAMO IA',
      items: [
        { label: 'Converse com VAMO IA', href: '/chat-ia', icon: 'MessageSquare' },
      ],
    },
    {
      key: 'diagnostico',
      label: 'Diagnóstico',
      prefix: '1',
      items: [
        { label: 'Diagnóstico da Empresa', href: '/diagnostico', icon: 'Search' },
        { label: 'Diagnóstico Individual', href: '/diagnostico/individual', icon: 'User' },
        { label: 'Parecer Final da VAMO IA', href: '/diagnostico/parecer', icon: 'ClipboardList' },
      ],
    },
    {
      key: 'objetivos',
      label: 'Objetivos',
      prefix: '2',
      items: [
        { label: 'Definir Metas', href: '/objetivos/metas', icon: 'Target' },
        { label: 'Plano de Ação', href: '/objetivos/plano-acao', icon: 'Rocket' },
        { label: 'Recompensas', href: '/objetivos/recompensas', icon: 'Star' },
        { label: 'Lançamento', href: '/objetivos/lancamento', icon: 'Rocket' },
      ],
    },
    {
      key: 'configuracao',
      label: 'Configuração',
      prefix: '3',
      items: [
        { label: 'KPIs', href: '/configuracao/kpis', icon: 'BarChart3' },
        { label: 'Integrações', href: '/configuracao/integracoes', icon: 'Link' },
        { label: 'Regras e Gatilhos', href: '/configuracao/regras-gatilhos', icon: 'Settings' },
        { label: 'Gamificação', href: '/configuracao/gamificacao', icon: 'Gamepad2' },
      ],
    },
    {
      key: 'monitoramento',
      label: 'Monitoramento',
      prefix: '4',
      items: [
        { label: 'Visão Geral — ROI', href: '/monitoramento', icon: 'TrendingUp' },
        { label: 'Funil em Tempo Real', href: '/monitoramento/funil', icon: 'Filter' },
        { label: 'Performance da Equipe', href: '/monitoramento/equipe', icon: 'Users' },
        { label: 'Alertas da VAMO IA', href: '/monitoramento/alertas', icon: 'Zap', badge: 'alert' },
        { label: 'Saúde da Equipe', href: '/monitoramento/saude-equipe', icon: 'HeartPulse' },
        { label: 'Comissionamento', href: '/monitoramento/comissionamento', icon: 'DollarSign' },
        { label: 'ROI da Plataforma', href: '/monitoramento/roi', icon: 'PieChart' },
      ],
    },
    {
      key: 'config-geral',
      label: 'Configurações',
      items: [
        { label: 'Empresa e Plano', href: '/configuracoes/empresa', icon: 'Building2' },
      ],
    },
  ],
  seller: [
    {
      key: 'chat-ia',
      label: 'VAMO IA',
      items: [
        { label: 'Converse com VAMO IA', href: '/chat-ia', icon: 'MessageSquare' },
      ],
    },
    {
      key: 'desempenho',
      label: 'Meu Desempenho',
      prefix: 'A',
      items: [
        { label: 'Performance', href: '/performance', icon: 'LayoutDashboard' },
        { label: 'Indicadores', href: '/performance/indicadores', icon: 'BarChart3' },
        { label: 'Missões Ativas', href: '/performance/missoes', icon: 'CheckSquare' },
      ],
    },
    {
      key: 'ganhos',
      label: 'Meus Ganhos',
      prefix: 'B',
      items: [
        { label: 'Comissão', href: '/ganhos/comissao', icon: 'DollarSign' },
        { label: 'Projeção de Ganhos', href: '/ganhos/projecao', icon: 'TrendingUp' },
      ],
    },
    {
      key: 'desenvolvimento',
      label: 'Meu Desenvolvimento',
      prefix: 'C',
      items: [
        { label: 'Feedback da VAMO IA', href: '/desenvolvimento/feedback-ia', icon: 'Bot' },
        { label: 'Conquistas e XP', href: '/desenvolvimento/conquistas', icon: 'Medal' },
        { label: 'Loja de Recompensas', href: '/desenvolvimento/loja', icon: 'ShoppingBag' },
      ],
    },
    {
      key: 'feed',
      label: 'Feed',
      prefix: 'D',
      items: [
        { label: 'Reconhecimento', href: '/feed', icon: 'Megaphone' },
      ],
    },
  ],
  developer: [
    {
      key: 'sistema',
      label: 'Sistema',
      prefix: 'T',
      items: [
        { label: 'Logs do Sistema', href: '/sistema/logs', icon: 'Terminal' },
        { label: 'Integrações API', href: '/sistema/integracoes', icon: 'Plug' },
        { label: 'Configuração Avançada', href: '/sistema/configuracao', icon: 'Wrench' },
      ],
    },
  ],
  admin: [
    {
      key: 'admin',
      label: 'Administração',
      items: [
        { label: 'Dashboard', href: '/admin', icon: 'LayoutDashboard' },
        { label: 'Clientes', href: '/admin/clientes', icon: 'Building2' },
        { label: 'Diagnósticos', href: '/admin/diagnosticos', icon: 'ClipboardCheck' },
        { label: 'Templates', href: '/admin/templates', icon: 'FileText' },
        { label: 'Analytics', href: '/admin/analytics', icon: 'BarChart3' },
      ],
    },
  ],
}

// Route protection per role
export const MANAGER_ONLY_ROUTES = [
  '/diagnostico',
  '/objetivos',
  '/configuracao',
  '/monitoramento',
]

export const SELLER_ONLY_ROUTES = [
  '/performance',
  '/ganhos',
  '/desenvolvimento',
]

export const DEVELOPER_ONLY_ROUTES = [
  '/sistema',
]

export const ADMIN_ONLY_ROUTES = [
  '/admin',
]

// Default home route per role
export const ROLE_HOME: Record<string, string> = {
  manager: '/monitoramento',
  seller: '/performance',
  developer: '/sistema/logs',
  admin: '/admin',
}
