// Bancada de teste — TELA INTEIRA, direção A: "Extrato minimalista". Baixo chrome, tudo perto,
// densidade tipo extrato bancário. Ações reais (mesmo hook da tela principal). Rota
// /emprestimos-lab-a, sem link no menu. Comparar com lab-b (painel) e lab-c (agrupado).
import React from "react"
import { formatMoney } from "@/utils/money"
import { Plus, Layers, Ban } from "lucide-react"
import { PontesButton, PontesAlert } from "@/components/pontes"
import { FormaPagamentoEmprestimo } from "../../types/Emprestimo"
import { useEmprestimosLogic } from "./useEmprestimosLogic"
import { StatusBadges, ActionIcons, AcaoDupla } from "./EmprestimosLabItemParts"
import EmprestimosLabModals from "./EmprestimosLabModals"
import styles from "./EmprestimosLabA.module.css"

export default function EmprestimosLabA() {
  const l = useEmprestimosLogic()

  return (
    <div className={styles.root}>
      <span className={styles.labTag}>Bancada · Lab A</span>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Empréstimos</h1>
          <div className={styles.subtitle}>Extrato minimalista — controle de dinheiro emprestado e recebido</div>
        </div>
        <PontesButton size="sm" iconStart={<Plus size={16} strokeWidth={2.5} />} onClick={l.openCreate}>
          Novo
        </PontesButton>
      </div>

      {(l.pendentes.length > 0 || l.consolidacoesRecebidas.length > 0) && (
        <PontesAlert tone="warning">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {l.pendentes.map((p) => (
              <div key={p.emprestimoId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 13 }}>
                  Convite — <strong>{p.credorOuDevedorNome}</strong> · {p.descricao} ({formatMoney(p.valorTotal)})
                </span>
                <AcaoDupla
                  disabled={l.respondendoId === p.emprestimoId}
                  onAceitar={() => void l.handleAceitarConvite(p.emprestimoId)}
                  onRecusar={() => void l.handleRecusarConvite(p.emprestimoId)}
                />
              </div>
            ))}
            {l.consolidacoesRecebidas.map((c) => (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 13 }}>
                  Consolidação — <strong>{c.credorNome}</strong> quer juntar {c.itens.length} empréstimos ({formatMoney(c.valorTotalProposto)})
                </span>
                <AcaoDupla
                  disabled={l.respondendoConsolidacaoId === c.id}
                  onAceitar={() => void l.handleAceitarConsolidacao(c.id)}
                  onRecusar={() => l.openRecusarConsolidacao(c.id)}
                />
              </div>
            ))}
          </div>
        </PontesAlert>
      )}

      <div className={styles.kpiStrip}>
        <div className={styles.kpiItem}>
          <span className={styles.kpiLabel}>A receber</span>
          <span className={styles.kpiValue} data-tone="success">{formatMoney(l.totalAReceber)}</span>
        </div>
        <div className={styles.kpiItem}>
          <span className={styles.kpiLabel}>A pagar</span>
          <span className={styles.kpiValue} data-tone="danger">{formatMoney(l.totalAPagar)}</span>
        </div>
        <div className={styles.kpiItem}>
          <span className={styles.kpiLabel}>Vencido</span>
          <span className={styles.kpiValue} data-tone="danger">{formatMoney(l.totalAReceberVencido)}</span>
        </div>
        <div className={styles.kpiItem}>
          <span className={styles.kpiLabel}>Ativos</span>
          <span className={styles.kpiValue}>{l.qtdAtivos}</span>
        </div>
      </div>

      {(l.candidatosConsolidacao.length > 0 || l.consolidacoesEnviadas.length > 0) && (
        <div className={styles.consolidarStrip}>
          {l.candidatosConsolidacao.map((g) => (
            <div key={g.contraparteUsuarioId} className={styles.consolidarRow}>
              <span><strong>{g.contraparteNome}</strong> — {g.itens.length} empréstimos ativos, {formatMoney(g.itens.reduce((s, i) => s + i.valorRestanteSnapshot, 0))} no total</span>
              <PontesButton size="sm" variant="outline" iconStart={<Layers size={14} />} onClick={() => l.openConsolidar(g)}>Consolidar</PontesButton>
            </div>
          ))}
          {l.consolidacoesEnviadas.map((c) => (
            <div key={c.id} className={styles.consolidarRow}>
              <span>Proposta pra <strong>{c.devedorNome}</strong> — {formatMoney(c.valorTotalProposto)}, aguardando resposta</span>
              <PontesButton size="sm" variant="outline" iconStart={<Ban size={14} />}
                disabled={l.respondendoConsolidacaoId === c.id}
                onClick={() => void l.handleCancelarConsolidacao(c.id)}>Cancelar</PontesButton>
            </div>
          ))}
        </div>
      )}

      {l.emprestimos.length === 0 ? (
        <div className={styles.emptyWrap}>Nenhum empréstimo cadastrado.</div>
      ) : (
        <ul className={styles.extratoList}>
          {l.emprestimos.map((e) => {
            const isParcelado = e.formaPagamento === FormaPagamentoEmprestimo.Parcelado
            const tone = e.vencido && !e.quitado ? "danger" : e.souCredor && e.valorPendente > 0 ? "warning" : undefined
            return (
              <React.Fragment key={e.id}>
                <li className={styles.extratoRow} data-tone={tone} data-quitado={e.quitado ? "true" : undefined}>
                  <div className={styles.extratoMain}>
                    <div className={styles.extratoHead}>
                      <span className={styles.extratoDesc} title={e.descricao}>{e.descricao}</span>
                      <StatusBadges e={e} />
                    </div>
                    <span className={styles.extratoSub}>
                      {e.tipo === 1 ? "Para: " : "De: "}{e.contraparteNome ?? e.pessoa}
                      {" · "}{isParcelado ? `Parcelado ${e.quantidadeParcelas}x` : "À vista"}
                      {e.dataVencimento && ` · vence ${new Date(e.dataVencimento).toLocaleDateString("pt-BR", { timeZone: "UTC" })}`}
                    </span>
                  </div>
                  <ActionIcons e={e} size={24} logic={l} className={styles.actions} />
                  <span className={styles.extratoValor} data-tone={e.tipo === 1 ? undefined : "danger"}>{formatMoney(e.valorRestante)}</span>
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
      )}

      <div className={styles.footerMeta}>{l.total} {l.total === 1 ? "registrado" : "registrados"}</div>

      <EmprestimosLabModals logic={l} />
    </div>
  )
}
