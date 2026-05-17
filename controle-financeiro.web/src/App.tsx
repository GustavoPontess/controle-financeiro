import { ThemeProvider, CssBaseline } from "@mui/material"
import AppRoutes from "./routes/AppRoutes"
import { AuthProvider } from "./contexts/AuthContext"
import { ThemeContextProvider, useThemeContext } from "./contexts/ThemeContext"
import { getTheme } from "./styles/muiTheme"

function AppWithTheme() {
  const { mode } = useThemeContext()
  return (
    <ThemeProvider theme={getTheme(mode)}>
      <CssBaseline />
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  )
}

function App() {
  return (
    <ThemeContextProvider>
      <AppWithTheme />
    </ThemeContextProvider>
  )
}

export default App
