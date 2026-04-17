-- ============================================================
-- SEED DE DESENVOLVIMENTO — GamePerformance
-- ============================================================
-- Empresa fictícia: TechSales Soluções Ltda
-- Data referência: Abril 2026
-- 1 Gestora (Sofia) + 6 Vendedores
-- Senha de todos os usuários: Vamo@2025
-- ============================================================
-- Como usar:
--   1. Abrir o Supabase SQL Editor (como postgres / service_role)
--   2. Executar este script completo
--   3. Login de teste: sofia@techsales.com / Vamo@2025
-- ============================================================


-- ============================================================
-- 0. LIMPEZA — remove dados anteriores do seed (idempotência)
-- ============================================================
-- Deleta na ordem inversa das dependências (FK-safe)

DO $$ BEGIN
  DELETE FROM public.automation_rules      WHERE organization_id = '10000000-0000-0000-0000-000000000001';
  DELETE FROM public.notifications         WHERE organization_id = '10000000-0000-0000-0000-000000000001';
  DELETE FROM public.program_goals         WHERE organization_id = '10000000-0000-0000-0000-000000000001';
  DELETE FROM public.challenge_participants
    WHERE challenge_id IN (SELECT id FROM public.challenges WHERE organization_id = '10000000-0000-0000-0000-000000000001');
  DELETE FROM public.challenges            WHERE organization_id = '10000000-0000-0000-0000-000000000001';
  DELETE FROM public.rewards_catalog       WHERE organization_id = '10000000-0000-0000-0000-000000000001';
  DELETE FROM public.commission_configs    WHERE organization_id = '10000000-0000-0000-0000-000000000001';
  DELETE FROM public.ai_missions           WHERE organization_id = '10000000-0000-0000-0000-000000000001';
  DELETE FROM public.user_badges
    WHERE badge_id IN (SELECT id FROM public.badges WHERE organization_id = '10000000-0000-0000-0000-000000000001');
  DELETE FROM public.badges                WHERE organization_id = '10000000-0000-0000-0000-000000000001';
  DELETE FROM public.behavioral_profiles   WHERE organization_id = '10000000-0000-0000-0000-000000000001';
  DELETE FROM public.kpi_entries           WHERE organization_id = '10000000-0000-0000-0000-000000000001';
  DELETE FROM public.kpi_definitions       WHERE organization_id = '10000000-0000-0000-0000-000000000001';
  DELETE FROM public.xp_transactions       WHERE organization_id = '10000000-0000-0000-0000-000000000001';
  DELETE FROM public.user_xp              WHERE organization_id = '10000000-0000-0000-0000-000000000001';
  DELETE FROM public.xp_levels            WHERE organization_id = '10000000-0000-0000-0000-000000000001';
  DELETE FROM public.users                WHERE organization_id = '10000000-0000-0000-0000-000000000001';
  DELETE FROM auth.users WHERE email IN (
    'sofia@techsales.com','carlos@techsales.com','ana@techsales.com',
    'diego@techsales.com','bruna@techsales.com','lucas@techsales.com','mariana@techsales.com'
  );
  DELETE FROM public.organizations WHERE id = '10000000-0000-0000-0000-000000000001';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Erro na limpeza (ignorado): %', SQLERRM;
END $$;


-- ============================================================
-- 1. ORGANIZAÇÃO
-- ============================================================

INSERT INTO public.organizations (id, name, slug, primary_color, plan, settings, active)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  'TechSales Soluções Ltda',
  'techsales',
  '#6366f1',
  'professional',
  '{
    "gamification": {
      "levels": [
        {"position": 1, "name": "Recruta"},
        {"position": 2, "name": "Prospector"},
        {"position": 3, "name": "Negociador"},
        {"position": 4, "name": "Hunter"},
        {"position": 5, "name": "Closer"},
        {"position": 6, "name": "Elite"},
        {"position": 7, "name": "Campeão"},
        {"position": 8, "name": "Lenda"}
      ],
      "ranking_public": true,
      "badges_public": true,
      "feed_enabled": true,
      "survey_frequency": "semanal",
      "wellbeing_threshold": 40
    },
    "funnel": {
      "stages": [
        {"name": "Leads",        "before": 280, "current": 347, "benchmarkConv": 100, "currentConv": 100, "bottleneck": false},
        {"name": "Qualificados", "before": 140, "current": 198, "benchmarkConv": 65,  "currentConv": 57,  "bottleneck": false},
        {"name": "Propostas",    "before": 63,  "current": 89,  "benchmarkConv": 60,  "currentConv": 45,  "bottleneck": true},
        {"name": "Negociação",   "before": 38,  "current": 52,  "benchmarkConv": 65,  "currentConv": 58,  "bottleneck": false},
        {"name": "Fechamento",   "before": 21,  "current": 31,  "benchmarkConv": 70,  "currentConv": 60,  "bottleneck": false}
      ]
    },
    "roi": {
      "receitaRecuperada": 12400,
      "economiaAdmin": 3200,
      "reducaoTurnover": 4800,
      "investimentoTotal": 4880
    },
    "kpi_overview": {
      "receita_mes": 84200,
      "receita_variacao": 12.5,
      "conversao_geral": 8.9,
      "conversao_variacao": -2.1
    }
  }'::jsonb,
  true
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  settings = EXCLUDED.settings;


-- ============================================================
-- 2. AUTH USERS (Supabase Auth)
-- ============================================================
-- Desabilitamos o trigger para controlar IDs em public.users

DO $$ BEGIN
  ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Skipping trigger disable — insufficient privilege (safe to ignore)';
END $$;

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_user_meta_data, raw_app_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  is_super_admin, is_sso_user, is_anonymous, created_at, updated_at
)
VALUES
  ('a0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'sofia@techsales.com', crypt('Vamo@2025', gen_salt('bf')), now(),
   '{"name":"Sofia Ferreira","role":"manager","email_verified":true,"phone_verified":false}'::jsonb,
   '{"provider":"email","providers":["email"]}'::jsonb,
   '', '', '', '', false, false, false, now(), now()),
  ('a0000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'carlos@techsales.com', crypt('Vamo@2025', gen_salt('bf')), now(),
   '{"name":"Carlos Mendes","role":"seller","email_verified":true,"phone_verified":false}'::jsonb,
   '{"provider":"email","providers":["email"]}'::jsonb,
   '', '', '', '', false, false, false, now(), now()),
  ('a0000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'ana@techsales.com', crypt('Vamo@2025', gen_salt('bf')), now(),
   '{"name":"Ana Lima","role":"seller","email_verified":true,"phone_verified":false}'::jsonb,
   '{"provider":"email","providers":["email"]}'::jsonb,
   '', '', '', '', false, false, false, now(), now()),
  ('a0000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'diego@techsales.com', crypt('Vamo@2025', gen_salt('bf')), now(),
   '{"name":"Diego Santos","role":"seller","email_verified":true,"phone_verified":false}'::jsonb,
   '{"provider":"email","providers":["email"]}'::jsonb,
   '', '', '', '', false, false, false, now(), now()),
  ('a0000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'bruna@techsales.com', crypt('Vamo@2025', gen_salt('bf')), now(),
   '{"name":"Bruna Oliveira","role":"seller","email_verified":true,"phone_verified":false}'::jsonb,
   '{"provider":"email","providers":["email"]}'::jsonb,
   '', '', '', '', false, false, false, now(), now()),
  ('a0000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'lucas@techsales.com', crypt('Vamo@2025', gen_salt('bf')), now(),
   '{"name":"Lucas Pereira","role":"seller","email_verified":true,"phone_verified":false}'::jsonb,
   '{"provider":"email","providers":["email"]}'::jsonb,
   '', '', '', '', false, false, false, now(), now()),
  ('a0000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'mariana@techsales.com', crypt('Vamo@2025', gen_salt('bf')), now(),
   '{"name":"Mariana Costa","role":"seller","email_verified":true,"phone_verified":false}'::jsonb,
   '{"provider":"email","providers":["email"]}'::jsonb,
   '', '', '', '', false, false, false, now(), now())
ON CONFLICT (id) DO UPDATE SET
  encrypted_password    = EXCLUDED.encrypted_password,
  email_confirmed_at    = EXCLUDED.email_confirmed_at,
  raw_user_meta_data    = EXCLUDED.raw_user_meta_data,
  raw_app_meta_data     = EXCLUDED.raw_app_meta_data,
  confirmation_token    = '',
  recovery_token        = '',
  email_change_token_new = '',
  email_change          = '',
  updated_at            = now();

-- Identidades para login funcionar
-- IMPORTANTE: provider_id deve ser o EMAIL (não UUID) nas versões recentes do GoTrue
INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
VALUES
  ('a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','sofia@techsales.com',   '{"sub":"a0000000-0000-0000-0000-000000000001","email":"sofia@techsales.com"}'::jsonb,   'email', now(), now()),
  ('a0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000002','carlos@techsales.com',  '{"sub":"a0000000-0000-0000-0000-000000000002","email":"carlos@techsales.com"}'::jsonb,  'email', now(), now()),
  ('a0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000003','ana@techsales.com',     '{"sub":"a0000000-0000-0000-0000-000000000003","email":"ana@techsales.com"}'::jsonb,     'email', now(), now()),
  ('a0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000004','diego@techsales.com',   '{"sub":"a0000000-0000-0000-0000-000000000004","email":"diego@techsales.com"}'::jsonb,   'email', now(), now()),
  ('a0000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-000000000005','bruna@techsales.com',   '{"sub":"a0000000-0000-0000-0000-000000000005","email":"bruna@techsales.com"}'::jsonb,   'email', now(), now()),
  ('a0000000-0000-0000-0000-000000000006','a0000000-0000-0000-0000-000000000006','lucas@techsales.com',   '{"sub":"a0000000-0000-0000-0000-000000000006","email":"lucas@techsales.com"}'::jsonb,   'email', now(), now()),
  ('a0000000-0000-0000-0000-000000000007','a0000000-0000-0000-0000-000000000007','mariana@techsales.com', '{"sub":"a0000000-0000-0000-0000-000000000007","email":"mariana@techsales.com"}'::jsonb, 'email', now(), now())
ON CONFLICT (id) DO UPDATE SET
  provider_id   = EXCLUDED.provider_id,
  identity_data = EXCLUDED.identity_data,
  updated_at    = now();


-- ============================================================
-- 3. APP USERS (public.users)
-- ============================================================
-- O trigger on_auth_user_created pode ter criado rows com IDs aleatórios.
-- Deletamos esses registros para inserir com nossos IDs determinísticos.

DELETE FROM public.users WHERE auth_id IN (
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000004',
  'a0000000-0000-0000-0000-000000000005',
  'a0000000-0000-0000-0000-000000000006',
  'a0000000-0000-0000-0000-000000000007'
);

INSERT INTO public.users (id, auth_id, organization_id, name, email, role, active)
VALUES
  ('b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Sofia Ferreira', 'sofia@techsales.com',   'manager',true),
  ('b0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Carlos Mendes',  'carlos@techsales.com',  'seller', true),
  ('b0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','Ana Lima',       'ana@techsales.com',     'seller', true),
  ('b0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','Diego Santos',   'diego@techsales.com',   'seller', true),
  ('b0000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','Bruna Oliveira', 'bruna@techsales.com',   'seller', true),
  ('b0000000-0000-0000-0000-000000000006','a0000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001','Lucas Pereira',  'lucas@techsales.com',   'seller', true),
  ('b0000000-0000-0000-0000-000000000007','a0000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000001','Mariana Costa',  'mariana@techsales.com', 'seller', true)
ON CONFLICT (id) DO UPDATE SET
  auth_id         = EXCLUDED.auth_id,
  organization_id = EXCLUDED.organization_id,
  name            = EXCLUDED.name,
  email           = EXCLUDED.email,
  role            = EXCLUDED.role,
  active          = EXCLUDED.active;

DO $$ BEGIN
  ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Skipping trigger enable — insufficient privilege (safe to ignore)';
END $$;


-- ============================================================
-- 4. XP LEVELS
-- ============================================================

INSERT INTO public.xp_levels (organization_id, level, name, xp_required)
VALUES
  ('10000000-0000-0000-0000-000000000001', 1, 'Recruta',    0),
  ('10000000-0000-0000-0000-000000000001', 2, 'Prospector', 500),
  ('10000000-0000-0000-0000-000000000001', 3, 'Negociador', 1200),
  ('10000000-0000-0000-0000-000000000001', 4, 'Hunter',     2500),
  ('10000000-0000-0000-0000-000000000001', 5, 'Closer',     4500),
  ('10000000-0000-0000-0000-000000000001', 6, 'Elite',      7500),
  ('10000000-0000-0000-0000-000000000001', 7, 'Campeão',    12000),
  ('10000000-0000-0000-0000-000000000001', 8, 'Lenda',      20000)
ON CONFLICT (organization_id, level) DO NOTHING;


-- ============================================================
-- 5. USER XP
-- ============================================================
-- Carlos: Closer (nível 5), streak 8 — alto desempenho
-- Ana: Hunter (nível 4), streak 12 — consistente
-- Diego: Hunter (nível 4), streak 2 — ciclo longo
-- Bruna: Negociador (nível 3), streak 0 — sinal de burnout
-- Lucas: Elite (nível 6), streak 14 — top performer
-- Mariana: Prospector (nível 2), streak 5 — nova na equipe

INSERT INTO public.user_xp (user_id, organization_id, total_xp, current_level, current_streak, longest_streak, last_activity_date)
VALUES
  ('b0000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001', 6200, 5,  8, 15, CURRENT_DATE),
  ('b0000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001', 4800, 4, 12, 12, CURRENT_DATE),
  ('b0000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001', 3100, 4,  2,  8, CURRENT_DATE - 1),
  ('b0000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001', 2800, 3,  0, 14, CURRENT_DATE - 8),
  ('b0000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001', 7800, 6, 14, 21, CURRENT_DATE),
  ('b0000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000001', 1200, 2,  5,  5, CURRENT_DATE)
ON CONFLICT (user_id, organization_id) DO UPDATE SET
  total_xp       = EXCLUDED.total_xp,
  current_level  = EXCLUDED.current_level,
  current_streak = EXCLUDED.current_streak,
  longest_streak = EXCLUDED.longest_streak,
  last_activity_date = EXCLUDED.last_activity_date;


-- ============================================================
-- 6. XP TRANSACTIONS (últimas 4 semanas)
-- ============================================================

INSERT INTO public.xp_transactions (user_id, organization_id, amount, source_type, description, created_at)
VALUES
  -- Carlos
  ('b0000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001', 150,'kpi',     'KPI: Taxa de Fechamento 33%',      now() - interval '1 day'),
  ('b0000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001', 200,'badge',   'Badge: CRM Champion desbloqueado', now() - interval '5 days'),
  ('b0000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001', 100,'kpi',     'KPI: Ligações semanais 42',         now() - interval '8 days'),
  ('b0000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001', 100,'challenge','Desafio de Volume concluído',       now() - interval '14 days'),
  ('b0000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001', 120,'kpi',     'KPI: Ticket Médio R$ 9.800',        now() - interval '21 days'),
  -- Ana
  ('b0000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001', 100,'kpi',     'KPI: Taxa de Fechamento 29%',       now() - interval '1 day'),
  ('b0000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001',  50,'badge',   'Badge: Primeira Missão',            now() - interval '7 days'),
  ('b0000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001',  80,'kpi',     'KPI: Ligações semanais 35',         now() - interval '14 days'),
  ('b0000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001',  90,'kpi',     'KPI: CRM Atualizado 89%',           now() - interval '21 days'),
  -- Diego
  ('b0000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001',  60,'kpi',     'KPI: Taxa de Fechamento 20%',       now() - interval '2 days'),
  ('b0000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001',  50,'badge',   'Badge: Primeira Missão',            now() - interval '10 days'),
  ('b0000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001',  70,'kpi',     'KPI: Ticket Médio R$ 7.100',        now() - interval '18 days'),
  -- Bruna
  ('b0000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001',  60,'kpi',     'KPI: Taxa de Fechamento 18%',       now() - interval '10 days'),
  ('b0000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001',  80,'kpi',     'KPI: CRM Atualizado 90%',           now() - interval '17 days'),
  ('b0000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001',  50,'badge',   'Badge: Primeira Missão',            now() - interval '25 days'),
  -- Lucas
  ('b0000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001', 200,'badge',   'Badge: Top da Semana',             now() - interval '1 day'),
  ('b0000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001', 180,'kpi',     'KPI: Taxa de Fechamento 42%',       now() - interval '4 days'),
  ('b0000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001', 150,'badge',   'Badge: Streak Mestre 21 dias',      now() - interval '7 days'),
  ('b0000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001', 120,'kpi',     'KPI: Ligações semanais 55',         now() - interval '11 days'),
  ('b0000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001', 200,'challenge','Desafio de Volume concluído',       now() - interval '18 days'),
  -- Mariana
  ('b0000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000001',  40,'kpi',     'KPI: Taxa de Fechamento 18%',       now() - interval '1 day'),
  ('b0000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000001',  50,'badge',   'Badge: Primeira Missão',            now() - interval '6 days'),
  ('b0000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000001',  35,'kpi',     'KPI: CRM Atualizado 75%',           now() - interval '13 days');


-- ============================================================
-- 7. KPI DEFINITIONS
-- ============================================================

INSERT INTO public.kpi_definitions (id, organization_id, name, slug, description, unit, points_per_unit, targets, active)
VALUES
  ('c0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',
   'Taxa de Fechamento','taxa_fechamento','% de leads convertidos em clientes','%',        2,   '{"monthly_target":35}'::jsonb,   true),
  ('c0000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001',
   'Ligações por Semana','ligacoes_semana','Ligações qualificadas realizadas na semana','ligações',1,'{"monthly_target":40}'::jsonb,   true),
  ('c0000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001',
   'Ticket Médio','ticket_medio','Valor médio por negócio fechado','R$',            0.01,'{"monthly_target":9500}'::jsonb, true),
  ('c0000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001',
   'CRM Atualizado','crm_atualizado','% de oportunidades atualizadas no CRM','%',   1,   '{"monthly_target":95}'::jsonb,   true)
ON CONFLICT (organization_id, slug) DO NOTHING;


-- ============================================================
-- 8. KPI ENTRIES (4 registros semanais por vendedor/KPI)
-- ============================================================

INSERT INTO public.kpi_entries (organization_id, user_id, kpi_id, value, points_earned, recorded_at, source) VALUES
-- ─── Carlos Mendes — alta performance ───
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000001', 28, 56, CURRENT_DATE - 21,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000001', 31, 62, CURRENT_DATE - 14,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000001', 30, 60, CURRENT_DATE - 7, 'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000001', 33, 66, CURRENT_DATE,     'manual'),

('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000002', 38, 38, CURRENT_DATE - 21,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000002', 42, 42, CURRENT_DATE - 14,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000002', 40, 40, CURRENT_DATE - 7, 'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000002', 45, 45, CURRENT_DATE,     'manual'),

('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000003', 9200,  92, CURRENT_DATE - 21,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000003', 9800,  98, CURRENT_DATE - 14,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000003', 8900,  89, CURRENT_DATE - 7, 'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000003',10200, 102, CURRENT_DATE,     'manual'),

('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000004', 88, 88, CURRENT_DATE - 21,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000004', 92, 92, CURRENT_DATE - 14,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000004', 90, 90, CURRENT_DATE - 7, 'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000004', 95, 95, CURRENT_DATE,     'manual'),

-- ─── Ana Lima — boa em relacionamento ───
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000001', 22, 44, CURRENT_DATE - 21,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000001', 25, 50, CURRENT_DATE - 14,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000001', 27, 54, CURRENT_DATE - 7, 'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000001', 29, 58, CURRENT_DATE,     'manual'),

('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000002', 30, 30, CURRENT_DATE - 21,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000002', 28, 28, CURRENT_DATE - 14,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000002', 32, 32, CURRENT_DATE - 7, 'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000002', 35, 35, CURRENT_DATE,     'manual'),

('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000003', 7500, 75, CURRENT_DATE - 21,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000003', 8200, 82, CURRENT_DATE - 14,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000003', 7800, 78, CURRENT_DATE - 7, 'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000003', 8500, 85, CURRENT_DATE,     'manual'),

('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000004', 82, 82, CURRENT_DATE - 21,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000004', 85, 85, CURRENT_DATE - 14,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000004', 88, 88, CURRENT_DATE - 7, 'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000004', 89, 89, CURRENT_DATE,     'manual'),

-- ─── Diego Santos — técnico, ciclo longo ───
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000001', 15, 30, CURRENT_DATE - 21,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000001', 18, 36, CURRENT_DATE - 14,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000001', 17, 34, CURRENT_DATE - 7, 'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000001', 20, 40, CURRENT_DATE,     'manual'),

('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000002', 25, 25, CURRENT_DATE - 21,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000002', 27, 27, CURRENT_DATE - 14,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000002', 24, 24, CURRENT_DATE - 7, 'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000002', 28, 28, CURRENT_DATE,     'manual'),

('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000003', 6200, 62, CURRENT_DATE - 21,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000003', 6800, 68, CURRENT_DATE - 14,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000003', 7100, 71, CURRENT_DATE - 7, 'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000003', 6500, 65, CURRENT_DATE,     'manual'),

('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000004', 65, 65, CURRENT_DATE - 21,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000004', 68, 68, CURRENT_DATE - 14,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000004', 72, 72, CURRENT_DATE - 7, 'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000004', 70, 70, CURRENT_DATE,     'manual'),

-- ─── Bruna Oliveira — queda (sinal de burnout) ───
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000005','c0000000-0000-0000-0000-000000000001', 20, 40, CURRENT_DATE - 21,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000005','c0000000-0000-0000-0000-000000000001', 22, 44, CURRENT_DATE - 14,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000005','c0000000-0000-0000-0000-000000000001', 19, 38, CURRENT_DATE - 7, 'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000005','c0000000-0000-0000-0000-000000000001', 18, 36, CURRENT_DATE - 1, 'manual'),

('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000005','c0000000-0000-0000-0000-000000000002', 22, 22, CURRENT_DATE - 21,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000005','c0000000-0000-0000-0000-000000000002', 20, 20, CURRENT_DATE - 14,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000005','c0000000-0000-0000-0000-000000000002', 18, 18, CURRENT_DATE - 7, 'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000005','c0000000-0000-0000-0000-000000000002', 15, 15, CURRENT_DATE - 1, 'manual'),

('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000005','c0000000-0000-0000-0000-000000000003', 8500, 85, CURRENT_DATE - 21,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000005','c0000000-0000-0000-0000-000000000003', 8200, 82, CURRENT_DATE - 14,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000005','c0000000-0000-0000-0000-000000000003', 7900, 79, CURRENT_DATE - 7, 'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000005','c0000000-0000-0000-0000-000000000003', 7600, 76, CURRENT_DATE - 1, 'manual'),

('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000005','c0000000-0000-0000-0000-000000000004', 90, 90, CURRENT_DATE - 21,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000005','c0000000-0000-0000-0000-000000000004', 88, 88, CURRENT_DATE - 14,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000005','c0000000-0000-0000-0000-000000000004', 85, 85, CURRENT_DATE - 7, 'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000005','c0000000-0000-0000-0000-000000000004', 82, 82, CURRENT_DATE - 1, 'manual'),

-- ─── Lucas Pereira — top performer, inconsistente ───
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-000000000001', 35, 70, CURRENT_DATE - 21,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-000000000001', 28, 56, CURRENT_DATE - 14,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-000000000001', 42, 84, CURRENT_DATE - 7, 'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-000000000001', 25, 50, CURRENT_DATE,     'manual'),

('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-000000000002', 50, 50, CURRENT_DATE - 21,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-000000000002', 35, 35, CURRENT_DATE - 14,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-000000000002', 55, 55, CURRENT_DATE - 7, 'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-000000000002', 30, 30, CURRENT_DATE,     'manual'),

('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-000000000003',11000,110, CURRENT_DATE - 21,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-000000000003', 7500, 75, CURRENT_DATE - 14,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-000000000003',12500,125, CURRENT_DATE - 7, 'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-000000000003', 8200, 82, CURRENT_DATE,     'manual'),

('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-000000000004', 70, 70, CURRENT_DATE - 21,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-000000000004', 55, 55, CURRENT_DATE - 14,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-000000000004', 80, 80, CURRENT_DATE - 7, 'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-000000000004', 60, 60, CURRENT_DATE,     'manual'),

-- ─── Mariana Costa — iniciante, crescimento constante ───
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000007','c0000000-0000-0000-0000-000000000001',  8, 16, CURRENT_DATE - 21,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000007','c0000000-0000-0000-0000-000000000001', 12, 24, CURRENT_DATE - 14,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000007','c0000000-0000-0000-0000-000000000001', 15, 30, CURRENT_DATE - 7, 'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000007','c0000000-0000-0000-0000-000000000001', 18, 36, CURRENT_DATE,     'manual'),

('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000007','c0000000-0000-0000-0000-000000000002', 15, 15, CURRENT_DATE - 21,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000007','c0000000-0000-0000-0000-000000000002', 18, 18, CURRENT_DATE - 14,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000007','c0000000-0000-0000-0000-000000000002', 20, 20, CURRENT_DATE - 7, 'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000007','c0000000-0000-0000-0000-000000000002', 22, 22, CURRENT_DATE,     'manual'),

('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000007','c0000000-0000-0000-0000-000000000003', 4500, 45, CURRENT_DATE - 21,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000007','c0000000-0000-0000-0000-000000000003', 5200, 52, CURRENT_DATE - 14,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000007','c0000000-0000-0000-0000-000000000003', 5800, 58, CURRENT_DATE - 7, 'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000007','c0000000-0000-0000-0000-000000000003', 6100, 61, CURRENT_DATE,     'manual'),

('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000007','c0000000-0000-0000-0000-000000000004', 60, 60, CURRENT_DATE - 21,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000007','c0000000-0000-0000-0000-000000000004', 65, 65, CURRENT_DATE - 14,'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000007','c0000000-0000-0000-0000-000000000004', 70, 70, CURRENT_DATE - 7, 'manual'),
('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000007','c0000000-0000-0000-0000-000000000004', 75, 75, CURRENT_DATE,     'manual');


-- ============================================================
-- 9. PERFIS COMPORTAMENTAIS DISC
-- ============================================================

INSERT INTO public.behavioral_profiles (user_id, organization_id, answers, profile_result, model_used)
VALUES
-- Carlos Mendes — D (Dominante)
('b0000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001',
 '[]'::jsonb,
 '{
   "dominant_profile": "D",
   "profile_name": "Dominante",
   "profile_description": "Você é direto, orientado a resultados e focado em metas. Alta capacidade de superar objeções e fechar negócios com velocidade.",
   "scores": {"D": 50, "I": 25, "S": 15, "C": 10},
   "selling_strengths": [
     "Taxa de fechamento em primeira reunião 20% acima da média da equipe",
     "Alta capacidade de superar objeções com firmeza e argumentos diretos",
     "Velocidade de resposta e follow-up rápido como diferencial competitivo"
   ],
   "development_areas": [
     "Ticket médio abaixo do potencial — tendência de ir direto ao preço sem construir valor suficiente",
     "Perguntas consultivas antes de apresentar a solução podem aumentar ticket em 15–20%"
   ],
   "communication_style": "Direto e objetivo, prefere dados e resultados concretos. Comunica em tópicos curtos.",
   "ideal_sales_role": "Fechamento de negócios complexos e gestão de contas estratégicas de alto valor",
   "performance_insight": "Resultados máximos com metas de curto prazo bem definidas e desafios individuais."
 }'::jsonb,
 'seed-v1'),

-- Ana Lima — I (Influente)
('b0000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001',
 '[]'::jsonb,
 '{
   "dominant_profile": "I",
   "profile_name": "Influente",
   "profile_description": "Você é comunicativo, carismático e cria conexões genuínas. Seu talento para relacionamentos é um diferencial comercial forte.",
   "scores": {"D": 20, "I": 50, "S": 20, "C": 10},
   "selling_strengths": [
     "Maior índice de indicações da equipe — clientes confiam e recomendam ativamente",
     "Cria rapport em poucos minutos, conquistando confiança antes do pitch",
     "Taxa de conversão em primeira reunião 20% acima da média"
   ],
   "development_areas": [
     "Ticket médio abaixo do potencial — oportunidade em vendas consultivas de maior valor",
     "Identificar e propor upsell no momento certo pode aumentar ticket em 15–20%"
   ],
   "communication_style": "Entusiasta e empática, usa storytelling e conexão emocional com o cliente.",
   "ideal_sales_role": "Desenvolvimento de novos clientes e expansão via indicações e relacionamento",
   "performance_insight": "Engajamento da equipe sobe quando você está ativo em missões colaborativas."
 }'::jsonb,
 'seed-v1'),

-- Diego Santos — C (Consciencioso)
('b0000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001',
 '[]'::jsonb,
 '{
   "dominant_profile": "C",
   "profile_name": "Consciencioso",
   "profile_description": "Analítico, preciso e metódico. Clientes técnicos e exigentes confiam na sua profundidade de análise e rigor nas propostas.",
   "scores": {"D": 15, "I": 20, "S": 20, "C": 45},
   "selling_strengths": [
     "Maior taxa de conversão em propostas técnicas da equipe",
     "Apresentações mais completas e bem fundamentadas — percebido como consultor",
     "Análise de dados pré-reunião é um diferencial percebido pelos clientes"
   ],
   "development_areas": [
     "Ciclo de vendas acima da média — tendência de analisar demais antes de avançar",
     "Critérios claros de quando avançar no funil podem reduzir ciclo em 25–30%"
   ],
   "communication_style": "Metódico e baseado em dados, prefere documentação, análise e apresentações estruturadas.",
   "ideal_sales_role": "Vendas técnicas complexas, propostas customizadas e clientes enterprise",
   "performance_insight": "Fecha mais quando tem acesso antecipado a dados do cliente e estudos de caso."
 }'::jsonb,
 'seed-v1'),

-- Bruna Oliveira — S (Estável)
('b0000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001',
 '[]'::jsonb,
 '{
   "dominant_profile": "S",
   "profile_name": "Estável",
   "profile_description": "Consistente, confiável e cria relacionamentos duradouros. Clientes de longo prazo confiam em você para expansão e renovação.",
   "scores": {"D": 10, "I": 20, "S": 50, "C": 20},
   "selling_strengths": [
     "Maior taxa de retenção de clientes da equipe",
     "Consistência no CRM — dados sempre organizados e atualizados",
     "Clientes antigos confiam para expansão — maior LTV médio da equipe"
   ],
   "development_areas": [
     "Metas de volume muito alto podem gerar estresse — prefira metas de qualidade",
     "Prospecção ativa (cold) é o ponto de desenvolvimento — ponto forte é relacionamento existente"
   ],
   "communication_style": "Paciente e confiável, foca em construir relacionamentos de longo prazo sem pressão.",
   "ideal_sales_role": "Gestão e expansão de carteira de clientes ativos, renovações e upsell",
   "wellbeing_insight": "Missões de upsell em clientes existentes têm 3× mais chances de sucesso para seu perfil."
 }'::jsonb,
 'seed-v1'),

-- Lucas Pereira — D (Dominante — variante agressiva)
('b0000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001',
 '[]'::jsonb,
 '{
   "dominant_profile": "D",
   "profile_name": "Dominante",
   "profile_description": "Alta energia comercial e capacidade de fechar grandes negócios. Resiliência excepcional frente a objeções. Maior volume de vendas em picos.",
   "scores": {"D": 55, "I": 25, "S": 10, "C": 10},
   "selling_strengths": [
     "Maior volume de vendas da equipe em semanas de alta performance",
     "Alta resiliência a rejeições — não para após um não",
     "Capacidade natural de criar senso de urgência no cliente"
   ],
   "development_areas": [
     "Inconsistência de resultado — alternância de semanas muito fortes e fracas",
     "Qualidade do pipeline precisa melhorar — foco em volume pode prejudicar CRM e follow-up"
   ],
   "communication_style": "Assertivo e direto, cria urgência e pressiona por decisão com confiança.",
   "ideal_sales_role": "Hunting agressivo de novos clientes e fechamento de negócios de alto valor",
   "performance_insight": "Resultados mais consistentes com metas diárias claras e acompanhamento frequente."
 }'::jsonb,
 'seed-v1'),

-- Mariana Costa — I (Influente — iniciante)
('b0000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000001',
 '[]'::jsonb,
 '{
   "dominant_profile": "I",
   "profile_name": "Influente",
   "profile_description": "Grande potencial relacional e aprendizado rápido. Entusiasmo e empatia são diferenciais que se consolidam com prática e volume.",
   "scores": {"D": 15, "I": 55, "S": 20, "C": 10},
   "selling_strengths": [
     "Alta capacidade de criar conexão e empatia com novos clientes",
     "Aprendizado rápido — evolução consistente mês a mês",
     "Entusiasmo percebido pelos clientes como diferencial positivo"
   ],
   "development_areas": [
     "Volume de ligações ainda abaixo da meta — necessário aumentar prospecção ativa",
     "Desenvolver técnicas de fechamento para converter o bom relacionamento em contratos"
   ],
   "communication_style": "Entusiasta e acolhedora, cria conexão emocional facilmente desde o primeiro contato.",
   "ideal_sales_role": "Desenvolvimento de novos relacionamentos, outbound e vendas consultivas",
   "performance_insight": "Missões de prospecção e desenvolvimento têm maior alinhamento com seu perfil atual."
 }'::jsonb,
 'seed-v1')
ON CONFLICT DO NOTHING;


-- ============================================================
-- 10. BADGES DA ORGANIZAÇÃO
-- ============================================================

INSERT INTO public.badges (id, organization_id, name, description, category, criteria, xp_reward, rarity, active)
VALUES
  ('d0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',
   'Primeira Missão','Completou a primeira missão da plataforma','missoes','{"missions_completed":1}'::jsonb,50,'common',true),
  ('d0000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001',
   'Prospector Ativo','10 ligações registradas em um único dia','kpi','{"daily_calls":10}'::jsonb,75,'common',true),
  ('d0000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001',
   'CRM Champion','CRM 95%+ por 7 dias consecutivos','crm','{"crm_streak_days":7}'::jsonb,150,'rare',true),
  ('d0000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001',
   'Streak Mestre','21 dias de atividade consecutivos','engajamento','{"streak_days":21}'::jsonb,200,'rare',true),
  ('d0000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001',
   'Top da Semana','1º lugar no ranking semanal','ranking','{"weekly_rank":1}'::jsonb,250,'epic',true),
  ('d0000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001',
   'Closer Expert','3 fechamentos em uma única semana','vendas','{"weekly_closes":3}'::jsonb,300,'epic',true),
  ('d0000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000001',
   'Lenda do Time','XP total acima de 10.000','xp','{"total_xp":10000}'::jsonb,500,'legendary',true)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 11. USER BADGES
-- ============================================================

INSERT INTO public.user_badges (user_id, badge_id, earned_at)
VALUES
  -- Carlos: 3 badges
  ('b0000000-0000-0000-0000-000000000002','d0000000-0000-0000-0000-000000000001', now() - interval '25 days'),
  ('b0000000-0000-0000-0000-000000000002','d0000000-0000-0000-0000-000000000003', now() - interval '5 days'),
  ('b0000000-0000-0000-0000-000000000002','d0000000-0000-0000-0000-000000000005', now() - interval '2 days'),
  -- Ana: 2 badges
  ('b0000000-0000-0000-0000-000000000003','d0000000-0000-0000-0000-000000000001', now() - interval '20 days'),
  ('b0000000-0000-0000-0000-000000000003','d0000000-0000-0000-0000-000000000002', now() - interval '12 days'),
  -- Diego: 1 badge
  ('b0000000-0000-0000-0000-000000000004','d0000000-0000-0000-0000-000000000001', now() - interval '18 days'),
  -- Bruna: 2 badges
  ('b0000000-0000-0000-0000-000000000005','d0000000-0000-0000-0000-000000000001', now() - interval '22 days'),
  ('b0000000-0000-0000-0000-000000000005','d0000000-0000-0000-0000-000000000003', now() - interval '15 days'),
  -- Lucas: 3 badges
  ('b0000000-0000-0000-0000-000000000006','d0000000-0000-0000-0000-000000000001', now() - interval '28 days'),
  ('b0000000-0000-0000-0000-000000000006','d0000000-0000-0000-0000-000000000004', now() - interval '7 days'),
  ('b0000000-0000-0000-0000-000000000006','d0000000-0000-0000-0000-000000000005', now() - interval '1 day'),
  -- Mariana: 1 badge
  ('b0000000-0000-0000-0000-000000000007','d0000000-0000-0000-0000-000000000001', now() - interval '8 days')
ON CONFLICT (user_id, badge_id) DO NOTHING;


-- ============================================================
-- 12. AI MISSIONS
-- ============================================================

INSERT INTO public.ai_missions (id, organization_id, user_id, title, description, area, difficulty, xp_reward, status, playbook_content, completed_at, created_at)
VALUES
-- Carlos — 2 ativas + 2 concluídas
('e0000000-0001-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002',
 'Revisar script de proposta para upsell',
 'Reescreva seu pitch de abertura de valor antes de apresentar preço. Teste em 3 reuniões esta semana.',
 'sales_process',2,100,'pending',
 '{"por_que_voce_recebe":"Seu perfil D vai direto ao preço — construir valor primeiro aumenta o ticket médio.","passos":["Mapeie 2 dores específicas do cliente antes de abrir proposta","Apresente o ROI esperado antes de mencionar custo","Só revele preço após confirmar que o cliente entende o valor"],"nao_fazer":"Não apresente preço nos primeiros 10 minutos da reunião.","frase_gatilho":"Quando o cliente perguntar o preço logo: ''Antes de falar em investimento, preciso entender qual resultado você precisa — me conta mais sobre...''","simulador_link":true}'::jsonb,
 null, now() - interval '3 days'),

('e0000000-0001-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002',
 'Sequência de follow-up para 5 propostas abertas',
 'Você tem 5 propostas sem resposta há mais de 3 dias. Faça follow-up estruturado com cada uma hoje.',
 'sales_process',1,50,'in_progress',
 '{"por_que_voce_recebe":"Propostas sem follow-up são receita perdida — perfil D costuma abrir novas oportunidades sem fechar as existentes.","passos":["Liste todas as propostas sem resposta há >3 dias no CRM","Ligue ou mande áudio para cada uma hoje com uma pergunta aberta","Registre o próximo passo no CRM imediatamente após o contato"],"nao_fazer":"Não envie email genérico — o contato precisa ser personalizado.","frase_gatilho":"''Quero entender se ainda faz sentido para vocês neste momento — o que falta para avançar?''","simulador_link":false}'::jsonb,
 null, now() - interval '1 day'),

('e0000000-0001-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002',
 'Atualizar CRM antes das 18h por 5 dias',
 'Registre todas as interações do dia no CRM antes das 18h por 5 dias consecutivos.',
 'tools_technology',1,50,'completed',
 null, now() - interval '8 days', now() - interval '15 days'),

('e0000000-0001-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002',
 'Gravar pitch de abertura em vídeo',
 'Grave um vídeo de 2 minutos do seu pitch de abertura e compartilhe com a Sofia para feedback.',
 'sales_process',2,100,'completed',
 null, now() - interval '5 days', now() - interval '20 days'),

-- Ana — 2 ativas + 1 concluída
('e0000000-0002-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000003',
 'Pedir 3 indicações para clientes ativos',
 'Após cada reunião de sucesso esta semana, peça indicação para pelo menos 1 pessoa do relacionamento do cliente.',
 'lead_generation',2,100,'pending',
 '{"por_que_voce_recebe":"Seu perfil I tem o maior índice de indicações da equipe — explorar isso sistematicamente pode dobrar seu pipeline.","passos":["Identifique os 5 clientes mais satisfeitos na sua carteira","Após a próxima reunião positiva, pergunte: ''Você conhece alguém que teria o mesmo desafio que resolvemos juntos?''","Registre cada indicação no CRM com o nome do indicador"],"nao_fazer":"Não peça indicação no início da reunião ou quando o cliente parecer neutro.","frase_gatilho":"''Fico feliz que tenha funcionado para você — tem alguém no seu círculo que poderia ter o mesmo benefício?''","simulador_link":false}'::jsonb,
 null, now() - interval '2 days'),

('e0000000-0002-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000003',
 'Identificar 2 oportunidades de upsell na carteira',
 'Analise os contratos dos seus 10 clientes principais e identifique 2 onde há espaço para upsell.',
 'sales_process',2,100,'in_progress',
 null, null, now() - interval '4 days'),

('e0000000-0002-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000003',
 'Ligar para 30 leads em 5 dias',
 'Complete 30 ligações de prospecção qualificada em 5 dias úteis.',
 'lead_generation',2,100,'completed',
 null, now() - interval '6 days', now() - interval '15 days'),

-- Diego — 2 ativas + 1 concluída
('e0000000-0003-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000004',
 'Definir critério de avanço no funil em 48h',
 'Estabeleça uma regra clara: se uma proposta fica >48h sem resposta, avança para follow-up ou encerra. Aplique hoje.',
 'sales_process',2,100,'pending',
 '{"por_que_voce_recebe":"Seu perfil C tende a esperar o momento perfeito para avançar — isso aumenta o ciclo de vendas.","passos":["Liste todas as propostas em aberto com data do último contato","Defina: se >48h sem resposta, ligar. Se >5 dias, encerrar oportunidade","Configure alerta no CRM para esse critério"],"nao_fazer":"Não espere o cliente voltar sozinho — a iniciativa precisa ser sua.","frase_gatilho":"''Quero garantir que tenhamos uma resposta antes de avançar para outros projetos — qual o status da aprovação de vocês?''","simulador_link":false}'::jsonb,
 null, now() - interval '2 days'),

('e0000000-0003-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000004',
 'Preparar estudo de caso para próxima proposta',
 'Para a próxima proposta grande, inclua um estudo de caso de cliente similar como prova social.',
 'sales_process',1,50,'in_progress',
 null, null, now() - interval '5 days'),

('e0000000-0003-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000004',
 'Fazer 5 ligações em menos de 1h',
 'Treine velocidade: complete 5 ligações de follow-up curtas (máx. 5 min cada) em menos de 1 hora.',
 'sales_process',1,50,'completed',
 null, now() - interval '12 days', now() - interval '18 days'),

-- Bruna — 1 ativa (em risco de burnout, poucas missões)
('e0000000-0004-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000005',
 'Mapear 5 clientes inativos para reativação',
 'Identifique 5 clientes que não compraram nos últimos 6 meses e crie um plano de recontato personalizado.',
 'lead_generation',1,50,'pending',
 '{"por_que_voce_recebe":"Seu perfil S tem grande facilidade com relacionamentos existentes — reativar clientes inativos é onde você tem vantagem natural.","passos":["No CRM, filtre clientes com última compra há >6 meses","Para cada um, identifique 1 dor atual que poderia ter mudado","Prepare mensagem personalizada referenciando o histórico em comum"],"nao_fazer":"Não envie mensagem genérica — mencione algo específico da relação anterior.","frase_gatilho":"''Estava pensando em você porque vimos um movimento no seu setor que pode ser relevante — posso te contar em 10 minutos?''","simulador_link":false}'::jsonb,
 null, now() - interval '9 days'),

-- Lucas — 2 ativas + 2 concluídas
('e0000000-0005-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000006',
 'Manter CRM 100% por 5 dias seguidos',
 'Consistência é o seu ponto de melhoria. Atualize o CRM todos os dias esta semana antes das 17h.',
 'tools_technology',1,50,'in_progress',
 null, null, now() - interval '2 days'),

('e0000000-0005-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000006',
 'Fechar 3 negócios esta semana',
 'Meta agressiva: você tem capacidade. Identifique as 3 oportunidades com maior chance de fechar esta semana e foque nelas.',
 'sales_process',3,200,'pending',
 null, null, now() - interval '1 day'),

('e0000000-0005-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000006',
 'Fazer 50 ligações em 5 dias',
 'Semana de volume: 50 ligações qualificadas em 5 dias úteis.',
 'lead_generation',3,200,'completed',
 null, now() - interval '10 days', now() - interval '18 days'),

('e0000000-0005-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000006',
 'Definir meta diária de 10 ligações',
 'Quebre a meta semanal em metas diárias de 10 ligações. Registre cada dia no CRM.',
 'tools_technology',1,50,'completed',
 null, now() - interval '7 days', now() - interval '20 days'),

-- Mariana — 2 ativas
('e0000000-0006-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000007',
 'Fazer 20 ligações de prospecção esta semana',
 'Construa o hábito de prospecção ativa. Meta: 20 ligações qualificadas em 5 dias.',
 'lead_generation',1,50,'pending',
 '{"por_que_voce_recebe":"Volume de ligações é o principal acelerador para vendedores iniciantes com perfil I — cada ligação é uma oportunidade de conexão.","passos":["Separe 2 horas por dia exclusivamente para ligações","Use um script simples de abertura e adaptação — não precisa ser perfeito","Registre todas no CRM com resultado: conectou/não atendeu/voltará"],"nao_fazer":"Não passe mais de 15 minutos numa ligação de prospecção fria.","frase_gatilho":"''Olá, sei que você tem 2 minutos? Estou falando com gestores de [área] que querem resolver [problema] — faz sentido para você?''","simulador_link":true}'::jsonb,
 null, now() - interval '1 day'),

('e0000000-0006-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000007',
 'Atualizar perfil e pipeline no CRM',
 'Complete 100% das informações de todos os leads ativos no CRM até o fim do dia.',
 'tools_technology',1,50,'in_progress',
 null, null, now() - interval '3 days');


-- ============================================================
-- 13. COMMISSION CONFIG
-- ============================================================

INSERT INTO public.commission_configs (organization_id, aliquota_base, acelerador_threshold, acelerador_rate, bonus_missao, salario_base, periodo, elegibilidade)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  4,    -- 4% sobre receita
  110,  -- acelerador ativa em 110% da meta
  6,    -- 6% quando acima da meta
  75,   -- R$ 75 por missão concluída
  2500, -- salário base R$ 2.500
  'mensal',
  80    -- elegível se atingiu 80% da meta
) ON CONFLICT (organization_id) DO UPDATE SET
  aliquota_base         = EXCLUDED.aliquota_base,
  acelerador_threshold  = EXCLUDED.acelerador_threshold,
  acelerador_rate       = EXCLUDED.acelerador_rate,
  bonus_missao          = EXCLUDED.bonus_missao,
  salario_base          = EXCLUDED.salario_base;


-- ============================================================
-- 14. CATÁLOGO DE RECOMPENSAS
-- ============================================================

INSERT INTO public.rewards_catalog (id, organization_id, name, description, cost_xp, quantity, active)
VALUES
  ('f0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',
   'Folga de Meio Dia','Uma tarde livre para usar como quiser',500, null, true),
  ('f0000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001',
   'Day Off','Um dia de folga extra (combinar com gestora)',1000, 2, true),
  ('f0000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001',
   'Vale iFood R$ 100','Crédito de R$ 100 no iFood',1500, null, true),
  ('f0000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001',
   'Curso Online','Acesso a um curso de sua escolha (até R$ 300)',2000, null, true),
  ('f0000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001',
   'Jantar para 2','Jantar em restaurante parceiro para 2 pessoas',3000, 3, true),
  ('f0000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001',
   'Home Office Equipment','R$ 500 para equipamento de home office',5000, 2, true)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 15. CHALLENGES (Desafios)
-- ============================================================

INSERT INTO public.challenges (id, organization_id, title, description, type, criteria, xp_reward, bonus_reward, start_date, end_date, active)
VALUES
  ('a1000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',
   'Desafio CRM Semanal',
   'Mantenha o CRM 95%+ atualizado por 7 dias consecutivos. Toda a equipe precisa participar.',
   'team',
   '{"crm_target": 95, "days": 7}'::jsonb,
   300, 0,
   now() - interval '3 days', now() + interval '11 days', true),

  ('a1000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001',
   'Sprint de Volume',
   '50 ligações qualificadas em 5 dias úteis. Desafio individual — quem chegar primeiro ganha bônus.',
   'individual',
   '{"calls_target": 50, "days": 5}'::jsonb,
   200, 300,
   now() - interval '1 day', now() + interval '4 days', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.challenge_participants (challenge_id, user_id, progress, completed)
VALUES
  ('a1000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002', 88, false),
  ('a1000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000003', 82, false),
  ('a1000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000004', 68, false),
  ('a1000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000005', 75, false),
  ('a1000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000006', 72, false),
  ('a1000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000007', 60, false),
  ('a1000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000002', 45, false),
  ('a1000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000006', 30, false)
ON CONFLICT (challenge_id, user_id) DO NOTHING;


-- ============================================================
-- 16. METAS DO PROGRAMA
-- ============================================================

INSERT INTO public.program_goals (organization_id, company_goal, team_goal, individual_goals)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  '{
    "kpiFinanceiro": "Receita Bruta",
    "valorAtual": "R$ 84.200",
    "valorMeta": "R$ 120.000",
    "prazo": "2026-04-30",
    "metrica": "R$"
  }'::jsonb,
  '{
    "kpiComportamental": "CRM Atualizado",
    "valorAtual": "79%",
    "valorMeta": "95%",
    "prazo": "2026-04-30",
    "medicao": "manual"
  }'::jsonb,
  '[
    {"user_id":"b0000000-0000-0000-0000-000000000002","goal":"Fechar 8 novos contratos em abril com ticket médio acima de R$ 9.000"},
    {"user_id":"b0000000-0000-0000-0000-000000000003","goal":"Converter 30% dos leads em propostas e ativar 3 indicações"},
    {"user_id":"b0000000-0000-0000-0000-000000000004","goal":"Reduzir ciclo de vendas para menos de 15 dias — avançar proposta em 48h"},
    {"user_id":"b0000000-0000-0000-0000-000000000005","goal":"5 prospecções ativas por semana com foco em clientes inativos da carteira"},
    {"user_id":"b0000000-0000-0000-0000-000000000006","goal":"Consistência: mínimo 30 ligações por semana sem semanas abaixo de 20"},
    {"user_id":"b0000000-0000-0000-0000-000000000007","goal":"Atingir 20 ligações por semana e fechar pelo menos 2 contratos no mês"}
  ]'::jsonb
) ON CONFLICT (organization_id) DO UPDATE SET
  company_goal      = EXCLUDED.company_goal,
  team_goal         = EXCLUDED.team_goal,
  individual_goals  = EXCLUDED.individual_goals;


-- ============================================================
-- 17. NOTIFICAÇÕES
-- ============================================================

INSERT INTO public.notifications (organization_id, user_id, sender_id, message, read)
VALUES
  ('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000001',
   'Sofia definiu sua meta de abril: Fechar 8 novos contratos com ticket médio acima de R$ 9.000', false),
  ('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000003','b0000000-0000-0000-0000-000000000001',
   'Sofia definiu sua meta de abril: Converter 30% dos leads em propostas e ativar 3 indicações', false),
  ('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000004','b0000000-0000-0000-0000-000000000001',
   'Sofia definiu sua meta de abril: Reduzir ciclo de vendas para menos de 15 dias', false),
  ('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000005','b0000000-0000-0000-0000-000000000001',
   'Sofia definiu sua meta de abril: 5 prospecções ativas por semana, foco em clientes inativos', true),
  ('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000006','b0000000-0000-0000-0000-000000000001',
   'Sofia definiu sua meta de abril: Consistência — mínimo 30 ligações por semana', false),
  ('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000007','b0000000-0000-0000-0000-000000000001',
   'Sofia definiu sua meta de abril: 20 ligações por semana e fechar 2 contratos no mês', false),
  -- Notificação de missão
  ('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000006','b0000000-0000-0000-0000-000000000001',
   'Parabéns Lucas! Você desbloqueou o badge "Top da Semana" 🏆', false),
  -- Lembrete de desafio
  ('10000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000001',
   'Desafio CRM: você está em 88%. Mais 7% para ativar o bônus da equipe!', false);


-- ============================================================
-- 18. AUTOMATION RULES (Regras e Gatilhos)
-- ============================================================

INSERT INTO public.automation_rules (organization_id, name, description, trigger_event, action_type, params, icon_key, icon_bg, icon_color, active, is_system, sort_order)
VALUES
  ('10000000-0000-0000-0000-000000000001',
   'Badge ao completar primeira missão',
   'Concede o badge "Primeira Missão" automaticamente quando um vendedor conclui sua primeira missão.',
   'mission_completed', 'grant_badge',
   '[{"badge_id": "d0000000-0000-0000-0000-000000000001"}]'::jsonb,
   'Award', 'bg-amber-500/10', 'text-amber-500', true, true, 1),

  ('10000000-0000-0000-0000-000000000001',
   'Notificar gestor — streak zerado',
   'Envia alerta para o gestor quando um vendedor fica 5+ dias sem atividade.',
   'streak_broken', 'notify_manager',
   '[{"days_threshold": 5}]'::jsonb,
   'AlertTriangle', 'bg-red-500/10', 'text-red-500', true, true, 2),

  ('10000000-0000-0000-0000-000000000001',
   'Bônus XP por CRM 100%',
   'Concede 50 XP extra quando o vendedor atualiza 100% do CRM no dia.',
   'crm_fully_updated', 'grant_xp',
   '[{"xp_amount": 50}]'::jsonb,
   'Database', 'bg-blue-500/10', 'text-blue-500', true, false, 3),

  ('10000000-0000-0000-0000-000000000001',
   'Reconhecimento público — top semanal',
   'Publica no feed uma mensagem de reconhecimento para o 1º do ranking semanal.',
   'weekly_ranking_close', 'post_feed',
   '[{"message_template": "🏆 {name} foi o Top Performer desta semana com {xp} XP!"}]'::jsonb,
   'Trophy', 'bg-yellow-500/10', 'text-yellow-500', true, false, 4)
ON CONFLICT DO NOTHING;


-- ============================================================
-- RESULTADO ESPERADO
-- ============================================================
-- Usuários de teste:
--   sofia@techsales.com   / Vamo@2025  (Gestora)
--   carlos@techsales.com  / Vamo@2025  (Vendedor - Nível 5 Closer)
--   ana@techsales.com     / Vamo@2025  (Vendedora - Nível 4 Hunter)
--   diego@techsales.com   / Vamo@2025  (Vendedor - Nível 4 Hunter)
--   bruna@techsales.com   / Vamo@2025  (Vendedora - Nível 3, streak 0)
--   lucas@techsales.com   / Vamo@2025  (Vendedor - Nível 6 Elite)
--   mariana@techsales.com / Vamo@2025  (Vendedora - Nível 2, iniciante)
-- ============================================================
