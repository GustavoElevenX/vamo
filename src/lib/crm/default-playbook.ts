import type { DealStage } from '@/types/crm'

export const DEFAULT_PLAYBOOK_STEPS: Record<DealStage, string[]> = {
  prospecting: [
    'Pesquisar empresa e decisor',
    'Primeiro contato realizado',
    'Interesse confirmado',
  ],
  qualification: [
    'Dor ou necessidade mapeada',
    'Budget qualificado',
    'Prazo de decisao definido',
    'Decisores identificados',
  ],
  proposal: [
    'Proposta enviada',
    'Follow-up de recebimento',
    'Objecoes mapeadas',
    'Data de resposta combinada',
  ],
  negotiation: [
    'Objecoes respondidas',
    'Condicoes comerciais alinhadas',
    'Aprovacao interna confirmada',
  ],
  closed_won: [],
  closed_lost: [],
}
