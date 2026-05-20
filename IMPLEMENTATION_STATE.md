---
owner: Gustavo
last_reviewed: 2026-05-21
status: AGUARDANDO_PROXIMA
issue_atual: 'Nenhuma — #101 mergeada (PR #102), biblioteca pronta'
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

**Nenhuma issue em execução.** Sessão 32 mergeou #101 (biblioteca de componentes Pontes — PR #102). Biblioteca disponível em `src/components/pontes/`, importável via `@/components/pontes`. Próxima livre: qualquer issue do refator (#76 ja com Caio).

### Histórico breve sessão 32
- #101 criada e mergeada na mesma sessão (urgência: bloqueava #76 do Caio e demais refatores)
- 36 componentes criados + DesignSystemPage reescrita + 14 testes + lucide-react adotado
- Alert/Toast imunes à paleta (padrão universal)
- Regras documentadas em PROMPT_NOVA_SESSAO §5 (teste obrigatório front+back, biblioteca obrigatória, cor+fonte universal)

---

## (sessão anterior preservada)

**Issue:** #101 — Biblioteca de componentes Pontes (`src/components/pontes/`)
**Iniciada em:** 2026-05-21 (sessão 32)
**Branch:** `feature/101-biblioteca-pontes`

**Por quê:** DS antigo era página showcase com componentes inline. Caio refator Login (#76) e demais issues de tela não tinham o que importar — vira retrabalho e desvio. #101 bloqueia #76, #77, #78, #79, #80, #81, #82, #83, #84, #86, #87, #89.

### Etapas
- [x] 1. Criar pasta `src/components/pontes/` separada do legado
- [x] 2. theme.ts (palettes + fonts + spacing + radii + shadows + semantic + adjustColor)
- [x] 3. Botões: PontesButton (7 variants × 5 sizes × loading/success/disabled) + PontesIconButton + PontesFab + PontesButtonGroup + PontesLink
- [x] 4. Form: PontesField + PontesInput (com iconStart/End + invalid) + PontesMoneyInput + PontesTextarea + PontesSelect + PontesToggle + PontesCheckbox + PontesRadio/Group
- [x] 5. Form avançado: PontesOtpInput + PontesSlider + PontesDatePicker + PontesFileDrop + PontesTagInput + PontesColorPicker + PontesRating + PontesKbd/Group
- [x] 6. Dados: PontesBadge + PontesAvatar + PontesAvatarStack + PontesAlert + PontesProgress + PontesStatCard + PontesCard + PontesTable
- [x] 7. Feedback: PontesToast + PontesModal + PontesDialog + PontesSkeleton/Row/List + PontesEmptyState + PontesLoadingDots + PontesDrawer + PontesTooltip + PontesPopover
- [x] 8. Navegação: PontesBreadcrumb + PontesTabs (pills/underline) + PontesStepper + PontesPagination + PontesCommandPalette
- [x] 9. Site: PontesNavbar (move de SiteNavbar) + PontesFooter (rich/minimal)
- [x] 10. index.ts barrel
- [x] 11. DesignSystemPage reescrita usando biblioteca (zero inline)
- [x] 12. Build verde + lint zero
- [x] 13. 14 smoke tests novos · suite 60/60
- [ ] 14. Commit + PR

### Etapa atual
14 — commit e abrir PR.

### Próxima ação concreta
`git add ... && git commit && git push && gh pr create`

### Decisões tomadas nesta sessão
- **Separação clara legado vs novo:** componentes antigos (CustomButton, MUI direto, tokens.ts) ficam em `components/` raiz; novos somente em `components/pontes/`. Telas refatoradas Q5 importam SÓ daqui. Final do Q5, deleta legado em PR separado.
- **API uniforme:** todos os componentes recebem `p: Palette` + `font: string` por prop. Quando #90 entregar context global, refatora todos para consumir do context.
- **Cores semânticas independentes de paleta:** success/warning/danger/info fixas em theme.ts → não mudam com troca de paleta (vermelho de erro sempre vermelho).
- **Footer com duas variants:** `rich` (4 cols + brand + social) e `minimal` (linha única). HomePage usa rich, CouplesPage minimal (mais discreto).
- **PR #100 (CouplesPage) fechado sem mergear:** branch `feature/77-site-casais` preservada. Vai ser refeita usando biblioteca quando #101 mergear.

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
