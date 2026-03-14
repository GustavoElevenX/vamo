'use client'

import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Sidebar } from './sidebar'
import { APP_NAME } from '@/lib/constants'
import type { UserRole } from '@/types'

interface MobileNavProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  role: UserRole
}

export function MobileNav({ open, onOpenChange, role }: MobileNavProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-64 p-0">
        <div className="border-b p-4">
          <h2 className="text-lg font-bold">{APP_NAME}</h2>
        </div>
        <Sidebar role={role} onNavigate={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  )
}
