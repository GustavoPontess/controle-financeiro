import { useCallback, useEffect, useState } from "react"
import { Search } from "lucide-react"
import {
  PontesTable, PontesSkeleton, PontesEmptyState, PontesMaskedValue, PontesInput, PontesField,
  PontesTablePagination, PONTES_TABLE_PAGE_SIZE_DEFAULT,
  type PontesTableColumn,
} from "@/components/pontes"
import adminService from "@/services/adminService"
import { ACAO_LABEL, type AdminAuditLog } from "@/types/Admin"
import styles from "./AdminPage.module.css"

function formatarData(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso))
}

/**
 * Visualizador de auditoria (Módulo D). SÓ LEITURA. Acesso já garantido pelo AdminRoute.
 * Busca/paginação SERVER-SIDE — antes o backend capava em 200 registros fixos e os antigos ficavam
 * inacessíveis; agora dá pra paginar/buscar tudo.
 */
export default function AdminAuditoriaPage() {
  const [logs, setLogs] = useState<AdminAuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [buscaInput, setBuscaInput] = useState("")
  const [busca, setBusca] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PONTES_TABLE_PAGE_SIZE_DEFAULT)

  // Debounce da busca: 350ms sem digitar → dispara a query server-side e volta pra página 1.
  useEffect(() => {
    const t = setTimeout(() => { setBusca(buscaInput.trim()); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [buscaInput])

  const carregar = useCallback(() => {
    setCarregando(true)
    adminService.auditoria(busca || undefined, page, pageSize)
      .then((r) => { setLogs(r.items); setTotal(r.total) })
      .finally(() => setCarregando(false))
  }, [busca, page, pageSize])
  useEffect(() => { carregar() }, [carregar])

  const colunas: PontesTableColumn<AdminAuditLog>[] = [
    { key: "quando", header: "Quando", render: (l) => formatarData(l.criadoEm) },
    { key: "admin", header: "Admin", render: (l) => <PontesMaskedValue value={l.adminEmail} /> },
    { key: "acao", header: "Ação", render: (l) => <strong>{ACAO_LABEL[l.acao] ?? "—"}</strong> },
    { key: "alvo", header: "Alvo", render: (l) => <PontesMaskedValue value={l.alvoDescricao} /> },
    { key: "detalhe", header: "Detalhe", render: (l) => l.detalhe ?? "—" },
  ]

  return (
    <div className={styles.wrap}>
      <PontesField label="Buscar" htmlFor="busca-auditoria">
        <PontesInput
          id="busca-auditoria"
          placeholder="Admin ou alvo"
          value={buscaInput}
          onChange={(e) => setBuscaInput(e.target.value)}
          iconStart={<Search size={16} strokeWidth={2} />}
        />
      </PontesField>

      {carregando ? (
        <PontesSkeleton height={200} />
      ) : total === 0 ? (
        <PontesEmptyState
          title="Nenhuma ação registrada"
          description={busca ? "Nada bate com a busca." : "As ações de admin (aprovar, bloquear, etc.) aparecem aqui."}
        />
      ) : (
        <>
          <PontesTable columns={colunas} rows={logs} rowKey={(l) => l.id} />
          <PontesTablePagination
            total={total}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
            itemLabel="registros"
            itemLabelSingular="registro"
          />
        </>
      )}
    </div>
  )
}
