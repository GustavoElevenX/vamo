-- ============ SEED: Diagnostic Template ============
-- Template padrão com 16 perguntas nas 4 áreas do Framework P.G.O

INSERT INTO diagnostic_templates (id, name, version) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Diagnóstico de Performance Comercial v1', 1);

-- ÁREA 1: Geração de Leads (4 perguntas)
INSERT INTO diagnostic_questions (template_id, area, question_text, options, order_index, weight) VALUES
('00000000-0000-0000-0000-000000000001', 'lead_generation',
 'Como é feita a prospecção de novos clientes atualmente?',
 '[{"label": "Não há processo definido", "value": 0}, {"label": "Processo informal/esporádico", "value": 1}, {"label": "Processo estruturado e documentado", "value": 2}]',
 1, 1),
('00000000-0000-0000-0000-000000000001', 'lead_generation',
 'Existem canais de geração de leads definidos e mensurados?',
 '[{"label": "Não existem canais definidos", "value": 0}, {"label": "Alguns canais, sem mensuração consistente", "value": 1}, {"label": "Canais definidos com métricas claras", "value": 2}]',
 2, 1),
('00000000-0000-0000-0000-000000000001', 'lead_generation',
 'Qual a taxa de conversão de leads em oportunidades qualificadas?',
 '[{"label": "Desconhecida ou abaixo de 10%", "value": 0}, {"label": "Entre 10% e 30%", "value": 1}, {"label": "Acima de 30% e monitorada", "value": 2}]',
 3, 1),
('00000000-0000-0000-0000-000000000001', 'lead_generation',
 'O time utiliza alguma ferramenta de CRM para gestão de leads?',
 '[{"label": "Não utiliza CRM", "value": 0}, {"label": "Utiliza parcialmente ou planilhas", "value": 1}, {"label": "CRM implementado e utilizado por todos", "value": 2}]',
 4, 1),

-- ÁREA 2: Processo de Vendas (4 perguntas)
('00000000-0000-0000-0000-000000000001', 'sales_process',
 'Existe um funil de vendas definido com etapas claras?',
 '[{"label": "Não existe funil definido", "value": 0}, {"label": "Funil informal, sem padronização", "value": 1}, {"label": "Funil documentado com critérios de passagem", "value": 2}]',
 5, 1),
('00000000-0000-0000-0000-000000000001', 'sales_process',
 'Como são feitas as propostas comerciais?',
 '[{"label": "Sem padrão, cada vendedor faz do seu jeito", "value": 0}, {"label": "Template básico, mas pouca padronização", "value": 1}, {"label": "Propostas padronizadas e personalizáveis", "value": 2}]',
 6, 1),
('00000000-0000-0000-0000-000000000001', 'sales_process',
 'Qual o tempo médio do ciclo de vendas e ele é monitorado?',
 '[{"label": "Desconhecido", "value": 0}, {"label": "Conhecido mas não otimizado", "value": 1}, {"label": "Monitorado e com metas de redução", "value": 2}]',
 7, 1),
('00000000-0000-0000-0000-000000000001', 'sales_process',
 'Existe um script ou roteiro de vendas padronizado?',
 '[{"label": "Não existe roteiro", "value": 0}, {"label": "Existe mas não é seguido consistentemente", "value": 1}, {"label": "Roteiro padronizado e treinado com a equipe", "value": 2}]',
 8, 1),

-- ÁREA 3: Gestão de Equipe (4 perguntas)
('00000000-0000-0000-0000-000000000001', 'team_management',
 'Como são definidas as metas individuais e coletivas?',
 '[{"label": "Não há metas definidas", "value": 0}, {"label": "Metas gerais sem individualização", "value": 1}, {"label": "Metas SMART individuais e coletivas", "value": 2}]',
 9, 1),
('00000000-0000-0000-0000-000000000001', 'team_management',
 'Existe uma rotina de reuniões de acompanhamento (1:1, daily)?',
 '[{"label": "Não há rotina de reuniões", "value": 0}, {"label": "Reuniões esporádicas sem pauta", "value": 1}, {"label": "Rotina estruturada com frequência definida", "value": 2}]',
 10, 1),
('00000000-0000-0000-0000-000000000001', 'team_management',
 'Como é feito o onboarding de novos vendedores?',
 '[{"label": "Não há processo de onboarding", "value": 0}, {"label": "Treinamento básico informal", "value": 1}, {"label": "Programa de onboarding documentado", "value": 2}]',
 11, 1),
('00000000-0000-0000-0000-000000000001', 'team_management',
 'Existe um plano de desenvolvimento e capacitação da equipe?',
 '[{"label": "Não existe plano", "value": 0}, {"label": "Treinamentos pontuais sem planejamento", "value": 1}, {"label": "Plano contínuo de desenvolvimento", "value": 2}]',
 12, 1),

-- ÁREA 4: Ferramentas e Tecnologia (4 perguntas)
('00000000-0000-0000-0000-000000000001', 'tools_technology',
 'Quais ferramentas de vendas o time utiliza no dia a dia?',
 '[{"label": "Apenas WhatsApp/email sem organização", "value": 0}, {"label": "Algumas ferramentas mas sem integração", "value": 1}, {"label": "Stack de vendas integrado e otimizado", "value": 2}]',
 13, 1),
('00000000-0000-0000-0000-000000000001', 'tools_technology',
 'Os dados de vendas são centralizados e acessíveis?',
 '[{"label": "Dados dispersos em planilhas/anotações", "value": 0}, {"label": "Parcialmente centralizados", "value": 1}, {"label": "Totalmente centralizados e em tempo real", "value": 2}]',
 14, 1),
('00000000-0000-0000-0000-000000000001', 'tools_technology',
 'Existem dashboards ou relatórios de performance?',
 '[{"label": "Não existem relatórios", "value": 0}, {"label": "Relatórios manuais/esporádicos", "value": 1}, {"label": "Dashboards automatizados e atualizados", "value": 2}]',
 15, 1),
('00000000-0000-0000-0000-000000000001', 'tools_technology',
 'A equipe utiliza automações no processo de vendas?',
 '[{"label": "Nenhuma automação", "value": 0}, {"label": "Automações básicas (email, agendamento)", "value": 1}, {"label": "Automações avançadas integradas ao fluxo", "value": 2}]',
 16, 1);

-- ============ SEED: Default XP Levels (template - will be cloned per org) ============
-- These serve as the default template. When a new org is created, these are cloned.
-- Using a special null org_id for the template
-- In practice, the app will INSERT these for each new org.
