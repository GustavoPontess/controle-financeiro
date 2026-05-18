/**
 * Design tokens extraídos do Monarch Money (Issue #60, sub-task 3).
 * Fonte: docs/features/redesign-ux/monarch-session/
 */

export const tokens = {
  color: {
    // PLACEHOLDER — cor de marca provisória (teal). Trocar quando a
    // identidade visual for definida. Todo o app deriva daqui
    // (tokens.ts -> theme.ts -> componentes): mudar estes 3 valores propaga.
    // Não usar o laranja do Monarch (#ff692d) — é marca registrada deles.
    brand: {
      primary: '#0d9488',
      hover: '#0f766e',
      subtle: '#ccfbf1',
    },
    background: {
      page: '#f6f5f3',
      surface: '#ffffff',
      hover: '#fbfaf8',
      secondary: '#f6f5f3',
      tertiary: '#ebe8e5',
    },
    text: {
      primary: '#22201d',
      secondary: '#777573',
      disabled: '#bebbb8',
    },
    border: {
      subtle: '#e4e1de',
      default: '#e4e1de',
      strong: '#bebbb8',
    },
    status: {
      success: {
        main: '#30a46c',
        light: '#e6f6eb',
        dark: '#218358',
      },
      error: {
        main: '#e5484d',
        light: '#feebec',
        dark: '#ce2c31',
      },
      warning: {
        main: '#ffc53d',
        light: '#fff7c2',
        dark: '#ab6400',
      },
      info: {
        main: '#00a2c7',
        light: '#def7f9',
        dark: '#107d98',
      },
    },
  },
  radius: {
    none: '0px',
    xs: '4px',
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    pill: '500px',
  },
  shadow: {
    sm: '0px 1px 2px rgba(34,32,29,0.05)',
    md: '0px 2px 4px rgba(34,32,29,0.1)',
    card: '0px 2px 4px rgba(34,32,29,0.1)',
    lg: '0px 3px 6px rgba(34,32,29,0.1)',
  },
  spacing: {
    '2xs': 4,
    xs: 8,
    sm: 12,
    md: 14,
    default: 16,
    lg: 20,
    xl: 24,
    '2xl': 32,
    '3xl': 48,
    '4xl': 64,
  },
  typography: {
    fontFamily: {
      primary: '"Inter", system-ui, sans-serif',
      mono: '"ui-monospace", monospace',
    },
    fontSize: {
      '2xs': '10px',
      xs: '12px',
      sm: '14px',
      base: '16px',
      lg: '18px',
      xl: '24px',
      '2xl': '30px',
      '3xl': '40px',
    },
    fontWeight: {
      book: 400,
      medium: 500,
      bold: 600,
    },
    lineHeight: {
      default: 1.5,
    },
  },
  sidebar: {
    collapsedWidth: '52px',
    expandedWidth: '224px',
  },
  transition: {
    default: 'all .1s ease-out',
    fast: 'all .15s cubic-bezier(.4, 0, .2, 1)',
  },
} as const
