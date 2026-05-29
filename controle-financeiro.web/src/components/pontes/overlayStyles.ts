/**
 * Tema da scrollbar overlay (overlayscrollbars) — injeção idempotente.
 * Compartilhado entre useBodyScrollbar e PontesScrollArea.
 */

const OS_STYLE_ID = "pontes-os-styles"

const OS_CSS = `
.os-theme-pontes {
  --os-handle-bg: var(--pontes-os-thumb, color-mix(in srgb, var(--pontes-text-muted) 35%, transparent));
  --os-handle-bg-hover: var(--pontes-os-thumb, color-mix(in srgb, var(--pontes-text-muted) 60%, transparent));
  --os-handle-bg-active: var(--pontes-os-thumb, color-mix(in srgb, var(--pontes-text-muted) 70%, transparent));
  --os-size: 8px;
  --os-padding-perpendicular: 2px;
  --os-padding-axis: 2px;
  --os-handle-border-radius: 999px;
  --os-handle-min-size: 44px;
}
.os-theme-pontes:hover { --os-size: 10px; }
.os-theme-pontes .os-scrollbar-handle { opacity: .75; transition: opacity .15s ease; }
.os-theme-pontes:hover .os-scrollbar-handle { opacity: 1; }
.os-theme-pontes .os-scrollbar-track { background: transparent; }
`

export function ensurePontesOverlayStyles(): void {
  if (typeof document === "undefined") return
  let tag = document.getElementById(OS_STYLE_ID) as HTMLStyleElement | null
  if (!tag) {
    tag = document.createElement("style")
    tag.id = OS_STYLE_ID
    document.head.appendChild(tag)
  }
  if (tag.textContent !== OS_CSS) tag.textContent = OS_CSS
}
