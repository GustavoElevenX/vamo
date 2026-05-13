# VAMO

Sistema Operacional de Desempenho Comercial que conecta CRM, metas, KPIs, comissão, IA, PDI, reconhecimento, saúde e rotina diaria em um ciclo unico de consequencia.

Na VAMO, um registro operacional não deve ficar isolado: ele precisa virar diagnóstico, prioridade, ação sugerida, desenvolvimento, recompensa, alerta, previsão ou aprendizado para a IA.

## Como rodar

```bash
npm install
npm run dev
```

Build de producao:

```bash
npm run build
```

Lint:

```bash
npm run lint
```

## Variaveis de ambiente

Crie um `.env` com as chaves usadas pelo projeto:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENROUTER_API_KEY=
```

`OPENROUTER_API_KEY` e opcional para desenvolvimento local. Quando ausente, os serviços de IA contextual retornam um fallback operacional, ainda conectado ao contexto real do sistema.

## Arquitetura basica

- `src/app/(platform)`: rotas principais da plataforma.
- `src/app/api`: APIs autenticadas do produto.
- `src/components`: componentes de UI e blocos reutilizaveis.
- `src/lib/services`: serviços de dominio, integrações e regras operacionais.
- `src/lib/supabase`: clients Supabase.
- `supabase/migrations`: migrations incrementais do banco.

## Desempenho OS

A migration `033_performance_os_pdi.sql` adiciona a camada central:

- `performance_events`: evento central de cada ação relevante.
- `event_impacts`: declaracao dos modulos impactados pelo evento.
- `action_recommendations`: recomendações acionáveis, sempre com próxima ação.
- `entity_relationships`: ligacao flexivel entre CRM, KPI, PDI, XP, comissão e eventos.
- `contextual_ai_outputs`: auditoria de scripts, nudges, prioridades e explicações da IA.

Serviços principais:

- `desempenho-os.service.ts`
- `action-recommendation.service.ts`
- `contextual-ai.service.ts`

## PDI aplicado

O PDI não e biblioteca de curso. Ele nasce de gap real e volta para a rotina comercial:

```txt
Gap detectado
-> PDI recomendado
-> gestor aprova ou ajusta
-> treino curto
-> aplicação em oportunidade, retorno, proposta ou simulação
-> evidência
-> evolução por KPI ou resultado
```

Tabelas principais:

- `pdi_gaps`
- `pdi_plans`
- `training_modules`
- `pdi_plan_items`
- `pdi_applications`
- `pdi_evolution_evidence`
- `pdi_roi_summary`

Telas:

- Vendedor: `/desenvolvimento/pdi`
- Gestor: `/monitoramento/desenvolvimento`

## Fluxos conectados

- Criacao/alteracao de meta gera evento, impactos em Hoje, Gestor, metas, missões, comissão e previsão, alem de recomendações para vendedores.
- Atividade no CRM gera evento, atualiza KPI quando aplicavel, cria impactos em previsão, comissão, missões, XP e Hoje.
- Mudanca de etapa da oportunidade gera evento, recalcula impacto de previsão e comissão prevista, e cria recomendação contextual.
- Check-in de saúde gera evento; energia baixa cria calibragem, reduz intensidade sugerida e recomenda conversa de apoio.
- XP agora aceita `performance_event_id`, `evidence` e `impact_expected`, evitando gamificacao sem evidência.
- Comissão ganhou suporte a recibos de pagamento por oportunidade e explicação de prevista, liberada, pendente e bloqueada.
- PDI gerado por IA fica aguardando aprovação do gestor; missão vinculada só libera ao vendedor depois da aprovação.
- Aplicação de PDI registra `deal_id` e `account_id`, permitindo rastrear cliente/carteira fora do JSON de evidência.

## APIs novas

- `GET/POST /api/desempenho-events`
- `GET/POST/PATCH /api/action-recommendations`
- `GET/POST /api/pdi/gaps`
- `GET/POST/PATCH /api/pdi/plans`
- `GET/POST /api/pdi/applications`
- `GET/POST /api/health/calibration`
- `POST /api/contextual-ai/oportunidade-script`
- `GET /api/contextual-ai/today-priorities`
- `GET /api/contextual-ai/manager-decisions`
- `GET /api/commission/trace`

## Supabase e migrations

Não edite migrations antigas para reescrever histórico. Crie sempre migrations incrementais em `supabase/migrations`.

A migration `033_performance_os_pdi.sql` ativa RLS nas novas tabelas e segue o modelo multi-tenant:

- gestores/admins acessam dados da organização;
- vendedores acessam os próprios eventos, recomendações, gaps, planos, aplicacoes e calibragens;
- inserts validam `organization_id` pelo usuário autenticado quando RLS esta em uso.

## Como testar a feature

1. Salve metas em `/objetivos/metas` e verifique recomendações no Hoje do vendedor.
2. Registre atividade em `/crm/[id]` e veja evento, impacto, XP com evidência e próxima ação.
3. Mova uma oportunidade de etapa e confira previsão/comissão prevista e recomendação contextual.
4. Envie check-in com energia baixa e confira calibragem de saúde.
5. Crie gap/PDI via API ou pela tela de gestor e registre aplicação em `/desenvolvimento/pdi`.
6. Acesse `/monitoramento/desenvolvimento` para acompanhar gaps, PDIs e ROI.

## Como evoluir

- Adicionar triggers ou jobs para detectar oportunidades parados automaticamente.
- Conectar regras reais de comissão ao recebimento em `deal_payment_receipts`.
- Alimentar `pdi_evolution_evidence` a partir de melhoria de KPI e simulações.
- Exibir timeline de `performance_events` em mais entidades.
- Transformar recomendações aceitas em tarefas, missão ou mensagem conforme o fluxo.
