'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  ArrowLeft,
  Users,
  ClipboardCheck,
  Edit2,
  Save,
  X,
  Plus,
  UserPlus,
  Loader2,
  Power,
} from 'lucide-react'
import { ROLE_LABELS } from '@/lib/constants'
import { toast } from 'sonner'
import type { Organization, User, UserRole } from '@/types'

export default function ClienteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [org, setOrg] = useState<Organization | null>(null)
  const [members, setMembers] = useState<User[]>([])
  const [diagnosticCount, setDiagnosticCount] = useState(0)
  const [loading, setLoading] = useState(true)

  // Edit org state
  const [editingOrg, setEditingOrg] = useState(false)
  const [orgName, setOrgName] = useState('')
  const [orgPlan, setOrgPlan] = useState('')
  const [orgColor, setOrgColor] = useState('')
  const [orgActive, setOrgActive] = useState(true)
  const [savingOrg, setSavingOrg] = useState(false)

  // Add user state
  const [showAddUser, setShowAddUser] = useState(false)
  const [newUserName, setNewUserName] = useState('')
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserRole, setNewUserRole] = useState<UserRole>('seller')
  const [addingUser, setAddingUser] = useState(false)

  // User action state
  const [actionUserId, setActionUserId] = useState<string | null>(null)

  const fetchData = async () => {
    const [{ data: o }, { data: m }, { count }] = await Promise.all([
      supabase.from('organizations').select('*').eq('id', id).single(),
      supabase.from('users').select('*').eq('organization_id', id).order('name'),
      supabase.from('diagnostic_sessions').select('*', { count: 'exact', head: true }).eq('organization_id', id),
    ])
    setOrg(o)
    setMembers(m ?? [])
    setDiagnosticCount(count ?? 0)
    if (o) {
      setOrgName(o.name)
      setOrgPlan(o.plan)
      setOrgColor(o.primary_color)
      setOrgActive(o.active)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!user || !id) return
    fetchData()
  }, [user, id])

  const handleSaveOrg = async () => {
    if (!org || !orgName.trim()) return
    setSavingOrg(true)
    const { error } = await supabase
      .from('organizations')
      .update({
        name: orgName.trim(),
        plan: orgPlan,
        primary_color: orgColor,
        active: orgActive,
      })
      .eq('id', org.id)

    if (error) {
      toast.error('Erro ao salvar organização')
    } else {
      toast.success('Organização atualizada')
      setOrg((prev) => prev ? { ...prev, name: orgName.trim(), plan: orgPlan as any, primary_color: orgColor, active: orgActive } : prev)
      setEditingOrg(false)
    }
    setSavingOrg(false)
  }

  const handleCancelEdit = () => {
    if (!org) return
    setOrgName(org.name)
    setOrgPlan(org.plan)
    setOrgColor(org.primary_color)
    setOrgActive(org.active)
    setEditingOrg(false)
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUserName.trim() || !newUserEmail.trim() || !org) return
    setAddingUser(true)

    const { error } = await supabase.from('users').insert({
      auth_id: crypto.randomUUID(),
      organization_id: org.id,
      name: newUserName.trim(),
      email: newUserEmail.trim().toLowerCase(),
      role: newUserRole,
      active: true,
    })

    if (error) {
      toast.error('Erro ao adicionar usuário: ' + error.message)
    } else {
      toast.success(`Usuário ${newUserName} adicionado`)
      setNewUserName('')
      setNewUserEmail('')
      setNewUserRole('seller')
      setShowAddUser(false)
      await fetchData()
    }
    setAddingUser(false)
  }

  const handleChangeRole = async (userId: string, newRole: UserRole) => {
    setActionUserId(userId)
    const { error } = await supabase
      .from('users')
      .update({ role: newRole })
      .eq('id', userId)

    if (error) {
      toast.error('Erro ao alterar cargo')
    } else {
      toast.success('Cargo atualizado')
      setMembers((prev) => prev.map((m) => m.id === userId ? { ...m, role: newRole } : m))
    }
    setActionUserId(null)
  }

  const handleToggleUserActive = async (userId: string, currentActive: boolean) => {
    setActionUserId(userId)
    const { error } = await supabase
      .from('users')
      .update({ active: !currentActive })
      .eq('id', userId)

    if (error) {
      toast.error('Erro ao alterar status do usuário')
    } else {
      toast.success(currentActive ? 'Usuário desativado' : 'Usuário ativado')
      setMembers((prev) => prev.map((m) => m.id === userId ? { ...m, active: !currentActive } : m))
    }
    setActionUserId(null)
  }

  if (!user) return null

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!org) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Cliente não encontrado</h2>
        <Button variant="outline" onClick={() => router.push('/admin/clientes')}>Voltar</Button>
      </div>
    )
  }

  const activeMembers = members.filter((m) => m.active).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/admin/clientes')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold truncate">{org.name}</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="capitalize">{org.plan}</Badge>
            <Badge variant={org.active ? 'default' : 'secondary'}>{org.active ? 'Ativo' : 'Inativo'}</Badge>
          </div>
        </div>
        {!editingOrg && (
          <Button variant="outline" size="sm" onClick={() => setEditingOrg(true)}>
            <Edit2 className="mr-1 h-3 w-3" />
            Editar
          </Button>
        )}
      </div>

      {/* Edit Org Form */}
      {editingOrg && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Editar Organização</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Plano</Label>
                <Select value={orgPlan} onValueChange={(v) => v && setOrgPlan(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cor Primária</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={orgColor}
                    onChange={(e) => setOrgColor(e.target.value)}
                    className="h-10 w-14 cursor-pointer p-1"
                  />
                  <Input value={orgColor} onChange={(e) => setOrgColor(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={orgActive ? 'active' : 'inactive'} onValueChange={(v) => setOrgActive(v === 'active')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button size="sm" onClick={handleSaveOrg} disabled={savingOrg || !orgName.trim()}>
                {savingOrg ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
                Salvar
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                <X className="mr-1 h-3 w-3" />
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{activeMembers}</p>
              <p className="text-xs text-muted-foreground">Ativos / {members.length} total</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <ClipboardCheck className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{diagnosticCount}</p>
              <p className="text-xs text-muted-foreground">Diagnósticos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="h-8 w-8 rounded-full border" style={{ backgroundColor: org.primary_color }} />
            <div>
              <p className="text-sm font-medium">{org.primary_color}</p>
              <p className="text-xs text-muted-foreground">Cor primária</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Management */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Membros da Equipe</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setShowAddUser(!showAddUser)}>
            <UserPlus className="mr-1 h-3 w-3" />
            Adicionar Usuário
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add User Form */}
          {showAddUser && (
            <form onSubmit={handleAddUser} className="rounded-lg border p-4 space-y-3 bg-muted/30">
              <p className="text-sm font-medium">Novo Usuário</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs">Nome</Label>
                  <Input
                    placeholder="Nome completo"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email</Label>
                  <Input
                    type="email"
                    placeholder="email@empresa.com"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cargo</Label>
                  <Select value={newUserRole} onValueChange={(v) => v && setNewUserRole(v as UserRole)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="seller">Vendedor</SelectItem>
                      <SelectItem value="manager">Gestor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={addingUser || !newUserName || !newUserEmail}>
                  {addingUser ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
                  Adicionar
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setShowAddUser(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          )}

          {/* User List */}
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum membro cadastrado.</p>
          ) : (
            <div className="divide-y">
              {members.map((m) => {
                const initials = m.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                const isLoading = actionUserId === m.id
                return (
                  <div
                    key={m.id}
                    className={`flex items-center gap-3 py-2 transition-opacity ${!m.active ? 'opacity-50' : ''}`}
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Select
                        value={m.role}
                        onValueChange={(v) => v && handleChangeRole(m.id, v as UserRole)}
                        disabled={isLoading}
                      >
                        <SelectTrigger className="h-7 w-28 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="seller">Vendedor</SelectItem>
                          <SelectItem value="manager">Gestor</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleToggleUserActive(m.id, m.active)}
                        disabled={isLoading}
                        title={m.active ? 'Desativar usuário' : 'Ativar usuário'}
                      >
                        {isLoading
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <Power className={`h-3 w-3 ${m.active ? 'text-green-500' : 'text-muted-foreground'}`} />
                        }
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
