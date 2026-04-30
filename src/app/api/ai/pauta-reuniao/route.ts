import { NextResponse } from 'next/server'
import { callOpenAIJSON } from '@/lib/services/openai.service'
import { getAppUser } from '@/lib/server/auth'
import { STAGE_STUCK_DAYS } from '@/types/crm'
import type { DealStage } from '@/types/crm'

export const runtime = 'nodejs'

type Pauta = {
  situacao_semana: string
  deals_criticos: Array<{ title: string; value: number; owner: string; reason: string; days_stuck: number }>
  atencao_vendedores: Array<{ name: string; issue: string; suggestion: string }>
  acao_gestor: string
}

function weekStart(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay() || 7
  d.setDate(d.getDate() - day + 1)
  return d.toISOString().slice(0, 10)
}

function daysSince(value: string | null) {
  if (!value) return 999
  return Math.floor((Date.now() - new Date(value).getTime()) / 86400000)
}

export async function POST() {
  try {
    const auth = await getAppUser()
    if (auth.error) return auth.error
    const { adminClient, appUser } = auth
    if (!['manager', 'admin'].includes(appUser.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const monthStart = new Date()
    monthStart.setDate(1)

    const [{ data: deals }, { data: kpis }, { data: alerts }, { data: briefing }] = await Promise.all([
      adminClient.from('crm_deals').select('title,value,stage,last_activity_at, owner:users!crm_deals_owner_id_fkey(name)').eq('organization_id', appUser.organization_id),
      adminClient.from('kpi_entries').select('user_id,value,users(name)').eq('organization_id', appUser.organization_id).gte('recorded_at', monthStart.toISOString().slice(0, 10)),
      adminClient.from('ai_alerts').select('title,message,severity,created_at').eq('organization_id', appUser.organization_id).order('created_at', { ascending: false }).limit(10),
      adminClient.from('weekly_briefings').select('content,created_at').eq('organization_id', appUser.organization_id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])

    const criticalDeals = (deals ?? [])
      .map((deal: any) => ({ ...deal, days_stuck: daysSince(deal.last_activity_at) }))
      .filter((deal: any) => deal.stage !== 'closed_won' && deal.stage !== 'closed_lost' && deal.days_stuck > (STAGE_STUCK_DAYS[deal.stage as DealStage] ?? 7))
      .slice(0, 8)

    const payload = {
      pipeline: deals,
      deals_criticos_por_inatividade: criticalDeals,
      kpis_mes: kpis,
      alertas: alerts,
      briefing_recente: briefing,
    }

    const { data, model } = await callOpenAIJSON<Pauta>({
      systemPrompt: 'Voce e VAMO IA. Gere uma pauta de reuniao de pipeline objetiva para o gestor comercial. Foque no que precisa de decisao AGORA. Nao repita dados obvios. Seja direto: o gestor tem 15 minutos de reuniao. Responda em portugues com JSON valido no schema: { situacao_semana: string, deals_criticos: [{ title, value, owner, reason, days_stuck }], atencao_vendedores: [{ name, issue, suggestion }], acao_gestor: string }.',
      userPrompt: JSON.stringify(payload),
      temperature: 0.2,
      maxTokens: 1200,
    })

    await adminClient.from('pauta_reunioes').upsert({
      organization_id: appUser.organization_id,
      created_by: appUser.id,
      week_start: weekStart(),
      content: data,
      model_used: model,
    }, { onConflict: 'organization_id,week_start' })

    return NextResponse.json({ pauta: data })
  } catch (error) {
    console.error('POST pauta-reuniao', error)
    return NextResponse.json({ error: 'Erro ao gerar pauta' }, { status: 500 })
  }
}
