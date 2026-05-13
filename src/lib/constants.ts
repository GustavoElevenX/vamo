export const APP_NAME = 'Vamo'
export const APP_DESCRIPTION = 'Plataforma de Desempenho Comercial'

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
  lead_generation: 'Geração de potenciais clientes',
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
  epic: { label: 'Epico', color: '#a855f7' },
  legendary: { label: 'Lendario', color: '#f59e0b' },
} as const

export const DEFAULT_XP_LEVELS = [
  { level: 1, name: 'Recruta', xp_required: 0 },
  { level: 2, name: 'Prospector', xp_required: 500 },
  { level: 3, name: 'Negociador', xp_required: 1500 },
  { level: 4, name: 'Caçador', xp_required: 3000 },
  { level: 5, name: 'Fechador', xp_required: 5500 },
  { level: 6, name: 'Especialista', xp_required: 9000 },
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
        { label: 'Mensagens', href: '/mensagens', icon: 'Mail' },
      ],
    },
    {
      key: 'crm',
      label: 'CRM',
      items: [
        { label: 'Funil', href: '/crm', icon: 'Filter' },
        { label: 'Clientes', href: '/crm/clientes', icon: 'Users' },
      ],
    },
    {
      key: 'equipe',
      label: 'Minha Equipe',
      items: [
        { label: 'Desempenho', href: '/monitoramento/equipe', icon: 'BarChart3' },
        { label: 'Saúde da Equipe', href: '/monitoramento/saude-equipe', icon: 'HeartPulse' },
        { label: 'Desenvolvimento da Equipe', href: '/monitoramento/desenvolvimento', icon: 'ClipboardCheck' },
        { label: 'Missões da Equipe', href: '/monitoramento/missoes', icon: 'Swords' },
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
      label: 'Vamo IA',
      items: [
        { label: 'Converse com Vamo IA', href: '/chat-ia', icon: 'MessageSquare' },
      ],
    },
    {
      key: 'config-geral',
      label: 'Configurações',
      items: [
        { label: 'Empresa e Plano', href: '/configuracoes/empresa', icon: 'Building2' },
        { label: 'Notificações', href: '/configuracoes/notificacoes', icon: 'Bell' },
        { label: 'Diagnóstico', href: '/diagnostico', icon: 'Search' },
        { label: 'Objetivos e Metas', href: '/objetivos/metas', icon: 'Target' },
        { label: 'Comissionamento', href: '/configuracao/comissionamento', icon: 'DollarSign' },
        { label: 'Programa', href: '/configuracoes/kpis', icon: 'Settings' },
      ],
    },
  ],
  seller: [
    {
      key: 'hoje',
      label: 'Hoje',
      items: [
        { label: 'Cockpit diário', href: '/hoje', icon: 'Sun' },
        { label: 'Mensagens', href: '/mensagens', icon: 'Mail' },
      ],
    },
    {
      key: 'vender',
      label: 'Vender',
      items: [
        { label: 'Funil de ações', href: '/crm', icon: 'Filter' },
        { label: 'Clientes', href: '/crm/clientes', icon: 'Users' },
        { label: 'Registrar ação', href: '/kpis/registrar', icon: 'BarChart3' },
      ],
    },
    {
      key: 'ganhar',
      label: 'Ganhar',
      items: [
        { label: 'Holerite comercial', href: '/ganhos/comissao', icon: 'DollarSign' },
        { label: 'Projeção de ganhos', href: '/ganhos/projecao', icon: 'TrendingUp' },
      ],
    },
    {
      key: 'evoluir',
      label: 'Evoluir',
      items: [
        { label: 'Converse com Vamo IA', href: '/chat-ia', icon: 'MessageSquare' },
        { label: 'Meu PDI', href: '/desenvolvimento/pdi', icon: 'ClipboardCheck' },
        { label: 'Simulador de proposta', href: '/simulador', icon: 'Swords' },
        { label: 'Desempenho', href: '/performance', icon: 'LayoutDashboard' },
        { label: 'Indicadores', href: '/performance/indicadores', icon: 'BarChart3' },
        { label: 'Missões ativas', href: '/performance/missoes', icon: 'CheckSquare' },
        { label: 'Minhas metas', href: '/minhas-metas', icon: 'Target' },
      ],
    },
    {
      key: 'reconhecimento',
      label: 'Reconhecimento',
      items: [
        { label: 'Mural de reconhecimento', href: '/feed', icon: 'Megaphone' },
        { label: 'Conquistas e pontos', href: '/desenvolvimento/conquistas', icon: 'Medal' },
        { label: 'Loja de recompensas', href: '/desenvolvimento/loja', icon: 'ShoppingBag' },
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
        { label: 'Painel', href: '/admin', icon: 'LayoutDashboard' },
        { label: 'Clientes', href: '/admin/clientes', icon: 'Building2' },
        { label: 'Diagnósticos', href: '/admin/diagnosticos', icon: 'ClipboardCheck' },
        { label: 'Modelos', href: '/admin/templates', icon: 'FileText' },
        { label: 'Análises', href: '/admin/analytics', icon: 'BarChart3' },
      ],
    },
  ],
  consultant: [
    {
      key: 'chat-ia',
      label: 'Vamo IA',
      items: [
        { label: 'Converse com Vamo IA', href: '/chat-ia', icon: 'MessageSquare' },
      ],
    },
    {
      key: 'carteira',
      label: 'Minha Carteira',
      prefix: '1',
      items: [
        { label: 'Meus Clientes', href: '/consultor/clientes', icon: 'Building2' },
        { label: 'Ações Pendentes', href: '/consultor/acoes', icon: 'ClipboardList' },
        { label: 'Saúde da Carteira', href: '/consultor/saude-carteira', icon: 'HeartPulse' },
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
  '/hoje',
  '/performance',
  '/ganhos',
  '/desenvolvimento',
  '/minhas-metas',
  '/simulador',
  '/feed',
  '/kpis/registrar',
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
