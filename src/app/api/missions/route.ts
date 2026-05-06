import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'

export const runtime = 'nodejs'

const MISSION_TYPES = ['activity', 'kpi_target', 'pipeline_cleanup', 'revenue_target', 'manual_validation', 'pdi', 'recognition']
const VERIFICATION_TYPES = ['automatic', 'manual', 'hybrid']

function num(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export async function GET(request: Request) {
  try {
    const auth = await getAppUser()
    if (auth.error) return auth.error
    const { adminClient, appUser } = auth
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const userId = searchParams.get('user_id')

    if (!['manager', 'admin', 'developer', 'consultant'].includes(appUser.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    let query = adminClient
      .from('ai_missions')
      .select('*, user:users(id,name,avatar_url), kpi:kpi_definitions(id,name,unit,source_event)')
      .eq('organization_id', appUser.organization_id)
      .order('created_at', { ascending: false })

    if (status && status !== 'all') query = query.eq('status', status)
    if (userId && userId !== 'all') query = query.eq('user_id', userId)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ missions: data ?? [] })
  } catch (error) {
    console.error('GET /api/missions', error)
    return NextResponse.json({ error: 'Erro ao carregar missoes' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAppUser()
    if (auth.error) return auth.error
    const { adminClient, appUser } = auth

    if (!['manager', 'admin', 'developer'].includes(appUser.role)) {
      return NextResponse.json({ error: 'Apenas gestor pode criar missoes' }, { status: 403 })
    }

    const input = await request.json()
    const title = String(input.title ?? '').trim()
    const userId = String(input.userId || input.user_id || '')
    const type = MISSION_TYPES.includes(input.type) ? String(input.type) : 'kpi_target'
    const verificationType = VERIFICATION_TYPES.includes(input.verificationType || input.verification_type)
      ? String(input.verificationType || input.verification_type)
      : type === 'manual_validation'
        ? 'manual'
        : 'automatic'
    const targetValue = num(input.targetValue ?? input.target_value, type === 'manual_validation' ? 1 : 0)
    const criteria = typeof input.criteria === 'object' && input.criteria
      ? input.criteria
      : {
          type,
          target_value: targetValue,
          source_event: input.sourceEvent || input.source_event || null,
        }

    if (!title || !userId) {
      return NextResponse.json({ error: 'Titulo e vendedor sao obrigatorios' }, { status: 400 })
    }

    if (!['manual_validation', 'pdi', 'recognition'].includes(type) && targetValue <= 0) {
      return NextResponse.json({ error: 'Missao automatica precisa de meta numerica' }, { status: 400 })
    }

    const { data: seller } = await adminClient
      .from('users')
      .select('id')
      .eq('id', userId)
      .eq('organization_id', appUser.organization_id)
      .eq('active', true)
      .maybeSingle()

    if (!seller) return NextResponse.json({ error: 'Vendedor nao encontrado' }, { status: 404 })

    const { data, error } = await adminClient
      .from('ai_missions')
      .insert({
        organization_id: appUser.organization_id,
        user_id: userId,
        created_by: appUser.id,
        title,
        description: input.description || title,
        area: input.area || 'sales_process',
        difficulty: num(input.difficulty, 2),
        xp_reward: num(input.xpReward ?? input.xp_reward, 100),
        status: 'pending',
        type,
        kpi_id: input.kpiId || input.kpi_id || null,
        target_value: targetValue,
        current_value: num(input.currentValue ?? input.current_value, 0),
        deadline: input.deadline || null,
        verification_type: verificationType,
        criteria,
        playbook_content: input.playbookContent || input.playbook_content || null,
      })
      .select('*, user:users(id,name), kpi:kpi_definitions(id,name,unit,source_event)')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ mission: data }, { status: 201 })
  } catch (error) {
    console.error('POST /api/missions', error)
    return NextResponse.json({ error: 'Erro ao criar missao' }, { status: 500 })
  }
}
