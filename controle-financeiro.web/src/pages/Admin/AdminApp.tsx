/**
 * Raiz do painel admin — carregada via `React.lazy` (chunk separado). Como o import só dispara quando
 * o `AdminRoute` libera (admin de verdade), o JS de todo o painel — inclusive os nomes das sub-rotas
 * abaixo — **não entra no bundle principal nem é baixado por usuário comum**. Hardening de front:
 * reduz o que vaza sobre a área de admin (a fronteira real continua sendo o 403 do backend).
 *
 * Todo o roteamento interno do admin vive aqui dentro, sob o `AdminLayout` (chrome exclusivo).
 * Módulos futuros (Usuários/LGPD/Auditoria) entram como novas <Route> irmãs de index.
 */
import { Routes, Route, Navigate } from "react-router-dom"
import AdminLayout from "../../layouts/Admin/AdminLayout"
import AdminPage from "./AdminPage"

export default function AdminApp() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<AdminPage />} />
        {/* Futuro: <Route path="usuarios" .../>, "lgpd", "auditoria" */}
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  )
}
