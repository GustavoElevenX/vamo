import { NextResponse } from 'next/server'
import { getAppUser, requireRole } from '@/lib/server/auth'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const auth = await getAppUser()
  if (auth.error) return auth.error

  const { adminClient, appUser } = auth
  const forbidden = requireRole(appUser.role, ['admin', 'manager', 'developer'])
  if (forbidden) return forbidden

  const url = new URL(request.url)
  const level = url.searchParams.get('level')
  const source = url.searchParams.get('source')
  const search = url.searchParams.get('search')

  let query = adminClient
    .from('system_logs')
    .select('*')
    .eq('organization_id', appUser.organization_id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (level && level !== 'all') query = query.eq('level', level)
  if (source && source !== 'all') query = query.eq('source', source)
  if (search) query = query.ilike('message', `%${search}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const logs = data ?? []
  const summary = logs.reduce(
    (acc, log: any) => {
      acc.total += 1
      acc[log.level as 'error' | 'warn' | 'info' | 'debug'] += 1
      return acc
    },
    { total: 0, error: 0, warn: 0, info: 0, debug: 0 }
  )

  const sources = Array.from(new Set(logs.map((log: any) => log.source))).sort()

  return NextResponse.json({ logs, summary, sources })
}
