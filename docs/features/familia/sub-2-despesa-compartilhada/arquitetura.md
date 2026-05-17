---
feature: familia
sub-feature: sub-2-despesa-compartilhada
issue: '#23'
status: EM_IMPLEMENTACAO
owner: Gustavo
created: 2026-05-17
---

# Sub-feature 2 — Despesa Compartilhada (modo igualitário)

Spec técnica da Issue #23. Visão em `../visao.md` §7. Depende de #22 (Família +
Membros). Entrega: marcar transação como compartilhada com uma família, feed de
despesas compartilhadas, balanço mensal no **modo igualitário**.

**Escopo MVP:** só o modo igualitário. Modos proporcional/custom são #25.
Dependentes (beneficiários sem peso) são #24. Acerto de contas é #26.

---

## 1. Modelagem

Sem entidade nova. Uma despesa compartilhada **é uma `Transacao`** marcada com
uma família — princípio da visão §2 (compartilhamento é camada opcional sobre o
individual).

`Transacao` ganha um campo:

| Campo | Tipo | Notas |
|---|---|---|
| FamiliaId | Guid? | FK Familia, nullable. Preenchido → despesa compartilhada |

- **Pagador** da despesa = `Transacao.CriadoPor` (usuário que lançou).
- **Beneficiários** (modo igualitário) = todos os membros ativos da família —
  não armazenado, derivado no cálculo.
- Marcar/desmarcar é reversível; não altera conta/cartão da transação.

Por que não entidade separada: o rateio igualitário é puramente calculado
(total ÷ nº membros). Tabelas de pagadores/beneficiários só passam a ser
necessárias nos modos proporcional/custom (#25) — adicioná-las agora é YAGNI.

---

## 2. Cálculo do balanço (modo igualitário)

Para uma família e um mês de referência:

1. `despesas` = transações com `FamiliaId = X`, `Ativo`, `StatusTransacao =
   Executado`, `Tipo = Despesa`, `Data` no mês.
2. `total` = soma de `Valor` das despesas.
3. `membros` = membros ativos da família. `cota = total / nº membros`.
4. Para cada membro: `pagou` = soma das despesas em que `CriadoPor = membro`.
   `saldo = pagou − cota`.
   - `saldo > 0` → a família deve a esse membro.
   - `saldo < 0` → esse membro deve à família.

---

## 3. Endpoints

| Método | Rota | Descrição | Autorização |
|---|---|---|---|
| PUT | `/api/v1/transacoes/{id}/compartilhamento` | Marca/atualiza a família da transação | dono da transação, membro da família |
| DELETE | `/api/v1/transacoes/{id}/compartilhamento` | Desmarca (volta a pessoal) | dono da transação |
| GET | `/api/v1/familias/{id}/despesas?mes=&ano=` | Feed de despesas compartilhadas | membro |
| GET | `/api/v1/familias/{id}/balanco?mes=&ano=` | Balanço mensal igualitário | membro |

---

## 4. DTOs

- `CompartilharTransacaoDto { Guid FamiliaId }`
- `DespesaCompartilhadaDto { Id, Descricao, Valor, Data, CategoriaNome,
  PagadorUsuarioId, PagadorNome }`
- `BalancoFamiliaDto { Mes, Ano, Total, Cota, List<SaldoMembroDto> }`
- `SaldoMembroDto { UsuarioId, Nome, Pagou, Saldo }`

---

## 5. Regras

- Só transações `Tipo = Despesa` podem ser compartilhadas (receita pessoal não
  entra no rateio do MVP).
- O usuário só compartilha em famílias das quais é membro ativo.
- Desmarcar não apaga a transação — só limpa `FamiliaId`.
- Multi-tenancy: feed/balanço exigem que o solicitante seja membro da família.

---

## 6. Etapas de implementação

1. `Transacao.FamiliaId` + FK no `AppDbContext` + migration
2. DTOs + `DespesaCompartilhadaService` (marcar, desmarcar, feed, balanço)
3. Endpoints — `TransacoesController` (compartilhamento) + `FamiliasController`
   (despesas, balanço)
4. Frontend: marcar transação como compartilhada; aba de despesas/balanço na
   família
5. Testes de serviço
