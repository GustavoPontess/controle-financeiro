import React, { useCallback, useEffect, useState } from "react"
import { formatMoney } from "@/utils/money"
import { useOutletContext } from "react-router-dom"
import {
  Plus, Trash2, Handshake, TrendingUp, TrendingDown, DollarSign, Link2, Copy, Check, X,
} from "lucide-react"
import {
  PontesButton, PontesCard, PontesBadge, PontesIconButton, PontesStatCard,
  PontesModal, PontesDialog, PontesField, PontesInput, PontesDateInput, PontesSelect,
  PontesTextarea, PontesEmptyState,
  PontesTablePagination, PONTES_TABLE_PAGE_SIZE_DEFAULT,
} from "@/components/pontes"
import {
  listEmprestimosPage, getEmprestimoStats, createEmprestimo, registrarPagamento, quitarEmprestimo, deleteEmprestimo,
  vincularEmprestimo, listConvitesPendentesEmprestimo,
  aceitarVinculoEmprestimoPorId, recusarVinculoEmprestimoPorId,
} from "../../services/emprestimoService"
import type { EmprestimoStats } from "../../services/emprestimoService"
import {
  StatusVinculoEmprestimo,
  type Emprestimo, type CriarEmprestimo, type EmprestimoConvitePendente,
} from "../../types/Emprestimo"
import styles from "./EmprestimosPage.module.css"

const errorMessage = (err: unknown, fallback: string): string =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback


const formatDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "—"

const today = () => new Date().toISOString().slice(0, 10)

const parseMoney = (masked: string): number | undefined => {
  const digits = masked.replace(/\D/g, "")
  return digits ? Number(digits) / 100 : undefined
}
const fmtMoney = (n?: number): string =>
  n != null ? n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""

const TIPOS = [
  { value: "1", label: "Emprestei (vou receber)" },
  { value: "2", label: "Peguei emprestado (vou pagar)" },
]

type FormState = {
  descricao: string
  pessoa: string
  valorTotal?: number
  tipo: string
  dataInicio: string
  dataVencimento: string
  observacao: string
}
const emptyForm: FormState = {
  descricao: "", pessoa: "", valorTotal: undefined, tipo: "1",
  dataInicio: today(), dataVencimento: "", observacao: "",
}
type Errors = Partial<Record<"descricao" | "pessoa" | "valorTotal", string>>

type Notification = { open: boolean; message: string; severity: "success" | "error" }
type OutletContextType = { notify: React.Dispatch<React.SetStateAction<Notification>> }

export default function EmprestimosPage() {
  const { notify } = useOutletContext<OutletContextType>()
  // Página visível (server-side) + KPIs exatos via /stats endpoint dedicado (#179).
  const [emprestimos, setEmprestimos] = useState<Emprestimo[]>([])
  const [stats, setStats] = useState<EmprestimoStats>({
    totalAReceber: 0, totalAPagar: 0, ativos: 0, qtdTotal: 0,
  })
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(PONTES_TABLE_PAGE_SIZE_DEFAULT)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pagamentoFor, setPagamentoFor] = useState<string | null>(null)
  const [valorPagamento, setValorPagamento] = useState<number | undefined>(undefined)
  const [pagamentoErr, setPagamentoErr] = useState<string | undefined>(undefined)
  const [quitarId, setQuitarId] = useState<string | null>(null)
  const [delId, setDelId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [errors, setErrors] = useState<Errors>({})
  const [idemKey, setIdemKey] = useState<string>("")

  // Vínculo bilateral (docs/features/emprestimo-compartilhado/spec.md)
  const [pendentes, setPendentes] = useState<EmprestimoConvitePendente[]>([])
  const [respondendoId, setRespondendoId] = useState<string | null>(null)
  const [vincularFor, setVincularFor] = useState<string | null>(null)
  const [vincularEmail, setVincularEmail] = useState("")
  const [vincularErr, setVincularErr] = useState<string | undefined>(undefined)
  const [vincularLink, setVincularLink] = useState<string | null>(null)
  const [vincularLoading, setVincularLoading] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [pageResult, statsResult, pendentesResult] = await Promise.all([
        listEmprestimosPage(page, pageSize),
        getEmprestimoStats(),
        listConvitesPendentesEmprestimo(),
      ])
      setEmprestimos(pageResult.items)
      setTotal(pageResult.total)
      setStats(statsResult)
      setPendentes(pendentesResult)
    } catch {
      notify({ open: true, message: "Erro ao carregar empréstimos", severity: "error" })
    }
  }, [notify, page, pageSize])

  useEffect(() => { void loadData() }, [loadData])

  const clearErr = (k: keyof Errors) => setErrors((p) => ({ ...p, [k]: undefined }))
  const setF = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  const openCreate = () => {
    setForm(emptyForm); setErrors({}); setDialogOpen(true)
    setIdemKey(crypto.randomUUID()) // key estável por tentativa; reusa no retry
  }

  const handleAceitarConvite = async (id: string) => {
    setRespondendoId(id)
    try {
      await aceitarVinculoEmprestimoPorId(id)
      notify({ open: true, message: "Vínculo aceito", severity: "success" })
      await loadData()
    } catch (err) {
      notify({ open: true, message: errorMessage(err, "Erro ao aceitar convite"), severity: "error" })
    } finally {
      setRespondendoId(null)
    }
  }

  const handleRecusarConvite = async (id: string) => {
    setRespondendoId(id)
    try {
      await recusarVinculoEmprestimoPorId(id)
      notify({ open: true, message: "Convite recusado", severity: "success" })
      await loadData()
    } catch (err) {
      notify({ open: true, message: errorMessage(err, "Erro ao recusar convite"), severity: "error" })
    } finally {
      setRespondendoId(null)
    }
  }

  const handleSalvar = async () => {
    const e: Errors = {}
    if (!form.descricao.trim()) e.descricao = "Informe a descrição"
    if (!form.pessoa.trim()) e.pessoa = form.tipo === "1" ? "Informe pra quem emprestou" : "Informe de quem pegou"
    if (form.valorTotal == null) e.valorTotal = "Informe o valor"
    else if (form.valorTotal <= 0) e.valorTotal = "Valor deve ser maior que zero"
    setErrors(e)
    if (Object.keys(e).length) return

    setLoading(true)
    try {
      const payload: CriarEmprestimo = {
        descricao: form.descricao.trim(),
        pessoa: form.pessoa.trim(),
        valorTotal: form.valorTotal!,
        tipo: Number(form.tipo),
        dataInicio: new Date(form.dataInicio).toISOString(),
        dataVencimento: form.dataVencimento ? new Date(form.dataVencimento).toISOString() : undefined,
        observacao: form.observacao.trim() || undefined,
        idempotencyKey: idemKey,
      }
      await createEmprestimo(payload)
      notify({ open: true, message: "Empréstimo criado", severity: "success" })
      setDialogOpen(false)
      await loadData()
    } catch {
      notify({ open: true, message: "Erro ao criar empréstimo", severity: "error" })
    } finally { setLoading(false) }
  }

  const openVincular = (id: string) => {
    setVincularFor(id); setVincularEmail(""); setVincularErr(undefined); setVincularLink(null)
  }

  const handleVincular = async () => {
    if (!vincularFor) return
    if (!vincularEmail.trim() || !vincularEmail.includes("@")) {
      setVincularErr("Informe um e-mail válido")
      return
    }
    setVincularLoading(true)
    try {
      const resultado = await vincularEmprestimo(vincularFor, vincularEmail.trim())
      setVincularLink(`${window.location.origin}${resultado.linkConvite}`)
    } catch (err) {
      setVincularErr(errorMessage(err, "Erro ao propor vínculo"))
    } finally {
      setVincularLoading(false)
    }
  }

  const handleCopiarLink = async () => {
    if (!vincularLink) return
    await navigator.clipboard.writeText(vincularLink)
    notify({ open: true, message: "Link copiado", severity: "success" })
  }

  const handlePagamento = async () => {
    if (!pagamentoFor) return
    if (valorPagamento == null || valorPagamento <= 0) {
      setPagamentoErr("Informe um valor maior que zero")
      return
    }
    setLoading(true)
    try {
      await registrarPagamento(pagamentoFor, valorPagamento)
      notify({ open: true, message: "Pagamento registrado", severity: "success" })
      setPagamentoFor(null); setValorPagamento(undefined); setPagamentoErr(undefined)
      await loadData()
    } catch (err) {
      notify({ open: true, message: errorMessage(err, "Erro ao registrar pagamento"), severity: "error" })
    } finally { setLoading(false) }
  }

  const handleQuitar = async () => {
    if (!quitarId) return
    try {
      await quitarEmprestimo(quitarId)
      notify({ open: true, message: "Empréstimo quitado", severity: "success" })
      await loadData()
    } catch (err) {
      notify({ open: true, message: errorMessage(err, "Erro ao quitar empréstimo"), severity: "error" })
    } finally { setQuitarId(null) }
  }

  const handleDelete = async () => {
    if (!delId) return
    try {
      await deleteEmprestimo(delId)
      notify({ open: true, message: "Empréstimo removido", severity: "success" })
      await loadData()
    } catch (err) {
      notify({ open: true, message: errorMessage(err, "Erro ao remover empréstimo"), severity: "error" })
    } finally { setDelId(null) }
  }

  const { totalAReceber, totalAPagar, ativos: qtdAtivos } = stats

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Empréstimos</h1>
          <div className={styles.subtitle}>Controle de dinheiro emprestado e recebido</div>
        </div>
        <PontesButton size="sm" iconStart={<Plus size={16} strokeWidth={2.5} />} onClick={openCreate}>
          Novo Empréstimo
        </PontesButton>
      </div>

      {pendentes.length > 0 && (
        <PontesCard padding={16} radius={16} className={styles.pendentesCard}>
          <div className={styles.listHeadTitle}>
            {pendentes.length === 1 ? "1 convite de empréstimo pendente" : `${pendentes.length} convites de empréstimo pendentes`}
          </div>
          <ul className={styles.pendentesList}>
            {pendentes.map((p) => (
              <li key={p.emprestimoId} className={styles.pendenteItem}>
                <span className={styles.pendenteDesc}>
                  <strong>{p.credorOuDevedorNome}</strong> — {p.descricao} ({p.tipoDescricao}, {formatMoney(p.valorTotal)})
                </span>
                <div className={styles.actions}>
                  <PontesIconButton size={32} variant="ghost" aria-label="Aceitar convite"
                    disabled={respondendoId === p.emprestimoId}
                    onClick={() => handleAceitarConvite(p.emprestimoId)}>
                    <Check size={14} />
                  </PontesIconButton>
                  <PontesIconButton size={32} variant="ghost" aria-label="Recusar convite"
                    disabled={respondendoId === p.emprestimoId}
                    onClick={() => handleRecusarConvite(p.emprestimoId)}>
                    <X size={14} />
                  </PontesIconButton>
                </div>
              </li>
            ))}
          </ul>
        </PontesCard>
      )}

      <div className={styles.statsGrid}>
        <PontesStatCard label="A receber" value={formatMoney(totalAReceber)} hint="dinheiro que emprestei" tone="success" />
        <PontesStatCard label="A pagar" value={formatMoney(totalAPagar)} hint="dinheiro que peguei emprestado" tone="danger" />
        <PontesStatCard label="Ativos" value={String(qtdAtivos)} hint="empréstimos em andamento" />
      </div>

      <PontesCard padding={0} radius={16}>
        <div className={styles.listHead}>
          <span className={styles.listHeadTitle}>Seus empréstimos</span>
          <span className={styles.listHeadMeta}>{total} {total === 1 ? "registrado" : "registrados"}</span>
        </div>

        {total === 0 ? (
          <div className={styles.emptyWrap}>
            <PontesEmptyState
              icon={<Handshake size={28} />}
              title="Nenhum empréstimo cadastrado"
              description="Registre dinheiro que você emprestou ou que tomou emprestado."
            />
          </div>
        ) : (
          <ul className={styles.list}>
            {emprestimos.map((e) => {
              const isEmprestei = e.tipo === 1
              return (
                <li key={e.id} className={styles.item} data-quitado={e.quitado ? "true" : undefined}>
                  <div className={styles.itemLeft}>
                    <div className={styles.itemIcon} data-tone={isEmprestei ? "success" : "danger"}>
                      {isEmprestei ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    </div>
                    <div className={styles.itemMeta}>
                      <div className={styles.itemHead}>
                        <span className={styles.itemDesc}>{e.descricao}</span>
                        {e.quitado && <PontesBadge tone="success" size="sm">Quitado</PontesBadge>}
                        {e.vencido && !e.quitado && <PontesBadge tone="danger" size="sm">Vencido</PontesBadge>}
                        {e.statusVinculo === StatusVinculoEmprestimo.Vinculado && (
                          <PontesBadge tone="success" size="sm">Vinculado</PontesBadge>
                        )}
                        {e.statusVinculo === StatusVinculoEmprestimo.PendenteAceite && (
                          <PontesBadge tone="warning" size="sm">Convite pendente</PontesBadge>
                        )}
                      </div>
                      <span className={styles.itemSub}>
                        {isEmprestei ? "Para: " : "De: "}
                        <strong>{e.contraparteNome ?? e.pessoa}</strong>
                        {e.dataVencimento && ` · vence ${formatDate(e.dataVencimento)}`}
                      </span>
                      {!e.quitado && (
                        <div className={styles.progressWrap}>
                          <div className={styles.progressMeta}>
                            <span>{formatMoney(e.valorPago)} pago de {formatMoney(e.valorTotal)}</span>
                            <span className={styles.progressPct}>{e.percentualPago}%</span>
                          </div>
                          <div className={styles.bar}>
                            <div className={styles.barFill} data-tone={isEmprestei ? "success" : "danger"} style={{ width: `${e.percentualPago}%` }} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={styles.itemRight}>
                    <span className={styles.itemValue} data-tone={isEmprestei ? "success" : "danger"}>
                      {formatMoney(e.valorRestante)}
                    </span>
                    <span className={styles.itemValueLabel}>restante</span>
                    <div className={styles.actions}>
                      {!e.quitado && e.souCredor && (
                        <>
                          <PontesIconButton size={32} variant="ghost" aria-label="Registrar pagamento"
                            onClick={() => { setPagamentoFor(e.id); setValorPagamento(undefined); setPagamentoErr(undefined) }}>
                            <DollarSign size={14} />
                          </PontesIconButton>
                          <PontesIconButton size={32} variant="ghost" aria-label="Marcar como quitado"
                            onClick={() => setQuitarId(e.id)}>
                            <Handshake size={14} />
                          </PontesIconButton>
                        </>
                      )}
                      {(e.statusVinculo === StatusVinculoEmprestimo.SemVinculo
                        || e.statusVinculo === StatusVinculoEmprestimo.Recusado) && (
                        <PontesIconButton size={32} variant="ghost" aria-label="Vincular a uma pessoa"
                          onClick={() => openVincular(e.id)}>
                          <Link2 size={14} />
                        </PontesIconButton>
                      )}
                      <PontesIconButton size={32} variant="ghost" aria-label="Remover"
                        onClick={() => setDelId(e.id)}>
                        <Trash2 size={14} />
                      </PontesIconButton>
                    </div>
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
            itemLabel="empréstimos" itemLabelSingular="empréstimo"
          />
        )}
      </PontesCard>

      {/* Modal: Novo empréstimo */}
      <PontesModal
        open={dialogOpen}
        title="Novo empréstimo"
        onClose={() => setDialogOpen(false)}
        footer={<>
          <PontesButton variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</PontesButton>
          <PontesButton onClick={handleSalvar} loading={loading} disabled={loading}>Criar empréstimo</PontesButton>
        </>}
      >
        <form noValidate onSubmit={(e) => { e.preventDefault(); void handleSalvar() }} className={styles.formCol}>
          <PontesField label="Tipo" required>
            <PontesSelect value={form.tipo} onChange={(v) => setF("tipo", v)} options={TIPOS} />
          </PontesField>

          <PontesField label="Descrição" required error={errors.descricao}>
            <PontesInput
              value={form.descricao}
              onChange={(e) => { setF("descricao", e.target.value); clearErr("descricao") }}
              invalid={!!errors.descricao}
              placeholder="Ex: Empréstimo para viagem"
            />
          </PontesField>

          <PontesField label={form.tipo === "1" ? "Para quem emprestei" : "De quem peguei"} required error={errors.pessoa}>
            <PontesInput
              value={form.pessoa}
              onChange={(e) => { setF("pessoa", e.target.value); clearErr("pessoa") }}
              invalid={!!errors.pessoa}
              placeholder="Nome da pessoa"
            />
          </PontesField>

          <PontesField label="Valor" required error={errors.valorTotal}>
            <PontesInput
              iconStart="R$"
              value={fmtMoney(form.valorTotal)}
              onChange={(e) => { setF("valorTotal", parseMoney(e.target.value)); clearErr("valorTotal") }}
              invalid={!!errors.valorTotal}
              inputMode="decimal"
              placeholder="0,00"
            />
          </PontesField>

          <div className={styles.grid2}>
            <PontesField label="Data" required>
              <PontesDateInput value={form.dataInicio} onChange={(v) => setF("dataInicio", v)} />
            </PontesField>
            <PontesField label="Vencimento" helper="Opcional">
              <PontesDateInput value={form.dataVencimento} onChange={(v) => setF("dataVencimento", v)} />
            </PontesField>
          </div>

          <PontesField label="Observação" helper="Opcional">
            <PontesTextarea
              value={form.observacao}
              onChange={(e) => setF("observacao", e.target.value)}
              rows={2}
            />
          </PontesField>
        </form>
      </PontesModal>

      {/* Modal: Registrar pagamento */}
      <PontesModal
        open={pagamentoFor !== null}
        title="Registrar pagamento"
        onClose={() => { setPagamentoFor(null); setPagamentoErr(undefined) }}
        footer={<>
          <PontesButton variant="outline" onClick={() => { setPagamentoFor(null); setPagamentoErr(undefined) }}>Cancelar</PontesButton>
          <PontesButton onClick={handlePagamento} loading={loading} disabled={loading}>Confirmar</PontesButton>
        </>}
      >
        <div className={styles.formCol}>
          <PontesField label="Valor pago" required error={pagamentoErr}>
            <PontesInput
              iconStart="R$"
              value={fmtMoney(valorPagamento)}
              onChange={(e) => { setValorPagamento(parseMoney(e.target.value)); setPagamentoErr(undefined) }}
              invalid={!!pagamentoErr}
              inputMode="decimal"
              placeholder="0,00"
              autoFocus
            />
          </PontesField>
        </div>
      </PontesModal>

      <PontesDialog
        open={quitarId !== null}
        title="Marcar como quitado?"
        description="O empréstimo será fechado e não aceitará mais pagamentos."
        confirmLabel="Quitar"
        onConfirm={handleQuitar}
        onCancel={() => setQuitarId(null)}
      />

      <PontesDialog
        open={delId !== null}
        title="Remover empréstimo?"
        description="O registro sai da sua lista. Se já estiver vinculado a outra pessoa, não é possível remover — quite-o em vez disso."
        confirmLabel="Remover"
        onConfirm={handleDelete}
        onCancel={() => setDelId(null)}
      />

      {/* Modal: Vincular a uma pessoa */}
      <PontesModal
        open={vincularFor !== null}
        title="Vincular empréstimo"
        onClose={() => setVincularFor(null)}
        footer={vincularLink ? (
          <PontesButton onClick={() => setVincularFor(null)}>Fechar</PontesButton>
        ) : (
          <>
            <PontesButton variant="outline" onClick={() => setVincularFor(null)}>Cancelar</PontesButton>
            <PontesButton onClick={handleVincular} loading={vincularLoading} disabled={vincularLoading}>
              Gerar convite
            </PontesButton>
          </>
        )}
      >
        <div className={styles.formCol}>
          {!vincularLink ? (
            <PontesField
              label="E-mail da pessoa"
              required
              error={vincularErr}
              helper="Se ela já tiver conta no Pontes, aceita direto. Se não tiver, o link leva pro cadastro."
            >
              <PontesInput
                value={vincularEmail}
                onChange={(e) => { setVincularEmail(e.target.value); setVincularErr(undefined) }}
                invalid={!!vincularErr}
                placeholder="nome@exemplo.com"
                autoFocus
              />
            </PontesField>
          ) : (
            <>
              <p className={styles.itemSub}>
                Copie e envie esse link pra pessoa por WhatsApp, e-mail ou como preferir —
                o Pontes não envia nada automaticamente.
              </p>
              <div className={styles.vincularLinkBox}>
                <Link2 size={14} />
                <span>{vincularLink}</span>
              </div>
              <PontesButton variant="outline" iconStart={<Copy size={14} />} onClick={handleCopiarLink}>
                Copiar link
              </PontesButton>
            </>
          )}
        </div>
      </PontesModal>
    </div>
  )
}
