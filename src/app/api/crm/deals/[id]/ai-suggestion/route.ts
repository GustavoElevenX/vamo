import { NextResponse } from 'next/server'
import { callOpenAIJSON } from '@/lib/services/openai.service'
import { getAppUser } from '@/lib/server/auth'
import { DEFAULT_PLAYBOOK_STEPS } from '@/lib/crm/default-playbook'
import type { DealStage } from '@/types/crm'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }
type Suggestion = { suggestion: string; urgency: 'low' | 'medium' | 'high' }

export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params
    const auth = await getAppUser()
    if (auth.error) return auth.error
    const { adminClient, appUser } = auth

    let query = adminClient
      .from('crm_deals')
      .select('*, account:crm_accounts(name), owner:users!crm_deals_owner_id_fkey(name), activities:crm_activities(type,title,outcome,occurred_at)')
      .eq('id', id)
      .eq('organization_id', appUser.organization_id)
    if (appUser.role === 'seller') query = query.eq('owner_id', appUser.id)
    const { data: deal, error } = await query.single()
    if (error || !deal) return NextResponse.json({ error: 'oportunidade não encontrado' }, { status: 404 })

    const { data: steps } = await adminClient
      .from('playbook_steps')
      .select('title, description, is_required')
      .eq('organization_id', appUser.organization_id)
      .eq('stage', deal.stage)
      .order('order_index')

    const playbook = steps?.length ? steps : (DEFAULT_PLAYBOOK_STEPS[deal.stage as DealStage] ?? []).map((title) => ({ title }))

    const { data } = await callOpenAIJSON<Suggestion>({
      systemPrompt: 'Você é VAMO IA, assistente de vendas consultivo. Analise o oportunidade e sugira o próximo passo mais importante em 1-2 frases. Seja direto, específico e acionável. Responda em portugues. Retorne JSON: { "suggestion": string, "urgency": "low" | "medium" | "high" }',
      userPrompt: JSON.stringify({ deal, recent_activities: deal.activities?.slice(-6), playbook }),
      temperature: 0.2,
      maxTokens: 450,
    })

    return NextResponse.json({
      suggestion: data.suggestion || 'Revise o histórico da oportunidade e combine um próximo passo claro com data.',
      urgency: ['low', 'medium', 'high'].includes(data.urgency) ? data.urgency : 'medium',
    })
  } catch (error) {
    console.error('POST ai-suggestion', error)
    return NextResponse.json({
      suggestion: 'Revise o histórico da oportunidade e combine um próximo passo claro com data.',
      urgency: 'medium',
    })
  }
}
