// Bancada de Cartões — E · Imersivo (referências Behance: "Cardex Wallet" e "COREX"): palco escuro na cor
// do banco. Visão geral = carrossel de cartões no palco (o do meio grande, os vizinhos espiando; ◀ ▶,
// bolinhas, deslizar) com o resumo do cartão do meio ao lado, e embaixo últimas compras dele, faturas por
// mês, parcelamentos e assinaturas; página do cartão = cartão + fatura grande + ações em vidro e operações.
import { useEffect, useRef, useState } from "react"
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom"
import { ArrowRight, Banknote, ChevronLeft, ChevronRight, Layers, Pencil, Plus, Repeat, Trash2 } from "lucide-react"
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
import { BarrasMeses, CarregandoFatura, FaceCartao, FaturaPorDia, SemCartoes } from "./LabPecas"
import { AssinaturasLista, ParcelamentosBlocos, ParcelamentosLista } from "./SecoesCartao"
import { assinaturasDoCartao, custoMensal, useParcelamentosLab } from "./useParcelamentosLab"
import { textoVencimento, useResumoCartoes, type ResumoCartao } from "./useResumoCartoes"
import { mesCurto } from "./faturaLinhas"
import { estagioBanco, totaisPorMes } from "./labVisual"
import base from "./CartoesLab.module.css"
import styles from "./CartoesLabE.module.css"

const BASE = "/credit-cards/lab-e"

export default function CartoesLabE() {
  const { id } = useParams()
  return id ? <CartaoImersivo key={id} id={id} /> : <CarteiraEmCarrossel />
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

function CarteiraEmCarrossel() {
  const logic = useCartoesLogic({ autoSelecionar: "nenhum" })
  const parc = useParcelamentosLab()
  const { resumo, faturasPorCartao } = useResumoCartoes(logic.cartoes, parc.itens)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { cartoes, now } = logic
  const [idx, setIdx] = useState(0)
  const i = Math.min(idx, Math.max(0, cartoes.length - 1))
  const ativo = cartoes[i]
  const r = ativo ? resumo[ativo.id] : undefined

  // O cartão do meio do carrossel carrega as faturas dele (pras "últimas compras" embaixo).
  const ativoId = ativo?.temCredito ? ativo.id : undefined
  const { abrirCartao } = logic
  useEffect(() => { if (ativoId) void abrirCartao(ativoId) }, [ativoId]) // eslint-disable-line react-hooks/exhaustive-deps
  const faturaAtual = ativoId && logic.cartaoAtivo?.id === ativoId ? logic.ciclos[logic.atualIdx] : undefined

  const ir = (passo: number) => setIdx(Math.max(0, Math.min(cartoes.length - 1, i + passo)))
  // Deslizar no celular: arrasto horizontal de 40px+ troca o cartão.
  const toque = useRef<number | null>(null)
  const barras = totaisPorMes(faturasPorCartao, cartoes.find((c) => c.temCredito)?.diaFechamento)
  const ativos = (parc.itens ?? []).filter((p) => p.ativo)
  const assinaturas = logic.recorrentes.filter((x) => x.cartaoCreditoId && (x.situacao === "ativa" || x.situacao === "pausada"))
  const assinaturasMes = assinaturas.reduce((s2, x) => s2 + custoMensal(x), 0)
  const faturasDoMes = cartoes.reduce((s2, c) => s2 + (resumo[c.id]?.atual?.valorRestante ?? 0), 0)
  const abrir = (id: string) => navigate(`${BASE}/cartao/${id}`)

  return (
    <div className={base.root}>
      <CartoesLabNav atual="e" secao={pathname.endsWith("/parcelamentos") ? "parcelamentos" : "cartoes"} />
      {logic.carregado && cartoes.length === 0 ? <SemCartoes logic={logic} /> : (
        <>
          {/* Palco na cor do cartão do meio (dado de runtime) — muda junto quando passa o cartão. */}
          <div className={styles.palco} style={{ background: estagioBanco(ativo?.bancoCor) }}>
            <div className={styles.palcoResumo}>
              <span className={styles.palcoRotulo}>{ativo ? `${ativo.nome} · fatura atual` : "Fatura atual"}</span>
              <span className={styles.palcoValor}>{ativo?.temCredito ? formatMoney(r?.atual?.valorRestante ?? 0) : "—"}</span>
              <span className={styles.palcoMeta}>
                {ativo?.temCredito ? <>{textoVencimento(r?.atual, now)} · disponível {formatMoney(ativo.limiteDisponivel ?? 0)}</> : "só débito"}
              </span>
              {r?.aPagar && <span className={styles.palcoAlerta}>{formatMoney(r.aPagar.valorRestante)} da fatura fechada a pagar</span>}
              <div className={styles.acoesLinha}>
                {ativo?.temCredito && (
                  <button type="button" className={styles.vidroForte} onClick={() => abrir(ativo.id)}>
                    Abrir cartão <ArrowRight size={16} strokeWidth={2.5} aria-hidden="true" />
                  </button>
                )}
                <button type="button" className={styles.vidro} onClick={logic.openCreate}>
                  <Plus size={16} strokeWidth={2.5} aria-hidden="true" /> Adicionar cartão
                </button>
              </div>
              <span className={styles.palcoTotais}>
                {cartoes.length} {cartoes.length === 1 ? "cartão" : "cartões"} · faturas deste mês {formatMoney(faturasDoMes)} · limite disponível {formatMoney(logic.totalDisp)}
              </span>
            </div>

            <div className={styles.carrosselBloco}>
              <div className={styles.carrossel} aria-roledescription="carrossel" aria-label="Cartões"
                onTouchStart={(e) => { toque.current = e.touches[0].clientX }}
                onTouchEnd={(e) => {
                  if (toque.current == null) return
                  const dx = e.changedTouches[0].clientX - toque.current
                  if (Math.abs(dx) > 40) ir(dx < 0 ? 1 : -1)
                  toque.current = null
                }}>
                {cartoes.map((c, k) => {
                  const pos = k - i
                  const posicao = pos === 0 ? "centro" : pos === -1 ? "esquerda" : pos === 1 ? "direita" : pos < 0 ? "longe-esquerda" : "longe-direita"
                  return (
                    <div key={c.id} className={styles.slide} data-pos={posicao} aria-hidden={pos !== 0}>
                      <CartaoDaPilha c={c} r={resumo[c.id]} agora={now}
                        onAbrir={() => (pos === 0 ? c.temCredito && abrir(c.id) : setIdx(k))} />
                    </div>
                  )
                })}
              </div>
              {cartoes.length > 1 && (
                <div className={styles.controles}>
                  <button type="button" className={styles.seta} aria-label="Cartão anterior" disabled={i === 0} onClick={() => ir(-1)}>
                    <ChevronLeft size={18} strokeWidth={2.5} />
                  </button>
                  <div className={styles.pontos}>
                    {cartoes.map((c, k) => (
                      <button key={c.id} type="button" className={styles.ponto} data-sel={k === i ? "true" : undefined}
                        aria-label={`Ver ${c.nome}`} onClick={() => setIdx(k)} />
                    ))}
                  </div>
                  <button type="button" className={styles.seta} aria-label="Próximo cartão" disabled={i === cartoes.length - 1} onClick={() => ir(1)}>
                    <ChevronRight size={18} strokeWidth={2.5} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className={styles.abaixo}>
            <section className={base.secao}>
              <h2 className={base.secaoTitulo}>Últimas compras{ativo ? ` · ${ativo.nome}` : ""}</h2>
              <PontesCard padding={0} radius={16}>
                {!ativoId ? <div className={base.estado}><span className={base.muted}>Cartão só de débito, sem fatura.</span></div>
                  : !faturaAtual || logic.loadingFaturas ? <CarregandoFatura />
                  : <FaturaPorDia logic={logic} f={faturaAtual} limite={6} onVerTudo={() => abrir(ativoId)} />}
              </PontesCard>
            </section>
            <div className={styles.lateral}>
              <section className={base.secao}>
                <h2 className={base.secaoTitulo}>Faturas por mês <span className={base.muted}>· todos os cartões</span></h2>
                <PontesCard padding={16} radius={16}>
                  <BarrasMeses compacto barras={barras.slice(1, 8).map((b) => ({ chave: b.mes, rotulo: b.rotulo, valor: b.valor, atual: b.atual }))} />
                </PontesCard>
              </section>
              <section className={base.secao}>
                <h2 className={base.secaoTitulo}><Layers size={18} strokeWidth={2.5} aria-hidden="true" /> Parcelamentos <span className={base.muted}>· {formatMoney(ativos.reduce((s2, p) => s2 + p.valorRestante, 0))}</span></h2>
                <PontesCard padding={0} radius={16}><ParcelamentosLista itens={parc.itens === null ? null : ativos.slice(0, 4)} /></PontesCard>
              </section>
              <section className={base.secao}>
                <h2 className={base.secaoTitulo}><Repeat size={18} strokeWidth={2.5} aria-hidden="true" /> Assinaturas <span className={base.muted}>· {formatMoney(assinaturasMes)}/mês</span></h2>
                <PontesCard padding={0} radius={16}><AssinaturasLista itens={assinaturas} tituloVazio="Nenhuma assinatura nos cartões" /></PontesCard>
              </section>
            </div>
          </div>
        </>
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
