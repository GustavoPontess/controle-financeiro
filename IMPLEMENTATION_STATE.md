---
owner: Gustavo
last_reviewed: 2026-05-21
status: EM_EXECUCAO
issue_atual: '#77 — Página Para Casais (/site/casais)'
---

# Implementation State — sessão atual

**Este arquivo é o checkpoint vivo entre sessões.** Toda sessão começa lendo este arquivo, e termina atualizando-o.

> O estado dos ciclos anteriores está arquivado em `docs/history/IMPLEMENTATION_STATE_2026Q*.md`.

---

## Ciclo em execução

**Ciclo:** Q5 2026 — Refator completo tela por tela
**Iniciado em:** 2026-05-21
**Backlog:** 18 issues (#75-#92)
**Spec do ciclo:** `ISSUES.md`

---

## Issue em execução

**Issue:** #77 — Página Para Casais (`/site/casais`)
**Iniciada em:** 2026-05-21 (sessão 32)
**Branch:** `feature/77-site-casais`
**Contexto:** #76 (Login+Register) está com Caio. Vou de #77 (próxima do site público).

### Etapas
- [x] 1. Extrair `<SiteNavbar>` de `HomePage.tsx` pra `pages/Site/SiteNavbar.tsx` reutilizável
- [x] 2. Criar `pages/Site/CouplesPage.tsx` (hero + 4 sections + testimonial + CTA + footer)
- [x] 3. Registrar rota `/site/casais` em `AppRoutes.tsx`
- [x] 4. `/site/casais` já público (axiosConfig usa `startsWith('/site')`)
- [x] 5. Links no menu — SiteNavbar tem "Para Casais" default em todos
- [x] 6. Build + lint verde
- [x] 7. Teste smoke (4 testes — hero, 4 sections, CTA, navbar)
- [ ] 8. PR + merge

### Etapa atual
8 — abrir PR.

### Próxima ação concreta
`git push -u origin feature/77-site-casais && gh pr create ...`

### Ordem sugerida do backlog

**Site público (primeiro — desbloqueia fluxo de entrada):**
1. ~~#75 — `/` vira root público com fallback Dashboard~~ ✅ MERGEADA (PR #94)
2. **#76** — Refator Login + Register
3. **#77** — Página Para Casais
4. **#78** — Página Para Contadores
5. **#79** — Página Recursos completa
6. **#80** — Página Sobre

**Telas internas (em paralelo com site, conforme dev livre):**
7. **#81** — Dashboard refator 6 KPIs + gráficos
8. **#82** — Transação Adicionar/Editar (único + recorrente + parcelado)
9. **#83** — Categorias + Subcategorias
10. **#84** — Cartão de Crédito (auditar)
11. **#85** — Família (rateio + aprovação + §16.5)
12. **#86** — Metas
13. **#87** — Limites por categoria
14. **#88** — Bancos com logo real
15. **#89** — Recorrentes refator

**Infra e qualidade (em paralelo):**
16. **#90** — Personalização in-app (paleta + fonte + dark mode)
17. **#91** — CI/CD gate
18. **#92** — Cobertura E2E Playwright

### Próxima ação concreta

1. Dev livre escolhe issue (recomendação: começar por **#75** se ainda não está em curso, pois desbloqueia o fluxo de entrada)
2. Cria branch `feature/<numero>-<slug-kebab>` a partir de `main` atualizado
3. Atualiza `IMPLEMENTATION_STATE.md` com:
   - `status: EM_EXECUCAO`
   - `issue_atual: '#XX — <título curto>'`
   - Preenche template abaixo

---

## Decisões registradas (Q5)

- **Pull-based:** sem assignee fixo. Dev livre pega a próxima da ordem sugerida.
- **Branch por issue:** sempre `feature/<numero>-<slug>`.
- **Critério done:** build + lint + testes verdes + homologação em dev + PR mergeado.
- **Personalização vence dark mode:** issue #63 (dark mode dedicado) cancelada — vira parte de #90.
- **Marca fixa:** nome Pontes, logo conceito 20, Plus Jakarta da marca. Paleta e fonte do produto = escolha do usuário (#90).
- **Estrutura `pages/Site/`** pra todas as páginas públicas (Home, Couples, Professionals, Pricing, About, etc).

---

## Template para preencher quando começar uma issue

```
---
owner: Gustavo
last_reviewed: YYYY-MM-DD
status: EM_EXECUCAO
issue_atual: '#XX — <título curto>'
---

## Issue em execução

**Issue:** #XX — [nome]
**Iniciada em:** YYYY-MM-DD
**Sessões nessa issue:** N
**Branch:** feature/XX-slug

### Etapas
- [x] 1. [descrição] — checkpoint: [...]
- [ ] 2. [descrição] — checkpoint: [...]

### Etapa atual
[Qual etapa, o que falta pra fechar]

### Próxima ação concreta
[Exatamente o próximo passo]

### Decisões tomadas nesta sessão
- [Decisão importante que afeta outros pontos]
```

---

## Como esse arquivo se relaciona com PROGRESS.md e ISSUES.md

- **ISSUES.md** = catálogo de tudo que precisa ser feito, com escopo e severidade. Não muda durante a sessão.
- **PROGRESS.md** = dashboard de quanto já foi feito, histórico de sessões. Atualizado ao final de cada sessão.
- **IMPLEMENTATION_STATE.md (este)** = estado granular de **uma** issue em execução. Atualizado a cada etapa concluída dentro da sessão.

Os três funcionam em camadas: este é o mais granular, PROGRESS.md é a visão do ciclo, ISSUES.md é o catálogo trimestral.
