import { createTheme } from '@mui/material/styles'
import { tokens } from './tokens'

export const theme = createTheme({
  palette: {
    primary: {
      main: tokens.color.brand.primary,
      dark: tokens.color.brand.hover,
      light: tokens.color.brand.subtle,
      contrastText: '#ffffff',
    },
    background: {
      default: tokens.color.background.page,
      paper: tokens.color.background.surface,
    },
    text: {
      primary: tokens.color.text.primary,
      secondary: tokens.color.text.secondary,
      disabled: tokens.color.text.disabled,
    },
    divider: tokens.color.border.default,
    success: {
      main: tokens.color.status.success.main,
      light: tokens.color.status.success.light,
      dark: tokens.color.status.success.dark,
    },
    error: {
      main: tokens.color.status.error.main,
      light: tokens.color.status.error.light,
      dark: tokens.color.status.error.dark,
    },
    warning: {
      main: tokens.color.status.warning.main,
      light: tokens.color.status.warning.light,
      dark: tokens.color.status.warning.dark,
    },
    info: {
      main: tokens.color.status.info.main,
      light: tokens.color.status.info.light,
      dark: tokens.color.status.info.dark,
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
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          border: `1px solid ${tokens.color.border.default}`,
          borderRadius: tokens.radius.lg,
        },
      },
    },
    MuiCard: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          border: `1px solid ${tokens.color.border.default}`,
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
            backgroundColor: tokens.color.brand.hover,
            boxShadow: 'none',
          },
        },
        outlinedPrimary: {
          '&:hover': {
            backgroundColor: tokens.color.brand.subtle,
          },
        },
        textPrimary: {
          '&:hover': {
            backgroundColor: tokens.color.brand.subtle,
          },
        },
      },
    },
  },
})

export default theme
