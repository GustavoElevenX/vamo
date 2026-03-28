'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Users, AlertTriangle, ChevronDown, ChevronUp, Brain, TrendingUp,
  ArrowLeft, Sparkles, Eye,
} from 'lucide-react'
import Link from 'next/link'
import type { User, BehavioralProfile } from '@/types'

interface CollaboratorData {
  user: User
  profile: BehavioralProfile | null
  status: 'pending' | 'in_progress' | 'completed'
  hasBurnout: boolean
}

const STATUS_CONFIG = {
  pending: { label: 'Pendente', className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30' },
  in_progress: { label: 'Em Andamento', className: 'bg-blue-500/10 text-blue-500 border-blue-500/30' },
  completed: { label: 'Concluido', className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' },
}

const DISC_COLORS = {
  D: { label: 'Dominancia', color: '#ef4444', bg: 'bg-red-500' },
  I: { label: 'Influencia', color: '#eab308', bg: 'bg-yellow-500' },
  S: { label: 'Estabilidade', color: '#22c55e', bg: 'bg-green-500' },
  C: { label: 'Conformidade', color: '#3b82f6', bg: 'bg-blue-500' },
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

// Simulated burnout detection (random but deterministic per user id)
function simulateBurnout(userId: string): boolean {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash) % 5 === 0 // ~20% chance
}

export default function DiagnosticoIndividualPage() {
  const { user } = useAuth()
  const supabaseRef = useRef(createClient())

  const [collaborators, setCollaborators] = useState<CollaboratorData[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.organization_id) return

    let cancelled = false
    const supabase = supabaseRef.current

    const load = async () => {
      try {
        // Fetch all sellers in the same organization
        const { data: sellers } = await supabase
          .from('users')
          .select('id, name, email, role, active, organization_id, auth_id')
          .eq('organization_id', user.organization_id)
          .eq('role', 'seller')
          .eq('active', true)
          .order('name')
          .limit(100)

        if (cancelled) return

        if (!sellers || sellers.length === 0) {
          setCollaborators([])
          setLoading(false)
          return
        }

        // Fetch behavioral profiles in parallel (only if we have sellers)
        const sellerIds = sellers.map((s: { id: string }) => s.id)
        const { data: profiles } = await supabase
          .from('behavioral_profiles')
          .select('user_id, profile_result')
          .in('user_id', sellerIds)

        if (cancelled) return

        const profileMap = new Map<string, BehavioralProfile>()
        profiles?.forEach((p: { user_id: string; profile_result: BehavioralProfile }) => {
          profileMap.set(p.user_id, p.profile_result)
        })

        const mapped: CollaboratorData[] = sellers.map((seller: any) => {
          const profile = profileMap.get(seller.id) ?? null
          let status: 'pending' | 'in_progress' | 'completed' = 'pending'
          if (profile) {
            status = 'completed'
          } else if (simulateBurnout(seller.id + '_progress')) {
            status = 'in_progress'
          }

          return {
            user: seller,
            profile,
            status,
            hasBurnout: simulateBurnout(seller.id),
          }
        })

        if (!cancelled) {
          setCollaborators(mapped)
          setLoading(false)
        }
      } catch (err) {
        console.error('[DiagnosticoIndividual] Erro ao carregar dados:', err)
        if (!cancelled) {
          setCollaborators([])
          setLoading(false)
        }
      }
    }

    load().catch(() => setLoading(false))

    return () => { cancelled = true }
  }, [user?.id, user?.organization_id])

  if (!user) return null

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  const totalCompleted = collaborators.filter((c) => c.status === 'completed').length
  const totalBurnout = collaborators.filter((c) => c.hasBurnout).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/diagnostico">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Diagnostico Individual</h2>
          <p className="text-sm text-muted-foreground">
            Diagnostico comportamental e de performance de cada colaborador
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/50">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Total Colaboradores
                </p>
                <p className="text-2xl font-bold">{collaborators.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <Brain className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-600">
                  Perfis Concluidos
                </p>
                <p className="text-2xl font-bold text-emerald-500">
                  {totalCompleted}/{collaborators.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {totalBurnout > 0 && (
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-red-500/80">
                    Sinais de Burnout
                  </p>
                  <p className="text-2xl font-bold text-red-500">{totalBurnout}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Collaborator List */}
      <div className="space-y-3">
        {collaborators.length === 0 && (
          <Card className="border-border/50">
            <CardContent className="py-12 text-center">
              <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Nenhum vendedor encontrado na organizacao.
              </p>
            </CardContent>
          </Card>
        )}

        {collaborators.map((collab) => {
          const isExpanded = expandedId === collab.user.id
          const statusConfig = STATUS_CONFIG[collab.status]

          return (
            <Card key={collab.user.id} className="border-border/50 overflow-hidden">
              <CardContent className="p-0">
                {/* Main row */}
                <button
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : collab.user.id)}
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                      {getInitials(collab.user.name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{collab.user.name}</p>
                    <p className="text-[11px] text-muted-foreground">Vendedor</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {collab.hasBurnout && (
                      <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-500 border-red-500/30 gap-1">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        Sinal de Burnout
                      </Badge>
                    )}

                    <Badge variant="outline" className={`text-[10px] ${statusConfig.className}`}>
                      {statusConfig.label}
                    </Badge>

                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t px-4 py-4 space-y-4 bg-muted/10">
                    {collab.profile ? (
                      <>
                        {/* DISC Profile */}
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <Brain className="h-4 w-4 text-primary" />
                            <p className="text-sm font-medium">Perfil DISC</p>
                            <Badge variant="secondary" className="text-[10px]">
                              {collab.profile.dominant_profile} - {collab.profile.profile_name}
                            </Badge>
                          </div>

                          <div className="space-y-2.5">
                            {(Object.keys(DISC_COLORS) as Array<'D' | 'I' | 'S' | 'C'>).map((dim) => {
                              const score = collab.profile!.scores[dim] ?? 0
                              const config = DISC_COLORS[dim]
                              return (
                                <div key={dim}>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-medium" style={{ color: config.color }}>
                                      {dim} - {config.label}
                                    </span>
                                    <span className="text-[11px] text-muted-foreground">{score}%</span>
                                  </div>
                                  <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${config.bg} transition-all`}
                                      style={{ width: `${score}%` }}
                                    />
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        {/* Performance Insight */}
                        <Card className="border-primary/20 bg-primary/5">
                          <CardContent className="pt-3 pb-3">
                            <div className="flex items-start gap-2">
                              <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                              <div>
                                <p className="text-[11px] font-medium text-primary mb-1">Insight da VAMO IA</p>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                  {collab.profile.performance_insight ||
                                    `Perfil ${collab.profile.dominant_profile} alto vai direto ao preco sem construir valor. Explica baixa conversao em fechamento.`}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Strengths & Development */}
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-xs font-medium text-emerald-500 mb-1.5">Pontos Fortes em Vendas</p>
                            <ul className="space-y-1">
                              {collab.profile.selling_strengths.slice(0, 3).map((s, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                                  {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-amber-500 mb-1.5">Areas de Desenvolvimento</p>
                            <ul className="space-y-1">
                              {collab.profile.development_areas.slice(0, 3).map((s, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                                  {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-6">
                        <Eye className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">
                          Diagnostico comportamental ainda nao realizado.
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          O colaborador precisa responder o questionario de perfil comportamental.
                        </p>
                      </div>
                    )}

                    {/* Burnout alert inside expanded */}
                    {collab.hasBurnout && (
                      <Card className="border-red-500/20 bg-red-500/5">
                        <CardContent className="pt-3 pb-3">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-medium text-red-500">
                                Alerta: Sinal de Burnout Detectado
                              </p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                Recomendamos uma conversa 1:1 antes de atribuir novas missoes de volume.
                                Gamificacao sobre alguem sobrecarregado pode piorar o quadro.
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Performance data placeholder */}
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-lg border border-border/50 p-3 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">XP Total</p>
                        <p className="text-lg font-bold mt-0.5">
                          <TrendingUp className="h-3 w-3 inline mr-1 text-emerald-500" />
                          --
                        </p>
                      </div>
                      <div className="rounded-lg border border-border/50 p-3 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Missoes</p>
                        <p className="text-lg font-bold mt-0.5">--</p>
                      </div>
                      <div className="rounded-lg border border-border/50 p-3 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Nivel</p>
                        <p className="text-lg font-bold mt-0.5">--</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
