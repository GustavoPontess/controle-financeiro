// Só entra logado; enquanto o /auth/me responde, uma tela neutra (sem pulo pro login).
import type { ReactNode } from "react"
import { Navigate } from "react-router-dom"
import { useAuth } from "./useAuth"
import { useTema } from "../layout/useTema"

export default function Protegido({ children }: { children: ReactNode }) {
  const { autenticado, carregando } = useAuth()
  const [tema] = useTema()
  if (carregando) return <div className="v2" data-tema={tema} style={{ minHeight: "100vh", background: "var(--v2-bg)" }} />
  if (!autenticado) return <Navigate to="/entrar" replace />
  return <>{children}</>
}
