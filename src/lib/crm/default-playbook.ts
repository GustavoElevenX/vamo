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
    'Prazo de decisão definido',
    'Decisores identificados',
  ],
  proposal: [
    'Proposta enviada',
    'retorno de recebimento',
    'Objecoes mapeadas',
    'Data de resposta combinada',
  ],
  negotiation: [
    'Objecoes respondidas',
    'Condicoes comerciais alinhadas',
    'Aprovação interna confirmada',
  ],
  closed_won: [],
  closed_lost: [],
}
