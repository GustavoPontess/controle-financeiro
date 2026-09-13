// Bancada de teste — TELA INTEIRA, direção B: "Painel administrativo". Denso, tabela com colunas
// fixas, busca funcional, paginação real (servidor). Ações reais (mesmo hook da tela principal).
// Rota /emprestimos-lab-b, sem link no menu. Comparar com lab-a (extrato) e lab-c (agrupado).
import React, { useEffect } from "react"
import { formatMoney } from "@/utils/money"
import { Plus, Layers, Ban, Search, ChevronRight, ArrowDownLeft, ArrowUpRight } from "lucide-react"
import {
  PontesButton, PontesAlert, PontesCard, PontesInput, PontesBadge,
  PontesTablePagination,
} from "@/components/pontes"
import { FormaPagamentoEmprestimo, StatusParcelaEmprestimo } from "../../types/Emprestimo"
import { useEmprestimosLogic } from "./useEmprestimosLogic"
import { StatusBadges, ActionIcons, AcaoDupla } from "./EmprestimosLabItemParts"
import EmprestimosLabModals from "./EmprestimosLabModals"
import EmprestimosLabNav from "./EmprestimosLabNav"
import styles from "./EmprestimosLabB.module.css"

export default function EmprestimosLabB() {
  const l = useEmprestimosLogic()

  // Densidade de admin — página menor que o default da bancada, pra paginação real aparecer.
  useEffect(() => { l.setPageSize(10) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Busca e direção são SERVER-SIDE (o hook manda os params, o backend pagina já filtrado).
  const visiveis = l.emprestimos

  return (
    <div className={styles.root}>
      <EmprestimosLabNav current="b" />

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Empréstimos</h1>
        </div>
        <div className={styles.headerActions}>
          <PontesButton size="sm" iconStart={<Plus size={16} strokeWidth={2.5} />} onClick={l.openCreate}>
            Novo empréstimo
          </PontesButton>
        </div>
      </div>

      <div className={styles.hero}>
        <div className={styles.heroBlob} />
        <div className={styles.heroMain}>
          <div className={styles.heroLabel}>A receber</div>
          <div className={styles.heroValue}>{formatMoney(l.totalAReceber)}</div>
          <div className={styles.heroSub}>dinheiro que emprestei, ainda não recebido</div>
        </div>
        <div className={styles.heroSide}>
          <div className={styles.heroStats}>
            <div className={styles.heroStat}>
              <span className={styles.heroStatValue} data-tone="down">{formatMoney(l.totalAPagar)}</span>
              <span className={styles.heroStatLabel}>A pagar</span>
            </div>
            <div className={styles.heroStatDivider} />
            <div className={styles.heroStat}>
              <span className={styles.heroStatValue} data-tone="down">{formatMoney(l.totalAReceberVencido)}</span>
              <span className={styles.heroStatLabel}>Vencido</span>
            </div>
            <div className={styles.heroStatDivider} />
            <div className={styles.heroStat}>
              <span className={styles.heroStatValue}>{l.qtdAtivos}</span>
              <span className={styles.heroStatLabel}>Ativos</span>
            </div>
          </div>
        </div>
      </div>

      {(l.pendentes.length > 0 || l.consolidacoesRecebidas.length > 0) && (
        <PontesAlert tone="warning">
          <div className={styles.banner}>
            {l.pendentes.map((p) => (
              <div key={p.emprestimoId} className={styles.bannerRow}>
                <span>Convite — <strong>{p.credorOuDevedorNome}</strong> · {p.descricao} ({formatMoney(p.valorTotal)})</span>
                <AcaoDupla disabled={l.respondendoId === p.emprestimoId}
                  onAceitar={() => void l.handleAceitarConvite(p.emprestimoId)}
                  onRecusar={() => void l.handleRecusarConvite(p.emprestimoId)} />
              </div>
            ))}
            {l.consolidacoesRecebidas.map((c) => (
              <div key={c.id} className={styles.bannerRow}>
                <span>Consolidação — <strong>{c.credorNome}</strong> quer juntar {c.itens.length} empréstimos ({formatMoney(c.valorTotalProposto)})</span>
                <AcaoDupla disabled={l.respondendoConsolidacaoId === c.id}
                  onAceitar={() => void l.handleAceitarConsolidacao(c.id)}
                  onRecusar={() => l.openRecusarConsolidacao(c.id)} />
              </div>
            ))}
          </div>
        </PontesAlert>
      )}

      {l.consolidacoesEnviadas.length > 0 && (
        <PontesCard padding={12} radius={12}>
          <div className={styles.banner}>
            {l.consolidacoesEnviadas.map((c) => (
              <div key={c.id} className={styles.bannerRow}>
                <span>Proposta pra <strong>{c.devedorNome}</strong> — {formatMoney(c.valorTotalProposto)}, aguardando resposta</span>
                <PontesButton size="sm" variant="outline" iconStart={<Ban size={14} />}
                  disabled={l.respondendoConsolidacaoId === c.id}
                  onClick={() => void l.handleCancelarConsolidacao(c.id)}>Cancelar</PontesButton>
              </div>
            ))}
          </div>
        </PontesCard>
      )}

      <div className={styles.toolbar}>
        <div className={styles.segmented} role="tablist">
          {([["todos", "Tudo"], ["receber", "A receber"], ["pagar", "A pagar"]] as const).map(([val, label]) => (
            <button
              key={val}
              type="button"
              role="tab"
              aria-selected={l.direcao === val}
              data-active={l.direcao === val ? "true" : undefined}
              className={styles.segBtn}
              onClick={() => l.setDirecao(val)}
            >
              {label}
            </button>
          ))}
        </div>
        {l.candidatosConsolidacao.length > 0 && (
          <PontesButton size="sm" variant="outline" iconStart={<Layers size={14} />}
            onClick={() => l.openConsolidar(l.candidatosConsolidacao[0])}>
            Consolidar
          </PontesButton>
        )}
        <PontesInput
          value={l.busca}
          onChange={(e) => l.setBusca(e.target.value)}
          placeholder="Buscar por descrição ou pessoa…"
          iconStart={<Search size={14} />}
        />
      </div>

      <PontesCard padding={0} radius={16}>
        {visiveis.length === 0 ? (
          <div className={styles.emptyWrap}>Nenhum empréstimo encontrado.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Empréstimo</th><th>Pessoa</th><th>Forma</th><th>Status</th>
                  <th className={styles.tRight}>Restante</th><th className={styles.tRight}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((e) => {
                  const isParcelado = e.formaPagamento === FormaPagamentoEmprestimo.Parcelado
                  return (
                    <React.Fragment key={e.id}>
                      <tr
                        data-quitado={e.quitado ? "true" : undefined}
                        data-clickable=""
                        onClick={() => void l.toggleExpand(e.id)}
                      >
                        <td className={styles.tDesc} title={e.descricao}>
                          <ChevronRight
                            size={14} strokeWidth={2.5} className={styles.expandCaret}
                            data-open={l.expandedId === e.id ? "true" : undefined} aria-hidden="true"
                          />
                          {e.descricao}
                        </td>
                        <td>{e.contraparteNome ?? e.pessoa}</td>
                        <td>{isParcelado ? `${e.quantidadeParcelas}x` : "à vista"}</td>
                        <td>
                          <div className={styles.tBadges}>
                            <PontesBadge size="sm" tone={e.souCredor ? "success" : "danger"}>
                              {e.souCredor
                                ? <><ArrowDownLeft size={11} strokeWidth={2.5} /> A receber</>
                                : <><ArrowUpRight size={11} strokeWidth={2.5} /> A pagar</>}
                            </PontesBadge>
                            <StatusBadges e={e} />
                          </div>
                        </td>
                        <td className={styles.tRight}>
                          <strong data-tone={e.tipo === 1 ? undefined : "danger"} className={styles.tValor}>{formatMoney(e.valorRestante)}</strong>
                        </td>
                        <td className={styles.tRight} onClick={(ev) => ev.stopPropagation()}>
                          <ActionIcons e={e} size={24} logic={l} className={styles.rowActions} />
                        </td>
                      </tr>
                      {l.expandedId === e.id && (
                        <tr>
                          <td colSpan={6} style={{ padding: 0 }}>
                            <table className={styles.parcelasTable}>
                              <thead>
                                <tr>
                                  {isParcelado && <th>Parcela</th>}
                                  <th>Vencimento</th><th>Status</th>
                                  <th className={styles.tRight}>Pago</th><th className={styles.tRight}>Valor</th>
                                </tr>
                              </thead>
                              <tbody>
                                {isParcelado ? (
                                  l.parcelasLoadingId === e.id ? (
                                    <tr><td colSpan={5}>Carregando…</td></tr>
                                  ) : (l.parcelasPorEmprestimo[e.id] ?? []).map((p) => {
                                    const podeAprovar = e.souCredor && !!p.solicitacaoPendenteId
                                    const valorDevido = p.valorComMulta ?? p.valorComJuros ?? p.valor
                                    const parcialPaga = p.status === StatusParcelaEmprestimo.Pendente && p.valorPago > 0 && p.valorPago < valorDevido
                                    return (
                                      <tr key={p.id}>
                                        <td>{p.numero}/{p.quantidadeTotal}</td>
                                        <td>{new Date(p.dataVencimento).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</td>
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
                                        <td className={styles.tRight}>{p.valorPago > 0 ? formatMoney(p.valorPago) : "—"}</td>
                                        <td className={styles.tRight}>{formatMoney(valorDevido)}</td>
                                      </tr>
                                    )
                                  })
                                ) : (() => {
                                  // À vista não tem parcela — 1 linha só, construída do próprio empréstimo.
                                  const podeAprovar = e.souCredor && e.valorPendente > 0
                                  const valorDevido = e.valorComMulta ?? e.valorComJuros ?? e.valorTotal
                                  return (
                                    <tr>
                                      <td>{e.dataVencimento ? new Date(e.dataVencimento).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—"}</td>
                                      <td>
                                        <PontesBadge size="sm" tone={
                                          podeAprovar ? "warning"
                                            : e.quitado ? "success"
                                            : e.vencido ? "danger" : "neutral"
                                        }>
                                          {podeAprovar ? "Aguardando aprovação" : e.quitado ? "Quitado" : e.vencido ? "Vencido" : "Pendente"}
                                        </PontesBadge>
                                      </td>
                                      <td className={styles.tRight}>{e.valorPago > 0 ? formatMoney(e.valorPago) : "—"}</td>
                                      <td className={styles.tRight}>{formatMoney(valorDevido)}</td>
                                    </tr>
                                  )
                                })()}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {l.total > 0 && (
          <PontesTablePagination
            total={l.total} page={l.page} pageSize={l.pageSize}
            onPageChange={l.setPage}
            onPageSizeChange={(s) => { l.setPageSize(s); l.setPage(1) }}
            itemLabel="empréstimos" itemLabelSingular="empréstimo"
          />
        )}
      </PontesCard>

      <EmprestimosLabModals logic={l} />
    </div>
  )
}
