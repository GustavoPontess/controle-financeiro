/**
 * _globalStyles — injeção idempotente de regras CSS globais da biblioteca Pontes.
 *
 * Classes disponíveis (aplicar via className em qualquer elemento clicável):
 *  - `.pontes-clickable` — transition + hover (brightness/translateY) + active (deprime)
 *    + focus-visible (anel) + disabled (neutraliza)
 *  - `.pontes-link-hover` — sublinha + opacity no hover (pra anchors)
 *
 * Componentes Pontes chamam `ensurePontesGlobalStyles()` no mount.
 * Idempotente: só injeta uma vez por document.
 */

const STYLE_TAG_ID = "pontes-global-styles"

const CSS = `
/* Mesh gradient blob animation (footer, heroes, CTAs) — amplitude visível */
@keyframes pontes-mesh-move {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(60px, -40px) scale(1.15); }
  50% { transform: translate(-30px, 50px) scale(0.9); }
  75% { transform: translate(40px, 30px) scale(1.08); }
}
.pontes-noise {
  position: absolute; inset: 0; pointer-events: none; opacity: 0.05;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' /%3E%3C/svg%3E");
}

/* Scroll suave + scrollbar com cor forte da paleta (--pontes-scroll-thumb),
   track transparente. Overlay sobre o conteúdo via scrollbar-gutter. */
html {
  scroll-behavior: smooth;
}
* {
  scrollbar-width: thin;
  scrollbar-color: var(--pontes-scroll-thumb, #64748b) transparent;
}
*::-webkit-scrollbar {
  width: 8px;
  height: 8px;
  background: transparent;
}
*::-webkit-scrollbar-track {
  background: transparent;
  border: none;
}
*::-webkit-scrollbar-corner {
  background: transparent;
}
*::-webkit-scrollbar-thumb {
  background: var(--pontes-scroll-thumb, #64748b);
  border-radius: 999px;
  border: none;
  transition: background 150ms ease;
}
*::-webkit-scrollbar-thumb:hover {
  background: var(--pontes-scroll-thumb-hover, #475569);
}

/*
 * Generic clickable hover. Cores vêm do componente via CSS vars:
 *  --pontes-hover-bg: cor de background no hover (paleta runtime)
 *  --pontes-hover-text: cor texto opcional no hover
 *  --pontes-hover-border: cor border opcional (variant outline)
 * Fallback se var não definida: brightness + lift sutil.
 */
.pontes-clickable {
  transition:
    background-color 150ms ease, color 150ms ease, border-color 150ms ease,
    transform 150ms ease, box-shadow 200ms ease, filter 150ms ease !important;
}
.pontes-clickable:not(:disabled):hover {
  background-color: var(--pontes-hover-bg) !important;
  color: var(--pontes-hover-text, inherit) !important;
  border-color: var(--pontes-hover-border, inherit) !important;
  transform: translateY(-2px);
  box-shadow: 0 10px 24px -8px rgba(0, 0, 0, 0.25);
}
.pontes-clickable:not(:disabled):active {
  transform: translateY(0);
  filter: brightness(0.92);
  box-shadow: 0 2px 6px -2px rgba(0, 0, 0, 0.18);
}

/* Outline / ghost / danger-outline / *-light: active vira cor forte momentaneamente.
   Vars --pontes-active-bg/text/border setadas pelo componente. Não persiste — só enquanto pressionado. */
.pontes-clickable[data-pontes-variant="outline"]:not(:disabled):active,
.pontes-clickable[data-pontes-variant="outline-light"]:not(:disabled):active,
.pontes-clickable[data-pontes-variant="danger-outline"]:not(:disabled):active,
.pontes-clickable[data-pontes-variant="ghost"]:not(:disabled):active,
.pontes-clickable[data-pontes-variant="ghost-light"]:not(:disabled):active {
  background-color: var(--pontes-active-bg) !important;
  color: var(--pontes-active-text) !important;
  border-color: var(--pontes-active-border) !important;
  filter: none;
}

/* Variante sem lift (button group joined, segmented, dentro de container colado) */
.pontes-clickable.pontes-no-lift:not(:disabled):hover {
  transform: none !important;
  box-shadow: none !important;
}
.pontes-clickable.pontes-no-lift:not(:disabled):active {
  transform: none !important;
}
.pontes-clickable:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}
.pontes-clickable[disabled],
.pontes-clickable:disabled {
  filter: none !important;
  transform: none !important;
  box-shadow: none !important;
  background-color: inherit !important;
  color: inherit !important;
}

/*
 * Link anchor hover. Cor vem do componente via:
 *  --pontes-hover-color: cor texto no hover
 *  --pontes-hover-bg: cor de fundo opcional (default: rgba sutil)
 */
.pontes-link-hover {
  transition: color 150ms ease, opacity 150ms ease, background-color 150ms ease, text-decoration-color 150ms ease;
  position: relative;
}
.pontes-link-hover:not(:disabled):hover {
  color: var(--pontes-hover-color, currentColor) !important;
  opacity: 1 !important;
  background-color: var(--pontes-hover-bg, transparent);
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 6px;
}

/*
 * NavLink: link de menu de nav com underline animado via pseudo ::after.
 * Texto NÃO desloca — o sublinhado é absolute embaixo, anima width 0 → 100%.
 * Vars do componente:
 *   --pontes-navlink-color: cor texto base
 *   --pontes-navlink-hover: cor underline + texto no hover
 */
.pontes-navlink {
  position: relative;
  background: transparent;
  border: none;
  padding: 6px 2px 8px;
  cursor: pointer;
  color: var(--pontes-navlink-color, inherit);
  transition: color 200ms ease;
  font-weight: 500;
  display: inline-block;
}
.pontes-navlink[data-pontes-active="true"] {
  font-weight: 700;
  color: var(--pontes-navlink-hover, inherit);
}
.pontes-navlink::after {
  content: "";
  position: absolute;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: 0;
  height: 2px;
  background-color: var(--pontes-navlink-hover, currentColor);
  transition: width 220ms cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 1px;
}
.pontes-navlink[data-pontes-active="true"]::after,
.pontes-navlink:not(:disabled):hover::after {
  width: 100%;
}
.pontes-navlink:not(:disabled):hover {
  color: var(--pontes-navlink-hover, currentColor);
}
`

export function ensurePontesGlobalStyles(): void {
  if (typeof document === "undefined") return
  let tag = document.getElementById(STYLE_TAG_ID) as HTMLStyleElement | null
  if (!tag) {
    tag = document.createElement("style")
    tag.id = STYLE_TAG_ID
    document.head.appendChild(tag)
  }
  // Sempre atualiza conteúdo — garante que HMR pega mudanças deste arquivo
  // mesmo que tag já tenha sido injetado em load anterior.
  if (tag.textContent !== CSS) tag.textContent = CSS
}

/**
 * Aplica a cor forte da scrollbar (paleta) + o fundo da página.
 * Chame quando a paleta mudar.
 *
 * @param primaryHex cor do thumb (geralmente p.primary) — sólida, forte.
 * @param pageBg cor de fundo da página (geralmente p.bg) — body, pra track transparente mostrar a página.
 */
export function applyPontesScrollbar(primaryHex: string, pageBg?: string): void {
  if (typeof document === "undefined") return
  const root = document.documentElement
  root.style.setProperty("--pontes-scroll-thumb", primaryHex)
  root.style.setProperty("--pontes-scroll-thumb-hover", primaryHex)
  if (pageBg) document.body.style.background = pageBg
}

// Injeta imediato no module-load — garante CSS disponível antes do primeiro render
// dos componentes Pontes (não depende de useEffect rodar).
ensurePontesGlobalStyles()
