'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  HeartPulse,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Smile,
  Frown,
  Meh,
  Brain,
  MessageCircle,
  Sparkles,
  Users,
  Activity,
} from 'lucide-react'

interface TeamMemberHealth {
  user_id: string
  name: string
  streak: number
  xp_trend: 'up' | 'down' | 'stable'
  engagement_score: number // 0-100
  risk_level: 'healthy' | 'attention' | 'burnout'
  last_activity: string
  ai_suggestion: string
}

export default function SaudeEquipePage() {
  const { user } = useAuth()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState<TeamMemberHealth[]>([])

  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      const { data: teamData } = await supabase
        .from('user_xp')
        .select('user_id, total_xp, current_level, current_streak, last_activity_date, users!inner(name, role)')
        .eq('organization_id', user.organization_id)

      if (teamData) {
        const mapped: TeamMemberHealth[] = (teamData as any[])
          .filter((m) => m.users?.role === 'seller')
          .map((m) => {
            const streak = m.current_streak ?? 0
            const daysSinceActivity = m.last_activity_date
              ? Math.floor((Date.now() - new Date(m.last_activity_date).getTime()) / 86400000)
              : 99

            let risk_level: 'healthy' | 'attention' | 'burnout' = 'healthy'
            let engagement = 85
            let xp_trend: 'up' | 'down' | 'stable' = 'stable'
            let ai_suggestion = 'Manter ritmo atual. Bom engajamento.'

            if (daysSinceActivity > 5 || streak === 0) {
              risk_level = 'burnout'
              engagement = Math.max(10, 30 - daysSinceActivity * 3)
              xp_trend = 'down'
              ai_suggestion = '⚠️ Conversar antes de atribuir novas missões. Possível sobrecarga ou desmotivação.'
            } else if (daysSinceActivity > 2 || streak < 3) {
              risk_level = 'attention'
              engagement = 55
              xp_trend = 'down'
              ai_suggestion = 'Verificar se precisa de suporte. Considerar missão mais leve.'
            } else {
              xp_trend = streak > 5 ? 'up' : 'stable'
              engagement = Math.min(100, 70 + streak * 3)
            }

            return {
              user_id: m.user_id,
              name: m.users?.name ?? 'Vendedor',
              streak,
              xp_trend,
              engagement_score: engagement,
              risk_level,
              last_activity: m.last_activity_date ?? 'Nunca',
              ai_suggestion,
            }
          })
          .sort((a, b) => a.engagement_score - b.engagement_score)

        setMembers(mapped)
      }
      setLoading(false)
    }

    fetchData().catch(() => setLoading(false))
  }, [user])

  if (!user) return null

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      </div>
    )
  }

  const burnoutCount = members.filter((m) => m.risk_level === 'burnout').length
  const attentionCount = members.filter((m) => m.risk_level === 'attention').length
  const healthyCount = members.filter((m) => m.risk_level === 'healthy').length
  const avgEngagement = members.length > 0
    ? Math.round(members.reduce((sum, m) => sum + m.engagement_score, 0) / members.length)
    : 0

  const riskConfig = {
    healthy: { label: 'Saudável', icon: Smile, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    attention: { label: 'Atenção', icon: Meh, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    burnout: { label: 'Risco de Burnout', icon: Frown, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Saúde da Equipe</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Monitor de bem-estar com alertas de burnout e ações sugeridas pela VAMO IA
        </p>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border-border/50">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <HeartPulse className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{avgEngagement}%</p>
                <p className="text-[10px] text-muted-foreground">Engajamento Médio</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Smile className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{healthyCount}</p>
                <p className="text-[10px] text-muted-foreground">Saudáveis</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Meh className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{attentionCount}</p>
                <p className="text-[10px] text-muted-foreground">Atenção</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-border/50 ${burnoutCount > 0 ? 'border-red-500/30 bg-red-500/5' : ''}`}>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{burnoutCount}</p>
                <p className="text-[10px] text-muted-foreground">Risco de Burnout</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Burnout Alert */}
      {burnoutCount > 0 && (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="pt-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-500">Alerta de Burnout</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {burnoutCount} vendedor(es) em risco. <strong>Gamificação de volume sobre alguém em burnout piora o problema.</strong>{' '}
                  Converse individualmente antes de lançar novas missões.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team Members */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Monitor Individual</CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Users className="mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nenhum vendedor registrado.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((member) => {
                const config = riskConfig[member.risk_level]
                const RiskIcon = config.icon
                const initials = member.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()

                return (
                  <div
                    key={member.user_id}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${config.border} ${config.bg}`}
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className={`text-xs ${config.bg} ${config.color}`}>
                        {initials}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{member.name}</p>
                        <div className={`flex items-center gap-1 text-[10px] font-medium ${config.color}`}>
                          <RiskIcon className="h-3 w-3" />
                          {config.label}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-muted-foreground">
                          Streak: {member.streak}d
                        </span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          {member.xp_trend === 'up' && <TrendingUp className="h-2.5 w-2.5 text-emerald-500" />}
                          {member.xp_trend === 'down' && <TrendingDown className="h-2.5 w-2.5 text-red-500" />}
                          {member.xp_trend === 'stable' && <Activity className="h-2.5 w-2.5" />}
                          Tendência
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          Engajamento: {member.engagement_score}%
                        </span>
                      </div>
                    </div>

                    <div className="w-20 shrink-0">
                      <Progress
                        value={member.engagement_score}
                        className={`h-1.5 ${
                          member.risk_level === 'burnout'
                            ? '[&>div]:bg-red-500'
                            : member.risk_level === 'attention'
                            ? '[&>div]:bg-amber-500'
                            : '[&>div]:bg-emerald-500'
                        }`}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* AI Suggestions */}
          {members.some((m) => m.risk_level !== 'healthy') && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <p className="text-xs font-medium">Sugestões da VAMO IA</p>
              </div>
              {members
                .filter((m) => m.risk_level !== 'healthy')
                .map((member) => (
                  <div
                    key={member.user_id}
                    className="flex items-start gap-2 p-2.5 rounded-lg bg-background/50 border border-border/30"
                  >
                    <Brain className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium">{member.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{member.ai_suggestion}</p>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
