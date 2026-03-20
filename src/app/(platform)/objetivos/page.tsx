'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Target,
  Rocket,
  Star,
  ArrowRight,
  CheckCircle,
  Clock,
} from 'lucide-react'

interface StepCard {
  title: string
  description: string
  icon: React.ElementType
  href: string
  status: 'pendente' | 'concluido'
}

export default function ObjetivosPage() {
  const { user } = useAuth()
  const router = useRouter()

  // In a real app, status would come from the backend
  const [steps] = useState<StepCard[]>([
    {
      title: 'Definir Metas',
      description: 'Estabeleça metas da empresa, do time e individuais alinhadas ao diagnóstico.',
      icon: Target,
      href: '/objetivos/metas',
      status: 'pendente',
    },
    {
      title: 'Plano de Ação',
      description: 'Configure missões gamificadas com XP, bônus e prazos para a equipe.',
      icon: Rocket,
      href: '/objetivos/plano-acao',
      status: 'pendente',
    },
    {
      title: 'Recompensas',
      description: 'Defina recompensas financeiras, badges, day off e reconhecimento público.',
      icon: Star,
      href: '/objetivos/recompensas',
      status: 'pendente',
    },
    {
      title: 'Lançamento',
      description: 'Revise o checklist, configure a mensagem de kick-off e lance para a equipe.',
      icon: Rocket,
      href: '/objetivos/lancamento',
      status: 'pendente',
    },
  ])

  if (!user) return null

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold tracking-tight">Objetivos</h2>
            <Badge variant="secondary" className="text-[10px] bg-violet-500/10 text-violet-500 border-0">
              Etapa 2 de 4
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Do diagn&oacute;stico ao plano gamificado
          </p>
        </div>
      </div>

      {/* Status Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {steps.map((step, index) => {
          const Icon = step.icon
          const isCompleted = step.status === 'concluido'

          return (
            <Card
              key={step.title}
              className={`border-border/50 transition-all hover:border-border/80 hover:shadow-sm cursor-pointer ${
                isCompleted ? 'border-emerald-500/30 bg-emerald-500/5' : ''
              }`}
              onClick={() => router.push(step.href)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                        isCompleted
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : 'bg-violet-500/10 text-violet-500'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-medium">
                        {index + 1}. {step.title}
                      </CardTitle>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[9px] ${
                      isCompleted
                        ? 'text-emerald-500 border-emerald-500/30'
                        : 'text-muted-foreground border-border/50'
                    }`}
                  >
                    {isCompleted ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle className="h-2.5 w-2.5" />
                        Conclu&iacute;do
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
                <p className="text-xs text-muted-foreground mb-3">{step.description}</p>
                <Button variant="ghost" size="sm" className="text-xs px-0 hover:bg-transparent hover:text-violet-500">
                  Acessar <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Progress summary */}
      <Card className="border-border/50">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Progresso da Etapa 2
              </p>
              <p className="text-sm mt-0.5">
                <strong className="text-emerald-500">
                  {steps.filter((s) => s.status === 'concluido').length}
                </strong>{' '}
                de <strong>{steps.length}</strong> passos conclu&iacute;dos
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-violet-500/10 flex items-center justify-center">
              <span className="text-sm font-bold text-violet-500">
                {Math.round(
                  (steps.filter((s) => s.status === 'concluido').length / steps.length) * 100
                )}
                %
              </span>
            </div>
          </div>
          <div className="mt-3 h-1.5 w-full rounded-full bg-muted/50">
            <div
              className="h-1.5 rounded-full bg-violet-500 transition-all duration-500"
              style={{
                width: `${(steps.filter((s) => s.status === 'concluido').length / steps.length) * 100}%`,
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
