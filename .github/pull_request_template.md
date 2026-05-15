<!--
Obrigado pelo PR! Preencha os campos abaixo. Deixe checkboxes vazios para os passos que ainda não foram completados — assim o reviewer sabe o que falta.
-->

## Issue relacionada

Closes #<numero>

<!-- Se for trabalho parcial que não fecha a Issue inteira, use "Refs #<numero>" no lugar de "Closes" -->

## O que muda

<!-- Resumo em 2-4 frases do que esse PR faz e por quê. Não copie a Issue — descreva o resultado. -->

## Como testar

<!-- Passos para o reviewer reproduzir o resultado localmente. Comandos, endpoints, dados de exemplo. -->

```
# exemplo
git checkout feature/<numero>-<slug>
dotnet run
# acessar http://localhost:5293/swagger e testar POST /api/v1/...
```

## Screenshots (se UI)

<!-- Antes/depois se aplicável -->

## Checklist de qualidade

### Código
- [ ] `dotnet build` sem warnings
- [ ] `dotnet test` passando (todos os testes)
- [ ] `npm run build` sem erros (se mexeu no frontend)
- [ ] `npm run lint` sem erros (se mexeu no frontend)
- [ ] Sem `console.error` ou `Debug.Log` esquecidos

### Documentação
- [ ] `docs/DATABASE.md` (se schema mudou)
- [ ] `docs/FLOWS.md` (se fluxo de negócio mudou)
- [ ] `docs/STANDARDS.md` (se padrão novo introduzido)
- [ ] `docs/QUICK_REFERENCE.md` (se algo essencial mudou)
- [ ] `docs/features/<feature>/` (se feature foi tocada)
- [ ] Swagger atualizado (XML comments em endpoints novos)

### Commits e branch
- [ ] Mensagens semânticas (`feat:`, `fix:`, `docs:` etc.)
- [ ] Sem commits "WIP" ou temporários
- [ ] Refs para Issue presentes em commits importantes
- [ ] Branch derivada de `main` atualizado

### Segurança e dados
- [ ] Nenhum segredo ou senha hardcoded
- [ ] `UsuarioId` checado em todas as queries novas (multi-tenancy)
- [ ] Soft delete preservado em entidades financeiras

## Notas para o reviewer

<!-- Algo específico que você quer que o reviewer olhe com mais atenção? Dúvidas em aberto? Decisão que mereceu trade-off? -->

## Após approval

- [ ] Eu (autor) vou fazer o **squash merge** (não o reviewer)
- [ ] Branch será deletada pós-merge
- [ ] `ISSUES.md` e `PROGRESS.md` serão atualizados em PR de follow-up (ou neste mesmo se já estiverem inclusos)
