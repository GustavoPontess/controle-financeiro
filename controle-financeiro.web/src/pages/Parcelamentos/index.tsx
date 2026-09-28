import React, { useCallback, useEffect, useState } from "react"
import { dataLocalISO } from "@/utils/dateTime"
import { formatMoney } from "@/utils/money"
import { useNavigate, useOutletContext } from "react-router-dom"
import { Plus, Trash2, ChevronRight, Layers } from "lucide-react"
import {
  PontesButton, PontesCard, PontesBadge, PontesIconButton, PontesStatCard,
  PontesModal, PontesDialog, PontesField, PontesInput, PontesDateInput, PontesMonthInput, PontesSelect,
  PontesEmptyState, PontesTablePagination, PONTES_TABLE_PAGE_SIZE_DEFAULT,
} from "@/components/pontes"
import { ParcelamentoService } from "../../services/ParcelamentoService"
import { getCartoes } from "../../services/cartaoCreditoService"
import { TipoParcelamento } from "../../types/Parcelamento"
import type { Parcelamento, CriarParcelamentoPayload } from "../../types/Parcelamento"
import type { CartaoCredito } from "../../types/CartaoCredito"
import { notificacaoDeErro } from "@/utils/apiError"
import { mesDaFaturaDoDia, mesMinimoPrimeiraParcela, rotuloMesFatura } from "../CreditCards/ciclosFatura"
import styles from "./ParcelamentosPage.module.css"


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
  2: "Recorrente",
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
type Errors = Partial<Record<
  "descricao" | "valor" | "cartaoCreditoId" | "parcelas" | "primeiraParcelaMes" | "taxaJuroMensal", string
>>

type Notification = { open: boolean; message: string; severity: "success" | "error" | "warning" }
type OutletContextType = { notify: React.Dispatch<React.SetStateAction<Notification>> }

// "Primeira parcela: outubro" = a fatura que FECHA em outubro (o rótulo da tela Cartões). A sugestão é
// a mais cedo que o banco cobraria: a fatura em que a compra cai ou, se a compra é antiga, a aberta
// hoje. Sem cartão escolhido ainda, mês calendário.
const emptyForm = (): FormState => {
  const dataCompra = dataLocalISO()
  return {
    descricao: "", valor: undefined, tipo: "0", cartaoCreditoId: "",
    dataCompra,
    parcelas: 3, primeiraParcelaMes: mesMinimoPrimeiraParcela(dataCompra, dataCompra), taxaJuroMensal: undefined,
  }
}

export default function ParcelamentosPage() {
  const navigate = useNavigate()
  const { notify } = useOutletContext<OutletContextType>()
  const [parcelamentos, setParcelamentos] = useState<Parcelamento[]>([])
  // KPIs exatos via /parcelamentos/stats (#179).
  const [stats, setStats] = useState({ ativos: 0, totalRestante: 0, qtdTotal: 0 })
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(PONTES_TABLE_PAGE_SIZE_DEFAULT)
  const [cartoes, setCartoes] = useState<CartaoCredito[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cancelarId, setCancelarId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  // Usuário escolheu o mês da 1ª parcela à mão: mudar a data da compra ou o cartão não sobrescreve
  // a escolha (se ela ficar antes do mínimo, a validação do submit avisa no campo).
  const [mesEscolhido, setMesEscolhido] = useState(false)
  const [errors, setErrors] = useState<Errors>({})

  const loadData = useCallback(async () => {
    try {
      const [pageResult, statsResult, c] = await Promise.all([
        ParcelamentoService.listarPaginado(page, pageSize),
        ParcelamentoService.obterStats(),
        getCartoes(),
      ])
      setParcelamentos(pageResult.items)
      setTotal(pageResult.total)
      setStats(statsResult)
      setCartoes(c)
    } catch {
      notify({ open: true, message: "Erro ao carregar parcelamentos", severity: "error" })
    }
  }, [notify, page, pageSize])

  useEffect(() => { void loadData() }, [loadData])

  const clearErr = (k: keyof Errors) => setErrors((p) => ({ ...p, [k]: undefined }))
  const setF = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  const diaFechamentoDo = (cartaoId: string) => cartoes.find((c) => c.id === cartaoId)?.diaFechamento
  const diaVencimentoDo = (cartaoId: string) => cartoes.find((c) => c.id === cartaoId)?.diaVencimento
  // Primeira parcela mais cedo possível no cartão escolhido (o backend recusa antes dela): a fatura em
  // que a compra cai ou, compra antiga, a 1ª que ainda não venceu — as anteriores já venceram. Mínimo do seletor e
  // sugestão enquanto o usuário não escolhe o mês.
  const diaFechamento = diaFechamentoDo(form.cartaoCreditoId)
  const mesMinimo = mesMinimoPrimeiraParcela(form.dataCompra, dataLocalISO(), diaFechamento, diaVencimentoDo(form.cartaoCreditoId))
  const minimoEhAFaturaDaCompra = mesMinimo === mesDaFaturaDoDia(form.dataCompra, diaFechamento)

  const mudarCompra = (patch: Partial<Pick<FormState, "dataCompra" | "cartaoCreditoId">>) => {
    setForm((f) => {
      const next = { ...f, ...patch }
      if (mesEscolhido) return next
      return {
        ...next,
        primeiraParcelaMes: mesMinimoPrimeiraParcela(next.dataCompra, dataLocalISO(), diaFechamentoDo(next.cartaoCreditoId), diaVencimentoDo(next.cartaoCreditoId)),
      }
    })
    clearErr("primeiraParcelaMes")
  }

  const openCreate = () => {
    setForm(emptyForm())
    setMesEscolhido(false)
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
    if (!form.primeiraParcelaMes) e.primeiraParcelaMes = "Informe o mês da primeira parcela"
    else if (mesMinimo && form.primeiraParcelaMes < mesMinimo)
      e.primeiraParcelaMes = minimoEhAFaturaDaCompra
        ? `Não pode ser antes da fatura da compra (${rotuloMesFatura(`${mesMinimo}-01`)})`
        : `Não pode ser antes da fatura de ${rotuloMesFatura(`${mesMinimo}-01`)} — as anteriores já venceram`
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
        // Taxa só é válida em PIX Crédito (tipo "1"); o backend rejeita (409) qualquer taxa
        // — inclusive 0 — em Compra Parcelada. Enviar undefined pros demais tipos.
        taxaJuroMensal: form.tipo === "1" ? (form.taxaJuroMensal ?? 0) : undefined,
        idempotencyKey: crypto.randomUUID(),
      }
      await ParcelamentoService.criar(payload)
      notify({ open: true, message: "Parcelamento criado", severity: "success" })
      setDialogOpen(false)
      await loadData()
    } catch (err) {
      // Ex.: limite do cartão insuficiente → aviso com a mensagem do servidor, não erro genérico.
      notify({ open: true, ...notificacaoDeErro(err, "Erro ao criar parcelamento") })
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
    } catch (err) {
      notify({ open: true, ...notificacaoDeErro(err, "Erro ao cancelar parcelamento") })
    } finally { setCancelarId(null) }
  }

  const { ativos, totalRestante } = stats

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
          <span className={styles.listHeadMeta}>{total} {total === 1 ? "registrado" : "registrados"}</span>
        </div>

        {total === 0 ? (
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
                      {/* Badge só pra exceção — "Compra Parcelada" é o padrão e já é óbvio na página. */}
                      {p.tipo !== TipoParcelamento.CompraParcelada && (
                        <PontesBadge tone="neutral" size="sm">{tiposLabel[p.tipo] ?? "—"}</PontesBadge>
                      )}
                      <span className={styles.itemPills}>{p.quantidadeParcelas}× · {p.parcelasPagas}/{p.quantidadeParcelas} pago</span>
                      <span className={styles.itemAmount}>{formatMoney(p.valorOriginal)}</span>
                    </div>
                    <div className={styles.progressWrap}>
                      <div className={styles.bar}>
                        <div className={styles.barFill} style={{ width: `${pct}%` }} />
                      </div>
                      <span className={styles.progressPct}>{pct.toFixed(0)}%</span>
                    </div>
                    <div className={styles.itemFoot}>
                      {p.proximaParcela && (
                        <span className={styles.footItem}>
                          <span className={styles.metricLabel}>Próxima</span>
                          Fatura {rotuloMesFatura(p.proximaParcela.faturaMesReferencia)} · <strong>{formatMoney(p.proximaParcela.valor)}</strong>
                        </span>
                      )}
                      <span className={styles.footItem}>
                        <span className={styles.metricLabel}>Restante</span>
                        <strong>{formatMoney(p.valorRestante)}</strong>
                      </span>
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
        {total > 0 && (
          <PontesTablePagination
            total={total} page={page} pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
            itemLabel="parcelamentos" itemLabelSingular="parcelamento"
          />
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
              <PontesDateInput value={form.dataCompra} onChange={(v) => mudarCompra({ dataCompra: v })} />
            </PontesField>
            <PontesField label="Primeira parcela (mês)" required error={errors.primeiraParcelaMes}>
              <PontesMonthInput
                value={form.primeiraParcelaMes}
                min={mesMinimo || undefined}
                onChange={(v) => { setF("primeiraParcelaMes", v); setMesEscolhido(true); clearErr("primeiraParcelaMes") }}
                invalid={!!errors.primeiraParcelaMes}
              />
            </PontesField>
          </div>

          <PontesField label="Tipo" required>
            <PontesSelect value={form.tipo} onChange={(v) => setF("tipo", v)} options={TIPOS_OPTS} />
          </PontesField>

          <PontesField label="Cartão" required error={errors.cartaoCreditoId}>
            <PontesSelect
              value={form.cartaoCreditoId}
              onChange={(v) => { mudarCompra({ cartaoCreditoId: v }); clearErr("cartaoCreditoId") }}
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
