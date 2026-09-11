/**
 * Raiz do painel admin — carregada via `React.lazy` (chunk separado). Como o import só dispara quando
 * o `AdminRoute` libera (admin de verdade), o JS de todo o painel — inclusive os nomes das sub-rotas
 * e títulos abaixo — **não entra no bundle principal nem é baixado por usuário comum**. Hardening de
 * front: reduz o que vaza sobre a área de admin (a fronteira real continua sendo o 403 do backend).
 *
 * Todo o roteamento interno do admin vive aqui, sob o `AdminLayout` (mesma cara do app: sidebar +
 * navbar, com os menus de admin). Cada item da lateral é uma rota.
 */
import { Routes, Route, Navigate } from "react-router-dom"
import AdminLayout from "../../layouts/Admin/AdminLayout"
import AdminPendentesPage from "./AdminPendentesPage"
import AdminUsuariosPage from "./AdminUsuariosPage"
import AdminMetricasPage from "./AdminMetricasPage"
import AdminLgpdPage from "./AdminLgpdPage"
import AdminAuditoriaPage from "./AdminAuditoriaPage"

export default function AdminApp() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Navigate to="/admin/pendentes" replace />} />
        <Route path="pendentes" element={<AdminPendentesPage />} />
        <Route path="usuarios" element={<AdminUsuariosPage />} />
        <Route path="metricas" element={<AdminMetricasPage />} />
        <Route path="lgpd" element={<AdminLgpdPage />} />
        <Route path="auditoria" element={<AdminAuditoriaPage />} />
        <Route path="*" element={<Navigate to="/admin/pendentes" replace />} />
      </Route>
    </Routes>
  )
}
