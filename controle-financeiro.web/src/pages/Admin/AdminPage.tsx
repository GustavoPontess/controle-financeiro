import { useEffect, useState } from "react"
import { useOutletContext } from "react-router-dom"
import { Check, X } from "lucide-react"
import {
  PontesTabs, PontesTable, PontesStatCard, PontesButton, PontesBadge,
  PontesDialog, PontesEmptyState, PontesSkeleton,
  type PontesTableColumn,
} from "@/components/pontes"
import adminService from "@/services/adminService"
import type { MetricasAdmin, UsuarioAdmin } from "@/types/Admin"
import styles from "./AdminPage.module.css"

type Notification = { open: boolean; message: string; severity: "success" | "error" }
type OutletContextType = { notify: React.Dispatch<React.SetStateAction<Notification>> }

type Aba = "pendentes" | "metricas"

// Instante real (UTC no banco) → data + hora no fuso local do admin.
function formatarData(iso?: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(d)
}

export default function AdminPage() {
  const { notify } = useOutletContext<OutletContextType>()

  // O acesso admin já foi confirmado pelo AdminRoute ANTES desta tela montar — aqui só carrega dados.
  const [aba, setAba] = useState<Aba>("pendentes")

  const [pendentes, setPendentes] = useState<UsuarioAdmin[]>([])
  const [metricas, setMetricas] = useState<MetricasAdmin | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [processando, setProcessando] = useState<string | null>(null) // id em ação
  const [recusarAlvo, setRecusarAlvo] = useState<UsuarioAdmin | null>(null)

  useEffect(() => {
    let vivo = true
    setCarregando(true)
    Promise.all([adminService.pendentes(), adminService.metricas()])
      .then(([p, m]) => { if (vivo) { setPendentes(p); setMetricas(m) } })
      .finally(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
  }, [])

  const aprovar = async (u: UsuarioAdmin) => {
    setProcessando(u.id)
    try {
      await adminService.aprovar(u.id)
      setPendentes((prev) => prev.filter((x) => x.id !== u.id))
      setMetricas(await adminService.metricas())
      notify({ open: true, message: `${u.nome} aprovado com sucesso`, severity: "success" })
    } catch {
      // Erro de servidor (ex.: já saiu da fila) é mostrado pela rede de segurança global.
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
      setMetricas(await adminService.metricas())
      notify({ open: true, message: `Cadastro de ${u.nome} recusado`, severity: "success" })
    } catch {
      // idem: rede de segurança global mostra.
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
          <PontesButton
            variant="primary"
            size="sm"
            loading={processando === u.id}
            onClick={() => aprovar(u)}
          >
            <Check size={14} strokeWidth={2.5} /> Aprovar
          </PontesButton>
          <PontesButton
            variant="ghost"
            size="sm"
            disabled={processando === u.id}
            onClick={() => setRecusarAlvo(u)}
          >
            <X size={14} strokeWidth={2.5} /> Recusar
          </PontesButton>
        </div>
      ),
    },
  ]

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <h1 className={styles.title}>Administração</h1>
        <p className={styles.sub}>Fila de aprovação do beta e métricas de cadastro.</p>
      </header>

      <PontesTabs
        value={aba}
        onChange={(v) => setAba(v as Aba)}
        options={[
          { value: "pendentes", label: <>Pendentes {pendentes.length > 0 && <PontesBadge tone="warning" size="sm">{pendentes.length}</PontesBadge>}</> },
          { value: "metricas", label: "Métricas" },
        ]}
      />

      {aba === "pendentes" && (
        <section className={styles.section}>
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
        </section>
      )}

      {aba === "metricas" && (
        <section className={styles.section}>
          {carregando || !metricas ? (
            <PontesSkeleton height={120} />
          ) : (
            <div className={styles.metricas}>
              <PontesStatCard label="Total de cadastros" value={String(metricas.total)} />
              <PontesStatCard label="Aguardando aprovação" value={String(metricas.pendentes)} tone="warning" hint="na fila agora" />
              <PontesStatCard label="Ativos" value={String(metricas.ativos)} tone="success" />
              <PontesStatCard label="Recusados" value={String(metricas.recusados)} />
              <PontesStatCard label="Bloqueados" value={String(metricas.bloqueados)} tone="danger" />
              <PontesStatCard label="Cadastros (7 dias)" value={String(metricas.cadastrosUltimos7Dias)} hint="inclui hoje" />
              <PontesStatCard label="Ativos que acessaram (7 dias)" value={String(metricas.ativosUltimos7Dias)} tone="success" />
            </div>
          )}
        </section>
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
