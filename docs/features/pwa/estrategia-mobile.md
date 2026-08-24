---
feature: pwa / mobile
status: MAPEADO (não iniciar agora)
owner: Gustavo
created: 2026-08-24
---

# Estratégia — virar app mobile

Mapa de **como** o Pontes vira "app de celular", com custos reais e ordem de
ataque. **Não é pra fazer agora.** Documento de decisão pra quando o beta
fechar.

> **Decisão do Gustavo (2026-08-24):** o **beta roda no PC**. Os testadores são
> pessoas próximas e vão usar no desktop enquanto o produto amadurece. **Mobile
> fica pra depois de terminar o beta.** Alinha com a preferência já registrada
> (desktop primeiro, mobile por último — ver memória `feedback_prioridade_desktop`).
> Este doc existe pra que, quando a hora chegar, a decisão já esteja pesquisada.

---

## 0. O que já existe

- PWA base **concluída** (#28, `arquitetura.md`): `vite-plugin-pwa` + Workbox,
  manifest, Service Worker que precacheia o shell (abre offline só de
  visualização), `InstallPrompt` a partir da 2ª sessão.
- **Buracos da PWA atual** (pra fechar quando mobile virar foco):
  - Manifest com nome genérico `Controle Financeiro` / `Finanças` — trocar pra
    marca **Pontes**.
  - Só ícone **SVG**. Android/iOS querem PNG **192 e 512**, `apple-touch-icon`
    e um **maskable** (senão o ícone fica feio/cortado na home).
  - Offline é só do shell; **dados de API não são cacheados** (sem runtime
    caching de GET). App abre offline mas sem conteúdo.
  - Layout ainda **não é mobile-first** (telas internas priorizaram desktop).

---

## 1. Os três caminhos

Do mais barato/rápido pro mais caro. **Todos falam com a MESMA API .NET** — a
decisão de hospedagem (`docs/features/hospedagem-beta/decisao.md`) serve web e
mobile igual, não muda por causa disto.

### A. PWA (o que já temos, faltando polir) — quase R$0

- Teu React vira "app instalável" pelo navegador: ícone na home, tela cheia,
  offline básico.
- **Custo de loja: R$0.** Não passa por Google Play nem Apple.
- Reusa **~100%** do código.
- **Limite iOS:** Apple trava PWA — push notification é capenga/limitado, sem
  presença na App Store, updates dependem do Safari. Android trata PWA quase
  como app nativo.
- **Trabalho pra "fechar":** manifest com a marca + ícones PNG/maskable +
  layout responsivo das telas internas + (opcional) runtime caching de dados.

### B. Capacitor (empacota o mesmo React num app nativo) — só taxa de loja

- Mesmo código React → gera **APK (Android)** e **IPA (iOS)** de verdade,
  publicáveis nas lojas.
- Reusa **~90%** do código (o mesmo bundle web roda dentro de um WebView
  nativo). Abre acesso a **câmera, biometria, push nativo** via plugins.
- **Custo = só as taxas de loja** (tabela abaixo). Precisa de **Mac** pra
  buildar o iOS.
- Melhor passo quando o beta virar produto e quiser estar nas lojas.

### C. React Native / Flutter (reescrever nativo) — meses de trabalho

- App nativo raiz, melhor performance/UX.
- **Reescreve o front do zero.** Só vale se mobile virar o produto principal e
  a web for secundária. Hoje **não é o caso.**

---

## 2. Custo de publicar nas lojas

| Loja | Custo | Nuance |
|---|---|---|
| **Google Play** | US$25 **uma vez** | Pagamento único, vale pra sempre. |
| **Apple App Store** | US$99 **por ano** | Recorrente. Precisa de **Mac** pra buildar. Review mais chato. |

Leitura: **Android é trivial** (US$25 vitalício). **iOS é o caro** (US$99/ano +
Mac). Confirmar valores na fonte antes de pagar — variam com o tempo.

---

## 3. Ordem recomendada

1. **Beta (agora):** PC/desktop. Não mexer em mobile. _(decisão do Gustavo)_
2. **Pós-beta, passo 1 — PWA polida:** fechar os buracos do §0 (marca, ícones,
   responsivo). Custo R$0, reusa tudo. Resolve "público é mobile" sem loja.
3. **Pós-beta, passo 2 — Capacitor:** entrar nas lojas quando justificar.
   Começar por **Android** (US$25 vitalício); **iOS** (US$99/ano + Mac) só
   quando o retorno pagar.
4. **Nativo (RN/Flutter):** só se mobile virar o produto principal. Não
   planejado.

---

## 4. Notas ligadas

- **Gesto "toque duplo na traseira do iPhone"** (achado do concorrente
  `the-box-app`): é recurso nativo do iOS (Acessibilidade → Toque Traseiro +
  app Atalhos), **PWA não intercepta**. Viável só instruindo o usuário a criar
  um Atalho que abre um deep-link do Pontes. Registrado no ROADMAP como P3.
- **Push notification:** o diferencial nativo real. Android via PWA já funciona;
  iOS só decente via Capacitor/nativo. Pesar isso quando push virar requisito.
