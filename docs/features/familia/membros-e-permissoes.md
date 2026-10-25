# Membros e permissões da família (perfis + ajustes, adolescente)

> Spec. Pedido do Gustavo (2026-10-19): "tomar muito cuidado com a tela de permissões"; separar **Membros** de
> **Permissões**; o convidar e o adicionar à vista; e a ideia de dar **liberdade aos poucos pro adolescente** lidar com
> dinheiro (mesada, cartão com limite, registrar no app como aula de controle financeiro). Modelo aprovado em
> 2026-10-19 ("pode fazer"). Regra de código já vigente: quem pode o quê mora SÓ em `FamiliaPermissoes` +
> `DonoRecursos`, tabela em `docs/PERMISSOES.md`, trava `PermissoesCentralizadasTests`.

## 1. Por que mudar

Hoje é uma escada de três degraus (Admin, Membro, Só vê). O adolescente não cabe em nenhum: ele lança o próprio
dinheiro, mas não divide as contas da casa, não vê a renda dos adultos, e os pais acompanham o espaço dele. É outro
eixo. E a tela antiga misturava pessoas e permissões num dropdown por linha, sem convidar/adicionar à vista.

Referências: apps de dinheiro pra jovem (Greenlight, GoHenry, Mozper, Z1: o responsável define autonomia em poucos
controles e vê tudo; o jovem usa a conta dele); permissões em SaaS (poucos papéis com descrição curta, matriz legível,
proteção do último admin); 1Password Families e Google Drive (acesso por coisa compartilhada).

## 2. O modelo: perfil + ajustes

**Perfil** é o ponto de partida; **ajustes** são o que o responsável pode mexer por pessoa sem trocar o perfil.

| Ajuste (pergunta no `FamiliaPermissoes`) | Responsável | Adulto | Adolescente | Só vê |
|---|:-:|:-:|:-:|:-:|
| **Divide as contas da casa** (entra na divisão, no peso, no dinheiro entre vocês) | ✅ | ✅ | ❌ | ❌ |
| **Aprova despesas** acima do limite da casa | ✅ | ✅ | ❌ | ❌ |
| **Vê a renda** que os outros liberarem | ✅ | ✅ | ❌ | ❌ |
| **Administra** (regras, convites, membros) | ✅ | ❌ | ❌ | ❌ |
| **É acompanhado** (responsáveis veem o espaço pessoal, só leitura) | ❌ | ❌ | ✅ | ❌ |

- Perfis: **Responsável** (= Admin de hoje), **Adulto** (= Membro), **Adolescente** (novo), **Só vê** (= Dependente).
- Ajuste fora do padrão do perfil fica marcado na pessoa ("divide as contas da casa: ligado por você"). Ex.: o Theo aos
  17 ganha "divide as contas da casa" sem deixar de ser adolescente.
- Travas que não mudam: quem criou a casa é sempre Responsável; a casa nunca fica sem Responsável (último não sai nem
  perde o perfil); ninguém muda o próprio perfil; "Administra" só pra quem tem 18+.
- Cada ajuste é UMA pergunta nomeada no `FamiliaPermissoes` + uma linha no `docs/PERMISSOES.md` + teste. Nunca matriz
  de caixinhas livres.

## 3. As telas (separadas)

**Membros** (`/familias/:id/membros`): quem é da casa.
- Topo: **Convidar** (adulto ou adolescente) e **Adicionar alguém sem conta** (Theo, Bolt), à vista.
- Lista: uma linha por pessoa (foto, nome, relação, perfil, situação: ativo, convite pendente, sem conta, saiu).
- Linha do dependente sem conta: **Dar uma conta** (vira convite de adolescente; o histórico de gastos continua ligado).
- Clicar abre a **página da pessoa** (`/familias/:id/membros/:pessoa`), não um dropdown.

**Página da pessoa**: perfil (botões), os ajustes em frases (com o que veio do perfil e o que foi mudado), quem
acompanha, relação, "na casa desde". Na SUA página: o que você mostra pros outros (renda). Remover / Sair ficam aqui,
com confirmação.

**Permissões** (`/familias/:id/permissoes`): o que cada perfil pode nesta casa (a tabela da §2 legível) + os padrões
da casa que o Responsável muda: limite de aprovação; o que "adolescente" pode por padrão. Regras (divisão, dissolver)
segue como está.

## 4. O adolescente, por fases

1. **Perfil + acompanhamento**: responsáveis designados veem o espaço pessoal (lançamentos, limites, metas), só
   leitura; o adolescente vê que é acompanhado. Aos 18 (data de nascimento) o acompanhamento acaba e vira Adulto, com
   aviso antes.
2. **Mesada**: dinheiro entre vocês que se repete (passo 3 + conta fixa), fora do resultado da casa; no espaço dele a
   mesada é a renda esperada (Limites, Metas e Respostas já funcionam). Pais veem "usou 80% da mesada".
3. **Cartão com limite**: o cartão compartilhado (espaco-da-familia.md §4.7) com limite por pessoa e aprovação acima
   de X; a compra cai na fatura do dono marcada "Usado por Theo".

## 5. Conformidade (bloqueia a fase do adolescente)

- **LGPD Art. 14:** dado de criança exige consentimento específico e em destaque de um responsável; adolescente segue
  o melhor interesse (ANPD, Enunciado CD/ANPD nº 1/2023).
- **ECA Digital (Lei 15.211/2025, em vigor desde 17/03/2026):** conta de menor de 16 vinculada a responsável legal,
  ferramentas de supervisão parental, configurações mais protetivas por padrão, sem perfilamento pra publicidade,
  verificação de idade sem autodeclaração simples (art. 12 mira lojas e sistemas; conferir o alcance pra apps).
  Multas até R$ 50 mi.
- **Antes de codar a fase 1 do adolescente:** pesquisa de conformidade aprofundada (incógnita grande e nova: pedir OK
  pelo custo), Política de Privacidade com seção de menores, aceite do responsável registrado.
- Quem vê o espaço do adolescente: só os responsáveis designados, só leitura; nunca "só vê" nem outros adultos.

## 6. Ordem

1. ✅ Esta spec.
2. ✅ **Membros + página da pessoa** (2026-10-19; só reorganiza com os papéis de hoje: convidar e adicionar à vista, página da pessoa
   com perfil e o que pode, renda; sem mudar o modelo). Também a página de quem não tem conta
   (`/familias/:id/dependentes/:depId`). "Dar uma conta" fica pro passo 4.
3. **Perfis + ajustes** (back: ajustes por membro, perguntas novas no `FamiliaPermissoes`, migration) + **Permissões**.
4. **Adolescente fase 1** (depois da pesquisa de conformidade).
5. Mesada, depois cartão com limite.
