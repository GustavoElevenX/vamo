'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import type { KpiDefinition } from '@/types'

export default function ConfigKpisPage() {
  const { user } = useAuth()
  const supabase = createClient()

  const [kpis, setKpis] = useState<KpiDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingKpi, setEditingKpi] = useState<KpiDefinition | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formUnit, setFormUnit] = useState('')
  const [formPoints, setFormPoints] = useState('10')
  const [formDaily, setFormDaily] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    fetchKpis()
  }, [user])

  const fetchKpis = async () => {
    if (!user) return
    const { data } = await supabase
      .from('kpi_definitions')
      .select('*')
      .eq('organization_id', user.organization_id)
      .order('name')
    setKpis(data ?? [])
    setLoading(false)
  }

  if (!user) return null

  const openCreate = () => {
    setEditingKpi(null)
    setFormName('')
    setFormUnit('')
    setFormPoints('10')
    setFormDaily('')
    setDialogOpen(true)
  }

  const openEdit = (kpi: KpiDefinition) => {
    setEditingKpi(kpi)
    setFormName(kpi.name)
    setFormUnit(kpi.unit)
    setFormPoints(String(kpi.points_per_unit))
    setFormDaily(kpi.targets?.daily ? String(kpi.targets.daily) : '')
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!user || saving) return
    setSaving(true)

    const slug = formName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    const targets = formDaily ? { daily: parseInt(formDaily) } : null

    if (editingKpi) {
      await supabase
        .from('kpi_definitions')
        .update({ name: formName, slug, unit: formUnit, points_per_unit: parseInt(formPoints), targets })
        .eq('id', editingKpi.id)
    } else {
      await supabase.from('kpi_definitions').insert({
        organization_id: user.organization_id,
        name: formName,
        slug,
        unit: formUnit,
        points_per_unit: parseInt(formPoints),
        targets,
        active: true,
      })
    }

    setSaving(false)
    setDialogOpen(false)
    fetchKpis()
  }

  const handleToggle = async (kpi: KpiDefinition) => {
    await supabase
      .from('kpi_definitions')
      .update({ active: !kpi.active })
      .eq('id', kpi.id)
    fetchKpis()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Configurar KPIs</h2>
          <p className="text-muted-foreground">Indicadores de performance da equipe</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button />} onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Novo KPI
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingKpi ? 'Editar KPI' : 'Novo KPI'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ex: Ligações Realizadas" />
              </div>
              <div className="space-y-2">
                <Label>Unidade</Label>
                <Input value={formUnit} onChange={(e) => setFormUnit(e.target.value)} placeholder="Ex: ligações" />
              </div>
              <div className="space-y-2">
                <Label>Pontos por Unidade</Label>
                <Input type="number" value={formPoints} onChange={(e) => setFormPoints(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Meta Diária (opcional)</Label>
                <Input type="number" value={formDaily} onChange={(e) => setFormDaily(e.target.value)} placeholder="Ex: 20" />
              </div>
              <Button onClick={handleSave} disabled={!formName || !formUnit || saving} className="w-full">
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : kpis.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              Nenhum KPI configurado ainda.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Pts/Un</TableHead>
                  <TableHead>Meta Diária</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kpis.map((kpi) => (
                  <TableRow key={kpi.id}>
                    <TableCell className="font-medium">{kpi.name}</TableCell>
                    <TableCell>{kpi.unit}</TableCell>
                    <TableCell>{kpi.points_per_unit}</TableCell>
                    <TableCell>{kpi.targets?.daily ?? '-'}</TableCell>
                    <TableCell>
                      <Badge
                        variant={kpi.active ? 'default' : 'secondary'}
                        className="cursor-pointer"
                        onClick={() => handleToggle(kpi)}
                      >
                        {kpi.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(kpi)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
