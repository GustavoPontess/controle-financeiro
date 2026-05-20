import { createTheme } from '@mui/material/styles'
import { tokens, darkTokens } from './tokens'

export type ThemeMode = 'light' | 'dark'

export function createAppTheme(mode: ThemeMode = 'light') {
  const c = mode === 'dark' ? darkTokens.color : tokens.color

  return createTheme({
    palette: {
      mode,
      primary: {
        main: c.brand.primary,
        dark: c.brand.hover,
        light: c.brand.subtle,
        contrastText: '#ffffff',
      },
      background: {
        default: c.background.page,
        paper: c.background.surface,
      },
      text: {
        primary: c.text.primary,
        secondary: c.text.secondary,
        disabled: c.text.disabled,
      },
      divider: c.border.default,
      success: {
        main: c.status.success.main,
        light: c.status.success.light,
        dark: c.status.success.dark,
      },
      error: {
        main: c.status.error.main,
        light: c.status.error.light,
        dark: c.status.error.dark,
      },
      warning: {
        main: c.status.warning.main,
        light: c.status.warning.light,
        dark: c.status.warning.dark,
      },
      info: {
        main: c.status.info.main,
        light: c.status.info.light,
        dark: c.status.info.dark,
      },
    },
    typography: {
      fontFamily: tokens.typography.fontFamily.primary,
      fontWeightRegular: tokens.typography.fontWeight.book,
      fontWeightMedium: tokens.typography.fontWeight.medium,
      fontWeightBold: tokens.typography.fontWeight.bold,
      h1: { fontSize: tokens.typography.fontSize['3xl'], lineHeight: tokens.typography.lineHeight.default },
      h2: { fontSize: tokens.typography.fontSize['2xl'], lineHeight: tokens.typography.lineHeight.default },
      h3: { fontSize: tokens.typography.fontSize.xl, lineHeight: tokens.typography.lineHeight.default },
      h4: { fontSize: tokens.typography.fontSize.lg, lineHeight: tokens.typography.lineHeight.default },
      h5: { fontSize: tokens.typography.fontSize.base, lineHeight: tokens.typography.lineHeight.default },
      h6: { fontSize: tokens.typography.fontSize.sm, lineHeight: tokens.typography.lineHeight.default },
      body1: { fontSize: tokens.typography.fontSize.base, lineHeight: tokens.typography.lineHeight.default },
      body2: { fontSize: tokens.typography.fontSize.sm, lineHeight: tokens.typography.lineHeight.default },
      caption: { fontSize: tokens.typography.fontSize.xs, lineHeight: tokens.typography.lineHeight.default },
      overline: { fontSize: tokens.typography.fontSize['2xs'], lineHeight: tokens.typography.lineHeight.default },
    },
    shape: {
      borderRadius: parseInt(tokens.radius.lg, 10),
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ':root': {
            '--app-bg': c.background.page,
            '--surface-bg': c.background.surface,
            '--sidebar-bg': c.background.page,
            '--text-primary': c.text.primary,
            '--text-secondary': c.text.secondary,
            '--border-default': c.border.default,
            '--hover-bg': c.background.tertiary,
            '--avatar-bg': mode === 'dark' ? '#3d3b38' : '#111827',
          },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            border: `1px solid ${c.border.default}`,
            borderRadius: tokens.radius.lg,
          },
        },
      },
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            border: `1px solid ${c.border.default}`,
            borderRadius: tokens.radius.lg,
            boxShadow: tokens.shadow.card,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: tokens.radius.pill,
            fontWeight: tokens.typography.fontWeight.medium,
            textTransform: 'none',
            transition: tokens.transition.fast,
          },
          containedPrimary: {
            '&:hover': {
              backgroundColor: c.brand.hover,
              boxShadow: 'none',
            },
          },
          outlinedPrimary: {
            '&:hover': { backgroundColor: c.brand.subtle },
          },
          textPrimary: {
            '&:hover': { backgroundColor: c.brand.subtle },
          },
        },
      },
    },
  })
}

export default createAppTheme('light')
