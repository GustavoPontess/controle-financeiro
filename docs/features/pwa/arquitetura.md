---
feature: pwa
issue: '#28'
status: EM_IMPLEMENTACAO
owner: Gustavo
created: 2026-05-18
---

# Feature — PWA instalável + offline básico

Spec técnica da Issue #28 (Bloco D — Retenção e UX B2C). Feature 100% frontend.

Entrega: o app vira um PWA — instalável na tela inicial, com manifest, ícones e
Service Worker que cacheia o shell para abrir offline.

---

## 1. Componentes

### Manifest + Service Worker
Via `vite-plugin-pwa` (Workbox por baixo):
- `registerType: 'autoUpdate'` — SW novo assume sozinho.
- `generateSW` precacheia o build (JS/CSS/HTML) — o shell abre offline.
- Manifest: nome, ícones, `theme_color`, `display: standalone`, `start_url: /`.

### Ícone
`public/icon.svg` — ícone vetorial do app, usado no manifest (`purpose: any`)
e como `apple-touch-icon`. SVG escala em qualquer densidade.

### Prompt de instalação
Componente `InstallPrompt`: captura o evento `beforeinstallprompt`, guarda-o e
mostra um botão "Adicionar à tela inicial". Só aparece **a partir da 2ª
sessão** — contador de sessões no `localStorage`. Dispensar esconde de vez.

---

## 2. Offline

O Workbox precacheia o shell no install do SW. Telas já visitadas abrem sem
rede (HTML/JS/CSS vêm do cache). Dados de API **não** são cacheados nesta
entrega — offline é só de visualização do shell. Cache de dados (runtime
caching de GETs) fica para depois.

---

## 3. Regras

- `start_url` e `scope` = `/`.
- Atualização de versão: `autoUpdate` — sem prompt de "nova versão".
- O prompt de instalação respeita a decisão do usuário (dispensou = não volta).
- Sem ícones PNG binários nesta entrega — SVG cobre instalação na maioria dos
  navegadores; PNG maskable pode ser adicionado depois.

---

## 4. Etapas de implementação

1. Spec + `vite-plugin-pwa` instalado e configurado (manifest + SW) + ícone
   SVG + metatags no `index.html`
2. Componente `InstallPrompt` (evento `beforeinstallprompt`, exibe a partir da
   2ª sessão) montado no layout
3. Build de produção verde + validação do manifest/SW gerados
