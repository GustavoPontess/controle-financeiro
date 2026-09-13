import { Navigate } from "react-router-dom"
import { PontesLoadingDots } from "@/components/pontes"
import { useAuth } from "../../hooks/useAuth"

/**
 * Gate de admin no FRONT (defesa em profundidade — a fronteira real é o backend: policy IsAdmin
 * revalidada no banco a cada request). Decide ANTES de montar/baixar o painel, lendo `isAdmin` do
 * usuário logado (vem do /auth/me) — **sem importar o `adminService`**, pra os endpoints do admin
 * NÃO entrarem no bundle principal. Só o chunk lazy do painel (renderizado no caso "ok") carrega o
 * service.
 *
 * - Carregando a sessão → loading.
 * - Não-admin → redireciona pra "/" **sem mensagem** (genérico: não confirma que a área existe).
 *   Como o filho (chunk lazy) só renderiza quando é admin, o usuário comum nunca baixa o JS do painel.
 * - Admin → renderiza o filho.
 */
export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <PontesLoadingDots />
      </div>
    )
  }

  if (!currentUser?.isAdmin) {
    // Genérico de propósito: mesmo destino de rota inexistente, sem revelar a área.
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
