# Feature 2.3 — Papéis + permissões da família

> Spec (spec-driven, CLAUDE.md §Processo). Lote 2 / fosso família. **Refactor de
> autorização** — mexer em quem-pode-o-quê num app de dinheiro → spec antes de codar.
> Status: **aprovada — em implementação** (full: 3 papéis + as 4 mudanças de comportamento).
> Origem: auditoria família.

## Problema (estado atual)

- A autorização da família é **só "é o criador?"**: `familia.CriadoPorUsuarioId == usuarioId`
  (`FamiliaService.ExigirAdmin`). Não há papéis reais.
- `MembroFamilia.Papel` hoje é **rótulo livre de texto** ("Eu", "Cônjuge", "Filho",
  "Administrador") — vindo do convite. É **display de relação**, não permissão. Inconsistente:
  o criador vira `"Administrador"`, convidados viram `"Filho"`/`"Cônjuge"`.
- Consequências: não dá pra ter **mais de um admin**; não dá pra ter membro **só-leitura**
  (ex.: filho adolescente que vê mas não mexe); o front já tem buracos por causa disso
  (o picker de remover membro mostrava-se pra não-admins — corrigido na 2.1).

## Proposta

Separar **permissão** (enum, fonte da verdade pra authz) do **rótulo de relação** (texto livre).

### Enum `PapelFamilia`
| valor | quem é | pode |
|---|---|---|
| `Admin = 1` | dono(s) da família | tudo (gestão + tudo de Membro) |
| `Membro = 2` | adulto participante (default) | lança/compartilha, rateia, acerta, aprova; **não** gerencia membros/config |
| `Dependente = 3` | acesso restrito (ex.: filho com login) | **só leitura** (vê família/feed/balanço); não age |

> O texto livre `MembroFamilia.Papel` **continua existindo** como rótulo de relação
> ("Cônjuge", "Filho") só pra display. A permissão passa a ser `PapelPermissao` (enum).

### Modelo de dados
- **`MembroFamilia.PapelPermissao`** (`PapelFamilia`, default `Membro`).
- **`ConviteFamilia.PapelPermissao`** (`PapelFamilia`, default `Membro`) — o admin escolhe se
  convida como Membro ou Dependente. **Não** se convida direto como Admin (promove depois).
- Migration `AddPapelPermissao` — **backfill**: o **criador** de cada família → `Admin`; todos os
  demais membros/convites → `Membro`. (Sem mudar o texto `Papel`.)

### Regra do dono
- O **criador** (`CriadoPorUsuarioId`) é sempre `Admin` e **não pode** ser rebaixado, removido,
  nem sair (já existe: "admin não sai, dissolve"). Garante que a família sempre tem dono.
- Pode haver **vários Admins** (um admin promove outro membro a Admin).

## Matriz de permissões (v1)

| Ação | Admin | Membro | Dependente |
|---|:--:|:--:|:--:|
| Ver família / feed / balanço / dependentes | ✓ | ✓ | ✓ |
| Convidar / revogar convite | ✓ | ✗ | ✗ |
| Remover **outro** membro | ✓ | ✗ | ✗ |
| Sair da família (remover a si) | ✓¹ | ✓ | ✓ |
| Editar **permissão** de um membro (promover/rebaixar) | ✓ | ✗ | ✗ |
| Dissolver a família | ✓² | ✗ | ✗ |
| Definir limite de aprovação | ✓ | ✗ | ✗ |
| Definir **modo de rateio padrão** da família | ✓ | ✗ | ✗ |
| Definir **renda** de um membro | ✓ (qualquer) | ✓ (só a própria) | ✗ |
| Compartilhar / descompartilhar despesa | ✓ | ✓ | ✗ |
| Atribuir responsável | ✓ | ✓ | ✗ |
| Registrar acerto · Cancelar acerto | ✓ | ✓ (cancelar: criador/parte) | ✗ |
| Aprovar / rejeitar despesa | ✓ (≠ criador da despesa) | ✓ (≠ criador) | ✗ |
| Gerenciar dependentes (entidade filho/pet) | ✓ | ✓ | ✗ |
| Editar o **rótulo** `Papel` (relação) de si mesmo | ✓ | ✓ | ✓ |

¹ Admin sai normalmente, **exceto o criador** (que dissolve). ² Só o criador dissolve (mantém regra atual).

## Mudanças de comportamento (≠ hoje) — decisões a confirmar

1. **`DefinirModoRateioPadrao` vira Admin-only** (hoje qualquer membro). _Racional: é config
   da família inteira._ ⚠️ mudança de authz.
2. **`DefinirRenda`**: membro só edita a **própria**; admin edita qualquer (hoje qualquer membro
   edita qualquer um). ⚠️ aperta.
3. **Dependente é só-leitura** em v1 (não compartilha despesa própria). _Pode afrouxar depois._
4. `ehAdmin` nos DTOs deixa de ser "é o criador" e passa a ser `PapelPermissao == Admin`.
   `MembroFamiliaDto`/`FamiliaDto`/`FamiliaDetalheDto` ganham `papelPermissao`.

## API (mudanças)
- `PUT /familias/{id}/membros/{membroId}/permissao` (novo) — admin promove/rebaixa
  (`{ papelPermissao }`). Não pode rebaixar/alterar o criador.
- `EditarPapel` atual (rótulo de relação) **continua** (qualquer membro edita o próprio rótulo).
- `CriarConviteDto` ganha `papelPermissao` (Membro|Dependente).
- `ExigirAdmin(familia, usuarioId)` (creator check) → `ExigirPapelAsync(familiaId, usuarioId,
  Admin)` (consulta `MembroFamilia.PapelPermissao`). Helper central reusado por todos os services.

## Frontend (fase 2)
- Badge de permissão por membro (Admin/Membro/Dependente) no detalhe.
- Convite: escolher Membro ou Dependente.
- Ação "tornar admin" / "rebaixar" pra admin (menu do membro), oculta pro criador.
- Gates de UI por papel (botões de gestão só pra admin; dependente em modo leitura).
- O picker de remover/atribuir já respeita `ehAdmin` (2.1) — passa a ler o novo `papelPermissao`.

## Fora de escopo (v1)
- Permissões granulares custom (além dos 3 papéis).
- Transferência de propriedade da família (trocar o criador/dono).
- Limites de gasto por dependente (poderia vir junto de afrouxar o Dependente).

## Plano de implementação (faseado)
1. **Backend** — enum + campos + migration/backfill + `ExigirPapelAsync` central + reaplicar
   authz em FamiliaService/ConviteService/DespesaCompartilhada/Rateio/Acerto/Dependente +
   DTOs + endpoint de permissão + testes (happy/403 por papel). 1 PR.
2. **Frontend** — badges, convite com papel, promover/rebaixar, gates de UI + testes. 1 PR.

## Testes (backend, por papel)
- `ExigirPapelAsync`: admin passa; membro/dependente → 403; não-membro → 404.
- Cada ação admin-only: membro → 403, admin → ok.
- Criador não pode ser rebaixado/removido (mesmo por outro admin).
- Promover membro→admin: passa a poder gerenciar. Rebaixar admin→membro.
- Backfill da migration: criador vira Admin, resto Membro (teste de smoke).
- Dependente: ações de escrita → 403; leitura → ok.
