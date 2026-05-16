---
owner: Gustavo
last_reviewed: 2026-05-16
status: EM_EXECUCAO
issue_atual: '#13 — JWT em httpOnly cookie + CSRF token'
---

# Implementation State — sessão atual

**Este arquivo é o checkpoint vivo entre sessões.** Toda sessão começa lendo este arquivo, e termina atualizando-o.

> O estado anterior (Issue #1 — Parcelamento Flexível, 13 sessões) está arquivado em `docs/history/IMPLEMENTATION_STATE_2026Q2_parcelamento.md`.

---

## Issue em execução

**Issue:** #13 — JWT em httpOnly cookie + CSRF token
**Bloco:** A (Higiene de Produção)
**Iniciada em:** 2026-05-16 (sessão 16)
**Sessões nessa issue:** 1
**Status:** 50% — backend ✅, frontend ⏳

### Etapas
- [x] 1. CsrfTokenService: gerar e validar tokens
- [x] 2. AuthController: SetAuthCookies com HttpOnly, Secure, SameSite=Strict
- [x] 3. Login/Refresh: emitir em cookies, não no body
- [x] 4. CsrfValidationMiddleware: validar X-CSRF-Token em POST/PUT/DELETE/PATCH
- [ ] 5. Frontend: remover JWT de localStorage
- [ ] 6. Frontend: axiosClient com withCredentials: true
- [ ] 7. Frontend: incluir X-CSRF-Token em headers (mutators)
- [ ] 8. Frontend: remover Token/RefreshToken de storage
- [ ] 9. Testar: JWT não aparece em localStorage
- [ ] 10. Testar: CSRF bloqueado cross-origin

### Próxima ação concreta
Sessão 17:
1. Abrir frontend (`controle-financeiro.web/src/api/axiosClient.ts`)
2. Remover `token` e `refreshToken` de localStorage
3. Configurar `withCredentials: true`
4. Adicionar interceptor para incluir X-CSRF-Token em headers
5. Testar login (JWT em cookie, não localStorage)
6. Testar CSRF de origem diferente (deve bloquear)


---

## Template para preencher quando começar uma issue

```
## Issue em execução

**Issue:** #XX — [nome]
**Bloco:** [A/B/C/D]
**Iniciada em:** YYYY-MM-DD
**Sessões nessa issue:** N

### Etapas
- [x] 1. [descrição] — checkpoint: [...]
- [ ] 2. [descrição] — checkpoint: [...]
- [ ] 3. [descrição] — checkpoint: [...]

### Etapa atual
[Qual etapa, o que falta pra fechar]

### Próxima ação concreta
[Exatamente o próximo passo — arquivo a tocar, método a criar, etc]

### Decisões tomadas nesta sessão
- [Decisão importante que afeta outros pontos]

### Pontos pendentes / dúvidas para o usuário
- [Coisa que precisa de input antes de avançar]
```

---

---

## Como esse arquivo se relaciona com PROGRESS.md e ISSUES.md

- **ISSUES.md** = catálogo de tudo que precisa ser feito, com escopo e severidade. Não muda durante a sessão.
- **PROGRESS.md** = dashboard de quanto já foi feito, histórico de sessões. Atualizado ao final de cada sessão.
- **IMPLEMENTATION_STATE.md (este)** = estado granular de **uma** issue em execução. Atualizado a cada etapa concluída dentro da sessão.

Os três funcionam em camadas: este é o mais granular, PROGRESS.md é a visão mensal, ISSUES.md é o catálogo trimestral.
