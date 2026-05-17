import { createTheme } from '@mui/material/styles'

export function getTheme(mode: 'light' | 'dark') {
  return createTheme({
    palette: {
      mode,
      ...(mode === 'light'
        ? {
            background: { default: '#f5f6fa', paper: '#ffffff' },
            text: { primary: '#111827', secondary: '#6b7280' },
            divider: '#e5e7eb',
          }
        : {
            background: { default: '#0f1117', paper: '#1a1d23' },
            text: { primary: '#f1f5f9', secondary: '#94a3b8' },
            divider: '#2d3748',
          }),
    },
    typography: {
      fontFamily: 'Inter, system-ui, sans-serif',
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { overflow: 'hidden' },
        },
      },
    },
  })
}
