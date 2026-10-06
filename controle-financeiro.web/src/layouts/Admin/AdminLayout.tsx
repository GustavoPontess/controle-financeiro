/**
 * AdminLayout — MESMA estrutura visual do app do usuário (sidebar lateral + navbar superior,
 * reaproveitando os componentes `Sidebar`/`Navbar` e o shell do `DefaultLayout`), mas com os menus
 * de ADMIN na lateral (Fila de aprovação, Métricas...) em vez dos menus financeiros do usuário.
 * Sem "Nova transação"/ocultar valores (Navbar `showFinance={false}`).
 *
 * Traz toast próprio (sucesso das ações + rede de segurança `apiError`) e passa `notify` via Outlet
 * context (as telas admin leem com useOutletContext).
 */
import { useState, useEffect } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { ClipboardCheck, BarChart3, Users, ScrollText, ShieldCheck, Eye, EyeOff } from "lucide-react"
import { PontesDrawer, PontesToast, PontesIconButton, useMaskData } from "@/components/pontes"
import { ATE_TABLET, CELULAR, casa, useMediaQuery } from "../../hooks/useMediaQuery"
import Sidebar, { type SidebarNavGroup } from "../../components/Sidebar/Sidebar"
import Navbar from "../../components/Navbar/Navbar"
import AdminNotificationBell from "../../pages/Admin/AdminNotificationBell"
import styles from "../Default/DefaultLayout.module.css"

const DRAWER_WIDTH = 248
const RAIL_WIDTH = 72
const ADMIN_HOME = "/admin/pendentes"
const GAVETA_CELULAR = 264

type Notification = { open: boolean; message: string; severity: "success" | "error" }

const ADMIN_NAV: SidebarNavGroup[] = [
  {
    section: "Administração",
    items: [
      { to: "/admin/pendentes", label: "Fila de aprovação", icon: <ClipboardCheck size={19} strokeWidth={2} /> },
      { to: "/admin/usuarios", label: "Usuários", icon: <Users size={19} strokeWidth={2} /> },
      { to: "/admin/metricas", label: "Métricas", icon: <BarChart3 size={19} strokeWidth={2} /> },
      { to: "/admin/lgpd", label: "LGPD", icon: <ShieldCheck size={19} strokeWidth={2} /> },
      { to: "/admin/auditoria", label: "Auditoria", icon: <ScrollText size={19} strokeWidth={2} /> },
    ],
  },
]

// Títulos das telas admin — moram AQUI (chunk lazy do admin), não no Navbar compartilhado, pra
// nenhuma rota de admin vazar no bundle do usuário comum.
const ADMIN_TITULOS: Record<string, string> = {
  "/admin/pendentes": "Fila de aprovação",
  "/admin/usuarios": "Usuários",
  "/admin/metricas": "Métricas",
  "/admin/lgpd": "LGPD — dados e exclusão",
  "/admin/auditoria": "Auditoria",
}

export default function AdminLayout() {
  const location = useLocation()
  // Mesmo comportamento do DefaultLayout: tablet começa com a barra recolhida; celular usa gaveta.
  const [open, setOpen] = useState(() => !casa(ATE_TABLET))
  const celular = useMediaQuery(CELULAR)
  const [gavetaAbertaEm, setGavetaAbertaEm] = useState<string | null>(null)
  const gavetaAberta = gavetaAbertaEm === location.pathname
  const [notification, setNotification] = useState<Notification>({ open: false, message: "", severity: "success" })
  // Mascaramento de PII no painel (default: mascarado). Olhinho revela sob demanda, igual ao "ocultar
  // valores" do financeiro. Estado global persistido (useMaskData) — vale em todas as telas admin.
  const [masked, toggleMask] = useMaskData()

  // Rede de segurança: erro de API (evento do interceptor do axios) vira toast — mesmo padrão do
  // DefaultLayout, pra nenhum erro do backend passar silencioso no painel admin.
  useEffect(() => {
    const handler = (e: Event) => {
      const message = (e as CustomEvent<{ message?: string }>).detail?.message
        ?? "Não foi possível concluir a ação."
      setNotification({ open: true, message, severity: "error" })
    }
    window.addEventListener("apiError", handler)
    return () => window.removeEventListener("apiError", handler)
  }, [])

  useEffect(() => {
    if (!notification.open) return
    const t = setTimeout(() => setNotification((n) => ({ ...n, open: false })), 4000)
    return () => clearTimeout(t)
  }, [notification.open])

  return (
    <div className={styles.shell}>
      {celular ? (
        <PontesDrawer bare side="left" width={GAVETA_CELULAR} open={gavetaAberta}
          onClose={() => setGavetaAbertaEm(null)} ariaLabel="Menu">
          <Sidebar open drawerWidth={GAVETA_CELULAR} railWidth={RAIL_WIDTH} nav={ADMIN_NAV} homePath={ADMIN_HOME} />
        </PontesDrawer>
      ) : (
        <Sidebar open={open} drawerWidth={DRAWER_WIDTH} railWidth={RAIL_WIDTH} nav={ADMIN_NAV} homePath={ADMIN_HOME} />
      )}

      <div className={styles.card}>
        <div className={styles.accentStrip} />
        <Navbar
          toggleDrawer={() => (celular ? setGavetaAbertaEm(location.pathname) : setOpen((o) => !o))}
          sidebarOpen={celular ? gavetaAberta : open}
          celular={celular}
          showFinance={false}
          title={ADMIN_TITULOS[location.pathname] ?? "Administração"}
          homeLabel="Painel Admin"
          homePath={ADMIN_HOME}
          notifications={<AdminNotificationBell />}
          sensitiveToggle={
            <PontesIconButton
              variant="ghost" size={40}
              onClick={toggleMask}
              aria-label={masked ? "Revelar dados sensíveis" : "Ocultar dados sensíveis"}
              title={masked ? "Revelar dados sensíveis" : "Ocultar dados sensíveis"}
            >
              {masked ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
            </PontesIconButton>
          }
        />

        <main className={styles.main}>
          <div className={styles.page}>
            <Outlet context={{ notify: setNotification }} />
          </div>
        </main>
      </div>

      {notification.open && (
        <div className={styles.toastWrap}>
          <PontesToast
            tone={notification.severity}
            title={notification.severity === "success" ? "Sucesso" : "Erro"}
            description={notification.message}
            onClose={() => setNotification((n) => ({ ...n, open: false }))}
          />
        </div>
      )}
    </div>
  )
}
