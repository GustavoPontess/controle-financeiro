// Só entra logado; enquanto o /auth/me responde, uma tela neutra (sem pulo pro login).
import type { ReactNode } from "react"
import { Navigate } from "react-router-dom"
import { useAuth } from "./useAuth"

export default function Protegido({ children }: { children: ReactNode }) {
  const { autenticado, carregando } = useAuth()
  if (carregando) return <div className="v2" style={{ minHeight: "100vh" }} />
  if (!autenticado) return <Navigate to="/entrar" replace />
  return <>{children}</>
}
