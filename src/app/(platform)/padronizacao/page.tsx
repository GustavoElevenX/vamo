'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BookOpen, CheckSquare } from 'lucide-react'
import type { Playbook, ChecklistTemplate } from '@/types'

export default function PadronizacaoPage() {
  const { user } = useAuth()
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [checklists, setChecklists] = useState<ChecklistTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!user) return
    const fetch = async () => {
      const [{ data: pb }, { data: cl }] = await Promise.all([
        supabase
          .from('playbooks')
          .select('*')
          .eq('organization_id', user.organization_id)
          .order('order_index'),
        supabase
          .from('checklist_templates')
          .select('*')
          .eq('organization_id', user.organization_id)
          .eq('active', true)
          .order('title'),
      ])
      setPlaybooks(pb ?? [])
      setChecklists(cl ?? [])
      setLoading(false)
    }
    fetch()
  }, [user])

  if (!user) return null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Padronização</h2>
        <p className="text-muted-foreground">Playbooks e checklists da equipe</p>
      </div>

      <Tabs defaultValue="playbooks">
        <TabsList>
          <TabsTrigger value="playbooks">
            <BookOpen className="mr-2 h-4 w-4" />
            Playbooks
          </TabsTrigger>
          <TabsTrigger value="checklists">
            <CheckSquare className="mr-2 h-4 w-4" />
            Checklists
          </TabsTrigger>
        </TabsList>

        <TabsContent value="playbooks" className="mt-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : playbooks.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BookOpen className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">Nenhum playbook cadastrado.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {playbooks.map((pb) => (
                <Card key={pb.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{pb.title}</CardTitle>
                      <span className="text-xs text-muted-foreground">{pb.category}</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {pb.content.slice(0, 120)}...
                    </p>
                    <Button variant="outline" size="sm" className="mt-3" render={<Link href={`/padronizacao/${pb.id}`} />}>
                      Ler Playbook
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="checklists" className="mt-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : checklists.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckSquare className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">Nenhum checklist cadastrado.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {checklists.map((cl) => (
                <Card key={cl.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{cl.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{cl.items.length} itens</span>
                      <span>{cl.frequency === 'daily' ? 'Diário' : cl.frequency === 'weekly' ? 'Semanal' : 'Mensal'}</span>
                      <span className="text-primary font-medium">+{cl.xp_reward} XP</span>
                    </div>
                    <Button variant="outline" size="sm" className="mt-3" render={<Link href={`/padronizacao/checklists?id=${cl.id}`} />}>
                      Preencher
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
