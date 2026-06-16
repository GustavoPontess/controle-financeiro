---
owner: Gustavo
last_reviewed: 2026-05-15
next_review: 2026-08-15
status: CURRENT
---

# Git Workflow

**Estratégia:** GitHub Flow + PR (quando trabalhando com remoto) + Squash Merge.

**Projeto solo** — sem coordenação de dupla nem review de terceiros. Este arquivo cobre as regras de git em si.

---

## Branches

### Naming pattern

```
feature/<numero-issue>-<slug-kebab-case>
```

Sempre derivada de `main` atualizada. Se houver issue no GitHub, use o número; senão, só o slug (`feature/<slug-kebab>`).

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

### Branch protection no `main` (via Rulesets)

Configurar no GitHub (Settings → Rules → Rulesets → New ruleset):

- ✅ Require a pull request before merging (**sem** required approvals — autor pode auto-mergear)
- ✅ Dismiss stale pull request approvals when new commits are pushed
- ✅ Require conversation resolution before merging
- ✅ Require linear history
- ✅ Block force pushes
- ✅ Restrict deletions
- ✅ Allowed merge methods: **Squash only**
- ✅ Require status checks to pass (CI: build + lint + test)

Regra por convenção: **não commitar direto em `main`** — sempre via branch + PR.

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
docs: atualiza GIT_WORKFLOW.md com regra de rebase
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

# (opcional) se rastreia no GitHub, assigne-se
gh issue edit <numero> --add-assignee @me

# Cria a branch
git checkout -b feature/<slug>          # ou feature/<numero>-<slug> se tiver issue
```

### 2. Trabalhar

```bash
# Commits frequentes
git add <arquivos-específicos>
git commit -m "feat(escopo): descrição"

# Push cedo (mesmo se for Draft PR)
git push -u origin feature/<numero>-<slug>
```

### 3. Sincronizar com `main` (se o remoto avançou)

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

### 5. Checar CI

- PR fica **Draft** enquanto trabalhando.
- Quando todos os checks do template estão verdes (build + lint + test), marca **Ready** e mergeia.

### 6. Merge

- **Estratégia: Squash and merge.**
- **Mensagem do squash:** o GitHub usa o título do PR. Ajuste antes do merge se necessário.
- **Deletar a branch** após merge (botão automático).

```bash
# Após merge, na máquina local:
git checkout main
git pull --ff-only origin main
git branch -d feature/<slug>
```

### 7. Atualizar arquivos vivos

Após merge (ou no próprio PR), atualizar `STATE.md` (onde parei) e `ROADMAP.md` (marcar item entregue).

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
4. **Nunca deixar branch antiga (já mergeada) viva no remoto.** Deletar após merge.
5. **Nunca `git reset --hard` sem antes verificar working tree.** O `--hard` apaga alterações não-commitadas **silenciosamente**. Antes de usar, rode `git status` e/ou `git stash` para preservar trabalho em andamento. Já perdi trabalho de uma sessão por essa armadilha — não repete.

## Convenções (não-bloqueantes, mas valem a disciplina)

- **PR aberto há mais de 5 dias sem merge é red flag** — ou termina, ou fecha como "won't merge", ou divide em PRs menores.

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

Princípio geral: **rebase, não merge.** Resolva conflito linha a linha, teste o resultado, depois `--continue`.
