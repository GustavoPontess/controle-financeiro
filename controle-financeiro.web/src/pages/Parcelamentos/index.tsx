import React, { useCallback, useEffect, useState } from "react"
import { useNavigate, useOutletContext } from "react-router-dom"
import { Plus, Trash2, ChevronRight, Layers } from "lucide-react"
import {
  PontesButton, PontesCard, PontesBadge, PontesIconButton, PontesStatCard,
  PontesModal, PontesDialog, PontesField, PontesInput, PontesSelect, PontesEmptyState,
} from "@/components/pontes"
import { ParcelamentoService } from "../../services/ParcelamentoService"
import { getCartoes } from "../../services/cartaoCreditoService"
import { TipoParcelamento } from "../../types/Parcelamento"
import type { Parcelamento, CriarParcelamentoPayload } from "../../types/Parcelamento"
import type { CartaoCredito } from "../../types/CartaoCredito"
import styles from "./ParcelamentosPage.module.css"

const formatMoney = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)

const formatarMesAno = (mesAno: string) => {
  const [ano, mes] = mesAno.split("-")
  const meses = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"]
  return `${meses[parseInt(mes) - 1]}/${ano}`
}

const parseMoney = (masked: string): number | undefined => {
  const digits = masked.replace(/\D/g, "")
  return digits ? Number(digits) / 100 : undefined
}
const fmtMoney = (n?: number): string =>
  n != null ? n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""

const TIPOS_OPTS = [
  { value: "0", label: "Compra Parcelada" },
  { value: "1", label: "PIX Crédito" },
]

const tiposLabel: Record<number, string> = {
  0: "Compra Parcelada",
  1: "PIX Crédito",
}

type FormState = {
  descricao: string
  valor?: number
  tipo: string
  cartaoCreditoId: string
  dataCompra: string
  parcelas: number
  primeiraParcelaMes: string
  taxaJuroMensal?: number
}
type Errors = Partial<Record<"descricao" | "valor" | "cartaoCreditoId" | "parcelas" | "taxaJuroMensal", string>>

type Notification = { open: boolean; message: string; severity: "success" | "error" }
type OutletContextType = { notify: React.Dispatch<React.SetStateAction<Notification>> }

const emptyForm = (proximoMes: string): FormState => ({
  descricao: "", valor: undefined, tipo: "0", cartaoCreditoId: "",
  dataCompra: new Date().toISOString().split("T")[0],
  parcelas: 3, primeiraParcelaMes: proximoMes, taxaJuroMensal: undefined,
})

export default function ParcelamentosPage() {
  const navigate = useNavigate()
  const { notify } = useOutletContext<OutletContextType>()
  const [parcelamentos, setParcelamentos] = useState<Parcelamento[]>([])
  const [cartoes, setCartoes] = useState<CartaoCredito[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cancelarId, setCancelarId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 1)
    return emptyForm(d.toISOString().split("T")[0].substring(0, 7))
  })
  const [errors, setErrors] = useState<Errors>({})

  const loadData = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([ParcelamentoService.listar(), getCartoes()])
      setParcelamentos(p)
      setCartoes(c)
    } catch {
      notify({ open: true, message: "Erro ao carregar parcelamentos", severity: "error" })
    }
  }, [notify])

  useEffect(() => { void loadData() }, [loadData])

  const clearErr = (k: keyof Errors) => setErrors((p) => ({ ...p, [k]: undefined }))
  const setF = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  const openCreate = () => {
    const d = new Date(); d.setMonth(d.getMonth() + 1)
    setForm(emptyForm(d.toISOString().split("T")[0].substring(0, 7)))
    setErrors({})
    setDialogOpen(true)
  }

  const handleCriar = async () => {
    const e: Errors = {}
    if (!form.descricao.trim()) e.descricao = "Informe a descrição"
    if (form.valor == null) e.valor = "Informe o valor"
    else if (form.valor <= 0) e.valor = "Valor deve ser maior que zero"
    if (!form.cartaoCreditoId) e.cartaoCreditoId = "Selecione o cartão"
    if (form.parcelas < 2 || form.parcelas > 36) e.parcelas = "Entre 2 e 36 parcelas"
    if (form.tipo === "1") {
      const t = form.taxaJuroMensal ?? 0
      if (t < 1.99 || t > 11.99) e.taxaJuroMensal = "PIX Crédito exige juros entre 1,99 e 11,99%"
    }
    setErrors(e)
    if (Object.keys(e).length) return

    setLoading(true)
    try {
      const payload: CriarParcelamentoPayload = {
        descricao: form.descricao.trim(),
        valor: form.valor!,
        tipo: Number(form.tipo) as TipoParcelamento,
        cartaoCreditoId: form.cartaoCreditoId,
        dataCompra: form.dataCompra,
        parcelas: form.parcelas,
        primeiraParcelaMes: form.primeiraParcelaMes,
        taxaJuroMensal: form.taxaJuroMensal ?? 0,
        idempotencyKey: crypto.randomUUID(),
      }
      await ParcelamentoService.criar(payload)
      notify({ open: true, message: "Parcelamento criado", severity: "success" })
      setDialogOpen(false)
      await loadData()
    } catch {
      notify({ open: true, message: "Erro ao criar parcelamento", severity: "error" })
    } finally { setLoading(false) }
  }

  const handleCancelar = async () => {
    if (!cancelarId) return
    try {
      await ParcelamentoService.cancelar(cancelarId, {
        motivo: "Cancelamento via dashboard",
        idempotencyKey: crypto.randomUUID(),
      })
      notify({ open: true, message: "Parcelamento cancelado", severity: "success" })
      await loadData()
    } catch {
      notify({ open: true, message: "Erro ao cancelar parcelamento", severity: "error" })
    } finally { setCancelarId(null) }
  }

  const ativos = parcelamentos.filter((p) => p.ativo).length
  const totalRestante = parcelamentos.filter((p) => p.ativo).reduce((s, p) => s + p.valorRestante, 0)

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Parcelamentos</h1>
          <div className={styles.subtitle}>Acompanhe suas compras parceladas no cartão</div>
        </div>
        <PontesButton size="sm" iconStart={<Plus size={16} strokeWidth={2.5} />} onClick={openCreate}>
          Novo Parcelamento
        </PontesButton>
      </div>

      <div className={styles.statsGrid}>
        <PontesStatCard label="Ativos" value={String(ativos)} hint="parcelamentos em andamento" />
        <PontesStatCard label="A pagar" value={formatMoney(totalRestante)} hint="soma dos restantes" tone="danger" />
      </div>

      <PontesCard padding={0} radius={16}>
        <div className={styles.listHead}>
          <span className={styles.listHeadTitle}>Seus parcelamentos</span>
          <span className={styles.listHeadMeta}>{parcelamentos.length} {parcelamentos.length === 1 ? "registrado" : "registrados"}</span>
        </div>

        {parcelamentos.length === 0 ? (
          <div className={styles.emptyWrap}>
            <PontesEmptyState
              icon={<Layers size={28} />}
              title="Nenhum parcelamento cadastrado"
              description="Crie um novo parcelamento pra começar a acompanhar suas compras parceladas."
            />
          </div>
        ) : (
          <ul className={styles.list}>
            {parcelamentos.map((p) => {
              const pct = (p.parcelasPagas / p.quantidadeParcelas) * 100
              return (
                <li key={p.id} className={styles.item} data-inactive={!p.ativo ? "true" : undefined}>
                  <div className={styles.itemMain}>
                    <div className={styles.itemHead}>
                      <span className={styles.itemDesc}>{p.descricao}</span>
                      <PontesBadge tone="neutral" size="sm">{tiposLabel[p.tipo] ?? "Desconhecido"}</PontesBadge>
                      <span className={styles.itemPills}>{p.quantidadeParcelas} parcelas</span>
                    </div>
                    <div className={styles.itemRowMid}>
                      <span className={styles.itemAmount}>{formatMoney(p.valorOriginal)}</span>
                      <span className={styles.itemMuted}>{p.parcelasPagas}/{p.quantidadeParcelas} pago</span>
                    </div>
                    <div className={styles.progressWrap}>
                      <div className={styles.progressMeta}>
                        <span>Progresso</span>
                        <span className={styles.progressPct}>{pct.toFixed(0)}%</span>
                      </div>
                      <div className={styles.bar}>
                        <div className={styles.barFill} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    {p.proximaParcela && (
                      <div className={styles.proxima}>
                        <span className={styles.proximaLabel}>Próxima parcela</span>
                        <div className={styles.proximaRow}>
                          <span>Fatura {formatarMesAno(p.proximaParcela.dataVencimento.split("T")[0].substring(0, 7))}</span>
                          <strong>{formatMoney(p.proximaParcela.valor)}</strong>
                        </div>
                      </div>
                    )}
                    <div className={styles.itemRowBot}>
                      <span className={styles.itemMuted}>Restante: <strong>{formatMoney(p.valorRestante)}</strong></span>
                    </div>
                  </div>

                  <div className={styles.itemActions}>
                    <PontesButton variant="outline" size="sm" iconEnd={<ChevronRight size={14} />}
                      onClick={() => navigate(`/parcelamentos/${p.id}`)}>
                      Detalhes
                    </PontesButton>
                    {p.ativo && (
                      <PontesIconButton size={32} variant="ghost" aria-label="Cancelar parcelamento"
                        onClick={() => setCancelarId(p.id)}>
                        <Trash2 size={14} />
                      </PontesIconButton>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </PontesCard>

      <PontesModal
        open={dialogOpen}
        title="Novo parcelamento"
        onClose={() => setDialogOpen(false)}
        footer={<>
          <PontesButton variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</PontesButton>
          <PontesButton onClick={handleCriar} loading={loading} disabled={loading}>Criar</PontesButton>
        </>}
      >
        <form noValidate onSubmit={(e) => { e.preventDefault(); void handleCriar() }} className={styles.formCol}>
          <PontesField label="Descrição" required error={errors.descricao}>
            <PontesInput
              value={form.descricao}
              onChange={(e) => { setF("descricao", e.target.value); clearErr("descricao") }}
              invalid={!!errors.descricao}
              placeholder="Ex: Notebook, Monitor"
            />
          </PontesField>

          <div className={styles.grid2}>
            <PontesField label="Valor" required error={errors.valor}>
              <PontesInput
                iconStart="R$"
                value={fmtMoney(form.valor)}
                onChange={(e) => { setF("valor", parseMoney(e.target.value)); clearErr("valor") }}
                invalid={!!errors.valor}
                inputMode="decimal"
                placeholder="0,00"
              />
            </PontesField>
            <PontesField label="Parcelas" required error={errors.parcelas}>
              <PontesInput
                type="number"
                value={String(form.parcelas)}
                onChange={(e) => { setF("parcelas", Number(e.target.value)); clearErr("parcelas") }}
                invalid={!!errors.parcelas}
                min={2} max={36} step={1} inputMode="numeric"
              />
            </PontesField>
          </div>

          <div className={styles.grid2}>
            <PontesField label="Data da compra" required>
              <PontesInput type="date" value={form.dataCompra} onChange={(e) => setF("dataCompra", e.target.value)} />
            </PontesField>
            <PontesField label="Primeira parcela (mês)" required>
              <PontesInput type="month" value={form.primeiraParcelaMes} onChange={(e) => setF("primeiraParcelaMes", e.target.value)} />
            </PontesField>
          </div>

          <PontesField label="Tipo" required>
            <PontesSelect value={form.tipo} onChange={(v) => setF("tipo", v)} options={TIPOS_OPTS} />
          </PontesField>

          <PontesField label="Cartão" required error={errors.cartaoCreditoId}>
            <PontesSelect
              value={form.cartaoCreditoId}
              onChange={(v) => { setF("cartaoCreditoId", v); clearErr("cartaoCreditoId") }}
              invalid={!!errors.cartaoCreditoId}
              placeholder="Selecione o cartão"
              options={cartoes.map((c) => ({ value: c.id, label: c.nome }))}
            />
          </PontesField>

          {form.tipo === "1" && (
            <PontesField label="Taxa de juros mensal (%)" required error={errors.taxaJuroMensal} helper="1,99% a 11,99%">
              <PontesInput
                type="number"
                value={form.taxaJuroMensal != null ? String(form.taxaJuroMensal) : ""}
                onChange={(e) => { setF("taxaJuroMensal", e.target.value ? Number(e.target.value) : undefined); clearErr("taxaJuroMensal") }}
                invalid={!!errors.taxaJuroMensal}
                min={1.99} max={11.99} step="0.01" inputMode="decimal"
              />
            </PontesField>
          )}
        </form>
      </PontesModal>

      <PontesDialog
        open={cancelarId !== null}
        title="Cancelar parcelamento?"
        description="As parcelas pendentes serão removidas. Esta ação não pode ser desfeita."
        confirmLabel="Cancelar parcelamento"
        onConfirm={handleCancelar}
        onCancel={() => setCancelarId(null)}
      />
    </div>
  )
}
