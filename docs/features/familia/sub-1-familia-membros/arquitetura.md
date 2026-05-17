---
feature: familia
sub-feature: sub-1-familia-membros
issue: '#22'
status: EM_IMPLEMENTACAO
owner: Gustavo
created: 2026-05-16
---

# Sub-feature 1 — Família e Membros (sem rateio)

Spec técnica da Issue #22. Visão de produto em `../visao.md`. Esta sub-feature
entrega: criar família, convidar membros (dois caminhos), aceitar/recusar
convite, papéis editáveis, listar membros, sair da família. **Sem rateio,
sem despesa compartilhada, sem dependentes** — essas são sub-features 2-4.

---

## 1. Entidades

### Familia
| Campo | Tipo | Notas |
|---|---|---|
| Id | Guid | PK |
| Nome | string(120) | obrigatório |
| CriadoPorUsuarioId | Guid | FK Usuario — admin original |
| CriadoEm | DateTime | UTC |
| Ativa | bool | soft delete (dissolução de família) |

### MembroFamilia
| Campo | Tipo | Notas |
|---|---|---|
| Id | Guid | PK |
| FamiliaId | Guid | FK Familia |
| UsuarioId | Guid | FK Usuario |
| Papel | string(60) | rótulo editável (texto livre; presets na UI) |
| EntrouEm | DateTime | UTC |
| Ativo | bool | soft delete (saída de membro) |

- Índice único `(FamiliaId, UsuarioId)` entre registros ativos — usuário não
  entra duas vezes na mesma família.

### ConviteFamilia
| Campo | Tipo | Notas |
|---|---|---|
| Id | Guid | PK |
| FamiliaId | Guid | FK Familia |
| EmailConvidado | string(256) | normalizado lowercase |
| Papel | string(60) | papel proposto |
| Token | string(64) | único — base64url de 32 bytes aleatórios |
| Status | int (enum) | Pendente=1, Aceito=2, Recusado=3, Revogado=4, Expirado=5 |
| ExpiraEm | DateTime | UTC — 7 dias após criação |
| CriadoEm | DateTime | UTC |
| CriadoPorUsuarioId | Guid | FK Usuario |

- Não pode haver dois convites `Pendente` para o mesmo `(FamiliaId, EmailConvidado)`.
- Limite de convites pendentes por família (anti-spam): **20**.

---

## 2. Enum

```csharp
public enum StatusConvite
{
    Pendente = 1,
    Aceito   = 2,
    Recusado = 3,
    Revogado = 4,
    Expirado = 5,
}
```

---

## 3. Endpoints — `/api/v1/familias`

| Método | Rota | Descrição | Autorização |
|---|---|---|---|
| POST | `/familias` | Cria família; criador vira membro `Administrador` | autenticado |
| GET | `/familias` | Lista famílias do usuário logado | autenticado |
| GET | `/familias/{id}` | Detalhe da família + membros + convites pendentes | membro |
| DELETE | `/familias/{id}` | Dissolve a família (soft delete) | admin |
| POST | `/familias/{id}/convites` | Cria convite | admin |
| DELETE | `/familias/{id}/convites/{conviteId}` | Revoga convite pendente | admin |
| PUT | `/familias/{id}/membros/{membroId}/papel` | Edita papel | admin, ou o próprio membro no próprio papel |
| DELETE | `/familias/{id}/membros/{membroId}` | Remove membro / sair da família | admin (qualquer), membro (a si mesmo) |

Endpoints de convite na perspectiva do convidado — `/api/v1/convites`:

| Método | Rota | Descrição | Autorização |
|---|---|---|---|
| GET | `/convites/pendentes` | Convites pendentes para o e-mail do usuário logado | autenticado |
| POST | `/convites/{token}/aceitar` | Aceita; cria `MembroFamilia` | autenticado, e-mail do convite == e-mail do usuário |
| POST | `/convites/{token}/recusar` | Recusa o convite | autenticado, idem |

> Convite para quem **não tem conta**: o link `/convites/{token}` leva ao fluxo
> de cadastro no frontend; após registrar, o usuário cai em `GET /convites/pendentes`
> e aceita normalmente. O backend não cria conta — registro é responsabilidade
> do fluxo de auth existente.

---

## 4. Regras de negócio

- **Criar família:** transação cria `Familia` + `MembroFamilia` do criador com
  `Papel = "Administrador"`.
- **Admin:** o `MembroFamilia` cujo `UsuarioId == Familia.CriadoPorUsuarioId`.
  MVP não transfere administração (caso extremo — visão §10).
- **Convidar:** valida limite de pendentes, valida que o e-mail não é de membro
  ativo, gera token, `ExpiraEm = UtcNow + 7d`.
- **Aceitar:** valida status `Pendente` e não expirado; cria `MembroFamilia`;
  marca convite `Aceito`. Se expirado, marca `Expirado` e retorna 409.
- **Sair / remover:** `MembroFamilia.Ativo = false`. Admin não pode sair sem
  dissolver (MVP) — retorna 409 com orientação.
- **Editar papel:** texto livre; admin edita qualquer um, membro edita o próprio.
- **Multi-tenancy:** toda query filtra por participação do usuário na família.
  Não-membro recebe 404 em `GET /familias/{id}`.

---

## 5. Fora do escopo de #22

Despesa compartilhada (#23), dependentes (#24), rateio (#25), acerto de contas
(#26), múltiplas famílias com seletor de contexto (sub-feature 6). A entidade
`Familia` já suporta múltiplas por usuário no schema; o seletor de UI vem depois.

---

## 6. Etapas de implementação

1. Entidades + enum + `AppDbContext` (DbSets, índices, delete behavior) + migration
2. DTOs + `FamiliaService` + `ConviteService`
3. `FamiliasController` + `ConvitesController`
4. Frontend: serviço, páginas (lista, detalhe, criar, convidar, aceitar)
5. Testes de serviço
