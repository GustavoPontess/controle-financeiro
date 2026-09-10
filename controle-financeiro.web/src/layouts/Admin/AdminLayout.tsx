/**
 * AdminLayout — shell EXCLUSIVO do painel admin. Isolado do app do usuário: não tem a sidebar de
 * Transações/Cartões/Importar nem o botão "Nova transação". Só o cabeçalho do painel + link pra
 * voltar ao app. Chrome próprio pra não misturar admin com o fluxo do usuário comum.
 *
 * Traz seu próprio toast (sucesso das ações + rede de segurança global `apiError`), já que não vive
 * dentro do DefaultLayout. Passa `notify` via Outlet context (as telas admin leem com useOutletContext).
 */
import { useEffect, useState } from "react"
import { Outlet, Link } from "react-router-dom"
import { ShieldCheck, ArrowLeft } from "lucide-react"
import { PontesToast, PontesLogoMark } from "@/components/pontes"
import { useAuth } from "../../hooks/useAuth"
import styles from "./AdminLayout.module.css"

type Notification = { open: boolean; message: string; severity: "success" | "error" }

export default function AdminLayout() {
  const { currentUser } = useAuth()
  const [notification, setNotification] = useState<Notification>({ open: false, message: "", severity: "success" })

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
      <header className={styles.bar}>
        <div className={styles.brand}>
          <PontesLogoMark color="var(--pontes-primary)" size={24} />
          <span className={styles.brandText}>Painel Admin</span>
          <span className={styles.badge}><ShieldCheck size={13} strokeWidth={2.5} /> restrito</span>
        </div>
        <div className={styles.right}>
          {currentUser?.nome && <span className={styles.user}>{currentUser.nome}</span>}
          <Link to="/dashboard" className={styles.back}>
            <ArrowLeft size={15} strokeWidth={2.5} /> Voltar ao app
          </Link>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.content}>
          <Outlet context={{ notify: setNotification }} />
        </div>
      </main>

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
