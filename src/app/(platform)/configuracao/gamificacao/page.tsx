'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Gamepad2,
  Trophy,
  Eye,
  Award,
  BarChart2,
  MessageCircle,
  Heart,
  Sparkles,
  Info,
} from 'lucide-react'

interface Level {
  position: number
  name: string
}

const INITIAL_LEVELS: Level[] = [
  { position: 1, name: 'Recruta' },
  { position: 2, name: 'Prospector' },
  { position: 3, name: 'Negociador' },
  { position: 4, name: 'Hunter' },
  { position: 5, name: 'Closer' },
  { position: 6, name: 'Elite' },
  { position: 7, name: 'Campeão' },
  { position: 8, name: 'Lenda' },
]

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="relative inline-flex items-center cursor-pointer shrink-0">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className="w-9 h-5 bg-muted rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
    </label>
  )
}

export default function GamificacaoPage() {
  const { user } = useAuth()
  const [levels, setLevels] = useState<Level[]>(INITIAL_LEVELS)
  const [rankingPublic, setRankingPublic] = useState(true)
  const [badgesPublic, setBadgesPublic] = useState(true)
  const [feedEnabled, setFeedEnabled] = useState(true)
  const [surveyFrequency, setSurveyFrequency] = useState('semanal')
  const [wellbeingThreshold, setWellbeingThreshold] = useState(40)

  if (!user) return null

  const updateLevelName = (position: number, name: string) => {
    setLevels(levels.map((l) => (l.position === position ? { ...l, name } : l)))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Gamepad2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight">Configuração de Gamificação</h2>
            <Badge variant="outline" className="text-[10px] h-5 px-2">
              Etapa 3
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Personalize níveis, rankings e regras de engajamento
          </p>
        </div>
      </div>

      {/* Level Names */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Nomes dos Níveis</h3>
        </div>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {levels.map((level) => (
                <div key={level.position} className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">
                    Nível {level.position}
                  </Label>
                  <Input
                    className="h-8 text-xs"
                    value={level.name}
                    onChange={(e) => updateLevelName(level.position, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Visibility Settings */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Visibilidade</h3>
        </div>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-4 space-y-4">
            {/* Ranking */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <BarChart2 className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">Ranking</p>
                  <p className="text-[11px] text-muted-foreground">
                    {rankingPublic
                      ? 'Ranking público — todos veem a posição'
                      : 'Ranking privado — cada um vê só o próprio'}
                  </p>
                </div>
              </div>
              <ToggleSwitch checked={rankingPublic} onChange={setRankingPublic} />
            </div>

            <Separator />

            {/* Badges */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <Award className="h-4 w-4 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">Badges</p>
                  <p className="text-[11px] text-muted-foreground">
                    {badgesPublic
                      ? 'Exibir badges no feed público'
                      : 'Apenas no perfil individual'}
                  </p>
                </div>
              </div>
              <ToggleSwitch checked={badgesPublic} onChange={setBadgesPublic} />
            </div>

            <Separator />

            {/* Feed */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <MessageCircle className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">Feed de Reconhecimento</p>
                  <p className="text-[11px] text-muted-foreground">
                    {feedEnabled
                      ? 'Feed de reconhecimento público ativado'
                      : 'Feed de reconhecimento desativado'}
                  </p>
                </div>
              </div>
              <ToggleSwitch checked={feedEnabled} onChange={setFeedEnabled} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pulse Survey */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Pulse Survey</h3>
        </div>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <Label className="text-xs text-muted-foreground shrink-0">
                Frequência da pesquisa de clima:
              </Label>
              <Select value={surveyFrequency} onValueChange={(v) => v && setSurveyFrequency(v)}>
                <SelectTrigger className="w-full sm:w-44 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="quinzenal">Quinzenal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Wellbeing Rule */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Heart className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Regra de Bem-Estar</h3>
        </div>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <p className="text-xs text-muted-foreground">
                Se índice de bem-estar cair abaixo de
              </p>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  className="h-7 w-16 text-xs text-center"
                  value={wellbeingThreshold}
                  onChange={(e) =>
                    setWellbeingThreshold(Math.max(0, Math.min(100, Number(e.target.value) || 0)))
                  }
                  min={0}
                  max={100}
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
              <p className="text-xs text-muted-foreground">
                → VAMO IA pausa missões de volume + notifica gestor
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Note */}
      <div className="rounded-lg border border-border/40 bg-muted/30 p-4">
        <div className="flex items-start gap-3">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            A personalização dos títulos parece detalhe, mas faz diferença enorme no engajamento.
            Adapte os nomes dos níveis à cultura da sua equipe para criar identificação e motivação.
          </p>
        </div>
      </div>
    </div>
  )
}
