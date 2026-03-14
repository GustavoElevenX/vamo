'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft } from 'lucide-react'
import type { Playbook } from '@/types'

export default function PlaybookDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [playbook, setPlaybook] = useState<Playbook | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !id) return
    const fetch = async () => {
      const { data } = await supabase
        .from('playbooks')
        .select('*')
        .eq('id', id)
        .single()
      setPlaybook(data)
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

  if (!playbook) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Playbook não encontrado</h2>
        <Button variant="outline" onClick={() => router.push('/padronizacao')}>Voltar</Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/padronizacao')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold">{playbook.title}</h2>
          <Badge variant="outline">{playbook.category}</Badge>
        </div>
      </div>

      <Card>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none pt-6">
          <div className="whitespace-pre-wrap">{playbook.content}</div>
        </CardContent>
      </Card>
    </div>
  )
}
