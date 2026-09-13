// Bancada de teste — TELA INTEIRA, direção B: "Painel administrativo". Denso, tabela com colunas
// fixas, busca funcional, paginação real (servidor). Ações reais (mesmo hook da tela principal).
// Rota /emprestimos-lab-b, sem link no menu. Comparar com lab-a (extrato) e lab-c (agrupado).
import React, { useEffect, useState } from "react"
import { formatMoney } from "@/utils/money"
import { Plus, Layers, Ban, Search } from "lucide-react"
import {
  PontesButton, PontesAlert, PontesCard, PontesInput,
  PontesTablePagination,
} from "@/components/pontes"
import { FormaPagamentoEmprestimo } from "../../types/Emprestimo"
import { useEmprestimosLogic } from "./useEmprestimosLogic"
import { StatusBadges, ActionIcons, AcaoDupla } from "./EmprestimosLabItemParts"
import EmprestimosLabModals from "./EmprestimosLabModals"
import EmprestimosLabNav from "./EmprestimosLabNav"
import styles from "./EmprestimosLabB.module.css"

export default function EmprestimosLabB() {
  const l = useEmprestimosLogic()
  const [busca, setBusca] = useState("")

  // Densidade de admin — página menor que o default da bancada, pra paginação real aparecer.
  useEffect(() => { l.setPageSize(6) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const visiveis = l.emprestimos.filter((e) => {
    if (!busca.trim()) return true
    const alvo = `${e.descricao} ${e.contraparteNome ?? e.pessoa}`.toLowerCase()
    return alvo.includes(busca.trim().toLowerCase())
  })

  return (
    <div className={styles.root}>
      <EmprestimosLabNav current="b" />

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Empréstimos</h1>
          <div className={styles.subtitle}>Painel administrativo — busca, colunas fixas, paginação</div>
        </div>
        <div className={styles.headerActions}>
          <PontesButton size="sm" iconStart={<Plus size={16} strokeWidth={2.5} />} onClick={l.openCreate}>
            Novo empréstimo
          </PontesButton>
        </div>
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

      {(l.candidatosConsolidacao.length > 0 || l.consolidacoesEnviadas.length > 0) && (
        <PontesCard padding={12} radius={12}>
          <div className={styles.banner}>
            {l.candidatosConsolidacao.map((g) => (
              <div key={g.contraparteUsuarioId} className={styles.bannerRow}>
                <span><strong>{g.contraparteNome}</strong> — {g.itens.length} empréstimos ativos, {formatMoney(g.itens.reduce((s, i) => s + i.valorRestanteSnapshot, 0))}</span>
                <PontesButton size="sm" variant="outline" iconStart={<Layers size={14} />} onClick={() => l.openConsolidar(g)}>Consolidar</PontesButton>
              </div>
            ))}
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
        <PontesInput
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por descrição ou pessoa…"
          iconStart={<Search size={14} />}
        />
        <span className={styles.tMuted}>{l.total} {l.total === 1 ? "registrado" : "registrados"}</span>
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
                      <tr data-quitado={e.quitado ? "true" : undefined}>
                        <td className={styles.tDesc} title={e.descricao}>{e.descricao}</td>
                        <td>{e.contraparteNome ?? e.pessoa}</td>
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
                          <td colSpan={6} style={{ padding: 0 }}>
                            <div className={styles.parcelasWrap}>
                              {l.parcelasLoadingId === e.id ? "Carregando…" : (l.parcelasPorEmprestimo[e.id] ?? []).map((p) => (
                                <div key={p.id} className={styles.parcelaRow}>
                                  <span>{p.numero}/{p.quantidadeTotal}</span>
                                  <span>vence {new Date(p.dataVencimento).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</span>
                                  <span>{formatMoney(p.valorComMulta ?? p.valorComJuros ?? p.valor)}</span>
                                </div>
                              ))}
                            </div>
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
