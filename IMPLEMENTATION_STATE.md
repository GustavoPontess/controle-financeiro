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
**Sessões nessa issue:** 2
**Status:** 90% — backend ✅, frontend ✅, testes ⏳

### Etapas
- [x] 1. CsrfTokenService: gerar e validar tokens
- [x] 2. AuthController: SetAuthCookies com HttpOnly, Secure, SameSite=Strict
- [x] 3. Login/Refresh: emitir em cookies, não no body
- [x] 4. CsrfValidationMiddleware: validar X-CSRF-Token em POST/PUT/DELETE/PATCH
- [x] 5. Frontend: remover JWT de localStorage
- [x] 6. Frontend: axiosConfig com withCredentials: true
- [x] 7. Frontend: incluir X-CSRF-Token em headers (mutators)
- [x] 8. Frontend: remover Token/RefreshToken de storage — refatorado AuthContext
- [ ] 9. Testar: JWT não aparece em localStorage
- [ ] 10. Testar: CSRF bloqueado cross-origin

### Etapa atual
Testes manuais de integração. Build frontend ✅. Build backend aguarda liberação de processo (PID 3904 rodando).

### Próxima ação concreta
Sessão 18:
1. Encerrar processo antigo do API (PID 3904)
2. Rodar backend: `dotnet run` em ControleFinanceiro.Api/
3. Rodar frontend: `npm run dev` em controle-financeiro.web/
4. Login em http://localhost:5173 com credenciais teste
5. DevTools → Application → Cookies: verificar "jwt" (httpOnly) e "X-CSRF-Token" presentes
6. DevTools → Application → localStorage: verificar vazio
7. DevTools → Network: testar POST e verificar header "X-CSRF-Token" enviado
8. Cross-origin test (abrir outra aba em origin diferente, tentar fazer POST) — deve retornar 403


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
