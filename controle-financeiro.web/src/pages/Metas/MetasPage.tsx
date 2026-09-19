import { useCallback, useEffect, useState } from "react"
import { formatMoney } from "@/utils/money"
import { useOutletContext } from "react-router-dom"
import { Target, Pencil, Trash2, Plus, Calendar } from "lucide-react"
import {
  PontesButton, PontesIconButton, PontesBadge,
  PontesModal, PontesDialog, PontesField, PontesInput, PontesDateInput,
  PontesEmptyState, PontesLoadingDots,
} from "@/components/pontes"
import {
  getMetas, criarMeta, atualizarMeta, contribuirMeta, excluirMeta,
} from "../../services/metaService"
import type { Meta, CriarMetaDto } from "../../types/Meta"
import styles from "./MetasPage.module.css"

type Notification = { open: boolean; message: string; severity: "success" | "error" }
type OutletContextType = { notify: React.Dispatch<React.SetStateAction<Notification>> }

type ConfirmState = {
  title: string
  description: string
  onConfirm: () => Promise<void>
  tone?: "danger" | "warning" | "info"
} | null


const formatDate = (s: string) =>
  new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })

// Dias até a data limite (negativo = passou). Pra mostrar urgência de prazo.
const diasAtePrazo = (s: string | null): number | null => {
  if (!s) return null
  const d = new Date(s)
  const now = new Date()
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

// ── Form state ──────────────────────────────────────────────────────────────

type FormState = {
  nome: string
  descricao: string
  valorAlvo: string
  dataLimite: string
}

const emptyForm = (): FormState => ({ nome: "", descricao: "", valorAlvo: "", dataLimite: "" })
const formFromMeta = (m: Meta): FormState => ({
  nome: m.nome,
  descricao: m.descricao ?? "",
  valorAlvo: String(m.valorAlvo),
  dataLimite: m.dataLimite ? m.dataLimite.slice(0, 10) : "",
})

type FormErrors = Partial<Record<keyof FormState, string>>

function validateForm(f: FormState): FormErrors {
  const errs: FormErrors = {}
  if (!f.nome.trim()) errs.nome = "Nome é obrigatório."
  const v = parseFloat(f.valorAlvo.replace(",", "."))
  if (!f.valorAlvo || isNaN(v) || v <= 0) errs.valorAlvo = "Informe um valor positivo."
  return errs
}

// ── Component ───────────────────────────────────────────────────────────────

export default function MetasPage() {
  const { notify } = useOutletContext<OutletContextType>()
  const [metas, setMetas] = useState<Meta[]>([])
  const [loading, setLoading] = useState(true)

  // modal criar/editar
  const [editOpen, setEditOpen] = useState(false)
  const [editMeta, setEditMeta] = useState<Meta | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)

  // contribuir
  const [contribOpen, setContribOpen] = useState(false)
  const [contribMeta, setContribMeta] = useState<Meta | null>(null)
  const [contribValor, setContribValor] = useState("")
  const [contribError, setContribError] = useState("")
  const [contribSaving, setContribSaving] = useState(false)

  // confirmação de exclusão
  const [confirm, setConfirm] = useState<ConfirmState>(null)

  const load = useCallback(async () => {
    try {
      const res = await getMetas()
      setMetas(res.data)
    } catch {
      notify({ open: true, message: "Erro ao carregar metas.", severity: "error" })
    } finally {
      setLoading(false)
    }
  }, [notify])

  useEffect(() => { load() }, [load])

  // ── CRUD handlers ─────────────────────────────────────────────────────────

  function openCriar() {
    setEditMeta(null)
    setForm(emptyForm())
    setFormErrors({})
    setEditOpen(true)
  }

  function openEditar(m: Meta) {
    setEditMeta(m)
    setForm(formFromMeta(m))
    setFormErrors({})
    setEditOpen(true)
  }

  function closeEdit() {
    setEditOpen(false)
    setEditMeta(null)
    setFormErrors({})
  }

  async function handleSalvar() {
    const errs = validateForm(form)
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return }
    setSaving(true)
    try {
      const dto: CriarMetaDto = {
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null,
        valorAlvo: parseFloat(form.valorAlvo.replace(",", ".")),
        dataLimite: form.dataLimite || null,
      }
      if (editMeta) {
        await atualizarMeta(editMeta.id, dto)
      } else {
        await criarMeta(dto)
      }
      notify({ open: true, message: editMeta ? "Meta atualizada!" : "Meta criada!", severity: "success" })
      closeEdit()
      load()
    } catch {
      notify({ open: true, message: "Erro ao salvar meta.", severity: "error" })
    } finally {
      setSaving(false)
    }
  }

  function openContribuir(m: Meta) {
    setContribMeta(m)
    setContribValor("")
    setContribError("")
    setContribOpen(true)
  }

  async function handleContribuir() {
    const v = parseFloat(contribValor.replace(",", "."))
    if (!contribValor || isNaN(v) || v === 0) {
      setContribError("Informe um valor válido (positivo para adicionar, negativo para remover).")
      return
    }
    setContribSaving(true)
    try {
      await contribuirMeta(contribMeta!.id, { valor: v })
      notify({ open: true, message: "Contribuição registrada!", severity: "success" })
      setContribOpen(false)
      load()
    } catch {
      notify({ open: true, message: "Erro ao registrar contribuição.", severity: "error" })
    } finally {
      setContribSaving(false)
    }
  }

  function confirmExcluir(m: Meta) {
    setConfirm({
      title: "Excluir meta",
      description: `Deseja excluir a meta "${m.nome}"? Essa ação não pode ser desfeita.`,
      tone: "danger",
      onConfirm: async () => {
        await excluirMeta(m.id)
        notify({ open: true, message: "Meta excluída.", severity: "success" })
        load()
      },
    })
  }

  // ── Form field helpers ────────────────────────────────────────────────────

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(f => ({ ...f, [k]: v }))
    if (formErrors[k]) setFormErrors(e => ({ ...e, [k]: undefined }))
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Metas</h1>
          <p className={styles.subtitle}>Acompanhe seus objetivos financeiros</p>
        </div>
        <PontesButton variant="primary" size="sm" iconStart={<Plus size={16} />} onClick={openCriar}>
          Nova meta
        </PontesButton>
      </div>

      {/* Hero/resumo — total guardado vs alvo + % geral */}
      {!loading && metas.length > 0 && (() => {
        const totalGuardado = metas.reduce((s, m) => s + m.valorAtual, 0)
        const totalAlvo = metas.reduce((s, m) => s + m.valorAlvo, 0)
        const pctGeral = totalAlvo > 0 ? Math.min(100, (totalGuardado / totalAlvo) * 100) : 0
        const concluidas = metas.filter((m) => m.concluida).length
        return (
          <div className={styles.hero}>
            <div className={styles.heroBlob} />
            <div className={styles.heroMain}>
              <div className={styles.heroLabel}>Total guardado nas metas</div>
              <div className={styles.heroValue}>{formatMoney(totalGuardado)}</div>
              <div className={styles.heroSub}>de {formatMoney(totalAlvo)} · {pctGeral.toFixed(0)}% do total</div>
              <div className={styles.heroTrack}>
                <div className={styles.heroFill} style={{ width: `${pctGeral}%` }} />
              </div>
            </div>
            <div className={styles.heroStats}>
              <div className={styles.heroStat}>
                <span className={styles.heroStatValue}>{metas.length}</span>
                <span className={styles.heroStatLabel}>metas</span>
              </div>
              <div className={styles.heroStatDivider} />
              <div className={styles.heroStat}>
                <span className={styles.heroStatValue}>{concluidas}</span>
                <span className={styles.heroStatLabel}>concluídas</span>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Content */}
      {loading ? (
        <PontesLoadingDots />
      ) : metas.length === 0 ? (
        <PontesEmptyState
          icon={<Target size={40} />}
          title="Nenhuma meta ainda"
          description="Crie sua primeira meta financeira e acompanhe o progresso."
        />
      ) : (
        <div className={styles.grid}>
          {metas.map(m => <MetaCard key={m.id} meta={m} onEdit={openEditar} onContribuir={openContribuir} onExcluir={confirmExcluir} />)}
        </div>
      )}

      {/* Modal criar/editar */}
      <PontesModal
        open={editOpen}
        onClose={closeEdit}
        title={editMeta ? "Editar meta" : "Nova meta"}
        footer={
          <>
            <PontesButton variant="ghost" size="sm" onClick={closeEdit} disabled={saving}>Cancelar</PontesButton>
            <PontesButton variant="primary" size="sm" onClick={handleSalvar} loading={saving}>
              {editMeta ? "Salvar" : "Criar"}
            </PontesButton>
          </>
        }
      >
        <div className={styles.fields}>
          <PontesField label="Nome" required error={formErrors.nome}>
            <PontesInput
              value={form.nome}
              onChange={e => setField("nome", e.target.value)}
              placeholder="Ex: Viagem para Europa"
              invalid={!!formErrors.nome}
              maxLength={120}
            />
          </PontesField>

          <PontesField label="Descrição">
            <PontesInput
              value={form.descricao}
              onChange={e => setField("descricao", e.target.value)}
              placeholder="Opcional"
              maxLength={500}
            />
          </PontesField>

          <div className={styles.row}>
            <PontesField label="Valor alvo (R$)" required error={formErrors.valorAlvo}>
              <PontesInput
                value={form.valorAlvo}
                onChange={e => setField("valorAlvo", e.target.value)}
                placeholder="0,00"
                type="number"
                min={0.01}
                step={0.01}
                invalid={!!formErrors.valorAlvo}
              />
            </PontesField>

            <PontesField label="Data limite">
              <PontesDateInput
                value={form.dataLimite}
                onChange={(v) => setField("dataLimite", v)}
              />
            </PontesField>
          </div>
        </div>
      </PontesModal>

      {/* Modal contribuir */}
      <PontesModal
        open={contribOpen}
        onClose={() => setContribOpen(false)}
        title="Contribuir para a meta"
        footer={
          <>
            <PontesButton variant="ghost" size="sm" onClick={() => setContribOpen(false)} disabled={contribSaving}>Cancelar</PontesButton>
            <PontesButton variant="primary" size="sm" onClick={handleContribuir} loading={contribSaving}>
              Registrar
            </PontesButton>
          </>
        }
      >
        {contribMeta && (
          <div>
            <p className={styles.contributeInfo}>
              Meta: <strong>{contribMeta.nome}</strong>
              {" · "}Acumulado: <strong>{formatMoney(contribMeta.valorAtual)}</strong>
              {" / "}{formatMoney(contribMeta.valorAlvo)}
            </p>
            <PontesField
              label="Valor (R$)"
              required
              helper="Use valor positivo para adicionar, negativo para remover."
              error={contribError}
            >
              <PontesInput
                value={contribValor}
                onChange={e => { setContribValor(e.target.value); setContribError("") }}
                placeholder="Ex: 500 ou -100"
                type="number"
                step={0.01}
                invalid={!!contribError}
              />
            </PontesField>
          </div>
        )}
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

// ── MetaCard ─────────────────────────────────────────────────────────────────

type MetaCardProps = {
  meta: Meta
  onEdit: (m: Meta) => void
  onContribuir: (m: Meta) => void
  onExcluir: (m: Meta) => void
}

function MetaCard({ meta, onEdit, onContribuir, onExcluir }: MetaCardProps) {
  const pct = Math.min(100, meta.percentualConcluido)

  return (
    <div className={`${styles.card} ${meta.concluida ? styles.cardConcluida : ""}`}>
      {/* Header */}
      <div className={styles.cardHeader}>
        <div style={{ flex: 1 }}>
          <p className={styles.cardNome}>{meta.nome}</p>
          {meta.descricao && <p className={styles.cardDescricao}>{meta.descricao}</p>}
        </div>
        <div className={styles.cardActions}>
          {meta.concluida && (
            <PontesBadge tone="success" size="sm">
              Concluída
            </PontesBadge>
          )}
          <PontesIconButton size={32} variant="ghost" title="Editar" onClick={() => onEdit(meta)}>
            <Pencil size={14} />
          </PontesIconButton>
          <PontesIconButton size={32} variant="ghost" title="Excluir" onClick={() => onExcluir(meta)}>
            <Trash2 size={14} />
          </PontesIconButton>
        </div>
      </div>

      {/* Progress */}
      <div className={styles.progressWrap}>
        <div className={styles.progressBar}>
          <div
            className={`${styles.progressFill} ${meta.concluida ? styles.progressFillConcluida : ""}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className={styles.progressLabels}>
          <span className={styles.valorAtual}>{formatMoney(meta.valorAtual)} <span className={styles.valorAlvo}>de {formatMoney(meta.valorAlvo)}</span></span>
          <span className={styles.progressPct} data-done={meta.concluida ? "true" : undefined}>{pct.toFixed(0)}%</span>
        </div>
      </div>

      {/* Falta + prazo */}
      {!meta.concluida && (
        <div className={styles.faltaRow}>
          <span className={styles.faltaValor}>
            Faltam <strong>{formatMoney(Math.max(0, meta.valorAlvo - meta.valorAtual))}</strong>
          </span>
          {(() => {
            const dias = diasAtePrazo(meta.dataLimite)
            if (dias == null) return null
            const atrasada = dias < 0
            return (
              <span className={styles.prazo} data-atrasada={atrasada ? "true" : undefined}>
                <Calendar size={12} strokeWidth={2.4} />
                {atrasada ? `venceu há ${Math.abs(dias)}d` : dias === 0 ? "vence hoje" : `faltam ${dias} dias`}
              </span>
            )
          })()}
        </div>
      )}

      {/* Footer */}
      <div className={styles.cardFooter}>
        {meta.concluida ? (
          <span className={styles.celebracao}>🎉 Meta batida!</span>
        ) : (
          <span className={styles.dataLimite}>
            {meta.dataLimite ? <>{<Calendar size={12} />} {formatDate(meta.dataLimite)}</> : "Sem prazo"}
          </span>
        )}
        <PontesButton
          variant={meta.concluida ? "ghost" : "primary"}
          size="xs"
          onClick={() => onContribuir(meta)}
          disabled={meta.concluida}
        >
          {meta.concluida ? "Concluída ✓" : "Contribuir"}
        </PontesButton>
      </div>
    </div>
  )
}
