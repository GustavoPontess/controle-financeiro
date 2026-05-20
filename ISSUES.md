---
owner: Gustavo
last_reviewed: 2026-05-21
next_review: 2026-08-21
status: CURRENT
---

# Issues & Roadmap — Q5 2026

**Contexto:** Q4 2026 encerrado parcialmente — telas piloto (#61), propagação de tokens (#62), brand preview e design system (#74) mergeados; dark mode (#63 / PR #73) cancelado e absorvido pela nova abordagem deste ciclo. Histórico em `docs/history/`.

**Estratégia Q5:** refator completo tela por tela (front + back + testes) seguindo o fluxo natural do produto — site público → auth → telas internas. Não há "blocos" temáticos — cada issue é independente e o time pega a próxima livre na ordem sugerida.

**⭐ Fundação OBRIGATÓRIA pra TODO refator:** biblioteca `src/components/pontes/` (issue #101, sessão 32). Toda tela refatorada importa SOMENTE de `@/components/pontes`. Componentes reutilizáveis novos (2+ telas) DEVEM ser adicionados à biblioteca antes de usar — detalhes em `PROMPT_NOVA_SESSAO.md` §5.

**Marca decidida:** nome "Pontes", logo conceito 20 (wordmark + arco sublinhado), tipografia Plus Jakarta (corpo) + Fraunces (headlines serif) + Instrument Serif (acentos italic). **Paleta e fonte do produto** ficam como personalização do usuário (#90).

**Documentos vivos relacionados:**
- `PROGRESS.md` — dashboard de progresso
- `IMPLEMENTATION_STATE.md` — checkpoint da issue em execução
- `docs/features/redesign-ux/` — visão UX e concorrentes
- `docs/features/familia/visao.md` — visão de família (§16.5 entra em #85)

---

## Backlog Q5 — 18 issues

### Site público (frente)

- ~~**#75** — `/` vira root público com fallback Dashboard quando autenticado~~ ✅ MERGEADA (PR #94 · sessão 31)
- **#76** — Refator Login + Register usando design system Pontes
- **#77** — Página Para Casais (`/site/casais`)
- **#78** — Página Para Contadores (`/site/contadores`)
- **#79** — Página Recursos completa (`/site/recursos`)
- **#80** — Página Sobre / Manifesto (`/site/sobre`)

### Telas internas do app

- **#81** — Dashboard refator com 6 KPIs + gráficos
- **#82** — Transação Adicionar/Editar — único + recorrente + parcelado completos
- **#83** — Categorias + Subcategorias (criar entidade Subcategoria no back)
- **#84** — Cartão de Crédito — auditar e consertar tudo
- **#85** — Família — rateio explícito + aprovação despesa + acerto §16.5
- **#86** — Metas conjuntas e individuais (back + front zero)
- **#87** — Limites por categoria com alertas (back + front zero)
- **#88** — Bancos com logo real — popular `LogoUrl` + componente `BankBadge`
- **#89** — Recorrentes refator — lista, pausar, editar próxima ocorrência

### Infra e qualidade

- **#90** — Personalização in-app — usuário escolhe paleta + fonte
- **#91** — CI/CD revisar gate — build + lint + testes obrigatórios pra merge
- **#92** — Cobertura E2E Playwright expandir

### Fundação (bloqueia refator de telas)

- **#101** — Biblioteca de componentes Pontes (`src/components/pontes/`) — 36 componentes reutilizáveis + lucide-react + showroom em `/design-system`. Bloqueia/desbloqueia #76, #77, #78, #79, #80, #81, #82, #83, #84, #86, #87, #89.

---

## Convenções

### Padrão de issue
- **Branch:** `feature/<numero>-<slug-kebab>`
- **Commits:** Conventional (`feat(area): ...`, `fix(area): ...`, `chore(area): ...`)
- **PR:** título igual à issue, body com `Closes #N`
- **Labels:** `area/site | area/app | area/infra` + `tipo/feature | tipo/refator | tipo/chore` + `severidade/alta | media | baixa`

### Critério "done" por issue
1. Build verde (back: `dotnet build`; front: `npm run build`)
2. Lint zero (`npm run lint`)
3. Teste novo cobrindo a feature/refator (back + front quando aplicável)
4. Família real (você ou sócio) homologa em dev
5. PR mergeado pra `main`

### Pull-based
Cada dev pega a **próxima issue livre** da ordem sugerida. Sem assignee fixo. Quem terminar primeiro pega a seguinte.

### Decisões já tomadas
- Nome do produto: **Pontes**
- Logo: conceito 20 (wordmark + arco sublinhado) — `src/components/Logo/Logo.tsx`
- Tipografia da marca: **Plus Jakarta Sans** (fixa, não muda com personalização)
- Tipografia do produto: escolha do usuário (#90)
- Paleta do produto: escolha do usuário (#90)
- Mascote: descartado — sem mascote

---

## Backlog futuro (sem quarter definido)

### Spec-Driven Development (SDD)

**Severidade:** 🟢 BAIXA • **Esforço:** processo, não código • **Status:** 💡 IDEIA

**Por quê:** Antes de atacar feature complexa (rateio + aprovação + acerto §16.5, módulo contador, Open Finance), formalizar "spec primeiro, código depois". Reduz drift entre o que se quer e o que sai. IA gera código mais consistente com spec rica.

**Escopo proposto:**
- Template `docs/features/<feature>/spec.md` com seções: comportamento, regras de negócio, casos de uso, edge cases, contratos de API
- Convenção: antes de criar branch de feature, escrever spec e abrir PR só de doc
- Adotar gradual: começa pelo próximo grande pivot (rateio v2 ou módulo contador)

**Referências:** GitHub Spec-Kit (set/2024), AWS Kiro IDE. Conceito: spec é fonte da verdade, código deriva dela.

**Próxima ação:** decidir quando adotar — quando começar feature grande nova.

### Open Finance MVP

**Severidade:** 🟡 MÉDIA-ALTA • **Esforço:** L (1-2 semanas) • **Status:** 💡 IDEIA

Integração via Pluggy ou Belvo. Começa com 1 banco (Itaú ou Nubank). Bloqueio competitivo — Despezzas e Pierre já têm. Entra como issue numerada quando #75-#92 forem fechadas.

### Módulo Contador / B2B

**Severidade:** 🟡 MÉDIA-ALTA • **Esforço:** L • **Status:** 💡 IDEIA

Convite contador → cliente, dashboard multi-cliente, cobrança B2B. Reaproveita 80% do modelo de família. Mercado virgem no BR. Entra após Família consolidada (#85).

---

## Histórico

- Q2 2026: feature Parcelamento (concluída) — ver `docs/history/ISSUES_2026Q2.md`
- Q3 2026: higiene + infra + pivot Família + UX B2C, 21/21 — ver `docs/history/ISSUES_2026Q3.md`
- Q4 2026: redesign UX, 4/5 mergeadas (dark mode #63 cancelado) — ver `docs/history/ISSUES_2026Q4.md`
