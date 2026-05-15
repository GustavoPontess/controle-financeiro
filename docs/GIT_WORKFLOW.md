---
owner: Gustavo
last_reviewed: 2026-05-15
next_review: 2026-08-15
status: CURRENT
---

# Git Workflow

**Estratégia:** GitHub Flow + PR obrigatório + Squash Merge.

Para o protocolo de trabalho **em dupla** (quem pega qual Issue, conflitos previsíveis, code review), ver `COLLABORATION.md`. Este arquivo cobre apenas as regras de git em si.

---

## Branches

### Naming pattern

```
feature/<numero-issue>-<slug-kebab-case>
```

Sempre derivada de `main` atualizada. O número é o do GitHub Issue, que reflete o número em `ISSUES.md`.

**Bons exemplos:**

```
feature/11-segredos-env-vars
feature/12-cors-correto
feature/22-familia-membros-modelagem
```

**Errado:**

```
feature/segredos               (sem número)
feature/11_segredos_env_vars   (underscore, não kebab)
my-branch                      (sem prefixo)
fix/11-segredos                (use feature/ para tudo, não fix/)
```

### Branch protection no `main`

Configurar no GitHub (Settings → Branches → Add rule para `main`):

- ✅ Require pull request before merging
- ✅ Require approvals: 1
- ✅ Dismiss stale approvals when new commits are pushed
- ✅ Require linear history
- ✅ Require status checks to pass (depois que Issue #19 entregar o CI)

Até habilitar formalmente, regra é por convenção: **ninguém commita direto em `main`**.

---

## Commits

### Mensagem semântica

```
<tipo>(<escopo>): <descrição curta>

<corpo opcional, em prosa ou bullets>

Refs #<numero-issue>
```

### Tipos válidos

| Tipo | Quando usar |
|---|---|
| `feat` | Funcionalidade nova ou melhoria de comportamento |
| `fix` | Correção de bug |
| `docs` | Mudança só em documentação |
| `refactor` | Reescrita sem mudança de comportamento |
| `test` | Adicionar/ajustar testes |
| `chore` | Build, deps, configuração, infra de repo |
| `perf` | Melhoria de performance |
| `style` | Formatação (sem mudança de lógica) |

### Bons exemplos

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

```
docs: atualiza COLLABORATION.md com regra de rebase
```

### Errado

```
mudanças                           (genérico)
WIP                                (não permitido em main)
fix fix fix                        (sem descrição)
GRANDE MUDANÇA AQUI               (sem tipo)
ajustes finais                    (vazio de sentido)
```

### Tamanho do commit

- **Commits pequenos** e frequentes durante o trabalho. Cada commit deve ser uma unidade lógica.
- **Não vale "commit gigante"** com tudo da Issue. Se quebrar em 5-10 commits faz sentido conceitual, quebre.
- No final, o squash merge unifica tudo em 1 commit no `main` — então o ônus do histórico bonito está no PR title/description, não em cada commit da branch.

---

## Workflow ponta a ponta

### 1. Começar uma Issue

```bash
git checkout main
git pull --ff-only origin main

# Antes de criar a branch, assigne-se no GitHub Issue
gh issue edit <numero> --add-assignee @me

# Cria a branch
git checkout -b feature/<numero>-<slug>
```

### 2. Trabalhar

```bash
# Commits frequentes
git add <arquivos-específicos>
git commit -m "feat(escopo): descrição"

# Push cedo (mesmo se for Draft PR)
git push -u origin feature/<numero>-<slug>
```

### 3. Sincronizar com `main` se o outro mergeou algo

```bash
git fetch origin
git rebase origin/main

# Se conflito, resolve, depois:
git add <arquivos-resolvidos>
git rebase --continue

# Force-push só se necessário, e SEMPRE com --force-with-lease (nunca --force)
git push --force-with-lease
```

### 4. Abrir PR

```bash
# Opcional: via CLI
gh pr create --fill --base main --head feature/<numero>-<slug>

# Ou pela interface do GitHub. O template aparece automaticamente.
```

### 5. Pedir review

- PR fica **Draft** enquanto trabalhando.
- Quando todos os checks do template estão verdes, marca **Ready for review**.
- Adiciona o sócio como reviewer (`gh pr edit --add-reviewer <user>` ou pela UI).

### 6. Após approval, fazer o merge

- **Quem abriu o PR faz o merge** (não o reviewer).
- **Estratégia: Squash and merge** (botão padrão no GitHub se configurado).
- **Mensagem do squash:** o GitHub usa o título do PR. Ajuste antes do merge se necessário.
- **Deletar a branch** após merge (botão automático).

```bash
# Após merge, na máquina local:
git checkout main
git pull --ff-only origin main
git branch -d feature/<numero>-<slug>
```

### 7. Atualizar arquivos vivos

Após merge, abrir uma **branch curta para atualizar `PROGRESS.md` e `ISSUES.md`** marcando a Issue como concluída. Esse update pode entrar via PR pequeno ou — se o time concordou — direto em `main` (acordo a tomar).

---

## Checklist antes de marcar PR como Ready for review

```
Código:
  [ ] dotnet build sem warnings
  [ ] dotnet test passando
  [ ] npm run build sem erros (se mexeu no frontend)
  [ ] npm run lint sem erros (se mexeu no frontend)

Documentação:
  [ ] docs/DATABASE.md atualizado (se schema mudou)
  [ ] docs/FLOWS.md atualizado (se fluxo mudou)
  [ ] docs/STANDARDS.md atualizado (se padrão novo)
  [ ] docs/QUICK_REFERENCE.md atualizado (se algo essencial mudou)
  [ ] docs/features/<feature>/ atualizado (se mexeu em feature)
  [ ] Swagger atualizado (comentários XML em endpoints novos)

Commits:
  [ ] Mensagens semânticas (feat/fix/docs/...)
  [ ] Sem "WIP" ou commits temporários
  [ ] Refs para a Issue presentes

Testes:
  [ ] Cobertura para o que mudou
  [ ] Nenhum teste antigo quebrado
```

---

## Regras inegociáveis

1. **Nunca commitar em `main` direto** (mesmo antes do branch protection estar configurado).
2. **Nunca `git push --force` no `main`.** Em branch própria, só `--force-with-lease`.
3. **Nunca merge commit em PR.** Squash sempre. Histórico linear.
4. **Nunca dois devs na mesma branch ao mesmo tempo.** Branch é território de um dev por vez.
5. **Nunca abrir PR sem assignee.** O autor é sempre assignee.
6. **Nunca aprovar o próprio PR.** O outro revisa.
7. **Nunca deixar branch antiga (já mergeada) viva no remoto.** Deletar após merge.

---

## Aliases úteis (opcional)

Adicione ao seu `~/.gitconfig`:

```ini
[alias]
    # Atualiza main
    sync = "!git checkout main && git pull --ff-only origin main"

    # Cria branch a partir de main atualizada
    nb = "!f() { git sync && git checkout -b \"$1\"; }; f"

    # Rebase em main
    rb = "!git fetch origin && git rebase origin/main"

    # Status enxuto
    s = status -sb

    # Log bonito
    lg = "log --oneline --graph --all --decorate -20"

    # Push seguro
    pf = push --force-with-lease
```

Uso:

```bash
git sync                            # atualiza main
git nb feature/11-segredos          # cria branch
git rb                              # rebase em main
git s                               # status
git lg                              # log gráfico
git pf                              # force-push seguro
```

---

## Resolução de conflitos

Para conflitos em arquivos compartilhados específicos (`PROGRESS.md`, migrations, `package-lock.json`), ver `COLLABORATION.md` seção 7.

Princípio geral: **rebase, não merge.** Resolva conflito linha a linha, teste o resultado, depois `--continue`.
