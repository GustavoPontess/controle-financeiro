# Quem pode o quê

Tabela única de permissões do Pontes (pedido do Gustavo, 2026-10-19, antes do cartão compartilhado). **A regra mora
no código em dois lugares só, e em nenhum outro:**

- **Família** (papel de cada um): `ControleFinanceiro.Api/Services/FamiliaPermissoes.cs`
- **Recurso da pessoa** (conta, cartão, categoria, subcategoria é seu?): `ControleFinanceiro.Api/Services/DonoRecursos.cs`

Service nenhum reescreve "é membro?", "lança?" ou "é só vê?" na mão. A trava `PermissoesCentralizadasTests` lê o
código e falha se alguém fizer isso; `QuemPodeOQueTests` confere esta tabela linha a linha. Mudou uma regra: muda
aqui, no `FamiliaPermissoes` e no teste, juntos.

## Os perfis

Na tela (desde 2026-10-19, `docs/features/familia/membros-e-permissoes.md`): Admin aparece como **Responsável**,
Membro como **Adulto**, Dependente como **Só vê**. No código os nomes seguem os do enum `PapelFamilia`.

| Perfil | Quem é | No código |
|---|---|---|
| **Dono** | quem cadastrou a conta, o cartão, a categoria, o lançamento | `DonoRecursos`, `CriadoPor` / `UsuarioIdProprietario` |
| **Admin** | membro ativo com papel Admin (quem criou a família, ou promovido) | `ExigirAdminAsync` |
| **Membro** | membro ativo com papel Membro (o padrão) | `ExigirLancarAsync`, `LancaNaFamiliaAsync`, `QuemLanca` |
| **Só vê** | membro ativo com papel Dependente (ex.: filho com login) | `EhMembroAsync`, `ExigirMembroAsync` |
| **Saiu** | foi membro e saiu (ou excluiu a conta: "Membro que saiu") | não é membro: nada além do histórico |
| **De fora** | qualquer outra pessoa | 404 (não revela que existe) |

"**Lança**" = Admin ou Membro ativo. É quem divide, entra na divisão e no peso pela renda, passa/recebe dinheiro
entre vocês e marca algo da casa.

## Família

| Ação | Admin | Membro | Só vê | Saiu / De fora |
|---|:-:|:-:|:-:|:-:|
| Ver a família, as despesas divididas, o equilíbrio, Entre vocês, Contas fixas da casa | ✅ | ✅ | ✅ | ❌ 404 |
| Ver a parte de cada um numa despesa dividida | ✅ | ✅ | ✅ | ❌ (quem lançou sempre vê) |
| Ver a renda dos outros (só o que cada um liberou pra você) | ✅ | ✅ | ❌ (só a própria) | ❌ |
| Mudar quem vê a SUA renda | a própria | a própria | a própria | ❌ |
| Dividir uma despesa SUA com a família / parar de dividir | ✅ | ✅ | ❌ 403 | ❌ |
| Mudar o jeito de dividir de uma despesa SUA (Igual, Pela renda, Do meu jeito) | ✅ | ✅ | ❌ | ❌ |
| Ter parte numa despesa (inclusive no "Do meu jeito") | ✅ | ✅ | ❌ fica fora | só no que já estava |
| Aprovar ou recusar despesa acima do limite (de outra pessoa) | ✅ | ✅ | ❌ | ❌ |
| Escolher quem cuida da conta / pra quem foi (dependente) | ✅ | ✅ | ❌ | ❌ |
| Registrar dinheiro entre vocês (sendo quem passou ou quem recebeu) | ✅ | ✅ | ❌ | ❌ |
| Ser parte do dinheiro entre vocês | ✅ | ✅ | ❌ | só no que já estava |
| Confirmar que recebeu / "Não recebi" | quem recebeu | quem recebeu | ❌ | ❌ |
| Lançar o SEU lado do dinheiro entre vocês numa conta SUA | ✅ | ✅ | ❌ | ❌ |
| Desfazer dinheiro entre vocês | as duas partes | as duas partes | ❌ | ❌ |
| Marcar conta / cartão / conta fixa SUA como da casa | ✅ | ✅ | ❌ | ❌ |
| Adicionar / editar dependente | ✅ | ✅ | ❌ | ❌ |
| Mudar a regra de divisão da família, o limite de aprovação | ✅ | ❌ 403 | ❌ | ❌ |
| Convidar, mudar papel, remover membro (nunca o criador) | ✅ | ❌ | ❌ | ❌ |
| Sair da família | ✅ | ✅ | ✅ | — |
| Dissolver a família | criador | ❌ | ❌ | ❌ |
| Ver a foto de perfil de alguém | só de quem divide família ativa com você (`DividemFamiliaAsync`) | | | ❌ 404 |

## Recursos da pessoa

| Ação | Dono | Outro membro da família | De fora |
|---|:-:|:-:|:-:|
| Ver / editar / excluir conta, cartão, categoria própria, lançamento | ✅ | ❌ 404 | ❌ 404 |
| Lançar numa conta ou cartão | ✅ | ❌ (futuro: cartão compartilhado, ver abaixo) | ❌ |
| Ver a despesa dividida que o outro pagou | — | ✅ só os números da família (valor, data, categoria, partes) | ❌ |
| Editar / excluir a despesa dividida | quem lançou | ❌ | ❌ |

**Cartão compartilhado (ideia, `docs/features/familia/espaco-da-familia.md` §4.7):** quando vier, entra como UMA
pergunta nova no `DonoRecursos` ("pode usar esse cartão?" = dono OU tem acesso dado pelo dono), com linha nova nesta
tabela e no teste. Nada mais muda.
