import React, { useCallback, useEffect, useState } from "react"
import { formatMoney } from "@/utils/money"
import { useParams, useNavigate, useOutletContext } from "react-router-dom"
import { ChevronLeft } from "lucide-react"
import {
  PontesButton, PontesCard, PontesBadge, PontesStatCard,
  PontesModal, PontesField, PontesSelect, PontesTextarea,
} from "@/components/pontes"
import { ParcelamentoService } from "../../services/ParcelamentoService"
import { getContas } from "../../services/contaService"
import type { ParcelamentoDetalhe } from "../../types/Parcelamento"
import type { Conta } from "../../types/Conta"
import { notificacaoDeErro } from "@/utils/apiError"
import { useDetalheNoCaminho } from "../../layouts/Default/useDetalheNoCaminho"
import styles from "./ParcelamentoDetalhePage.module.css"


// UTC fixo — data do backend é "dia calendário" (meia-noite UTC), não instante exato; formatar em
// fuso local desloca 1 dia pra trás em fuso negativo (Brasil inteiro).
const formatDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—"

const formatarMesAno = (data: string) => {
  const [ano, mes] = data.substring(0, 7).split("-")
  const meses = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"]
  return `${meses[parseInt(mes) - 1]}/${ano}`
}

const statusLabel: Record<number, string> = { 0: "Pendente", 1: "Paga", 2: "Cancelada" }
const statusTone: Record<number, "warning" | "success" | "neutral"> = { 0: "warning", 1: "success", 2: "neutral" }

type Notification = { open: boolean; message: string; severity: "success" | "error" | "warning" }
type OutletContextType = { notify: React.Dispatch<React.SetStateAction<Notification>> }

export default function ParcelamentoDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { notify } = useOutletContext<OutletContextType>()
  const [parcelamento, setParcelamento] = useState<ParcelamentoDetalhe | null>(null)
  useDetalheNoCaminho(parcelamento?.descricao)
  const [contas, setContas] = useState<Conta[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState("")

  const [modalPagar, setModalPagar] = useState(false)
  const [parcelaIdSelecionada, setParcelaIdSelecionada] = useState<string>("")
  const [contaSelecionada, setContaSelecionada] = useState<string>("")
  const [loadingPagar, setLoadingPagar] = useState(false)
  const [erroPagar, setErroPagar] = useState<string | undefined>(undefined)

  const [modalCancelar, setModalCancelar] = useState(false)
  const [motivo, setMotivo] = useState("")
  const [motivoErr, setMotivoErr] = useState<string | undefined>(undefined)
  const [loadingCancelar, setLoadingCancelar] = useState(false)

  const loadData = useCallback(async () => {
    if (!id) return
    try {
      const [p, c] = await Promise.all([
        ParcelamentoService.obterDetalhe(id),
        getContas(),
      ])
      setParcelamento(p)
      setContas(c)
      if (c.length > 0) setContaSelecionada(c[0].id)
    } catch {
      setErro("Erro ao carregar parcelamento")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void loadData() }, [loadData])

  const handlePagar = async () => {
    if (!contaSelecionada) {
      setErroPagar("Selecione a conta de débito")
      return
    }
    setLoadingPagar(true)
    try {
      await ParcelamentoService.pagarParcelaAntecipado(parcelaIdSelecionada, {
        contaPagamentoId: contaSelecionada,
        dataPagamento: new Date().toISOString(),
        idempotencyKey: crypto.randomUUID(),
      })
      notify({ open: true, message: "Parcela paga", severity: "success" })
      setModalPagar(false)
      setErroPagar(undefined)
      await loadData()
    } catch (err) {
      // Ex.: saldo insuficiente na conta → aviso com a mensagem do servidor.
      notify({ open: true, ...notificacaoDeErro(err, "Erro ao pagar parcela") })
    } finally {
      setLoadingPagar(false)
    }
  }

  const handleCancelar = async () => {
    if (!id) return
    if (!motivo.trim()) {
      setMotivoErr("Informe o motivo do cancelamento")
      return
    }
    setLoadingCancelar(true)
    try {
      await ParcelamentoService.cancelar(id, {
        motivo: motivo.trim(),
        idempotencyKey: crypto.randomUUID(),
      })
      notify({ open: true, message: "Parcelamento cancelado", severity: "success" })
      navigate("/parcelamentos")
    } catch (err) {
      notify({ open: true, ...notificacaoDeErro(err, "Erro ao cancelar parcelamento") })
    } finally {
      setLoadingCancelar(false)
    }
  }

  if (loading) return <div className={styles.muted}>Carregando…</div>
  if (erro || !parcelamento) return <div className={styles.error}>{erro || "Parcelamento não encontrado"}</div>

  const percentual = (parcelamento.parcelasPagas / parcelamento.quantidadeParcelas) * 100
  const parcelasRestantes = parcelamento.parcelas.filter((p) => p.status === 0).length
  const tipoLabel = parcelamento.tipo === 0 ? "Compra Parcelada" : "PIX Crédito"

  return (
    <div className={styles.root}>
      <button type="button" className={styles.back} onClick={() => navigate("/parcelamentos")}>
        <ChevronLeft size={16} /> Voltar
      </button>

      <PontesCard padding={24} radius={16}>
        <div className={styles.headerRow}>
          <div className={styles.headerLeft}>
            <h1 className={styles.title}>{parcelamento.descricao}</h1>
            <div className={styles.headerMeta}>
              <PontesBadge tone="neutral" size="sm">{tipoLabel}</PontesBadge>
              <span className={styles.muted}>{parcelamento.quantidadeParcelas} parcelas</span>
            </div>
          </div>
          <div className={styles.headerRight}>{formatMoney(parcelamento.valorOriginal)}</div>
        </div>

        <div className={styles.progressWrap}>
          <div className={styles.progressMeta}>
            <span>Progresso</span>
            <span className={styles.progressPct}>{percentual.toFixed(0)}%</span>
          </div>
          <div className={styles.bar}>
            <div className={styles.barFill} style={{ width: `${percentual}%` }} />
          </div>
        </div>

        <div className={styles.miniStats}>
          <PontesStatCard label="Valor original" value={formatMoney(parcelamento.valorOriginal)} />
          <PontesStatCard label="Pago" value={formatMoney(parcelamento.valorPago)} tone="success" />
          <PontesStatCard label="Restante" value={formatMoney(parcelamento.valorRestante)} tone="danger" />
        </div>
      </PontesCard>

      {parcelamento.proximaParcela && (
        <PontesCard padding={20} radius={14}>
          <div className={styles.proxima}>
            <span className={styles.proximaLabel}>Próxima parcela</span>
            <div className={styles.proximaBody}>
              <div>
                <div className={styles.proximaFatura}>Fatura {formatarMesAno(parcelamento.proximaParcela.dataVencimento)}</div>
                <div className={styles.proximaData}>{formatDate(parcelamento.proximaParcela.dataVencimento)}</div>
              </div>
              <div className={styles.proximaValor}>{formatMoney(parcelamento.proximaParcela.valor)}</div>
            </div>
          </div>
        </PontesCard>
      )}

      <PontesCard padding={0} radius={14}>
        <div className={styles.tableHead}>
          <span>Parcelas ({parcelamento.parcelas.length})</span>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nº</th>
                <th>Fatura</th>
                <th>Vencimento</th>
                <th className={styles.alignRight}>Valor</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {parcelamento.parcelas.map((parcela, i) => (
                <tr key={parcela.id}>
                  <td className={styles.cellBold}>{i + 1}</td>
                  <td>{formatarMesAno(parcela.dataVencimento)}</td>
                  <td>{formatDate(parcela.dataVencimento)}</td>
                  <td className={styles.alignRight + " " + styles.cellBold}>{formatMoney(parcela.valor)}</td>
                  <td>
                    <PontesBadge tone={statusTone[parcela.status] ?? "neutral"} size="sm">
                      {statusLabel[parcela.status] ?? String(parcela.status)}
                    </PontesBadge>
                  </td>
                  <td>
                    {parcela.status === 0 && (
                      <PontesButton size="sm" variant="ghost"
                        onClick={() => { setParcelaIdSelecionada(parcela.id); setModalPagar(true); setErroPagar(undefined) }}>
                        Pagar
                      </PontesButton>
                    )}
                    {parcela.status === 1 && (
                      <span className={styles.muted}>{formatDate(parcela.pagoEm)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PontesCard>

      <div className={styles.bottomActions}>
        <PontesButton variant="danger-outline" onClick={() => { setMotivo(""); setMotivoErr(undefined); setModalCancelar(true) }}>
          Cancelar Parcelamento
        </PontesButton>
      </div>

      <PontesModal
        open={modalPagar}
        title="Pagar parcela antecipado"
        onClose={() => setModalPagar(false)}
        footer={<>
          <PontesButton variant="outline" onClick={() => setModalPagar(false)}>Cancelar</PontesButton>
          <PontesButton onClick={handlePagar} loading={loadingPagar} disabled={loadingPagar}>Confirmar</PontesButton>
        </>}
      >
        <div className={styles.formCol}>
          <div className={styles.valorRow}>
            <span className={styles.valorLabel}>Valor</span>
            <span className={styles.valorValue}>
              {formatMoney(parcelamento.parcelas.find((p) => p.id === parcelaIdSelecionada)?.valor ?? 0)}
            </span>
          </div>
          <PontesField label="Pagar de" required error={erroPagar}>
            <PontesSelect
              value={contaSelecionada}
              onChange={(v) => { setContaSelecionada(v); setErroPagar(undefined) }}
              invalid={!!erroPagar}
              placeholder="Selecione a conta"
              options={contas.map((c) => ({ value: c.id, label: c.nome }))}
            />
          </PontesField>
        </div>
      </PontesModal>

      <PontesModal
        open={modalCancelar}
        title="Cancelar parcelamento"
        onClose={() => setModalCancelar(false)}
        footer={<>
          <PontesButton variant="outline" onClick={() => setModalCancelar(false)}>Manter parcelamento</PontesButton>
          <PontesButton onClick={handleCancelar} loading={loadingCancelar} disabled={loadingCancelar}>Cancelar parcelamento</PontesButton>
        </>}
      >
        <div className={styles.formCol}>
          <p className={styles.cancelInfo}>
            Você cancelará as <strong>{parcelasRestantes}</strong> parcelas pendentes.
          </p>
          {parcelamento.parcelasPagas > 0 && (
            <p className={styles.cancelWarning}>
              As {parcelamento.parcelasPagas} parcelas já pagas <strong>não serão reembolsadas automaticamente</strong>.
            </p>
          )}
          <PontesField label="Motivo do cancelamento" required error={motivoErr}>
            <PontesTextarea
              value={motivo}
              onChange={(e) => { setMotivo(e.target.value); setMotivoErr(undefined) }}
              invalid={!!motivoErr}
              rows={3}
              placeholder="Ex: Não preciso mais, descida de preço…"
            />
          </PontesField>
        </div>
      </PontesModal>
    </div>
  )
}
