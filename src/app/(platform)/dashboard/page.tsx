'use client'

import { useAuth } from '@/hooks/use-auth'
import { GestorDashboard } from '@/components/dashboard/gestor-dashboard'
import { VendedorDashboard } from '@/components/dashboard/vendedor-dashboard'

export default function DashboardPage() {
  const { user } = useAuth()

  if (!user) return null

  // Gestor (manager) sees Dashboard & ROI
  if (user.role === 'manager') {
    return <GestorDashboard user={user} />
  }

  // Admin sees gestor dashboard (they manage the platform)
  if (user.role === 'admin') {
    return <GestorDashboard user={user} />
  }

  // Vendedor (seller) sees Minha Performance
  return <VendedorDashboard user={user} />
}
