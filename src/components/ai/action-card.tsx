'use client'

import { useState } from 'react'
import type { ActionCard as ActionCardType } from '@/types/chat'
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap,
  Copy,
  Check,
  RotateCcw,
} from 'lucide-react'

const ACTION_ICONS: Record<string, string> = {
  analyze_operation: 'AI',
  simulate_decision: 'SIM',
  generate_manager_briefing: 'BRF',
  generate_meeting_agenda: '1:1',
  create_action_plan: 'PLAN',
  create_pdi_plan: 'PDI',
  create_recovery_mission: 'REC',
  create_manager_nudge: 'MSG',
  mark_recommendation_done: 'OK',
  add_seller: '👤',
  edit_seller: '✏️',
  remove_seller: '🗑️',
  create_mission: '🎯',
  edit_mission: '✏️',
  delete_mission: '🗑️',
  define_kpi: '📊',
  edit_kpi: '✏️',
  delete_kpi: '🗑️',
  set_goal: '🏆',
  award_xp: '⚡',
  generate_briefing: '📋',
  generate_retrospective: '📈',
  create_challenge: '🔥',
  register_kpi_value: '📝',
  notify_seller: '🔔',
}

const STATUS_STYLES = {
  pending: 'border-amber-500/30 bg-amber-500/5',
  executing: 'border-blue-500/30 bg-blue-500/5',
  completed: 'border-emerald-500/30 bg-emerald-500/5',
  failed: 'border-red-500/30 bg-red-500/5',
  rejected: 'border-border/40 bg-muted/30 opacity-70',
  approved: 'border-emerald-500/30 bg-emerald-500/5',
}

const STATUS_BADGES: Record<string, { icon: React.ElementType; label: string; className: string }> = {
  pending: { icon: Clock, label: 'Aguardando aprovação', className: 'text-amber-600 dark:text-amber-400 bg-amber-500/10' },
  executing: { icon: Zap, label: 'Executando...', className: 'text-blue-600 dark:text-blue-400 bg-blue-500/10' },
  completed: { icon: CheckCircle2, label: 'Concluído', className: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' },
  failed: { icon: AlertCircle, label: 'Falhou', className: 'text-red-600 dark:text-red-400 bg-red-500/10' },
  rejected: { icon: AlertCircle, label: 'Recusado', className: 'text-muted-foreground bg-muted/50' },
  approved: { icon: CheckCircle2, label: 'Aprovado', className: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' },
}

interface ActionCardProps {
  actionCard: ActionCardType
  onApprove: () => void
  onReject: () => void
  onRetry?: () => void
}

export function ActionCard({ actionCard, onApprove, onReject, onRetry }: ActionCardProps) {
  const { action, status, result } = actionCard
  const icon = ACTION_ICONS[action.action] || '⚙️'
  const borderStyle = STATUS_STYLES[status] || STATUS_STYLES.pending
  const badge = STATUS_BADGES[status] || STATUS_BADGES.pending
  const StatusIcon = badge.icon
  const [copied, setCopied] = useState<string | null>(null)

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  return (
    <div className={`w-full mt-3 rounded-xl border-2 ${borderStyle} p-4 transition-all duration-300`}>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          <span className="text-xl shrink-0 mt-0.5">{icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">
              Ação da VAMO IA
            </p>
            <p className="text-sm font-semibold text-foreground leading-snug break-words">
              {action.summary}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div className={`flex items-center gap-1.5 shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${badge.className}`}>
          {status === 'executing' ? (
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <StatusIcon className="h-3.5 w-3.5" />
          )}
          <span>{badge.label}</span>
        </div>
      </div>

      {/* Params */}
      {Object.keys(action.params).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3 pb-3 border-b border-border/30">
          {Object.entries(action.params).map(([key, value]) =>
            value != null && (
              <div
                key={key}
                className="inline-flex items-center gap-1.5 rounded-lg bg-muted/60 px-2.5 py-1 text-xs border border-border/40"
              >
                <span className="font-medium text-muted-foreground">{formatParamLabel(key)}:</span>
                <code className="font-mono text-foreground/80 break-all">{formatParamValue(value)}</code>
              </div>
            )
          )}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={`rounded-lg px-4 py-3 text-sm mb-3 border ${
          result.success
            ? 'border-emerald-500/30 bg-emerald-500/8 text-emerald-900 dark:text-emerald-200'
            : 'border-red-500/30 bg-red-500/8 text-red-900 dark:text-red-300'
        }`}>
          {result.success && action.action === 'add_seller' && result.data ? (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <p className="font-semibold text-sm">Vendedor cadastrado com sucesso</p>
              </div>
              {(result.data as { temporaryPassword?: string }).temporaryPassword && (
                <div className="flex items-center gap-3 rounded-lg border border-current/20 bg-current/10 px-3 py-2.5">
                  <span className="text-xs font-medium shrink-0 opacity-70">Senha temp.:</span>
                  <code className="font-mono text-sm font-bold tracking-widest flex-1 break-all">
                    {(result.data as { temporaryPassword: string }).temporaryPassword}
                  </code>
                  <button
                    onClick={() => copyToClipboard((result.data as { temporaryPassword: string }).temporaryPassword, 'password')}
                    className="shrink-0 p-1.5 rounded-md border border-current/30 hover:bg-current/20 transition-colors"
                  >
                    {copied === 'password' ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              )}
              <p className="text-xs opacity-70">O vendedor deve alterar a senha no primeiro acesso.</p>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              {result.success ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              )}
              <p>{result.message}</p>
            </div>
          )}
        </div>
      )}

      {/* Approve / Reject */}
      {status === 'pending' && (
        <div className="flex gap-2.5 pt-1">
          <button
            onClick={onApprove}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-sm font-semibold py-2.5 px-4 transition-all shadow-sm hover:shadow-md"
          >
            <CheckCircle2 className="h-4 w-4" />
            Aprovar
          </button>
          <button
            onClick={onReject}
            className="flex-1 rounded-lg border border-border/60 bg-muted/40 hover:bg-muted/70 active:scale-[0.98] text-foreground text-sm font-semibold py-2.5 px-4 transition-all"
          >
            Recusar
          </button>
        </div>
      )}

      {/* Retry on failure */}
      {status === 'failed' && (
        <button
          onClick={onRetry ?? onApprove}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white text-sm font-semibold py-2.5 px-4 transition-all shadow-sm hover:shadow-md"
        >
          <RotateCcw className="h-4 w-4" />
          Corrigir no chat
        </button>
      )}
    </div>
  )
}

function formatParamLabel(key: string): string {
  const labels: Record<string, string> = {
    name: 'Nome',
    email: 'Email',
    title: 'Título',
    description: 'Descrição',
    area: 'Área',
    difficulty: 'Dificuldade',
    xp_reward: 'XP',
    user_id: 'Vendedor',
    unit: 'Unidade',
    points_per_unit: 'Pontos/un',
    targets: 'Metas',
    kpi_id: 'KPI',
    target_value: 'Meta',
    period: 'Período',
    amount: 'Quantidade',
    type: 'Tipo',
    start_date: 'Início',
    end_date: 'Fim',
    value: 'Valor',
    bonus_reward: 'Bônus',
  }
  return labels[key] || key
}

function formatParamValue(value: unknown): string {
  if (typeof value === 'object' && value !== null) return JSON.stringify(value)
  if (typeof value === 'string' && value.length > 40) return value.slice(0, 37) + '...'
  return String(value)
}
