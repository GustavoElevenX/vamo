'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Sun,
  Moon,
  CloudSun,
  Flame,
  Target,
  DollarSign,
  Trophy,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Calendar,
} from 'lucide-react'
import type { User } from '@/types'

function getGreeting(): { text: string; icon: React.ReactNode } {
  const hour = new Date().getHours()
  if (hour < 12) return { text: 'Bom dia', icon: <Sun className="h-6 w-6 text-yellow-400" /> }
  if (hour < 18) return { text: 'Boa tarde', icon: <CloudSun className="h-6 w-6 text-orange-400" /> }
  return { text: 'Boa noite', icon: <Moon className="h-6 w-6 text-indigo-400" /> }
}

function formatDate(): string {
  return new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  })
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

interface MissionData {
  id: string
  title: string
  description: string
  xp_reward: number
  status: string
  difficulty: number
}

interface KpiProgress {
  name: string
  current: number
  target: number
  unit: string
}

export default function HojePage() {
  const { user } = useAuth()
  const supabaseRef = useRef(createClient())
  const [loading, setLoading] = useState(true)
  const [streak, setStreak] = useState(0)
  const [priorityMission, setPriorityMission] = useState<MissionData | null>(null)
  const [activeMissionCount, setActiveMissionCount] = useState(0)
  const [dailyKpi, setDailyKpi] = useState<KpiProgress | null>(null)
  const [monthlyEarnings, setMonthlyEarnings] = useState(0)
  const [projectedBonus, setProjectedBonus] = useState(0)
  const [hasCheckinToday, setHasCheckinToday] = useState(false)
  const [lastRecognition, setLastRecognition] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      const supabase = supabaseRef.current
      const today = new Date().toISOString().split('T')[0]
      const monthStart = today.substring(0, 7) + '-01'

      const [
        { data: xpData },
        { data: missions },
        { data: kpiDefs },
        { data: todayEntries },
        { data: monthEntries },
        { data: checkin },
        { data: recentXp },
      ] = await Promise.all([
        // Streak
        supabase
          .from('user_xp')
          .select('current_streak, longest_streak')
          .eq('user_id', user.id)
          .maybeSingle(),
        // Missões ativas
        supabase
          .from('ai_missions')
          .select('id, title, description, xp_reward, status, difficulty')
          .eq('user_id', user.id)
          .in('status', ['pending', 'in_progress'])
          .order('xp_reward', { ascending: false })
          .limit(5),
        // KPI definitions (primeiro da org)
        supabase
          .from('kpi_definitions')
          .select('id, name, unit, targets')
          .eq('organization_id', user.organization_id)
          .eq('active', true)
          .limit(1)
          .maybeSingle(),
        // KPIs de hoje
        supabase
          .from('kpi_entries')
          .select('value, kpi_id')
          .eq('user_id', user.id)
          .gte('recorded_at', `${today}T00:00:00`)
          .lte('recorded_at', `${today}T23:59:59`),
        // KPIs do mês (para ganho financeiro)
        supabase
          .from('kpi_entries')
          .select('points_earned')
          .eq('user_id', user.id)
          .gte('recorded_at', `${monthStart}T00:00:00`),
        // Check-in de hoje
        supabase
          .from('daily_checkins')
          .select('id')
          .eq('user_id', user.id)
          .eq('checkin_date', today)
          .maybeSingle(),
        // Último reconhecimento (XP de bonus nas últimas 48h)
        supabase
          .from('xp_transactions')
          .select('description, created_at')
          .eq('user_id', user.id)
          .eq('source_type', 'bonus')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      // Streak
      setStreak(xpData?.current_streak ?? 0)

      // Missão prioritária
      if (missions && missions.length > 0) {
        setPriorityMission(missions[0])
        setActiveMissionCount(missions.length)
      }

      // KPI diário
      if (kpiDefs && todayEntries) {
        const todayTotal = todayEntries
          .filter((e: any) => e.kpi_id === kpiDefs.id)
          .reduce((sum: number, e: any) => sum + (e.value || 0), 0)
        const dailyTarget = (kpiDefs.targets as any)?.daily || 0

        setDailyKpi({
          name: kpiDefs.name,
          current: todayTotal,
          target: dailyTarget,
          unit: kpiDefs.unit,
        })
      }

      // Ganho financeiro do mês
      if (monthEntries) {
        const totalPoints = monthEntries.reduce(
          (sum: number, e: any) => sum + (e.points_earned || 0),
          0
        )
        // Estimativa: 1 ponto = R$10 (simplificado)
        setMonthlyEarnings(totalPoints * 10)
        // Bonus por completar missão do dia
        if (missions && missions[0]) {
          setProjectedBonus(missions[0].xp_reward * 10)
        }
      }

      // Check-in
      setHasCheckinToday(!!checkin)

      // Reconhecimento
      if (recentXp) {
        const xpDate = new Date(recentXp.created_at)
        const now = new Date()
        const diffHours = (now.getTime() - xpDate.getTime()) / (1000 * 60 * 60)
        if (diffHours <= 48) {
          setLastRecognition(recentXp.description)
        }
      }

      setLoading(false)
    }

    fetchData().catch(() => setLoading(false))
  }, [user])

  if (!user) return null

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      </div>
    )
  }

  const greeting = getGreeting()
  const firstName = user.name.split(' ')[0]
  const streakAtRisk = !hasCheckinToday && streak > 0

  return (
    <div className="space-y-5">
      {/* Saudação + Streak */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            {greeting.icon}
            {greeting.text}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground capitalize">
            <Calendar className="mr-1 inline h-4 w-4" />
            {formatDate()}
            {streak > 0 && (
              <span className="ml-2">
                <Flame className="mr-0.5 inline h-4 w-4 text-orange-500" />
                {streak} dias seguidos
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Ganho Financeiro — primeiro item motivacional */}
      <Card className="border-green-500/30 bg-gradient-to-r from-green-500/10 to-emerald-500/5">
        <CardContent className="flex items-center gap-4 py-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20">
            <DollarSign className="h-6 w-6 text-green-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Ganho acumulado este mês</p>
            <p className="text-2xl font-bold text-green-500">
              {formatCurrency(monthlyEarnings)}
            </p>
            {projectedBonus > 0 && (
              <p className="text-xs text-muted-foreground">
                Complete o desafio de hoje e suba para{' '}
                <span className="font-semibold text-green-400">
                  {formatCurrency(monthlyEarnings + projectedBonus)}
                </span>
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Reconhecimento recebido */}
      {lastRecognition && (
        <Card className="border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 to-amber-500/5">
          <CardContent className="flex items-center gap-3 py-4">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <div>
              <p className="text-xs font-medium text-yellow-500">Reconhecimento recente</p>
              <p className="text-sm">{lastRecognition}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alerta de sequência em risco */}
      {streakAtRisk && (
        <Card className="border-orange-500/30 bg-gradient-to-r from-orange-500/10 to-red-500/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <div className="flex-1">
              <p className="text-sm font-medium">
                Sua sequência de {streak} dias está em risco!
              </p>
              <p className="text-xs text-muted-foreground">
                Registre pelo menos 1 KPI hoje para manter sua sequência
              </p>
            </div>
            <Link href="/kpis/registrar">
              <Button size="sm" variant="outline" className="border-orange-500/50 text-orange-500">
                Registrar
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Desafio Prioritário do Dia */}
      {priorityMission && (
        <Card className="border-primary/30">
          <CardContent className="py-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <span className="text-sm font-semibold text-primary">Desafio do dia</span>
              </div>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                +{priorityMission.xp_reward} XP
              </span>
            </div>
            <h3 className="text-lg font-semibold">{priorityMission.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
              {priorityMission.description}
            </p>
            <div className="mt-4 flex items-center gap-3">
              <Link href="/performance/missoes" className="flex-1">
                <Button className="w-full gap-2">
                  Ir para missão <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            {activeMissionCount > 1 && (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                +{activeMissionCount - 1} outras missões ativas
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Meta Diária de Atividade */}
      {dailyKpi && dailyKpi.target > 0 && (
        <Card>
          <CardContent className="py-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">{dailyKpi.name}</span>
              <span className="text-sm text-muted-foreground">
                {dailyKpi.current}/{dailyKpi.target} {dailyKpi.unit}
              </span>
            </div>
            <Progress
              value={Math.min((dailyKpi.current / dailyKpi.target) * 100, 100)}
              className="h-3"
            />
            {dailyKpi.current >= dailyKpi.target ? (
              <p className="mt-2 flex items-center gap-1 text-xs text-green-500">
                <CheckCircle2 className="h-3.5 w-3.5" /> Meta do dia atingida!
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                Faltam {dailyKpi.target - dailyKpi.current} {dailyKpi.unit} para completar
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Ações rápidas */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/kpis/registrar">
          <Card className="cursor-pointer transition-colors hover:bg-accent/50">
            <CardContent className="flex items-center gap-3 py-4">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">Registrar KPI</span>
            </CardContent>
          </Card>
        </Link>
        <Link href="/chat-ia">
          <Card className="cursor-pointer transition-colors hover:bg-accent/50">
            <CardContent className="flex items-center gap-3 py-4">
              <Sparkles className="h-5 w-5 text-violet-500" />
              <span className="text-sm font-medium">VAMO IA</span>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
