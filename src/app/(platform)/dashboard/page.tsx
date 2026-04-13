'use client'

import { useRequiredAuth } from '@/hooks/use-required-auth'
import { GestorDashboard } from '@/components/dashboard/gestor-dashboard'
import { VendedorDashboard } from '@/components/dashboard/vendedor-dashboard'

export default function DashboardPage() {
  const { user } = useRequiredAuth()


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
