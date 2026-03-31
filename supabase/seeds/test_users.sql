-- ============================================================
-- VAMO — Seed de Usuários de Teste para QA
-- Execute no Supabase Dashboard → SQL Editor
-- ⚠️  Use apenas em ambiente de desenvolvimento/staging
-- ============================================================

-- 1. Organização de teste
INSERT INTO public.organizations (id, name, slug, plan, active, settings)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Empresa Teste QA',
  'empresa-teste-qa',
  'professional',
  true,
  '{}'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- 2. Criar usuários no Supabase Auth
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password,
  email_confirmed_at, role, aud,
  created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin
)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'gestor.teste@vamo.test',
  crypt('VamoGestor2024!', gen_salt('bf')),
  now(), 'authenticated', 'authenticated', now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"name":"Gestor Teste"}'::jsonb,
  false
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password,
  email_confirmed_at, role, aud,
  created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin
)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000000',
  'vendedor.teste@vamo.test',
  crypt('VamoVendedor2024!', gen_salt('bf')),
  now(), 'authenticated', 'authenticated', now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"name":"Vendedor Teste"}'::jsonb,
  false
)
ON CONFLICT (id) DO NOTHING;

-- 3. Registrar na tabela pública (sem forçar id — deixa auto-gerar ou usar o existente)
INSERT INTO public.users (auth_id, organization_id, name, email, role, active)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000002',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Gestor Teste',
  'gestor.teste@vamo.test',
  'manager',
  true
)
ON CONFLICT (auth_id) DO UPDATE SET
  organization_id = EXCLUDED.organization_id,
  role            = EXCLUDED.role,
  active          = EXCLUDED.active;

INSERT INTO public.users (auth_id, organization_id, name, email, role, active)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000003',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Vendedor Teste',
  'vendedor.teste@vamo.test',
  'seller',
  true
)
ON CONFLICT (auth_id) DO UPDATE SET
  organization_id = EXCLUDED.organization_id,
  role            = EXCLUDED.role,
  active          = EXCLUDED.active;

-- 4. XP inicial — usa subquery para pegar o id real gerado pela tabela users
DO $$
DECLARE
  v_gestor_id  UUID;
  v_vendedor_id UUID;
  v_org_id     UUID := 'aaaaaaaa-0000-0000-0000-000000000001';
BEGIN
  SELECT id INTO v_gestor_id
    FROM public.users
    WHERE auth_id = 'aaaaaaaa-0000-0000-0000-000000000002';

  SELECT id INTO v_vendedor_id
    FROM public.users
    WHERE auth_id = 'aaaaaaaa-0000-0000-0000-000000000003';

  INSERT INTO public.user_xp (user_id, organization_id, total_xp, current_level, current_streak, longest_streak)
  VALUES (v_gestor_id, v_org_id, 1200, 2, 3, 5)
  ON CONFLICT (user_id, organization_id) DO NOTHING;

  INSERT INTO public.user_xp (user_id, organization_id, total_xp, current_level, current_streak, longest_streak)
  VALUES (v_vendedor_id, v_org_id, 750, 2, 1, 3)
  ON CONFLICT (user_id, organization_id) DO NOTHING;
END $$;

-- 5. Níveis de XP
INSERT INTO public.xp_levels (organization_id, level, name, xp_required)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 1, 'Recruta',   0),
  ('aaaaaaaa-0000-0000-0000-000000000001', 2, 'Prospector', 500),
  ('aaaaaaaa-0000-0000-0000-000000000001', 3, 'Negociador', 1500),
  ('aaaaaaaa-0000-0000-0000-000000000001', 4, 'Hunter',    3000),
  ('aaaaaaaa-0000-0000-0000-000000000001', 5, 'Closer',    5500),
  ('aaaaaaaa-0000-0000-0000-000000000001', 6, 'Elite',     9000),
  ('aaaaaaaa-0000-0000-0000-000000000001', 7, 'Campeão',   14000),
  ('aaaaaaaa-0000-0000-0000-000000000001', 8, 'Lenda',     21000)
ON CONFLICT (organization_id, level) DO NOTHING;

-- 6. KPIs de exemplo
INSERT INTO public.kpi_definitions (organization_id, name, slug, unit, points_per_unit, active)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Ligações Realizadas', 'ligacoes-realizadas', 'ligações', 10, true),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Propostas Enviadas',  'propostas-enviadas',  'propostas', 50, true),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Vendas Fechadas',     'vendas-fechadas',     'vendas',   200, true)
ON CONFLICT (organization_id, slug) DO NOTHING;

-- ============================================================
-- Para REMOVER os dados de teste depois:
-- ============================================================
-- DELETE FROM public.user_xp      WHERE organization_id = 'aaaaaaaa-0000-0000-0000-000000000001';
-- DELETE FROM public.kpi_definitions WHERE organization_id = 'aaaaaaaa-0000-0000-0000-000000000001';
-- DELETE FROM public.xp_levels    WHERE organization_id = 'aaaaaaaa-0000-0000-0000-000000000001';
-- DELETE FROM public.users        WHERE organization_id = 'aaaaaaaa-0000-0000-0000-000000000001';
-- DELETE FROM auth.users          WHERE id IN ('aaaaaaaa-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000003');
-- DELETE FROM public.organizations WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001';
-- ============================================================
