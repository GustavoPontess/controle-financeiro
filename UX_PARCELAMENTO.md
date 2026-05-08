# 🎨 UX: Sistema de Parcelamento

**Data de criação:** 2026-05-08 (extraído de `ARQUITETURA_PARCELAMENTO.md`)
**Documento irmão:** `ARQUITETURA_PARCELAMENTO.md` (regras de domínio e contratos de API)
**Status:** Mockups iniciais — refinar com design system (`DESIGN_SYSTEM.md`)

---

## Princípio orientador

A UX vive aqui. A arquitetura/domínio vive em `ARQUITETURA_PARCELAMENTO.md`.

Isso evita que copy de UI ("⚠️ URGENTE!", "faltam 29 dias") vaze para o backend.
Componentes de frontend consomem os contratos definidos em `ARQUITETURA_PARCELAMENTO.md > Dashboard - Contratos de API` e aplicam aqui as regras de cor, hierarquia e copy.

---

## 📱 Dashboard — visão geral

```
┌─ LIMITE DE CRÉDITO (CARTÃO) ────────────┐
│ Total: R$ 5.000                          │
│ Bloqueado (executado): R$ 2.065         │
│ Previsão (próximos meses): R$ 500       │
│ ████████░░░░░░░░░░ 41% bloqueado        │
│ Disponível: R$ 2.435                    │
└──────────────────────────────────────────┘

┌─ SALDO DA CONTA (Carteira) ─────────────┐
│ Saldo: R$ 15.000 (calculado)            │
│ ├─ Receitas: R$ 25.000                  │
│ └─ Despesas: R$ 10.000                  │
│                                          │
│ Previsão (próximos meses):               │
│ ├─ Salários: +R$ 15.000 (JUN-SET)       │
│ ├─ Despesas: -R$ 2.000 (JUN-SET)        │
│ └─ Saldo estimado DEZ: R$ 28.000        │
└──────────────────────────────────────────┘

┌─ MEUS PARCELAMENTOS ─────────────────────┐
│                                          │
│ NOTEBOOK ASUS                            │
│ 4 parcelas de R$ 1.500 (SEM JUROS)       │
│ ████░░░░░░ 1/4 pago                     │
│ Próxima parcela na fatura JUL/2026       │
│ Total restante: R$ 4.500                 │
│ [VER DETALHES] [PAGAR PARCELA AGORA]     │
│                                          │
│ MONITOR LG                               │
│ 2 parcelas de R$ 1.000 (SEM JUROS)       │
│ ████████░░ 1/2 pago                      │
│ Próxima parcela na fatura SET/2026       │
│ Total restante: R$ 1.000                 │
│ [VER DETALHES] [PAGAR PARCELA AGORA]     │
│                                          │
│ PIX CRÉDITO                              │
│ 3 parcelas (COM JUROS 5% a.m. — APROX.)  │
│ ████░░░░░░ 1/3 pago                      │
│ Próxima parcela na fatura JUL/2026       │
│ Total restante: R$ 999                   │
│ [VER DETALHES] [PAGAR PARCELA AGORA]     │
│                                          │
└──────────────────────────────────────────┘

┌─ FATURAS PRÓXIMAS (CARTÃO) ─────────────┐
│ JUL/2026: R$ 3.200 (Vence 08/07) 🔴      │
│ AGO/2026: R$ 2.100 (Vence 08/08)         │
│ SET/2026: R$ 1.200 (Vence 08/09)         │
│                                          │
│ AÇÕES:                                   │
│ [PAGAR ANTECIPADO] [VER DETALHE]         │
└──────────────────────────────────────────┘

┌─ PREVISÃO RECORRENTES (PRÓXIMOS MESES) ─┐
│ Receitas:                                │
│ ├─ Salário: +R$ 5.000 × 7 meses          │
│ └─ Total previsão: +R$ 35.000            │
│                                          │
│ Despesas:                                │
│ ├─ Netflix: -R$ 20 × 7 meses             │
│ ├─ Spotify: -R$ 15 × 7 meses             │
│ └─ Total previsão: -R$ 245               │
│                                          │
│ Saldo estimado (JAN/2027): +R$ 34.755    │
└──────────────────────────────────────────┘
```

> **Nota crítica de copy:** evitar mostrar "Próxima: 07/08/2026 (29 dias)" para parcelas individuais.
> Parcela vence junto com a fatura. Mostrar "Próxima parcela na fatura JUL/2026" e deixar
> a contagem de dias para a fatura, não para a parcela isolada.

---

## Modal: Cancelar Parcelamento

```
┌────────────────────────────────────────┐
│ Cancelar parcelamento "Notebook ASUS"? │
│                                        │
│ ⚠️ Você cancelará as 3 parcelas que    │
│ ainda não foram pagas.                 │
│                                        │
│ A parcela 1 (R$ 1.500) já foi paga e   │
│ NÃO será reembolsada automaticamente.  │
│                                        │
│ Motivo do cancelamento:                │
│ [______________________________]       │
│                                        │
│ [ Manter parcelamento ]                │
│ [ Cancelar parcelamento ]              │
└────────────────────────────────────────┘

Após cancelar:
├─ Toast: "Parcelamento cancelado. 3 parcelas removidas das faturas futuras."
├─ Se requerEstorno=true (havia parcelas pagas):
│  └─ Banner: "Quer registrar estorno da parcela paga? [REGISTRAR ESTORNO]"
└─ Dashboard atualiza limite disponível
```

---

## Modal: Pagar Parcela Antecipado

```
┌────────────────────────────────────────┐
│ Pagar parcela 2 do "Notebook ASUS"?    │
│                                        │
│ Valor: R$ 1.500                        │
│ Vence em: 07/08/2026 (junto com a      │
│ fatura AGO/2026)                       │
│                                        │
│ Pagar a partir de:                     │
│ [Conta Corrente — R$ 15.000 ▼]         │
│                                        │
│ Após pagar:                            │
│ • Saldo da conta: R$ 13.500            │
│ • Limite liberado: R$ 1.500            │
│                                        │
│ [ Cancelar ] [ Confirmar pagamento ]   │
└────────────────────────────────────────┘
```

---

## Estados visuais da fatura (3 dimensões → cor)

A arquitetura define 3 flags ortogonais. A UI compõe a representação visual:

| EstadoCiclo | EstadoPagamento | EstaAtrasada | Badge na UI       | Cor    |
|-------------|-----------------|--------------|-------------------|--------|
| Aberta      | NaoPago         | false        | "Em aberto"       | cinza  |
| Aberta      | Parcial         | false        | "Pago parcial"    | azul   |
| Aberta      | Pago            | false        | "Pago antecipado" | verde  |
| Fechada     | NaoPago         | false        | "Aguardando pagamento" | amarelo |
| Fechada     | Parcial         | false        | "Pago parcial"    | azul   |
| Fechada     | Pago            | false        | "Quitada"         | verde  |
| Fechada     | NaoPago         | true         | "Atrasada"        | vermelho |
| Fechada     | Parcial         | true         | "Atrasada (parcial)" | vermelho |

---

## TODO (refinar com `frontend-design`)

- [ ] Aplicar tipografia e tokens de cor de `DESIGN_SYSTEM.md`
- [ ] Componente `<ParcelamentoCard />` com variantes
- [ ] Modal `<CancelarParcelamentoModal />`
- [ ] Modal `<PagarParcelaModal />`
- [ ] Badge `<FaturaStatusBadge />` baseado nas 3 flags
- [ ] Tela `Parcelamentos > Detalhe` com timeline de parcelas
- [ ] Empty states (sem parcelamentos, sem faturas, sem recorrentes)
- [ ] Loading states (skeleton)
- [ ] Tratamento de erros de validação (limite insuficiente, saldo insuficiente)
