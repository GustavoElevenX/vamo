import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { adminClient, appUser } = auth
  const q = new URL(request.url).searchParams.get('q')?.trim()

  let query = adminClient
    .from('crm_accounts')
    .select('*, oportunidades:crm_deals(id,value,stage)')
    .eq('organization_id', appUser.organization_id)
    .order('name')
  if (q) query = query.ilike('name', `%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ accounts: data ?? [] })
}

export async function POST(request: Request) {
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { adminClient, appUser } = auth
  const input = await request.json()
  const name = String(input.name ?? '').trim()
  if (!name) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })

  const { data, error } = await adminClient
    .from('crm_accounts')
    .insert({
      organization_id: appUser.organization_id,
      name,
      cnpj: input.cnpj || null,
      segment: input.segment || null,
      website: input.website || null,
      notes: input.notes || null,
      created_by: appUser.id,
    })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ account: data }, { status: 201 })
}
