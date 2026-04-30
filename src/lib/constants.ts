export const APP_NAME = 'VAMO'
export const APP_DESCRIPTION = 'Plataforma de Performance Comercial'

export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  SELLER: 'seller',
  DEVELOPER: 'developer',
  CONSULTANT: 'consultant',
} as const

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  manager: 'Gestor',
  seller: 'Vendedor',
  developer: 'Desenvolvedor',
  consultant: 'Consultor',
}

export const DIAGNOSTIC_AREAS = {
  lead_generation: 'Geracao de Leads',
  sales_process: 'Processo de Vendas',
  team_management: 'Gestao de Equipe',
  tools_technology: 'Ferramentas e Tecnologia',
} as const

export const DIAGNOSTIC_QUADRANTS = {
  critical: { label: 'Critico', color: '#ef4444', min: 0, max: 25 },
  at_risk: { label: 'Em Risco', color: '#f59e0b', min: 25, max: 50 },
  developing: { label: 'Em Desenvolvimento', color: '#3b82f6', min: 50, max: 75 },
  optimized: { label: 'Otimizado', color: '#22c55e', min: 75, max: 100 },
} as const

export const BADGE_RARITIES = {
  common: { label: 'Comum', color: '#9ca3af' },
  rare: { label: 'Raro', color: '#3b82f6' },
  epic: { label: 'Epico', color: '#a855f7' },
  legendary: { label: 'Lendario', color: '#f59e0b' },
} as const

export const DEFAULT_XP_LEVELS = [
  { level: 1, name: 'Recruta', xp_required: 0 },
  { level: 2, name: 'Prospector', xp_required: 500 },
  { level: 3, name: 'Negociador', xp_required: 1500 },
  { level: 4, name: 'Hunter', xp_required: 3000 },
  { level: 5, name: 'Closer', xp_required: 5500 },
  { level: 6, name: 'Elite', xp_required: 9000 },
  { level: 7, name: 'Campeao', xp_required: 14000 },
  { level: 8, name: 'Lenda', xp_required: 21000 },
] as const

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
      key: 'hoje',
      label: 'Hoje',
      items: [
        { label: 'Hoje', href: '/hoje-gestor', icon: 'LayoutDashboard' },
      ],
    },
    {
      key: 'crm',
      label: 'CRM',
      items: [
        { label: 'Pipeline', href: '/crm', icon: 'Filter' },
        { label: 'Clientes', href: '/crm/clientes', icon: 'Users' },
      ],
    },
    {
      key: 'equipe',
      label: 'Minha Equipe',
      items: [
        { label: 'Performance', href: '/monitoramento/equipe', icon: 'BarChart3' },
        { label: 'Saude da Equipe', href: '/monitoramento/saude-equipe', icon: 'HeartPulse' },
        { label: 'Alertas', href: '/monitoramento/alertas', icon: 'Zap', badge: 'alert' },
      ],
    },
    {
      key: 'resultados',
      label: 'Resultados',
      items: [
        { label: 'Funil', href: '/monitoramento/funil', icon: 'Filter' },
        { label: 'Comissionamento', href: '/monitoramento/comissionamento', icon: 'DollarSign' },
        { label: 'ROI', href: '/monitoramento/roi', icon: 'PieChart' },
      ],
    },
    {
      key: 'vamo-ia',
      label: 'VAMO IA',
      items: [
        { label: 'Converse com VAMO IA', href: '/chat-ia', icon: 'MessageSquare' },
      ],
    },
    {
      key: 'config-geral',
      label: 'Configuracoes',
      items: [
        { label: 'Empresa e Plano', href: '/configuracoes/empresa', icon: 'Building2' },
        { label: 'Notificacoes', href: '/configuracoes/notificacoes', icon: 'Bell' },
        { label: 'Diagnostico', href: '/diagnostico', icon: 'Search' },
        { label: 'Objetivos e Metas', href: '/objetivos/metas', icon: 'Target' },
        { label: 'Comissionamento', href: '/configuracao/comissionamento', icon: 'DollarSign' },
        { label: 'Programa', href: '/configuracao/kpis', icon: 'Settings' },
      ],
    },
  ],
  seller: [
    {
      key: 'hoje',
      label: 'Hoje',
      items: [
        { label: 'Meu Dia', href: '/hoje', icon: 'Sun' },
        { label: 'Converse com VAMO IA', href: '/chat-ia', icon: 'MessageSquare' },
        { label: 'Mensagens', href: '/mensagens', icon: 'Mail' },
      ],
    },
    {
      key: 'crm',
      label: 'CRM',
      items: [
        { label: 'Pipeline', href: '/crm', icon: 'Filter' },
        { label: 'Clientes', href: '/crm/clientes', icon: 'Users' },
      ],
    },
    {
      key: 'desempenho',
      label: 'Meu Desempenho',
      prefix: 'A',
      items: [
        { label: 'Performance', href: '/performance', icon: 'LayoutDashboard' },
        { label: 'Minhas Metas', href: '/minhas-metas', icon: 'Target' },
        { label: 'Indicadores', href: '/performance/indicadores', icon: 'BarChart3' },
        { label: 'Missoes Ativas', href: '/performance/missoes', icon: 'CheckSquare' },
      ],
    },
    {
      key: 'ganhos',
      label: 'Meus Ganhos',
      prefix: 'B',
      items: [
        { label: 'Comissao', href: '/ganhos/comissao', icon: 'DollarSign' },
        { label: 'Projecao de Ganhos', href: '/ganhos/projecao', icon: 'TrendingUp' },
      ],
    },
    {
      key: 'desenvolvimento',
      label: 'Meu Desenvolvimento',
      prefix: 'C',
      items: [
        { label: 'Feedback da VAMO IA', href: '/desenvolvimento/feedback-ia', icon: 'Bot' },
        { label: 'Simulador de Proposta', href: '/simulador', icon: 'Swords' },
        { label: 'Conquistas e Pontos', href: '/desenvolvimento/conquistas', icon: 'Medal' },
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
        { label: 'Integracoes API', href: '/sistema/integracoes', icon: 'Plug' },
        { label: 'Configuracao Avancada', href: '/sistema/configuracao', icon: 'Wrench' },
      ],
    },
  ],
  admin: [
    {
      key: 'admin',
      label: 'Administracao',
      items: [
        { label: 'Dashboard', href: '/admin', icon: 'LayoutDashboard' },
        { label: 'Clientes', href: '/admin/clientes', icon: 'Building2' },
        { label: 'Diagnosticos', href: '/admin/diagnosticos', icon: 'ClipboardCheck' },
        { label: 'Templates', href: '/admin/templates', icon: 'FileText' },
        { label: 'Analytics', href: '/admin/analytics', icon: 'BarChart3' },
      ],
    },
  ],
  consultant: [
    {
      key: 'chat-ia',
      label: 'VAMO IA',
      items: [
        { label: 'Converse com VAMO IA', href: '/chat-ia', icon: 'MessageSquare' },
      ],
    },
    {
      key: 'carteira',
      label: 'Minha Carteira',
      prefix: '1',
      items: [
        { label: 'Meus Clientes', href: '/consultor/clientes', icon: 'Building2' },
        { label: 'Acoes Pendentes', href: '/consultor/acoes', icon: 'ClipboardList' },
        { label: 'Saude da Carteira', href: '/consultor/saude-carteira', icon: 'HeartPulse' },
        { label: 'Impacto Consolidado', href: '/consultor/impacto', icon: 'TrendingUp' },
      ],
    },
  ],
}

export const MANAGER_ONLY_ROUTES = [
  '/hoje-gestor',
  '/diagnostico',
  '/objetivos',
  '/configuracao',
  '/monitoramento',
]

export const SELLER_ONLY_ROUTES = [
  '/performance',
  '/ganhos',
  '/desenvolvimento',
  '/minhas-metas',
]

export const DEVELOPER_ONLY_ROUTES = [
  '/sistema',
]

export const ADMIN_ONLY_ROUTES = [
  '/admin',
]

export const CONSULTANT_ONLY_ROUTES = [
  '/consultor',
]

export const ROLE_HOME: Record<string, string> = {
  manager: '/hoje-gestor',
  seller: '/hoje',
  developer: '/sistema/logs',
  admin: '/monitoramento',
  consultant: '/consultor/clientes',
}
