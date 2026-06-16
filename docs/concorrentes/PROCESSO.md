# Processo de análise de concorrente (playbook fixo)

> **Mesmo processo pra TODO concorrente.** Não improvisar ordem. Seguir fase a fase. Cada concorrente vira uma pasta `docs/concorrentes/<nome>/` com os mesmos 4 docs + prints.

## Regras invioláveis (valem em todas as fases)

1. **Não vazar que estamos analisando.** Nunca colocar "teste concorrente", "análise", "Pontes" ou qualquer referência nossa em nome/descrição de dado criado na conta deles. Rótulos **genéricos** ("café", "mercado", valores quaisquer).
2. **Fatos separados de opinião.** Documentar o que a tela FAZ (fato) separado de recomendação (opinião).
3. **Validar promessa × realidade.** Muito app promete e não entrega (ex: Despezzas diz "casal" — confirmar se é de verdade ou marketing). Sempre testar a promessa na prática.
4. **Fechar com gaps priorizados** (impacto × custo) e o que **defender** do nosso fosso.

---

## FASE 1 — site público (ANTES do login)

**Objetivo:** entender como divulgam, o que prometem, e o design deles. Mapear **TODAS** as páginas públicas — não pular direto pro login.

Checklist:
- [ ] **Sitemap completo:** enumerar todas as páginas/links públicos (nav, footer, âncoras vs rotas reais, legais, social, app stores, comunidade, blog, ferramentas).
- [ ] **Landing:** headline, subhead, pitch central, CTAs. Como se posicionam (o "gancho").
- [ ] **Recursos/features:** cada bloco — o que prometem entregar.
- [ ] **Preços:** todos os planos, valores mensal/anual, o que cada um inclui, o que monetizam (free vs pago).
- [ ] **Prova social:** números, depoimentos, imprensa, backing/investidores.
- [ ] **Confiança/segurança:** como tratam o medo (Open Finance, criptografia, regulação).
- [ ] **Conteúdo/SEO:** blog, ferramentas grátis, calculadoras (funil de aquisição).
- [ ] **Comunidade/canais:** Discord, WhatsApp, redes.
- [ ] **Páginas extras:** central de ajuda, FAQ, documentação, legais.
- [ ] **Design:** cores, tipografia, tema (light/dark), tom de marca, logo/mascote, componentes.

Ferramentas: `get_page_text` (copy completa, barato), `read_page filter=interactive` (mapear links/rotas), `screenshot` (visual de cada seção), `WebFetch` (rápido pra páginas estáticas).

**Saída FASE 1:** preenche `README.md` (resumo+preços), `produto.md` (seção "Pré-login — site público" com sitemap), `design.md` (design deles).

---

## FASE 2 — tela de login/cadastro

**Objetivo:** documentar o onboarding/auth (parte do produto, e sinal de fricção).

Checklist:
- [ ] Métodos de auth (e-mail+senha, social, WhatsApp, passwordless/OTP/magic-link).
- [ ] Fluxo (cadastro e login separados ou unificados?).
- [ ] Fricção (quantos passos até entrar).
- [ ] Design da tela (split, arte, copy).

**→ PARA AQUI.** Não criar conta sozinho (regra de segurança: não posso criar conta / digitar senha). **O usuário faz o login** e devolve a sessão logada no navegador.

**Saída FASE 2:** seção "Tela de login" em `produto.md` + nota em `design.md`.

---

## FASE 3 — sistema interno (DEPOIS do usuário logar)

**Objetivo:** testar tudo de verdade. Mapear todas as rotas internas, processos, e **validar o que prometem na FASE 1**.

Checklist:
- [ ] **Todas as rotas internas:** navegar cada tela do app logado, uma a uma.
- [ ] **Cada tela:** o que faz, componentes, dados, interações.
- [ ] **Filtros:** mapear TODOS os filtros de cada listagem (período, conta, categoria, tipo, ordenação, busca, ocultar, tags…). Comparar com os nossos.
- [ ] **Fazer registros de teste** (rótulos genéricos): criar transação, categoria, meta, etc. Ver o fluxo real de criação/edição.
- [ ] **Testar a promessa-chave:** se vendem "família/casal", criar/convidar perfil e ver se é rateio real ou só visão separada. Se vendem "IA categoriza", ver se categoriza mesmo.
- [ ] **Processos de negócio:** parcelamento, fatura, recorrência, assinatura — abrir um de cada e ver como tratam.
- [ ] **Onboarding/conexão** (Open Finance) — fricção, passos.
- [ ] **Comparar com o nosso** ponto a ponto.

**Saída FASE 3:** completa `produto.md` (rotas/telas internas + filtros) e `comparativo.md` (gaps priorizados, fosso, promessa×realidade).

---

## Entregáveis por concorrente (pasta `docs/concorrentes/<nome>/`)

| Arquivo | Conteúdo |
|---|---|
| `README.md` | resumo executivo (1 min) + preços + por que é/não é perigoso |
| `produto.md` | sitemap público + telas (pré-login e internas) + filtros |
| `design.md` | design system deles + o que aprender / não copiar |
| `comparativo.md` | × Pontes: gaps priorizados (impacto×custo), fosso, promessa×realidade, recomendações |
| `prints/` | screenshots + `prints/README.md` (índice) |

E adicionar 1 linha do concorrente no índice `docs/concorrentes/README.md`.
