'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ArrowLeft, Users, ClipboardCheck, TrendingUp } from 'lucide-react'
import { ROLE_LABELS } from '@/lib/constants'
import type { Organization, User } from '@/types'

export default function ClienteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [org, setOrg] = useState<Organization | null>(null)
  const [members, setMembers] = useState<User[]>([])
  const [diagnosticCount, setDiagnosticCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !id) return
    const fetch = async () => {
      const [{ data: o }, { data: m }, { count }] = await Promise.all([
        supabase.from('organizations').select('*').eq('id', id).single(),
        supabase.from('users').select('*').eq('organization_id', id).order('name'),
        supabase.from('diagnostic_sessions').select('*', { count: 'exact', head: true }).eq('organization_id', id),
      ])
      setOrg(o)
      setMembers(m ?? [])
      setDiagnosticCount(count ?? 0)
      setLoading(false)
    }
    fetch()
  }, [user, id])

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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/admin/clientes')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold">{org.name}</h2>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="capitalize">{org.plan}</Badge>
            <Badge variant={org.active ? 'default' : 'secondary'}>{org.active ? 'Ativo' : 'Inativo'}</Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{members.length}</p>
              <p className="text-xs text-muted-foreground">Membros</p>
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
            <div
              className="h-8 w-8 rounded-full"
              style={{ backgroundColor: org.primary_color }}
            />
            <div>
              <p className="text-sm font-medium">{org.primary_color}</p>
              <p className="text-xs text-muted-foreground">Cor primária</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Membros da Equipe</CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum membro cadastrado.</p>
          ) : (
            <div className="space-y-3">
              {members.map((m) => {
                const initials = m.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                return (
                  <div key={m.id} className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.email}</p>
                    </div>
                    <Badge variant="outline">{ROLE_LABELS[m.role]}</Badge>
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
