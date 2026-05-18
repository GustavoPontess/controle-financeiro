---
owner: Gustavo
last_reviewed: 2026-05-18
status: ATIVO
---

# Visão — Redesign UX inspirado em Monarch Money

> Iniciativa do ciclo Q4 2026. Spec de visão.
> Acompanha: `ISSUES.md` (5 issues #32–#36) e `IMPLEMENTATION_STATE.md`.

---

## 1. O problema

O frontend atual está **funcional, mas não comunica "produto pago de verdade"**. Para um produto B2C de finanças que pretende cobrar assinatura, isso é problema crítico — ninguém paga R$15–30/mês por algo que parece "ferramentinha de portfólio".

Sintomas concretos:
- Hierarquia visual fraca (todas as informações disputam atenção igual)
- Paleta neutra demais, sem identidade própria
- Tipografia default do MUI (sem escala custom)
- Densidade de informação inconsistente entre páginas
- Componentes técnicos (modais, formulários, tabelas) parecem padrão de framework, sem ajuste fino

O Q3 entregou competência funcional ampla (família, rateio, importação, PWA, onboarding, notificações in-app), mas no **olho do usuário pagante**, isso vale menos do que aparenta sem a embalagem visual à altura.

---

## 2. Referência escolhida — Monarch Money

**monarch.com**

Por que essa e não outras:

- **Mesma proposta de produto:** finanças pessoais com foco explícito em casais/família ("Shared Views" feature). Alinhamento direto com nosso Bloco C (família, rateio, dependentes, acerto).
- **Design system maduro:** storybook público (storybook.monarchmoney.com — gated por JS/SPA, acesso via inspetor), 607+ telas catalogadas em sites de referência (Nicelydone, Page Flows).
- **Validação de mercado:** empresa de $850M (Série B de $75M em 23/05/2025, co-liderada por FPV Ventures e Forerunner). Total captado ~$94.8M.
- **Sucessor explícito do Mint:** fundado por Val Agostino, ex-executivo do Mint, posicionado como "Best Mint Replacement" pela Forbes Advisor e Wall Street Journal.

Outras referências consideradas e descartadas:
- **Copilot Money:** lindo, mas iOS-first; estamos web-first (PWA)
- **Lunch Money:** indie minimalista, ótimo design, mas escopo muito menor que o nosso
- **Maybe Finance:** open source, código vale espiar (github.com/maybe-finance/maybe), mas estética mais "produto interno"
- **Mobills/Organizze (BR):** funcionalmente mais maduros que a gente, mas design BR padrão; não é o que queremos parecer

---

## 3. Oportunidade

**Monarch é US-only.** Eles puxam dados via Plaid, que não cobre Brasil (Plaid tem operação BR via partnership com Pluggy, mas para PF é praticamente inacessível). No mercado brasileiro:

- **Mobills e Organizze** são individual-first; compartilhamento de despesa é feature secundária, sem polimento
- **Nubank** (referência de UX em fintech BR) não tem produto de gestão familiar
- **Olivia, GuiaBolso, Wallet** etc. estão em decadência ou foram adquiridos
- **Pesquisa em InfoMoney, Exame, Valor:** zero matérias sobre Monarch em mídia BR

Isso significa que existe **janela de tempo** para estabelecer a categoria "finanças de casal/família com design exclusivo" no Brasil antes de qualquer concorrente brasileiro perceber a oportunidade. Quando virar tendência (e vai, no padrão de chegada de apps US ao BR com 2-3 anos de atraso), seremos o nome óbvio.

**Pitch de imprensa pronto:** "O Monarch brasileiro." Repórter de fintech adora analogia direta ("X brasileiro") — Nubank foi Capital One brasileiro, iFood foi DoorDash brasileiro, QuintoAndar foi Zillow brasileiro.

---

## 4. Material disponível para o estudo

### 4.1 Material público (sem custo)

- **Landing oficial:** monarch.com, monarch.com/for-couples, monarch.com/features
- **Blog da feature de couples:** monarch.com/blog/shared-views (texto + screenshots)
- **App Store (screenshots em alta resolução):** apps.apple.com/us/app/monarch-money/id1457661389
- **Help center (telas com explicação):** help.monarch.com
- **Figma community:** figma.com/community/file/1357227916850614236/monarchmoney-com-web-pages-ui — duplica para conta Figma grátis e edita
- **API reversa em GraphQL:** github.com/hammem/monarchmoney — mostra o modelo de dados deles (útil pra inspirar nosso schema futuro)
- **Inspetor do navegador:** abrir monarch.com no Chrome, F12, ver CSS variables do tema deles (paleta + tipografia + espaçamentos)

### 4.2 Acesso interno via conta do sócio (em andamento)

O sócio está criando conta no Monarch para capturar screenshots reais do app populado. Vai dar visão muito mais rica que material público de marketing.

**Atenção prática com a conta:**

- **Free tier do Monarch não existe** — só free trial de 7 dias com cartão. Plano básico é $14.99/mês ou $99.99/ano. Para o estudo de UX, 7 dias é suficiente; cancelar antes do fim.
- **Plaid não cobre Brasil bem.** Se Monarch pedir conexão de banco obrigatória durante onboarding, o sócio vai esbarrar nisso. Opções:
  1. **Plaid Sandbox** — Monarch deveria oferecer "skip" da conexão de banco para uso manual. Se não oferecer, alguns devs usam credenciais sandbox do Plaid (`user_good` / `pass_good`) com bancos fictícios tipo "First Platypus Bank" (não recomendado — viola ToS)
  2. **Manual mode** — Monarch tem modo "sem sincronização", só lançamento manual. Pode ter que cavucar nas settings de onboarding para encontrar
  3. **Cadastrar conta manual qualquer** — criar "conta corrente" sem conectar banco, lançar 5-10 transações manuais para popular o dashboard com dado real
- **Foco do print:** páginas internas críticas pro nosso estudo são (1) Dashboard, (2) Transactions list, (3) Adicionar transação, (4) Shared Views (família/casal), (5) Reports, (6) Goals, (7) Settings
- **Resolução do print:** capturar em desktop full HD (1920x1080) e em mobile (390x844 / iPhone 14). Vamos comparar lado a lado com nosso atlas

Salvar todos os screenshots em `docs/features/redesign-ux/screenshots-monarch/` (criar pasta) com nome descritivo (`dashboard-desktop.png`, `transacao-novo-mobile.png`, etc.).

### 4.3 Catálogos pagos avaliados e descartados

- **Mobbin** ($40/mês) — biblioteca de UX patterns mobile. Útil mas escopo amplo demais; conta do sócio entrega melhor pro nosso caso específico.
- **Page Flows** (~$25/mês) — catalogou 607 telas do Monarch, mas tudo gated.
- **Refero, Nicelydone** — mesma lógica.

Conclusão: zero custo de ferramenta. Conta real + material público resolvem.

---

## 5. Fases do redesign

### Fase 1 — Atlas Playwright (#32) — 1 dia

**Objetivo:** ter visão objetiva de tudo que temos hoje, antes de mudar qualquer pixel.

- Setup `@playwright/test` no frontend
- Script `scripts/snapshot.ts`:
  - Login com usuário de teste (definir `dev@controle.test` ou similar)
  - Lê rotas do `src/routes/` programaticamente
  - Visita cada rota, espera DOM estabilizar
  - Captura desktop (1440x900) e mobile (390x844)
  - Salva em `screenshots/atlas/desktop/<rota>.png` e `.../mobile/<rota>.png`
- `npm run snapshot` no `package.json`
- `screenshots/` no `.gitignore`

**Saída:** 30+ PNGs comparáveis lado a lado com os screenshots do Monarch.

### Fase 2 — Design tokens (#33) — 2 dias

**Objetivo:** transformar "queremos algo bonito" em contrato objetivo e versionado.

Extrair do Monarch e formalizar:

- **Paleta:**
  - Primary (1 cor de marca + variantes 50/100/.../900)
  - Neutros (10+ tons de cinza para hierarquia visual sem usar preto puro)
  - Semânticas: success (verde), error (vermelho), warning (amarelo/laranja), info (azul)
  - Background vs surface (sutilmente diferentes para criar profundidade)
- **Tipografia:**
  - Família (Monarch usa Inter; sugestão de manter)
  - Escala (1.250 — Major Third — funciona bem para apps de finanças)
  - Pesos: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)
  - Line-height por tamanho
- **Espaçamento:** base 4px ou 8px, escala (4, 8, 12, 16, 24, 32, 48, 64)
- **Raio de borda:** sm (4), md (8), lg (12), xl (16), pill (999)
- **Sombras (elevação):** xs, sm, md, lg, xl
- **Estados:** definir hover/focus/active/disabled para botões e inputs

**Outputs:**
- `docs/design-tokens.md` — tabelas legíveis para humano
- `controle-financeiro.web/src/theme/tokens.ts` — TypeScript exportando as constantes
- `controle-financeiro.web/src/theme/theme.ts` — `createTheme(...)` MUI usando os tokens

### Fase 3 — 3 telas piloto (#34) — 3-5 dias

**Objetivo:** validar a direção antes de aplicar em todo o app.

Telas escolhidas (porque cobrem padrões diferentes):

- **Dashboard** — densidade de informação, gráficos, hierarquia. Tela mais comparável com Monarch.
- **FamiliasPage** — listas, balanço, ação compartilhada. Nosso diferencial competitivo; precisa estar impecável.
- **Adicionar/editar transação** — formulário mais usado do app. UX de input crítica.

Para cada uma:
- PR isolado com "antes/depois" (printscreen do atlas + screenshot pós-refator)
- Revisão pelos 2 devs
- Componentes reutilizáveis extraídos viram pasta `src/components/v2/` (não toca em `src/components/` ainda para evitar regressão)

### Fase 4 — Propagação (#35) — 1 semana

**Objetivo:** aplicar tokens e padrões nas páginas restantes.

- Listar páginas remanescentes a partir do atlas da #32
- Aplicar tokens página a página
- Refator de componentes compartilhados (Navbar, Sidebar, Modais, Tabelas, Cards)
- Garantir: zero hex hardcoded fora de `tokens.ts`/theme MUI
- Re-rodar `npm run snapshot` ao final e comparar com baseline da #32

### Fase 5 — Dark mode revisão (#36) — 1-2 dias

**Objetivo:** dark mode entregue em #31 foi sobre a base antiga. Sobre os tokens novos, vale revalidar.

- Audit do dark mode atual contra novos tokens
- Ajustar paleta dark (não é só inverter — contrastes diferentes)
- Validar contraste AA WCAG
- Atualizar atlas com viewport dark

---

## 6. Riscos e mitigações

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Refator vira projeto sem fim (escopo creep) | Alta | Telas piloto primeiro; só propagar após validação. Cancelar fase 4 se a 3 não convencer. |
| Discordância visual entre os 2 devs | Média | Tokens em arquivo de código = decisão objetiva. Discussão sobre token, não sobre tela. |
| Sócio não consegue acesso interno ao Monarch | Média | Material público + Figma community + screenshots App Store já cobrem 80%. Acesso interno é bônus, não bloqueante. |
| Regressão funcional durante refator | Baixa | Suíte de testes (130+ no Q3) + atlas Playwright como regressão visual. |
| Usuários reais (se houver) estranham mudança | Baixa-Média | Não há base instalada relevante ainda; janela boa pra refazer. |

---

## 7. Critérios de sucesso

O ciclo é considerado bem-sucedido se, ao final:

1. Atlas pós-redesign é visualmente **comparável** ao do Monarch em hierarquia, paleta e densidade (não idêntico — comparável)
2. Tokens vivem em código (`tokens.ts`), são a única fonte de verdade visual e estão documentados (`docs/design-tokens.md`)
3. Os 2 devs concordam que o produto "parece pago"
4. Nenhuma regressão funcional (testes verdes)
5. Dark mode revalidado e consistente
6. Pelo menos 1 amigo ou conhecido fora do projeto, ao ver o atlas pós-redesign sem contexto, comenta que "parece app gringo" ou equivalente

---

## 8. Fora do escopo deste ciclo

Para não inflar o escopo, ficam **fora**:

- Migração de Material-UI para outra lib de componentes (custo alto, ganho marginal)
- Setup de Storybook (overhead alto; deixar para quando componentes estabilizarem)
- Animações sofisticadas (Framer Motion etc.) — focar no estático primeiro
- Refator de backend (escopo é puramente front)
- Marketing site / landing page nova (separado)
- Logo / identidade de marca (separado; vale fazer depois com os tokens já definidos)
- Novas features de produto (Q5 já tem candidatos: Open Finance BR, categorização automática, notificações push/e-mail)
