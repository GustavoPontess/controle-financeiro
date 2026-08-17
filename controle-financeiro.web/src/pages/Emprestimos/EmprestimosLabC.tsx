// Bancada de teste — TELA INTEIRA, direção C: "Agrupado por pessoa". Hero dashboard, cards grandes,
// convites/consolidação aparecem dentro do card de cada pessoa (não banner global). Ações reais
// (mesmo hook da tela principal). Rota /emprestimos-lab-c, sem link no menu. Comparar com
// lab-a (extrato) e lab-b (painel).
import React from "react"
import { formatMoney } from "@/utils/money"
import { Plus, Layers, Ban } from "lucide-react"
import { PontesButton, PontesCard } from "@/components/pontes"
import { FormaPagamentoEmprestimo } from "../../types/Emprestimo"
import { useEmprestimosLogic } from "./useEmprestimosLogic"
import { StatusBadges, ActionIcons, AcaoDupla } from "./EmprestimosLabItemParts"
import EmprestimosLabModals from "./EmprestimosLabModals"
import styles from "./EmprestimosLabC.module.css"

const iniciais = (nome: string) => nome.trim().slice(0, 2).toUpperCase()

export default function EmprestimosLabC() {
  const l = useEmprestimosLogic()

  const grupos = l.emprestimos.reduce<Record<string, typeof l.emprestimos>>((acc, e) => {
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
      <span className={styles.labTag}>Bancada · Lab C</span>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Empréstimos</h1>
          <div className={styles.subtitle}>Agrupado por pessoa — cada contraparte com seu resumo</div>
        </div>
        <PontesButton size="sm" iconStart={<Plus size={16} strokeWidth={2.5} />} onClick={l.openCreate}>
          Novo empréstimo
        </PontesButton>
      </div>

      <div className={styles.hero}>
        <div className={styles.heroMain}>
          <span className={styles.heroLabel}>A receber</span>
          <span className={styles.heroValue} data-tone="success">{formatMoney(l.totalAReceber)}</span>
        </div>
        <div className={styles.heroMain}>
          <span className={styles.heroLabel}>A pagar</span>
          <span className={styles.heroValue} data-tone="danger">{formatMoney(l.totalAPagar)}</span>
        </div>
        <div className={styles.heroSecondary}>
          <div className={styles.heroSmall}>
            <div className={styles.heroSmallLabel}>Vencido</div>
            <div className={styles.heroSmallValue} data-tone="danger">{formatMoney(l.totalAReceberVencido)}</div>
          </div>
          <div className={styles.heroSmall}>
            <div className={styles.heroSmallLabel}>Ativos</div>
            <div className={styles.heroSmallValue}>{l.qtdAtivos}</div>
          </div>
        </div>
      </div>

      {Object.keys(grupos).length === 0 ? (
        <div className={styles.emptyWrap}>Nenhum empréstimo cadastrado.</div>
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
              <PontesCard key={pessoa} padding={0} radius={18}>
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
                    <span className={styles.grupoTotal}>{formatMoney(total)}</span>
                  </div>
                </div>

                {pendentesPessoa.map((p) => (
                  <div key={p.emprestimoId} className={styles.grupoItem}>
                    <span>Convite pendente — {p.descricao} ({formatMoney(p.valorTotal)})</span>
                    <AcaoDupla
                      disabled={l.respondendoId === p.emprestimoId}
                      onAceitar={() => void l.handleAceitarConvite(p.emprestimoId)}
                      onRecusar={() => void l.handleRecusarConvite(p.emprestimoId)}
                    />
                  </div>
                ))}
                {consolRecebida && (
                  <div className={styles.grupoItem}>
                    <span>Quer juntar {consolRecebida.itens.length} empréstimos num plano novo de {formatMoney(consolRecebida.valorTotalProposto)}</span>
                    <AcaoDupla
                      disabled={l.respondendoConsolidacaoId === consolRecebida.id}
                      onAceitar={() => void l.handleAceitarConsolidacao(consolRecebida.id)}
                      onRecusar={() => l.openRecusarConsolidacao(consolRecebida.id)}
                    />
                  </div>
                )}
                {candidato && (
                  <div className={styles.grupoItem}>
                    <span>{candidato.itens.length} empréstimos ativos podem virar um plano só</span>
                    <PontesButton size="sm" variant="outline" iconStart={<Layers size={14} />} onClick={() => l.openConsolidar(candidato)}>Consolidar</PontesButton>
                  </div>
                )}
                {enviada && (
                  <div className={styles.grupoItem}>
                    <span>Proposta enviada — {formatMoney(enviada.valorTotalProposto)}, aguardando resposta</span>
                    <PontesButton size="sm" variant="outline" iconStart={<Ban size={14} />}
                      disabled={l.respondendoConsolidacaoId === enviada.id}
                      onClick={() => void l.handleCancelarConsolidacao(enviada.id)}>Cancelar</PontesButton>
                  </div>
                )}

                <ul className={styles.grupoList}>
                  {itens.map((e) => {
                    const isParcelado = e.formaPagamento === FormaPagamentoEmprestimo.Parcelado
                    return (
                      <React.Fragment key={e.id}>
                        <li className={styles.grupoItem} data-quitado={e.quitado ? "true" : undefined}>
                          <div className={styles.grupoItemMain}>
                            <div className={styles.grupoItemHead}>
                              <span title={e.descricao}>{e.descricao}</span>
                              <StatusBadges e={e} />
                            </div>
                            <span className={styles.grupoItemSub}>{isParcelado ? `Parcelado ${e.quantidadeParcelas}x` : "À vista"}</span>
                          </div>
                          <ActionIcons e={e} size={24} logic={l} className={styles.actions} />
                          <span className={styles.grupoItemValor} data-tone={e.tipo === 1 ? undefined : "danger"}>{formatMoney(e.valorRestante)}</span>
                        </li>
                        {isParcelado && l.expandedId === e.id && (
                          <div className={styles.parcelasWrap}>
                            {l.parcelasLoadingId === e.id ? "Carregando…" : (l.parcelasPorEmprestimo[e.id] ?? []).map((p) => (
                              <div key={p.id} className={styles.parcelaRow}>
                                <span>{p.numero}/{p.quantidadeTotal}</span>
                                <span>vence {new Date(p.dataVencimento).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</span>
                                <span>{formatMoney(p.valorComMulta ?? p.valorComJuros ?? p.valor)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </React.Fragment>
                    )
                  })}
                </ul>
              </PontesCard>
            )
          })}
        </div>
      )}

      <EmprestimosLabModals logic={l} />
    </div>
  )
}
