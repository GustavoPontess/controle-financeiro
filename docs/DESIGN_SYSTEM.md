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

### Fontes
- **Display:** `"Dm Sans"` ou `"Poppins"` (bold, para headers)
- **Body:** `"Inter"` (regular, para textos)

### Escala
```typescript
const typography = {
  h1: { fontSize: '28px', fontWeight: 700, lineHeight: 1.2 },  // Page titles
  h2: { fontSize: '24px', fontWeight: 600, lineHeight: 1.3 },  // Section titles
  h3: { fontSize: '20px', fontWeight: 600, lineHeight: 1.3 },  // Subheadings
  h4: { fontSize: '16px', fontWeight: 600, lineHeight: 1.4 },  // Small headings
  body: { fontSize: '14px', fontWeight: 400, lineHeight: 1.5 }, // Body text
  caption: { fontSize: '12px', fontWeight: 400, lineHeight: 1.4 }, // Labels, captions
  code: { fontSize: '13px', fontFamily: 'Monospace' },          // Code
};
```

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

O MUI foi removido no #166: campos são `PontesField` + `PontesInput` (e demais controles de `@/components/pontes`), estilizados por CSS Modules + `var(--pontes-*)`.

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

### Listas, dinheiro em formulário e confirmação (biblioteca Pontes)

Todos importados de `@/components/pontes`; demo ao vivo em `/design-system`.

| Componente | O que é | Quando usar |
|---|---|---|
| `PontesListItem` / `PontesList` | Linha padrão das listas internas (ícone · título + status · meta · valor · ⋮) e o `<ul>` que as agrupa | Toda lista de itens de uma entidade (conta fixa, parcelamento…). Status só quando foge do normal; meta = uma linha de fatos em texto |
| `PontesListPage` | Tela de lista inteira da receita `pontes-telas`: cabeçalho → resumo → busca + filtros → esqueleto / erro / vazio / lista + paginação | Qualquer tela (ou aba, com `embutida`) de lista; o estado vem do `useListaPaginada` (busca, filtro e paginação no servidor) |
| `PontesMoneyField` | Campo de dinheiro de formulário, mesma altura do `PontesInput`, prefixo "R$", valor `number \| undefined` | Dinheiro dentro de formulário. O `PontesMoneyInput` é o campo grande de destaque (valor principal de um lançamento) |

**`PontesDialog` aceita `onConfirm` assíncrono:** se devolver uma Promise, o botão de confirmar fica em "carregando" (sem clique duplo, sem fechar por Cancelar/Esc/fundo) até ela terminar. Quem fecha o diálogo continua sendo a tela.

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

## 🎭 Tema

O MUI foi removido no #166 — não há mais tema Material-UI. O tema agora é o `PontesThemeProvider` (`src/components/pontes/ThemeProvider.tsx`, tokens em `theme.ts`), que injeta as `var(--pontes-*)` lidas pelos componentes e pelos `*.module.css`.

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

**Já instaladas** (`@mui/*` removido no #166):
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
