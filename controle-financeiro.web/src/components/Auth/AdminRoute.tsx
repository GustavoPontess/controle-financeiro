import { useEffect, useState } from "react"
import { Navigate } from "react-router-dom"
import { PontesLoadingDots } from "@/components/pontes"
import adminService from "@/services/adminService"

/**
 * Gate de admin no FRONT (defesa em profundidade — a fronteira real é o backend: policy IsAdmin
 * revalidada no banco a cada request). Confirma admin ANTES de montar/baixar o painel:
 *
 * - Enquanto checa → loading (não monta nada do admin).
 * - Não-admin (ou erro) → redireciona pra "/" **sem mensagem** (404 genérico: não confirma que a
 *   área de admin existe). Como o filho (o chunk lazy do admin) só é renderizado no caso "ok", um
 *   usuário comum **nunca baixa o JS do painel admin**.
 * - Admin → renderiza o filho.
 *
 * Usa GET /admin/me (skipErrorToast no service): 403 pra não-admin é esperado, não vira toast.
 */
export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const [estado, setEstado] = useState<"checando" | "ok" | "negado">("checando")

  useEffect(() => {
    let vivo = true
    adminService
      .me()
      .then((me) => { if (vivo) setEstado(me.isAdmin ? "ok" : "negado") })
      .catch(() => { if (vivo) setEstado("negado") })
    return () => { vivo = false }
  }, [])

  if (estado === "checando") {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <PontesLoadingDots />
      </div>
    )
  }

  if (estado === "negado") {
    // Genérico de propósito: mesmo destino de rota inexistente, sem revelar a área.
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
