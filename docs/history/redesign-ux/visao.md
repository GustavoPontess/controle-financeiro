---
owner: Gustavo
last_reviewed: 2026-05-18
status: ATIVO
---

# Visão — Redesign UX inspirado em Monarch Money

> Iniciativa do ciclo Q4 2026. Spec de visão.
> Acompanha: `ISSUES.md` (5 issues #59–#63) e `IMPLEMENTATION_STATE.md`.

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

### 4.2 Captura interna via Monarch Session Recorder

**Status:** sócio já tem acesso ao Monarch (conta criada e logada, problema do Plaid contornado).

Em vez de printar manualmente, vamos capturar a navegação dele com um **script Playwright passivo** (`scripts/monarch-recorder.ts`) que registra automaticamente cada tela visitada — implementação delegada ao Code (ver `ISSUES.md` #60, sub-task 1).

**Funcionamento:**

1. Script abre um Chromium controlado pelo Playwright (visível, não headless), com persistent context (cookies/login persistem entre runs)
2. Sócio loga no Monarch nesse Chromium e navega normalmente
3. A cada nova navegação (`page.on('load')`), o script captura automaticamente:
   - **Screenshot full-page** em desktop (1920×1080) — página inteira, incluindo scroll
   - **HTML** completo do DOM (`page.html`)
   - **CSS** consolidado de todas as stylesheets (`styles.css`) — `getRules()` em cada `document.styleSheets`
   - **Design tokens publicados** (CSS custom properties no `:root`) extraídos para `tokens.json`
   - **Metadata**: URL, título, timestamp, n° do step
4. Tudo organizado em `docs/features/redesign-ux/monarch-session/step-NNN-<slug-da-rota>/`
5. Um `journey.json` no root da sessão agrega a sequência completa (ordem real de navegação)
6. Quando sócio fecha o browser, script encerra automaticamente

**Por que isso vale mais que screenshots manuais:**

- Não precisamos enumerar "quais telas printar" — qualquer tela visitada vira snapshot
- Captura **fluxos**, não só telas (ordem importa: onboarding tem N passos, settings tem subseções)
- HTML/CSS reais permitem extração **objetiva** de tokens (cores, fontes, espaçamentos) na fase #60 — sem inspecionar pixel a pixel
- Reutilizável para outras referências (Copilot, Lunch Money) sem reescrever
- Output em texto/PNG é indexável e pesquisável (`grep` em todos os HTMLs)

**Trade-off:** sócio tem que usar o Chromium que o script abre (re-login no Monarch, ~1 min).

**Lista mínima para ele navegar** (recorder pega tudo, mas garante cobertura):

- Login / signup / onboarding (multi-step)
- Dashboard (após pular conexão de banco ou cadastrar conta manual)
- Transactions list + filtros + busca + detalhe de uma transação
- Adicionar transação (form completo, todos os campos)
- Categorias / orçamento
- Goals (metas)
- Reports / Insights
- Shared Views / settings de família/couples (CORE pra nosso estudo)
- Settings → Account, Notifications, Subscription
- Help / FAQ (mostra padrão de página estática)

Tempo estimado: 1–2h de navegação + 5–10 min nossos para revisar output.

**Privacidade e tamanho:** `docs/features/redesign-ux/monarch-session/` vai no `.gitignore`. PNGs full-page pesam (estimo 50–100 MB no total) e podem conter dados (fictícios ou não) que não devem subir pro repo público. Só o `journey.json` (estrutura, sem screenshot) pode ser comitado se quisermos rastreabilidade.

### 4.3 Lembrete prático sobre a conta do Monarch

- **Free tier não existe** — só trial de 7 dias com cartão. Plano básico $14.99/mês. Cancelar antes do fim do trial.
- **Plaid não cobre Brasil** — se aparecer obrigatoriedade de conectar banco durante navegação, pular ou usar conta manual. Sócio já passou desse ponto.

### 4.4 Catálogos pagos avaliados e descartados

- **Mobbin** ($40/mês) — biblioteca de UX patterns mobile. Útil mas escopo amplo demais; conta do sócio entrega melhor pro nosso caso específico.
- **Page Flows** (~$25/mês) — catalogou 607 telas do Monarch, mas tudo gated.
- **Refero, Nicelydone** — mesma lógica.

Conclusão: zero custo de ferramenta. Conta real + material público resolvem.

---

## 5. Fases do redesign

### Fase 1 — Atlas Playwright (#59) — 1 dia

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

### Fase 2 — Design tokens (#60) — 2 dias

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

### Fase 3 — 3 telas piloto (#61) — 3-5 dias

**Objetivo:** validar a direção antes de aplicar em todo o app.

Telas escolhidas (porque cobrem padrões diferentes):

- **Dashboard** — densidade de informação, gráficos, hierarquia. Tela mais comparável com Monarch.
- **FamiliasPage** — listas, balanço, ação compartilhada. Nosso diferencial competitivo; precisa estar impecável.
- **Adicionar/editar transação** — formulário mais usado do app. UX de input crítica.

Para cada uma:
- PR isolado com "antes/depois" (printscreen do atlas + screenshot pós-refator)
- Revisão pelos 2 devs
- Componentes reutilizáveis extraídos viram pasta `src/components/v2/` (não toca em `src/components/` ainda para evitar regressão)

### Fase 4 — Propagação (#62) — 1 semana

**Objetivo:** aplicar tokens e padrões nas páginas restantes.

- Listar páginas remanescentes a partir do atlas da #59
- Aplicar tokens página a página
- Refator de componentes compartilhados (Navbar, Sidebar, Modais, Tabelas, Cards)
- Garantir: zero hex hardcoded fora de `tokens.ts`/theme MUI
- Re-rodar `npm run snapshot` ao final e comparar com baseline da #59

### Fase 5 — Dark mode revisão (#63) — 1-2 dias

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
- **Logos de bancos nos cards de conta** — mostrar o logo real do banco (Nubank,
  Itaú, etc) em vez do avatar genérico por tipo; a carteira em dinheiro segue
  genérica. O modelo já suporta (`Conta.BancoId`, `Banco.LogoUrl`, `Banco.Cor`),
  mas falta: popular `LogoUrl`/`Cor` no `BancoSeeder` (BrasilAPI não dá logo),
  vincular contas a bancos no `DevDataSeeder`, expor o banco no DTO do Dashboard,
  e ter os assets dos logos. Feature à parte — não entra no #61.
- Novas features de produto (Q5 já tem candidatos: Open Finance BR, categorização automática, notificações push/e-mail)
