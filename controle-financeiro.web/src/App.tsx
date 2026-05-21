import { ThemeProvider, CssBaseline } from '@mui/material'
import AppRoutes from "./routes/AppRoutes"
import { AuthProvider } from "./contexts/AuthContext"
import { theme } from "./theme/theme"
import { PontesThemeProvider } from "./components/pontes"

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <PontesThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </PontesThemeProvider>
    </ThemeProvider>
  )
}

export default App
