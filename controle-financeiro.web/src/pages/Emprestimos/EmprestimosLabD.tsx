// Bancada de teste — TELA INTEIRA, direção D: junção do lab-b (tabela densa + busca) com o
// agrupamento por pessoa do lab-c. Cada pessoa vira sua própria mini-tabela, com busca filtrando
// dentro de todos os grupos. Ações reais (mesmo hook da tela principal). Rota /emprestimos-lab-d,
// sem link no menu.
import React, { useState } from "react"
import { formatMoney } from "@/utils/money"
import { Plus, Layers, Ban, Search } from "lucide-react"
import { PontesButton, PontesAlert, PontesCard, PontesInput } from "@/components/pontes"
import { FormaPagamentoEmprestimo } from "../../types/Emprestimo"
import { useEmprestimosLogic } from "./useEmprestimosLogic"
import { StatusBadges, ActionIcons, AcaoDupla } from "./EmprestimosLabItemParts"
import EmprestimosLabModals from "./EmprestimosLabModals"
import EmprestimosLabNav from "./EmprestimosLabNav"
import styles from "./EmprestimosLabD.module.css"

const iniciais = (nome: string) => nome.trim().slice(0, 2).toUpperCase()

export default function EmprestimosLabD() {
  const l = useEmprestimosLogic()
  const [busca, setBusca] = useState("")

  const visiveis = l.emprestimos.filter((e) => {
    if (!busca.trim()) return true
    const alvo = `${e.descricao} ${e.contraparteNome ?? e.pessoa}`.toLowerCase()
    return alvo.includes(busca.trim().toLowerCase())
  })

  const grupos = visiveis.reduce<Record<string, typeof visiveis>>((acc, e) => {
    const chave = e.contraparteNome ?? e.pessoa
    ;(acc[chave] ??= []).push(e)
    return acc
  }, {})

  const pendentesPorPessoa = (nome: string) => l.pendentes.filter((p) => p.credorOuDevedorNome === nome)
  const consolidacaoRecebidaPorPessoa = (nome: string) => l.consolidacoesRecebidas.find((c) => c.credorNome === nome)
  const candidatoPorPessoa = (nome: string) => l.candidatosConsolidacao.find((g) => g.contraparteNome === nome)
  const enviadaPorPessoa = (nome: string) => l.consolidacoesEnviadas.find((c) => c.devedorNome === nome)

  return (
    <div className={styles.root}>
      <EmprestimosLabNav current="d" />

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Empréstimos</h1>
          <div className={styles.subtitle}>Tabela agrupada por pessoa — busca + mini-tabela por contraparte</div>
        </div>
        <PontesButton size="sm" iconStart={<Plus size={16} strokeWidth={2.5} />} onClick={l.openCreate}>
          Novo empréstimo
        </PontesButton>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>A receber</span>
          <span className={styles.statValue} data-tone="success">{formatMoney(l.totalAReceber)}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>A pagar</span>
          <span className={styles.statValue} data-tone="danger">{formatMoney(l.totalAPagar)}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Vencido</span>
          <span className={styles.statValue} data-tone="danger">{formatMoney(l.totalAReceberVencido)}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Ativos</span>
          <span className={styles.statValue}>{l.qtdAtivos}</span>
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

      <div className={styles.toolbar}>
        <PontesInput
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por descrição ou pessoa…"
          iconStart={<Search size={14} />}
        />
        <span className={styles.tMuted}>{l.total} {l.total === 1 ? "registrado" : "registrados"}</span>
      </div>

      {Object.keys(grupos).length === 0 ? (
        <div className={styles.emptyWrap}>Nenhum empréstimo encontrado.</div>
      ) : (
        <div className={styles.grupoWrap}>
          {Object.entries(grupos).map(([pessoa, itens]) => {
            const total = itens.reduce((s, e) => s + e.valorRestante, 0)
            const pendentesPessoa = pendentesPorPessoa(pessoa)
            const consolRecebida = consolidacaoRecebidaPorPessoa(pessoa)
            const candidato = candidatoPorPessoa(pessoa)
            const enviada = enviadaPorPessoa(pessoa)
            const temPendencia = pendentesPessoa.length > 0 || !!consolRecebida

            return (
              <PontesCard key={pessoa} padding={0} radius={16}>
                <div className={styles.grupoHead}>
                  <div className={styles.grupoIdentity}>
                    <span className={styles.grupoAvatar}>{iniciais(pessoa)}</span>
                    <div>
                      <div className={styles.grupoNome}>{pessoa}</div>
                      <div className={styles.grupoMeta}>{itens.length} {itens.length === 1 ? "empréstimo" : "empréstimos"}</div>
                    </div>
                  </div>
                  <div className={styles.grupoRight}>
                    {temPendencia && <span className={styles.grupoChip}>Precisa da sua ação</span>}
                    {candidato && (
                      <PontesButton size="sm" variant="outline" iconStart={<Layers size={14} />} onClick={() => l.openConsolidar(candidato)}>
                        Consolidar
                      </PontesButton>
                    )}
                    {enviada && (
                      <PontesButton size="sm" variant="outline" iconStart={<Ban size={14} />}
                        disabled={l.respondendoConsolidacaoId === enviada.id}
                        onClick={() => void l.handleCancelarConsolidacao(enviada.id)}>
                        Cancelar proposta
                      </PontesButton>
                    )}
                    <span className={styles.grupoTotal}>{formatMoney(total)}</span>
                  </div>
                </div>

                {pendentesPessoa.map((p) => (
                  <div key={p.emprestimoId} className={styles.bannerRow} style={{ padding: "10px 16px" }}>
                    <span>Convite pendente — {p.descricao} ({formatMoney(p.valorTotal)})</span>
                    <AcaoDupla
                      disabled={l.respondendoId === p.emprestimoId}
                      onAceitar={() => void l.handleAceitarConvite(p.emprestimoId)}
                      onRecusar={() => void l.handleRecusarConvite(p.emprestimoId)}
                    />
                  </div>
                ))}
                {consolRecebida && (
                  <div className={styles.bannerRow} style={{ padding: "10px 16px" }}>
                    <span>Quer juntar {consolRecebida.itens.length} empréstimos num plano novo de {formatMoney(consolRecebida.valorTotalProposto)}</span>
                    <AcaoDupla
                      disabled={l.respondendoConsolidacaoId === consolRecebida.id}
                      onAceitar={() => void l.handleAceitarConsolidacao(consolRecebida.id)}
                      onRecusar={() => l.openRecusarConsolidacao(consolRecebida.id)}
                    />
                  </div>
                )}

                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Empréstimo</th><th>Forma</th><th>Status</th>
                        <th className={styles.tRight}>Restante</th><th className={styles.tRight}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map((e) => {
                        const isParcelado = e.formaPagamento === FormaPagamentoEmprestimo.Parcelado
                        return (
                          <React.Fragment key={e.id}>
                            <tr data-quitado={e.quitado ? "true" : undefined}>
                              <td className={styles.tDesc} title={e.descricao}>{e.descricao}</td>
                              <td>{isParcelado ? `${e.quantidadeParcelas}x` : "à vista"}</td>
                              <td><div className={styles.tBadges}><StatusBadges e={e} /></div></td>
                              <td className={styles.tRight}>
                                <strong data-tone={e.tipo === 1 ? undefined : "danger"} className={styles.tValor}>{formatMoney(e.valorRestante)}</strong>
                              </td>
                              <td className={styles.tRight}>
                                <ActionIcons e={e} size={24} logic={l} className={styles.rowActions} />
                              </td>
                            </tr>
                            {isParcelado && l.expandedId === e.id && (
                              <tr>
                                <td colSpan={5} style={{ padding: 0 }}>
                                  <table className={styles.parcelasTable}>
                                    <thead>
                                      <tr>
                                        <th>Parcela</th><th>Vencimento</th><th className={styles.tRight}>Valor</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {l.parcelasLoadingId === e.id ? (
                                        <tr><td colSpan={3}>Carregando…</td></tr>
                                      ) : (l.parcelasPorEmprestimo[e.id] ?? []).map((p) => (
                                        <tr key={p.id}>
                                          <td>{p.numero}/{p.quantidadeTotal}</td>
                                          <td>vence {new Date(p.dataVencimento).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</td>
                                          <td className={styles.tRight}>{formatMoney(p.valorComMulta ?? p.valorComJuros ?? p.valor)}</td>
                                        </tr>
                                      ))}
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
              </PontesCard>
            )
          })}
        </div>
      )}

      <EmprestimosLabModals logic={l} />
    </div>
  )
}
