import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'

export const runtime = 'nodejs'

function hasGoalContent(goal: any) {
  if (!goal) return false
  return Boolean(
    goal.company_goal?.valorMeta ||
    goal.company_goal?.kpiFinanceiro ||
    goal.team_goal?.valorMeta ||
    goal.team_goal?.kpiComportamental ||
    (Array.isArray(goal.individual_goals) && goal.individual_goals.some((item: any) => item.goal))
  )
}

export async function GET() {
  const auth = await getAppUser()
  if (auth.error) return auth.error

  const { adminClient, appUser } = auth

  const [goalsResult, missionsResult, rewardsResult, launchResult] = await Promise.all([
    adminClient
      .from('program_goals')
      .select('*')
      .eq('organization_id', appUser.organization_id)
      .maybeSingle(),
    adminClient
      .from('ai_missions')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', appUser.organization_id),
    adminClient
      .from('rewards_catalog')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', appUser.organization_id)
      .eq('active', true),
    adminClient
      .from('program_launches')
      .select('id, created_at')
      .eq('organization_id', appUser.organization_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (goalsResult.error) return NextResponse.json({ error: goalsResult.error.message }, { status: 500 })

  const steps = [
    {
      id: 'goals',
      title: 'Definir Metas',
      href: '/objetivos/metas',
      completed: hasGoalContent(goalsResult.data),
      evidence: goalsResult.data ? 'Metas salvas para empresa, time ou vendedores.' : 'Nenhuma meta salva ainda.',
      updatedAt: goalsResult.data?.updated_at ?? null,
    },
    {
      id: 'action_plan',
      title: 'Plano de Acao',
      href: '/objetivos/plano-acao',
      completed: (missionsResult.count ?? 0) > 0,
      evidence: `${missionsResult.count ?? 0} missoes criadas.`,
      updatedAt: null,
    },
    {
      id: 'rewards',
      title: 'Recompensas',
      href: '/objetivos/recompensas',
      completed: (rewardsResult.count ?? 0) > 0,
      evidence: `${rewardsResult.count ?? 0} recompensas ativas na loja.`,
      updatedAt: null,
    },
    {
      id: 'launch',
      title: 'Lancamento',
      href: '/objetivos/lancamento',
      completed: Boolean(launchResult.data),
      evidence: launchResult.data ? 'Programa lancado e comunicado no chat.' : 'Lancamento ainda nao registrado.',
      updatedAt: launchResult.data?.created_at ?? null,
    },
  ]

  const completed = steps.filter((step) => step.completed).length

  return NextResponse.json({
    steps,
    completed,
    total: steps.length,
    progress: Math.round((completed / steps.length) * 100),
  })
}
