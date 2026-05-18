---
feature: familia
sub-feature: sub-5-acerto
issue: '#26'
status: EM_IMPLEMENTACAO
owner: Gustavo
created: 2026-05-18
---

# Sub-feature 5 — Acerto de contas

Spec técnica da Issue #26. Visão em `../visao.md` §7.4. Depende de #23 (Despesa
Compartilhada) e #25 (Modos de rateio).

Entrega: fechar o saldo pendente entre membros da família. Registrar que uma
dívida foi paga ("marcar como pago"), manter histórico, e fazer o balanço
refletir o que já foi acertado.

**Acerto** = registro interno de que um membro pagou ao outro o que devia. Não
mexe no saldo das contas bancárias reais — só zera o saldo dentro da família.

---

## 1. Entidade

### AcertoContas
| Campo | Tipo | Notas |
|---|---|---|
| Id | Guid | PK |
| FamiliaId | Guid | FK Familia |
| DeUsuarioId | Guid | quem pagou (devedor) |
| ParaUsuarioId | Guid | quem recebeu (credor) |
| Valor | decimal | > 0 |
| Mes | int | período acertado (1–12) |
| Ano | int | período acertado |
| Observacao | string(400)? | comprovante/nota opcional (ex.: link do PIX) |
| CriadoPor | Guid | quem registrou |
| CriadoEm | DateTime | UTC |
| Ativo | bool | soft delete (cancelar acerto preserva histórico) |

Sem upload de arquivo nesta entrega — `Observacao` aceita texto/link. Comprovante
em arquivo fica para o Bloco D.

---

## 2. Efeito no balanço

O balanço mensal (`DespesaCompartilhadaService.ObterBalancoAsync`) passa a
considerar os acertos **ativos** do mês/ano:

- Para cada acerto: o devedor (`DeUsuarioId`) tem o saldo aumentado em `Valor`
  (pagou parte da dívida) e o credor (`ParaUsuarioId`) tem o saldo reduzido em
  `Valor` (recebeu).
- `Saldo = pagou − cota_devida + acertos_pagos − acertos_recebidos`.

Resultado: depois de registrar o acerto do valor devido, o saldo entre as duas
pessoas vai a zero.

---

## 3. Endpoints — `/api/v1/familias/{id}/acertos`

| Método | Rota | Descrição |
|---|---|---|
| POST | `/familias/{id}/acertos` | Registra um acerto |
| GET | `/familias/{id}/acertos?mes=&ano=` | Histórico de acertos (mês/ano opcional) |
| DELETE | `/familias/{id}/acertos/{acertoId}` | Cancela um acerto (soft delete) |

---

## 4. DTOs

- `RegistrarAcertoDto { Guid DeUsuarioId, Guid ParaUsuarioId, decimal Valor, int? Mes, int? Ano, string? Observacao }`
- `AcertoContasDto { Id, DeUsuarioId, DeNome, ParaUsuarioId, ParaNome, Valor, Mes, Ano, Observacao?, CriadoEm }`

---

## 5. Regras

- Só membros ativos da família registram/veem/cancelam acertos.
- `DeUsuarioId` e `ParaUsuarioId` devem ser membros ativos e **distintos**.
- `Valor` > 0.
- `Mes`/`Ano` default = mês/ano corrente quando omitidos.
- Cancelar acerto (`DELETE`) é soft delete — o histórico é preservado e o
  balanço volta a ignorá-lo.

---

## 6. Etapas de implementação

1. Entidade `AcertoContas` + `AppDbContext` + migration
2. DTOs + `AcertoService` (registrar, listar, cancelar) + integrar acertos no
   `ObterBalancoAsync`
3. Endpoints — `FamiliasController`
4. Frontend: seção "Acerto de contas" na `FamiliasPage` (registrar + histórico)
5. Testes de serviço
