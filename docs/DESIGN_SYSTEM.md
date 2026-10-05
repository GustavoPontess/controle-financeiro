# Design System — Controle Financeiro

Sistema de design moderno e minimalista focado em usabilidade. Mantém a base existente mas com melhorias visuais, ícones de qualidade e gráficos mais bonitos.

---

## 📋 Paleta de Cores

### Cores Principais
```typescript
const colors = {
  // Neutras (grays)
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
  
  // Semânticas
  success: '#10b981',    // Verde (receitas, sucesso)
  error: '#ef4444',      // Vermelho (erros, despesas)
  warning: '#f59e0b',    // Amarelo (avisos, atenção)
  info: '#3b82f6',       // Azul (informações, parcelamentos)
  
  // Acentos
  accent: '#6366f1',     // Índigo (destaque, interações)
  muted: '#a1a1aa',      // Muted (secundário)
};
```

### Uso Prático
- **Primary (dark):** #111827 (botões primários, headers)
- **Secondary (light):** #f9fafb (backgrounds)
- **Text:** #374151 (body), #111827 (headings)
- **Borders:** #e5e7eb (padrão), #d1d5db (hover)
- **Success:** #10b981 (receitas, confirmações)
- **Error:** #ef4444 (despesas, erros críticos)

---

## 🔤 Tipografia

### Fontes (família)
- **Corpo e títulos do app:** `--pontes-font` (a fonte do tema, trocável em `/perfil`); `--pontes-font-heading` aponta pra ela.
- **Marca:** `--pontes-font-marca` (Fraunces) — só no título da página (Navbar) e no site público.

### Tamanho — escala central `--pontes-fs-*` (2026-10-05) ⭐
**Todo tamanho de letra sai de `controle-financeiro.web/src/components/pontes/styles/tokens.css`. Mudou lá, muda no app todo.**
Nunca escrever `font-size: 13px` num componente/tela — usar o token. Vitrine ao vivo: `/design-system` → aba Tokens.

**Escala (degraus que existem):** `2xs` 10 · `xs` 11 · `sm` 12 · `md` 13 · `base` 14 · `lg` 16 · `xl` 18 · `2xl` 20 · `3xl` 24 · `4xl` 28 · `5xl` 32 · `6xl` 40.

**Papéis (use o papel sempre que existir — é ele que muda tudo de uma vez):**

| Token | Papel | Valor |
|---|---|---|
| `--pontes-fs-rotulo` | rótulo MAIÚSCULO, cabeçalho de coluna | xs (11) |
| `--pontes-fs-linha` | texto de linha de tabela/lista (nome, valor, data) | sm (12) |
| `--pontes-fs-secundario` | linha de baixo (sub), ajuda e erro de campo, dica | xs (11) |
| `--pontes-fs-corpo` | texto corrido, descrição, mensagem de vazio | md (13) |
| `--pontes-fs-controle` | texto digitado/escolhido em campo, select, data | base (14) |
| `--pontes-fs-titulo-painel` | título de painel pequeno | 13.5 |
| `--pontes-fs-titulo-caixa` | título de caixa/tabela/seção ("Todas as transações", "Saldo nos últimos meses") | lg (16) — decidido 2026-10-05 (era 18 nas tabelas × 16 no Dashboard) |
| `--pontes-fs-titulo-modal` | título de modal/diálogo | 2xl (20) |
| `--pontes-fs-titulo-pagina` | título da página no topo (Navbar) | 2xl (20) |
| `--pontes-fs-stat-valor` | número do `PontesStatCard` | 22 |
| `--pontes-fs-valor-destaque` | valor grande dentro de card (saldo da carteira, fatura atual) | 4xl (28) |
| `--pontes-fs-hero-valor` | valor grande do hero de saldo | 38 |
| `--pontes-fs-hero-valor-duplo` | hero com DOIS valores lado a lado (Empréstimos) | 5xl (32) |
| `--pontes-fs-hero-numero` | números ao lado do hero (Entrou/Saiu/Sobrou) | 2xl (20) |
| `--pontes-fs-display` | chamada grande das telas de entrada (Login/Cadastro) | 6xl (40) |

**Fora da escala (fica em px, de propósito):** tamanho de ícone/glifo (não é texto), tamanho proporcional
calculado em runtime (`PontesAvatar`, `PontesBankBadge`), campo de dinheiro grande (`clamp`), dígito do OTP, e o
site público (landing tem tamanhos próprios).

**Trava automática:** `src/test/components/tipografiaTokens.test.ts` quebra se uma tela escrever QUALQUER tamanho
em px/rem, se um componente do DS escrever fora da lista de ícone/glifo, ou se usar um token que não existe.

**Estado da migração — COMPLETA (2026-10-05):**
- Componentes do DS (`src/components/pontes/`) ✅ — 114 tamanhos, sem mudança visual.
- Telas (`src/pages/` + `src/components/` fora do DS) ✅ — 325 tamanhos (+ 3 inline em HTML) pro token de MESMO
  valor (sem mudança visual, medido em 16 telas) + os 46 que estavam fora da escala PADRONIZADOS ("padroniza tudo",
  Gustavo): meio-tamanhos arredondados (12.5→12, 11.5/10.5→11, 9.5→10); 15→16; 22→`stat-valor`; heros de
  Limites/Metas/Contas Fixas → padrão 38/20; Empréstimos → `hero-valor-duplo`; 28/30 → `valor-destaque`;
  Login/Cadastro → `display`/`4xl`; desenho do cartão 19/21 → 18/20. Zero px/rem nas telas.
- Título de caixa = **16** (`titulo-caixa`): tabelas (Transações, Empréstimos, movimentos) desceram de 18;
  Dashboard, Ajustes, Categorias, Relatórios e Fatura passaram a usar o papel.
- CSS morto da Reconciliação (layouts antigos: `resultLinha`, `tag`, `notaDerivado`, `destaqueSub`…) apagado.
- Fora de propósito: site público, vitrine do DS, galerias DEV, rótulo de eixo dos gráficos (atributo SVG não
  lê `var()`), tamanho calculado em runtime (Logo/Avatar/BankBadge).

---

## 🎨 Componentes Core

### Botões
4 variantes mantidas, com refinamentos visuais:

```typescript
// primary: dark background, white text
// secondary: light background, dark text, subtle border
// danger: red background, para ações destrutivas
// ghost: transparent, minimal style
```

**Propriedades:**
- Border radius: `8px`
- Font weight: `600`
- Transição: `0.15s ease`
- Padding: `9px 18px` (medium default)

**Melhorias:**
- ✅ Adicionar ícones antes/depois do texto (usando Lucide)
- ✅ Estados de loading com spinner
- ✅ Ripple effect aprimorado

### Inputs & TextFields
Padrão minimalista com refinamentos:

```typescript
const inputSx = {
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  fontSize: '14px',
  '& .MuiOutlinedInput-root': {
    '& fieldset': { borderColor: '#e5e7eb' },
    '&:hover fieldset': { borderColor: '#d1d5db' },
    '&.Mui-focused fieldset': { borderColor: '#6366f1', borderWidth: '2px' },
  },
};
```

**Melhorias:**
- ✅ Suporte a ícones (prefix/suffix usando Lucide)
- ✅ Focus color mudou para accent (#6366f1)
- ✅ Label positioning refinado
- ✅ Helper text em gray-400 com ícone opcional

### Cards
Container padrão para dados:

```typescript
const cardSx = {
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
  padding: '16px',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
  transition: 'all 0.15s ease',
  
  '&:hover': {
    borderColor: '#d1d5db',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
  },
};
```

---

## 🎯 Ícones (Lucide Icons)

Usar **Lucide Icons** para consistência e qualidade.

**Imports:**
```typescript
import { 
  Eye, EyeOff,           // Campos de senha
  ChevronDown, ChevronUp, // Dropdowns, collapse
  Plus, Minus,           // Ações
  Trash2, Edit2,         // CRUD
  Check, X, AlertCircle, // Estados
  TrendingUp, TrendingDown, // Receita/Despesa
  DollarSign, PiggyBank, CreditCard, // Contas
  Calendar, Clock,       // Tempo
  Search, Filter,        // Busca/filtro
} from 'lucide-react';
```

**Tamanho padrão:** `20px` (16px em botões pequenos)
**Cor:** Herdar do parent (gray-600, gray-900, etc.)

---

## 📊 Gráficos (Recharts)

Usar **Recharts** para visualizações bonitas e responsivas.

### Padrão Base
```typescript
import {
  LineChart, Line,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// Default colors
const chartColors = {
  primary: '#6366f1',    // Accent
  success: '#10b981',    // Receita
  error: '#ef4444',      // Despesa
  warning: '#f59e0b',    // Destaque
};
```

### Exemplo: Gráfico de Receitas vs Despesas
```typescript
<ResponsiveContainer width="100%" height={300}>
  <BarChart data={data}>
    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
    <XAxis dataKey="mes" stroke="#9ca3af" />
    <YAxis stroke="#9ca3af" />
    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
    <Legend />
    <Bar dataKey="receita" fill="#10b981" radius={[8, 8, 0, 0]} />
    <Bar dataKey="despesa" fill="#ef4444" radius={[8, 8, 0, 0]} />
  </BarChart>
</ResponsiveContainer>
```

---

## 🎭 Tema Material-UI

Configurar tema global em `main.tsx` ou em um arquivo separado:

```typescript
import { createTheme, ThemeProvider } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: { main: '#111827' },
    secondary: { main: '#f9fafb' },
    success: { main: '#10b981' },
    error: { main: '#ef4444' },
    warning: { main: '#f59e0b' },
    info: { main: '#3b82f6' },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", sans-serif',
    h1: { fontSize: '28px', fontWeight: 700 },
    h2: { fontSize: '24px', fontWeight: 600 },
    body1: { fontSize: '14px', fontWeight: 400 },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: '8px',
          },
        },
      },
    },
  },
});

// Usage
<ThemeProvider theme={theme}>
  <App />
</ThemeProvider>
```

---

## 📐 Spacing & Layout

Sistema de spacing baseado em 4px:

```typescript
// Padding/Margin padrão
const spacing = {
  xs: '4px',    // 1
  sm: '8px',    // 2
  md: '16px',   // 4
  lg: '24px',   // 6
  xl: '32px',   // 8
  2xl: '48px',  // 12
};

// CSS Grid/Flexbox
gap: '16px',    // Padrão entre elementos
marginBottom: '24px',  // Separação entre seções
```

---

## 🌟 Sombras & Elevação

```typescript
const shadows = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px rgba(0, 0, 0, 0.07)',
  lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px rgba(0, 0, 0, 0.1)',
};

// Uso
boxShadow: shadows.sm,  // Cards padrão
```

---

## 🎬 Animações & Transições

```typescript
// Transições padrão
transition: '0.15s ease',  // Estados (hover, focus)
transition: '0.3s ease',   // Movimentos (slide, fade)

// Exemplos
// Botão hover
'&:hover': { 
  backgroundColor: '#1f2937',
  transform: 'translateY(-1px)',
  transition: '0.15s ease'
}

// Modal appear
animation: '$slideIn 0.3s ease',
```

---

## ✅ Checklist para Novos Componentes

Quando criar um novo componente, seguir:

- [ ] Usar cores da paleta (nunca hard-code cores)
- [ ] Aplicar spacing com valores padrão
- [ ] Usar Lucide Icons para ícones
- [ ] Adicionar transições/hover states
- [ ] Testar a/dark mode se aplicável
- [ ] Documentar props e exemplos
- [ ] Seguir naming conventions (PascalCase)
- [ ] Usar TypeScript com tipos explícitos

---

## 📦 Dependências Necessárias

```bash
npm install lucide-react recharts
```

**Já instaladas:**
- @mui/material
- @mui/icons-material
- react-router-dom
- axios

---

## 🚀 Próximos Passos

1. Aplicar tema global em `main.tsx`
2. Refatorar componentes existentes com novos ícones
3. Criar componentes de gráficos nas páginas de analytics
4. Melhorar inputs com ícones e validação visual
5. Adicionar animações de transição entre páginas

---

**Última atualização:** 2026-05-07  
**Responsável:** Design System v1.0

---

## 📏 Densidade — padrão compacto das telas internas (2026-10-02)

**Regra:** toda tela autenticada segue o padrão **denso** já aplicado em Transações, Reconciliação e
Empréstimos. Tela nova nasce assim; tela antiga migra **uma por vez** (fila no `ROADMAP.md`). Os números
abaixo foram tirados do CSS real dessas três telas — é a referência, não uma sugestão.

| Item | Padrão denso | Como estava nas telas grandes |
|---|---|---|
| Título da página | **só no Navbar** (20px). Não repetir `h1` no corpo | h1 de 24–30px no corpo |
| Espaço entre blocos | 12–16px | 24px |
| Caixa / card | raio 14 · padding 14px 16px (painel) ou 12px (card pequeno) | raio 16–18 · padding 20–24px |
| Banda de cabeçalho da caixa | padding 10px 16px | 18px 24px |
| Título de caixa | `--pontes-fs-titulo-caixa` (16px, era 18 — 2026-10-05)/600 na fonte de título (`--pontes-font-heading` = a fonte do tema; a Fraunces (`--pontes-font-marca`) ficou só no título da página no Navbar e no site público — decisão 2026-10-04/05), ou 13.5px/700 em painel pequeno | 16px/700 |
| Texto de linha | 12px (nome 600; número 700 `tabular-nums`) | 14–15px |
| Texto secundário | 11px (sub da linha) · 12px (descrição) | 12–14px |
| Label / cabeçalho de coluna | 11px · 700 · MAIÚSCULAS · tracking 0.08em · `text-muted` | 12px |
| Linha de tabela/lista | padding 11px 16px (20px nas bordas) → ~40–44px de altura | 14px 24px → ~66px |
| Ícone/avatar da linha | 34×34 · raio 9 · ícone 17px | 38–42px |
| Controles de toolbar | 32px de altura · raio 10 | 37–42px |
| Botão | `size="sm"` · botão de ícone `size={32}` | md / 40px |
| Badge | `size="sm"` (11px) | md (12px) |
| Shell | header 60px · `main` padding 20px 24px · página até 1800px | header 64 · padding 28 · 1480px |

**Exceção deliberada — o hero de saldo** continua grande: valor 38px/800 (32px quando há dois valores lado
a lado), padding 24–32px, raio 20. É o único bloco "grande" da tela.

**Proibido no padrão denso:** subtítulo explicativo embaixo de título de seção; `h1` repetindo o Navbar;
card com hover de "levantar" quando não é clicável; mais de uma altura de barra de progresso na mesma tela.

**Lista de itens = `PontesTabela`** (só passar parâmetros). Tela de gráficos/cards não precisa de tabela,
só dos tamanhos acima.
