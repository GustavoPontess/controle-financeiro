import { useCallback, useEffect, useState } from "react"
import { formatMoney } from "@/utils/money"
import { useOutletContext } from "react-router-dom"
import { BarChart2, Pencil, Trash2, Plus, AlertTriangle, XCircle } from "lucide-react"
import {
  PontesButton, PontesIconButton, PontesBadge,
  PontesModal, PontesDialog, PontesField, PontesInput,
  PontesSelect, PontesEmptyState, PontesLoadingDots,
} from "@/components/pontes"
import { getOrcamentos, criarOrcamento, atualizarOrcamento, excluirOrcamento } from "../../services/orcamentoService"
import { getCategories } from "../../services/categoryService"
import type { Orcamento, CriarOrcamentoDto } from "../../types/Orcamento"
import type { Category } from "../../types/Category"
import styles from "./LimitesPage.module.css"

type Notification = { open: boolean; message: string; severity: "success" | "error" }
type OutletContextType = { notify: React.Dispatch<React.SetStateAction<Notification>> }

type ConfirmState = {
  title: string
  description: string
  onConfirm: () => Promise<void>
  tone?: "danger" | "warning" | "info"
} | null

const MONTHS = [
  { value: "1", label: "Janeiro" }, { value: "2", label: "Fevereiro" },
  { value: "3", label: "Março" }, { value: "4", label: "Abril" },
  { value: "5", label: "Maio" }, { value: "6", label: "Junho" },
  { value: "7", label: "Julho" }, { value: "8", label: "Agosto" },
  { value: "9", label: "Setembro" }, { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" }, { value: "12", label: "Dezembro" },
]

function buildYears() {
  const cur = new Date().getFullYear()
  return Array.from({ length: 5 }, (_, i) => {
    const y = cur - 2 + i
    return { value: String(y), label: String(y) }
  })
}

const YEARS = buildYears()


// ── Form ────────────────────────────────────────────────────────────────────

type FormState = {
  categoriaId: string
  mes: string
  ano: string
  valorLimite: string
  percentualAlerta: string
}

const emptyForm = (): FormState => {
  const now = new Date()
  return {
    categoriaId: "",
    mes: String(now.getMonth() + 1),
    ano: String(now.getFullYear()),
    valorLimite: "",
    percentualAlerta: "80",
  }
}

const formFromOrcamento = (o: Orcamento): FormState => ({
  categoriaId: o.categoriaId ?? "",
  mes: String(o.mes),
  ano: String(o.ano),
  valorLimite: String(o.valorLimite),
  percentualAlerta: String(o.percentualAlerta),
})

type FormErrors = Partial<Record<keyof FormState, string>>

function validateForm(f: FormState): FormErrors {
  const errs: FormErrors = {}
  const v = parseFloat(f.valorLimite.replace(",", "."))
  if (!f.valorLimite || isNaN(v) || v <= 0) errs.valorLimite = "Informe um valor positivo."
  const p = parseFloat(f.percentualAlerta)
  if (!f.percentualAlerta || isNaN(p) || p < 1 || p > 100)
    errs.percentualAlerta = "Percentual entre 1 e 100."
  return errs
}

// ── Component ────────────────────────────────────────────────────────────────

export default function LimitesPage() {
  const { notify } = useOutletContext<OutletContextType>()

  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [ano, setAno] = useState(now.getFullYear())

  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  const [editOpen, setEditOpen] = useState(false)
  const [editOrcamento, setEditOrcamento] = useState<Orcamento | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)

  const [confirm, setConfirm] = useState<ConfirmState>(null)

  const loadOrcamentos = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getOrcamentos(mes, ano)
      setOrcamentos(res.data)
    } catch {
      notify({ open: true, message: "Erro ao carregar limites.", severity: "error" })
    } finally {
      setLoading(false)
    }
  }, [mes, ano, notify])

  useEffect(() => { loadOrcamentos() }, [loadOrcamentos])

  useEffect(() => {
    getCategories()
      .then(cats => setCategories(cats.filter(c => c.finalidade === 1 || c.finalidade === 3)))
      .catch(() => {/* silêncio — campo fica livre */ })
  }, [])

  // ── CRUD handlers ──────────────────────────────────────────────────────────

  function openCriar() {
    setEditOrcamento(null)
    setForm(emptyForm())
    setFormErrors({})
    setEditOpen(true)
  }

  function openEditar(o: Orcamento) {
    setEditOrcamento(o)
    setForm(formFromOrcamento(o))
    setFormErrors({})
    setEditOpen(true)
  }

  function closeEdit() {
    setEditOpen(false)
    setEditOrcamento(null)
    setFormErrors({})
  }

  async function handleSalvar() {
    const errs = validateForm(form)
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return }
    setSaving(true)
    try {
      const dto: CriarOrcamentoDto = {
        categoriaId: form.categoriaId || null,
        mes: parseInt(form.mes),
        ano: parseInt(form.ano),
        valorLimite: parseFloat(form.valorLimite.replace(",", ".")),
        percentualAlerta: parseFloat(form.percentualAlerta),
      }
      if (editOrcamento) {
        await atualizarOrcamento(editOrcamento.id, dto)
      } else {
        await criarOrcamento(dto)
      }
      notify({ open: true, message: editOrcamento ? "Limite atualizado!" : "Limite criado!", severity: "success" })
      closeEdit()
      // Ajusta período exibido se necessário
      setMes(dto.mes)
      setAno(dto.ano)
      loadOrcamentos()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      notify({ open: true, message: msg ?? "Erro ao salvar limite.", severity: "error" })
    } finally {
      setSaving(false)
    }
  }

  function confirmExcluir(o: Orcamento) {
    const nome = o.categoriaNome ?? "Geral"
    setConfirm({
      title: "Excluir limite",
      description: `Deseja excluir o limite de "${nome}"? O histórico de gastos não é afetado.`,
      tone: "danger",
      onConfirm: async () => {
        await excluirOrcamento(o.id)
        notify({ open: true, message: "Limite excluído.", severity: "success" })
        loadOrcamentos()
      },
    })
  }

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(f => ({ ...f, [k]: v }))
    if (formErrors[k]) setFormErrors(e => ({ ...e, [k]: undefined }))
  }

  // ── Category options ───────────────────────────────────────────────────────

  const categoryOptions = [
    { value: "", label: "Geral (todas as categorias)" },
    ...categories.map(c => ({ value: c.id, label: c.descricao })),
  ]

  const mesLabel = MONTHS.find(m => m.value === String(mes))?.label ?? String(mes)

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Limites por Categoria</h1>
          <p className={styles.subtitle}>Defina limites mensais de gasto e receba alertas</p>
        </div>
        <PontesButton variant="primary" size="sm" iconStart={<Plus size={16} />} onClick={openCriar}>
          Novo limite
        </PontesButton>
      </div>

      {/* Period selector */}
      <div className={styles.periodRow}>
        <span className={styles.periodLabel}>Período:</span>
        <div className={styles.periodSelects}>
          <PontesSelect
            options={MONTHS}
            value={String(mes)}
            onChange={v => setMes(parseInt(v))}
            fullWidth={false}
          />
          <PontesSelect
            options={YEARS}
            value={String(ano)}
            onChange={v => setAno(parseInt(v))}
            fullWidth={false}
          />
        </div>
      </div>

      {/* Hero/resumo — saúde do orçamento do período */}
      {!loading && orcamentos.length > 0 && (() => {
        const totalGasto = orcamentos.reduce((s, o) => s + o.valorGasto, 0)
        const totalOrcado = orcamentos.reduce((s, o) => s + o.valorLimite, 0)
        const pctGeral = totalOrcado > 0 ? (totalGasto / totalOrcado) * 100 : 0
        const nEstourado = orcamentos.filter((o) => o.ultrapassado).length
        const nAlerta = orcamentos.filter((o) => o.emAlerta && !o.ultrapassado).length
        const tone = nEstourado > 0 ? "danger" : nAlerta > 0 ? "warning" : "ok"
        return (
          <div className={styles.hero} data-tone={tone}>
            <div className={styles.heroBlob} />
            <div className={styles.heroMain}>
              <div className={styles.heroLabel}>Gasto no período</div>
              <div className={styles.heroValue}>{formatMoney(totalGasto)}</div>
              <div className={styles.heroSub}>de {formatMoney(totalOrcado)} orçados · {pctGeral.toFixed(0)}%</div>
              <div className={styles.heroTrack}>
                <div className={styles.heroFill} data-tone={tone} style={{ width: `${Math.min(100, pctGeral)}%` }} />
              </div>
            </div>
            <div className={styles.heroStats}>
              <div className={styles.heroStat}>
                <span className={styles.heroStatValue} data-tone={nAlerta > 0 ? "warning" : undefined}>{nAlerta}</span>
                <span className={styles.heroStatLabel}>em alerta</span>
              </div>
              <div className={styles.heroStatDivider} />
              <div className={styles.heroStat}>
                <span className={styles.heroStatValue} data-tone={nEstourado > 0 ? "danger" : undefined}>{nEstourado}</span>
                <span className={styles.heroStatLabel}>estourados</span>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Content */}
      {loading ? (
        <PontesLoadingDots />
      ) : orcamentos.length === 0 ? (
        <PontesEmptyState
          icon={<BarChart2 size={40} />}
          title="Nenhum limite definido"
          description={`Crie limites de gasto para ${mesLabel}/${ano} e acompanhe o consumo.`}
          actions={
            <PontesButton variant="primary" size="sm" onClick={openCriar}>
              Criar limite
            </PontesButton>
          }
        />
      ) : (
        <div className={styles.grid}>
          {orcamentos.map(o => (
            <LimiteCard
              key={o.id}
              orcamento={o}
              onEdit={openEditar}
              onExcluir={confirmExcluir}
            />
          ))}
        </div>
      )}

      {/* Modal criar/editar */}
      <PontesModal
        open={editOpen}
        onClose={closeEdit}
        title={editOrcamento ? "Editar limite" : "Novo limite"}
        footer={
          <>
            <PontesButton variant="ghost" size="sm" onClick={closeEdit} disabled={saving}>Cancelar</PontesButton>
            <PontesButton variant="primary" size="sm" onClick={handleSalvar} loading={saving}>
              {editOrcamento ? "Salvar" : "Criar"}
            </PontesButton>
          </>
        }
      >
        <div className={styles.fields}>
          <PontesField label="Categoria">
            <PontesSelect
              options={categoryOptions}
              value={form.categoriaId}
              onChange={v => setField("categoriaId", v)}
              placeholder="Geral (todas as categorias)"
            />
          </PontesField>

          <div className={styles.row}>
            <PontesField label="Mês">
              <PontesSelect
                options={MONTHS}
                value={form.mes}
                onChange={v => setField("mes", v)}
                disabled={!!editOrcamento}
              />
            </PontesField>
            <PontesField label="Ano">
              <PontesSelect
                options={YEARS}
                value={form.ano}
                onChange={v => setField("ano", v)}
                disabled={!!editOrcamento}
              />
            </PontesField>
          </div>

          <div className={styles.row}>
            <PontesField label="Limite (R$)" required error={formErrors.valorLimite}>
              <PontesInput
                value={form.valorLimite}
                onChange={e => setField("valorLimite", e.target.value)}
                placeholder="0,00"
                type="number"
                min={0.01}
                step={0.01}
                invalid={!!formErrors.valorLimite}
              />
            </PontesField>
            <PontesField label="Alertar em (%)" required error={formErrors.percentualAlerta}>
              <PontesInput
                value={form.percentualAlerta}
                onChange={e => setField("percentualAlerta", e.target.value)}
                placeholder="80"
                type="number"
                min={1}
                max={100}
                step={1}
                invalid={!!formErrors.percentualAlerta}
              />
            </PontesField>
          </div>
        </div>
      </PontesModal>

      {/* Confirm dialog */}
      <PontesDialog
        open={confirm !== null}
        title={confirm?.title ?? ""}
        description={confirm?.description}
        tone={confirm?.tone ?? "danger"}
        confirmLabel="Excluir"
        onConfirm={async () => {
          if (!confirm) return
          await confirm.onConfirm()
          setConfirm(null)
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}

// ── LimiteCard ───────────────────────────────────────────────────────────────

type LimiteCardProps = {
  orcamento: Orcamento
  onEdit: (o: Orcamento) => void
  onExcluir: (o: Orcamento) => void
}

function LimiteCard({ orcamento: o, onEdit, onExcluir }: LimiteCardProps) {
  const pct = Math.min(150, o.percentualConsumido)
  const nome = o.categoriaNome ?? "Geral"

  const barClass = o.ultrapassado
    ? styles.progressFillUltrapassado
    : o.emAlerta
      ? styles.progressFillAlerta
      : styles.progressFill

  return (
    <div className={`${styles.card} ${o.ultrapassado ? styles.cardUltrapassado : o.emAlerta ? styles.cardAlerta : ""}`}>
      {/* Header */}
      <div className={styles.cardHeader}>
        <div style={{ flex: 1 }}>
          <p className={styles.cardNome}>{nome}</p>
          <p className={styles.cardPeriodo}>
            {MONTHS.find(m => m.value === String(o.mes))?.label} / {o.ano}
          </p>
        </div>
        <div className={styles.cardActions}>
          {o.ultrapassado && (
            <PontesBadge tone="danger" size="sm">
              <XCircle size={11} style={{ marginRight: 3 }} />
              Ultrapassado
            </PontesBadge>
          )}
          {!o.ultrapassado && o.emAlerta && (
            <PontesBadge tone="warning" size="sm">
              <AlertTriangle size={11} style={{ marginRight: 3 }} />
              Em alerta
            </PontesBadge>
          )}
          <PontesIconButton size={32} variant="ghost" title="Editar" onClick={() => onEdit(o)}>
            <Pencil size={14} />
          </PontesIconButton>
          <PontesIconButton size={32} variant="ghost" title="Excluir" onClick={() => onExcluir(o)}>
            <Trash2 size={14} />
          </PontesIconButton>
        </div>
      </div>

      {/* Progress */}
      <div className={styles.progressWrap}>
        <div className={styles.progressBar}>
          <div className={barClass} style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
        <div className={styles.progressLabels}>
          <span>{formatMoney(o.valorGasto)} gastos</span>
          <span className={o.ultrapassado ? styles.pctUltrapassado : o.emAlerta ? styles.pctAlerta : styles.pctNormal}>
            {o.percentualConsumido.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className={styles.cardFooter}>
        <div className={styles.valoresWrap}>
          <span className={styles.valorGasto}>{formatMoney(o.valorGasto)}</span>
          <span className={styles.valorLimite}>de {formatMoney(o.valorLimite)}</span>
        </div>
        <div className={styles.restanteWrap}>
          <span className={styles.restanteLabel}>Restante</span>
          <span className={o.valorRestante < 0 ? styles.restanteNegativo : styles.restantePositivo}>
            {formatMoney(Math.abs(o.valorRestante))}
            {o.valorRestante < 0 ? " a mais" : ""}
          </span>
        </div>
      </div>

      {/* Alert threshold indicator */}
      <div className={styles.alertRow}>
        <span className={styles.alertLabel}>Alerta em {o.percentualAlerta}%</span>
      </div>
    </div>
  )
}
