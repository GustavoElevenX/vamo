'use client'

import { useAuth } from './use-auth'
import type { User } from '@/types'

/**
 * Use in platform pages where the layout guarantees user is authenticated.
 * Returns user as non-null to avoid redundant null checks.
 */
export function useRequiredAuth(): { user: User; signOut: () => Promise<void> } {
  const { user, signOut } = useAuth()
  return { user: user!, signOut }
}
