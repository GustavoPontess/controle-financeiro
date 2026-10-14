// Bancada de Cartões — B · Explorador. Dois níveis:
// 1) /credit-cards/lab-b — "Meus cartões" em tabela (PontesTabela, como Transações): uma linha por
//    cartão com fatura atual, vencimento, limite e parcelado; totais em cima. Clicar abre o cartão.
// 2) /credit-cards/lab-b/cartao/:id — coluna fixa com os cartões; o aberto mostra o menu das partes
//    (Fatura, Parcelamentos, Assinaturas, Dados) com o valor de cada uma; a parte ocupa o resto.
import { useState, type ReactNode } from "react"
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom"
import { ChevronLeft, CreditCard, Layers, Plus, ReceiptText, Repeat } from "lucide-react"
import { PontesBadge, PontesButton, PontesCard, PontesProgress, PontesStatCard, PontesTabela } from "@/components/pontes"
import { formatMoney } from "@/utils/money"
import type { CartaoCredito } from "../../../types/CartaoCredito"
import CartoesModais from "../CartoesModais"
import NovoParcelamentoModal from "../../Parcelamentos/NovoParcelamentoModal"
import { useCartoesLogic } from "../useCartoesLogic"
import CartoesLabNav from "./CartoesLabNav"
import { CarregandoFatura, FaturaPorDia, IdentidadeCartao, NavMes, ResumoFatura } from "./LabPecas"
import { AssinaturasLista, DetalhesCartao, FiltroSituacao, ParcelamentosLista } from "./SecoesCartao"
import { assinaturasDoCartao, custoMensal, useParcelamentosLab } from "./useParcelamentosLab"
import { textoVencimento, useResumoCartoes } from "./useResumoCartoes"
import styles from "./CartoesLab.module.css"

const BASE = "/credit-cards/lab-b"

export default function CartoesLabB() {
  const { id } = useParams()
  return id ? <ExploradorDoCartao key={id} id={id} /> : <MeusCartoes />
}

function MeusCartoes() {
  const logic = useCartoesLogic({ autoSelecionar: "nenhum" })
  const parc = useParcelamentosLab()
  const { resumo } = useResumoCartoes(logic.cartoes, parc.itens)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { cartoes, now } = logic
  const faturasDoMes = cartoes.reduce((s, c) => s + (resumo[c.id]?.atual?.valorRestante ?? 0), 0)
  const parcelado = cartoes.reduce((s, c) => s + (resumo[c.id]?.parcelado ?? 0), 0)

  return (
    <div className={styles.root}>
      <CartoesLabNav atual="b" secao={pathname.endsWith("/parcelamentos") ? "parcelamentos" : "cartoes"} />
      <PontesTabela<CartaoCredito>
        id="cartoes-lab-meus-cartoes"
        titulo="Meus cartões"
        acao={{ label: "Novo cartão", onClick: logic.openCreate }}
        resumo={(
          <div className={styles.kpis}>
            <PontesStatCard label="Faturas deste mês" value={formatMoney(faturasDoMes)} />
            <PontesStatCard label="Limite disponível" value={formatMoney(logic.totalDisp)} tone="success" hint={`de ${formatMoney(logic.totalLimite)}`} />
            <PontesStatCard label="Limite usado" value={formatMoney(logic.totalUsado)} />
            <PontesStatCard label="Parcelado a pagar" value={formatMoney(parcelado)} />
          </div>
        )}
        carregando={!logic.carregado}
        itens={cartoes}
        chave={(c) => c.id}
        onLinhaClick={(c) => c.temCredito && navigate(`${BASE}/cartao/${c.id}`)}
        vazio={{ icone: <CreditCard size={28} />, titulo: "Nenhum cartão cadastrado" }}
        colunas={[
          { key: "cartao", header: "Cartão", render: (c) => <IdentidadeCartao cartao={c} /> },
          {
            key: "fatura", header: "Fatura atual", render: (c) => {
              const r = resumo[c.id]
              if (!c.temCredito) return <span className={styles.muted}>só débito</span>
              return (
                <span className={styles.celulaFatura}>
                  <span className={styles.valorLinha}>{formatMoney(r?.atual?.valorRestante ?? 0)}</span>
                  <span className={styles.muted}>{textoVencimento(r?.atual, now)}</span>
                  {r?.aPagar && <PontesBadge tone={r.aPagar.vencida ? "danger" : "warning"} size="sm">{formatMoney(r.aPagar.valorRestante)} da fechada</PontesBadge>}
                </span>
              )
            },
          },
          {
            key: "limite", header: "Disponível", render: (c) => {
              if (!c.limite) return "—"
              const pct = Math.min(((c.limiteUsado ?? 0) / c.limite) * 100, 100)
              return (
                <span className={styles.progressoCelula}>
                  <span data-tom="entrada" className={styles.valorLinha}>{formatMoney(c.limiteDisponivel ?? 0)}</span>
                  <PontesProgress value={pct} showValue={false} height={4} color={pct > 80 ? "var(--pontes-danger)" : "var(--pontes-primary)"} />
                </span>
              )
            },
          },
          { key: "fecha", header: "Fecha / vence", render: (c) => (c.diaFechamento ? `dia ${c.diaFechamento} / dia ${c.diaVencimento}` : "—") },
          { key: "parcelado", header: "Parcelado", numerica: true, render: (c) => formatMoney(resumo[c.id]?.parcelado ?? 0) },
        ]}
      />
      <CartoesModais logic={logic} />
    </div>
  )
}

type Secao = "fatura" | "parcelamentos" | "assinaturas" | "cartao"

function ExploradorDoCartao({ id }: { id: string }) {
  const logic = useCartoesLogic({ cartaoId: id })
  const parc = useParcelamentosLab()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [secao, setSecao] = useState<Secao>(pathname.endsWith("/parcelamentos") ? "parcelamentos" : "fatura")
  const { cartoes, cartaoAtivo, loadingFaturas, ciclos, atualIdx } = logic
  const f = ciclos[logic.idxSelecionado]
  const atual = ciclos[atualIdx]

  const parcelamentos = parc.itens === null ? null : parc.itens.filter((p) => p.cartaoCreditoId === id)
  const parceladoAPagar = (parcelamentos ?? []).filter((p) => p.ativo).reduce((s, p) => s + p.valorRestante, 0)
  const assinaturas = assinaturasDoCartao(logic.recorrentes, id)
  const assinaturasMes = assinaturas.reduce((s, r) => s + custoMensal(r), 0)

  if (logic.carregado && !cartoes.some((c) => c.id === id && c.temCredito)) return <Navigate to={BASE} replace />

  const itensMenu: { secao: Secao; rotulo: string; icone: ReactNode; valor?: string }[] = [
    { secao: "fatura", rotulo: "Fatura", icone: <ReceiptText size={16} strokeWidth={2.5} />, valor: atual && !atual.vazia ? formatMoney(atual.valorRestante > 0 ? atual.valorRestante : atual.valorTotal) : undefined },
    { secao: "parcelamentos", rotulo: "Parcelamentos", icone: <Layers size={16} strokeWidth={2.5} />, valor: formatMoney(parceladoAPagar) },
    { secao: "assinaturas", rotulo: "Assinaturas", icone: <Repeat size={16} strokeWidth={2.5} />, valor: `${formatMoney(assinaturasMes)}/mês` },
    { secao: "cartao", rotulo: "Dados do cartão", icone: <CreditCard size={16} strokeWidth={2.5} /> },
  ]

  return (
    <div className={styles.root}>
      <CartoesLabNav atual="b" secao={secao === "parcelamentos" ? "parcelamentos" : "cartoes"} cartaoId={id} />

      <div className={styles.mestreDetalhe}>
        <aside className={styles.arvore} aria-label="Cartões">
          <Link to={BASE} className={styles.voltar}><ChevronLeft size={16} strokeWidth={2.5} /> Meus cartões</Link>
          {cartoes.filter((c) => c.temCredito).map((c) => {
            const sel = c.id === id
            const pct = c.limite ? Math.min(((c.limiteUsado ?? 0) / c.limite) * 100, 100) : 0
            return (
              <div key={c.id} className={styles.arvoreGrupo} data-sel={sel ? "true" : undefined}>
                <button type="button" className={styles.arvoreCartao} onClick={() => !sel && navigate(`${BASE}/cartao/${c.id}`)}>
                  <IdentidadeCartao cartao={c} />
                  {c.limite ? (
                    <span className={styles.itemCartaoLimite}>
                      <span className={styles.itemCartaoLinha}>
                        <span className={styles.muted}>disponível</span>
                        <span data-tom="entrada" className={styles.valorLinha}>{formatMoney(c.limiteDisponivel ?? 0)}</span>
                      </span>
                      <PontesProgress value={pct} showValue={false} height={4} color={pct > 80 ? "var(--pontes-danger)" : "var(--pontes-primary)"} />
                    </span>
                  ) : null}
                </button>
                {sel && (
                  <nav className={styles.subnav} aria-label={`Partes do cartão ${c.nome}`}>
                    {itensMenu.map((it) => (
                      <button key={it.secao} type="button" className={styles.subnavItem} data-sel={secao === it.secao ? "true" : undefined}
                        onClick={() => setSecao(it.secao)}>
                        <span className={styles.subnavRotulo}>{it.icone}{it.rotulo}</span>
                        {it.valor && <span className={styles.subnavValor}>{it.valor}</span>}
                      </button>
                    ))}
                  </nav>
                )}
              </div>
            )
          })}
        </aside>

        {cartaoAtivo && (
          <PontesCard padding={0} radius={16}>
            {secao === "fatura" && (loadingFaturas || !f ? <CarregandoFatura /> : (
              <>
                <div className={styles.detalheResumos}><ResumoFatura logic={logic} f={f} /></div>
                <NavMes logic={logic} />
                <FaturaPorDia logic={logic} f={f} />
              </>
            ))}
            {secao === "parcelamentos" && (
              <>
                <div className={styles.painelTopo}>
                  <h2 className={styles.painelTitulo}>Parcelamentos</h2>
                  <span className={styles.painelAcoes}>
                    <FiltroSituacao filtro={parc.filtro} setFiltro={parc.setFiltro} />
                    <PontesButton size="sm" iconStart={<Plus size={16} strokeWidth={2.5} />} onClick={() => parc.abrirNovo(id)}>Novo</PontesButton>
                  </span>
                </div>
                <ParcelamentosLista itens={parcelamentos} />
              </>
            )}
            {secao === "assinaturas" && (
              <>
                <div className={styles.painelTopo}><h2 className={styles.painelTitulo}>Assinaturas no cartão</h2></div>
                <AssinaturasLista itens={assinaturas} />
              </>
            )}
            {secao === "cartao" && (
              <>
                <div className={styles.painelTopo}><h2 className={styles.painelTitulo}>Dados do cartão</h2></div>
                <div className={styles.estado}><DetalhesCartao logic={logic} cartao={cartaoAtivo} /></div>
              </>
            )}
          </PontesCard>
        )}
      </div>

      <CartoesModais logic={logic} />
      <NovoParcelamentoModal key={parc.novo.key} aberto={parc.novo.aberto} onFechar={parc.fecharNovo}
        onCriado={async () => { await parc.carregar(); await logic.abrirCartao(id) }}
        cartoes={parc.cartoes} notify={parc.notify} cartaoInicialId={parc.novo.cartaoId} />
    </div>
  )
}
