'use client'

import { useState } from 'react'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { DollarSign, TrendingUp, Zap, Info } from 'lucide-react'

interface CommissionConfig {
  aliquota_base: string
  acelerador_threshold: string
  acelerador_rate: string
  bonus_missao: string
  periodo: 'mensal' | 'quinzenal' | 'semanal'
  elegibilidade: string
}

export default function ComissionamentoConfigPage() {
  const { user } = useRequiredAuth()
  const [commission, setCommission] = useState<CommissionConfig>({
    aliquota_base: '4',
    acelerador_threshold: '110',
    acelerador_rate: '6',
    bonus_missao: '100',
    periodo: 'mensal',
    elegibilidade: '80',
  })


  const exampleRevenue = 25000
  const baseComm = Math.round(exampleRevenue * (parseFloat(commission.aliquota_base) / 100))
  const missionBonus = (parseFloat(commission.bonus_missao) || 0) * 3
  const totalCommExample = baseComm + missionBonus

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <DollarSign className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight">Configuração de Comissionamento</h2>
            <Badge variant="outline" className="text-[10px] h-5 px-2">
              Etapa 3
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Defina alíquotas, bônus e regras de apuração para toda a equipe
          </p>
        </div>
      </div>

      {/* Alíquota e Bônus */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Alíquota e Bônus</h3>
        </div>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Alíquota Base (%)</Label>
                <Input
                  type="number"
                  value={commission.aliquota_base}
                  onChange={(e) => setCommission((prev) => ({ ...prev, aliquota_base: e.target.value }))}
                  placeholder="Ex: 4"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Bônus por Missão Concluída (R$)</Label>
                <Input
                  type="number"
                  value={commission.bonus_missao}
                  onChange={(e) => setCommission((prev) => ({ ...prev, bonus_missao: e.target.value }))}
                  placeholder="Ex: 100"
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Acelerador */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Acelerador de Meta</h3>
        </div>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-4">
            <div className="rounded-lg border border-border/40 bg-accent/20 p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">Se atingir</span>
                <Input
                  type="number"
                  value={commission.acelerador_threshold}
                  onChange={(e) => setCommission((prev) => ({ ...prev, acelerador_threshold: e.target.value }))}
                  className="h-7 text-xs w-16"
                />
                <span className="text-xs text-muted-foreground">% da meta → alíquota sobe para</span>
                <Input
                  type="number"
                  value={commission.acelerador_rate}
                  onChange={(e) => setCommission((prev) => ({ ...prev, acelerador_rate: e.target.value }))}
                  className="h-7 text-xs w-16"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Período e Elegibilidade */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Apuração e Elegibilidade</h3>
        </div>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Período de Apuração</Label>
                <div className="flex gap-1.5">
                  {(['mensal', 'quinzenal', 'semanal'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setCommission((prev) => ({ ...prev, periodo: p }))}
                      className={`flex-1 text-xs py-1.5 rounded-md border transition-colors capitalize ${
                        commission.periodo === p
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border hover:bg-accent/40'
                      }`}
                    >
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Elegibilidade (% mínimo da meta)</Label>
                <Input
                  type="number"
                  value={commission.elegibilidade}
                  onChange={(e) => setCommission((prev) => ({ ...prev, elegibilidade: e.target.value }))}
                  placeholder="Ex: 80"
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-4 pb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">
            Exemplo de Comissão Este Mês
          </p>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Receita fechada (exemplo)</span>
              <span className="font-medium">R$ {exampleRevenue.toLocaleString('pt-BR')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Comissão base ({commission.aliquota_base}%)</span>
              <span className="font-medium">R$ {baseComm.toLocaleString('pt-BR')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bônus de missões (3 missões)</span>
              <span className="font-medium">R$ {missionBonus.toLocaleString('pt-BR')}</span>
            </div>
            <div className="flex justify-between border-t border-border/30 pt-1.5 mt-1.5">
              <span className="font-semibold">Total estimado</span>
              <span className="font-bold text-primary">R$ {totalCommExample.toLocaleString('pt-BR')}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Note */}
      <div className="rounded-lg border border-border/40 bg-muted/30 p-4">
        <div className="flex items-start gap-3">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            As regras se aplicam a toda a equipe. Para configurar valores individuais por vendedor,
            acesse o perfil do vendedor em <strong>Monitoramento → Performance da Equipe</strong>.
          </p>
        </div>
      </div>

      <Button className="w-full" onClick={() => toast.success('Comissionamento salvo com sucesso!')}>
        Salvar Configuração
      </Button>
    </div>
  )
}
