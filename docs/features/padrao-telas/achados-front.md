---
owner: Gustavo
last_reviewed: 2026-09-28
status: A CORRIGIR (branch exp/consistencia-front)
---

# Achados do front — inconsistências e erros a corrigir

Recuperado da sessão de 2026-09-28 (o experimento do molde genérico foi abandonado; estes achados
sobreviveram). **Regra desta rodada:** padronizar os DETALHES sem mexer no visual bonito das telas —
os cards continuam como estão; o que muda é onde/como aparecem as ações e os filtros.

## 1. Ações da linha — hoje cada tela faz de um jeito (unificar em ⋮ `PontesRowActions`)

Levantado por grep em 2026-09-28:

| Tela | Como mostra as ações hoje | Alvo |
|---|---|---|
| Transferências, Contas Fixas | ⋮ menu (já ok) | manter |
| Transações (`TransactionTable`) | mistura: ⋮ + ícones soltos + chips | só ⋮ |
| Contas (`AccountsPage`) | ícones soltos (5) | ⋮ |
| Metas | ícones soltos (5) | ⋮ |
| Limites | ícones soltos (5) | ⋮ |
| Categorias | ícones soltos (9) | ⋮ (ou manter árvore, mas ações no ⋮) |
| Família detalhe | ícones soltos (19) | ⋮ (menos caixa de pendências: Aprovar/Recusar visíveis) |
| Cartões | ícones soltos (3) | ⋮ |
| Empréstimos (`LabItemParts`) | ícones soltos (7) | ⋮ |
| Parcelamentos | botão "Detalhes" na linha | linha clicável + ⋮ |

Regra: ação destrutiva por último no ⋮, confirmada com `PontesDialog`. Clicar na linha/card abre o detalhe.

## 2. Filtros — padronizar a faixa (busca + `PontesSegmented`, mesma posição)

- Empréstimos usa `PontesSegmented` (Tudo / A receber / A pagar) + "Arquivados" — ok, mas fora da `PontesToolbar`.
- Transações usa chips próprios (Tudo / Receitas / Despesas).
- Só Transferências e Contas Fixas usam `PontesToolbar` (busca + segmented no mesmo lugar).
- Gustavo quer: **o filtro no mesmo lugar, do mesmo jeito, em todas as telas.** Quando o filtro estiver
  ativo, mostrar as tags do que está filtrado embaixo, igual em todas (hoje só algumas mostram).

## 3. Erros/bugs de dinheiro (P1 — já na Fila do ROADMAP, conferidos no código)

- Parcelamentos gera `Idempotency-Key` nova a cada envio → tentar de novo após queda de rede pode duplicar.
- Contas Fixas grava "1.500" como R$ 1,50 (campo de texto livre + parser próprio; usar `PontesMoneyInput`).
- Conta fixa cobra no dia errado e mostra "próxima cobrança" errada (o `Dia` é ignorado; a tela lê o fim da janela de previsão).
- Conta fixa **pausada ou excluída continua debitando** (o job efetiva as previsões sem olhar se está pausada; excluir é hard delete).
- "Custo mensal" das contas fixas só soma as mensais (semanais/anuais ficam de fora) — P2.
- API da Família devolve a renda de **todos** os membros pra todos (privacidade) — P1.

## 4. Achados de usabilidade (skill revisar-usabilidade, 2026-09-28) — reconferir antes de corrigir

Independentes do visual:
- Transferência criada sem `Idempotency-Key` (o DTO nem tem o campo) → nova tentativa cria 2 transferências.
- Toasts de erro genéricos escondem a mensagem de regra do servidor (usar `notificacaoDeErro` de `@/utils/apiError`).
- Campos de texto sem `maxLength` (descrição, motivo) — `docs/REGRAS_CAMPOS.md`.
- Contas Fixas: categoria não filtrada pela finalidade (aceita "Salário" numa despesa); só oferece Conta, não Cartão; data-fim antes do início passa na validação.
- Editar próxima ocorrência com os 2 campos vazios envia `{}` e diz "atualizado" sem mudar nada.
- `<label>` sem `htmlFor` / `PontesSelect` sem nome acessível (leitor de tela ouve "Selecione" repetido).
- `PontesModal` não prende o Tab (foco escapa pra página atrás).

Detalhe por tela: ver o histórico da sessão de 2026-09-28.
