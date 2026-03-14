import { create } from 'zustand'
import type { Organization } from '@/types'

interface OrgState {
  organization: Organization | null
  setOrganization: (org: Organization | null) => void
}

export const useOrgStore = create<OrgState>((set) => ({
  organization: null,
  setOrganization: (organization) => set({ organization }),
}))
