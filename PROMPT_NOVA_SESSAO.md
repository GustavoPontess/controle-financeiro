# Prompt — Nova Sessão

**Este arquivo é o ponto de entrada para qualquer sessão de trabalho com Claude no projeto Controle Financeiro.**

Leia este arquivo do começo ao fim antes de fazer qualquer outra coisa.

---

## 1. Identidade da sessão

Você é Claude trabalhando no projeto **Controle Financeiro** em `E:\VSCode\controle-financeiro`.

**Objetivo do projeto:** Tornar-se um produto B2C brasileiro de finanças pessoais e familiares, com diferencial em **gestão financeira de casais e famílias** (rateio "quem paga o quê", papéis dinâmicos, dependentes). Ver `docs/features/familia/visao.md` para a visão completa de produto.

**Não é projeto pessoal** — é produto futuro. Padrão de qualidade alto: testes, validação, documentação atualizada, commits semânticos.

**Trabalho em dupla:** o projeto é desenvolvido por dois devs em assíncrono, ambos com Claude. **Antes de fazer qualquer mudança, ler `docs/COLLABORATION.md`** para entender o protocolo de coordenação (GitHub Issues, branches, code review, conflitos previsíveis).

---

## 2. Primeira ação — invocar skill `caveman`

Antes de qualquer outra coisa, invoque a skill `caveman` no modo `full` para reduzir consumo de tokens em respostas conversacionais. Código e arquivos do projeto seguem normais (sem caveman) — caveman afeta apenas as respostas em chat.

Se a skill já estiver ativa de invocação anterior, ignore.

## 3. Pré-flight de git (antes de qualquer mudança)

Antes de tocar em código, garantir que o ambiente local está sincronizado e que ninguém mais está na Issue que você vai pegar.

**⚠️ REGRA DE OURO — modelo pull paralelo:** 2 devs trabalham simultâneo (eu + sócio). **SEMPRE** consultar GitHub Issues **PRIMEIRO** antes de decidir qual issue pegar. `ISSUES.md` é só catálogo; a fonte da verdade de "quem está com o quê" é o `assignee` no GitHub.

```bash
# 1. Atualizar main local
git checkout main
git pull --ff-only origin main

# 2. Ver o estado das Issues no GitHub (OBRIGATÓRIO — não pular)
gh issue list --state open                       # todas abertas
gh issue list --assignee "@me" --state open      # o que está comigo
gh issue list --assignee "Caio-Amarall" --state open  # o que está com o sócio
gh pr list --state open                          # PRs em andamento (qualquer dev)

# 3. Decidir qual pegar:
#    - Se já tem Issue assignada a você (sessão anterior) → pula pro passo 5
#    - Se não tem → escolhe a próxima livre (não assignada a ninguém)
#      Ordem sugerida em ISSUES.md (site público → telas internas → infra),
#      mas se outra livre fizer mais sentido pro contexto, pode pegar
#
# 4. Assigne-se ANTES de criar branch (vira lock contra duplicação de trabalho):
gh issue edit <numero> --add-assignee @me

# 5. Cria branch
git checkout -b feature/<numero>-<slug-kebab>
```

**Não pegue Issue assignada a outro dev** sem combinar antes (pergunta no GitHub Issue ou WhatsApp).

**Reservar Issues dependentes (obrigatório).** Ao se assignar a uma Issue, verifique se há outras que dependem dela diretamente. Se sim, assigne-se também à cadeia inteira pra não travar você no meio. Exemplo Q5:
- #83 (Subcategorias back) é dep de #82 (Transação Adicionar/Editar) → quem pegar #82 pode reservar #83 junto se for atacar na sequência
- #90 (Personalização) é dep transitiva de TODAS as telas internas (#81-#89) — mas é melhor cada dev pegar uma tela e DEPOIS um deles pega #90 pra aplicar

```bash
gh issue edit <numero-dependente> --add-assignee @me
```

Cuidado pra não reservar demais — issues independentes ficam livres pro outro dev.

## 4. Ordem de leitura obrigatória (a cada nova sessão)

Use o tool `Read` nesta ordem:

1. **`IMPLEMENTATION_STATE.md`** — onde a sessão anterior parou. **Mais importante.**
2. **`PROGRESS.md`** — dashboard de progresso geral e histórico de sessões.
3. **`ISSUES.md`** — catálogo do backlog atual (Q3 2026, 4 blocos).
4. **`docs/COLLABORATION.md`** — protocolo de trabalho em dupla (especialmente se primeira sessão sua).
5. **`CLAUDE.md`** — convenções do projeto, stack, comandos, padrões.
6. **`docs/QUICK_REFERENCE.md`** — resumo de stack/comandos/padrões para consulta rápida.

Conforme o trabalho da sessão exigir, leia adicionalmente:

- **Para qualquer trabalho em código:** `docs/STANDARDS.md` (convenções), `docs/GIT_WORKFLOW.md` (branches e commits).
- **Para trabalhar no schema:** `docs/DATABASE.md`.
- **Para entender fluxo de negócio:** `docs/FLOWS.md`.
- **Para implementar nova feature:** `docs/features/<nome>/` — vise sempre `arquitetura.md` e `ux.md` se existirem.
- **Para criar novo controller:** `docs/CONTROLLER_TEMPLATE.md`.
- **Para UI:** `docs/DESIGN_SYSTEM.md`.
- **Para entender análise de produto:** `docs/ANALISE_PRODUTO.md`.

**Histórico:** trabalho concluído está em `docs/history/`. Consulte se precisar de contexto sobre decisões antigas.

---

## 5. Estrutura mental do trabalho — Q5 2026

Tudo gira em torno de uma **Issue do backlog** (ver `ISSUES.md`). Q5 tem 18 issues (#75-#92) sem agrupamento em blocos — **modelo pull**: cada dev pega a próxima livre.

### ⛔ REGRAS INEGOCIÁVEIS (todo dev + todo Claude segue, sempre)

1. **Biblioteca, nunca inline.** Toda UI vem de `@/components/pontes`. Zero `<button style>`, zero MUI direto, zero `<select>` nativo, zero `CustomButton`/`tokens.ts` antigo nas telas Q5. **Estilo em `*.module.css` (CSS Modules), nunca `style={{}}` de cor/fonte/tema** — ver regra 3 e `docs/STANDARDS.md`. **Boy-scout: achou `style={{}}` de tema/estático (legado ou novo), arruma na hora pra CSS Module — não deixa virar dívida técnica.** Única exceção a inline: valor dinâmico de runtime que CSS não alcança (`width: %`, cor vinda de dado tipo `conta.cor`, vars escopadas) — e mesmo assim só o valor dinâmico, nunca tema.
2. **Componente reutilizável novo → vai pra biblioteca** (`src/components/pontes/`) antes de usar: arquivo + barrel `index.ts` + demo no `/design-system` + smoke test. Específico de 1 tela só → fica na pasta da tela.
3. **Cor e fonte SEMPRE via CSS vars `var(--pontes-*)`** em `*.module.css` (#122). Vars injetadas no `:root` pelo `PontesThemeProvider`. Nunca hex/fonte hardcoded de tema. Telas **não** passam `p`/`font` pros componentes Pontes (eles leem as vars). `usePontesTheme()`/`useSiteTheme()` só onde precisa de cor REAL hex (SVG/recharts — `var()` não vale em atributo SVG). Feedback = `var(--pontes-success|warning|danger|info)`. Wordmark = Plus Jakarta fixo. Detalhe: `docs/STANDARDS.md` → "Estilização".
4. **Personalização é global + persistida.** `PontesThemeProvider` no root, localStorage. Trocar paleta/fonte vale em todas as telas e sobrevive reload.
5. **Site público usa `SiteLayout`.** Páginas do site = só conteúdo; navbar/footer/control-bar vêm do layout.
6. **Teste automatizado SEMPRE** — front (vitest) E back (xUnit) cobrindo o que mudou. Sem teste = PR não merga. (Exceção: só copy/CSS/docs.)
7. **Ícones via lucide-react** (`<Plus size={16} strokeWidth={2.5}/>`), nunca char texto.
8. **CI verde** (build + lint + testes) antes de mergear. PR com `Closes #N`.
9. **Form valida por campo, sempre.** Todo formulário valida antes de submeter e mostra erro **visual por campo** (`PontesField error` + `invalid` no controle), nunca toast pra campo faltando. Bloqueia submit se inválido; erro limpa ao editar; mensagem ≠ placeholder; toast acima do modal. Teste obrigatório (submit vazio bloqueia + mostra erros). Detalhe: `docs/STANDARDS.md` → "Validação de formulários".

Detalhe de cada uma abaixo nas subseções "Biblioteca Pontes", "Sistema cor + fonte" e "Testes automatizados".

### Ordem sugerida (não obrigatória)

**Site público (frente — desbloqueia fluxo de entrada):**
- #75 ✅ root público com fallback Dashboard
- #76 Login + Register refator
- #77 Para Casais
- #78 Para Contadores
- #79 Recursos
- #80 Sobre

**Telas internas (em paralelo):**
- #81-#89 (Dashboard, Transação, Categorias, Cartão, Família, Metas, Limites, Bancos, Recorrentes)

**Infra/qualidade:**
- #90 Personalização in-app
- #91 CI/CD gate
- #92 Cobertura E2E

### Marca decidida (sessão 30, 2026-05-21)

- Nome: **Pontes**
- Logo: `src/components/Logo/Logo.tsx` (wordmark + arco sublinhado, conceito 20)
- Fonte da marca: **Plus Jakarta Sans** (fixa, pré-carregada em `index.html`)
- Tipografia institucional: Plus Jakarta + Fraunces (h2 grandes) + Instrument Serif (acentos italic)
- Paleta + fonte do produto: escolha do usuário via personalização in-app (#90)

### Estrutura de pastas (atualizada Q5)

```
src/pages/
├── Site/                    # tudo público do site institucional
│   ├── HomePage.tsx         # rota /site (futuro /)
│   ├── LogoConcepts.tsx     # temporário
│   └── theme.ts             # palettes + fonts + types
├── DesignSystem/
│   └── DesignSystemPage.tsx # rota /design-system
├── Auth/, Dashboard/, etc   # internos autenticados
src/components/
├── Logo/Logo.tsx            # logo oficial Pontes
├── Auth/RootRoute.tsx       # decide HomePage vs Dashboard em /
└── Auth/ProtectedRoute.tsx
```

### Biblioteca Pontes — fundação OBRIGATÓRIA do front Q5 ⭐⭐⭐

**Pasta:** `src/components/pontes/` — biblioteca real e única de componentes UI.
**Barrel:** `import { PontesButton, PontesInput, ... } from "@/components/pontes"`
**Showroom:** `/design-system` (rota pública) — demo de cada componente, com paleta e fonte trocáveis ao vivo.
**Origem:** issue #101 (PR #102, sessão 32).

**O que tem hoje (36 componentes):**

- **Botões:** `PontesButton`, `PontesIconButton`, `PontesFab`, `PontesButtonGroup`, `PontesLink`
- **Form:** `PontesField` (wrapper), `PontesInput`, `PontesMoneyInput`, `PontesTextarea`, `PontesSelect` (custom, **NÃO** usar `<select>` nativo), `PontesToggle`, `PontesCheckbox`, `PontesRadio`/`PontesRadioGroup`, `PontesOtpInput`, `PontesSlider`, `PontesDatePicker`, `PontesFileDrop`, `PontesTagInput`, `PontesColorPicker`, `PontesRating`, `PontesKbd`/`PontesKbdGroup`
- **Dados:** `PontesBadge`, `PontesAvatar`/`PontesAvatarStack`, `PontesAlert`, `PontesProgress`, `PontesStatCard`, `PontesCard`, `PontesTable`
- **Feedback:** `PontesToast`, `PontesModal`, `PontesDialog`, `PontesSkeleton`/`PontesSkeletonRow`/`PontesSkeletonList`, `PontesEmptyState`, `PontesLoadingDots`, `PontesDrawer`, `PontesTooltip`, `PontesPopover`
- **Navegação:** `PontesBreadcrumb`, `PontesTabs`, `PontesStepper`, `PontesPagination`, `PontesCommandPalette`
- **Site:** `PontesNavbar`, `PontesFooter`
- **Tema global:** `PontesThemeProvider` (root da app) + `usePontesTheme()` — paleta + fonte do usuário, **persistido em localStorage** (#90). `PontesScrollArea` / `usePontesBodyScrollbar` (scrollbar overlay), `applyPontesScrollbar`.
- **Tema (tokens):** `theme.ts` — 15 paletas, 7 fontes, `spacing`, `radii`, `shadows`, `semantic`, `adjustColor`
- **Layout site:** `pages/Site/SiteLayout.tsx` — shell compartilhado (navbar + footer + control bar dev + scrollbar) pras páginas públicas; páginas filhas só renderizam conteúdo e leem `{p, font}` via `useSiteTheme()`.
- **Ícones:** `lucide-react` (já instalado, v1.16) — use `<Plus size={16} strokeWidth={2.5} />`. **NÃO** passar char texto (`"+"`, `"→"`, etc) — quebra alinhamento vertical.
- **Hover/interação:** classe `pontes-clickable` + `data-pontes-variant` (CSS vars de cor seguem paleta) — componentes da biblioteca já têm. Elemento clicável custom: adiciona a classe.

**Regras OBRIGATÓRIAS de refator (#76, #77, #78, #79, #80, #81, #82, #83, #84, #86, #87, #89):**

1. **Telas refatoradas do Q5 importam SOMENTE de `@/components/pontes`.** Sem exceção. Sem inline. Sem MUI direto. Sem `CustomButton`. Sem `tokens.ts` antigo.
2. **NUNCA** criar botão/input/card/etc do zero numa tela. Procura na biblioteca. Se não tem o que precisa → vai pra **regra 4**.
3. **NUNCA** usar `<select>` nativo, `<button style={...}>` solto, `<TextField>` da MUI, ou qualquer primitive não-Pontes nas telas Q5.
4. **Componente novo necessário pro refator → adiciona em `src/components/pontes/` ANTES de usar na tela.** Critério: se vai aparecer em 2+ telas OU substitui um padrão visual genérico (botão, input, card), vai pra biblioteca. Mesmo PR (ou PR bloqueante curto). Inclui:
   - Arquivo próprio em `src/components/pontes/NovoComponente.tsx`
   - Re-export em `src/components/pontes/index.ts`
   - Demonstração na aba apropriada de `DesignSystemPage.tsx`
   - Smoke test em `src/test/components/pontes.test.tsx`
5. **Componente específico de uma única tela** (ex: `RateioCalculator` em Família) fica em `src/pages/Familia/`. Não polui biblioteca.
6. **Ícones via lucide-react.** Stroke 2-2.5 pra ícones decorativos, 2.5-3 pra ícones-ação dentro de botões.
7. **Cor:** SEMPRE via `p.primary`, `p.accent`, `p.text` etc (recebidos por prop). Nunca hex hardcoded fora da theme.ts. Para feedback (success/warning/danger/info) usar `semantic.success` etc.
8. **Tipografia:** Plus Jakarta no corpo, Fraunces nos h1/h2 grandes (landing/site), Instrument Serif só em acentos italic. Wordmark "Pontes" SEMPRE Plus Jakarta.
9. **Espaçamento/radii/sombras:** use `spacing`, `radii`, `shadows` de `theme.ts`. Não inventar valores.

**Sistema cor + fonte GLOBAL = TODAS as telas (obrigatório):**

A personalização (#90) **já existe e é global**: `PontesThemeProvider` envolve a app no `App.tsx`, paleta + fonte vêm de `usePontesTheme()`, persistidas em **localStorage** (sobrevivem reload e valem em qualquer tela — site, auth, internas).

10. **TODA tela (site OU interna autenticada) consome a paleta + fonte do `usePontesTheme()`.** Nunca hardcode cor/fonte.
    - Páginas do **site público**: ficam sob `<SiteLayout>` (rota aninhada em `AppRoutes`) e leem `{p, font}` via `useSiteTheme()`. Não renderizam navbar/footer/control-bar próprios — o layout já dá.
    - Páginas **internas/auth**: leem `const { palette, font } = usePontesTheme()` direto e passam `p={palette} font={font}` pros componentes Pontes.
11. **Trocar paleta/fonte aplica em tudo ao vivo + persiste.** Mudou na Home → vale em Casais, Login, Dashboard, etc. Reabriu o navegador → mantém (localStorage).
12. **Settings picker:** quando refatorar a tela de Configurações, adicionar UI de escolha de paleta + fonte que chama `setPaletteId` / `setFontId` do `usePontesTheme()`. (Hoje só o control bar dev do `/site` e `/design-system` faz isso.)
13. **Wordmark "Pontes" é sempre Plus Jakarta** (marca fixa, não muda com personalização — só UI/corpo muda).
14. **Cores semânticas (success/warning/danger/info)** vêm de `semantic` em `theme.ts` — NÃO mudam com paleta (vermelho de erro sempre vermelho).
15. **`PontesAlert` e `PontesToast` são 100% imunes à paleta.** Padrão universal de alerta. Só `font` muda.

**Página do site nova (#78 Contadores, #79 Recursos, #80 Sobre, etc) — passo a passo:**
1. Cria `pages/Site/<Pagina>.tsx` que faz `const { p, font } = useSiteTheme()` e renderiza SÓ o conteúdo (hero + sections). **Sem** navbar/footer (vêm do SiteLayout).
2. Adiciona a rota como filha de `<SiteLayout>` em `AppRoutes`.
3. Adiciona o link no menu (`DEFAULT_LINKS` do `PontesNavbar`, se aplicável).
4. Teste smoke em `src/test/pages/<Pagina>.test.tsx` (renderiza sob SiteLayout + PontesThemeProvider — ver `HomePage.test.tsx` como modelo).

**⚠️ REGRA ARQUITETURAL CRÍTICA — src/components/ é ZONA LEGADA ⚠️**

> Esta regra é inegociável e deve ser seguida em TODA sessão, por qualquer dev, sem exceção.

**`src/components/` (raiz, fora de `pontes/`) = CEMITÉRIO DE LEGADO.**

- Tudo que está em `src/components/` fora de `pontes/` é código **antigo** que **SERÁ DELETADO** ao fim do Q5.
- **NUNCA criar componente novo em `src/components/` (raiz).** Qualquer componente novo vai para `src/components/pontes/`.
- A única exceção são os arquivos de roteamento/infra que não são componentes UI:
  - `src/components/Logo/Logo.tsx` — logo da marca (re-exportado como `PontesLogo` pelo barrel)
  - `src/components/Auth/RootRoute.tsx` — lógica de rota, não é UI
  - `src/components/Auth/ProtectedRoute.tsx` — lógica de rota, não é UI

**Mapa de onde cada coisa vive:**

```
src/components/
├── pontes/          ← ✅ AQUI vai TUDO que é componente novo ou reutilizável
│   ├── Button.tsx, Input.tsx, Modal.tsx, ...
│   └── index.ts     ← barrel: importar SEMPRE por @/components/pontes
├── Logo/Logo.tsx    ← ✅ exceção: re-exportado como PontesLogo no barrel
├── Auth/            ← ✅ exceção: lógica de rota (não é UI)
├── BackButton.tsx   ← ❌ LEGADO — será deletado
├── CustomButton.tsx ← ❌ LEGADO — será deletado
└── ...              ← ❌ LEGADO — tudo será deletado
```

**O que fazer quando precisar de componente que não existe na biblioteca:**
1. Cria em `src/components/pontes/NovoComponente.tsx`
2. Re-exporta em `src/components/pontes/index.ts`
3. Adiciona demo em `DesignSystemPage.tsx`
4. Adiciona smoke test em `src/test/components/pontes.test.tsx`
5. Só então usa na tela

**NUNCA** criar o componente direto na tela ou em `src/components/` raiz, mesmo que "temporário".

---

**Legado vs Novo — convivência durante Q5:**

16. **Legado** (`src/components/CustomButton.tsx`, `src/components/BackButton.tsx`, `src/theme/tokens.ts`, `pages/*` usando MUI direto): fica no lugar enquanto a tela correspondente ainda não foi refatorada. Telas legadas continuam usando até refator chegar nelas.
17. **Final do Q5** (todas as telas refatoradas e mergeadas): PR separado (`chore: remove componentes legados`) deleta tudo de `src/components/` exceto `pontes/`, `Logo/` e `Auth/`. Não antes.

**Fluxo recomendado pra atacar tela:**

1. Abre `/design-system` (paleta A, fonte Plus Jakarta default — testar A→O depois).
2. Identifica quais componentes a tela precisa (tabela, stat cards, modal, etc).
3. Importa de `@/components/pontes` e monta a tela.
4. Se faltar algo reutilizável → adiciona em `src/components/pontes/` primeiro (regra 4), depois usa.
5. Se faltar algo único da tela → cria local em `src/pages/<Tela>/`.
6. Tudo na mesma branch da issue (incluindo expansão da biblioteca).
7. PR descreve no body quais componentes da biblioteca foram criados/atualizados.

**Personalização (#90) — fundação JÁ FEITA:** `PontesThemeProvider` global + `usePontesTheme()` + persistência localStorage + `SiteLayout`. Falta só (ajusta conforme refator de cada tela): (a) **Settings picker** na tela de Configurações; (b) auth + telas internas consumirem `usePontesTheme()` quando forem refatoradas.

### Pre-flight em cada nova issue

1. `git checkout main && git pull --ff-only origin main`
2. `gh issue list --state open` — ver livres
3. `gh issue edit <N> --add-assignee @me`
4. `git checkout -b feature/<N>-<slug-kebab>`
5. Atualizar `IMPLEMENTATION_STATE.md` com a issue em execução
6. Trabalhar
7. PR com `Closes #N` no body
8. CI verde (build + lint + testes)
9. Merge (squash) + delete branch
10. Atualizar `PROGRESS.md` em PR separado (`chore/docs-sessao-N`)

### Critério "done" universal

- Build verde (back: `dotnet build`; front: `npm run build`)
- Lint zero erros (`npm run lint`)
- **Teste automatizado novo OBRIGATÓRIO** — front (vitest) E back (xUnit) quando aplicável. Sem exceção. Detalhes abaixo.
- Família real (você ou sócio) homologa em dev
- PR mergeado pra `main`

### Testes automatizados — regra OBRIGATÓRIA ⭐

**Toda mudança em código precisa de teste novo cobrindo o que mudou. Front E back.** Sem teste = PR não merga.

**Front (vitest + @testing-library/react):**
- Componente novo na biblioteca Pontes → smoke test em `src/test/components/pontes.test.tsx` (renderiza, dispara onClick, valida output)
- Tela nova ou refatorada → teste em `src/test/pages/<Tela>.test.tsx` cobrindo: render principal, interação chave (submit/click), edge case (loading/erro)
- Service novo → teste em `src/test/services/<Service>.test.ts` com axios mockado
- Hook custom → teste em `src/test/hooks/`
- Bug fix → teste de regressão que falharia ANTES do fix

**Back (xUnit + WebApplicationFactory):**
- Endpoint novo → teste de integração em `ControleFinanceiro.Tests/Controllers/` cobrindo: happy path, 400 (validação), 401 (sem auth), 404 (não existe), 403 (outro usuário)
- Service novo → teste unitário em `ControleFinanceiro.Tests/Services/` (regras de negócio, edge cases)
- Migration → smoke test que cria DB e roda migration
- Bug fix → teste de regressão

**O que NÃO precisa de teste:**
- Mudança puramente de copy/texto (sem lógica)
- Mudança puramente de estilo CSS (sem comportamento)
- Docs (`.md`, comentários)

**Comando local antes do push:**
```bash
# Frontend
cd controle-financeiro.web && npm test -- --run

# Backend
cd ControleFinanceiro.Api && dotnet test
```

Reviewer SEMPRE cobra: "qual teste cobre essa mudança?". Sem resposta → PR não merga.

---

## 6. Regra de ouro — nunca parar em estado quebrado

Se sentir pressão de tokens (após ~70% do contexto), **interrompa em ponto seguro**:

**Pontos seguros para parar:**
- Após checkpoint verde de uma etapa.
- Após commit bem-sucedido.
- Antes de começar uma nova entidade/serviço/componente.

**Pontos perigosos — nunca parar aqui:**
- Migration criada mas não aplicada.
- Entidade modificada mas DbContext não atualizado (build vermelho).
- Service refatorado mas controller ainda chamando assinatura antiga.
- Frontend chamando endpoint que não existe no backend.
- Testes quebrados que não estavam quebrados antes.

Se a próxima ação vai te empurrar para ponto perigoso e tokens estão escassos, **pare antes** dessa ação.

---

## 7. Procedimento de encerramento de sessão (obrigatório)

> ⚠️ **`PROGRESS.md`, `IMPLEMENTATION_STATE.md` e `ISSUES.md` são arquivos de estado críticos.** O projeto é desenvolvido por **dois devs em assíncrono** — cada um (e o Claude de cada um) depende desses arquivos para saber o que já foi feito, o que está em execução e o que vem a seguir. Um arquivo de estado desatualizado faz o outro dev (ou a próxima sessão) trabalhar com informação errada: pegar Issue já feita, duplicar trabalho, ou perder contexto.
>
> **Regra:** terminou uma Issue ou etapa relevante → atualize esses arquivos **na mesma sessão**, antes de encerrar. Nunca deixe `PROGRESS.md` refletindo um estado que já mudou. Se notar qualquer um deles desatualizado ao abrir a sessão, **corrija antes de seguir**.

Quando decidir parar (limite de tokens, fim natural de etapa, ou usuário pediu):

1. **Garantir build verde** — `dotnet build` no backend, `npm run build` no frontend se mexeu lá.
2. **Rebase em `main` atualizado** antes de qualquer push:
   ```bash
   git fetch origin
   git rebase origin/main
   ```
   Se houver conflito, resolver, `git rebase --continue`. Ver `docs/COLLABORATION.md` seção 7 para conflitos típicos em arquivos vivos.
3. **Commit do que foi feito** seguindo `docs/GIT_WORKFLOW.md`. Mesmo trabalho parcial pode ser commitado, desde que compile.
4. **Atualizar `IMPLEMENTATION_STATE.md`:**
   - Marcar etapas concluídas com `[x]`.
   - Atualizar "Etapa atual" para a próxima.
   - Atualizar "Próxima ação concreta" com instrução específica (arquivo, método, comportamento esperado).
   - Adicionar entrada nova em "Histórico de sessões na issue atual".
5. **Atualizar documentação tocada na sessão:**
   - Se schema mudou: `docs/DATABASE.md`.
   - Se fluxo mudou: `docs/FLOWS.md`.
   - Se padrão mudou: `docs/STANDARDS.md`.
   - Se feature nova: `docs/features/<nome>/`.
6. **Push:** `git push -u origin feature/<numero>-<slug>` (ou `git push --force-with-lease` se já existia).
7. **Abrir Pull Request** (Draft se ainda não terminou, Ready for review se terminou):
   ```bash
   gh pr create --fill --base main --head feature/<numero>-<slug>
   ```
   Preencher o template (aparece automaticamente). No campo "Review", marcar **Auto-merge** ou **Aguardando review** conforme o critério de `docs/COLLABORATION.md` §6.3. PR pequeno/trivial pode auto-merge sem esperar o outro.

   **Se o trabalho da Issue principal resolveu também outras issues** (ex: trabalho na #11 resolveu como subproduto a #12), listar TODAS no body do PR antes de mergear:
   ```
   Closes #1
   Closes #2
   ```
   Assim o GitHub fecha todas automaticamente e vincula o PR a cada Issue. **Nunca fechar Issue manualmente fora do PR** — perde rastreabilidade. Ver `docs/COLLABORATION.md` §6.5.
8. **Atualizar GitHub Issue** com um comentário do tipo "sessão N: parei em X, PR #Y aberto".
9. **`PROGRESS.md`** só é tocado **no PR final** (que fecha a Issue), não em sessões intermediárias.
10. **Avisar o usuário em chat:** qual issue/etapa parou, número do PR, se vai auto-mergear ou aguardar review.

---

## 8. Comandos úteis

```powershell
# Backend (porta 5293)
cd E:\VSCode\controle-financeiro\ControleFinanceiro.Api
dotnet build
dotnet run                          # http://localhost:5293/swagger
dotnet ef migrations add <Name>
dotnet ef database update
dotnet test                         # roda os 48 testes

# Frontend (porta 5173)
cd E:\VSCode\controle-financeiro\controle-financeiro.web
npm install
npm run build
npm run dev                         # http://localhost:5173
npm run lint
```

---

## 9. Padrões críticos para lembrar

- **`UsuarioId` em toda query** — multi-tenancy é checagem manual em cada service. Nunca confiar em filtros vindos do cliente.
- **Soft delete** em entidades financeiras (`Transacao`, `Parcelamento`, `ParcelaTransacao`, `Recorrente`) — nunca `_context.Remove()`.
- **Idempotência** em endpoints transacionais via header `Idempotency-Key`.
- **`FinancialEventLog`** registra mudanças de saldo/limite — auditoria sempre.
- **Hangfire** para jobs recorrentes — não on-demand, não cron caseiro.
- **3 flags ortogonais** na `Fatura` (`EstadoCiclo`, `EstadoPagamento`, `EstaAtrasada`), não enum monolítico.
- **API versioning:** todas as rotas em `/api/v1/...` (configurado globalmente, não precisa repetir em cada controller).
- **Error handling:** lançar `ArgumentException` (→400), `KeyNotFoundException` (→404), `InvalidOperationException` (→409), `UnauthorizedAccessException` (→401). Não usar try/catch nos controllers.
- **Paginação:** endpoints de listagem grande retornam `PagedResult<T>` com `?page=&pageSize=`.
- **Não vazar UI no backend** — copy, contagem de dias, cores são responsabilidade do frontend.

---

## 10. Quando em dúvida

- **Sobre o domínio existente:** `docs/DATABASE.md`, `docs/FLOWS.md`, ou `Grep`/`Read` no código real.
- **Sobre a nova feature Família:** `docs/features/familia/visao.md` (visão de produto, não spec técnica fechada).
- **Sobre código existente:** `Grep`/`Read` direto — nunca chutar.
- **Sobre algo realmente ambíguo:** pergunte ao usuário **uma coisa específica**, não bloco genérico.

---

## 11. Para começar agora

1. Invocar skill `caveman` (modo `full`).
2. Rodar o **pré-flight de git** (seção 3): atualizar `main`, ver Issues no GitHub, escolher/retomar Issue, criar branch.
3. `Read` em `IMPLEMENTATION_STATE.md` (na branch).
4. Identificar issue/etapa atual.
5. Continuar dali em diante. Se nenhuma issue está em execução, perguntar ao usuário qual quer iniciar (ver `ISSUES.md` Bloco A — começo natural).

Boa sessão.
