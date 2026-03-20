'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Building2,
  Users,
  User,
  Target,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  CheckCircle,
  TrendingUp,
  Save,
} from 'lucide-react'
import { toast } from 'sonner'

interface CompanyGoal {
  kpiFinanceiro: string
  valorAtual: string
  valorMeta: string
  prazo: string
  metrica: string
}

interface TeamGoal {
  kpiComportamental: string
  valorAtual: string
  valorMeta: string
  prazo: string
  medicao: 'auto_crm' | 'manual'
}

interface IndividualGoal {
  id: string
  name: string
  discProfile: string
  goal: string
}

export default function MetasPage() {
  const { user } = useAuth()
  const router = useRouter()

  const [companyGoal, setCompanyGoal] = useState<CompanyGoal>({
    kpiFinanceiro: '',
    valorAtual: '',
    valorMeta: '',
    prazo: '',
    metrica: '',
  })

  const [teamGoal, setTeamGoal] = useState<TeamGoal>({
    kpiComportamental: '',
    valorAtual: '',
    valorMeta: '',
    prazo: '',
    medicao: 'auto_crm',
  })

  // Mock collaborators - in real app, fetched from Supabase
  const [individualGoals, setIndividualGoals] = useState<IndividualGoal[]>([
    { id: '1', name: 'Carlos Silva', discProfile: 'D - Dominante', goal: '' },
    { id: '2', name: 'Ana Souza', discProfile: 'I - Influente', goal: '' },
    { id: '3', name: 'Pedro Santos', discProfile: 'S - Estável', goal: '' },
    { id: '4', name: 'Mariana Lima', discProfile: 'C - Consciencioso', goal: '' },
  ])

  const [aiSuggestionAccepted, setAiSuggestionAccepted] = useState(false)
  const [saving, setSaving] = useState(false)

  if (!user) return null

  const handleIndividualGoalChange = (id: string, value: string) => {
    setIndividualGoals((prev) =>
      prev.map((g) => (g.id === id ? { ...g, goal: value } : g))
    )
  }

  const handleAcceptAiSuggestion = () => {
    setTeamGoal((prev) => ({
      ...prev,
      kpiComportamental: 'Taxa de Conversão',
      valorAtual: '44%',
      valorMeta: '52%',
      prazo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      medicao: 'auto_crm',
    }))
    setAiSuggestionAccepted(true)
    toast.success('Sugestão da IA aplicada com sucesso!')
  }

  const handleSave = async () => {
    setSaving(true)
    // Simulate API call
    await new Promise((r) => setTimeout(r, 1200))
    toast.success('Metas salvas com sucesso!')
    setSaving(false)
    router.push('/objetivos')
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.push('/objetivos')} className="px-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-xl font-semibold tracking-tight">Definir Metas</h2>
            <Badge variant="secondary" className="text-[10px] bg-violet-500/10 text-violet-500 border-0">
              Etapa 2
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1 ml-10">
            Alinhe metas da empresa, do time e individuais
          </p>
        </div>
      </div>

      {/* Block 1 - Meta da Empresa */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Building2 className="h-3.5 w-3.5 text-blue-500" />
            </div>
            <div>
              <CardTitle className="text-sm font-medium">Meta da Empresa</CardTitle>
              <p className="text-[10px] text-muted-foreground">KPI financeiro principal</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">KPI Financeiro</Label>
            <Input
              value={companyGoal.kpiFinanceiro}
              onChange={(e) => setCompanyGoal((prev) => ({ ...prev, kpiFinanceiro: e.target.value }))}
              placeholder="Ex: Receita mensal, MRR, Ticket Médio"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Valor Atual</Label>
              <Input
                value={companyGoal.valorAtual}
                onChange={(e) => setCompanyGoal((prev) => ({ ...prev, valorAtual: e.target.value }))}
                placeholder="Ex: R$ 150.000"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Valor Meta</Label>
              <Input
                value={companyGoal.valorMeta}
                onChange={(e) => setCompanyGoal((prev) => ({ ...prev, valorMeta: e.target.value }))}
                placeholder="Ex: R$ 200.000"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Prazo</Label>
              <Input
                type="date"
                value={companyGoal.prazo}
                onChange={(e) => setCompanyGoal((prev) => ({ ...prev, prazo: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Métrica de Acompanhamento</Label>
              <Input
                value={companyGoal.metrica}
                onChange={(e) => setCompanyGoal((prev) => ({ ...prev, metrica: e.target.value }))}
                placeholder="Ex: R$/mês"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Block 2 - Meta do Time */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <Users className="h-3.5 w-3.5 text-violet-500" />
            </div>
            <div>
              <CardTitle className="text-sm font-medium">Meta do Time</CardTitle>
              <p className="text-[10px] text-muted-foreground">KPI comportamental coletivo</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">KPI Comportamental</Label>
            <Input
              value={teamGoal.kpiComportamental}
              onChange={(e) => setTeamGoal((prev) => ({ ...prev, kpiComportamental: e.target.value }))}
              placeholder="Ex: Taxa de conversão, Follow-up em 24h"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Valor Atual</Label>
              <Input
                value={teamGoal.valorAtual}
                onChange={(e) => setTeamGoal((prev) => ({ ...prev, valorAtual: e.target.value }))}
                placeholder="Ex: 44%"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Valor Meta</Label>
              <Input
                value={teamGoal.valorMeta}
                onChange={(e) => setTeamGoal((prev) => ({ ...prev, valorMeta: e.target.value }))}
                placeholder="Ex: 62%"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Prazo</Label>
              <Input
                type="date"
                value={teamGoal.prazo}
                onChange={(e) => setTeamGoal((prev) => ({ ...prev, prazo: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Medição</Label>
              <select
                value={teamGoal.medicao}
                onChange={(e) => setTeamGoal((prev) => ({ ...prev, medicao: e.target.value as 'auto_crm' | 'manual' }))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="auto_crm">Automático (CRM)</option>
                <option value="manual">Manual</option>
              </select>
            </div>
          </div>

          {/* AI Suggestion */}
          <div className={`rounded-lg border p-4 transition-all ${
            aiSuggestionAccepted
              ? 'border-emerald-500/30 bg-emerald-500/5'
              : 'border-violet-500/30 bg-violet-500/5'
          }`}>
            <div className="flex items-start gap-2">
              <Sparkles className={`h-4 w-4 mt-0.5 shrink-0 ${aiSuggestionAccepted ? 'text-emerald-500' : 'text-violet-500'}`} />
              <div className="flex-1">
                <p className="text-xs font-medium mb-1">
                  {aiSuggestionAccepted ? (
                    <span className="flex items-center gap-1 text-emerald-500">
                      <CheckCircle className="h-3 w-3" /> Sugestão aplicada
                    </span>
                  ) : (
                    <span className="text-violet-500">A IA sugere:</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  Sua conversão é 44%, benchmark do setor é 62%. Sugiro meta de 52% em 30 dias —
                  crescimento realista de 18% que mantém o time motivado sem gerar sobrecarga. Confirma?
                </p>
                {!aiSuggestionAccepted && (
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" className="text-xs bg-violet-500 hover:bg-violet-600 text-white" onClick={handleAcceptAiSuggestion}>
                      <CheckCircle className="h-3 w-3 mr-1" /> Aceitar
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs">
                      Ajustar
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Block 3 - Metas Individuais */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <User className="h-3.5 w-3.5 text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-sm font-medium">Metas Individuais</CardTitle>
              <p className="text-[10px] text-muted-foreground">Baseadas no perfil DISC de cada colaborador</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {individualGoals.map((collab) => (
            <div key={collab.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/40">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium">{collab.name}</p>
                  <Badge variant="outline" className="text-[9px]">
                    {collab.discProfile}
                  </Badge>
                </div>
                <Input
                  value={collab.goal}
                  onChange={(e) => handleIndividualGoalChange(collab.id, e.target.value)}
                  placeholder="Ex: 8 contratos fechados no mês"
                  className="text-xs"
                />
              </div>
              <div className="shrink-0">
                <Target className="h-4 w-4 text-muted-foreground/40" />
              </div>
            </div>
          ))}

          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <div className="flex items-start gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-[11px] text-muted-foreground">
                Metas individuais são calibradas pelo perfil DISC. Perfis <strong>D</strong> recebem metas de resultado mais agressivas,
                enquanto perfis <strong>S</strong> e <strong>C</strong> focam em consistência e qualidade.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Save */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => router.push('/objetivos')}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Voltar
        </Button>
        <Button
          className="bg-emerald-500 hover:bg-emerald-600 text-white"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Salvando...
            </span>
          ) : (
            <>
              <Save className="h-3.5 w-3.5 mr-1" /> Salvar Metas
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
