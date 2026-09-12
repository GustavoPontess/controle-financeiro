import { useEffect, useState } from "react"
import { PontesTable, PontesSkeleton, PontesEmptyState, PontesMaskedValue, type PontesTableColumn } from "@/components/pontes"
import adminService from "@/services/adminService"
import { ACAO_LABEL, type AdminAuditLog } from "@/types/Admin"
import styles from "./AdminPage.module.css"

function formatarData(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso))
}

/** Visualizador de auditoria (Módulo D). SÓ LEITURA. Acesso já garantido pelo AdminRoute. */
export default function AdminAuditoriaPage() {
  const [logs, setLogs] = useState<AdminAuditLog[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let vivo = true
    setCarregando(true)
    adminService.auditoria()
      .then((l) => { if (vivo) setLogs(l) })
      .finally(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
  }, [])

  const colunas: PontesTableColumn<AdminAuditLog>[] = [
    { key: "quando", header: "Quando", render: (l) => formatarData(l.criadoEm) },
    { key: "admin", header: "Admin", render: (l) => <PontesMaskedValue value={l.adminEmail} /> },
    { key: "acao", header: "Ação", render: (l) => <strong>{ACAO_LABEL[l.acao] ?? "—"}</strong> },
    { key: "alvo", header: "Alvo", render: (l) => <PontesMaskedValue value={l.alvoDescricao} /> },
    { key: "detalhe", header: "Detalhe", render: (l) => l.detalhe ?? "—" },
  ]

  return (
    <div className={styles.wrap}>
      <p className={styles.sub}>Registro das ações de administração (somente leitura).</p>

      {carregando ? (
        <PontesSkeleton height={200} />
      ) : logs.length === 0 ? (
        <PontesEmptyState title="Nenhuma ação registrada" description="As ações de admin (aprovar, bloquear, etc.) aparecem aqui." />
      ) : (
        <PontesTable columns={colunas} rows={logs} rowKey={(l) => l.id} />
      )}
    </div>
  )
}
