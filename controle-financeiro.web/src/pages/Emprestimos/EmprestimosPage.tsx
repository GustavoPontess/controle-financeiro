// Tela de Empréstimos — painel administrativo: tabela densa, busca + direção server-side,
// paginação real, ações no menu kebab (⋮), wizard de novo empréstimo e de consolidação.
// Lógica no hook compartilhado useEmprestimosLogic; modais em EmprestimosLabModals.
// (Vencedora da bancada B, promovida a tela real em 2026-09-13.)
import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { formatMoney } from "@/utils/money"
import { Plus, Layers, Ban, Search, ArrowDownLeft, ArrowUpRight, Archive } from "lucide-react"
import {
  PontesButton, PontesAlert, PontesCard, PontesInput, PontesBadge,
  PontesTablePagination, PontesBankBadge,
} from "@/components/pontes"
import { FormaPagamentoEmprestimo, TipoEmprestimo } from "../../types/Emprestimo"
import { useEmprestimosLogic } from "./useEmprestimosLogic"
import { StatusBadges, ActionIcons, AcaoDupla } from "./EmprestimosLabItemParts"
import EmprestimosLabModals from "./EmprestimosLabModals"
import styles from "./EmprestimosPage.module.css"

export default function EmprestimosPage() {
  const l = useEmprestimosLogic()
  const navigate = useNavigate()

  // Densidade de admin — 10 por página pra paginação real aparecer.
  useEffect(() => { l.setPageSize(10) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Busca e direção são SERVER-SIDE (o hook manda os params, o backend pagina já filtrado).
  const visiveis = l.emprestimos

  return (
    <div className={styles.root}>
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
        <div className={styles.heroPrimary}>
          <div className={styles.heroMain}>
            <div className={styles.heroLabel}>A receber</div>
            <div className={styles.heroValue} data-tone="up">{formatMoney(l.totalAReceber)}</div>
          </div>
          <div className={styles.heroPrimaryDivider} />
          <div className={styles.heroMain}>
            <div className={styles.heroLabel}>A pagar</div>
            <div className={styles.heroValue} data-tone="down">{formatMoney(l.totalAPagar)}</div>
          </div>
        </div>
        <div className={styles.heroSide}>
          <div className={styles.heroStats}>
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
        <div className={styles.searchGrow}>
          <PontesInput
            value={l.busca}
            onChange={(e) => l.setBusca(e.target.value)}
            placeholder="Buscar por descrição ou pessoa…"
            iconStart={<Search size={14} />}
          />
        </div>
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
        <button
          type="button"
          aria-pressed={l.mostrarArquivados}
          data-active={l.mostrarArquivados ? "true" : undefined}
          className={styles.toggleArquivados}
          onClick={() => { l.setMostrarArquivados(!l.mostrarArquivados); l.setPage(1) }}
        >
          <Archive size={14} strokeWidth={2.5} /> Arquivados
        </button>
        {l.candidatosConsolidacao.length > 0 && (
          <PontesButton size="sm" variant="outline" iconStart={<Layers size={14} />}
            onClick={() => l.openConsolidar(l.candidatosConsolidacao[0])}>
            Consolidar
          </PontesButton>
        )}
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
                    <tr
                      key={e.id}
                      data-quitado={e.quitado ? "true" : undefined}
                      data-clickable=""
                      onClick={() => navigate(`/emprestimos/${e.id}`)}
                    >
                      <td className={styles.tDesc} title={e.descricao}>
                        {e.descricao}
                      </td>
                      <td>
                        {e.bancoId ? (
                          <span className={styles.pessoaBanco}>
                            <PontesBankBadge name={e.bancoNome ?? "Banco"} logoUrl={e.bancoLogoUrl} cor={e.bancoCor} size={22} />
                            {e.bancoNome}
                          </span>
                        ) : (e.contraparteNome ?? e.pessoa)}
                      </td>
                      <td>{isParcelado ? `${e.quantidadeParcelas}x` : "à vista"}</td>
                      <td>
                        <div className={styles.tBadges}>
                          <PontesBadge size="sm" tone={e.tipo === TipoEmprestimo.Emprestei ? "success" : "danger"}>
                            {e.tipo === TipoEmprestimo.Emprestei
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
                        <ActionIcons e={e} size={24} logic={l} mode="management" className={styles.rowActions} />
                      </td>
                    </tr>
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
