'use client'

import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { User, Target, Trophy, Settings } from 'lucide-react'

const settingsSections = [
  { title: 'Perfil', description: 'Seus dados pessoais e avatar', href: '/configuracoes/perfil', icon: User },
  { title: 'KPIs', description: 'Configurar indicadores da equipe', href: '/configuracoes/kpis', icon: Target, roles: ['admin', 'manager'] },
  { title: 'Gamificação', description: 'Badges, desafios e recompensas', href: '/configuracoes/gamificacao', icon: Trophy, roles: ['admin', 'manager'] },
]

export default function ConfiguracoesPage() {
  const { user } = useAuth()

  if (!user) return null

  const visible = settingsSections.filter(
    (s) => !s.roles || s.roles.includes(user.role)
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Configurações</h2>
        <p className="text-muted-foreground">Gerencie sua conta e organização</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {visible.map((section) => {
          const Icon = section.icon
          return (
            <Link key={section.href} href={section.href}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-4 pt-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{section.title}</h3>
                    <p className="text-sm text-muted-foreground">{section.description}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
