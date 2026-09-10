import { useEffect, useState } from "react"
import { useOutletContext } from "react-router-dom"
import { Check, X } from "lucide-react"
import {
  PontesTable, PontesButton, PontesDialog, PontesEmptyState, PontesSkeleton,
  type PontesTableColumn,
} from "@/components/pontes"
import adminService from "@/services/adminService"
import type { UsuarioAdmin } from "@/types/Admin"
import styles from "./AdminPage.module.css"

type Notification = { open: boolean; message: string; severity: "success" | "error" }
type OutletContextType = { notify: React.Dispatch<React.SetStateAction<Notification>> }

// Instante real (UTC no banco) → data + hora no fuso local do admin.
function formatarData(iso?: string | null): string {
  if (!iso) return "—"
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso))
}

/** Fila de aprovação (item "Fila de aprovação" da lateral do admin). Acesso já garantido pelo AdminRoute. */
export default function AdminPendentesPage() {
  const { notify } = useOutletContext<OutletContextType>()

  const [pendentes, setPendentes] = useState<UsuarioAdmin[]>([])
  const [carregando, setCarregando] = useState(true)
  const [processando, setProcessando] = useState<string | null>(null)
  const [recusarAlvo, setRecusarAlvo] = useState<UsuarioAdmin | null>(null)

  useEffect(() => {
    let vivo = true
    setCarregando(true)
    adminService.pendentes()
      .then((p) => { if (vivo) setPendentes(p) })
      .finally(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
  }, [])

  const aprovar = async (u: UsuarioAdmin) => {
    setProcessando(u.id)
    try {
      await adminService.aprovar(u.id)
      setPendentes((prev) => prev.filter((x) => x.id !== u.id))
      notify({ open: true, message: `${u.nome} aprovado com sucesso`, severity: "success" })
    } catch {
      // Erro de servidor é mostrado pela rede de segurança global.
    } finally {
      setProcessando(null)
    }
  }

  const confirmarRecusa = async () => {
    if (!recusarAlvo) return
    const u = recusarAlvo
    setRecusarAlvo(null)
    setProcessando(u.id)
    try {
      await adminService.recusar(u.id)
      setPendentes((prev) => prev.filter((x) => x.id !== u.id))
      notify({ open: true, message: `Cadastro de ${u.nome} recusado`, severity: "success" })
    } catch {
      // idem.
    } finally {
      setProcessando(null)
    }
  }

  const colunas: PontesTableColumn<UsuarioAdmin>[] = [
    { key: "nome", header: "Nome", render: (u) => <strong>{u.nome}</strong> },
    { key: "email", header: "E-mail", render: (u) => u.email },
    { key: "criadoEm", header: "Cadastro", render: (u) => formatarData(u.criadoEm) },
    {
      key: "acoes",
      header: "Ações",
      align: "right",
      render: (u) => (
        <div className={styles.acoes}>
          <PontesButton variant="primary" size="sm" loading={processando === u.id} onClick={() => aprovar(u)}>
            <Check size={14} strokeWidth={2.5} /> Aprovar
          </PontesButton>
          <PontesButton variant="ghost" size="sm" disabled={processando === u.id} onClick={() => setRecusarAlvo(u)}>
            <X size={14} strokeWidth={2.5} /> Recusar
          </PontesButton>
        </div>
      ),
    },
  ]

  return (
    <div className={styles.wrap}>
      <p className={styles.sub}>Cadastros aguardando aprovação pra entrar no beta.</p>

      {carregando ? (
        <PontesSkeleton height={180} />
      ) : pendentes.length === 0 ? (
        <PontesEmptyState
          icon={<Check size={28} strokeWidth={2} />}
          title="Nenhum cadastro pendente"
          description="Novos cadastros aparecem aqui pra você aprovar ou recusar."
        />
      ) : (
        <PontesTable columns={colunas} rows={pendentes} rowKey={(u) => u.id} />
      )}

      <PontesDialog
        open={!!recusarAlvo}
        tone="danger"
        title="Recusar cadastro?"
        description={recusarAlvo ? `${recusarAlvo.nome} (${recusarAlvo.email}) não poderá acessar o sistema.` : ""}
        confirmLabel="Recusar"
        cancelLabel="Cancelar"
        onConfirm={confirmarRecusa}
        onCancel={() => setRecusarAlvo(null)}
      />
    </div>
  )
}
