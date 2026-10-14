// Bancada de Cartões — E · Imersivo (referências Behance: "Cardex Wallet" e "COREX"): palco escuro na cor
// do banco. Visão geral = os cartões empilhados como na carteira do celular (cada um mostra a fatura no
// topo; o de baixo aparece inteiro); página do cartão = cartão + fatura grande + ações em vidro sobre o
// palco, e as operações embaixo.
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom"
import { Banknote, ChevronLeft, Layers, Pencil, Plus, Repeat, Trash2 } from "lucide-react"
import { PontesCard } from "@/components/pontes"
import { formatMoney } from "@/utils/money"
import type { CartaoCredito } from "../../../types/CartaoCredito"
import CartoesModais from "../CartoesModais"
import NovoParcelamentoModal from "../../Parcelamentos/NovoParcelamentoModal"
import BandeiraMark from "../BandeiraMark"
import { useCartoesLogic } from "../useCartoesLogic"
import { cardGradient, formatDate } from "../cartoesFormato"
import { rotuloMesFatura } from "../ciclosFatura"
import CartoesLabNav from "./CartoesLabNav"
import { CarregandoFatura, FaceCartao, FaturaPorDia, SemCartoes } from "./LabPecas"
import { AssinaturasLista, ParcelamentosBlocos } from "./SecoesCartao"
import { assinaturasDoCartao, custoMensal, useParcelamentosLab } from "./useParcelamentosLab"
import { textoVencimento, useResumoCartoes, type ResumoCartao } from "./useResumoCartoes"
import { mesCurto } from "./faturaLinhas"
import { estagioBanco } from "./labVisual"
import base from "./CartoesLab.module.css"
import styles from "./CartoesLabE.module.css"

const BASE = "/credit-cards/lab-e"

export default function CartoesLabE() {
  const { id } = useParams()
  return id ? <CartaoImersivo key={id} id={id} /> : <CarteiraEmpilhada />
}

/** Cartão da pilha: no topo o que importa (nome + fatura atual), embaixo o final e o disponível. */
function CartaoDaPilha({ c, r, agora, onAbrir }: { c: CartaoCredito; r?: ResumoCartao; agora: number; onAbrir: () => void }) {
  return (
    // Cor do banco = dado do cartão (valor de runtime).
    <button type="button" className={styles.cartaoPilha} disabled={!c.temCredito} onClick={onAbrir}
      style={{ background: cardGradient(c.bancoCor, c.bandeira) }}>
      <span className={styles.pilhaTopo}>
        <span className={styles.pilhaNome}>{c.nome}</span>
        {c.temCredito && <span className={styles.pilhaFatura}>{formatMoney(r?.atual?.valorRestante ?? 0)}</span>}
      </span>
      <span className={styles.pilhaMeio}>{c.temCredito ? textoVencimento(r?.atual, agora) : "só débito"}</span>
      <span className={styles.pilhaBase}>
        <span className={styles.pilhaFinal}>•••• {c.ultimosDigitos ?? "••••"}</span>
        <span className={styles.pilhaDisp}>{c.limite ? <>disponível {formatMoney(c.limiteDisponivel ?? 0)}</> : null}</span>
        <BandeiraMark bandeira={c.bandeira} width={40} />
      </span>
    </button>
  )
}

function CarteiraEmpilhada() {
  const logic = useCartoesLogic({ autoSelecionar: "nenhum" })
  const parc = useParcelamentosLab()
  const { resumo } = useResumoCartoes(logic.cartoes, parc.itens)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { cartoes, now } = logic
  const faturasDoMes = cartoes.reduce((s, c) => s + (resumo[c.id]?.atual?.valorRestante ?? 0), 0)

  return (
    <div className={base.root}>
      <CartoesLabNav atual="e" secao={pathname.endsWith("/parcelamentos") ? "parcelamentos" : "cartoes"} />
      {logic.carregado && cartoes.length === 0 ? <SemCartoes logic={logic} /> : (
        // Palco na cor do 1º cartão (dado de runtime).
        <div className={styles.palco} style={{ background: estagioBanco(cartoes[0]?.bancoCor) }}>
          <div className={styles.palcoResumo}>
            <span className={styles.palcoRotulo}>Faturas deste mês</span>
            <span className={styles.palcoValor}>{formatMoney(faturasDoMes)}</span>
            <span className={styles.palcoMeta}>limite disponível {formatMoney(logic.totalDisp)} de {formatMoney(logic.totalLimite)}</span>
            <button type="button" className={styles.vidro} onClick={logic.openCreate}>
              <Plus size={16} strokeWidth={2.5} aria-hidden="true" /> Adicionar cartão
            </button>
          </div>
          <div className={styles.pilha}>
            {cartoes.map((c) => (
              <CartaoDaPilha key={c.id} c={c} r={resumo[c.id]} agora={now} onAbrir={() => navigate(`${BASE}/cartao/${c.id}`)} />
            ))}
          </div>
        </div>
      )}
      <CartoesModais logic={logic} />
    </div>
  )
}

function CartaoImersivo({ id }: { id: string }) {
  const logic = useCartoesLogic({ cartaoId: id })
  const parc = useParcelamentosLab()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { cartoes, cartaoAtivo, loadingFaturas, ciclos, atualIdx, idxSelecionado, now } = logic
  const f = ciclos[idxSelecionado]
  const parcelamentos = parc.itens === null ? null : parc.itens.filter((p) => p.cartaoCreditoId === id)
  const assinaturas = assinaturasDoCartao(logic.recorrentes, id)
  const assinaturasMes = assinaturas.reduce((s, r) => s + custoMensal(r), 0)
  const aberta = !!f && f.valorRestante > 0
  const podePagar = !!f && aberta && !f.prevista && !f.vazia && new Date(f.dataInicio).getTime() <= now
  const meses = ciclos.map((c, i) => ({ c, i })).filter(({ i }) => i >= atualIdx - 6 && i <= atualIdx + 2).reverse()

  if (logic.carregado && !cartoes.some((c) => c.id === id && c.temCredito)) return <Navigate to={BASE} replace />

  return (
    <div className={base.root}>
      <CartoesLabNav atual="e" secao={pathname.endsWith("/parcelamentos") ? "parcelamentos" : "cartoes"} cartaoId={id} />
      <Link to={BASE} className={base.voltar}><ChevronLeft size={16} strokeWidth={2.5} /> Meus cartões</Link>

      {cartaoAtivo && (
        <>
          <div className={styles.palco} data-cartao="true" style={{ background: estagioBanco(cartaoAtivo.bancoCor) }}>
            <div className={styles.palcoCartao}>
              <FaceCartao c={cartaoAtivo} grande />
              <div className={styles.trocaCartao}>
                {cartoes.filter((c) => c.temCredito && c.id !== id).map((c) => (
                  <button key={c.id} type="button" className={styles.vidro} onClick={() => navigate(`${BASE}/cartao/${c.id}`)}>{c.nome}</button>
                ))}
              </div>
            </div>
            <div className={styles.palcoResumo}>
              {f && (
                <>
                  <span className={styles.palcoRotulo}>{idxSelecionado === atualIdx ? "Fatura atual" : `Fatura de ${rotuloMesFatura(f.dataFechamento).toLowerCase()}`}</span>
                  <span className={styles.palcoValor}>{formatMoney(aberta ? f.valorRestante : f.valorTotal)}</span>
                  {!f.vazia && <span className={styles.palcoMeta}>{f.vencida ? "venceu" : "vence"} {formatDate(f.dataVencimento)} · disponível {formatMoney(cartaoAtivo.limiteDisponivel ?? 0)}</span>}
                </>
              )}
              <div className={styles.acoesVidro}>
                <button type="button" className={styles.acaoVidro} disabled={!podePagar}
                  onClick={() => f && logic.openPagar(f.id, cartaoAtivo.id, f.valorRestante, cartaoAtivo.contaId)}>
                  <Banknote size={18} strokeWidth={2.5} aria-hidden="true" />Pagar
                </button>
                <button type="button" className={styles.acaoVidro} onClick={() => parc.abrirNovo(id)}>
                  <Layers size={18} strokeWidth={2.5} aria-hidden="true" />Parcelar
                </button>
                <button type="button" className={styles.acaoVidro} onClick={() => logic.openEdit(cartaoAtivo)}>
                  <Pencil size={18} strokeWidth={2.5} aria-hidden="true" />Editar
                </button>
                <button type="button" className={styles.acaoVidro} onClick={() => logic.pedirRemocao(cartaoAtivo.id)}>
                  <Trash2 size={18} strokeWidth={2.5} aria-hidden="true" />Remover
                </button>
              </div>
              <div className={styles.mesesVidro} role="tablist" aria-label="Faturas por mês">
                {meses.map(({ c, i }) => (
                  <button key={c.id} type="button" role="tab" aria-selected={i === idxSelecionado} className={styles.mesVidro}
                    data-sel={i === idxSelecionado ? "true" : undefined} onClick={() => logic.irParaFatura(i)}>
                    {mesCurto(c.dataFechamento)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.abaixo}>
            <section className={base.secao}>
              <h2 className={base.secaoTitulo}>Operações</h2>
              <PontesCard padding={0} radius={16}>{loadingFaturas || !f ? <CarregandoFatura /> : <FaturaPorDia logic={logic} f={f} />}</PontesCard>
            </section>
            <div className={styles.lateral}>
              <section className={base.secao}>
                <h2 className={base.secaoTitulo}><Layers size={18} strokeWidth={2.5} aria-hidden="true" /> Parcelamentos</h2>
                <ParcelamentosBlocos itens={parcelamentos} />
              </section>
              <section className={base.secao}>
                <h2 className={base.secaoTitulo}><Repeat size={18} strokeWidth={2.5} aria-hidden="true" /> Assinaturas <span className={base.muted}>· {formatMoney(assinaturasMes)}/mês</span></h2>
                <PontesCard padding={0} radius={16}><AssinaturasLista itens={assinaturas} /></PontesCard>
              </section>
            </div>
          </div>
        </>
      )}

      <CartoesModais logic={logic} />
      <NovoParcelamentoModal key={parc.novo.key} aberto={parc.novo.aberto} onFechar={parc.fecharNovo}
        onCriado={async () => { await parc.carregar(); await logic.abrirCartao(id) }}
        cartoes={parc.cartoes} notify={parc.notify} cartaoInicialId={parc.novo.cartaoId} />
    </div>
  )
}
