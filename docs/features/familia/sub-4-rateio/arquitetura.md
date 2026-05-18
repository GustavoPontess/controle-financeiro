---
feature: familia
sub-feature: sub-4-rateio
issue: '#25'
status: EM_IMPLEMENTACAO
owner: Gustavo
created: 2026-05-17
---

# Sub-feature 4 — Modos de rateio

Spec técnica da Issue #25. Visão em `../visao.md`. Depende de #23 (Despesa
Compartilhada — modo igualitário).

Entrega: além do rateio **igualitário** (#23), a família pode dividir despesas
**proporcionalmente à renda** de cada membro ou de forma **personalizada** por
despesa. Os balanços passam a respeitar o modo escolhido.

---

## 1. Conceitos

Três modos de rateio:

| Modo | Valor | Como divide |
|---|---|---|
| Igualitário | 1 | Total ÷ nº de membros (comportamento de #23) |
| Proporcional | 2 | Cota de cada membro proporcional à sua renda mensal |
| Personalizado | 3 | Percentuais definidos despesa a despesa |

O modo é definido em **dois níveis**:

- **Família** — `Familia.ModoRateioPadrao` (default `Igualitario`). Vale para toda
  despesa compartilhada que não tenha override.
- **Despesa** — `Transacao.ModoRateio` (nullable). Quando preenchido, sobrepõe o
  padrão da família **para aquela despesa**. `null` = usa o padrão da família.

---

## 2. Entidades

### Enum `ModoRateio`
```csharp
public enum ModoRateio { Igualitario = 1, Proporcional = 2, Personalizado = 3 }
```

### Familia (alteração)
Ganha `ModoRateioPadrao` (`ModoRateio`, default `Igualitario`).

### MembroFamilia (alteração)
Ganha `RendaMensal` (`decimal?`, nullable) — usada no modo proporcional.

### Transacao (alteração)
Ganha `ModoRateio` (`ModoRateio?`, nullable) — override por despesa.

### RateioTransacao (nova)
Define a cota personalizada de um membro numa despesa. Só existe para despesas
em modo `Personalizado`.

| Campo | Tipo | Notas |
|---|---|---|
| Id | Guid | PK |
| TransacaoId | Guid | FK Transacao |
| UsuarioId | Guid | FK Usuario (membro) |
| Percentual | decimal | 0–100; soma de todos os itens da transação = 100 |

---

## 3. Regras de cálculo do balanço

Para cada despesa compartilhada do mês, determina-se o **modo efetivo**:
`transacao.ModoRateio ?? familia.ModoRateioPadrao`.

- **Igualitário** — cada membro deve `valor ÷ nº membros`.
- **Proporcional** — cada membro deve `valor × (renda_m ÷ Σ renda)`. Se a soma
  das rendas for 0 (ninguém preencheu), faz fallback para igualitário **nessa
  despesa**.
- **Personalizado** — usa os `RateioTransacao` da despesa: cada membro deve
  `valor × percentual ÷ 100`. Se não houver itens definidos, fallback igualitário.

A cota de cada membro no balanço é a soma das cotas devidas em todas as despesas
do mês. `Saldo = pagou − cota_devida`.

---

## 4. Endpoints

| Método | Rota | Descrição |
|---|---|---|
| PUT | `/familias/{id}/modo-rateio` | Define o modo padrão da família (`{ modo }`) |
| PUT | `/familias/{id}/membros/{membroId}/renda` | Define a renda mensal de um membro (`{ rendaMensal }`) |
| PUT | `/transacoes/{id}/rateio` | Define modo + itens personalizados da despesa |
| DELETE | `/transacoes/{id}/rateio` | Remove o override — despesa volta ao padrão da família |

---

## 5. DTOs

- `DefinirModoRateioDto { ModoRateio Modo }`
- `DefinirRendaDto { decimal? RendaMensal }`
- `DefinirRateioTransacaoDto { ModoRateio Modo, List<RateioItemDto>? Itens }`
- `RateioItemDto { Guid UsuarioId, decimal Percentual }`
- `RateioTransacaoDto { ModoRateio? Modo, List<RateioItemDto> Itens }`
- `SaldoMembroDto` ganha `Cota` (cota devida individual).
- `BalancoFamiliaDto` ganha `Modo` (modo padrão da família).

---

## 6. Regras

- Só membros ativos definem modo/renda/rateio.
- `RendaMensal` ≥ 0 quando informada.
- Modo `Personalizado` numa transação exige itens cujos percentuais somem 100
  (tolerância 0,01) e que sejam membros ativos da família da despesa.
- `RateioTransacao` é substituído por completo a cada `PUT` (não há merge).
- Trocar o modo padrão da família recalcula os balanços (cálculo é dinâmico —
  nada é persistido além das definições).

---

## 7. Etapas de implementação

1. Enum `ModoRateio` + `Familia.ModoRateioPadrao` + `MembroFamilia.RendaMensal` +
   `Transacao.ModoRateio` + entidade `RateioTransacao` + `AppDbContext` + migration
2. DTOs + `RateioService` (definir modo, renda, rateio custom) + refatorar
   `DespesaCompartilhadaService.ObterBalancoAsync` para respeitar os modos
3. Endpoints — `FamiliasController` + `TransacoesController`
4. Frontend: seletor de modo na `FamiliasPage`, renda por membro, rateio custom
   na `TransactionTable`
5. Testes de serviço
