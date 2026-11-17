import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import "./estilo/tokens.css"
import "./estilo/global.css"
import AuthProvider from "./auth/AuthProvider"
import App from "./App"
import { acompanharCorDaBarra, registrarServiceWorker } from "./pwa/registrar"

// App instalável (PWA): o worker e a cor da barra do celular.
registrarServiceWorker()
acompanharCorDaBarra()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
