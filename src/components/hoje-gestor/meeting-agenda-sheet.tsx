'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Copy, Sparkles } from 'lucide-react'

type Pauta = {
  situacao_semana: string
  deals_criticos: Array<{ title: string; value: number; owner: string; reason: string; days_stuck: number }>
  atencao_vendedores: Array<{ name: string; issue: string; suggestion: string }>
  acao_gestor: string
}

export function MeetingAgendaSheet() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pauta, setPauta] = useState<Pauta | null>(null)
  const [error, setError] = useState<string | null>(null)

  const text = useMemo(() => {
    if (!pauta) return ''
    return [
      'Pauta VAMO',
      '',
      `Situacao: ${pauta.situacao_semana}`,
      '',
      'Deals criticos:',
      ...(pauta.deals_criticos || []).map((deal) => `- ${deal.title} (${deal.owner}): ${deal.reason}`),
      '',
      'Atencao vendedores:',
      ...(pauta.atencao_vendedores || []).map((seller) => `- ${seller.name}: ${seller.issue}. ${seller.suggestion}`),
      '',
      `Acao do gestor: ${pauta.acao_gestor}`,
    ].join('\n')
  }, [pauta])

  async function generate() {
    setOpen(true)
    setLoading(true)
    setError(null)
    const res = await fetch('/api/ai/pauta-reuniao', { method: 'POST' })
    const body = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) {
      setError(body.error || 'Erro ao gerar pauta')
      return
    }
    setPauta(body.pauta)
  }

  return (
    <>
      <Button onClick={generate} disabled={loading}>
        <Sparkles className="h-4 w-4" />
        {loading ? 'Gerando...' : 'Gerar pauta'}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Pauta de reuniao</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 px-4">
            {loading && <p className="text-sm text-muted-foreground">A VAMO IA esta consolidando pipeline, alertas e KPIs reais.</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
            {pauta && (
              <>
                <section className="rounded-lg border p-3">
                  <Badge variant="secondary">Situacao</Badge>
                  <p className="mt-2 text-sm leading-relaxed">{pauta.situacao_semana}</p>
                </section>
                {!!pauta.deals_criticos?.length && (
                  <section className="rounded-lg border p-3">
                    <Badge variant="destructive">Deals criticos</Badge>
                    <div className="mt-3 space-y-2">
                      {pauta.deals_criticos.map((deal, index) => (
                        <p key={`${deal.title}-${index}`} className="text-sm">
                          <span className="font-medium">{deal.title}</span> - {deal.owner}: {deal.reason}
                        </p>
                      ))}
                    </div>
                  </section>
                )}
                {!!pauta.atencao_vendedores?.length && (
                  <section className="rounded-lg border p-3">
                    <Badge variant="outline">Atencao</Badge>
                    <div className="mt-3 space-y-2">
                      {pauta.atencao_vendedores.map((seller, index) => (
                        <p key={`${seller.name}-${index}`} className="text-sm">
                          <span className="font-medium">{seller.name}</span>: {seller.issue}. {seller.suggestion}
                        </p>
                      ))}
                    </div>
                  </section>
                )}
                <section className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <Badge>Acao do gestor</Badge>
                  <p className="mt-2 text-sm font-medium leading-relaxed">{pauta.acao_gestor}</p>
                </section>
              </>
            )}
          </div>
          <SheetFooter>
            <Button variant="outline" disabled={!pauta} onClick={() => navigator.clipboard.writeText(text)}>
              <Copy className="h-4 w-4" />
              Copiar pauta
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
