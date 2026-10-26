// Porteiro do admin no FRONT (defesa em profundidade; a barreira real é o servidor, que confere IsAdmin e conta
// Ativa a cada chamada). Decide ANTES de montar a tela de admin, que é carregada à parte (lazy): quem não é admin
// nunca baixa o código dela. Não-admin vai pra Visão geral sem mensagem (não confirma que a área existe).
// Mesmo padrão do AdminRoute do v1.
import type { ReactNode } from "react"
import { Navigate } from "react-router-dom"
import { useAuth } from "./useAuth"

export default function SoAdmin({ children }: { children: ReactNode }) {
  const { usuario } = useAuth()
  if (!usuario?.isAdmin) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
