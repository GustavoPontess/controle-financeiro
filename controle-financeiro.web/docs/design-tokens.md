# Design Tokens — Controle Financeiro

Tokens extraídos do Monarch Money e adaptados para o projeto. Fonte canônica: `src/theme/tokens.ts`.

## Origem

Tokens derivados das CSS custom properties do dashboard do Monarch Money (Issue #60, sub-task 3). A fonte de referência de tipografia usa as fontes proprietárias Oracle e Copernicus — substituídas por **Inter** (sans-serif) como fallback open-source.

---

## Paleta

### Marca

| Token | Valor | Uso |
|-------|-------|-----|
| `brand.primary` | `#ff692d` | CTAs, links ativos, indicadores |
| `brand.hover` | `#f35b16` | Estado hover do primário |
| `brand.subtle` | `#ffe9de` | Fundo de chips/badges da marca |

### Backgrounds

| Token | Valor | Uso |
|-------|-------|-----|
| `background.page` | `#f6f5f3` | Fundo da página (`palette.background.default`) |
| `background.surface` | `#ffffff` | Cards, modais, painéis (`palette.background.paper`) |
| `background.hover` | `#fbfaf8` | Hover em itens de lista |
| `background.secondary` | `#f6f5f3` | Seções secundárias |
| `background.tertiary` | `#ebe8e5` | Áreas de contraste leve |

### Texto e Bordas

| Token | Valor | Uso |
|-------|-------|-----|
| `text.primary` | `#22201d` | Texto principal |
| `text.secondary` | `#777573` | Texto auxiliar, labels |
| `text.disabled` | `#bebbb8` | Elementos desabilitados |
| `border.subtle` | `#e4e1de` | Divisores, bordas leves |
| `border.strong` | `#bebbb8` | Bordas com maior contraste |

### Status

| | main | light | dark |
|--|------|-------|------|
| **success** | `#30a46c` | `#e6f6eb` | `#218358` |
| **error** | `#e5484d` | `#feebec` | `#ce2c31` |
| **warning** | `#ffc53d` | `#fff7c2` | `#ab6400` |
| **info** | `#00a2c7` | `#def7f9` | `#107d98` |

---

## Tipografia

**Família:** `"Inter", system-ui, sans-serif` (primária) · `"ui-monospace", monospace` (código)

| Token | Tamanho |
|-------|---------|
| `fontSize.2xs` | 10px |
| `fontSize.xs` | 12px |
| `fontSize.sm` | 14px |
| `fontSize.base` | 16px |
| `fontSize.lg` | 18px |
| `fontSize.xl` | 24px |
| `fontSize.2xl` | 30px |
| `fontSize.3xl` | 40px |

**Pesos:** book `400` · medium `500` · bold `600`  
**Line-height:** `1.5` (todas as escalas)

---

## Espaçamento

| Token | px |
|-------|----|
| `2xs` | 4 |
| `xs` | 8 |
| `sm` | 12 |
| `md` | 14 |
| `default` | 16 |
| `lg` | 20 |
| `xl` | 24 |
| `2xl` | 32 |
| `3xl` | 48 |
| `4xl` | 64 |

---

## Raios de Borda

| Token | Valor | Uso |
|-------|-------|-----|
| `none` | 0px | |
| `xs` | 4px | Chips pequenos |
| `sm` | 6px | Inputs, badges |
| `md` | 8px | Botões secundários |
| `lg` | 12px | Cards, Paper (padrão MUI) |
| `xl` | 16px | Modais, drawers |
| `pill` | 500px | Botões primários |

---

## Sombras

| Token | Valor |
|-------|-------|
| `sm` | `0px 1px 2px rgba(34,32,29,0.05)` |
| `md` | `0px 2px 4px rgba(34,32,29,0.1)` |
| `card` | `0px 2px 4px rgba(34,32,29,0.1)` |
| `lg` | `0px 3px 6px rgba(34,32,29,0.1)` |

---

## Sidebar

| Estado | Largura |
|--------|---------|
| Colapsada | `52px` |
| Expandida | `224px` |

---

## Como Usar

### Via tokens diretos (fora do tema MUI)

```tsx
import { tokens } from '@/theme/tokens'

<Box sx={{ borderRadius: tokens.radius.lg, boxShadow: tokens.shadow.card }} />
```

### Via tema MUI (preferido dentro de `sx`)

```tsx
// Usa os valores mapeados no theme.ts automaticamente
<Box sx={{ bgcolor: 'background.default', color: 'text.secondary', borderColor: 'divider' }} />
```

### ThemeProvider

O tema já está configurado em `src/App.tsx` via `<ThemeProvider theme={theme}>`. Todos os componentes MUI herdam os tokens automaticamente.

---

> Gerado em 2026-05-18 via Issue #60 sub-task 3.
