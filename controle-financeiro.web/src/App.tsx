import AppRoutes from "./routes/AppRoutes"
import { AuthProvider } from "./contexts/AuthContext"
import { PontesThemeProvider } from "./components/pontes"

function App() {
  return (
    <PontesThemeProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </PontesThemeProvider>
  )
}

export default App
