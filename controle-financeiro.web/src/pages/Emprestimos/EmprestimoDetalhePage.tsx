// Detalhe de um empréstimo — lista enxuta manda o essencial; aqui vive o peso: progresso, valores,
// próxima parcela, tabela de parcelas e as ações (registrar/quitar/vincular/histórico). Espelha o
// padrão de Parcelamentos/[id]. Reusa useEmprestimosLogic (ganha os modais + dados de referência);
// passa o id como focusId pra garantir que o empréstimo aberto por URL esteja sempre no estado.
import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ChevronLeft, ArrowDownLeft, ArrowUpRight, Receipt, Handshake, Link2, History } from "lucide-react"
import { formatMoney } from "@/utils/money"
import { PontesCard, PontesBadge, PontesButton, PontesStatCard, PontesBankBadge } from "@/components/pontes"
import {
  FormaPagamentoEmprestimo, StatusParcelaEmprestimo, TipoEmprestimo, StatusVinculoEmprestimo,
  type Emprestimo,
} from "../../types/Emprestimo"
import { getEmprestimo } from "../../services/emprestimoService"
import { useEmprestimosLogic } from "./useEmprestimosLogic"
import { StatusBadges, ActionIcons } from "./EmprestimosLabItemParts"
import EmprestimosLabModals from "./EmprestimosLabModals"
import { useDetalheNoCaminho } from "../../layouts/Default/useDetalheNoCaminho"
import styles from "./EmprestimoDetalhePage.module.css"

const formatDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—"

export default function EmprestimoDetalhePage() {
  const { id = "" } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const l = useEmprestimosLogic(id)

  const [inicial, setInicial] = useState<Emprestimo | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(false)

  // Busca própria: dá loading/404 confiável (o hook engole erro do focusId) e serve de fallback de
  // exibição. Depois disso, o valor "vivo" vem de l.emprestimos (atualizado após cada ação).
  useEffect(() => {
    let vivo = true
    setCarregando(true); setErro(false)
    getEmprestimo(id)
      .then((x) => { if (vivo) { setInicial(x); setCarregando(false) } })
      .catch(() => { if (vivo) { setErro(true); setCarregando(false) } })
    return () => { vivo = false }
  }, [id])

  // Expande este empréstimo no hook → carrega as parcelas em parcelasPorEmprestimo[id] e faz o
  // refresh pós-ação (refreshParcelasEHistoricoInline) mirar nele.
  useEffect(() => {
    if (id && l.expandedId !== id) void l.toggleExpand(id)
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const e = l.emprestimos.find((x) => x.id === id) ?? inicial
  useDetalheNoCaminho(e?.descricao)

  if (carregando && !e) return <div className={styles.muted}>Carregando…</div>
  if (erro || !e) return <div className={styles.error}>Empréstimo não encontrado</div>

  const isParcelado = e.formaPagamento === FormaPagamentoEmprestimo.Parcelado
  const parcelas = l.parcelasPorEmprestimo[id] ?? []
  const percentual = Math.min(100, Math.max(0, e.percentualPago ?? 0))
  const aReceber = e.tipo === TipoEmprestimo.Emprestei
  const semVinculo = e.statusVinculo === StatusVinculoEmprestimo.SemVinculo || e.statusVinculo === StatusVinculoEmprestimo.Recusado
  const valorDevidoAVista = e.valorComMulta ?? e.valorComJuros ?? e.valorTotal
  const proximaParcela = isParcelado
    ? parcelas.find((p) => p.status === StatusParcelaEmprestimo.Pendente)
    : null

  return (
    <div className={styles.root}>
      <button type="button" className={styles.back} onClick={() => navigate("/emprestimos")}>
        <ChevronLeft size={16} /> Voltar
      </button>

      <PontesCard padding={24} radius={16}>
        <div className={styles.headerRow}>
          <div className={styles.headerLeft}>
            <h1 className={styles.title}>{e.descricao}</h1>
            <div className={styles.headerMeta}>
              <PontesBadge size="sm" tone={aReceber ? "success" : "danger"}>
                {aReceber
                  ? <><ArrowDownLeft size={11} strokeWidth={2.5} /> A receber</>
                  : <><ArrowUpRight size={11} strokeWidth={2.5} /> A pagar</>}
              </PontesBadge>
              <PontesBadge size="sm" tone="neutral">{isParcelado ? `${e.quantidadeParcelas}x` : "à vista"}</PontesBadge>
              <StatusBadges e={e} />
            </div>
            {e.bancoId ? (
              <span className={styles.pessoaBanco}>
                <PontesBankBadge name={e.bancoNome ?? "Banco"} logoUrl={e.bancoLogoUrl} cor={e.bancoCor} size={22} />
                {e.bancoNome}
              </span>
            ) : (
              <span className={styles.pessoaBanco}>{e.contraparteNome ?? e.pessoa}</span>
            )}
          </div>
          <div className={styles.headerRight}>
            <span className={styles.headerValor}>{formatMoney(e.valorTotal)}</span>
            <ActionIcons e={e} size={32} logic={l} mode="management" />
          </div>
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
          <PontesStatCard label="Valor original" value={formatMoney(e.valorTotal)} />
          <PontesStatCard label="Pago" value={formatMoney(e.valorPago)} tone="success" />
          <PontesStatCard label="Restante" value={formatMoney(e.valorRestante)} tone="danger" />
          {e.valorPendente > 0 && (
            <PontesStatCard label="Aguardando aprovação" value={formatMoney(e.valorPendente)} tone="warning" />
          )}
        </div>
      </PontesCard>

      {(!e.quitado || semVinculo || e.statusVinculo === StatusVinculoEmprestimo.Vinculado) && (
        <div className={styles.actions}>
          {!e.quitado && (
            <PontesButton variant="primary" iconStart={<Receipt size={16} strokeWidth={2.5} />}
              onClick={() => l.openSolicitar(e.id)}>Registrar pagamento</PontesButton>
          )}
          {!e.quitado && e.souCredor && (
            <PontesButton variant="outline" iconStart={<Handshake size={16} strokeWidth={2.5} />}
              onClick={() => l.setQuitarId(e.id)}>Marcar como quitado</PontesButton>
          )}
          {semVinculo && (
            <PontesButton variant="outline" iconStart={<Link2 size={16} strokeWidth={2.5} />}
              onClick={() => l.openVincular(e.id)}>Vincular a uma pessoa</PontesButton>
          )}
          {e.statusVinculo === StatusVinculoEmprestimo.Vinculado && (
            <PontesButton variant="outline" iconStart={<History size={16} strokeWidth={2.5} />}
              onClick={() => l.openHistorico(e.id)}>Histórico de pagamentos</PontesButton>
          )}
        </div>
      )}

      {(proximaParcela || (!isParcelado && !e.quitado && e.dataVencimento)) && (
        <PontesCard padding={20} radius={14}>
          <div className={styles.proxima}>
            <span className={styles.proximaLabel}>Próximo vencimento</span>
            <div className={styles.proximaBody}>
              <div className={styles.proximaData}>
                {proximaParcela
                  ? <>Parcela {proximaParcela.numero}/{proximaParcela.quantidadeTotal} · {formatDate(proximaParcela.dataVencimento)}</>
                  : formatDate(e.dataVencimento)}
              </div>
              <div className={styles.proximaValor}>
                {formatMoney(proximaParcela
                  ? (proximaParcela.valorComMulta ?? proximaParcela.valorComJuros ?? proximaParcela.valor)
                  : valorDevidoAVista)}
              </div>
            </div>
          </div>
        </PontesCard>
      )}

      {isParcelado && (
        <PontesCard padding={0} radius={14}>
          <div className={styles.tableHead}>
            <span>Parcelas{parcelas.length > 0 ? ` (${parcelas.length})` : ""}</span>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Parcela</th><th>Vencimento</th><th>Status</th>
                  <th className={styles.alignRight}>Pago</th><th className={styles.alignRight}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {l.parcelasLoadingId === id && parcelas.length === 0 ? (
                  <tr><td colSpan={5}>Carregando…</td></tr>
                ) : parcelas.length === 0 ? (
                  <tr><td colSpan={5} className={styles.muted}>Sem parcelas.</td></tr>
                ) : parcelas.map((p) => {
                  const podeAprovar = e.souCredor && !!p.solicitacaoPendenteId
                  const valorDevido = p.valorComMulta ?? p.valorComJuros ?? p.valor
                  const parcialPaga = p.status === StatusParcelaEmprestimo.Pendente && p.valorPago > 0 && p.valorPago < valorDevido
                  return (
                    <tr key={p.id}>
                      <td className={styles.cellBold}>{p.numero}/{p.quantidadeTotal}</td>
                      <td>{formatDate(p.dataVencimento)}</td>
                      <td>
                        <PontesBadge size="sm" tone={
                          podeAprovar ? "warning"
                            : p.status === StatusParcelaEmprestimo.Paga ? "success"
                            : parcialPaga ? "accent"
                            : p.atrasada ? "danger" : "neutral"
                        }>
                          {podeAprovar ? "Aguardando aprovação" : p.statusDescricao}
                        </PontesBadge>
                      </td>
                      <td className={styles.alignRight}>{p.valorPago > 0 ? formatMoney(p.valorPago) : "—"}</td>
                      <td className={styles.alignRight + " " + styles.cellBold}>{formatMoney(valorDevido)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </PontesCard>
      )}

      {e.observacao && (
        <PontesCard padding={20} radius={14}>
          <p className={styles.obsLabel}>Observação</p>
          <p className={styles.obs}>{e.observacao}</p>
        </PontesCard>
      )}

      <EmprestimosLabModals logic={l} />
    </div>
  )
}
