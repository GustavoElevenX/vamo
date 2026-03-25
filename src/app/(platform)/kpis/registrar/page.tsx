'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft } from 'lucide-react'
import type { KpiDefinition } from '@/types'

export default function RegistrarKpiPage() {
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [kpis, setKpis] = useState<KpiDefinition[]>([])
  const [selectedKpi, setSelectedKpi] = useState('')
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!user) return
    const fetch = async () => {
      const { data } = await supabase
        .from('kpi_definitions')
        .select('*')
        .eq('organization_id', user.organization_id)
        .eq('active', true)
        .order('name')
      setKpis(data ?? [])
    }
    fetch().catch(() => setLoading(false))
  }, [user])

  if (!user) return null

  const selectedDef = kpis.find((k) => k.id === selectedKpi)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDef || !value || submitting) return
    setSubmitting(true)

    const numValue = parseFloat(value)
    const pointsEarned = Math.floor(numValue * selectedDef.points_per_unit)

    // Insert KPI entry
    await supabase.from('kpi_entries').insert({
      organization_id: user.organization_id,
      user_id: user.id,
      kpi_id: selectedDef.id,
      value: numValue,
      points_earned: pointsEarned,
      recorded_at: new Date().toISOString(),
      source: 'manual',
    })

    // Award XP
    const response = await fetch('/api/gamification/award-xp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        organizationId: user.organization_id,
        amount: pointsEarned,
        sourceType: 'kpi',
        sourceId: selectedDef.id,
        description: `KPI: ${selectedDef.name} - ${numValue} ${selectedDef.unit}`,
      }),
    })

    // Check badges
    await fetch('/api/gamification/check-badges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        organizationId: user.organization_id,
      }),
    })

    router.push('/kpis')
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/kpis')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-2xl font-bold">Registrar KPI</h2>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>KPI</Label>
              <Select value={selectedKpi} onValueChange={(v) => v && setSelectedKpi(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um KPI" />
                </SelectTrigger>
                <SelectContent>
                  {kpis.map((kpi) => (
                    <SelectItem key={kpi.id} value={kpi.id}>
                      {kpi.name} ({kpi.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedDef && (
              <div className="space-y-2">
                <Label htmlFor="value">Valor ({selectedDef.unit})</Label>
                <Input
                  id="value"
                  type="number"
                  step="any"
                  min="0"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={`Ex: 5`}
                />
                {value && (
                  <p className="text-xs text-primary">
                    = +{Math.floor(parseFloat(value || '0') * selectedDef.points_per_unit)} pontos de XP
                  </p>
                )}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={!selectedKpi || !value || submitting}>
              {submitting ? 'Registrando...' : 'Registrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
