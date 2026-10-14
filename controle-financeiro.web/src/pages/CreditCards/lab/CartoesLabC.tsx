// Bancada de Cartões — C · App do banco. Dois níveis:
// 1) /credit-cards/lab-c — a "carteira": os cartões na cor do banco, grandes, cada um com a fatura atual
//    e o disponível embaixo; o total das faturas do mês em destaque. Tocar abre o cartão.
// 2) /credit-cards/lab-c/cartao/:id — o cartão como no app do banco: fatura em destaque, atalhos
//    (pagar, parcelar, editar, remover) e as seções Fatura / Parcelamentos / Assinaturas, uma embaixo da outra.
import { useEffect, useRef } from "react"
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom"
import { Banknote, ChevronLeft, Layers, Pencil, Plus, Repeat, Trash2 } from "lucide-react"
import { PontesBadge, PontesCard } from "@/components/pontes"
import { formatMoney } from "@/utils/money"
import CartoesModais from "../CartoesModais"
import NovoParcelamentoModal from "../../Parcelamentos/NovoParcelamentoModal"
import { useCartoesLogic } from "../useCartoesLogic"
import { formatDate } from "../cartoesFormato"
import { rotuloMesFatura } from "../ciclosFatura"
import CartoesLabNav from "./CartoesLabNav"
import { CarregandoFatura, FaceCartao, FaturaPorDia, LinhaMeses, SemCartoes } from "./LabPecas"
import { AssinaturasLista, FiltroSituacao, ParcelamentosBlocos } from "./SecoesCartao"
import { assinaturasDoCartao, custoMensal, useParcelamentosLab } from "./useParcelamentosLab"
import { textoVencimento, useResumoCartoes } from "./useResumoCartoes"
import styles from "./CartoesLab.module.css"

const BASE = "/credit-cards/lab-c"

export default function CartoesLabC() {
  const { id } = useParams()
  return id ? <CartaoNoApp key={id} id={id} /> : <Carteira />
}

function Carteira() {
  const logic = useCartoesLogic({ autoSelecionar: "nenhum" })
  const parc = useParcelamentosLab()
  const { resumo } = useResumoCartoes(logic.cartoes, parc.itens)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { cartoes, now } = logic
  const faturasDoMes = cartoes.reduce((s, c) => s + (resumo[c.id]?.atual?.valorRestante ?? 0), 0)

  return (
    <div className={styles.root}>
      <CartoesLabNav atual="c" secao={pathname.endsWith("/parcelamentos") ? "parcelamentos" : "cartoes"} />

      {logic.carregado && cartoes.length === 0 ? <SemCartoes logic={logic} /> : (
        <>
          <div className={styles.destaque}>
            <span className={styles.rotulo}>Faturas deste mês</span>
            <span className={styles.destaqueValor}>{formatMoney(faturasDoMes)}</span>
            <span className={styles.muted}>limite disponível {formatMoney(logic.totalDisp)} de {formatMoney(logic.totalLimite)}</span>
          </div>

          <div className={styles.carteira}>
            {cartoes.map((c) => {
              const r = resumo[c.id]
              return (
                <button key={c.id} type="button" className={styles.itemCarteira} disabled={!c.temCredito}
                  onClick={() => navigate(`${BASE}/cartao/${c.id}`)}>
                  <FaceCartao c={c} grande />
                  {c.temCredito ? (
                    <span className={styles.itemCarteiraInfo}>
                      <span className={styles.itemCartaoLinha}>
                        <span className={styles.muted}>Fatura atual</span>
                        <span className={styles.valorLinha}>{formatMoney(r?.atual?.valorRestante ?? 0)}</span>
                      </span>
                      <span className={styles.itemCartaoLinha}>
                        <span className={styles.muted}>{textoVencimento(r?.atual, now)}</span>
                        <span className={styles.muted}>disponível <strong data-tom="entrada">{formatMoney(c.limiteDisponivel ?? 0)}</strong></span>
                      </span>
                      {r?.aPagar && <PontesBadge tone={r.aPagar.vencida ? "danger" : "warning"} size="sm">{formatMoney(r.aPagar.valorRestante)} da fatura fechada</PontesBadge>}
                    </span>
                  ) : <span className={styles.itemCarteiraInfo}><span className={styles.muted}>só débito</span></span>}
                </button>
              )
            })}
            <button type="button" className={styles.carteiraNovo} onClick={logic.openCreate}>
              <Plus size={24} strokeWidth={2.5} aria-hidden="true" /> Adicionar cartão
            </button>
          </div>
        </>
      )}

      <CartoesModais logic={logic} />
    </div>
  )
}

function CartaoNoApp({ id }: { id: string }) {
  const logic = useCartoesLogic({ cartaoId: id })
  const parc = useParcelamentosLab()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const vemDeParcelamentos = pathname.endsWith("/parcelamentos")
  const { cartoes, cartaoAtivo, loadingFaturas, ciclos, idxSelecionado, atualIdx, now } = logic
  const f = ciclos[idxSelecionado]

  const parcelamentos = parc.itens === null ? null : parc.itens.filter((p) => p.cartaoCreditoId === id)
  const parceladoAPagar = (parcelamentos ?? []).filter((p) => p.ativo).reduce((s, p) => s + p.valorRestante, 0)
  const assinaturas = assinaturasDoCartao(logic.recorrentes, id)
  const assinaturasMes = assinaturas.reduce((s, r) => s + custoMensal(r), 0)
  const aberta = !!f && f.valorRestante > 0
  const podePagar = !!f && aberta && !f.prevista && !f.vazia && new Date(f.dataInicio).getTime() <= now

  // Vindo de Parcelamentos (passador), desce direto pra seção.
  const secaoParcelamentos = useRef<HTMLElement | null>(null)
  const rolou = useRef(false)
  useEffect(() => {
    if (!vemDeParcelamentos || rolou.current || parc.itens === null || !cartaoAtivo) return
    rolou.current = true
    secaoParcelamentos.current?.scrollIntoView({ block: "start" })
  }, [vemDeParcelamentos, parc.itens, cartaoAtivo])

  if (logic.carregado && !cartoes.some((c) => c.id === id && c.temCredito)) return <Navigate to={BASE} replace />

  return (
    <div className={styles.root}>
      <CartoesLabNav atual="c" secao={vemDeParcelamentos ? "parcelamentos" : "cartoes"} cartaoId={id} />
      <Link to={BASE} className={styles.voltar}><ChevronLeft size={16} strokeWidth={2.5} /> Meus cartões</Link>

      <div className={styles.carrossel} role="tablist" aria-label="Cartões">
        {cartoes.filter((c) => c.temCredito).map((c) => (
          <button key={c.id} type="button" role="tab" aria-selected={c.id === id} className={styles.miniCartao}
            data-sel={c.id === id ? "true" : undefined} onClick={() => c.id !== id && navigate(`${BASE}/cartao/${c.id}`)}>
            <FaceCartao c={c} />
          </button>
        ))}
      </div>

      {cartaoAtivo && (
        <>
          {f && (
            <div className={styles.destaque}>
              <span className={styles.rotulo}>{idxSelecionado === atualIdx ? "Fatura atual" : `Fatura de ${rotuloMesFatura(f.dataFechamento).toLowerCase()}`}</span>
              <span className={styles.destaqueValor}>{formatMoney(aberta ? f.valorRestante : f.valorTotal)}</span>
              {!f.vazia && <span className={styles.muted}>{f.vencida ? "venceu" : "vence"} {formatDate(f.dataVencimento)} · limite disponível {formatMoney(cartaoAtivo.limiteDisponivel ?? 0)}</span>}
            </div>
          )}

          <div className={styles.atalhos}>
            <button type="button" className={styles.atalho} disabled={!podePagar}
              onClick={() => f && logic.openPagar(f.id, cartaoAtivo.id, f.valorRestante, cartaoAtivo.contaId)}>
              <span className={styles.atalhoIcone}><Banknote size={20} strokeWidth={2.5} /></span>Pagar fatura
            </button>
            <button type="button" className={styles.atalho} onClick={() => parc.abrirNovo(id)}>
              <span className={styles.atalhoIcone}><Layers size={20} strokeWidth={2.5} /></span>Parcelar compra
            </button>
            <button type="button" className={styles.atalho} onClick={() => logic.openEdit(cartaoAtivo)}>
              <span className={styles.atalhoIcone}><Pencil size={20} strokeWidth={2.5} /></span>Editar cartão
            </button>
            <button type="button" className={styles.atalho} onClick={() => logic.pedirRemocao(cartaoAtivo.id)}>
              <span className={styles.atalhoIcone} data-tom="perigo"><Trash2 size={20} strokeWidth={2.5} /></span>Remover
            </button>
          </div>

          <section className={styles.secao}>
            <h2 className={styles.secaoTitulo}>Fatura</h2>
            {loadingFaturas || !f ? <CarregandoFatura /> : (
              <>
                <LinhaMeses logic={logic} />
                <PontesCard padding={0} radius={16}><FaturaPorDia logic={logic} f={f} /></PontesCard>
              </>
            )}
          </section>

          <section className={styles.secao} ref={secaoParcelamentos}>
            <div className={styles.secaoTopo}>
              <h2 className={styles.secaoTitulo}><Layers size={18} strokeWidth={2.5} aria-hidden="true" /> Parcelamentos <span className={styles.muted}>· {formatMoney(parceladoAPagar)} a pagar</span></h2>
              <FiltroSituacao filtro={parc.filtro} setFiltro={parc.setFiltro} />
            </div>
            <ParcelamentosBlocos itens={parcelamentos} />
          </section>

          <section className={styles.secao}>
            <h2 className={styles.secaoTitulo}><Repeat size={18} strokeWidth={2.5} aria-hidden="true" /> Assinaturas <span className={styles.muted}>· {formatMoney(assinaturasMes)}/mês</span></h2>
            <PontesCard padding={0} radius={16}><AssinaturasLista itens={assinaturas} /></PontesCard>
          </section>
        </>
      )}

      <CartoesModais logic={logic} />
      <NovoParcelamentoModal key={parc.novo.key} aberto={parc.novo.aberto} onFechar={parc.fecharNovo}
        onCriado={async () => { await parc.carregar(); await logic.abrirCartao(id) }}
        cartoes={parc.cartoes} notify={parc.notify} cartaoInicialId={parc.novo.cartaoId} />
    </div>
  )
}
