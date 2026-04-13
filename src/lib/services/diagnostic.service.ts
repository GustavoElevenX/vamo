import type { DiagnosticArea, DiagnosticQuadrant } from '@/types'
import { DIAGNOSTIC_QUADRANTS } from '@/lib/constants'

interface AreaScore {
  score: number
  max: number
  pct: number
}

export function calculateDiagnosticScores(
  answers: { area: DiagnosticArea; score: number; weight: number }[]
): {
  totalScore: number
  maxScore: number
  healthPct: number
  quadrant: DiagnosticQuadrant
  areaScores: Record<DiagnosticArea, AreaScore>
} {
  const areas: DiagnosticArea[] = ['lead_generation', 'sales_process', 'team_management', 'tools_technology']

  const defaultAreaScore: AreaScore = { score: 0, max: 0, pct: 0 }
  const defaultResult = {
    totalScore: 0,
    maxScore: 0,
    healthPct: 0,
    quadrant: 'critical' as DiagnosticQuadrant,
    areaScores: Object.fromEntries(areas.map((a) => [a, { ...defaultAreaScore }])) as Record<DiagnosticArea, AreaScore>,
  }

  if (!answers || !Array.isArray(answers) || answers.length === 0) {
    return defaultResult
  }

  try {
    const areaScores = {} as Record<DiagnosticArea, AreaScore>
    let totalScore = 0
    let maxScore = 0

    for (const area of areas) {
      const areaAnswers = answers.filter((a) => a.area === area)
      const score = areaAnswers.reduce((sum, a) => sum + a.score * a.weight, 0)
      const max = areaAnswers.reduce((sum, a) => sum + 2 * a.weight, 0)
      const pct = max > 0 ? Math.round((score / max) * 100) : 0

      areaScores[area] = { score, max, pct }
      totalScore += score
      maxScore += max
    }

    const healthPct = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0
    const quadrant = getQuadrant(healthPct)

    return { totalScore, maxScore, healthPct, quadrant, areaScores }
  } catch (err) {
    console.error('Unexpected error in calculateDiagnosticScores:', err)
    return defaultResult
  }
}

export function getQuadrant(healthPct: number): DiagnosticQuadrant {
  if (healthPct >= DIAGNOSTIC_QUADRANTS.optimized.min) return 'optimized'
  if (healthPct >= DIAGNOSTIC_QUADRANTS.developing.min) return 'developing'
  if (healthPct >= DIAGNOSTIC_QUADRANTS.at_risk.min) return 'at_risk'
  return 'critical'
}
