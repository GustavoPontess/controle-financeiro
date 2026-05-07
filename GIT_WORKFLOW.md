# Git Workflow - Padrão de Commits & Branches

**Decisão:** GitHub Flow (simples, moderno, eficiente)  
**Data:** 2026-05-07  
**Responsável:** Gustavo  

⚠️ **IMPORTANTE:** Seguir este padrão em TODOS os commits e branches. Não improvisar.

---

## 📋 Estratégia: GitHub Flow

### Por quê GitHub Flow?
- ✅ Simples (1 main + feature branches)
- ✅ Cada problema = 1 branch clara
- ✅ Fácil rastrear em ISSUES.md
- ✅ Rápido de fazer merge
- ✅ Moderno (usado por GitHub, GitLab)
- ✅ Sem overhead de Git Flow

### Branches
```
main (ÚNICA branch protegida em produção)
  ↑
  └─ feature/[ISSUE_ID]-[descrição] (cada problema)
     └─ merge quando resolvido
```

---

## 🏷️ Padrão de Naming de Branches

### Formato
```
feature/[ISSUE_ID]-[descrição-em-kebab-case]
```

### Exemplos (Obrigatório)
```
feature/1-parcelamento-flexivel
feature/2-add-unit-tests
feature/3-validacoes-negocio
feature/4-paginacao-endpoints
feature/5-autenticacao-robusta
feature/6-docs-ownership
feature/7-api-versioning
feature/8-error-handling-consistente
feature/9-migrations-ef-core
feature/10-features-basicas
```

### ❌ O QUE NÃO FAZER
```
❌ feature/parcelamento (sem ID)
❌ feature/1-parcelamento_inflexivel (underscore, não kebab)
❌ fix/parcelamento (usa feature, não fix/hotfix para problemas normais)
❌ my-branch (nenhum prefixo)
```

---

## 📝 Padrão de Commit Messages

### Formato
```
<tipo>(<escopo>): <descrição>

<corpo (opcional)>

<footer (opcional)>
```

### Tipos (Obrigatório)
```
feat:     Nova feature ou melhoria
fix:      Correção de bug
docs:     Documentação
refactor: Refatoração de código (sem mudança de feature)
test:     Testes adicionados/modificados
chore:    Dependências, build, etc
```

### Exemplos (Obrigatório)

**Commit simples:**
```
feat: adicionar suporte a parcelamento flexível
```

**Com escopo:**
```
feat(transacao): refactor parcelamento com ParcelaTransacao

- Criar tabela ParcelaTransacao
- Suportar datas customizadas
- Migration EF Core
```

**Fixar bug:**
```
fix(auth): corrigir JWT token expirado após 60min

O token não estava sendo renovado. Implementado refresh token.
```

**Documentação:**
```
docs: atualizar DATABASE.md após refactor parcelamento
```

### ❌ O QUE NÃO FAZER
```
❌ "mudancas" (muito genérico)
❌ "fix fix fix" (sem descrição)
❌ "commit" (impessoal)
❌ "1" (ilegível)
❌ "GRANDE MUDANÇA AQUI" (sem tipo)
```

---

## 🔄 Workflow Passo a Passo

### 1. Começar Novo Problema

```bash
# Atualizar main
git checkout main
git pull origin main

# Criar branch EXATAMENTE neste formato
git checkout -b feature/[ID]-[descrição]

# Exemplo:
git checkout -b feature/1-parcelamento-flexivel
```

### 2. Trabalhar no Problema

```bash
# Fazer mudanças
# ... editar código ...

# Commits frequentes (não 1 commit gigante)
git add src/services/ParcelaTransacaoService.cs
git commit -m "feat(transacao): adicionar serviço de parcela"

git add ControleFinanceiro.Api/Controllers/TransacoesController.cs
git commit -m "feat(controller): atualizar endpoint de parcelamento"

git add docs/DATABASE.md
git commit -m "docs: atualizar schema após ParcelaTransacao"

# Push
git push origin feature/1-parcelamento-flexivel
```

### 3. Antes de Fazer Merge: Checklist

```
Antes de fazer merge, garantir:

Código:
  [ ] dotnet build (sem warnings)
  [ ] npm run lint (frontend sem erros)
  [ ] Testes passam (se houver)
  [ ] Zero console.error no browser

Documentação:
  [ ] docs/DATABASE.md atualizado (se schema mudou)
  [ ] docs/FLOWS.md atualizado (se fluxo mudou)
  [ ] docs/STANDARDS.md atualizado (se padrão mudou)
  [ ] memory/architecture_audit.md atualizado
  [ ] memory/decisions_and_constraints.md atualizado (se decisão nova)
  [ ] QUICK_REFERENCE.md atualizado (se resumo mudou)
  [ ] CONTROLLER_TEMPLATE.md atualizado (se padrão mudou)
  [ ] ISSUES.md atualizado (marcar como ✅ #X)
  [ ] PROGRESS.md atualizado (incrementar contador)

Commits:
  [ ] Mensagens claras (feat/fix/docs)
  [ ] Sem "WIP", "tmp", "test"
  [ ] Sem commits desnecessários

Testes:
  [ ] Testes novos cobrem mudança
  [ ] Testes antigos ainda passam
  [ ] Zero test failures

Swagger:
  [ ] Swagger UI atualizado (se endpoint novo)
  [ ] Comentários XML em place
```

### 4. Fazer Merge

```bash
# Opção A: Merge local
git checkout main
git pull origin main
git merge feature/1-parcelamento-flexivel
git push origin main

# Opção B: Pull Request (melhor pra revisar)
# No GitHub/GitLab, abrir PR e merge via interface

# Delete branch
git branch -d feature/1-parcelamento-flexivel
git push origin --delete feature/1-parcelamento-flexivel
```

### 5. Atualizar PROGRESS.md + ISSUES.md

**APÓS fazer merge na main:**

```bash
# Já na main
git pull origin main

# Editar PROGRESS.md:
# - Mover #1 de "⏳ NÃO INICIADOS" para "✅ RESOLVIDOS"
# - Incrementar contador "0/10" → "1/10"
# - Adicionar nota da resolução

# Editar ISSUES.md:
# - Mudar status de "#1" de "⏳ NÃO INICIADO" para "✅ RESOLVIDO"

git add PROGRESS.md ISSUES.md
git commit -m "docs: problema #1 resolvido"
git push origin main
```

---

## 📋 Template de PR (se usar Pull Requests)

```markdown
# Problema: #1 - Parcelamento Flexível

## Descrição
Refator completo do sistema de parcelamento para suportar datas customizadas.

Ver ISSUES.md #1 para contexto completo.

## Mudanças Técnicas
- [ ] Nova tabela `ParcelaTransacao`
- [ ] Migration EF Core
- [ ] Controllers atualizados
- [ ] Testes adicionados

## Documentação Atualizada
- [x] docs/DATABASE.md
- [x] docs/FLOWS.md
- [x] memory/architecture_audit.md
- [x] ISSUES.md
- [x] PROGRESS.md

## Checklist de Qualidade
- [x] Build sem warnings
- [x] Testes passam
- [x] Swagger atualizado
- [x] Zero console.error
- [x] Commits com mensagens claras

## Relacionado
Closes ISSUES.md #1
```

---

## 🔗 Integração com ISSUES.md + PROGRESS.md

### Relação Obrigatória

```
ISSUES.md:
├── #1 Parcelamento Inflexível
│   └── Branch: feature/1-parcelamento-flexivel
│   └── Status: ⏳ NÃO INICIADO / 🔄 EM PROGRESSO / ✅ RESOLVIDO
│
├── #2 Testes
│   └── Branch: feature/2-add-unit-tests
│   └── Status: ⏳ NÃO INICIADO
│
└── #3 Validações
    └── Branch: feature/3-validacoes-negocio
    └── Status: ⏳ NÃO INICIADO

PROGRESS.md:
├── 🔴 CRÍTICOS: 0/3
│   [ ] #1 (feature/1-parcelamento-flexivel)
│   [ ] #2 (feature/2-add-unit-tests)
│   [ ] #3 (feature/3-validacoes-negocio)
│
└── 📈 Total: 0/10 resolvidos
```

---

## 📊 Exemplo Completo (Semana 1)

```bash
# Segunda
git checkout -b feature/1-parcelamento-flexivel
# ... trabalhar ...
git add .
git commit -m "feat: adicionar ParcelaTransacao"
git push origin feature/1-parcelamento-flexivel

# Quarta (após resolver)
git checkout main
git pull origin main
git merge feature/1-parcelamento-flexivel
git push origin main
git branch -d feature/1-parcelamento-flexivel
git push origin --delete feature/1-parcelamento-flexivel

# Atualizar docs
git add PROGRESS.md ISSUES.md
git commit -m "docs: problema #1 resolvido"
git push origin main

# Quinta
git checkout -b feature/2-add-unit-tests
# ... continuar ...
```

---

## ✅ Checklist Antes de Começar Cada Problema

```
Antes de git checkout -b feature/X:

[ ] ISSUES.md está atualizado?
[ ] PROGRESS.md está atualizado?
[ ] main está atualizado?
    git checkout main
    git pull origin main
[ ] Nenhuma branch antiga pendente?
    git branch -a
[ ] Decisão clara do que fazer?
    Ver ISSUES.md #X
[ ] Tempo estimado? (blocar calendário se preciso)
```

---

## 🚨 Regras que NUNCA Quebrar

1. **SEMPRE começar em main atualizado**
   ```bash
   git checkout main
   git pull origin main
   ```

2. **SEMPRE usar naming pattern** `feature/[ID]-[descrição]`

3. **SEMPRE fazer commits com tipo** `feat:/fix:/docs:/etc`

4. **SEMPRE revisar checklist** antes de fazer merge

5. **SEMPRE atualizar PROGRESS.md + ISSUES.md** após resolver

6. **NUNCA fazer merge de feature diretamente em main** (usar PR se possível)

7. **NUNCA commit sem descrição clara**

8. **NUNCA deixar branches antigas no remote**

---

## 📱 Git Aliases (Optional, Facilita Vida)

Adicione ao `~/.gitconfig`:

```ini
[alias]
    checkout-clean = "!git checkout main && git pull origin main"
    branch-clean = "!git branch -d $(git branch --merged | grep -v main)"
    commit-msg = "!echo 'feat:|fix:|docs:|refactor:|test:|chore:'"
    log-branch = "log --oneline --graph --all --decorate"
```

Uso:
```bash
git checkout-clean
git commit-msg  # mostra tipos válidos
git branch-clean
```

---

## 📚 Referência Rápida

| Ação | Comando |
|------|---------|
| Começar problema | `git checkout -b feature/1-xxx` |
| Fazer commit | `git commit -m "feat: descrição"` |
| Enviar branch | `git push origin feature/1-xxx` |
| Merge | `git merge feature/1-xxx` |
| Atualizar docs | `git add PROGRESS.md && git commit -m "docs: #1 resolvido"` |
| Deletar branch | `git branch -d feature/1-xxx && git push origin --delete feature/1-xxx` |

---

## 💡 Reminders Automáticos

Toda vez que começar problema novo, lembrar:

✅ Padrão branch: `feature/[ID]-[descrição]`  
✅ Padrão commit: `feat/fix/docs: descrição`  
✅ Atualizar documentação antes de merge  
✅ Atualizar PROGRESS.md após resolver  
✅ Deletar branch após merge  

---

**Este arquivo é "LIVE" — se o padrão mudar, atualizar aqui!**
