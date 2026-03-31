/**
 * VAMO QA — Gerador de Relatório Sumário
 * Lê o qa-report/results.json do Playwright e gera qa-report/RELATORIO.md
 *
 * Uso: npx tsx tests/generate-summary.ts
 * (ou adicionar como script pós-teste)
 */

import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'

interface TestResult {
  title: string
  status: 'passed' | 'failed' | 'skipped' | 'timedOut'
  duration: number
  error?: { message: string }
  retry?: number
}

interface SuiteResult {
  title: string
  suites?: SuiteResult[]
  specs?: Array<{
    title: string
    tests: TestResult[]
  }>
}

interface PlaywrightReport {
  stats: {
    total: number
    passed: number
    failed: number
    skipped: number
    duration: number
  }
  suites: SuiteResult[]
}

function collectTests(suite: SuiteResult, project: string): Array<TestResult & { file: string; project: string }> {
  const results: Array<TestResult & { file: string; project: string }> = []

  if (suite.specs) {
    for (const spec of suite.specs) {
      for (const test of spec.tests) {
        results.push({
          ...test,
          title: spec.title,
          file: suite.title,
          project,
        })
      }
    }
  }

  if (suite.suites) {
    for (const child of suite.suites) {
      const projectName = project || child.title
      results.push(...collectTests(child, projectName))
    }
  }

  return results
}

function statusEmoji(status: string): string {
  switch (status) {
    case 'passed': return '✅'
    case 'failed': return '❌'
    case 'skipped': return '⏭️'
    case 'timedOut': return '⏱️'
    default: return '❓'
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function getGitInfo(): string {
  try {
    const commit = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim()
    return `${branch} @ ${commit}`
  } catch {
    return 'N/A'
  }
}

function main() {
  const resultsPath = path.resolve(__dirname, '../qa-report/results.json')

  if (!fs.existsSync(resultsPath)) {
    console.error('❌ qa-report/results.json não encontrado. Execute npm run test:qa primeiro.')
    process.exit(1)
  }

  const report: PlaywrightReport = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'))
  const now = new Date()
  const gitInfo = getGitInfo()

  // Coleta todos os testes
  const allTests: Array<TestResult & { file: string; project: string }> = []
  for (const suite of report.suites) {
    allTests.push(...collectTests(suite, ''))
  }

  const total = report.stats?.total ?? allTests.length
  const passed = report.stats?.passed ?? allTests.filter((t) => t.status === 'passed').length
  const failed = report.stats?.failed ?? allTests.filter((t) => t.status === 'failed').length
  const skipped = report.stats?.skipped ?? allTests.filter((t) => t.status === 'skipped').length
  const duration = report.stats?.duration ?? 0
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0

  // Separa por projeto
  const byProject: Record<string, typeof allTests> = {}
  for (const test of allTests) {
    const proj = test.project || 'geral'
    if (!byProject[proj]) byProject[proj] = []
    byProject[proj].push(test)
  }

  const failedTests = allTests.filter((t) => t.status === 'failed' || t.status === 'timedOut')

  // Gera markdown
  const lines: string[] = [
    `# Relatório QA — VAMO Platform`,
    ``,
    `**Data:** ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}`,
    `**Branch/Commit:** ${gitInfo}`,
    `**Duração total:** ${formatDuration(duration)}`,
    ``,
    `---`,
    ``,
    `## Resultado Geral`,
    ``,
    `| Métrica | Valor |`,
    `|---------|-------|`,
    `| Total de testes | ${total} |`,
    `| ✅ Passou | ${passed} |`,
    `| ❌ Falhou | ${failed} |`,
    `| ⏭️ Pulado | ${skipped} |`,
    `| Taxa de aprovação | **${passRate}%** |`,
    ``,
    `---`,
    ``,
    `## Resultados por Perfil`,
    ``,
  ]

  const projectOrder = ['gestor', 'vendedor', 'api']
  const sortedProjects = [
    ...projectOrder.filter((p) => byProject[p]),
    ...Object.keys(byProject).filter((p) => !projectOrder.includes(p)),
  ]

  for (const proj of sortedProjects) {
    const tests = byProject[proj]
    if (!tests || tests.length === 0) continue

    const projPassed = tests.filter((t) => t.status === 'passed').length
    const projFailed = tests.filter((t) => t.status === 'failed' || t.status === 'timedOut').length
    const projSkipped = tests.filter((t) => t.status === 'skipped').length
    const projRate = tests.length > 0 ? Math.round((projPassed / tests.length) * 100) : 0

    const label = proj === 'gestor' ? '👔 Gestor' : proj === 'vendedor' ? '🧑‍💼 Vendedor' : '🔌 API'
    lines.push(`### ${label}`)
    lines.push(``)
    lines.push(`> ${projPassed}/${tests.length} testes passaram (${projRate}%)`)
    lines.push(``)
    lines.push(`| Status | Teste | Duração |`)
    lines.push(`|--------|-------|---------|`)

    for (const test of tests) {
      const emoji = statusEmoji(test.status)
      const dur = formatDuration(test.duration ?? 0)
      lines.push(`| ${emoji} | ${test.title} | ${dur} |`)
    }

    lines.push(``)
  }

  if (failedTests.length > 0) {
    lines.push(`---`)
    lines.push(``)
    lines.push(`## ❌ Falhas Detalhadas`)
    lines.push(``)

    for (const test of failedTests) {
      lines.push(`### ${test.title}`)
      lines.push(``)
      lines.push(`- **Arquivo:** \`${test.file}\``)
      lines.push(`- **Projeto:** ${test.project}`)
      lines.push(`- **Status:** ${test.status}`)
      if (test.error?.message) {
        lines.push(`- **Erro:**`)
        lines.push(`  \`\`\``)
        lines.push(`  ${test.error.message.split('\n').slice(0, 5).join('\n  ')}`)
        lines.push(`  \`\`\``)
      }
      lines.push(``)
    }
  } else {
    lines.push(`---`)
    lines.push(``)
    lines.push(`## ✅ Sem Falhas`)
    lines.push(``)
    lines.push(`Todos os testes executados passaram com sucesso.`)
    lines.push(``)
  }

  lines.push(`---`)
  lines.push(``)
  lines.push(`## Como Re-executar`)
  lines.push(``)
  lines.push('```bash')
  lines.push(`# Rodar todos os testes`)
  lines.push(`npm run test:qa`)
  lines.push(``)
  lines.push(`# Abrir relatório interativo HTML`)
  lines.push(`npm run test:qa:report`)
  lines.push(``)
  lines.push(`# Rodar apenas testes do gestor`)
  lines.push(`npx playwright test --project=gestor`)
  lines.push(``)
  lines.push(`# Rodar apenas testes do vendedor`)
  lines.push(`npx playwright test --project=vendedor`)
  lines.push('```')
  lines.push(``)
  lines.push(`---`)
  lines.push(`*Gerado automaticamente por VAMO QA Suite*`)

  const outputPath = path.resolve(__dirname, '../qa-report/RELATORIO.md')
  fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8')

  console.log(`\n✅ Relatório gerado: qa-report/RELATORIO.md`)
  console.log(`\n📊 Resultado: ${passed}/${total} testes passaram (${passRate}%)`)

  if (failed > 0) {
    console.log(`\n❌ ${failed} teste(s) falharam:`)
    for (const t of failedTests) {
      console.log(`   - ${t.title}`)
    }
  }
}

main()
