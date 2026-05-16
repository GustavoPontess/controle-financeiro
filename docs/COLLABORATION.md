---
owner: Gustavo + sócio
last_reviewed: 2026-05-15
next_review: 2026-08-15
status: CURRENT
---

# Colaboração em Dupla — Protocolo de Trabalho

Este projeto é desenvolvido por **dois devs em assíncrono**, ambos usando Claude como copiloto em máquinas separadas. Este documento define como evitamos atropelar o trabalho um do outro.

> **Leia este arquivo antes da sua primeira sessão no projeto.** Depois disso, ele só é consultado em casos de dúvida ou conflito.

---

## 1. Princípios

1. **GitHub é a fonte de verdade da coordenação operacional.** Quem está em qual Issue, qual é o estado de cada PR, quem revisou o quê — tudo vive no GitHub. Markdown na raiz (`ISSUES.md`, `PROGRESS.md`) reflete o roadmap arquitetural, não o estado momentâneo.
2. **Nenhum push direto em `main`.** Toda mudança passa por PR (mas o autor pode auto-aprovar e mergear — ver §6).
3. **Uma Issue por vez por pessoa.** Não picada de mosquito — terminar o que pegou antes de pegar outra.
4. **Comunicação no Issue/PR, não no chat.** Tudo decidido em conversa de Slack que afeta código fica registrado como comentário no Issue ou PR correspondente.
5. **Review é cortesia, não obrigação.** Auto-merge é permitido. Pedir review do outro é boa prática em PRs grandes ou de decisão arquitetural (ver §6.3).

---

## 2. Convenção crítica — numeração de Issues

**Existem DOIS números diferentes para cada Issue, e isso pode confundir:**

| Tipo | Onde aparece | Exemplo | Como usar |
|---|---|---|---|
| **Número do roadmap** | `ISSUES.md`, título da Issue, nome da branch, mensagens de commit | `#11`, `#22`, `#31` | É a referência **canônica**. Sempre fale "Issue #11" pensando neste número. |
| **Número do GitHub** | Coluna `ID` em `gh issue list`, URL `/issues/<N>` | `#1`, `#12`, `#21` | Só importa para automação (`gh issue edit <N>`). Sequencial conforme criação. |

**Regra de ouro:** ao se comunicar com humanos, sempre use o número do roadmap (`#11`). Para automação CLI, descubra o número do GitHub primeiro:

```bash
# Helper: encontra número do GitHub a partir do número do roadmap
function gh-issue-by-roadmap { gh issue list --search "#$args in:title" --state all --json number --jq ".[0].number" }

# Uso:
gh-issue-by-roadmap 11                          # retorna o número GitHub correspondente
gh issue edit (gh-issue-by-roadmap 11) --add-assignee @me
```

Versão PowerShell do helper está em `scripts/gh-helpers.ps1`.

A branch usa o **número do roadmap**, não o do GitHub: `feature/11-segredos-env-vars`.

---

## 3. Antes de começar uma sessão

### 3.1 Checklist obrigatório (sem exceção)

```bash
# 1. Atualizar main local
git checkout main
git pull --ff-only origin main

# 2. Olhar o que o outro está fazendo
gh issue list --assignee "@me" --state open    # o que está comigo
gh issue list --state open                      # o que está em aberto no projeto
gh pr list --state open                         # PRs em andamento que talvez eu precise revisar
```

### 3.2 Escolher uma Issue

- **Não pegue Issue que está assignada a outro.** Pra ele isso é sinal de "tô em cima dessa".
- **Não pegue Issue sem assignar-se.** Antes de criar a branch, vá no GitHub Issue e assigne-se. Isso fecha a porta pra disputa.
- **Respeite a ordem dos blocos** (A → B → C → D). Pular blocos cria dívida que volta a cobrar.
- **Conflitos previsíveis?** Se sua Issue toca arquivos que estão sendo tocados por um PR aberto do outro, **espere o PR fechar** ou negocie no chat antes de começar.

### 3.3 Criar a branch

```bash
# Padrão: feature/<numero>-<slug-kebab-case>
git checkout -b feature/11-segredos-env-vars
```

O número é o do GitHub Issue (que reflete o número em `ISSUES.md`).

---

## 4. Durante a sessão

### 4.1 Commits

Padrão semântico (mais detalhe em `GIT_WORKFLOW.md`):

```
<tipo>(<escopo>): <descrição>

[corpo opcional]

Refs #<numero-da-issue>
```

Exemplos:

```
feat(security): mover JWT secret para variável de ambiente

Adiciona leitura via Environment.GetEnvironmentVariable com fallback
de erro claro quando ausente. appsettings.json passa a ter placeholder.

Refs #11
```

```
fix(cors): remover AllowAnyOrigin que invalidava WithOrigins

Refs #12
```

### 4.2 Push frequente

Empurre sua branch pro remoto cedo e com frequência — não acumule 3 dias de trabalho local. Isso:

- Dá visibilidade pro outro do que você está fazendo
- Permite revisão em rascunho (Draft PR)
- Reduz risco de perda em problema de disco

```bash
git push -u origin feature/11-segredos-env-vars
```

### 4.3 Sincronizar com `main` durante a sessão

Se o outro mergeou algo durante seu trabalho:

```bash
# Rebase, NÃO merge (mantém histórico linear)
git fetch origin
git rebase origin/main

# Conflitos? Resolve, git rebase --continue. Sem merge commits.
```

**Não use `git pull` sem flag** — pode criar merge commit. Use `git pull --rebase` ou o passo acima.

---

## 5. Arquivos vivos compartilhados — protocolo específico

Esses três arquivos são tocados por **todo mundo, toda sessão**. São fonte de conflito previsível. Regras:

### 5.1 `IMPLEMENTATION_STATE.md` — **não merge pro main**

`IMPLEMENTATION_STATE.md` é o checkpoint **da sessão atual da sua branch**. Cada dev tem o seu na sua branch. Nunca deve aparecer no `main` com dados "ao vivo" — só o stub vazio.

Convenção: **ao abrir o PR, restaure `IMPLEMENTATION_STATE.md` para o stub neutro antes do merge**. O squash merge não vai trazer suas anotações locais pro `main`.

Alternativa (mais simples): adicione `IMPLEMENTATION_STATE.md` ao `.gitignore` e mantenha um `IMPLEMENTATION_STATE.template.md` versionado. Decidiremos depois se vale.

### 5.2 `PROGRESS.md` — atualize só no commit final

- Não atualize `PROGRESS.md` no meio da sessão. Só no commit final, depois do rebase em `main` atualizado.
- Entrada nova em "Histórico de sessões" sempre vai no topo da seção, com data e seu nome.
- **Conflito típico:** os dois adicionaram histórico no mesmo lugar. Resolução: manter as duas entradas em ordem cronológica. Não é briga.

### 5.3 `ISSUES.md` — só marca como concluída no PR de conclusão

- Não mexe em `ISSUES.md` no meio da implementação. A Issue do GitHub é o estado vivo.
- Quando a Issue ficar concluída de verdade (depois do merge), o PR de conclusão atualiza o `ISSUES.md` movendo a entrada para o histórico.
- **Conflito típico:** dois marcaram issues como concluídas em PRs separados. Resolução: manter as duas marcações.

---

## 6. Pull Request — protocolo

### 6.1 Quando abrir o PR

- Abra como **Draft** se quer feedback antecipado ou está parando no meio.
- Marque como **Ready for review** quando todos os checkboxes do template estão verdes.
- **Auto-assigne-se** como autor.

### 6.2 Template de PR

O template está em `.github/pull_request_template.md`. Aparece automaticamente ao abrir PR no GitHub.

### 6.3 Review — quando pedir, quando dispensar

Review do outro dev **não é obrigatório**. É cortesia em casos onde faz diferença e pula em casos triviais.

**Pedir review do outro (recomendado):**

- Mudança arquitetural (nova entidade, mudança em fluxo de domínio, escolha de biblioteca).
- Mexe em código que o outro escreveu recentemente e tem mais contexto.
- Você está inseguro sobre uma decisão e quer segunda opinião.
- Mudança grande (>200 linhas, vários arquivos correlacionados).
- Mudança em segurança, auth, isolamento de dados.

**Pode auto-mergear sem review:**

- Mudança pequena e isolada (ajuste de copy, fix de bug óbvio, atualização de doc).
- Trabalho seu de ponta a ponta numa Issue inteira que você dominou.
- Refactor cosmético sem mudança de comportamento.
- Atualização de dependência rotineira.

**Critério mental simples:** "Se eu errar isso, qual o tamanho do estrago?" Estrago pequeno e reversível = auto-merge. Estrago grande ou difícil de desfazer = pede olho extra.

**Tempo de resposta de review (se pedido):** **24h em dias úteis**. Se vai demorar mais, comente "vou demorar X" pra autor saber. Após 48h sem resposta, autor pode mergear sozinho documentando a tentativa de review no comentário do PR.

**O que olhar quando revisar:**

- Build verde (CI quando existir; manualmente até lá)
- Testes passam
- Código segue padrões de `docs/STANDARDS.md`
- Documentação tocada conforme `docs/GIT_WORKFLOW.md` checklist
- Não introduz dívida técnica nova sem registro

### 6.4 Approval e merge

- **Approval do outro é cortesia, não obrigação.** Sem barreira técnica — o branch protection não exige.
- **Quem abriu o PR faz o merge** (independente de quem aprovou, se aprovou alguém).
- **Squash merge é o default.** A branch inteira vira 1 commit no `main` com a mensagem do PR.
- **Branch é deletada após merge** (botão automático do GitHub).

### 6.5 Issues múltiplas fechadas pelo mesmo PR

Acontece: você está trabalhando na Issue #11 e percebe que o trabalho **já resolveu também** a Issue #12 (escopo se sobrepôs, ou uma é subproduto natural da outra). Nesses casos:

- **Não crie branch separada** para a Issue #12 só para "fechá-la formalmente". É burocracia.
- **No body do PR, liste TODAS as issues fechadas**, uma por linha:

  ```
  Closes #1
  Closes #2
  ```

- Ao mergear, o GitHub:
  - Fecha as duas issues automaticamente
  - Vincula o PR a cada uma (aparece no sidebar da Issue)
  - Preserva o link permanente no histórico

**Nunca feche uma Issue manualmente fora do PR.** Isso perde a rastreabilidade entre o Issue e o commit que a resolveu.

Se você só descobre que fechou outra issue **depois** do PR estar mergeado: faça um commit pequeno em `main` mencionando "Closes #N" (ou abra mini-PR de doc com `Closes`). Não basta comentar manualmente no Issue.

### 6.6 Discordância

Se vocês discordarem em PR e não chegarem a acordo:

1. Discutam nos comentários do PR (registro escrito).
2. **Atalho padrão:** quem abriu o PR tem voto de decisão na própria PR, **desde que** documente o porquê no comentário. O outro pode discordar depois com refactor proposto em PR novo.
3. Se preferir alinhar antes: marcar reunião rápida (15min).
4. **Não desfaz merge.** Se algo entrou e o outro discorda em retrospecto, abre PR novo de reversão/refactor com justificativa.

---

## 7. Conflitos previsíveis — guia de resolução

### 7.1 `PROGRESS.md` — dois adicionaram histórico

Aceite as duas entradas, mantenha ordem cronológica. Não conflito de mérito, é só ordenação.

### 7.2 `ISSUES.md` — dois marcaram issues como concluídas

Aceite as duas marcações. Cada um sua Issue.

### 7.3 Migrations EF Core — números/timestamps conflitantes

Migrations têm timestamp no nome. Cenário típico: ambos criaram migration localmente, primeiro mergeia. Segundo precisa:

```bash
# Apagar a migration local antes do rebase
dotnet ef migrations remove

# Rebase
git fetch && git rebase origin/main

# Recriar a migration (agora com timestamp posterior à última no main)
dotnet ef migrations add NomeDaSuaMigration
```

### 7.4 `appsettings.json` — secrets diferentes

Em teoria, secrets não devem entrar no git (ver Issue #11). Se ainda estiver no commit, rebase escolhe a versão mais recente e cada dev mantém seus secrets locais via env var.

### 7.5 `package-lock.json` / `package.json` — dependências diferentes

Quem mergeia depois:

```bash
git rebase origin/main
# Conflito em package-lock.json
npm install              # regenera baseado no package.json atual
git add package-lock.json package.json
git rebase --continue
```

### 7.6 Mudança contraditória no mesmo arquivo de código

Caso raro mas existe. Conversem por chat ou no PR. Quem cede precisa fazer rebase + reaplicar lógica em cima. Sem culpado — é vida em equipe.

---

## 8. CI / Branch Protection (futuro, ver Issue #19)

Quando Issue #19 (GitHub Actions) for resolvida, ativaremos no GitHub:

- **Branch protection no `main`:** Settings → Branches → Add rule
  - Require pull request before merging ✅
  - Require approvals: 1 ✅
  - Dismiss stale approvals when new commits are pushed ✅
  - Require status checks to pass: `ci-backend`, `ci-frontend` ✅
  - Require linear history ✅
- **Merge strategy:** Settings → General → "Allow squash merging" ✅ (desabilitar merge commit e rebase merge se quiser ser estrito)

Até lá, regras são por convenção entre nós — quem desrespeitar precisa reverter o commit.

---

## 9. Comunicação fora do código

- **Decisões técnicas:** sempre em PR ou Issue (registro escrito).
- **Coordenação rápida:** chat (Slack/WhatsApp/Discord), mas se afeta código, replicar a decisão em PR/Issue.
- **Sync semanal opcional:** 30min na sexta pra alinhar próxima semana. Não obrigatório.
- **Status de bloqueio:** se alguém está bloqueado por outro, comenta no Issue/PR + ping no chat.

---

## 10. Quando o Claude do sócio pegar essa sessão

Quando seu sócio (ou você na máquina dele) abrir o Claude:

1. Claude lê `PROMPT_NOVA_SESSAO.md` (idêntico em ambas as máquinas — está versionado).
2. Claude executa: `gh issue list --assignee "@me" --state open` para ver Issues abertas com ele.
3. Se nenhuma Issue assignada, pergunta o que pegar.
4. Se há Issue assignada, retoma — `IMPLEMENTATION_STATE.md` na branch dele tem o estado.

**O Claude de cada máquina não enxerga o outro — a comunicação acontece via git (commits, branches, PRs) e via GitHub (Issues, comentários).**

---

## 11. Como atualizar este documento

Se a gente perceber que uma regra não está funcionando, **discute em chat, atualiza este arquivo em PR**, ambos aprovam. Mudança de regra entra em vigor a partir do merge desse PR — não retroativo.
