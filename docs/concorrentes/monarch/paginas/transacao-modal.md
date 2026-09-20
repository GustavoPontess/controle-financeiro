# Monarch — Modal **Add / Edit Transaction** (form de inserção)

> Comparar com o nosso `TransactionForm`. É o form mais importante do produto.

## Como abre
Botão **"Add transaction"** em vários lugares (página da conta, lista de Transactions, etc). Abre modal centralizado com **Close (×)**.

## Estrutura do form (ordem de cima pra baixo)

| # | Campo | Tipo | Comportamento |
|---|---|---|---|
| 1 | **Debit / Credit** | toggle (2 botões) | ⭐ **define o sinal SEM número negativo.** Debit = saída (despesa), Credit = entrada (receita). Amount é sempre positivo. |
| 2 | **Amount** | money input | `$0.00`, sem sinal (o sinal vem do toggle). |
| 3 | **Merchant** | typeahead (autocomplete) | busca comerciantes existentes; se não existe, oferece **"Create new '<texto>' merchant"** → cria na hora. |
| 4 | **Date** | date picker | default hoje ("September 20, 2026"); calendário navegável por teclado ("Press ? for shortcuts"). |
| 5 | **Account** | select | conta/cartão de origem (default = conta atual do contexto). |
| 6 | **Category** | typeahead + lista agrupada | taxonomia completa com **grupos + emoji** (ver abaixo). **NÃO filtra por Debit/Credit** — mostra tudo, Income no topo. |
| 7 | **Link/Contribute to save up goal** | select | ⭐ label **muda pelo toggle**: Debit = "**Link** to save up goal"; Credit = "**Contribute** to save up goal". Liga a transação a uma **meta** (default "No goal"). Conecta transação ↔ metas. |
| 8 | **Notes** | text | "Add a note...". |
| 9 | **Tags** | typeahead multi | "Search tags..." (marcação livre, além de categoria). |
| 10 | **Adjust the account balance by $X** | toggle | ⭐ (só conta manual) ON = a transação **atualiza o saldo** da conta pelo valor. "This will update the account's balance by the transaction amount". Permite lançar transação SEM mexer no saldo (reconciliação). |
| — | **Cancel / Add transaction** | botões | submit desabilitado até válido (amount>0). |

## ⭐ Achados-chave (pro nosso produto)
- **Debit/Credit toggle = exatamente a nossa regra "sem valor negativo"** ([[feedback_sem_valor_negativo]]). Monarch nunca aceita `-`; o tipo é escolha explícita. Validação viva do nosso caminho — **retirada/despesa é operação (toggle), não número negativo.**
- **Merchant como entidade** (não texto livre): typeahead + create-on-the-fly. Permite depois "View merchant" (histórico por comerciante), regras de auto-categorização por merchant. Nosso modelo hoje não tem entidade Merchant → **candidato de roadmap**.
- **Transação ↔ Meta** embutido no form ("Contribute/Link to goal"). Casa com o modelo de alocação de metas ([goals](./goals.md)). No nosso, metas são desconectadas das transações (P2 ROADMAP) — aqui está o elo.
- **"Adjust balance" toggle**: separa "registrar transação" de "corrigir saldo" — essencial pra conta manual. Nosso app calcula saldo das transações; esse toggle é útil se adotarmos contas manuais com saldo informado.
- **Tags** além de categoria: dimensão extra de análise (ex.: "reembolsável", "viagem X").

## Taxonomia de categorias padrão (grupos + itens + emoji)
> Referência pro nosso `CategoriaSeeder`. Estrutura hierárquica **Grupo → Categoria**.

- **Income:** 💵 Paychecks · 💸 Interest · 💰 Business Income · 💰 Other Income
- **Gifts & Donations:** 🎗 Charity · 🎁 Gifts
- **Auto & Transport:** 🚗 Auto Payment · 🚃 Public Transit · ⛽️ Gas · 🔧 Auto Maintenance · 🏢 Parking & Tolls · 🚕 Taxi & Ride Shares
- **Housing:** 🏠 Mortgage · 🏠 Rent · 🔨 Home Improvement
- **Bills & Utilities:** 🗑 Garbage · 💧 Water · ⚡️ Gas & Electric · 🌐 Internet & Cable · 📱 Phone
- **Food & Dining:** 🍏 Groceries · 🍽 Restaurants & Bars · ☕️ Coffee Shops
- **Travel & Lifestyle:** 🏝 Travel & Vacation · 🎥 Entertainment & Recreation · 👑 Personal · 🐶 Pets · 😜 Fun Money
- **Shopping:** 🛍 Shopping · 👕 Clothing · 🪑 Furniture & Housewares · 🖥 Electronics
- **Children:** 👶 Child Care · ⚽️ Child Activities
- **Education:** 🎓 Student Loans · 🏫 Education
- **Health & Wellness:** 💊 Medical · 🦷 Dentist · 💪 Fitness
- **Financial:** 💰 Loan Repayment · 🗄 Financial & Legal Services · 🏦 Financial Fees · 🏧 Cash & ATM · ☂️ Insurance · 🏛️ Taxes
- **Other:** ❓ Uncategorized · 💸 Check · 💲 Miscellaneous
- **Business:** 📣 Advertising & Promotion · 📞 Business Utilities & Communication · 💵 Employee Wages & Contract Labor · 🍴 Business Travel & Meals … (+ itens de negócio)

**Padrão de categoria:** 2 níveis (grupo/categoria), emoji por item, grupo "Income" separado das despesas (define `Finalidade` Receita/Despesa como no nosso). BR precisa de: manter grupos, trocar US-específicos (Student Loans, 401k n/a) por BR (ex.: adicionar categorias de PIX/cartão). Nosso `Finalidade` (Despesa/Receita/Ambas) já cobre o topo da hierarquia.

## Comparação rápida com o NOSSO form
| Aspecto | Monarch | Nosso (hoje) |
|---|---|---|
| Sinal | toggle Debit/Credit | tipo de transação (a confirmar UX — garantir toggle, nunca `-`) |
| Merchant | entidade + typeahead + create | texto livre (sem entidade Merchant) ❌ |
| Categoria | grupo→cat + emoji | temos categoria + Finalidade ✅ (revisar emoji/grupos) |
| Meta no form | Link/Contribute to goal ✅ | ausente ❌ (P2) |
| Tags | sim ✅ | a confirmar |
| Ajustar saldo | toggle (conta manual) | saldo é calculado (n/a até termos conta manual) |
| Recorrência | (ver [recurring](./recurring.md)) | temos Recorrente ✅ |
