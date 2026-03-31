/**
 * VAMO QA — Criação de usuários de teste via Supabase Admin API
 *
 * Uso: npx tsx tests/setup/create-test-users.ts
 *
 * Requer no .env.test.local:
 *   SUPABASE_SERVICE_ROLE_KEY=...   (Settings → API → service_role secret)
 *   NEXT_PUBLIC_SUPABASE_URL=...
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.resolve(__dirname, '../../.env.test.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ORG_ID = 'aaaaaaaa-0000-0000-0000-000000000001'

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('\n❌ Variáveis ausentes no .env.test.local:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL=...')
  console.error('   SUPABASE_SERVICE_ROLE_KEY=... (Settings → API → service_role)\n')
  process.exit(1)
}

// Admin client com service_role (bypass de RLS e auth)
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TEST_USERS = [
  {
    email: process.env.TEST_GESTOR_EMAIL ?? 'gestor.teste@vamo.test',
    password: process.env.TEST_GESTOR_PASSWORD ?? 'VamoGestor2024!',
    name: 'Gestor Teste',
    role: 'manager' as const,
  },
  {
    email: process.env.TEST_VENDEDOR_EMAIL ?? 'vendedor.teste@vamo.test',
    password: process.env.TEST_VENDEDOR_PASSWORD ?? 'VamoVendedor2024!',
    name: 'Vendedor Teste',
    role: 'seller' as const,
  },
]

async function ensureOrganization() {
  console.log('\n[Setup] Verificando organização de teste...')

  const { data: existing } = await supabase
    .from('organizations')
    .select('id')
    .eq('id', ORG_ID)
    .maybeSingle()

  if (existing) {
    console.log('[Setup] ✓ Organização já existe.')
    return
  }

  const { error } = await supabase.from('organizations').insert({
    id: ORG_ID,
    name: 'Empresa Teste QA',
    slug: 'empresa-teste-qa',
    plan: 'professional',
    active: true,
    settings: {},
  })

  if (error) throw new Error(`Erro ao criar organização: ${error.message}`)
  console.log('[Setup] ✓ Organização criada.')
}

async function ensureXpLevels() {
  const levels = [
    { level: 1, name: 'Recruta', xp_required: 0 },
    { level: 2, name: 'Prospector', xp_required: 500 },
    { level: 3, name: 'Negociador', xp_required: 1500 },
    { level: 4, name: 'Hunter', xp_required: 3000 },
    { level: 5, name: 'Closer', xp_required: 5500 },
    { level: 6, name: 'Elite', xp_required: 9000 },
    { level: 7, name: 'Campeão', xp_required: 14000 },
    { level: 8, name: 'Lenda', xp_required: 21000 },
  ]

  for (const lvl of levels) {
    await supabase
      .from('xp_levels')
      .upsert({ organization_id: ORG_ID, ...lvl }, { onConflict: 'organization_id,level' })
  }
  console.log('[Setup] ✓ Níveis de XP configurados.')
}

async function ensureKpis() {
  const kpis = [
    { name: 'Ligações Realizadas', slug: 'ligacoes-realizadas', unit: 'ligações', points_per_unit: 10 },
    { name: 'Propostas Enviadas', slug: 'propostas-enviadas', unit: 'propostas', points_per_unit: 50 },
    { name: 'Vendas Fechadas', slug: 'vendas-fechadas', unit: 'vendas', points_per_unit: 200 },
  ]

  for (const kpi of kpis) {
    await supabase
      .from('kpi_definitions')
      .upsert({ organization_id: ORG_ID, ...kpi, active: true }, { onConflict: 'organization_id,slug' })
  }
  console.log('[Setup] ✓ KPIs configurados.')
}

async function findAuthUserByEmail(email: string) {
  // listUsers é paginado — percorre todas as páginas
  let page = 1
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 })
    if (error || !data?.users?.length) break
    const found = data.users.find((u) => u.email === email)
    if (found) return found
    if (data.users.length < 100) break
    page++
  }
  return null
}

async function deleteAuthUserByEmail(email: string) {
  const existing = await findAuthUserByEmail(email)
  if (existing) {
    await supabase.auth.admin.deleteUser(existing.id)
    console.log(`[Setup] ✓ Usuário antigo removido: ${email}`)
  }
}

async function createOrUpdateUser(user: typeof TEST_USERS[number]) {
  console.log(`\n[Setup] Configurando usuário: ${user.email} (${user.role})...`)

  let authUserId: string
  const existing = await findAuthUserByEmail(user.email)

  if (existing) {
    // Atualiza a senha do usuário existente
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
      password: user.password,
      email_confirm: true,
    })
    if (error) {
      // Se falhou atualizar, deleta e recria
      console.log(`[Setup] ⚠ Falha ao atualizar, recriando usuário...`)
      await supabase.auth.admin.deleteUser(existing.id)
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: { name: user.name },
      })
      if (createErr) throw new Error(`Erro ao recriar ${user.email}: ${createErr.message}`)
      authUserId = created.user.id
    } else {
      authUserId = data.user.id
    }
    console.log(`[Setup] ✓ Auth atualizado: ${authUserId}`)
  } else {
    // Tenta criar; se falhar com "Database error checking email", apaga e recria
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { name: user.name },
    })

    if (error) {
      if (error.message.includes('Database error')) {
        console.log(`[Setup] ⚠ Registro órfão detectado em auth.users. Limpando...`)
        // Tenta remover via SQL direto (registro existe mas sem id visível no Admin API)
        await supabase.rpc('exec_sql', {
          sql: `DELETE FROM auth.users WHERE email = '${user.email}'`,
        }).catch(() => {})

        // Aguarda propagação
        await new Promise((r) => setTimeout(r, 1_000))

        const { data: retry, error: retryErr } = await supabase.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true,
          user_metadata: { name: user.name },
        })
        if (retryErr) {
          throw new Error(
            `❌ Ainda há conflito para ${user.email}.\n` +
            `Rode no Supabase SQL Editor:\n` +
            `  DELETE FROM public.users WHERE email = '${user.email}';\n` +
            `  DELETE FROM auth.users WHERE email = '${user.email}';\n` +
            `Depois rode npm run test:qa:setup novamente.`
          )
        }
        authUserId = retry.user.id
      } else {
        throw new Error(`Erro ao criar ${user.email}: ${error.message}`)
      }
    } else {
      authUserId = data.user.id
    }
    console.log(`[Setup] ✓ Usuário auth criado: ${authUserId}`)
  }

  // Upsert na tabela public.users
  const { error: pubError } = await supabase
    .from('users')
    .upsert(
      {
        auth_id: authUserId,
        organization_id: ORG_ID,
        name: user.name,
        email: user.email,
        role: user.role,
        active: true,
      },
      { onConflict: 'auth_id' }
    )

  if (pubError) throw new Error(`Erro ao upsert public.users (${user.email}): ${pubError.message}`)
  console.log(`[Setup] ✓ public.users atualizado`)

  // Busca o id real gerado
  const { data: pubUser } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', authUserId)
    .single()

  if (!pubUser) throw new Error(`Usuário não encontrado em public.users após upsert`)

  // Upsert user_xp
  const { error: xpError } = await supabase
    .from('user_xp')
    .upsert(
      {
        user_id: pubUser.id,
        organization_id: ORG_ID,
        total_xp: 750,
        current_level: 2,
        current_streak: 1,
        longest_streak: 3,
      },
      { onConflict: 'user_id,organization_id' }
    )

  if (xpError) throw new Error(`Erro ao criar user_xp (${user.email}): ${xpError.message}`)
  console.log(`[Setup] ✓ XP configurado`)
}

async function main() {
  console.log('═══════════════════════════════════════')
  console.log('  VAMO QA — Setup de Usuários de Teste')
  console.log('═══════════════════════════════════════')

  await ensureOrganization()
  await ensureXpLevels()
  await ensureKpis()

  for (const user of TEST_USERS) {
    await createOrUpdateUser(user)
  }

  console.log('\n═══════════════════════════════════════')
  console.log('  ✅ Setup concluído! Rode agora:')
  console.log('     npm run test:qa:full')
  console.log('═══════════════════════════════════════\n')
}

main().catch((err) => {
  console.error('\n❌', err.message)
  process.exit(1)
})
