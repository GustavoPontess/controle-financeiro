# Monarch — **Transactions** (`/transactions`) — lista/gestão

> A lista global. Form de criar/editar está em [transacao-modal](./transacao-modal.md).

## Sub-abas
- **All** · **Receipts** (badge New — captura/anexo de recibos + matching a transações) · **Retail Sync** (sincroniza detalhe de compra de varejo, ex.: itens do Amazon).

## Barra superior
- **Search** (busca) · **Date** (range) · **Filters** · **Add** (abre o modal).
- Toolbar: **All transactions** (view/preset dropdown) · **Edit multiple** (seleção em massa) · **Sort** · **Columns** (escolher colunas visíveis).

## ⭐ Filtros (multi-dimensão, server-side)
Painel com dimensões (menu esquerdo) + valores (checkbox multi-select, searchable, Select all):
- **Categories** (agrupadas: Income → Paychecks/Interest/…; Auto & Transport → …).
- **Merchants**.
- **Accounts**.
- **Tags**.
- **Goals** (transações ligadas a metas).
- **Amount** (faixa de valor).
- **Other** (provável: tipo, status, revisão/needs-review, oculta, etc).
- Footer: Clear · Cancel · **Apply**; contador "N filters selected".

→ Confirma nossa regra [[feedback_consultas_server_side]]: filtro/busca/paginação **no servidor**, multi-critério. Podemos filtrar por várias dimensões combinadas.

## Lista
- Agrupada por **data**, com subtotal do dia (ex.: "+$2.380,00").
- Linha: ícone · **merchant** · **categoria** (com emoji) · **conta** · **valor** (verde=credit, preto=debit) · chevron (abre detalhe).
- **Edit multiple** → seleção → ações em massa (recategorizar, tag, deletar…).
- **Columns** → customizar colunas.

## Summary (painel lateral)
Total transactions · Largest transaction · Largest expense · Average transaction · Total income · Total spending · First/Last transaction · **Download CSV**.

## Como fazer no nosso (stack)
- **Filtro server-side multi-dimensão:** endpoint aceita `categorias[]`, `merchants[]`, `contas[]`, `tags[]`, `metas[]`, `valorMin/Max`, `dataIni/Fim`, `q` (busca), paginação. Devolve `PagedResult<T>` (já temos esse envelope). NUNCA filtrar só a página carregada.
- **Presets de filtro salvos** ("All transactions" dropdown) — reusa ideia de relatórios salvos.
- **Edit multiple** = bulk update com `Idempotency-Key`.
- **Colunas customizáveis** = preferência do usuário.
- **Receipts** (anexar recibo) e **Retail Sync** (itens da compra) — features avançadas; Receipts casa com nota fiscal BR (NFC-e/QR) — **oportunidade BR** (ler NFC-e por QR code e casar com transação).

## O que roubar (BR)
- **Receipts → NFC-e/QR**: no BR toda compra tem nota fiscal com QR; ler e anexar/itemizar seria diferencial local forte (Monarch faz "Retail Sync" via integração US; BR tem o QR da SEFAZ de graça).
- Filtro multi-dimensão + Download CSV (eixo contador).
