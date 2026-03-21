'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Building2, Users, Target, Sparkles, ChevronRight, ChevronLeft,
  CheckCircle2, Brain, BarChart3, Zap,
} from 'lucide-react'
import { DIAGNOSTIC_AREAS } from '@/lib/constants'
import type { DiagnosticArea } from '@/types'

type Step = 'fonte' | 'empresa' | 'gerando' | 'questionario' | 'finalizando'

interface CompanyContext {
  respondent_name: string
  segmento: string
  subnicho: string
  num_funcionarios: string
  num_vendedores: string
  tempo_empresa: string
  modelo_vendas: string
  ticket_medio: string
  ciclo_vendas: string
  crm: string
  meta_mensal: string
  receita_atual: string
  canal_leads: string[]
  tem_gestor: boolean
}

interface AIQuestion {
  id: number
  question: string
  area: DiagnosticArea
  options: { label: string; value: number }[]
}

const CANAL_LEADS_OPTIONS = ['Indicações', 'Cold email', 'Cold call', 'LinkedIn', 'Inbound/SEO', 'Mídia paga', 'Eventos', 'Parcerias']

const AREA_COLORS: Record<string, string> = {
  lead_generation: 'bg-blue-500/10 text-blue-600',
  sales_process: 'bg-violet-500/10 text-violet-600',
  team_management: 'bg-emerald-500/10 text-emerald-600',
  tools_technology: 'bg-amber-500/10 text-amber-600',
}

export default function NovoDiagnosticoPage() {
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<Step>('fonte')
  const [fonte, setFonte] = useState<'equipe' | 'vendedor' | 'eu'>('equipe')
  const [ctx, setCtx] = useState<CompanyContext>({
    respondent_name: '',
    segmento: '',
    subnicho: '',
    num_funcionarios: '',
    num_vendedores: '',
    tempo_empresa: '',
    modelo_vendas: '',
    ticket_medio: '',
    ciclo_vendas: '',
    crm: '',
    meta_mensal: '',
    receita_atual: '',
    canal_leads: [],
    tem_gestor: true,
  })
  const [questions, setQuestions] = useState<AIQuestion[]>([])
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [currentQ, setCurrentQ] = useState(0)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [savingTimeout, setSavingTimeout] = useState(false)

  if (!user) return null

  const setField = (field: keyof CompanyContext, value: any) =>
    setCtx((prev) => ({ ...prev, [field]: value }))

  const toggleCanal = (canal: string) =>
    setCtx((prev) => ({
      ...prev,
      canal_leads: prev.canal_leads.includes(canal)
        ? prev.canal_leads.filter((c) => c !== canal)
        : [...prev.canal_leads, canal],
    }))

  const canSubmitEmpresa =
    ctx.respondent_name.trim() &&
    ctx.segmento &&
    ctx.num_funcionarios &&
    ctx.num_vendedores &&
    ctx.modelo_vendas &&
    ctx.ticket_medio &&
    ctx.ciclo_vendas &&
    ctx.crm &&
    ctx.meta_mensal &&
    ctx.receita_atual

  const handleGerarPerguntas = async () => {
    setStep('gerando')
    setError('')
    try {
      const res = await fetch('/api/ai/generate-diagnostic-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyContext: ctx }),
      })
      const data = await res.json()
      if (!res.ok || !data.questions) throw new Error(data.error || 'Erro ao gerar perguntas')
      setQuestions(data.questions)
      setCurrentQ(0)
      setAnswers({})
      setStep('questionario')
    } catch (err: any) {
      setError(err.message)
      setStep('empresa')
    }
  }

  const handleAnswer = (questionId: number, value: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id] !== undefined)

  const handleSave = async () => {
    if (!user || saving) return
    setSaving(true)
    setSavingTimeout(false)
    setError('')
    setStep('finalizando')

    // Show recovery button after 30 seconds if still saving
    const timeoutId = setTimeout(() => setSavingTimeout(true), 30000)

    try {
      // Calculate area scores
      const areaData: Record<string, { sum: number; count: number }> = {}
      for (const q of questions) {
        if (!areaData[q.area]) areaData[q.area] = { sum: 0, count: 0 }
        const val = answers[q.id] ?? 1
        areaData[q.area].sum += val
        areaData[q.area].count += 1
      }

      const areaScores: Record<string, { score: number; max: number; pct: number }> = {}
      let totalScore = 0
      let maxScore = 0
      for (const [area, { sum, count }] of Object.entries(areaData)) {
        const areaMax = count * 4
        areaScores[area] = {
          score: sum,
          max: areaMax,
          pct: Math.round((sum / areaMax) * 100),
        }
        totalScore += sum
        maxScore += areaMax
      }

      const healthPct = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0
      const quadrant =
        healthPct < 25 ? 'critical' :
        healthPct < 50 ? 'at_risk' :
        healthPct < 75 ? 'developing' : 'optimized'

      const { data: session, error: insertError } = await supabase
        .from('diagnostic_sessions')
        .insert({
          organization_id: user.organization_id,
          conducted_by: user.id,
          respondent_name: ctx.respondent_name,
          status: 'completed',
          total_score: totalScore,
          max_score: maxScore,
          health_pct: healthPct,
          quadrant,
          area_scores: areaScores,
          company_context: ctx,
          ai_qa: { questions, answers },
          completed_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (insertError) throw insertError
      router.push(`/diagnostico/${session.id}/relatorio`)
    } catch (err: any) {
      console.error(err)
      setError('Erro ao salvar diagnóstico. Verifique sua conexão e tente novamente.')
      setSaving(false)
      setStep('questionario')
    } finally {
      clearTimeout(timeoutId)
      setSavingTimeout(false)
    }
  }

  const progress =
    step === 'fonte' ? 15 :
    step === 'empresa' ? 35 :
    step === 'gerando' ? 55 :
    step === 'questionario' ? 55 + Math.round((Object.keys(answers).length / Math.max(questions.length, 1)) * 35) :
    100

  const currentQuestion = questions[currentQ]

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
            Diagnóstico Comercial
          </Badge>
        </div>
        <h2 className="text-xl font-semibold tracking-tight">Novo Diagnóstico</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          IA gera perguntas personalizadas para o seu negócio
        </p>
      </div>

      {/* Progress */}
      <div className="space-y-1.5">
        <Progress value={progress} className="h-1.5" />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span className={step === 'fonte' ? 'text-primary font-medium' : ''}>Fonte</span>
          <span className={step === 'empresa' ? 'text-primary font-medium' : ''}>Empresa</span>
          <span className={step === 'gerando' || step === 'questionario' ? 'text-primary font-medium' : ''}>Questionário IA</span>
          <span className={step === 'finalizando' ? 'text-primary font-medium' : ''}>Resultado</span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* ── STEP: FONTE ── */}
      {step === 'fonte' && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Para quem é este diagnóstico?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { id: 'equipe' as const, icon: Users, title: 'Minha equipe completa', desc: 'Visão geral da performance do time' },
              { id: 'vendedor' as const, icon: Target, title: 'Um vendedor específico', desc: 'Diagnóstico individual de um colaborador' },
              { id: 'eu' as const, icon: Building2, title: 'Minha operação comercial', desc: 'Autoavaliação do processo e resultados' },
            ].map(({ id, icon: Icon, title, desc }) => (
              <button
                key={id}
                onClick={() => setFonte(id)}
                className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                  fonte === id
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border/40 hover:border-border hover:bg-accent/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${fonte === id ? 'bg-primary/10' : 'bg-muted'}`}>
                    <Icon className={`h-4.5 w-4.5 ${fonte === id ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  {fonte === id && <CheckCircle2 className="h-4 w-4 text-primary" />}
                </div>
              </button>
            ))}

            <Button className="w-full mt-2" onClick={() => setStep('empresa')}>
              Continuar
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── STEP: EMPRESA ── */}
      {step === 'empresa' && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Contexto da Empresa</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">A IA usa esses dados para gerar perguntas relevantes ao seu negócio</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Nome / empresa */}
            <div className="space-y-1.5">
              <Label className="text-xs">Nome da empresa ou respondente *</Label>
              <Input
                value={ctx.respondent_name}
                onChange={(e) => setField('respondent_name', e.target.value)}
                placeholder="Ex: Empresa XYZ / João Silva"
                className="h-8 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Segmento */}
              <div className="space-y-1.5">
                <Label className="text-xs">Segmento *</Label>
                <select
                  value={ctx.segmento}
                  onChange={(e) => setField('segmento', e.target.value)}
                  className="w-full h-8 text-sm rounded-md border border-input bg-background px-3"
                >
                  <option value="">Selecionar</option>
                  {['B2B', 'B2C', 'B2B2C', 'SaaS', 'Serviços', 'Varejo', 'Indústria', 'Saúde', 'Educação', 'Imóveis', 'Financeiro'].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Subnicho */}
              <div className="space-y-1.5">
                <Label className="text-xs">Nicho / Produto</Label>
                <Input
                  value={ctx.subnicho}
                  onChange={(e) => setField('subnicho', e.target.value)}
                  placeholder="Ex: SaaS RH, Consultoria..."
                  className="h-8 text-sm"
                />
              </div>

              {/* Num funcionarios */}
              <div className="space-y-1.5">
                <Label className="text-xs">Funcionários *</Label>
                <select
                  value={ctx.num_funcionarios}
                  onChange={(e) => setField('num_funcionarios', e.target.value)}
                  className="w-full h-8 text-sm rounded-md border border-input bg-background px-3"
                >
                  <option value="">Selecionar</option>
                  {['1-10', '11-30', '31-100', '101-500', '500+'].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              {/* Num vendedores */}
              <div className="space-y-1.5">
                <Label className="text-xs">Vendedores *</Label>
                <Input
                  type="number"
                  min="1"
                  value={ctx.num_vendedores}
                  onChange={(e) => setField('num_vendedores', e.target.value)}
                  placeholder="Ex: 8"
                  className="h-8 text-sm"
                />
              </div>

              {/* Tempo empresa */}
              <div className="space-y-1.5">
                <Label className="text-xs">Tempo de mercado</Label>
                <select
                  value={ctx.tempo_empresa}
                  onChange={(e) => setField('tempo_empresa', e.target.value)}
                  className="w-full h-8 text-sm rounded-md border border-input bg-background px-3"
                >
                  <option value="">Selecionar</option>
                  {['Menos de 1 ano', '1 a 3 anos', '3 a 10 anos', 'Mais de 10 anos'].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              {/* Modelo de vendas */}
              <div className="space-y-1.5">
                <Label className="text-xs">Modelo de vendas *</Label>
                <select
                  value={ctx.modelo_vendas}
                  onChange={(e) => setField('modelo_vendas', e.target.value)}
                  className="w-full h-8 text-sm rounded-md border border-input bg-background px-3"
                >
                  <option value="">Selecionar</option>
                  {['Inbound', 'Outbound', 'Misto', 'Account Based', 'Inside Sales', 'Field Sales', 'Self-Service'].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              {/* Ticket medio */}
              <div className="space-y-1.5">
                <Label className="text-xs">Ticket médio *</Label>
                <select
                  value={ctx.ticket_medio}
                  onChange={(e) => setField('ticket_medio', e.target.value)}
                  className="w-full h-8 text-sm rounded-md border border-input bg-background px-3"
                >
                  <option value="">Selecionar</option>
                  {['Abaixo de R$ 1k', 'R$ 1k – 5k', 'R$ 5k – 20k', 'R$ 20k – 100k', 'Acima de R$ 100k'].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              {/* Ciclo de vendas */}
              <div className="space-y-1.5">
                <Label className="text-xs">Ciclo de vendas *</Label>
                <select
                  value={ctx.ciclo_vendas}
                  onChange={(e) => setField('ciclo_vendas', e.target.value)}
                  className="w-full h-8 text-sm rounded-md border border-input bg-background px-3"
                >
                  <option value="">Selecionar</option>
                  {['Menos de 1 semana', '1 a 4 semanas', '1 a 3 meses', 'Mais de 3 meses'].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              {/* CRM */}
              <div className="space-y-1.5">
                <Label className="text-xs">CRM atual *</Label>
                <select
                  value={ctx.crm}
                  onChange={(e) => setField('crm', e.target.value)}
                  className="w-full h-8 text-sm rounded-md border border-input bg-background px-3"
                >
                  <option value="">Selecionar</option>
                  {['HubSpot', 'Pipedrive', 'Salesforce', 'RD Station', 'Zoho CRM', 'Planilha Excel/Google', 'Nenhum'].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              {/* Meta mensal */}
              <div className="space-y-1.5">
                <Label className="text-xs">Meta mensal *</Label>
                <select
                  value={ctx.meta_mensal}
                  onChange={(e) => setField('meta_mensal', e.target.value)}
                  className="w-full h-8 text-sm rounded-md border border-input bg-background px-3"
                >
                  <option value="">Selecionar</option>
                  {['Abaixo de R$ 50k', 'R$ 50k – 200k', 'R$ 200k – 500k', 'R$ 500k – 2M', 'Acima de R$ 2M'].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              {/* Receita atual */}
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Atingimento atual da meta *</Label>
                <div className="flex gap-2">
                  {['Abaixo de 70%', '70% a 90%', '91% a 100%', 'Acima de 100%'].map((v) => (
                    <button
                      key={v}
                      onClick={() => setField('receita_atual', v)}
                      className={`flex-1 text-xs py-1.5 rounded-md border transition-colors ${
                        ctx.receita_atual === v
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border hover:bg-accent/40'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Canais de leads */}
            <div className="space-y-1.5">
              <Label className="text-xs">Canais de geração de leads</Label>
              <div className="flex flex-wrap gap-2">
                {CANAL_LEADS_OPTIONS.map((canal) => (
                  <button
                    key={canal}
                    onClick={() => toggleCanal(canal)}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                      ctx.canal_leads.includes(canal)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border hover:bg-accent/40'
                    }`}
                  >
                    {canal}
                  </button>
                ))}
              </div>
            </div>

            {/* Tem gestor */}
            <div className="flex items-center justify-between rounded-lg border border-border/40 p-3">
              <div>
                <p className="text-sm font-medium">Gestor comercial dedicado</p>
                <p className="text-xs text-muted-foreground">Existe um gestor focado exclusivamente na equipe de vendas</p>
              </div>
              <button
                onClick={() => setField('tem_gestor', !ctx.tem_gestor)}
                className={`relative shrink-0 h-5 w-9 rounded-full transition-colors ${ctx.tem_gestor ? 'bg-primary' : 'bg-muted-foreground/30'}`}
              >
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${ctx.tem_gestor ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <div className="flex gap-3 pt-1">
              <Button variant="outline" size="sm" onClick={() => setStep('fonte')}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Voltar
              </Button>
              <Button
                className="flex-1"
                disabled={!canSubmitEmpresa}
                onClick={handleGerarPerguntas}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Gerar Questionário com IA
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── STEP: GERANDO ── */}
      {step === 'gerando' && (
        <Card className="border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-5">
            <div className="relative">
              <div className="h-16 w-16 rounded-2xl vamo-gradient flex items-center justify-center shadow-lg">
                <Brain className="h-7 w-7 text-[#0A0A0A]" />
              </div>
              <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-amber-400 flex items-center justify-center">
                <Sparkles className="h-2.5 w-2.5 text-white" />
              </div>
            </div>
            <div>
              <p className="font-semibold text-foreground">IA analisando seu perfil...</p>
              <p className="text-sm text-muted-foreground mt-1">
                Gerando perguntas personalizadas para <strong>{ctx.segmento}</strong>
                {ctx.modelo_vendas ? ` · ${ctx.modelo_vendas}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse [animation-delay:200ms]" />
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse [animation-delay:400ms]" />
              <span>Isso leva cerca de 10–20 segundos</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── STEP: QUESTIONÁRIO ── */}
      {step === 'questionario' && currentQuestion && (
        <div className="space-y-4">
          {/* Area indicator */}
          <div className="flex items-center justify-between">
            <Badge className={`text-[10px] border-0 ${AREA_COLORS[currentQuestion.area] || 'bg-muted text-muted-foreground'}`}>
              {DIAGNOSTIC_AREAS[currentQuestion.area] ?? currentQuestion.area}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {currentQ + 1} / {questions.length}
            </span>
          </div>

          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base leading-snug">{currentQuestion.question}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {currentQuestion.options.map((opt) => {
                const selected = answers[currentQuestion.id] === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => handleAnswer(currentQuestion.id, opt.value)}
                    className={`w-full text-left rounded-lg border-2 px-4 py-3 text-sm transition-all ${
                      selected
                        ? 'border-primary/40 bg-primary/5 text-foreground font-medium'
                        : 'border-border/40 hover:border-border hover:bg-accent/20 text-muted-foreground'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                        selected ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                      }`}>
                        {selected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </div>
                      <span>{opt.label}</span>
                    </div>
                  </button>
                )
              })}
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={currentQ === 0}
              onClick={() => setCurrentQ((q) => q - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {currentQ < questions.length - 1 ? (
              <Button
                className="flex-1"
                disabled={answers[currentQuestion.id] === undefined}
                onClick={() => setCurrentQ((q) => q + 1)}
              >
                Próxima
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                className="flex-1"
                disabled={!allAnswered}
                onClick={handleSave}
              >
                <Zap className="h-4 w-4 mr-2" />
                {allAnswered ? 'Ver Resultados' : `${questions.length - Object.keys(answers).length} sem resposta`}
              </Button>
            )}
          </div>

          {/* Quick nav dots */}
          <div className="flex gap-1 justify-center flex-wrap">
            {questions.map((q, i) => (
              <button
                key={q.id}
                onClick={() => setCurrentQ(i)}
                className={`h-2 w-2 rounded-full transition-all ${
                  i === currentQ
                    ? 'bg-primary w-4'
                    : answers[q.id] !== undefined
                    ? 'bg-primary/40'
                    : 'bg-muted-foreground/20'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── STEP: FINALIZANDO ── */}
      {step === 'finalizando' && (
        <Card className="border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-4">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold">Calculando resultados...</p>
              <p className="text-sm text-muted-foreground mt-1">Preparando seu relatório de diagnóstico</p>
            </div>
            <div className="flex gap-1">
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse [animation-delay:200ms]" />
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse [animation-delay:400ms]" />
            </div>
            {savingTimeout && (
              <div className="space-y-2 pt-2">
                <p className="text-xs text-muted-foreground">Isso está demorando mais que o esperado...</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSaving(false)
                    setSavingTimeout(false)
                    setStep('questionario')
                    setError('Conexão lenta. Verifique sua internet e tente novamente.')
                  }}
                >
                  Cancelar e tentar novamente
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
