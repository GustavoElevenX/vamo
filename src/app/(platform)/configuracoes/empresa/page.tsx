'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Building2,
  Crown,
  Users,
  UserPlus,
  CheckCircle2,
  Mail,
  Shield,
  Sparkles,
  ArrowUpRight,
  Circle,
  Eye,
  EyeOff,
  AlertCircle,
} from 'lucide-react'

interface OrgUser {
  id: string
  name: string
  email: string
  role: string
  active: boolean
}

export default function EmpresaPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([])

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      const { data: users } = await supabase
        .from('users')
        .select('id, name, email, role, active')
        .eq('organization_id', user.organization_id)
        .order('role', { ascending: true })

      if (users) setOrgUsers(users as OrgUser[])
      setLoading(false)
    }

    fetchData().catch(() => setLoading(false))
  }, [user])

  if (!user) return null

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      </div>
    )
  }

  const roleConfig: Record<string, { label: string; color: string }> = {
    admin: { label: 'Admin', color: 'text-red-500 bg-red-500/10' },
    manager: { label: 'Gestor', color: 'text-violet-500 bg-violet-500/10' },
    seller: { label: 'Vendedor', color: 'text-emerald-500 bg-emerald-500/10' },
    developer: { label: 'Developer', color: 'text-blue-500 bg-blue-500/10' },
  }

  const planFeatures = [
    'Até 25 vendedores',
    'Missões com IA',
    'Diagnóstico completo',
    'Monitoramento de equipe',
    'Relatórios e ROI',
    'Comissionamento automático',
    'Alertas inteligentes',
    'Suporte prioritário',
  ]

  const openModal = () => {
    setName('')
    setEmail('')
    setPassword('')
    setError('')
    setSuccess('')
    setModalOpen(true)
  }

  const handleInvite = async () => {
    setError('')
    setSuccess('')

    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Preencha todos os campos.')
      return
    }

    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erro ao cadastrar vendedor.')
        return
      }

      // Add to local list immediately
      setOrgUsers((prev) => [...prev, data.user])
      setSuccess(`Vendedor ${data.user.name} cadastrado com sucesso! Já pode logar com o email e senha informados.`)
      setName('')
      setEmail('')
      setPassword('')
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  const onboardingSteps = orgUsers.filter((u) => u.role === 'seller').length > 0 ? 3 : 2
  const onboardingTotal = 5

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Empresa e Plano</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gerencie informações da empresa, plano e membros da equipe
        </p>
      </div>

      {/* Company Info */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-500" />
            Informações da Empresa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="p-3 rounded-lg bg-muted/50 border border-border/30">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Nome da Empresa</p>
              <p className="text-sm font-medium">GamePerformance Ltda.</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border border-border/30">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">CNPJ</p>
              <p className="text-sm font-medium">12.345.678/0001-99</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border border-border/30">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Setor</p>
              <p className="text-sm font-medium">Tecnologia / SaaS</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Plan */}
      <Card className="border-border/50 border-violet-500/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-500" />
              Plano Atual
            </CardTitle>
            <Badge className="bg-violet-500 text-white text-[10px]">Professional</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 mb-4">
            {planFeatures.map((feature) => (
              <div key={feature} className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span className="text-xs text-muted-foreground">{feature}</span>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" className="w-full sm:w-auto">
            <ArrowUpRight className="h-3.5 w-3.5 mr-1" />
            Upgrade para Enterprise
          </Button>
        </CardContent>
      </Card>

      {/* Onboarding Status */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            Progresso de Onboarding
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-2">
            <Progress
              value={(onboardingSteps / onboardingTotal) * 100}
              className="flex-1 h-2 [&>div]:bg-emerald-500"
            />
            <span className="text-xs font-medium text-muted-foreground shrink-0">
              {onboardingSteps} de {onboardingTotal} etapas
            </span>
          </div>
          <div className="space-y-2 mt-3">
            {[
              { label: 'Criar conta', done: true },
              { label: 'Configurar empresa', done: true },
              { label: 'Adicionar vendedores', done: orgUsers.filter((u) => u.role === 'seller').length > 0 },
              { label: 'Configurar KPIs', done: false },
              { label: 'Ativar missões com IA', done: false },
            ].map((step) => (
              <div key={step.label} className="flex items-center gap-2">
                {step.done ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />
                )}
                <span className={`text-xs ${step.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* User Management */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              Membros da Equipe
              <Badge variant="secondary" className="text-[10px]">{orgUsers.length}</Badge>
            </CardTitle>
            <Button size="sm" onClick={openModal}>
              <UserPlus className="h-3.5 w-3.5 mr-1" />
              Cadastrar Vendedor
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {orgUsers.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Users className="mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nenhum membro registrado.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Clique em "Cadastrar Vendedor" para adicionar sua equipe.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {orgUsers.map((member) => {
                const initials = member.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                const rc = roleConfig[member.role] ?? { label: member.role, color: 'text-muted-foreground bg-muted' }

                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border/30 hover:bg-accent/30 transition-colors"
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="text-xs bg-emerald-500/10 text-emerald-500">
                        {initials}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{member.name}</p>
                        <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${rc.color}`}>
                          <Shield className="h-2.5 w-2.5" />
                          {rc.label}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Mail className="h-2.5 w-2.5 text-muted-foreground/60" />
                        <span className="text-[10px] text-muted-foreground truncate">{member.email}</span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {member.active ? (
                        <Badge variant="secondary" className="text-[10px] text-emerald-500 bg-emerald-500/10">
                          Ativo
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] text-red-500 bg-red-500/10">
                          Inativo
                        </Badge>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-emerald-500" />
              Cadastrar Novo Vendedor
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <p className="text-xs text-muted-foreground">
              O vendedor poderá logar na plataforma imediatamente com o email e senha informados.
            </p>

            <div className="space-y-2">
              <Label htmlFor="invite-name" className="text-xs">Nome completo</Label>
              <Input
                id="invite-name"
                placeholder="Ex: João Silva"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-email" className="text-xs">Email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="vendedor@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-password" className="text-xs">Senha inicial</Label>
              <div className="relative">
                <Input
                  id="invite-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                O vendedor pode alterar a senha depois no perfil.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                <AlertCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                <p className="text-xs text-red-500">{error}</p>
              </div>
            )}

            {success && (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                <p className="text-xs text-emerald-600">{success}</p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setModalOpen(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={handleInvite}
                disabled={submitting}
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Cadastrando...
                  </span>
                ) : (
                  'Cadastrar Vendedor'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
