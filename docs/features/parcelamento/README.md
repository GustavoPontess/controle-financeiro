---
feature: parcelamento
status: CONCLUIDA
implementada_em: 2026-05-10
issue_original: Q2 2026 #1
owner: Gustavo
last_reviewed: 2026-05-15
next_review: 2026-08-15
---

# Feature: Parcelamento Flexível

**Status:** ✅ Concluída em maio de 2026 (Issue #1 do backlog Q2 2026).

---

## O que essa feature resolve

Permite que uma compra seja dividida em N parcelas **com datas flexíveis**, ao invés de N parcelas consecutivas mês a mês como na implementação original. Suporta também juros simples (ex: PIX parcelado com taxa).

Exemplo: compra de R$ 1.200 em 3 parcelas — Parcela 1 em julho, Parcela 2 em setembro, Parcela 3 em novembro. Sem precisar lançar 3 transações separadas.

---

## Documentos da feature

| Arquivo | Conteúdo |
|---|---|
| [arquitetura.md](./arquitetura.md) | Especificação técnica completa: entidades, services, controllers, fluxos, idempotência, soft delete, jobs Hangfire |
| [ux.md](./ux.md) | Mockups, copy de UI, alertas, hierarquia visual |

---

## Implementação — resumo

**Entidades novas:**
- `Parcelamento` — agrupa 1+ parcelas flexíveis de uma compra
- `ParcelaTransacao` — cada parcela individual com data própria
- `FinancialEventLog` — auditoria + idempotência

**Entidades atualizadas:**
- `Fatura` — 3 flags ortogonais (`EstadoCiclo`, `EstadoPagamento`, `EstaAtrasada`)
- `CartaoCredito` — `LimiteTotal` + cálculo dinâmico de limite usado
- `Transacao` — `ParcelamentoId`, `StatusTransacao`, soft delete (`Ativo`)
- `Recorrente` — janela móvel de 3 meses + `CartaoCreditoId`

**Services:** `ParcelamentoService`, `ParcelaTransacaoService`, `LimiteCalculatorService`, `FinancialEventLogService`

**Controllers:** `ParcelamentosController`, `ParcelasController`

**Jobs Hangfire (5):** `FaturaFechamentoJob`, `FaturaAtrasoJob`, `ExpandirRecorrentesJob`, `ExecutarRecorrentesJob`, `RecalcularLimitesJob`

**Frontend:** páginas `/parcelamentos` (listagem) e `/parcelamentos/:id` (detalhe), componentes de card, modais e badges.

**Testes:** 13 testes xUnit (5 LimiteCalculator + 5 Parcelamento + 3 E2E).

---

## Padrões introduzidos por essa feature

Padrões que **continuam valendo** para qualquer feature financeira nova:

- **Soft delete obrigatório** em entidades financeiras (`Ativo` flag)
- **Idempotência** via header `Idempotency-Key` em endpoints transacionais
- **`FinancialEventLog`** registra toda mudança de saldo/limite
- **3 flags ortogonais na Fatura** (substitui enum monolítico anterior)
- **Hangfire** para jobs de domínio (não cron caseiro)

Esses padrões estão documentados em `docs/STANDARDS.md` (seções "Soft delete", "Idempotência", "Auditoria financeira", "Background jobs").

---

## Tempo de implementação

~11 horas em 13 sessões. Histórico detalhado de cada sessão em `docs/history/IMPLEMENTATION_STATE_2026Q2_parcelamento.md`.

---

## O que NÃO está implementado nessa feature

Itens que apareceram em discussões mas ficaram fora do escopo:

- Antecipação de fatura inteira (pagar todas as parcelas restantes de uma vez)
- Renegociação de parcelamento (mudar datas após criado)
- Parcelamento com juros compostos (apenas juros simples no MVP)
- Parcelamento entre múltiplos cartões (1 parcelamento = 1 cartão)

Se algum desses virar requisito futuro, criar nova issue e novo doc de arquitetura na pasta.
