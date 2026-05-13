'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, CheckCircle, Clock, Rocket, Star, Target } from 'lucide-react'
import { PageHeader, TitleHighlight } from '@/components/shared/page-header'

interface StepStatus {
  id: string
  title: string
  href: string
  completed: boolean
  evidence: string
  updatedAt: string | null
}

interface ProgramStatus {
  steps: StepStatus[]
  completed: number
  total: number
  progress: number
}

const iconByStep: Record<string, React.ElementType> = {
  goals: Target,
  action_plan: Rocket,
  rewards: Star,
  launch: Rocket,
}

export default function ObjetivosPage() {
  const { user } = useRequiredAuth()
  const router = useRouter()
  const [status, setStatus] = useState<ProgramStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    fetch('/api/program/status', { credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Erro ao carregar status')
        return res.json() as Promise<ProgramStatus>
      })
      .then(setStatus)
      .catch(() => setStatus({ steps: [], completed: 0, total: 4, progress: 0 }))
      .finally(() => setLoading(false))
  }, [user])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      </div>
    )
  }

  const steps = status?.steps ?? []

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        label="Programa"
        title={<><TitleHighlight>Objetivos</TitleHighlight> do Programa</>}
        description="Status real da configuração: metas, missões, recompensas e lançamento."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {steps.map((step, index) => {
          const Icon = iconByStep[step.id] ?? Target

          return (
            <Card
              key={step.id}
              className={`cursor-pointer border-border/50 transition-all hover:border-border/80 hover:shadow-sm ${
                step.completed ? 'border-emerald-500/30 bg-emerald-500/5' : ''
              }`}
              onClick={() => router.push(step.href)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                        step.completed ? 'bg-emerald-500/10 text-emerald-500' : 'bg-violet-500/10 text-violet-500'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-sm font-medium">
                      {index + 1}. {step.title}
                    </CardTitle>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[9px] ${
                      step.completed ? 'border-emerald-500/30 text-emerald-500' : 'border-border/50 text-muted-foreground'
                    }`}
                  >
                    {step.completed ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle className="h-2.5 w-2.5" />
                        Concluido
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        Pendente
                      </span>
                    )}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-xs text-muted-foreground">{step.evidence}</p>
                {step.updatedAt && (
                  <p className="mb-3 text-[10px] text-muted-foreground">
                    Atualizado em {new Date(step.updatedAt).toLocaleDateString('pt-BR')}
                  </p>
                )}
                <Button variant="ghost" size="sm" className="px-0 text-xs hover:bg-transparent hover:text-violet-500">
                  Acessar <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="border-border/50">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Progresso real da configuração
              </p>
              <p className="mt-0.5 text-sm">
                <strong className="text-emerald-500">{status?.completed ?? 0}</strong> de{' '}
                <strong>{status?.total ?? 4}</strong> passos concluidos
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/10">
              <span className="text-sm font-bold text-violet-500">{status?.progress ?? 0}%</span>
            </div>
          </div>
          <div className="mt-3 h-1.5 w-full rounded-full bg-muted/50">
            <div
              className="h-1.5 rounded-full bg-violet-500 transition-all duration-500"
              style={{ width: `${status?.progress ?? 0}%` }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
