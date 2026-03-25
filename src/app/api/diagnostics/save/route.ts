import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    // Autenticação
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { data: appUser } = await supabase
      .from('users')
      .select('id, organization_id')
      .eq('auth_id', authUser.id)
      .single()

    if (!appUser) {
      return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })
    }

    // Body
    const body = await req.json()
    const {
      respondent_name,
      total_score,
      max_score,
      health_pct,
      quadrant,
      area_scores,
      company_context,
      ai_qa,
    } = body

    if (!company_context || !ai_qa) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
    }

    // Insert into DB
    const { data: session, error: insertError } = await supabase
      .from('diagnostic_sessions')
      .insert({
        organization_id: appUser.organization_id,
        conducted_by: appUser.id,
        respondent_name,
        status: 'completed',
        total_score,
        max_score,
        health_pct,
        quadrant,
        area_scores,
        company_context,
        ai_qa,
        completed_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      console.error('Insert Error na API:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ id: session.id })
  } catch (error: any) {
    console.error('API /diagnostics/save error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
