'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Thermometer, MessageSquare, Target, Award } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EnergyData {
  user_id: string
  name: string
  energy_pct: number
  level: 'alta' | 'boa' | 'media' | 'baixa' | 'critica'
  checkin_avg: number | null
  action: string
}

const ENERGY_LEVELS = {
  alta:    { label: 'Alta',     color: 'bg-emerald-500', textColor: 'text-emerald-500', squares: 5 },
  boa:     { label: 'Boa',      color: 'bg-emerald-500', textColor: 'text-emerald-500', squares: 4 },
  media:   { label: 'Média',    color: 'bg-yellow-500',  textColor: 'text-yellow-500',  squares: 3 },
  baixa:   { label: 'Baixa',    color: 'bg-orange-500',  textColor: 'text-orange-500',  squares: 2 },
  critica: { label: 'Crítica',  color: 'bg-red-500',     textColor: 'text-red-500',     squares: 1 },
}

function getLevel(pct: number): 'alta' | 'boa' | 'media' | 'baixa' | 'critica' {
  if (pct > 80) return 'alta'
  if (pct > 65) return 'boa'
  if (pct > 45) return 'media'
  if (pct > 25) return 'baixa'
  return 'critica'
}

function getAction(level: string): string {
  switch (level) {
    case 'alta': return 'Reconhecer e desafiar com missão mais difícil'
    case 'boa': return 'Manter o ritmo, monitorar'
    case 'media': return 'Verificar se há obstáculo não declarado'
    case 'baixa': return 'Contato proativo — 1:1 recomendado'
    case 'critica': return 'Alerta urgente — burnout em risco'
    default: return ''
  }
}

interface EnergyThermometerProps {
  organizationId: string
}

export function EnergyThermometer({ organizationId }: EnergyThermometerProps) {
  const supabaseRef = useRef(createClient())
  const [data, setData] = useState<EnergyData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!organizationId) return

    const fetchEnergy = async () => {
      const supabase = supabaseRef.current
      const now = new Date()
      const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0]
      const today = now.toISOString().split('T')[0]

      // Get all sellers in the org via admin-backed API to bypass RLS
      const membersRes = await fetch('/api/team/members', { credentials: 'same-origin' })
      const sellers: { id: string; name: string }[] = membersRes.ok
        ? ((await membersRes.json()).members ?? []).map((m: any) => ({ id: m.id, name: m.name }))
        : []

      if (!sellers || sellers.length === 0) {
        setLoading(false)
        return
      }

      const sellerIds = sellers.map((s: any) => s.id)

      // Fetch check-ins, missions, and KPI entries for the week
      const [
        { data: checkins },
        { data: missions },
        { data: kpiEntries },
      ] = await Promise.all([
        supabase
          .from('daily_checkins')
          .select('user_id, energy_level')
          .in('user_id', sellerIds)
          .gte('checkin_date', weekAgo)
          .lte('checkin_date', today),
        supabase
          .from('ai_missions')
          .select('user_id, status')
          .in('user_id', sellerIds)
          .eq('status', 'completed'),
        supabase
          .from('kpi_entries')
          .select('user_id')
          .in('user_id', sellerIds)
          .gte('recorded_at', `${weekAgo}T00:00:00`),
      ])

      const energyResults: EnergyData[] = sellers.map((seller: any) => {
        // Check-in average (weight: 40%)
        const userCheckins = (checkins || []).filter((c: any) => c.user_id === seller.id)
        const checkinAvg = userCheckins.length > 0
          ? userCheckins.reduce((sum: number, c: any) => sum + c.energy_level, 0) / userCheckins.length
          : null
        const checkinPct = checkinAvg ? (checkinAvg / 5) * 100 : 50 // default 50% if no checkins

        // Engagement (weight: 30%) — missions completed + active usage
        const userMissions = (missions || []).filter((m: any) => m.user_id === seller.id).length
        const engagementPct = Math.min(100, userMissions * 20) // each completed mission = 20%

        // CRM / KPI activity (weight: 30%)
        const userKpis = (kpiEntries || []).filter((k: any) => k.user_id === seller.id).length
        const expectedWeekly = 5 // expected 5 KPI entries per week
        const crmPct = Math.min(100, (userKpis / expectedWeekly) * 100)

        // Weighted average
        const energyPct = Math.round(
          checkinPct * 0.4 + engagementPct * 0.3 + crmPct * 0.3
        )

        const level = getLevel(energyPct)

        return {
          user_id: seller.id,
          name: seller.name,
          energy_pct: energyPct,
          level,
          checkin_avg: checkinAvg,
          action: getAction(level),
        }
      })

      // Sort: worst first (so manager sees who needs attention)
      energyResults.sort((a, b) => a.energy_pct - b.energy_pct)
      setData(energyResults)
      setLoading(false)
    }

    fetchEnergy().catch(() => setLoading(false))
  }, [organizationId])

  if (loading) {
    return (
      <Card className="border-border/50">
        <CardContent className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    )
  }

  if (data.length === 0) return null

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Thermometer className="h-4 w-4 text-primary" />
          Termômetro de Energia da Equipe
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((member) => {
            const config = ENERGY_LEVELS[member.level]
            const initials = member.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()

            return (
              <div
                key={member.user_id}
                className="flex items-center gap-3 rounded-lg border border-border/50 p-3"
              >
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{member.name}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          'h-3 w-3 rounded-sm',
                          i < config.squares ? config.color : 'bg-muted'
                        )}
                      />
                    ))}
                    <span className={cn('ml-1.5 text-[10px] font-medium', config.textColor)}>
                      {config.label}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground line-clamp-1">
                    {member.action}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
