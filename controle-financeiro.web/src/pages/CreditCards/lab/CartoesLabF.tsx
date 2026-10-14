// Bancada de Cartões — F · Editorial (referência Behance: "AURA — silêncio digital"): menos interface, mais
// leitura. Número grande, rótulo pequeno em caixa alta, linhas finas de "rótulo → valor", muito branco.
// Visão geral = cada cartão uma coluna de catálogo; página do cartão = o valor da fatura em destaque e os
// lançamentos como um livro-caixa.
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom"
import { ArrowRight, ChevronLeft } from "lucide-react"
import { formatMoney } from "@/utils/money"
import CartoesModais from "../CartoesModais"
import NovoParcelamentoModal from "../../Parcelamentos/NovoParcelamentoModal"
import { useCartoesLogic } from "../useCartoesLogic"
import { formatDate } from "../cartoesFormato"
import { rotuloMesFatura } from "../ciclosFatura"
import CartoesLabNav from "./CartoesLabNav"
import { CarregandoFatura, SemCartoes } from "./LabPecas"
import { assinaturasDoCartao, custoMensal, progressoParcelamento, useParcelamentosLab } from "./useParcelamentosLab"
import { textoVencimento, useResumoCartoes } from "./useResumoCartoes"
import { diaCurto, linhasDaFatura, mesCurto } from "./faturaLinhas"
import base from "./CartoesLab.module.css"
import styles from "./CartoesLabF.module.css"

const BASE = "/credit-cards/lab-f"

export default function CartoesLabF() {
  const { id } = useParams()
  return id ? <CartaoEditorial key={id} id={id} /> : <Catalogo />
}

/** Linha "RÓTULO ........ valor". */
function Linha({ rotulo, valor, tom }: { rotulo: string; valor: string; tom?: "entrada" }) {
  return (
    <div className={styles.linha}>
      <span className={styles.linhaRotulo}>{rotulo}</span>
      <span className={styles.linhaPontos} aria-hidden="true" />
      <span className={styles.linhaValor} data-tom={tom}>{valor}</span>
    </div>
  )
}

function Catalogo() {
  const logic = useCartoesLogic({ autoSelecionar: "nenhum" })
  const parc = useParcelamentosLab()
  const { resumo } = useResumoCartoes(logic.cartoes, parc.itens)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { cartoes, now } = logic
  const faturasDoMes = cartoes.reduce((s, c) => s + (resumo[c.id]?.atual?.valorRestante ?? 0), 0)

  return (
    <div className={base.root}>
      <CartoesLabNav atual="f" secao={pathname.endsWith("/parcelamentos") ? "parcelamentos" : "cartoes"} />
      {logic.carregado && cartoes.length === 0 ? <SemCartoes logic={logic} /> : (
        <div className={styles.pagina}>
          <header className={styles.abertura}>
            <span className={styles.sobrelinha}>Cartões · faturas deste mês</span>
            <span className={styles.numeroGigante}>{formatMoney(faturasDoMes)}</span>
            <span className={styles.legenda}>{cartoes.length} {cartoes.length === 1 ? "cartão" : "cartões"} · limite disponível {formatMoney(logic.totalDisp)}</span>
          </header>

          <div className={styles.catalogo}>
            {cartoes.map((c) => {
              const r = resumo[c.id]
              return (
                <article key={c.id} className={styles.coluna}>
                  <span className={styles.sobrelinha}>{c.bancoNome ?? "Cartão"}</span>
                  <h2 className={styles.nomeCartao}>{c.nome}</h2>
                  {c.temCredito ? (
                    <>
                      <span className={styles.numeroMedio}>{formatMoney(r?.atual?.valorRestante ?? 0)}</span>
                      <span className={styles.legenda}>fatura atual · {textoVencimento(r?.atual, now)}</span>
                      <div className={styles.linhas}>
                        <Linha rotulo="Disponível" valor={formatMoney(c.limiteDisponivel ?? 0)} tom="entrada" />
                        <Linha rotulo="Limite" valor={formatMoney(c.limite ?? 0)} />
                        <Linha rotulo="Parcelado" valor={formatMoney(r?.parcelado ?? 0)} />
                        <Linha rotulo="Fecha / vence" valor={c.diaFechamento ? `${c.diaFechamento} / ${c.diaVencimento}` : "—"} />
                      </div>
                      <button type="button" className={styles.abrir} onClick={() => navigate(`${BASE}/cartao/${c.id}`)}>
                        Abrir <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" />
                      </button>
                    </>
                  ) : <span className={styles.legenda}>só débito</span>}
                </article>
              )
            })}
            <article className={styles.coluna} data-vazia="true">
              <span className={styles.sobrelinha}>Novo</span>
              <button type="button" className={styles.abrir} onClick={logic.openCreate}>Cadastrar cartão <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" /></button>
            </article>
          </div>
        </div>
      )}
      <CartoesModais logic={logic} />
    </div>
  )
}

function CartaoEditorial({ id }: { id: string }) {
  const logic = useCartoesLogic({ cartaoId: id })
  const parc = useParcelamentosLab()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { cartoes, cartaoAtivo, loadingFaturas, ciclos, atualIdx, idxSelecionado, now } = logic
  const f = ciclos[idxSelecionado]
  const linhas = f ? linhasDaFatura(f, logic.faturaDetalhes[f.id]) : null
  const parcelamentos = (parc.itens ?? []).filter((p) => p.cartaoCreditoId === id && p.ativo)
  const assinaturas = assinaturasDoCartao(logic.recorrentes, id)
  const aberta = !!f && f.valorRestante > 0
  const podePagar = !!f && aberta && !f.prevista && !f.vazia && new Date(f.dataInicio).getTime() <= now
  const meses = ciclos.map((c, i) => ({ c, i })).filter(({ i }) => i >= atualIdx - 6 && i <= atualIdx + 2).reverse()

  if (logic.carregado && !cartoes.some((c) => c.id === id && c.temCredito)) return <Navigate to={BASE} replace />

  return (
    <div className={base.root}>
      <CartoesLabNav atual="f" secao={pathname.endsWith("/parcelamentos") ? "parcelamentos" : "cartoes"} cartaoId={id} />
      <Link to={BASE} className={base.voltar}><ChevronLeft size={16} strokeWidth={2.5} /> Meus cartões</Link>

      {cartaoAtivo && (
        <div className={styles.pagina}>
          <header className={styles.abertura}>
            <span className={styles.sobrelinha}>{cartaoAtivo.nome}{cartaoAtivo.ultimosDigitos ? ` · final ${cartaoAtivo.ultimosDigitos}` : ""}</span>
            {f && (
              <>
                <span className={styles.numeroGigante}>{formatMoney(aberta ? f.valorRestante : f.valorTotal)}</span>
                <span className={styles.legenda}>
                  {idxSelecionado === atualIdx ? "fatura atual" : `fatura de ${rotuloMesFatura(f.dataFechamento).toLowerCase()}`}
                  {!f.vazia && ` · ${f.vencida ? "venceu" : "vence"} ${formatDate(f.dataVencimento)}`}
                </span>
              </>
            )}
            <nav className={styles.meses} aria-label="Faturas por mês">
              {meses.map(({ c, i }) => (
                <button key={c.id} type="button" className={styles.mes} data-sel={i === idxSelecionado ? "true" : undefined}
                  onClick={() => logic.irParaFatura(i)}>{mesCurto(c.dataFechamento)}</button>
              ))}
            </nav>
            <div className={styles.acoesTexto}>
              {podePagar && f && <button type="button" className={styles.abrir} onClick={() => logic.openPagar(f.id, cartaoAtivo.id, f.valorRestante, cartaoAtivo.contaId)}>Pagar fatura <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" /></button>}
              <button type="button" className={styles.abrir} onClick={() => parc.abrirNovo(id)}>Parcelar compra <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" /></button>
              <button type="button" className={styles.abrir} onClick={() => logic.openEdit(cartaoAtivo)}>Editar <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" /></button>
              <button type="button" className={styles.abrir} data-tom="perigo" onClick={() => logic.pedirRemocao(cartaoAtivo.id)}>Remover</button>
            </div>
          </header>

          <div className={styles.duasColunas}>
            <section>
              <h2 className={styles.tituloSecao}>Lançamentos</h2>
              {loadingFaturas || linhas === null ? <CarregandoFatura /> : linhas.length === 0 ? <span className={styles.legenda}>Nada nesta fatura.</span> : (
                <div className={styles.livro}>
                  {linhas.map((l) => (
                    <button key={`${l.tipo}-${l.id}`} type="button" className={styles.livroLinha}
                      data-tipo={l.tipo}
                      onClick={() => {
                        if (l.tipo === "compra" && !l.prevista) navigate(`/transactions/${l.id}`, { state: { voltarPara: pathname } })
                        else if (l.tipo === "parcela") navigate(`/credit-cards/parcelamentos/${l.parcelamentoId}`)
                        else if (l.tipo === "pagamento" && f) logic.pedirEstorno({ id: l.id, valor: l.valor, cartaoId: f.cartaoCreditoId, faturaId: f.id })
                      }}>
                      <span className={styles.livroData}>{diaCurto(l.dia)}</span>
                      <span className={styles.livroDesc}>{l.descricao}{l.tipo === "parcela" && <span className={styles.livroParcela}> {l.numero}/{l.total}</span>}</span>
                      <span className={styles.linhaPontos} aria-hidden="true" />
                      <span className={styles.linhaValor} data-tom={l.tipo === "pagamento" ? "entrada" : undefined}>{formatMoney(l.valor)}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <aside className={styles.margem}>
              <h2 className={styles.tituloSecao}>O cartão</h2>
              <div className={styles.linhas}>
                <Linha rotulo="Disponível" valor={formatMoney(cartaoAtivo.limiteDisponivel ?? 0)} tom="entrada" />
                <Linha rotulo="Usado" valor={formatMoney(cartaoAtivo.limiteUsado ?? 0)} />
                <Linha rotulo="Limite" valor={formatMoney(cartaoAtivo.limite ?? 0)} />
                <Linha rotulo="Fecha / vence" valor={cartaoAtivo.diaFechamento ? `${cartaoAtivo.diaFechamento} / ${cartaoAtivo.diaVencimento}` : "—"} />
              </div>

              <h2 className={styles.tituloSecao}>Parcelado</h2>
              <div className={styles.linhas}>
                {parcelamentos.length === 0 ? <span className={styles.legenda}>Nada parcelado.</span> : parcelamentos.map((p) => (
                  <button key={p.id} type="button" className={styles.linhaBotao} onClick={() => navigate(`/credit-cards/parcelamentos/${p.id}`)}>
                    <Linha rotulo={`${p.descricao} · ${p.parcelasPagas}/${p.quantidadeParcelas}`} valor={`até ${progressoParcelamento(p).termina ?? "—"}`} />
                  </button>
                ))}
              </div>

              <h2 className={styles.tituloSecao}>Assinaturas</h2>
              <div className={styles.linhas}>
                {assinaturas.length === 0 ? <span className={styles.legenda}>Nenhuma no cartão.</span> : assinaturas.map((r) => (
                  <Linha key={r.id} rotulo={r.descricao} valor={`${formatMoney(custoMensal(r))}/mês`} />
                ))}
              </div>
            </aside>
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
