# VAMO

Sistema Operacional de Performance Comercial que conecta CRM, metas, KPIs, comissao, IA, PDI, reconhecimento, saude e rotina diaria em um ciclo unico de consequencia.

Na VAMO, um registro operacional nao deve ficar isolado: ele precisa virar diagnostico, prioridade, acao sugerida, desenvolvimento, recompensa, alerta, forecast ou aprendizado para a IA.

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

`OPENROUTER_API_KEY` e opcional para desenvolvimento local. Quando ausente, os servicos de IA contextual retornam um fallback operacional, ainda conectado ao contexto real do sistema.

## Arquitetura basica

- `src/app/(platform)`: rotas principais da plataforma.
- `src/app/api`: APIs autenticadas do produto.
- `src/components`: componentes de UI e blocos reutilizaveis.
- `src/lib/services`: servicos de dominio, integracoes e regras operacionais.
- `src/lib/supabase`: clients Supabase.
- `supabase/migrations`: migrations incrementais do banco.

## Performance OS

A migration `033_performance_os_pdi.sql` adiciona a camada central:

- `performance_events`: evento central de cada acao relevante.
- `event_impacts`: declaracao dos modulos impactados pelo evento.
- `action_recommendations`: recomendacoes acionaveis, sempre com proxima acao.
- `entity_relationships`: ligacao flexivel entre CRM, KPI, PDI, XP, comissao e eventos.
- `contextual_ai_outputs`: auditoria de scripts, nudges, prioridades e explicacoes da IA.

Servicos principais:

- `performance-os.service.ts`
- `action-recommendation.service.ts`
- `contextual-ai.service.ts`

## PDI aplicado

O PDI nao e biblioteca de curso. Ele nasce de gap real e volta para a rotina comercial:

```txt
Gap detectado
-> PDI recomendado
-> gestor aprova ou ajusta
-> treino curto
-> aplicacao em deal, follow-up, proposta ou simulacao
-> evidencia
-> evolucao por KPI ou resultado
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

- Criacao/alteracao de meta gera evento, impactos em Hoje, Gestor, metas, missoes, comissao e forecast, alem de recomendacoes para vendedores.
- Atividade no CRM gera evento, atualiza KPI quando aplicavel, cria impactos em forecast, comissao, missoes, XP e Hoje.
- Mudanca de etapa do deal gera evento, recalcula impacto de forecast e comissao prevista, e cria recomendacao contextual.
- Check-in de saude gera evento; energia baixa cria calibragem, reduz intensidade sugerida e recomenda conversa de apoio.
- XP agora aceita `performance_event_id`, `evidence` e `impact_expected`, evitando gamificacao sem evidencia.
- Comissao ganhou suporte a recibos de pagamento por deal e explicacao de prevista, liberada, pendente e bloqueada.

## APIs novas

- `GET/POST /api/performance-events`
- `GET/POST/PATCH /api/action-recommendations`
- `GET/POST /api/pdi/gaps`
- `GET/POST/PATCH /api/pdi/plans`
- `GET/POST /api/pdi/applications`
- `GET/POST /api/health/calibration`
- `POST /api/contextual-ai/deal-script`
- `GET /api/contextual-ai/today-priorities`
- `GET /api/contextual-ai/manager-decisions`
- `GET /api/commission/trace`

## Supabase e migrations

Nao edite migrations antigas para reescrever historico. Crie sempre migrations incrementais em `supabase/migrations`.

A migration `033_performance_os_pdi.sql` ativa RLS nas novas tabelas e segue o modelo multi-tenant:

- gestores/admins acessam dados da organizacao;
- vendedores acessam os proprios eventos, recomendacoes, gaps, planos, aplicacoes e calibragens;
- inserts validam `organization_id` pelo usuario autenticado quando RLS esta em uso.

## Como testar a feature

1. Salve metas em `/objetivos/metas` e verifique recomendacoes no Hoje do vendedor.
2. Registre atividade em `/crm/[id]` e veja evento, impacto, XP com evidencia e proxima acao.
3. Mova um deal de etapa e confira forecast/comissao prevista e recomendacao contextual.
4. Envie check-in com energia baixa e confira calibragem de saude.
5. Crie gap/PDI via API ou pela tela de gestor e registre aplicacao em `/desenvolvimento/pdi`.
6. Acesse `/monitoramento/desenvolvimento` para acompanhar gaps, PDIs e ROI.

## Como evoluir

- Adicionar triggers ou jobs para detectar deals parados automaticamente.
- Conectar regras reais de comissao ao recebimento em `deal_payment_receipts`.
- Alimentar `pdi_evolution_evidence` a partir de melhoria de KPI e simulacoes.
- Exibir timeline de `performance_events` em mais entidades.
- Transformar recomendacoes aceitas em tarefas, missao ou mensagem conforme o fluxo.
