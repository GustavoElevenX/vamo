'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useRequiredAuth } from '@/hooks/use-required-auth'

export default function FeedbackIAPage() {
  const { user } = useRequiredAuth()
  const router = useRouter()

  useEffect(() => {
    if (!user) return
    if (user.role === 'seller') {
      router.replace('/desenvolvimento/pdi')
      return
    }
    if (['manager', 'admin', 'developer'].includes(user.role)) {
      router.replace('/monitoramento/desenvolvimento')
      return
    }
    router.replace('/hoje')
  }, [user, router])

  return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
    </div>
  )
}
