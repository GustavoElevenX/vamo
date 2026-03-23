'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { APP_NAME, DEFAULT_XP_LEVELS } from '@/lib/constants'
import { Building2 } from 'lucide-react'

export default function OnboardingPage() {
  const [orgName, setOrgName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const slugify = (text: string) =>
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Create organization
      const slug = slugify(orgName) + '-' + Math.random().toString(36).slice(2, 6)
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({ name: orgName, slug })
        .select()
        .single()

      if (orgError) throw orgError

      // Update user with org
      const { error: userError } = await supabase
        .from('users')
        .update({ organization_id: org.id, role: 'admin' })
        .eq('auth_id', user.id)

      if (userError) throw userError

      // Seed default XP levels for this org
      const levels = DEFAULT_XP_LEVELS.map(l => ({ ...l, organization_id: org.id }))
      await supabase.from('xp_levels').insert(levels)

      // Create user_xp record
      const { data: userProfile } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single()

      if (userProfile) {
        await supabase.from('user_xp').insert({
          user_id: userProfile.id,
          organization_id: org.id,
        })
      }

      router.push('/dashboard')
      router.refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao criar organização'
      setError(message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="h-auto w-auto flex items-center justify-center">
              <img src="/logo.png" alt="Logo" className="h-12 object-contain" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">{APP_NAME}</h1>
          <p className="text-muted-foreground">Bem-vindo! Vamos configurar sua organização.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Criar Organização
            </CardTitle>
            <CardDescription>
              Esta será a empresa ou cliente que você vai gerenciar na plataforma.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orgName">Nome da organização</Label>
                <Input
                  id="orgName"
                  type="text"
                  placeholder="Ex: Empresa ABC Ltda"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  required
                  minLength={3}
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button type="submit" className="w-full" disabled={loading || !orgName.trim()}>
                {loading ? 'Criando...' : 'Criar e continuar →'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
