import { useCallback, useEffect, useState } from "react"
import { useOutletContext } from "react-router-dom"
import {
  Plus, TrendingDown, TrendingUp, Repeat, Pencil, Trash2, PauseCircle, PlayCircle, XCircle,
} from "lucide-react"
import {
  PontesButton, PontesIconButton, PontesBadge,
  PontesModal, PontesDialog,
  PontesField, PontesInput, PontesSelect,
  PontesStatCard, PontesEmptyState, PontesLoadingDots,
} from "@/components/pontes"
import {
  getRecorrentes, createRecorrente, toggleRecorrente, deleteRecorrente,
  cancelarRecorrente, editarProximaOcorrencia,
} from "../../services/recorrenteService"
import { getContas } from "../../services/contaService"
import { getCategories } from "../../services/categoryService"
import type { Recorrente, CriarRecorrente, EditarProximaDto } from "../../types/Recorrente"
import type { Conta } from "../../types/Conta"
import type { Category } from "../../types/Category"
import styles from "./RecorrentesPage.module.css"

type Notification = { open: boolean; message: string; severity: "success" | "error" }
type OutletContextType = { notify: React.Dispatch<React.SetStateAction<Notification>> }

// ── helpers ──────────────────────────────────────────────────────────────────

const formatMoney = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)

const formatDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "—"

const today = () => new Date().toISOString().slice(0, 10)

const parseMoneyString = (s: string) => {
  // Handle BR format "1.234,56" and plain "45.90"/"45,90"
  let normalized = s
  if (s.includes(",") && s.includes(".")) {
    // BR thousands+decimal: "1.234,56" → "1234.56"
    normalized = s.replace(/\./g, "").replace(",", ".")
  } else if (s.includes(",")) {
    // BR decimal only: "45,90" → "45.90"
    normalized = s.replace(",", ".")
  }
  const n = parseFloat(normalized)
  return isNaN(n) ? 0 : n
}

// ── tipos de form ─────────────────────────────────────────────────────────────

type CriarForm = {
  descricao: string
  valor: string
  tipo: string
  categoriaId: string
  contaId: string
  frequencia: string
  dia: string
  dataInicio: string
  dataFim: string
}

type CriarErrors = Partial<Record<keyof CriarForm, string>>

const emptyCriarForm = (): CriarForm => ({
  descricao: "",
  valor: "",
  tipo: "1",
  categoriaId: "",
  contaId: "",
  frequencia: "2",
  dia: "1",
  dataInicio: today(),
  dataFim: "",
})

function validateCriar(f: CriarForm): CriarErrors {
  const errs: CriarErrors = {}
  if (!f.descricao.trim()) errs.descricao = "Descrição obrigatória."
  const v = parseMoneyString(f.valor)
  if (!f.valor || v <= 0) errs.valor = "Informe um valor positivo."
  if (!f.contaId) errs.contaId = "Selecione uma conta."
  if (!f.dataInicio) errs.dataInicio = "Data de início obrigatória."
  const dia = parseInt(f.dia)
  if (isNaN(dia) || dia < 1 || dia > 31) errs.dia = "Dia de 1 a 31."
  return errs
}

type EditarProximaForm = {
  valor: string
  descricao: string
}

type EditarProximaErrors = Partial<Record<keyof EditarProximaForm, string>>

function validateEditarProxima(f: EditarProximaForm): EditarProximaErrors {
  const errs: EditarProximaErrors = {}
  if (f.valor) {
    const v = parseMoneyString(f.valor)
    if (v <= 0) errs.valor = "Valor deve ser positivo."
  }
  return errs
}

type CancelarForm = { motivo: string }
type CancelarErrors = Partial<Record<keyof CancelarForm, string>>

function validateCancelar(f: CancelarForm): CancelarErrors {
  const errs: CancelarErrors = {}
  if (!f.motivo.trim()) errs.motivo = "Motivo é obrigatório."
  return errs
}

type ConfirmState = {
  title: string
  description: string
  onConfirm: () => Promise<void>
  tone?: "danger" | "warning" | "info"
} | null

// ── componente ────────────────────────────────────────────────────────────────

export default function RecorrentesPage() {
  const { notify } = useOutletContext<OutletContextType>()

  const [recorrentes, setRecorrentes] = useState<Recorrente[]>([])
  const [contas, setContas] = useState<Conta[]>([])
  const [categorias, setCategorias] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  // modal criar
  const [criarOpen, setCriarOpen] = useState(false)
  const [criarForm, setCriarForm] = useState<CriarForm>(emptyCriarForm())
  const [criarErrors, setCriarErrors] = useState<CriarErrors>({})
  const [criarSaving, setCriarSaving] = useState(false)

  // modal cancelar
  const [cancelarOpen, setCancelarOpen] = useState(false)
  const [cancelarTarget, setCancelarTarget] = useState<Recorrente | null>(null)
  const [cancelarForm, setCancelarForm] = useState<CancelarForm>({ motivo: "" })
  const [cancelarErrors, setCancelarErrors] = useState<CancelarErrors>({})
  const [cancelarSaving, setCancelarSaving] = useState(false)

  // modal editar próxima
  const [editarOpen, setEditarOpen] = useState(false)
  const [editarTarget, setEditarTarget] = useState<Recorrente | null>(null)
  const [editarForm, setEditarForm] = useState<EditarProximaForm>({ valor: "", descricao: "" })
  const [editarErrors, setEditarErrors] = useState<EditarProximaErrors>({})
  const [editarSaving, setEditarSaving] = useState(false)

  // confirm delete
  const [confirm, setConfirm] = useState<ConfirmState>(null)

  // ── load ────────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [r, c, cat] = await Promise.all([getRecorrentes(), getContas(), getCategories()])
      setRecorrentes(r)
      setContas(c)
      setCategorias(cat)
    } catch {
      notify({ open: true, message: "Erro ao carregar recorrentes.", severity: "error" })
    } finally {
      setLoading(false)
    }
  }, [notify])

  useEffect(() => { void loadData() }, [loadData])

  // ── stats ────────────────────────────────────────────────────────────────────

  const ativas = recorrentes.filter(r => r.ativo).length
  const totalMensalDespesa = recorrentes
    .filter(r => r.ativo && r.frequencia === 2 && r.tipo === 1)
    .reduce((s, r) => s + r.valor, 0)
  const proximas30 = recorrentes.filter(r => {
    if (!r.ativo || !r.dataProximaGeracao) return false
    const d = new Date(r.dataProximaGeracao)
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() + 30)
    return d <= cutoff
  }).length

  // ── criar ────────────────────────────────────────────────────────────────────

  function openCriar() {
    setCriarForm(emptyCriarForm())
    setCriarErrors({})
    setCriarOpen(true)
  }

  async function handleCriar() {
    const errs = validateCriar(criarForm)
    if (Object.keys(errs).length > 0) { setCriarErrors(errs); return }
    setCriarSaving(true)
    try {
      const dto: CriarRecorrente = {
        descricao: criarForm.descricao,
        valor: parseMoneyString(criarForm.valor),
        tipo: parseInt(criarForm.tipo),
        contaId: criarForm.contaId || undefined,
        categoriaId: criarForm.categoriaId || undefined,
        frequencia: parseInt(criarForm.frequencia),
        dia: parseInt(criarForm.dia),
        dataInicio: new Date(criarForm.dataInicio).toISOString(),
        dataFim: criarForm.dataFim ? new Date(criarForm.dataFim).toISOString() : undefined,
      }
      await createRecorrente(dto)
      setCriarOpen(false)
      await loadData()
      window.dispatchEvent(new Event("transactionCreated"))
      notify({ open: true, message: "Assinatura criada com sucesso.", severity: "success" })
    } catch {
      notify({ open: true, message: "Erro ao criar assinatura.", severity: "error" })
    } finally {
      setCriarSaving(false)
    }
  }

  // ── toggle ───────────────────────────────────────────────────────────────────

  async function handleToggle(r: Recorrente) {
    try {
      await toggleRecorrente(r.id)
      await loadData()
    } catch {
      notify({ open: true, message: "Erro ao atualizar assinatura.", severity: "error" })
    }
  }

  // ── deletar ───────────────────────────────────────────────────────────────────

  function openDeletar(r: Recorrente) {
    setConfirm({
      title: "Remover assinatura",
      description: `Remover "${r.descricao}"? As transações já geradas serão mantidas.`,
      tone: "danger",
      onConfirm: async () => {
        await deleteRecorrente(r.id)
        await loadData()
        notify({ open: true, message: "Assinatura removida.", severity: "success" })
      },
    })
  }

  // ── cancelar ─────────────────────────────────────────────────────────────────

  function openCancelar(r: Recorrente) {
    setCancelarTarget(r)
    setCancelarForm({ motivo: "" })
    setCancelarErrors({})
    setCancelarOpen(true)
  }

  async function handleCancelar() {
    const errs = validateCancelar(cancelarForm)
    if (Object.keys(errs).length > 0) { setCancelarErrors(errs); return }
    if (!cancelarTarget) return
    setCancelarSaving(true)
    try {
      await cancelarRecorrente(cancelarTarget.id, { motivo: cancelarForm.motivo })
      setCancelarOpen(false)
      await loadData()
      notify({ open: true, message: "Assinatura cancelada.", severity: "success" })
    } catch {
      notify({ open: true, message: "Erro ao cancelar assinatura.", severity: "error" })
    } finally {
      setCancelarSaving(false)
    }
  }

  // ── editar próxima ────────────────────────────────────────────────────────────

  function openEditarProxima(r: Recorrente) {
    setEditarTarget(r)
    setEditarForm({ valor: "", descricao: "" })
    setEditarErrors({})
    setEditarOpen(true)
  }

  async function handleEditarProxima() {
    const errs = validateEditarProxima(editarForm)
    if (Object.keys(errs).length > 0) { setEditarErrors(errs); return }
    if (!editarTarget) return
    setEditarSaving(true)
    try {
      const dto: EditarProximaDto = {}
      if (editarForm.valor) dto.valor = parseMoneyString(editarForm.valor)
      if (editarForm.descricao.trim()) dto.descricao = editarForm.descricao
      await editarProximaOcorrencia(editarTarget.id, dto)
      setEditarOpen(false)
      await loadData()
      notify({ open: true, message: "Próxima ocorrência atualizada.", severity: "success" })
    } catch {
      notify({ open: true, message: "Erro ao editar próxima ocorrência.", severity: "error" })
    } finally {
      setEditarSaving(false)
    }
  }

  // ── selects options ───────────────────────────────────────────────────────────

  const contaOpts = contas.map(c => ({ value: c.id, label: c.nome }))
  const categoriaOpts = [
    { value: "", label: "Sem categoria" },
    ...categorias.map(c => ({ value: c.id, label: c.descricao })),
  ]
  const tipoOpts = [
    { value: "1", label: "Despesa" },
    { value: "2", label: "Receita" },
  ]
  const freqOpts = [
    { value: "1", label: "Semanal" },
    { value: "2", label: "Mensal" },
    { value: "3", label: "Anual" },
  ]

  const freqBadge: Record<number, "warning" | "neutral" | "primary"> = { 1: "warning", 2: "primary", 3: "neutral" }

  // ── render ────────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Assinaturas</h1>
          <p className={styles.subtitle}>Assinaturas e pagamentos automáticos</p>
        </div>
        <PontesButton variant="primary" size="sm" iconStart={<Plus size={16} />} onClick={openCriar}>
          Nova Assinatura
        </PontesButton>
      </div>

      {/* Stats */}
      <div className={styles.stats}>
        <PontesStatCard label="Ativas" value={String(ativas)} />
        <PontesStatCard label="Custo mensal (despesas)" value={formatMoney(totalMensalDespesa)} />
        <PontesStatCard label="Próximas 30 dias" value={String(proximas30)} />
      </div>

      {/* Lista */}
      <div className={styles.list}>
        <div className={styles.listHeader}>
          <span className={styles.listTitle}>Suas Assinaturas</span>
        </div>

        {loading ? (
          <div className={styles.center}><PontesLoadingDots /></div>
        ) : recorrentes.length === 0 ? (
          <PontesEmptyState
            icon={<Repeat size={40} />}
            title="Nenhuma assinatura"
            description="Cadastre Netflix, academia ou qualquer pagamento recorrente."
            actions={<PontesButton variant="primary" size="sm" onClick={openCriar}>Nova Assinatura</PontesButton>}
          />
        ) : (
          recorrentes.map((r) => {
            const isDespesa = r.tipo === 1
            const tone = (freqBadge[r.frequencia] ?? "primary") as "warning" | "neutral" | "primary"
            return (
              <div
                key={r.id}
                className={styles.row}
                data-inactive={!r.ativo ? "true" : undefined}
              >
                {/* Icon */}
                <div className={styles.rowIcon} data-tipo={isDespesa ? "despesa" : "receita"}>
                  {isDespesa
                    ? <TrendingDown size={18} />
                    : <TrendingUp size={18} />
                  }
                </div>

                {/* Info */}
                <div className={styles.rowInfo}>
                  <span className={styles.rowDescricao}>{r.descricao}</span>
                  <div className={styles.rowMeta}>
                    <PontesBadge tone={tone} size="sm">{r.frequenciaDescricao}</PontesBadge>
                    {r.categoriaNome && (
                      <PontesBadge tone="primary" size="sm">{r.categoriaNome}</PontesBadge>
                    )}
                    {r.contaNome && <span className={styles.rowSub}>{r.contaNome}</span>}
                    {r.dataProximaGeracao && (
                      <span className={styles.rowSub}>próxima: {formatDate(r.dataProximaGeracao)}</span>
                    )}
                    {!r.ativo && r.motivoCancelamento && (
                      <span className={styles.rowCancelado}>cancelado: {r.motivoCancelamento}</span>
                    )}
                  </div>
                </div>

                {/* Value + actions */}
                <div className={styles.rowRight}>
                  <span className={styles.rowValor} data-tipo={isDespesa ? "despesa" : "receita"}>
                    {isDespesa ? "-" : "+"}{formatMoney(r.valor)}
                  </span>
                  <div className={styles.rowActions}>
                    {r.ativo && (
                      <>
                        <PontesIconButton
                          aria-label="Editar próxima ocorrência"
                          onClick={() => openEditarProxima(r)}
                          title="Editar próxima ocorrência"
                        >
                          <Pencil size={15} />
                        </PontesIconButton>
                        <PontesIconButton
                          aria-label="Cancelar assinatura"
                          onClick={() => openCancelar(r)}
                          title="Cancelar assinatura"
                        >
                          <XCircle size={15} />
                        </PontesIconButton>
                      </>
                    )}
                    <PontesIconButton
                      aria-label={r.ativo ? "Pausar" : "Ativar"}
                      onClick={() => handleToggle(r)}
                      title={r.ativo ? "Pausar" : "Ativar"}
                    >
                      {r.ativo ? <PauseCircle size={15} /> : <PlayCircle size={15} />}
                    </PontesIconButton>
                    <PontesIconButton
                      aria-label="Excluir assinatura"
                      onClick={() => openDeletar(r)}
                      title="Excluir"
                    >
                      <Trash2 size={15} />
                    </PontesIconButton>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ── Modal criar ──────────────────────────────────────────────────────── */}
      <PontesModal
        open={criarOpen}
        title="Nova Assinatura"
        onClose={() => setCriarOpen(false)}
        maxWidth={520}
        footer={
          <div className={styles.modalFooter}>
            <PontesButton variant="outline" size="sm" onClick={() => setCriarOpen(false)}>Cancelar</PontesButton>
            <PontesButton variant="primary" size="sm" loading={criarSaving} onClick={handleCriar}>
              Criar Assinatura
            </PontesButton>
          </div>
        }
      >
        <div className={styles.form}>
          <PontesField label="Descrição" required error={criarErrors.descricao}>
            <PontesInput
              placeholder="Ex: Netflix, Academia..."
              value={criarForm.descricao}
              invalid={!!criarErrors.descricao}
              onChange={e => {
                setCriarForm(f => ({ ...f, descricao: e.target.value }))
                if (criarErrors.descricao) setCriarErrors(e2 => ({ ...e2, descricao: undefined }))
              }}
            />
          </PontesField>

          <div className={styles.row2}>
            <PontesField label="Tipo" required>
              <PontesSelect
                options={tipoOpts}
                value={criarForm.tipo}
                onChange={v => setCriarForm(f => ({ ...f, tipo: v }))}
              />
            </PontesField>
            <PontesField label="Valor (R$)" required error={criarErrors.valor}>
              <PontesInput
                placeholder="0,00"
                inputMode="decimal"
                value={criarForm.valor}
                invalid={!!criarErrors.valor}
                onChange={e => {
                  setCriarForm(f => ({ ...f, valor: e.target.value }))
                  if (criarErrors.valor) setCriarErrors(e2 => ({ ...e2, valor: undefined }))
                }}
              />
            </PontesField>
          </div>

          <PontesField label="Conta" required error={criarErrors.contaId}>
            <PontesSelect
              options={contaOpts}
              value={criarForm.contaId}
              onChange={v => {
                setCriarForm(f => ({ ...f, contaId: v }))
                if (criarErrors.contaId) setCriarErrors(e => ({ ...e, contaId: undefined }))
              }}
              placeholder="Selecione uma conta"
              invalid={!!criarErrors.contaId}
            />
          </PontesField>

          <PontesField label="Categoria">
            <PontesSelect
              options={categoriaOpts}
              value={criarForm.categoriaId}
              onChange={v => setCriarForm(f => ({ ...f, categoriaId: v }))}
              placeholder="Sem categoria"
            />
          </PontesField>

          <div className={styles.row2}>
            <PontesField label="Frequência" required>
              <PontesSelect
                options={freqOpts}
                value={criarForm.frequencia}
                onChange={v => setCriarForm(f => ({ ...f, frequencia: v }))}
              />
            </PontesField>
            <PontesField label="Dia do mês" error={criarErrors.dia}>
              <PontesInput
                type="number"
                min={1}
                max={31}
                value={criarForm.dia}
                invalid={!!criarErrors.dia}
                onChange={e => {
                  setCriarForm(f => ({ ...f, dia: e.target.value }))
                  if (criarErrors.dia) setCriarErrors(e2 => ({ ...e2, dia: undefined }))
                }}
              />
            </PontesField>
          </div>

          <div className={styles.row2}>
            <PontesField label="Data início" required error={criarErrors.dataInicio}>
              <PontesInput
                type="date"
                value={criarForm.dataInicio}
                invalid={!!criarErrors.dataInicio}
                onChange={e => {
                  setCriarForm(f => ({ ...f, dataInicio: e.target.value }))
                  if (criarErrors.dataInicio) setCriarErrors(e2 => ({ ...e2, dataInicio: undefined }))
                }}
              />
            </PontesField>
            <PontesField label="Data fim (opcional)">
              <PontesInput
                type="date"
                value={criarForm.dataFim}
                onChange={e => setCriarForm(f => ({ ...f, dataFim: e.target.value }))}
              />
            </PontesField>
          </div>
        </div>
      </PontesModal>

      {/* ── Modal cancelar ───────────────────────────────────────────────────── */}
      <PontesModal
        open={cancelarOpen}
        title={`Cancelar: ${cancelarTarget?.descricao ?? ""}`}
        onClose={() => setCancelarOpen(false)}
        maxWidth={420}
        footer={
          <div className={styles.modalFooter}>
            <PontesButton variant="outline" size="sm" onClick={() => setCancelarOpen(false)}>Voltar</PontesButton>
            <PontesButton variant="danger" size="sm" loading={cancelarSaving} onClick={handleCancelar}>
              Confirmar cancelamento
            </PontesButton>
          </div>
        }
      >
        <div className={styles.form}>
          <p className={styles.cancelarInfo}>
            As transações futuras em <strong>Previsão</strong> serão canceladas.
            As já executadas serão mantidas.
          </p>
          <PontesField label="Motivo do cancelamento" required error={cancelarErrors.motivo}>
            <PontesInput
              placeholder="Ex: Não uso mais, preço alto..."
              value={cancelarForm.motivo}
              invalid={!!cancelarErrors.motivo}
              onChange={e => {
                setCancelarForm({ motivo: e.target.value })
                if (cancelarErrors.motivo) setCancelarErrors({})
              }}
            />
          </PontesField>
        </div>
      </PontesModal>

      {/* ── Modal editar próxima ─────────────────────────────────────────────── */}
      <PontesModal
        open={editarOpen}
        title={`Editar próxima: ${editarTarget?.descricao ?? ""}`}
        onClose={() => setEditarOpen(false)}
        maxWidth={420}
        footer={
          <div className={styles.modalFooter}>
            <PontesButton variant="outline" size="sm" onClick={() => setEditarOpen(false)}>Cancelar</PontesButton>
            <PontesButton variant="primary" size="sm" loading={editarSaving} onClick={handleEditarProxima}>
              Salvar
            </PontesButton>
          </div>
        }
      >
        <div className={styles.form}>
          <p className={styles.editarInfo}>
            Altere somente a <strong>próxima ocorrência</strong>. As seguintes não serão afetadas.
          </p>
          <PontesField label="Novo valor (opcional)" error={editarErrors.valor}>
            <PontesInput
              placeholder={editarTarget ? formatMoney(editarTarget.valor) : "0,00"}
              inputMode="decimal"
              value={editarForm.valor}
              invalid={!!editarErrors.valor}
              onChange={e => {
                setEditarForm(f => ({ ...f, valor: e.target.value }))
                if (editarErrors.valor) setEditarErrors(e2 => ({ ...e2, valor: undefined }))
              }}
            />
          </PontesField>
          <PontesField label="Nova descrição (opcional)">
            <PontesInput
              placeholder={editarTarget?.descricao ?? "Descrição..."}
              value={editarForm.descricao}
              onChange={e => setEditarForm(f => ({ ...f, descricao: e.target.value }))}
            />
          </PontesField>
        </div>
      </PontesModal>

      {/* ── Confirm dialog ───────────────────────────────────────────────────── */}
      {confirm && (
        <PontesDialog
          open
          title={confirm.title}
          description={confirm.description}
          tone={confirm.tone}
          confirmLabel="Confirmar"
          onConfirm={() => { void confirm.onConfirm().then(() => setConfirm(null)) }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
