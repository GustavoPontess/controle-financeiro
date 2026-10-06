// Tela de Empréstimos — lista no padrão Pontes: TODO o cromo (busca, filtro de direção, colunas,
// paginação, vazio) vem do componente PontesTabela; a página só declara resumo, colunas, filtros e
// ações. Ferramentas próprias (Arquivados / Consolidar) no slot `ferramentas`. Banners de convite e
// consolidação ficam acima da tabela. Lógica no hook useEmprestimosLogic; modais em EmprestimosLabModals.
import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { formatMoney } from "@/utils/money"
import { Layers, Ban, Archive, HandCoins, ArrowDownLeft, ArrowUpRight } from "lucide-react"
import {
  PontesButton, PontesIconButton, PontesAlert, PontesCard, PontesBadge, PontesBankBadge,
  PontesTabela, PontesCelulaIdentidade, PontesTablePagination,
  type PontesTabelaColuna, type PontesTabelaTag,
} from "@/components/pontes"
import { FormaPagamentoEmprestimo, TipoEmprestimo, type Emprestimo } from "../../types/Emprestimo"
import { useEmprestimosLogic, formatDate } from "./useEmprestimosLogic"
import { StatusBadges, ActionIcons, AcaoDupla } from "./EmprestimosLabItemParts"
import EmprestimosLabModals from "./EmprestimosLabModals"
import styles from "./EmprestimosPage.module.css"

export default function EmprestimosPage() {
  const l = useEmprestimosLogic()
  const navigate = useNavigate()

  // Densidade de admin — 10 por página pra paginação real aparecer.
  useEffect(() => { l.setPageSize(10) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const colunas: PontesTabelaColuna<Emprestimo>[] = [
    {
      key: "desc", header: "Empréstimo",
      render: (e) => (
        <PontesCelulaIdentidade
          icone={<HandCoins size={17} strokeWidth={2.2} />}
          tom={e.tipo === TipoEmprestimo.Emprestei ? "entrada" : "saida"}
          nome={e.descricao}
          sub={e.bancoId
            ? <span className={styles.pessoaBanco}><PontesBankBadge name={e.bancoNome ?? "Banco"} logoUrl={e.bancoLogoUrl} cor={e.bancoCor} size={16} />{e.bancoNome}</span>
            : (e.contraparteNome ?? e.pessoa)}
        />
      ),
    },
    {
      key: "status", header: "Status",
      render: (e) => (
        <div className={styles.tBadges}>
          <PontesBadge size="sm" tone={e.tipo === TipoEmprestimo.Emprestei ? "success" : "danger"}>
            {e.tipo === TipoEmprestimo.Emprestei
              ? <><ArrowDownLeft size={11} strokeWidth={2.5} /> A receber</>
              : <><ArrowUpRight size={11} strokeWidth={2.5} /> A pagar</>}
          </PontesBadge>
          <StatusBadges e={e} />
        </div>
      ),
    },
    {
      key: "forma", header: "Forma",
      render: (e) => e.formaPagamento === FormaPagamentoEmprestimo.Parcelado ? `${e.quantidadeParcelas}x` : "à vista",
    },
    { key: "inicio", header: "Início", render: (e) => formatDate(e.dataInicio) },
    { key: "vencimento", header: "Vencimento", render: (e) => formatDate(e.dataVencimento) },
    { key: "valorTotal", header: "Valor total", numerica: true, render: (e) => formatMoney(e.valorTotal) },
    { key: "pago", header: "Pago", numerica: true, render: (e) => `${formatMoney(e.valorPago)} (${Math.round(e.percentualPago)}%)` },
    { key: "juros", header: "Juros", render: (e) => e.taxaJuroMensal != null ? `${e.taxaJuroMensal}% a.m.` : "—" },
    {
      key: "restante", header: "Restante", numerica: true,
      render: (e) => <span data-tone={e.tipo === TipoEmprestimo.Emprestei ? undefined : "danger"} className={styles.tValor}>{formatMoney(e.valorRestante)}</span>,
    },
  ]

  const tags: PontesTabelaTag[] = []
  if (l.busca) tags.push({ label: `Busca: "${l.busca}"`, onRemover: () => l.setBusca("") })
  if (l.mostrarArquivados) tags.push({ label: "Incluindo arquivados", onRemover: () => { l.setMostrarArquivados(false); l.setPage(1) } })

  return (
    <>
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

      <PontesTabela
        id="emprestimos"
        titulo="Empréstimos"
        acao={{ label: "Novo empréstimo", onClick: l.openCreate }}
        resumo={
          <div className={styles.hero}>
            <div className={styles.heroBlob} />
            <div className={styles.heroPrimary}>
              <div className={styles.heroMain}>
                <div className={styles.heroLabel}>A receber</div>
                <div className={styles.heroValue} data-tone="up">{formatMoney(l.totalAReceber)}</div>
                <div className={styles.heroVencido} data-venc={l.totalAReceberVencido > 0 ? "true" : undefined}>
                  {l.totalAReceberVencido > 0 ? `${formatMoney(l.totalAReceberVencido)} vencido` : "em dia"}
                </div>
              </div>
              <div className={styles.heroPrimaryDivider} />
              <div className={styles.heroMain}>
                <div className={styles.heroLabel}>A pagar</div>
                <div className={styles.heroValue} data-tone="down">{formatMoney(l.totalAPagar)}</div>
                <div className={styles.heroVencido} data-venc={l.totalAPagarVencido > 0 ? "true" : undefined}>
                  {l.totalAPagarVencido > 0 ? `${formatMoney(l.totalAPagarVencido)} vencido` : "em dia"}
                </div>
              </div>
            </div>
            <div className={styles.heroSide}>
              <div className={styles.heroStats}>
                <div className={styles.heroStat}>
                  <span className={styles.heroStatValue}>{l.qtdAtivos}</span>
                  <span className={styles.heroStatLabel}>Ativos</span>
                </div>
                <div className={styles.heroStatDivider} />
                <div className={styles.heroStat}>
                  <span className={styles.heroStatValue}>{Math.max(0, l.stats.qtdTotal - l.qtdAtivos)}</span>
                  <span className={styles.heroStatLabel}>Quitados</span>
                </div>
              </div>
            </div>
          </div>
        }
        busca={{ value: l.busca, onChange: l.setBusca, placeholder: "Buscar por descrição ou pessoa…", ariaLabel: "Buscar empréstimo" }}
        filtrosAvancados={[
          {
            // Direção não tem coluna própria (é o Status) → aparece sempre.
            tipo: "select", id: "direcao", label: "Direção", value: l.direcao, neutro: "todos",
            opcoes: [{ value: "todos", label: "Tudo" }, { value: "receber", label: "A receber" }, { value: "pagar", label: "A pagar" }],
            onChange: (v) => l.setDirecao(v as typeof l.direcao),
          },
          {
            tipo: "select", id: "situacao", label: "Situação", value: l.situacao, coluna: "status",
            opcoes: [{ value: "", label: "Todas" }, { value: "ativo", label: "Ativos" }, { value: "quitado", label: "Quitados" }],
            onChange: l.setSituacao,
          },
          {
            tipo: "select", id: "forma", label: "Forma", value: l.forma, coluna: "forma",
            opcoes: [{ value: "", label: "Qualquer" }, { value: "avista", label: "À vista" }, { value: "parcelado", label: "Parcelado" }],
            onChange: l.setForma,
          },
          { tipo: "faixaValor", id: "valor", label: "Restante", coluna: "restante", min: l.valorMin, max: l.valorMax, onChange: l.setFaixaValor },
          { tipo: "faixaData", id: "vencimento", label: "Vencimento", coluna: "vencimento", de: l.vencDe, ate: l.vencAte, onChange: l.setVencimento },
        ]}
        ferramentas={l.candidatosConsolidacao.length > 0 ? (
          <PontesButton size="sm" variant="outline" iconStart={<Layers size={14} strokeWidth={2.5} />}
            onClick={() => l.openConsolidar(l.candidatosConsolidacao[0])}>
            Consolidar
          </PontesButton>
        ) : undefined}
        ferramentasFim={
          <PontesIconButton
            size={32}
            variant={l.mostrarArquivados ? "primary" : "ghost"}
            aria-label="Arquivados"
            title={l.mostrarArquivados ? "Ocultar arquivados" : "Ver arquivados"}
            onClick={() => { l.setMostrarArquivados(!l.mostrarArquivados); l.setPage(1) }}
          >
            <Archive size={16} strokeWidth={2.5} />
          </PontesIconButton>
        }
        tags={tags}
        colunas={colunas}
        colunasPadraoOcultas={["forma", "inicio", "pago", "juros"]}
        itens={l.emprestimos}
        chave={(e) => e.id}
        onLinhaClick={(e) => navigate(`/emprestimos/${e.id}`)}
        renderAcoes={(e) => <ActionIcons e={e} logic={l} mode="full" mostrarDetalhe={false} />}
        vazio={{ icone: <HandCoins size={28} strokeWidth={2.5} />, titulo: "Nenhum empréstimo" }}
        paginacao={
          <PontesTablePagination
            total={l.total} page={l.page} pageSize={l.pageSize}
            onPageChange={l.setPage} onPageSizeChange={(s) => { l.setPageSize(s); l.setPage(1) }}
            itemLabel="empréstimos" itemLabelSingular="empréstimo"
          />
        }
      />

      <EmprestimosLabModals logic={l} />
    </>
  )
}
