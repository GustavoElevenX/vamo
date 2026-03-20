'use client'

import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Sidebar } from './sidebar'
import type { UserRole } from '@/types'

interface MobileNavProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  role: UserRole
  userName?: string
}

export function MobileNav({ open, onOpenChange, role, userName }: MobileNavProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-56 p-0">
        <Sidebar role={role} userName={userName} onNavigate={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  )
}
