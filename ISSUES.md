# Issues & Problemas Técnicos

**Descobertos em:** 2026-05-07  
**Contexto:** Auditoria para preparar projeto para virar produto  
**Status Geral:** 🔴 10 problemas críticos/altos + 7 médios

---

## 🔴 BLOQUEADORES CRÍTICOS (Atacar Primeiro)

### #1: Parcelamento Inflexível

**Severidade:** 🔴 CRÍTICA  
**Impacto:** Não funciona para seu caso real (saltar meses)  
**Esforço:** 6 horas  
**Status:** ⏳ NÃO INICIADO

**Problema:**
- Atual: 12 parcelas sempre consecutivas (mai→jun→jul...)
- Você precisa: Parcela 1 em JUL, 2 em SET, 3 em NOV, etc
- Causa: Tabela `Transacao` mistura "informação da compra" com "informação da parcela"

**Solução:**
- Criar tabela `ParcelaTransacao`
- Cada parcela tem sua data de vencimento
- Flexibilidade total

**Checklist After Resolve:**
- [ ] Atualizar docs/DATABASE.md (novo schema)
- [ ] Atualizar docs/FLOWS.md (novo fluxo de parcelamento)
- [ ] Atualizar docs/STANDARDS.md (padrão de ParcelaTransacao)
- [ ] Atualizar memory/decisions_and_constraints.md
- [ ] Criar migration EF Core
- [ ] Testar end-to-end

---

### #2: Sem Testes Unitários/Integração

**Severidade:** 🔴 CRÍTICA  
**Impacto:** Risco ao refatorar, sem confiança no código  
**Esforço:** 8 horas  
**Status:** ⏳ NÃO INICIADO

**Problema:**
- 0% cobertura de testes
- Refatorar parcelamento = risco alto

**Solução:**
- Setup xUnit (backend)
- Setup Jest/Vitest (frontend)
- Testes básicos em TransacaoService, CartaoCreditoService

**Checklist After Resolve:**
- [ ] Documentar setup de testes em docs/
- [ ] Atualizar memory/decisions_and_constraints.md
- [ ] CI/CD para rodar testes em cada commit

---

### #3: Validações de Negócio Ausentes

**Severidade:** 🔴 CRÍTICA  
**Impacto:** Dados inválidos no banco  
**Esforço:** 4 horas  
**Status:** ⏳ NÃO INICIADO

**Problema:**
- Transação pode ser futura (❌ não deveria)
- Parcela pode ter valor negativo (❌ não deveria)
- CartãoCredito pode ter limite negativo (❌)
- Saldo de Conta pode ser manipulado direto (❌)

**Solução:**
- Adicionar validações em Services
- Adicionar FluentValidation ou data annotations
- Testes de validação

**Checklist After Resolve:**
- [ ] Documentar validações em docs/STANDARDS.md
- [ ] Atualizar memory/decisions_and_constraints.md
- [ ] Adicionar exemplos de erro em docs/

---

## 🟡 PROBLEMAS ALTOS (Atacar Depois)

### #4: Sem Paginação em Endpoints

**Severidade:** 🟡 ALTA  
**Impacto:** API fica lenta com muitas transações  
**Esforço:** 2 horas  
**Status:** ⏳ NÃO INICIADO

**Problema:**
- GET /transacoes retorna TUDO (10k transações? Tudo!)
- Sem limite

**Solução:**
- Adicionar `skip` e `take` em controllers
- Frontend com paginação

**Checklist After Resolve:**
- [ ] Atualizar CONTROLLER_TEMPLATE.md
- [ ] Documentar paginação em docs/

---

### #5: Autenticação Não-Robusta

**Severidade:** 🟡 ALTA  
**Impacto:** Inseguro para produção  
**Esforço:** 5 horas  
**Status:** ⏳ NÃO INICIADO

**Problema:**
- Sem "forgot password"
- Sem "2FA"
- Sem "session management"
- Sem "refresh token"

**Solução:**
- Implementar forgot password
- Refresh token para expiração
- 2FA opcional

**Checklist After Resolve:**
- [ ] Atualizar docs/FLOWS.md (novo fluxo auth)
- [ ] Documentar segurança em docs/
- [ ] Atualizar memory/decisions_and_constraints.md

---

### #6: Documentação Sem Dono/Revisão

**Severidade:** 🟡 ALTA  
**Impacto:** Docs ficam obsoletas  
**Esforço:** 1 hora  
**Status:** ⏳ NÃO INICIADO

**Problema:**
- Quem é responsável por cada doc?
- Quando revisar?
- Status (CURRENT / DEPRECATED)?

**Solução:**
- Adicionar frontmatter em cada doc:
  ```yaml
  owner: Gustavo
  last_reviewed: 2026-05-07
  next_review: 2026-08-07
  status: CURRENT
  ```

**Checklist After Resolve:**
- [ ] Adicionar metadata em todos docs em docs/
- [ ] Adicionar metadata em memory/
- [ ] Criar checklist de revisão mensal

---

### #7: Sem Versionamento de API

**Severidade:** 🟡 ALTA  
**Impacto:** Quebracliente se mudar schema  
**Esforço:** 3 horas  
**Status:** ⏳ NÃO INICIADO

**Problema:**
- POST /api/transacoes (v1 implícita)
- Sem suporte a múltiplas versões

**Solução:**
- POST /api/v1/transacoes
- Suporte a v1, v2 simultâneas por 1-2 anos

**Checklist After Resolve:**
- [ ] Atualizar Program.cs com versionamento
- [ ] Atualizar controllers
- [ ] Documentar estratégia em docs/

---

## 🟠 PROBLEMAS MÉDIOS (Atacar Depois)

### #8: Tratamento de Erro Inconsistente

**Severidade:** 🟠 MÉDIA  
**Impacto:** Confunde frontend e usuário  
**Esforço:** 2 horas  
**Status:** ⏳ NÃO INICIADO

**Problema:**
- Alguns endpoints: `{ message: "erro" }`
- Outros: `{ mensagem: "erro" }`
- Inconsistência em status codes

**Solução:**
- Padrão único de erro
- Códigos de erro (ERROR_001)
- Middleware de error handling

**Checklist After Resolve:**
- [ ] Atualizar CONTROLLER_TEMPLATE.md
- [ ] Documentar erro handling em docs/

---

### #9: SQL Raw em Program.cs (Não Migração)

**Severidade:** 🟠 MÉDIA  
**Impacto:** Deploy arriscado, difícil de sincronizar  
**Esforço:** 2 horas  
**Status:** ⏳ NÃO INICIADO

**Problema:**
- AplicarSistemaFaturasAsync() executa SQL direto
- Não é migration EF Core
- Difícil de rollback

**Solução:**
- Converter tudo para migrations EF Core
- Deletar SQL raw do Program.cs

**Checklist After Resolve:**
- [ ] Atualizar docs/ se schema mudou
- [ ] Testar em DB limpo
- [ ] Documentar migração em docs/

---

### #10: Sem Features Básicas

**Severidade:** 🟠 MÉDIA  
**Impacto:** Produto não é competitivo  
**Esforço:** 20+ horas  
**Status:** ⏳ NÃO INICIADO

**Problemas:**
- ❌ Relatórios customizáveis
- ❌ Export (CSV, PDF)
- ❌ Orçamento / metas
- ❌ Avisos de limite
- ❌ Recorrentes com auto-execução
- ❌ Sincronização com banco

**Checklist After Resolve:**
- [ ] Documentar cada feature
- [ ] Testar end-to-end
- [ ] Atualizar docs/FLOWS.md

---

## 📋 Formato de Resolução

Cada problema, quando resolvido, segue este checklist:

```markdown
## ✅ #X: [Nome Problema]

**Resolvido em:** YYYY-MM-DD
**Tempo gasto:** X horas
**Commits:** #abc123, #def456

**O que mudou:**
- Descrição da mudança

**Documentação atualizada:**
- [x] docs/DATABASE.md
- [x] docs/FLOWS.md
- [x] memory/decisions_and_constraints.md
- [x] docs/STANDARDS.md
- [x] QUICK_REFERENCE.md
- [x] CLAUDE.md

**Testes adicionados:**
- [x] TransacaoServiceTests.cs
- [x] ParcelaTransacaoTests.tsx

**Próximo problema:** #4
```

---

## 📊 Prioridade de Ataque

```
Semana 1: #1 (Parcelamento) + #2 (Testes) + #3 (Validações)
Semana 2: #6 (Docs Owner) + #4 (Paginação)
Semana 3: #5 (Auth) + #9 (Migrations)
Semana 4: #7 (API Versioning) + #8 (Erro Handling)
Depois: #10 (Features)
```

---

## 🎯 Próximo Passo

**Qual atacar primeiro?**
- [ ] #1 Parcelamento inflexível
- [ ] #2 Testes
- [ ] #3 Validações
- [ ] Outro?

Decide e a gente começa! 🚀
