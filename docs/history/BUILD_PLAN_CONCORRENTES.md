# Plano de build — features dos achados de concorrentes

> Tradução dos achados acionáveis (`docs/concorrentes/ACHADOS_ACIONAVEIS.md`) em tarefas concretas no nosso stack. **Sem gating/plano/preço** — tudo acessível a todos por enquanto (decisão do dono, 2026-05-31). Ordem = quick-wins primeiro.

## Convenções (CLAUDE.md / Q5)
- Branch por feature: `feature/<slug>`. CSS Modules + `var(--pontes-*)`. Componentes só de `@/components/pontes`. Validação por campo. Teste front (vitest) + back (xUnit). PontesDialog pra confirmação.

---

## Lote 1 — quick-wins (front + dados que já temos)

### 1.1 Filtros de transação ricos ⭐ (flagship UX)
- **Hoje:** `TransacaoService` filtra `from`/`to`/`categoriaId`. UI tem mês + chips Tudo/Receitas/Despesas.
- **Add backend** (`TransacaoService.Listar` + `TransacoesController` query params): `contaId`, `cartaoId`, `valorMin`/`valorMax`, `status` (previsto/efetivado), `ordenacao` (data/valor ↑↓). Manter paginação server-side.
- **Add front** (`pages/Transactions`): drawer/painel "Filtros" (PontesDrawer) com Conta (PontesSelect), Cartão, Valor mínimo (PontesMoneyInput), Status (PontesToggle/segment), Ordenação. Chips de filtro ativo + "Limpar".
- **Testes:** back (query com cada filtro + combinação); front (aplica filtro → chama service com params).
- _Fonte: Despezzas + Pierre._

### 1.2 Privacy toggle (ocultar saldo) 🟢 menor
- Front-only: botão olho nos cards de saldo (Dashboard, Transactions hero, Contas). Estado em `localStorage` (`pontes:hideBalance`), mascara valores com `••••`. Componente `PontesSensitiveValue` no DS (reutilizável).
- **Teste:** toggle esconde/mostra; persiste.
- _Fonte: Despezzas._

### 1.3 Variação % vs mês anterior nos cards
- Front: nos cards de gasto/categoria (Dashboard, `/reports`), calcular delta vs mês anterior + seta colorida (verde caindo p/ despesa). Dados já vêm das transações.
- **Teste:** cálculo de variação + sinal/cor.
- _Fonte: Pierre + Despezzas. (Parte já no `/reports`.)_

### 1.4 Orçamento simples (salário − meta)
- **Back:** entidade/campos `Orcamento` (salarioMensal, metaEconomia) por usuário — ou estender Usuario. Endpoint GET/PUT.
- **Front:** card "Configure seu orçamento" no Dashboard + seção em `/perfil`: salário, meta → "quanto posso gastar" (salário − meta). Barra de progresso do mês.
- **Testes:** back (CRUD + cálculo); front (render + salvar).
- _Fonte: Despezzas._

---

## Lote 2 — colaboração / família (encaixa no fosso)

### 2.1 Atribuir transação a um membro/responsável
- **Back:** `Transacao.responsavelId` (membro da família). Filtro por responsável. Migration.
- **Front:** campo "responsável" no form de transação + coluna/badge na lista + filtro.
- _Fonte: Monarch ("assign to review")._

### 2.2 Família REAL — rateio "quem paga o quê" + settle-up ⭐⭐ (FOSSO, prioridade de produto)
- Spec própria em `docs/features/familia/` (ampliar). Rateio proporcional de despesa entre membros, saldo "quem deve a quem", quitação. **Maior diferenciação — nenhum concorrente faz.**
- Quebrar em sub-issues: modelo de dados (rateio, share por membro), cálculo de saldo entre membros, UI de divisão no lançamento, tela "acertos".

### 2.3 Papéis/permissões + dependentes
- Papéis (admin/membro/dependente), permissões por papel, contas de dependente. Parte da visão família.

### 2.4 Aprovação de despesa (fluxo família)
- Despesa acima de X exige aprovação de outro membro. Estado pendente/aprovada.

---

## Lote 3 — aquisição / SEO (site público)

### 3.1 Tela/visão de Assinaturas
- Derivar de `Recorrente`: agrupar recorrências, total/mês, "em qual cartão", projeção anual. Nova seção/tela interna.
- _Fonte: Pierre, Despezzas, Monarch._

### 3.2 Ferramentas grátis (calculadoras) + páginas de comparação
- Páginas públicas `pages/Site/ferramentas/`: calculadora de rendimento (juros compostos), CLT×PJ. SEO "sem cadastro". + páginas de comparação.
- _Fonte: Despezzas, Monarch, Qive._

### 3.3 Fotografia lifestyle de casal/família no site
- Trocar/inserir imagens lifestyle em `/casais` e `/contadores`. Asset + design.
- _Fonte: Monarch._

### 3.4 Programa de indicação (referral)
- **Back:** código de indicação por usuário, contagem de convidados. **Front:** seção "Convide e ganhe".
- _Fonte: Despezzas + Monarch._

---

## Lote 4 — eixo PJ / contador (futuro)

### 4.1 Wedge PJ leve + ponte contador
- Separar PF/PJ, módulo NF simples, conexão com contador (referência: fluxo Conta Azul "emite NF → entrega pro cliente E contabilidade"). Spec dedicada antes de codar.

---

## Lote 5 — estratégico (caro, longo)
- **Open Finance / agregação** (gap nº 1, table-stakes).
- **IA conversacional / categorização**.
- **App mobile / PWA**.

---

## Ordem de execução sugerida
1.2 (privacy toggle, menor) → 1.1 (filtros, flagship) → 1.4 (orçamento) → 1.3 (variação%) → 3.1 (assinaturas) → 2.1 (responsável) → 3.2 (calculadoras SEO) → 3.4 (indicação) → **2.2 família real (fosso, maior peso)** → resto.

> Status vivo da execução em `IMPLEMENTATION_STATE.md`.
