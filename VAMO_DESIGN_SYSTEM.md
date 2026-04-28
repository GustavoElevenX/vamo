# VAMO — Arquivo de Contexto de Design

Use este arquivo como referência completa para redesenhar qualquer tela existente do VAMO ou criar novas telas. Todas as decisões visuais, de layout e de UX devem seguir este documento.

---

## O que é o VAMO

Plataforma SaaS de gestão comercial gamificada. Dois perfis de usuário:
- **Gestor**: visão de equipe, métricas agregadas, alertas, nudges de IA
- **Vendedor**: metas pessoais, XP, gamificação, missões, comissão

Stack: Next.js + Tailwind + Supabase. O redesign é feito em HTML/React para prototipagem.

---

## Paleta de cores

```css
/* DARK MODE (padrão) */
--bg:         oklch(0.055 0 0);              /* fundo principal #0A0A0A */
--card:       oklch(0.115 0.005 145 / 0.7); /* card com blur */
--sidebar-bg: oklch(0.17 0 0);              /* sidebar cinza escuro */
--fg:         oklch(0.97 0 0);              /* texto principal */
--fg-muted:   oklch(0.58 0 0);              /* texto secundário */
--primary:    oklch(0.87 0.29 145);         /* Electric Green */
--border:     oklch(1 0 0 / 0.07);          /* borda sutil */
--surface:    oklch(0.14 0.003 145);        /* superfície elevada */

/* LIGHT MODE */
--bg:         oklch(0.985 0.003 145);
--card:       oklch(1 0 0 / 0.85);
--sidebar-bg: oklch(0.97 0 0 / 0.92);
--fg:         oklch(0.08 0 0);
--fg-muted:   oklch(0.45 0 0);
--primary:    oklch(0.45 0.18 145);

/* CORES DE SUPORTE (iguais em dark e light) */
--amber:  oklch(0.77 0.19 70);   /* atenção, streak médio */
--rose:   oklch(0.65 0.24 16);   /* erro, crítico, burnout */
--blue:   oklch(0.70 0.17 215);  /* IA, informação */
--violet: oklch(0.69 0.17 290);  /* gamificação, badges */
--orange: oklch(0.75 0.18 45);   /* streak, energia */
```

**Semântica:**
- Green → positivo, ativo, XP, IA, crescimento
- Amber → atenção, engajamento baixo, dificuldade média
- Rose → erro, crítico, burnout, gargalo, dificuldade alta
- Blue → insights de IA, informação, KPIs de volume
- Violet → conquistas, badges, gamificação
- Orange → streak, urgência positiva

---

## Tipografia

Fonte: **DM Sans** (Google Fonts). Sempre importar:
```html
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&display=swap" rel="stylesheet" />
```

| Elemento | Tamanho | Peso | Observação |
|---|---|---|---|
| Título de página (h1) | 28px | 900 | `letter-spacing: -0.03em` |
| Título de card (h3) | 18px | 800 | `letter-spacing: -0.02em` |
| Section label | 10px | 800 | uppercase, `letter-spacing: 0.12em`, cor `--primary` |
| Corpo | 13px | 400–500 | `line-height: 1.5` |
| Caption / badge | 10–11px | 600–800 | |
| Hero number (KPI grande) | `clamp(2.6rem,4vw,3.8rem)` | 900 | gradient text, `letter-spacing: -0.04em` |
| Stat number (card médio) | 32–48px | 900 | `font-variant-numeric: tabular-nums` |

**Hero number CSS:**
```css
background: linear-gradient(120deg, var(--primary), oklch(0.78 0.26 160));
-webkit-background-clip: text;
background-clip: text;
color: transparent;
```

**Regra:** Todo número financeiro ou de ranking usa `font-variant-numeric: tabular-nums`.

---

## Shell do layout

```
┌──────────────────────────────────────────────────────┐
│ Sidebar 240px (ou 64px colapsada)  │  Topbar 60px    │
│                                    ├─────────────────│
│ Logo + role + userName             │  Main content   │
│ Grupos de nav colapsáveis          │  overflow-y     │
│ Chat IA em destaque                │  padding 28/32  │
│ Status online no footer            │  max-w 1280px   │
└──────────────────────────────────────────────────────┘
```

**Sidebar:**
- Background: `oklch(0.17 0 0)` — cinza escuro, não preto puro
- Logo: quadrado 32px, background `--primary`, letra "V" preta, `border-radius: 10px`, `box-shadow: 0 0 16px oklch(0.87 0.29 145 / 0.4)`
- Groups labels: 10px, uppercase, weight 800, cor `oklch(1 0 0 / 0.25)` — exceto grupo IA (usa `--primary`)
- Nav item normal: `color: oklch(1 0 0 / 0.45)`, `border-radius: 8px`
- Nav item ativo: `background: oklch(0.87 0.29 145 / 0.1)`, `color: --primary`, barra 3px verde na esquerda
- Chat IA: `background: oklch(0.87 0.29 145 / 0.1)`, `border: 1px solid oklch(0.87 0.29 145 / 0.25)`, badge "IA" verde

**Topbar:**
- 60px altura, `background: oklch(0.08 0 0 / 0.6)`, `backdrop-filter: blur(16px)`
- Hamburguer + "Bom dia/Boa tarde/Boa noite, [Nome]" + streak pill + nível pill + bell + avatar
- Streak pill: amber. Nível pill: green.

---

## Cards

```css
/* Padrão */
.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 20px;
  backdrop-filter: blur(16px);
  position: relative;
  overflow: hidden;
}

/* Destaque (com glow verde) */
.card-primary {
  background: linear-gradient(135deg, oklch(0.87 0.29 145 / 0.1), oklch(0.70 0.17 215 / 0.04));
  border: 1px solid oklch(0.87 0.29 145 / 0.25);
}

/* Hover */
.card-hover:hover {
  transform: translateY(-2px);
  border-color: oklch(0.87 0.29 145 / 0.25);
  box-shadow: 0 12px 40px -8px oklch(0.87 0.29 145 / 0.15);
  transition: 0.25s cubic-bezier(0.16,1,0.3,1);
}
```

**Border radius por elemento:**
- Card principal: 20px
- Card interno: 14–16px
- Pill / badge: 99px
- Botão: 10–12px
- Ícone wrapper: 10–14px
- Sidebar item: 8px

---

## Grids

```css
.grid-4   { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.grid-3   { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.grid-2   { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.grid-3-2 { display: grid; grid-template-columns: 3fr 2fr; gap: 14px; }
.grid-2-1 { display: grid; grid-template-columns: 2fr 1fr; gap: 14px; }
/* Responsivo: @media (max-width:900px) → grid-template-columns: 1fr */
```

Gap padrão entre seções: **20px**. Padding interno dos cards: **24–26px**.

---

## Componentes padrão

### Section label (obrigatório no topo de cada seção)
```jsx
<div style={{
  fontSize: 10, fontWeight: 800, letterSpacing: '0.12em',
  textTransform: 'uppercase', color: 'var(--primary)', opacity: 0.8,
  display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6
}}>
  <span>🎯</span> NOME DA SEÇÃO
</div>
```

### Stat card
- Section label → número gigante animado → delta com seta → sparkline SVG

### Progress ring
- SVG `rotate(-90deg)`, track `oklch(1 0 0 / 0.06)`, fill com `drop-shadow`
- `strokeLinecap: round`, transição `1.2s cubic-bezier(0.16,1,0.3,1)`

### Barra de progresso
```css
track: height 4–8px, border-radius 99px, background oklch(1 0 0 / 0.08)
fill:  background linear-gradient(90deg, var(--primary), oklch(0.78 0.26 155)),
       box-shadow 0 0 8px oklch(0.87 0.29 145 / 0.5),
       transition width 1.2s cubic-bezier(0.16,1,0.3,1)
```

### Pills
```
Verde:  bg oklch(0.87 0.29 145 / 0.1), border oklch(0.87 0.29 145 / 0.25), color --primary
Amber:  bg oklch(0.77 0.19 70 / 0.12), border oklch(0.77 0.19 70 / 0.25), color --amber
Rose:   bg oklch(0.65 0.24 16 / 0.15), border oklch(0.65 0.24 16 / 0.3),  color --rose
```

### Botão primário
```css
background: linear-gradient(135deg, var(--primary), oklch(0.78 0.26 155));
color: #000; font-weight: 800; border-radius: 12px; border: none;
box-shadow: 0 4px 16px oklch(0.87 0.29 145 / 0.4);
```

### Nudge / alerta proativo
```
[ícone 34px]  Título bold
              Descrição muted (line-height 1.5)
              [Ação →] botão ghost
Tipos: burnout → rose | recognize → green | followup → amber
```

### Briefing banner (topo do dashboard)
```
[✨ 40px]  Título bold "VAMO IA · Briefing de hoje"
           Texto com dados em destaque (cor --primary bold)
           [pills de status à direita]
Background: linear-gradient(135deg, oklch(0.87 0.29 145 / 0.1), oklch(0.70 0.17 215 / 0.06))
Border: 1px solid oklch(0.87 0.29 145 / 0.2)
```

---

## Animações

```css
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
.fade-up { animation: fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both; }
.s1 { animation-delay: 60ms; }
.s2 { animation-delay: 120ms; }
.s3 { animation-delay: 180ms; }
.s4 { animation-delay: 240ms; }
```

**Ambient blobs** (fixed, pointer-events none, z-index 0):
- Verde: 500×500px, `top:-200px left:-150px`, `opacity:0.18`, animação 20s
- Azul: 400×400px, `bottom:-100px right:-100px`, `opacity:0.1`, animação 25s reverso
- Ambos: `filter:blur(80px)`, `border-radius:50%`

**Números animados:** counter de 0 ao valor real em 1.2s, easing `1 - (1-p)^4`.

---

## Estrutura de qualquer tela

```
1. Page header
   ├─ section label (• pulsante + texto uppercase green)
   ├─ h1 28px/900 (palavra-chave em gradient text)
   └─ subtítulo 13px muted

2. Briefing banner (se a tela tem resumo de IA)
   └─ ✨ + texto + pills de status

3. Grid de KPIs (grid-4 ou grid-3)
   └─ StatCard com sparkline por métrica principal

4. Conteúdo principal (grid-3-2 ou grid-2)
   ├─ Card maior: lista, gráfico, tabela, funil
   └─ Card menor: ações, nudges, insights de IA

5. Seção secundária (grid-2)
   ├─ Ranking / histórico / perfil
   └─ Saúde / projeção / próximos passos

6. Card full-width opcional
   └─ Perfil DISC, Coach IA, onboarding, CTA
```

---

## Padrões por tipo de tela

**Listagem (equipe, missões, ranking)**
- Filtros como pills clicáveis no topo
- Rows com avatar + nome + mini-barra de XP + métrica principal
- Estado vazio: ícone + mensagem + CTA contextual

**KPIs / indicadores**
- grid-4 com stat cards + sparklines no topo
- Gráfico SVG (barras ou linha) no centro
- Lista de registros recentes abaixo
- Botão "Registrar KPI" como ação primária proeminente

**Gamificação (conquistas, loja, ranking)**
- Hero: anel XP + nível + nome do nível
- Grid 3 cols de cards de conquista/item
- Desbloqueado: border green, opacidade 100%
- Bloqueado: opacity 0.4, cadeado, requisito visível

**Diagnóstico / DISC**
- Hero com tipo + anel de score
- grid-2: forças (green) + oportunidades (amber)
- Insight de IA em card azul com `✨`
- Histórico em linha do tempo

**Configurações**
- Abas internas (não usa nav principal)
- Section labels separam grupos de campos
- Switches/toggles para features
- Zona de ações destrutivas com borda rose

**Chat / VAMO IA**
- Input fixo no bottom, mensagens acima em scroll
- IA: alinhado à esquerda, `background: oklch(0.87 0.29 145 / 0.08)`, ícone ✨
- Usuário: alinhado à direita, background surface
- Sugestões rápidas como pills clicáveis acima do input

---

## Regras obrigatórias

1. Nenhuma tela começa sem section label + h1 + subtítulo muted
2. O número mais importante é o maior na hierarquia visual
3. Estados vazios nunca são brancos — ícone + mensagem + CTA
4. Feedback da IA tem visual próprio: `✨`, fundo sutil, pill "VAMO IA"
5. Ações destrutivas sempre em rose — nunca green ou amber
6. Todo número financeiro e de ranking: `font-variant-numeric: tabular-nums`
7. Datas sempre em pt-BR: `toLocaleString('pt-BR', {...})`
8. Hover em cards: `translateY(-2px)` + glow sutil verde
9. Botão ativo: `transform: scale(0.97)`
10. Sidebar: cinza escuro `oklch(0.17 0 0)` — nunca preto puro como o fundo

---

## Arquivos do prototype

```
Vamo Redesign.html     → Dashboard gestor + vendedor (prototype principal)
vamo-components.jsx    → AnimatedNumber, ProgressRing, Sparkline, FunnelBar,
                         KpiRing, Sidebar, Topbar, StatCard, NudgeCard,
                         RankRow, MissionCard — importar em novas telas
tweaks-panel.jsx       → Shell do painel de tweaks (não modificar)
VAMO_DESIGN_SYSTEM.md  → Este arquivo
```

---

## Como usar este arquivo

Ao pedir para o Claude criar ou redesenhar uma tela do VAMO:

> "Usando o VAMO_DESIGN_SYSTEM.md como contexto, crie/redesenhe a tela de **[nome]** para o perfil **[gestor/vendedor]**. Siga todas as regras de layout, cores, tipografia e componentes definidas no documento. Use dados mock realistas. A sensação deve ser: 'Caramba, meus problemas comerciais foram resolvidos.'"
