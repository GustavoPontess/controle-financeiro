// Entrada do mini-app de admin (admin.html). Build à parte do app comum: nada daqui entra no pacote do app, e o app
// não sabe que isto existe. O endereço é o primeiro pedaço do caminho (o ADMIN_PATH do deploy; no dev, /admin):
// vira o basename do roteador, então este código também não guarda o endereço.
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import "../estilo/tokens.css"
import "../estilo/global.css"
import AuthProvider from "../auth/AuthProvider"
import AreaAdmin from "./AreaAdmin"

const base = `/${window.location.pathname.split("/")[1] ?? ""}`

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={base}>
      <AuthProvider>
        <AreaAdmin />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
