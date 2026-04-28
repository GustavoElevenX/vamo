import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildPerformanceInsight } from '@/lib/services/performance-insights.service'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const adminClient = createAdminClient()
    const { data: appUser } = await adminClient
      .from('users')
      .select('id, organization_id')
      .eq('auth_id', authUser.id)
      .single()

    if (!appUser?.organization_id) {
      return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })
    }

    const insight = await buildPerformanceInsight({
      adminClient,
      organizationId: appUser.organization_id,
    })

    return NextResponse.json({ insight })
  } catch (error) {
    console.error('API /ai/performance-insights error:', error)
    return NextResponse.json({ error: 'Erro ao gerar insight de performance' }, { status: 500 })
  }
}
