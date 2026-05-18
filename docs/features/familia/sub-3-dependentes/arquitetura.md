---
feature: familia
sub-feature: sub-3-dependentes
issue: '#24'
status: CONCLUIDA
owner: Gustavo
created: 2026-05-17
---

# Sub-feature 3 — Dependentes

Spec técnica da Issue #24. Visão em `../visao.md` §6. Depende de #22 (Família).
Entrega: criar dependente, atribuir despesa a dependente, filtrar gastos por
dependente.

**Dependente** = entidade financeira **sem login** — registra gastos de uma
pessoa que não usa o app (filho pequeno, idoso sob cuidado, pet). Não confundir
com **Membro** (usuário com conta). Dependente é só um rótulo de atribuição.

---

## 1. Entidades

### Dependente
| Campo | Tipo | Notas |
|---|---|---|
| Id | Guid | PK |
| FamiliaId | Guid | FK Familia |
| Nome | string(120) | obrigatório |
| Apelido | string(60)? | opcional |
| DataNascimento | DateTime? | opcional — usada para idade |
| Tipo | int (enum) | Crianca=1, Idoso=2, Pet=3, Outro=4 |
| CriadoEm | DateTime | UTC |
| Ativo | bool | soft delete (preserva histórico) |

### Transacao (alteração)
Ganha `DependenteId` (Guid?, nullable) — despesa atribuída a um dependente.
Independente de `FamiliaId` (#23): uma despesa pode ser compartilhada **e**
atribuída a um dependente, ou só atribuída.

---

## 2. Enum

```csharp
public enum TipoDependente { Crianca = 1, Idoso = 2, Pet = 3, Outro = 4 }
```

---

## 3. Endpoints — `/api/v1/familias/{familiaId}/dependentes`

| Método | Rota | Descrição | Autorização |
|---|---|---|---|
| POST | `/familias/{id}/dependentes` | Cria dependente | membro |
| GET | `/familias/{id}/dependentes` | Lista dependentes ativos | membro |
| PUT | `/familias/{id}/dependentes/{depId}` | Edita | membro |
| DELETE | `/familias/{id}/dependentes/{depId}` | Inativa (soft delete) | membro |
| GET | `/familias/{id}/dependentes/{depId}/gastos?mes=&ano=` | Total gasto com o dependente no mês | membro |

Atribuir despesa a dependente:

| Método | Rota | Descrição |
|---|---|---|
| PUT | `/api/v1/transacoes/{id}/dependente` | Atribui (`{ dependenteId }`) ou desatribui (`{ dependenteId: null }`) |

---

## 4. DTOs

- `CriarDependenteDto { Nome, Apelido?, DataNascimento?, Tipo }`
- `DependenteDto { Id, FamiliaId, Nome, Apelido?, DataNascimento?, Tipo, Ativo }`
- `AtribuirDependenteDto { Guid? DependenteId }`
- `GastoDependenteDto { DependenteId, Nome, Mes, Ano, Total }`

---

## 5. Regras

- Só membros ativos da família criam/veem/editam dependentes da família.
- Dependente só recebe atribuição de transação `Tipo = Despesa`.
- A transação atribuída deve pertencer a um membro da mesma família do dependente.
- Inativar dependente preserva o histórico (transações atribuídas continuam).
- Promover dependente a membro (visão §6.4) está **fora** do escopo de #24.

---

## 6. Etapas de implementação

1. Entidade `Dependente` + enum + `Transacao.DependenteId` + `AppDbContext` + migration
2. DTOs + `DependenteService` (CRUD, atribuir despesa, gasto por dependente)
3. Endpoints — `DependentesController` (sob família) + `TransacoesController` (atribuir)
4. Frontend: CRUD de dependentes na `FamiliasPage`; atribuir na `TransactionTable`
5. Testes de serviço
