import { useEffect, useMemo, useState } from "react"
import { useOutletContext } from "react-router-dom"
import { Download, Trash2, RotateCcw, Search, ShieldAlert } from "lucide-react"
import {
  PontesTable, PontesButton, PontesBadge, PontesDialog, PontesModal, PontesInput, PontesField,
  PontesSkeleton, PontesEmptyState, PontesMaskedValue, useMaskData, maskEmail,
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

/**
 * Ferramentas LGPD (Módulo C) — exportar dados, exclusão em 2 estágios (marcar → carência → purgar).
 * Acesso já garantido pelo AdminRoute. Purga é IRREVERSÍVEL: confirmação forte digitando o e-mail do
 * alvo (a fronteira real é o backend, que também recusa se houver vínculo com outro usuário). Admin
 * não age sobre a própria conta (marcar/purgar escondidos na própria linha).
 */
export default function AdminLgpdPage() {
  const { notify } = useOutletContext<OutletContextType>()
  const { currentUser } = useAuth()
  const [mascarar] = useMaskData()

  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState("")
  const [processando, setProcessando] = useState<string | null>(null)

  // Marcar / cancelar: confirmação simples (PontesDialog).
  const [confirm, setConfirm] = useState<{ tipo: "marcar" | "cancelar"; alvo: UsuarioAdmin } | null>(null)
  // Purgar: confirmação forte com digitação do e-mail (PontesModal).
  const [purgaAlvo, setPurgaAlvo] = useState<UsuarioAdmin | null>(null)
  const [purgaEmail, setPurgaEmail] = useState("")

  const carregar = () => {
    setCarregando(true)
    adminService.usuarios().then(setUsuarios).finally(() => setCarregando(false))
  }
  useEffect(() => { carregar() }, [])

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase()
    if (!t) return usuarios
    return usuarios.filter((u) => u.nome.toLowerCase().includes(t) || u.email.toLowerCase().includes(t))
  }, [usuarios, busca])

  const atualizarLinha = (u: UsuarioAdmin) => setUsuarios((prev) => prev.map((x) => (x.id === u.id ? u : x)))

  const exportar = async (u: UsuarioAdmin) => {
    setProcessando(u.id)
    try {
      const dados = await adminService.exportar(u.id)
      const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `dados-${u.email}.json`
      a.click()
      URL.revokeObjectURL(url)
      notify({ open: true, message: `Dados de ${mascarar ? maskEmail(u.email) : u.email} exportados`, severity: "success" })
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
      if (tipo === "marcar") {
        atualizarLinha(await adminService.marcarExclusao(alvo.id))
        notify({ open: true, message: `${alvo.nome} marcado para exclusão`, severity: "success" })
      } else {
        atualizarLinha(await adminService.cancelarExclusao(alvo.id))
        notify({ open: true, message: `Exclusão de ${alvo.nome} cancelada`, severity: "success" })
      }
    } catch {
      // rede de segurança global mostra o erro.
    } finally {
      setProcessando(null)
    }
  }

  const fecharPurga = () => { setPurgaAlvo(null); setPurgaEmail("") }

  const purgar = async () => {
    if (!purgaAlvo) return
    const alvo = purgaAlvo
    fecharPurga()
    setProcessando(alvo.id)
    try {
      await adminService.purgar(alvo.id, alvo.email)
      setUsuarios((prev) => prev.filter((x) => x.id !== alvo.id))
      notify({ open: true, message: `${mascarar ? maskEmail(alvo.email) : alvo.email} purgado permanentemente`, severity: "success" })
    } catch {
      // rede de segurança global mostra o erro (inclui a recusa por vínculo com terceiro).
    } finally {
      setProcessando(null)
    }
  }

  const colunas: PontesTableColumn<UsuarioAdmin>[] = [
    { key: "nome", header: "Nome", render: (u) => <strong>{u.nome}</strong> },
    { key: "email", header: "E-mail", render: (u) => <PontesMaskedValue value={u.email} /> },
    { key: "status", header: "Situação", render: (u) => <PontesBadge tone={STATUS_TONE[u.status]} size="sm">{STATUS_LABEL[u.status]}</PontesBadge> },
    { key: "marcado", header: "Marcado em", render: (u) => formatarData(u.marcadoExclusaoEm) },
    {
      key: "acoes",
      header: "Ações",
      align: "right",
      render: (u) => {
        const euMesmo = u.id === currentUser?.id
        const emAcao = processando === u.id
        const emExclusao = u.status === StatusUsuario.MarcadoParaExclusao
        const podeMarcar = !euMesmo && (u.status === StatusUsuario.Ativo || u.status === StatusUsuario.Bloqueado)
        return (
          <div className={styles.acoes}>
            <PontesButton variant="ghost" size="sm" disabled={emAcao} onClick={() => exportar(u)}>
              <Download size={14} strokeWidth={2.5} /> Exportar
            </PontesButton>
            {podeMarcar && (
              <PontesButton variant="ghost" size="sm" disabled={emAcao} onClick={() => setConfirm({ tipo: "marcar", alvo: u })}>
                <Trash2 size={14} strokeWidth={2.5} /> Marcar exclusão
              </PontesButton>
            )}
            {emExclusao && (
              <>
                <PontesButton variant="ghost" size="sm" disabled={emAcao} onClick={() => setConfirm({ tipo: "cancelar", alvo: u })}>
                  <RotateCcw size={14} strokeWidth={2.5} /> Cancelar
                </PontesButton>
                {!euMesmo && (
                  <PontesButton variant="danger" size="sm" disabled={emAcao} onClick={() => { setPurgaAlvo(u); setPurgaEmail("") }}>
                    <ShieldAlert size={14} strokeWidth={2.5} /> Purgar
                  </PontesButton>
                )}
              </>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className={styles.wrap}>
      <PontesField label="Buscar" htmlFor="busca-lgpd">
        <PontesInput
          id="busca-lgpd"
          placeholder="Nome ou e-mail"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          iconStart={<Search size={16} strokeWidth={2} />}
        />
      </PontesField>

      {carregando ? (
        <PontesSkeleton height={200} />
      ) : filtrados.length === 0 ? (
        <PontesEmptyState title="Nenhum usuário" description={busca ? "Nada bate com a busca." : "Ainda não há usuários cadastrados."} />
      ) : (
        <PontesTable columns={colunas} rows={filtrados} rowKey={(u) => u.id} />
      )}

      <PontesDialog
        open={!!confirm}
        tone={confirm?.tipo === "marcar" ? "danger" : "warning"}
        title={confirm?.tipo === "marcar" ? "Marcar para exclusão?" : "Cancelar exclusão?"}
        description={
          confirm?.tipo === "marcar"
            ? `${confirm?.alvo.nome} deixará de acessar imediatamente e entra na janela de carência. Reversível até a purga.`
            : `${confirm?.alvo.nome} volta a ficar ativo e sai da fila de exclusão.`
        }
        confirmLabel={confirm?.tipo === "marcar" ? "Marcar" : "Cancelar exclusão"}
        cancelLabel="Voltar"
        onConfirm={confirmar}
        onCancel={() => setConfirm(null)}
      />

      <PontesModal
        open={!!purgaAlvo}
        title="Purgar permanentemente"
        onClose={fecharPurga}
        footer={<>
          <PontesButton variant="outline" onClick={fecharPurga}>Cancelar</PontesButton>
          <PontesButton
            variant="danger"
            disabled={purgaEmail.trim().toLowerCase() !== purgaAlvo?.email.toLowerCase()}
            onClick={purgar}
          >
            <ShieldAlert size={16} strokeWidth={2.5} /> Purgar de vez
          </PontesButton>
        </>}
      >
        <div className={styles.purgaBody}>
          <p>
            Ação <strong>irreversível</strong>. Todos os dados de{" "}
            <strong>{purgaAlvo ? (mascarar ? maskEmail(purgaAlvo.email) : purgaAlvo.email) : ""}</strong> serão
            apagados de vez. Se a conta tiver vínculo com outro usuário (família, empréstimo, rateio,
            acerto), a purga é recusada para não quebrar dados de terceiros.
          </p>
          <PontesField
            label="Digite o e-mail do usuário para confirmar"
            htmlFor="purga-email"
            helper={mascarar ? "Dados mascarados — use o olho na barra superior para revelar o e-mail." : undefined}
          >
            <PontesInput
              id="purga-email"
              placeholder={purgaAlvo ? (mascarar ? maskEmail(purgaAlvo.email) : purgaAlvo.email) : ""}
              value={purgaEmail}
              onChange={(e) => setPurgaEmail(e.target.value)}
              autoComplete="off"
            />
          </PontesField>
        </div>
      </PontesModal>
    </div>
  )
}
