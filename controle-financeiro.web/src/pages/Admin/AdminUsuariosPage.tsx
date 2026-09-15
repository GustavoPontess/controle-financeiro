import { useCallback, useEffect, useState } from "react"
import { useOutletContext } from "react-router-dom"
import { Ban, RotateCcw, KeyRound, Search } from "lucide-react"
import {
  PontesTable, PontesButton, PontesBadge, PontesDialog, PontesInput, PontesField,
  PontesSkeleton, PontesEmptyState, PontesMaskedValue, useMaskData, maskEmail,
  PontesTablePagination, PONTES_TABLE_PAGE_SIZE_DEFAULT,
  type PontesTableColumn,
} from "@/components/pontes"
import { useAuth } from "../../hooks/useAuth"
import adminService from "@/services/adminService"
import { StatusUsuario, STATUS_LABEL, STATUS_TONE, type UsuarioAdmin } from "@/types/Admin"
import styles from "./AdminPage.module.css"

type Notification = { open: boolean; message: string; severity: "success" | "error" }
type OutletContextType = { notify: React.Dispatch<React.SetStateAction<Notification>> }

function formatarData(iso?: string | null): string {
  if (!iso) return "—"
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso))
}

type Confirm = { tipo: "bloquear" | "reset"; alvo: UsuarioAdmin } | null

/** Gestão de usuários (Módulo B). Acesso já garantido pelo AdminRoute. */
export default function AdminUsuariosPage() {
  const { notify } = useOutletContext<OutletContextType>()
  const { currentUser } = useAuth()
  const [mascarar] = useMaskData()

  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([])
  const [total, setTotal] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [buscaInput, setBuscaInput] = useState("")
  const [busca, setBusca] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PONTES_TABLE_PAGE_SIZE_DEFAULT)
  const [processando, setProcessando] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<Confirm>(null)

  // Debounce da busca: 350ms sem digitar → dispara a query server-side e volta pra página 1.
  useEffect(() => {
    const t = setTimeout(() => { setBusca(buscaInput.trim()); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [buscaInput])

  const carregar = useCallback(() => {
    setCarregando(true)
    adminService.usuarios(busca || undefined, page, pageSize)
      .then((r) => { setUsuarios(r.items); setTotal(r.total) })
      .finally(() => setCarregando(false))
  }, [busca, page, pageSize])
  useEffect(() => { carregar() }, [carregar])

  const atualizarLinha = (u: UsuarioAdmin) =>
    setUsuarios((prev) => prev.map((x) => (x.id === u.id ? u : x)))

  const reativar = async (u: UsuarioAdmin) => {
    setProcessando(u.id)
    try {
      atualizarLinha(await adminService.reativar(u.id))
      notify({ open: true, message: `${u.nome} reativado`, severity: "success" })
    } catch {
      // rede de segurança global mostra o erro.
    } finally {
      setProcessando(null)
    }
  }

  const confirmar = async () => {
    if (!confirm) return
    const { tipo, alvo } = confirm
    setConfirm(null)
    setProcessando(alvo.id)
    try {
      if (tipo === "bloquear") {
        atualizarLinha(await adminService.bloquear(alvo.id))
        notify({ open: true, message: `${alvo.nome} bloqueado`, severity: "success" })
      } else {
        await adminService.forcarReset(alvo.id)
        notify({ open: true, message: `Link de redefinição enviado para ${mascarar ? maskEmail(alvo.email) : alvo.email}`, severity: "success" })
      }
    } catch {
      // rede de segurança global mostra o erro.
    } finally {
      setProcessando(null)
    }
  }

  const colunas: PontesTableColumn<UsuarioAdmin>[] = [
    { key: "nome", header: "Nome", render: (u) => <strong>{u.nome}</strong> },
    { key: "email", header: "E-mail", render: (u) => <PontesMaskedValue value={u.email} /> },
    { key: "status", header: "Situação", render: (u) => <PontesBadge tone={STATUS_TONE[u.status]} size="sm">{STATUS_LABEL[u.status]}</PontesBadge> },
    { key: "ultimoAcesso", header: "Último acesso", render: (u) => formatarData(u.ultimoAcessoEm) },
    {
      key: "acoes",
      header: "Ações",
      align: "right",
      render: (u) => {
        const euMesmo = u.id === currentUser?.id
        const emAcao = processando === u.id
        return (
          <div className={styles.acoes}>
            {u.status === StatusUsuario.Ativo && (
              <>
                <PontesButton variant="ghost" size="sm" disabled={emAcao} onClick={() => setConfirm({ tipo: "reset", alvo: u })}>
                  <KeyRound size={14} strokeWidth={2.5} /> Forçar reset
                </PontesButton>
                {!euMesmo && (
                  <PontesButton variant="ghost" size="sm" disabled={emAcao} onClick={() => setConfirm({ tipo: "bloquear", alvo: u })}>
                    <Ban size={14} strokeWidth={2.5} /> Bloquear
                  </PontesButton>
                )}
              </>
            )}
            {u.status === StatusUsuario.Bloqueado && (
              <PontesButton variant="primary" size="sm" loading={emAcao} onClick={() => reativar(u)}>
                <RotateCcw size={14} strokeWidth={2.5} /> Reativar
              </PontesButton>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className={styles.wrap}>
      <PontesField label="Buscar" htmlFor="busca-usuario">
        <PontesInput
          id="busca-usuario"
          placeholder="Nome ou e-mail"
          value={buscaInput}
          onChange={(e) => setBuscaInput(e.target.value)}
          iconStart={<Search size={16} strokeWidth={2} />}
        />
      </PontesField>

      {carregando ? (
        <PontesSkeleton height={200} />
      ) : total === 0 ? (
        <PontesEmptyState title="Nenhum usuário" description={busca ? "Nada bate com a busca." : "Ainda não há usuários cadastrados."} />
      ) : (
        <>
          <PontesTable columns={colunas} rows={usuarios} rowKey={(u) => u.id} />
          <PontesTablePagination
            total={total}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
            itemLabel="usuários"
            itemLabelSingular="usuário"
          />
        </>
      )}

      <PontesDialog
        open={!!confirm}
        tone={confirm?.tipo === "bloquear" ? "danger" : "warning"}
        title={confirm?.tipo === "bloquear" ? "Bloquear usuário?" : "Forçar redefinição de senha?"}
        description={
          confirm?.tipo === "bloquear"
            ? `${confirm?.alvo.nome} não poderá mais acessar até ser reativado. Os dados são preservados.`
            : `Vamos enviar um link de redefinição de senha para ${confirm ? (mascarar ? maskEmail(confirm.alvo.email) : confirm.alvo.email) : ""}.`
        }
        confirmLabel={confirm?.tipo === "bloquear" ? "Bloquear" : "Enviar link"}
        cancelLabel="Cancelar"
        onConfirm={confirmar}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
