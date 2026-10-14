// Bancada de Cartões — D · Bento (referência Behance: "Approx / AI Finance Dashboard"): grade de blocos de
// tamanhos diferentes, cada bloco uma pergunta respondida (quanto vem por mês, quanto do limite usei, cada
// cartão, parcelado, assinaturas). Dois níveis, como os outros labs: visão geral e página do cartão.
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom"
import { Banknote, ChevronLeft, Layers, Pencil, Plus, Repeat, Trash2 } from "lucide-react"
import { PontesButton, PontesProgress } from "@/components/pontes"
import { formatMoney } from "@/utils/money"
import CartoesModais from "../CartoesModais"
import NovoParcelamentoModal from "../../Parcelamentos/NovoParcelamentoModal"
import { useCartoesLogic } from "../useCartoesLogic"
import CartoesLabNav from "./CartoesLabNav"
import { BarrasMeses, CarregandoFatura, DonutLimite, FaceCartao, FaturaPorDia, ResumoFatura, SemCartoes } from "./LabPecas"
import { AssinaturasLista, ParcelamentosLista } from "./SecoesCartao"
import { assinaturasDoCartao, custoMensal, progressoParcelamento, useParcelamentosLab } from "./useParcelamentosLab"
import { textoVencimento, useResumoCartoes } from "./useResumoCartoes"
import { mesCurto } from "./faturaLinhas"
import { totaisPorMes } from "./labVisual"
import base from "./CartoesLab.module.css"
import styles from "./CartoesLabD.module.css"

const BASE = "/credit-cards/lab-d"

export default function CartoesLabD() {
  const { id } = useParams()
  return id ? <CartaoBento key={id} id={id} /> : <BentoGeral />
}

function BentoGeral() {
  const logic = useCartoesLogic({ autoSelecionar: "nenhum" })
  const parc = useParcelamentosLab()
  const { resumo, faturasPorCartao } = useResumoCartoes(logic.cartoes, parc.itens)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { cartoes, now } = logic
  const barras = totaisPorMes(faturasPorCartao, cartoes.find((c) => c.temCredito)?.diaFechamento)
  const ativos = (parc.itens ?? []).filter((p) => p.ativo)
  const parcelado = ativos.reduce((s, p) => s + p.valorRestante, 0)
  const assinaturas = logic.recorrentes.filter((r) => r.cartaoCreditoId && (r.situacao === "ativa" || r.situacao === "pausada"))
  const assinaturasMes = assinaturas.reduce((s, r) => s + custoMensal(r), 0)

  return (
    <div className={base.root}>
      <CartoesLabNav atual="d" secao={pathname.endsWith("/parcelamentos") ? "parcelamentos" : "cartoes"} />
      {logic.carregado && cartoes.length === 0 ? <SemCartoes logic={logic} /> : (
        <div className={styles.bento}>
          <section className={styles.tile} data-span="8">
            <header className={styles.tileTopo}>
              <span className={base.rotulo}>Faturas por mês</span>
              <span className={base.muted}>todos os cartões</span>
            </header>
            <BarrasMeses barras={barras.map((b) => ({ chave: b.mes, rotulo: b.rotulo, valor: b.valor, atual: b.atual }))} />
          </section>

          <section className={styles.tile} data-span="4">
            <header className={styles.tileTopo}><span className={base.rotulo}>Limite</span></header>
            <DonutLimite usado={logic.totalUsado} limite={logic.totalLimite} />
          </section>

          {cartoes.map((c) => {
            const r = resumo[c.id]
            return (
              <button key={c.id} type="button" className={styles.tile} data-span="4" data-clicavel="true"
                disabled={!c.temCredito} onClick={() => navigate(`${BASE}/cartao/${c.id}`)}>
                <FaceCartao c={c} />
                {c.temCredito ? (
                  <span className={styles.tileLinhas}>
                    <span className={base.itemCartaoLinha}><span className={base.muted}>fatura atual</span><span className={base.valorLinha}>{formatMoney(r?.atual?.valorRestante ?? 0)}</span></span>
                    <span className={base.itemCartaoLinha}><span className={base.muted}>{textoVencimento(r?.atual, now)}</span></span>
                    <span className={base.itemCartaoLinha}><span className={base.muted}>disponível</span><span data-tom="entrada" className={base.valorLinha}>{formatMoney(c.limiteDisponivel ?? 0)}</span></span>
                  </span>
                ) : <span className={base.muted}>só débito</span>}
              </button>
            )
          })}

          <section className={styles.tile} data-span="4">
            <header className={styles.tileTopo}>
              <span className={base.rotulo}><Layers size={14} strokeWidth={2.5} aria-hidden="true" /> Parcelado</span>
              <span className={base.valorLinha}>{formatMoney(parcelado)}</span>
            </header>
            <div className={styles.miniLista}>
              {ativos.slice(0, 4).map((p) => {
                const g = progressoParcelamento(p)
                return (
                  <button key={p.id} type="button" className={styles.miniItem} onClick={() => navigate(`/credit-cards/parcelamentos/${p.id}`)}>
                    <span className={base.itemCartaoLinha}><span className={base.parcNome}>{p.descricao}</span><span className={base.muted}>{p.parcelasPagas}/{p.quantidadeParcelas}</span></span>
                    <PontesProgress value={g.pct} showValue={false} height={4} />
                  </button>
                )
              })}
              {ativos.length === 0 && <span className={base.muted}>Nada parcelado.</span>}
            </div>
          </section>

          <section className={styles.tile} data-span="4">
            <header className={styles.tileTopo}>
              <span className={base.rotulo}><Repeat size={14} strokeWidth={2.5} aria-hidden="true" /> Assinaturas</span>
              <span className={base.valorLinha}>{formatMoney(assinaturasMes)}<span className={base.muted}>/mês</span></span>
            </header>
            <div className={styles.miniLista}>
              {assinaturas.slice(0, 4).map((r) => (
                <span key={r.id} className={base.itemCartaoLinha}><span className={base.parcNome}>{r.descricao}</span><span className={base.valorLinha}>{formatMoney(r.valor)}</span></span>
              ))}
              {assinaturas.length === 0 && <span className={base.muted}>Nenhuma assinatura no cartão.</span>}
            </div>
          </section>

          <button type="button" className={styles.tileNovo} data-span="4" onClick={logic.openCreate}>
            <Plus size={22} strokeWidth={2.5} aria-hidden="true" /> Novo cartão
          </button>
        </div>
      )}
      <CartoesModais logic={logic} />
    </div>
  )
}

function CartaoBento({ id }: { id: string }) {
  const logic = useCartoesLogic({ cartaoId: id })
  const parc = useParcelamentosLab()
  const { pathname } = useLocation()
  const { cartoes, cartaoAtivo, loadingFaturas, ciclos, atualIdx, idxSelecionado, now } = logic
  const f = ciclos[idxSelecionado]
  const parcelamentos = parc.itens === null ? null : parc.itens.filter((p) => p.cartaoCreditoId === id)
  const assinaturas = assinaturasDoCartao(logic.recorrentes, id)
  const assinaturasMes = assinaturas.reduce((s, r) => s + custoMensal(r), 0)
  // Barras: do ciclo atual 2 pra trás e 8 pra frente (ciclos vem do mais novo pro mais antigo).
  const janela = ciclos.map((c, i) => ({ c, i })).filter(({ i }) => i >= atualIdx - 8 && i <= atualIdx + 2).reverse()
  const podePagar = !!f && f.valorRestante > 0 && !f.prevista && !f.vazia && new Date(f.dataInicio).getTime() <= now

  if (logic.carregado && !cartoes.some((c) => c.id === id && c.temCredito)) return <Navigate to={BASE} replace />

  return (
    <div className={base.root}>
      <CartoesLabNav atual="d" secao={pathname.endsWith("/parcelamentos") ? "parcelamentos" : "cartoes"} cartaoId={id} />
      <Link to={BASE} className={base.voltar}><ChevronLeft size={16} strokeWidth={2.5} /> Meus cartões</Link>

      {cartaoAtivo && (
        <div className={styles.bento}>
          <section className={styles.tile} data-span="4">
            <FaceCartao c={cartaoAtivo} />
            <div className={styles.acoes}>
              <PontesButton size="sm" iconStart={<Banknote size={16} strokeWidth={2.5} />} disabled={!podePagar}
                onClick={() => f && logic.openPagar(f.id, cartaoAtivo.id, f.valorRestante, cartaoAtivo.contaId)}>Pagar</PontesButton>
              <PontesButton size="sm" variant="outline" iconStart={<Pencil size={16} strokeWidth={2.5} />} onClick={() => logic.openEdit(cartaoAtivo)}>Editar</PontesButton>
              <PontesButton size="sm" variant="ghost" iconStart={<Trash2 size={16} strokeWidth={2.5} />} onClick={() => logic.pedirRemocao(cartaoAtivo.id)}>Remover</PontesButton>
            </div>
          </section>

          <section className={styles.tile} data-span="4">
            {loadingFaturas || !f ? <CarregandoFatura /> : <ResumoFatura logic={logic} f={f} />}
          </section>

          <section className={styles.tile} data-span="4">
            <header className={styles.tileTopo}><span className={base.rotulo}>Limite</span></header>
            <DonutLimite usado={cartaoAtivo.limiteUsado ?? 0} limite={cartaoAtivo.limite ?? 0} />
          </section>

          <section className={styles.tile} data-span="12">
            <header className={styles.tileTopo}><span className={base.rotulo}>Faturas por mês</span><span className={base.muted}>toque pra abrir o mês</span></header>
            <BarrasMeses
              barras={janela.map(({ c, i }) => ({ chave: String(i), rotulo: mesCurto(c.dataFechamento), valor: c.vazia ? 0 : c.valorTotal, atual: i === atualIdx, sel: i === idxSelecionado }))}
              onEscolher={(chave) => logic.irParaFatura(Number(chave))} />
          </section>

          <section className={styles.tile} data-span="8" data-sem-respiro="true">
            <header className={styles.tileTopo} data-com-respiro="true"><span className={base.rotulo}>Lançamentos</span></header>
            {loadingFaturas || !f ? <CarregandoFatura /> : <FaturaPorDia logic={logic} f={f} />}
          </section>

          <div className={styles.coluna} data-span="4">
            <section className={styles.tile} data-sem-respiro="true">
              <header className={styles.tileTopo} data-com-respiro="true">
                <span className={base.rotulo}><Layers size={14} strokeWidth={2.5} aria-hidden="true" /> Parcelamentos</span>
                <PontesButton size="sm" variant="ghost" iconStart={<Plus size={14} strokeWidth={2.5} />} onClick={() => parc.abrirNovo(id)}>Novo</PontesButton>
              </header>
              <ParcelamentosLista itens={parcelamentos} />
            </section>
            <section className={styles.tile} data-sem-respiro="true">
              <header className={styles.tileTopo} data-com-respiro="true">
                <span className={base.rotulo}><Repeat size={14} strokeWidth={2.5} aria-hidden="true" /> Assinaturas</span>
                <span className={base.valorLinha}>{formatMoney(assinaturasMes)}<span className={base.muted}>/mês</span></span>
              </header>
              <AssinaturasLista itens={assinaturas} />
            </section>
          </div>
        </div>
      )}

      <CartoesModais logic={logic} />
      <NovoParcelamentoModal key={parc.novo.key} aberto={parc.novo.aberto} onFechar={parc.fecharNovo}
        onCriado={async () => { await parc.carregar(); await logic.abrirCartao(id) }}
        cartoes={parc.cartoes} notify={parc.notify} cartaoInicialId={parc.novo.cartaoId} />
    </div>
  )
}
