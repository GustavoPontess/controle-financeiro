// Relatórios do v2 = o check-up do mês (plano: docs/features/relatorios/plano.md). A tela é uma linha de raciocínio, de
// cima pra baixo, cada seção respondendo a pergunta que a anterior levanta (Gustavo, 2026-11-01: "por onde faz sentido
// começar e o próximo dado que a pessoa vai querer ver"):
//   1. Como estou? A resposta primeiro, no mesmo bloco em qualquer mês (Gustavo, 2026-11-01: "a pessoa troca de mês e
//      estranha não ver a tela do mesmo jeito"): quanto ainda dá pra gastar (ou quanto sobrou), o que entrou e o que
//      saiu, a barra da renda e os limites. O título diz o mês ("Novembro até agora", "Como foi outubro"). O resumo
//      entrou/saiu/sobrou só aparece se o dinheiro do mês não carregar.
//   2. Por quê? Pra onde foi a sua renda (cada categoria como parte da renda, contra o normal) e onde dá pra economizar.
//      É outra coisa que o topo (Gustavo: "um mostra o quanto ainda posso gastar, o limite e tudo, o outro a distribuição
//      do que eu tenho de renda naquele mês pelas categorias").
//   3. O que eu faço? Os avisos das outras telas, juntos (antes ficavam no alto e cortavam a leitura).
//   4. Como venho indo? Entradas e saídas por mês.
//   5. O que vem pela frente? Contas fixas e parcelas (quanto da renda já tem dono).
//   6. Se apertar, aguento? A reserva de emergência (régua de 0 a 12 meses).
// Cada coisa num lugar só (Gustavo, 2026-11-01: "estamos com dois lugares que fazem a mesma coisa"): os achados curtos
// do topo saíram (repetiam o corte, o comprometido e a reserva, que têm a seção deles); o aviso de limite sai dos avisos
// quando os limites estão no topo (com a etiqueta); as faturas a pagar ficam só em "Contas fixas e parcelas".
// Os títulos das seções dizem o que é (pedido do Gustavo, 2026-10-29). A conta e as frases vêm prontas do servidor (GET
// /relatorios/check-up, /relatorios/sinais, /dinheiro-do-mes e /orcamentos); aqui só a vitrine e os gráficos. Tocar numa
// categoria abre Transações filtrada (pela URL). Exporta os lançamentos do mês em CSV.
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Download } from "lucide-react"
import { getCheckUp, getSinais, urlCsvDoMes } from "../services/relatorioService"
import { getDinheiroDoMes } from "../services/dinheiroDoMesService"
import { getLimitesDoMes } from "../services/limiteService"
import type { CheckUp, Sinal } from "../types/Relatorio"
import type { DinheiroDoMes } from "../types/DinheiroDoMes"
import type { LimitesDoMes } from "../types/Limite"
import { seriesDasCategorias } from "../dominio/serieDaCategoria"
import BarraDaRenda, { type PedacoDaRenda } from "../componentes/BarraDaRenda"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import Bullet from "../componentes/Bullet"
import { Dinheiro } from "../componentes/Dinheiro"
import GraficoBarras from "../componentes/GraficoBarras"
import GraficoBarrasComparacao, { type LinhaComparacao } from "../componentes/GraficoBarrasComparacao"
import NavegadorMes, { nomeDoPeriodo, periodoDeHoje, type Periodo } from "../componentes/NavegadorMes"
import QuantoPossoGastar from "../componentes/QuantoPossoGastar"
import Resposta from "../componentes/Resposta"
import styles from "./Relatorios.module.css"

const CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
const numero = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })
/** O "O que vale olhar" mostra no máximo isto (Seus dados primeiro, depois os avisos na ordem do servidor). */
const MAX_AVISOS = 6
const SEM_CATEGORIA = "00000000-0000-0000-0000-000000000000"
/** A régua da reserva vai até aqui (meses do gasto normal); as faixas marcam 3 e 6. */
const REGUA_RESERVA = 12

export default function Relatorios() {
  const navigate = useNavigate()
  const hoje = periodoDeHoje()
  const [periodo, setPeriodo] = useState<Periodo>(hoje)
  const [dados, setDados] = useState<CheckUp | null>(null)
  const [avisos, setAvisos] = useState<Sinal[]>([])
  const [doMes, setDoMes] = useState<DinheiroDoMes | null>(null)
  const [limites, setLimites] = useState<LimitesDoMes | null>(null)
  /** O dinheiro do mês não carregou: o topo volta a ser o resumo (entrou − saiu). */
  const [semDoMes, setSemDoMes] = useState(false)
  const [erro, setErro] = useState(false)
  const ehHoje = periodo.ano === hoje.ano && periodo.mes === hoje.mes
  const topoDaRenda = !semDoMes

  useEffect(() => {
    let vivo = true
    // Trocar de mês mantém o mês anterior na tela até o novo chegar (sem esqueleto: a tela piscava inteira). O topo é a
    // exceção: os números dele são do mês e o título muda ("ainda posso gastar" × "sobrou"), então espera o novo.
    setErro(false); setSemDoMes(false); setDoMes(null); setLimites(null)
    getCheckUp(periodo.ano, periodo.mes).then((d) => { if (vivo) setDados(d) }).catch(() => { if (vivo) setErro(true) })
    getSinais(periodo.ano, periodo.mes).then((s) => { if (vivo) setAvisos(s) }).catch(() => { if (vivo) setAvisos([]) /* a seção fica só com Seus dados */ })
    getDinheiroDoMes(periodo.ano, periodo.mes).then((d) => { if (vivo) setDoMes(d) }).catch(() => { if (vivo) setSemDoMes(true) })
    getLimitesDoMes(periodo.ano, periodo.mes).then((l) => { if (vivo) setLimites(l) }).catch(() => { /* a seção fica sem os limites */ })
    return () => { vivo = false }
  }, [periodo])

  const mesNome = nomeDoPeriodo(periodo).toLowerCase()
  // Ao trocar de mês o check-up anterior fica na tela até o novo chegar: a comparação do topo só usa o do mês certo.
  const dadosDoMes = dados && dados.ano === periodo.ano && dados.mes === periodo.mes ? dados : null
  /** "Novembro" (sem o ano), pro título do topo. */
  const soOMes = nomeDoPeriodo(periodo).split(" de ")[0]
  const mesQuery = `${periodo.ano}-${String(periodo.mes).padStart(2, "0")}`
  const verCategoria = (chave: string) => navigate(`/transacoes?categoriaId=${chave}&mes=${mesQuery}`)
  // Os limites estão no topo, com a etiqueta (Passou, Vai passar): o aviso de limite não se repete nos avisos.
  const limitesNaTela = topoDaRenda && !!doMes && !!limites
  const lista = dados ? [...dados.sinais, ...avisos.filter((s) => !(limitesNaTela && s.origem === "limite"))].slice(0, MAX_AVISOS) : []
  const anterior = dados ? CURTOS[(dados.mes + 10) % 12] : null
  // Uma cor por categoria, a mesma em todas as seções (a ordem do "Pra onde foi" manda; o resto vem depois).
  const serieDe = useMemo(() => seriesDasCategorias(dados?.praOndeFoi ?? [], doMes?.jaSaiuPorCategoria ?? [],
    (limites?.limites ?? []).map((l) => ({ categoriaId: l.categoriaId, nome: l.categoria }))), [dados, doMes, limites])

  return (
    <div className={styles.pagina}>
      <div className={styles.topo}>
        <NavegadorMes periodo={periodo} onChange={setPeriodo} ate={hoje} />
        <a className={styles.csv} href={urlCsvDoMes(periodo.ano, periodo.mes)} download aria-label="Exportar lançamentos do mês (CSV)">
          <Download size={15} strokeWidth={2.25} aria-hidden="true" /><span className={styles.csvTexto}>Exportar lançamentos do mês (CSV)</span>
        </a>
      </div>

      {erro ? <Bloco><p className={styles.vazio} role="alert">Não deu pra carregar o check-up.</p></Bloco> : (
        <>
          {/* 1. Como estou? O mesmo bloco em qualquer mês: mês atual, quanto ainda posso gastar; mês fechado, quanto sobrou. */}
          {topoDaRenda ? (
            <Bloco titulo={ehHoje ? `${soOMes} até agora` : `Como foi ${soOMes.toLowerCase()}`} acao="Orçamento" para="/orcamento">
              {!doMes ? <Esqueleto linhas={3} altura={18} /> : (
                <QuantoPossoGastar dados={doMes} limites={limites} serieDe={serieDe} fechado={!ehHoje} gastoNormal={dados?.gastoNormal}
                  comparacao={dadosDoMes ? { entrou: dadosDoMes.variacaoEntrou, saiu: dadosDoMes.variacaoSaiu, anterior } : undefined} />
              )}
            </Bloco>
          ) : (
            <Bloco titulo={dados?.mesAtual ? "Resumo do mês até agora" : "Resumo do mês"}>
              {!dados ? <Esqueleto linhas={3} altura={18} /> : <ResumoDoMes dados={dados} anterior={anterior} />}
            </Bloco>
          )}

          {/* 2. Por quê? Pra onde foi a minha renda (olha pra trás) + onde dá pra economizar */}
          <Bloco titulo={dados?.mesAtual ? "Pra onde foi a sua renda até agora" : "Pra onde foi a sua renda"}>
            {!dados ? <Esqueleto linhas={4} altura={18} />
              : dados.praOndeFoi.length === 0 && !dados.semCategoria ? <p className={styles.vazioSemRespiro}>Nenhum gasto em {mesNome}.</p>
              : <PraOndeFoi dados={dados} renda={doMes ? doMes.rendaBase : dados.entrou} serieDe={serieDe} aoEscolher={verCategoria}
                  aoPlanejar={() => navigate("/orcamento")} aoVerContaFixa={(id) => navigate(`/contas-fixas/${id}`)} />}
          </Bloco>

          {/* 3. O que eu faço? Os avisos das outras telas, juntos */}
          {lista.length > 0 && (
            <Bloco titulo="Avisos do mês">
              <div className={styles.avisos}>
                {lista.map((s) => <Resposta key={s.chave} compacta tom={s.resposta.tom} texto={s.resposta.texto} acoes={s.resposta.acoes} />)}
              </div>
            </Bloco>
          )}

          {/* 4. Como venho indo? */}
          <Bloco titulo="Entradas e saídas por mês">
            {!dados ? <Esqueleto linhas={3} altura={18} /> : <MesAMes dados={dados} aoEscolher={(m) => setPeriodo(m)} />}
          </Bloco>

          {/* 5. O que vem pela frente? */}
          <Bloco titulo="Contas fixas e parcelas">
            {!dados ? <Esqueleto linhas={3} altura={18} /> : <Comprometido dados={dados} mesNome={mesNome} />}
          </Bloco>

          {/* 6. Se apertar, aguento? */}
          <Bloco titulo="Reserva de emergência">
            {!dados ? <Esqueleto linhas={2} altura={18} /> : (
              <div className={styles.reserva}>
                <div className={styles.reservaNumero}>
                  <span className={styles.grande}>
                    {dados.mesesDeReserva != null ? `${numero(dados.mesesDeReserva)} ${dados.mesesDeReserva === 1 ? "mês" : "meses"}` : <Dinheiro valor={dados.dinheiroGuardado} />}
                  </span>
                  <span className={styles.extra}>
                    <Dinheiro valor={dados.dinheiroGuardado} /> nas contas
                    {dados.gastoNormal != null ? <> ÷ <Dinheiro valor={dados.gastoNormal} /> de gasto normal por mês</> : " · sem meses anteriores pra comparar"}
                  </span>
                  {dados.mesesDeReserva != null && (
                    <Bullet valor={Math.min(100, (dados.mesesDeReserva / REGUA_RESERVA) * 100)} faixas={[25, 50]}
                      escala={["0", "3 meses", "6 meses", `${REGUA_RESERVA}+`]}
                      rotulo={`Reserva de ${numero(dados.mesesDeReserva)} meses numa régua de 0 a ${REGUA_RESERVA}, com marcas em 3 e 6`} />
                  )}
                </div>
                <div className={styles.cartao}>
                  {dados.respostaReserva && <Resposta tom={dados.respostaReserva.tom} texto={dados.respostaReserva.texto} acoes={dados.respostaReserva.acoes} />}
                  {dados.guardadoNasMetas > 0 && (
                    <dl className={styles.dados}>
                      <div><dt>Guardado nas metas (fora da reserva)</dt><dd><Dinheiro valor={dados.guardadoNasMetas} /></dd></div>
                    </dl>
                  )}
                </div>
              </div>
            )}
          </Bloco>
        </>
      )}
    </div>
  )
}

/** O topo quando o dinheiro do mês não carregou: quanto sobrou em destaque e, ao lado, a conta (entrou − saiu) com a
 *  variação contra o mês anterior. O mesmo desenho do bloco de sempre ("Quanto ainda posso gastar" / "Quanto sobrou"): a
 *  resposta grande à esquerda, a conta à direita. */
function ResumoDoMes({ dados, anterior }: { dados: CheckUp; anterior: string | null }) {
  return (
    <div className={styles.cabeca}>
      <div className={styles.heroi}>
        <span className={styles.rotulo}>{dados.mesAtual ? "Sobrou até agora" : "Sobrou"}</span>
        <Dinheiro valor={dados.sobrou} className={styles.heroiValor} tom={dados.sobrou < 0 ? "negativo" : undefined} />
        <span className={styles.extra}>
          {!dados.mesAtual && dados.sobrou >= 0 && dados.percentualQueSobrou != null && `${dados.percentualQueSobrou}% do que entrou · `}
          {anterior} sobrou <Dinheiro valor={dados.sobrouMesAnterior} />
        </span>
      </div>
      <dl className={styles.conta}>
        <div>
          <dt>Entrou</dt>
          <dd><Dinheiro valor={dados.entrou} /></dd>
          <Variacao valor={dados.variacaoEntrou} sobeEhBom anterior={anterior} />
        </div>
        <div>
          <dt><span aria-hidden="true">− </span>Saiu</dt>
          <dd><Dinheiro valor={dados.saiu} /></dd>
          <Variacao valor={dados.variacaoSaiu} anterior={anterior} />
        </div>
      </dl>
    </div>
  )
}

/** A variação contra o mês anterior (a cor diz se foi bom; sem sinal +/−). */
function Variacao({ valor, sobeEhBom, anterior }: { valor: number | null; sobeEhBom?: boolean; anterior: string | null }) {
  if (valor == null || valor === 0 || !anterior) return null
  const bom = sobeEhBom ? valor > 0 : valor < 0
  return (
    <dd className={styles.sub}>
      <span className={styles.variacao} data-bom={bom || undefined}>{Math.abs(valor)}% {valor > 0 ? "a mais" : "a menos"}</span> que {anterior}
    </dd>
  )
}

/** Cada categoria como parte da renda (não do gasto), na ordem do servidor (as maiores primeiro), contra o normal; em
 *  cima a renda numa barra só (a lista é a legenda) e, ao lado, onde dá pra economizar. `renda`: a mesma do topo (a do
 *  dinheiro do mês: no mês atual, o maior entre o esperado e o recebido, porque no dia 1 quase nada entrou ainda e a
 *  parte passava de 200%; no mês fechado, o que entrou). Sem renda, a parte volta a ser do gasto. A cor de cada
 *  categoria é a mesma nas outras seções (serieDe). */
function PraOndeFoi({ dados, renda, serieDe, aoEscolher, aoPlanejar, aoVerContaFixa }: {
  dados: CheckUp; renda: number; serieDe: (categoriaId: string | null, nome: string) => string
  aoEscolher: (chave: string) => void; aoPlanejar: () => void; aoVerContaFixa: (id: string) => void
}) {
  const daRenda = renda > 0
  const parte = (valor: number, doGasto: number) => (daRenda ? Math.round((valor * 1000) / renda) / 10 : doGasto)
  const linhas: LinhaComparacao[] = dados.praOndeFoi.map((c) => ({
    chave: c.categoriaId ?? c.nome, nome: c.nome, valor: c.valor, previsto: c.previsto, normal: c.normal, variacao: c.variacaoPercentual,
    parte: parte(c.valor, c.percentualDoGasto), serie: serieDe(c.categoriaId, c.nome),
  }))
  const sc = dados.semCategoria
  if (sc) linhas.push({
    chave: SEM_CATEGORIA, nome: "Sem categoria", valor: sc.valor, normal: null, variacao: null, parte: parte(sc.valor, sc.percentualDoGasto), serie: "cinza",
    extra: `${sc.quantidade} ${sc.quantidade === 1 ? "lançamento" : "lançamentos"} pra classificar`,
  })
  const pedacos: PedacoDaRenda[] = linhas.map((l) => ({ chave: l.chave, nome: l.nome, valor: l.valor, serie: l.serie }))
  const clicaveis = (chave: string) => chave !== "Outras" && aoEscolher(chave)
  const pct = (v: number) => `${numero(Math.round((v * 1000) / renda) / 10)}%`
  return (
    <div className={styles.renda} data-com-corte={dados.corte ? "true" : undefined}>
      <div className={styles.cartao}>
        {daRenda && (dados.mesAtual ? (
          <p className={styles.rendaFrase}>
            Da renda do mês (<Dinheiro valor={renda} />), <strong>{pct(dados.saiu)}</strong> já foi pros gastos.
          </p>
        ) : (
          <p className={styles.rendaFrase}>
            Entrou <Dinheiro valor={renda} />: <strong>{pct(dados.saiu)}</strong> foi pros gastos
            {dados.sobrou >= 0 ? <> e <strong>{pct(dados.sobrou)}</strong> sobrou.</> : <> e passou <Dinheiro valor={-dados.sobrou} />.</>}
          </p>
        ))}
        <BarraDaRenda pedacos={pedacos} renda={renda} />
        <GraficoBarrasComparacao rotulo="Pra onde foi" linhas={linhas} aoEscolher={clicaveis} />
        <span className={styles.legendaNormal}>
          {dados.praOndeFoi.some((c) => c.normal) && <><i aria-hidden="true" />o seu normal (média dos meses anteriores) · listrado: ainda vem · </>}
          % {!daRenda ? "do gasto" : dados.mesAtual ? "da renda do mês" : "do que entrou"} · toque pra ver os lançamentos
        </span>
      </div>

      {dados.corte && (
        <div className={styles.economizar}>
          <h3 className={styles.subtitulo}>Onde dá pra economizar</h3>
          <Resposta tom={dados.corte.resposta.tom} texto={dados.corte.resposta.texto} />
          {dados.corte.itens.length > 0 && (
            <ul className={styles.cortes}>
              {dados.corte.itens.map((i) => (
                <li key={`${i.tipo}-${i.id ?? i.nome}`}>
                  <span className={styles.corteTopo}>
                    <span className={styles.corteNome}>{i.tipo === "conta-fixa" ? `Conta fixa nova: ${i.nome}` : i.nome}</span>
                    <span className={styles.corteAMais}><Dinheiro valor={i.aMais} />{i.tipo === "conta-fixa" ? " por mês" : " a mais"}</span>
                  </span>
                  {i.tipo === "categoria" && i.normal != null && (
                    <span className={styles.corteDetalhe}>
                      <Dinheiro valor={i.valor} /> este mês · normal <Dinheiro valor={i.normal} />
                      {i.previsto > 0 && <> · ainda vem <Dinheiro valor={i.previsto} /></>}
                    </span>
                  )}
                  <span className={styles.corteAcoes}>
                    {i.tipo === "categoria" && i.id && <button type="button" onClick={() => aoEscolher(i.id!)}>Ver lançamentos</button>}
                    {i.tipo === "categoria" && <button type="button" onClick={aoPlanejar}>Pôr um planejado</button>}
                    {i.tipo === "conta-fixa" && i.id && <button type="button" onClick={() => aoVerContaFixa(i.id!)}>Ver a conta fixa</button>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function Comprometido({ dados, mesNome }: { dados: CheckUp; mesNome: string }) {
  const c = dados.comprometido
  return (
    <div className={styles.comprometido}>
      <div className={styles.cartao}>
        {dados.percentualComprometido != null && (
          <>
            <span className={styles.grande}>{dados.percentualComprometido}%<span className={styles.grandeRotulo}> da renda vai pra contas fixas e parcelas</span></span>
            <Bullet valor={dados.percentualComprometido} faixas={[c.faixaAtencao, c.faixaAlerta]}
              rotulo={`${dados.percentualComprometido}% da renda comprometida`} />
          </>
        )}
        {c.resposta && <Resposta tom={c.resposta.tom} texto={c.resposta.texto} acoes={c.resposta.acoes} />}
        {c.folgaPorMes != null && (
          <div className={styles.folga}>
            <span>Folga por mês</span>
            <Dinheiro valor={c.folgaPorMes} className={styles.folgaValor} tom={c.folgaPorMes < 0 ? "negativo" : undefined} />
          </div>
        )}
      </div>
      <dl className={styles.dados}>
        <div>
          <dt>Contas fixas por mês
            {c.maioresContasFixas.length > 0 && (
              <span className={styles.sub}>
                {c.maioresContasFixas.map((f) => f.descricao).join(" · ")}
                {c.totalContasFixas > c.maioresContasFixas.length && ` · e mais ${c.totalContasFixas - c.maioresContasFixas.length}`}
              </span>
            )}
          </dt>
          <dd><Dinheiro valor={dados.contasFixasPorMes} /></dd>
        </div>
        <div>
          <dt>Parcelas em {mesNome}
            {c.parcelasProximosMeses.length > 0 && (
              <span className={styles.sub}>
                {c.parcelasProximosMeses.map((p, i) => <span key={`${p.ano}-${p.mes}`}>{i > 0 && " · "}{CURTOS[p.mes - 1]} <Dinheiro valor={p.valor} /></span>)}
                {c.parcelasAteAno && ` · até ${CURTOS[(c.parcelasAteMes ?? 1) - 1]}/${String(c.parcelasAteAno).slice(2)}`}
              </span>
            )}
            {c.parcelaQueAcaba && (
              <span className={styles.subBom}>
                A parcela de {c.parcelaQueAcaba.descricao} acaba em {nomeDoPeriodo(c.parcelaQueAcaba).toLowerCase()}: <Dinheiro valor={c.parcelaQueAcaba.porMes} /> a menos todo mês depois
              </span>
            )}
          </dt>
          <dd><Dinheiro valor={dados.parcelasDoMes} /></dd>
        </div>
        {c.faturas.length > 0 && (
          <div>
            <dt>Faturas a pagar este mês
              <span className={styles.sub}>
                {c.faturas.map((f) => (
                  <span key={f.cartaoId + f.vencimento} data-atrasada={f.atrasada || undefined} className={styles.fatura}>
                    {f.cartao} {f.atrasada ? "atrasada " : ""}<Dinheiro valor={f.restante} />
                  </span>
                ))}
              </span>
            </dt>
            <dd><Dinheiro valor={c.faturas.reduce((s, f) => s + f.restante, 0)} /></dd>
          </div>
        )}
        {c.metasPedemPorMes > 0 && (
          <div><dt>As metas pedem por mês<span className={styles.sub}>fora do %: é o que você escolhe guardar</span></dt><dd><Dinheiro valor={c.metasPedemPorMes} /></dd></div>
        )}
      </dl>
    </div>
  )
}

/** Do primeiro mês com algum lançamento até o escolhido. */
function MesAMes({ dados, aoEscolher }: { dados: CheckUp; aoEscolher: (p: Periodo) => void }) {
  const primeiro = dados.mesAMes.findIndex((m) => m.entrou > 0 || m.saiu > 0)
  const meses = primeiro < 0 ? [] : dados.mesAMes.slice(primeiro)
  if (meses.length === 0) return <p className={styles.vazioSemRespiro}>Ainda não há meses com lançamentos.</p>
  return <GraficoBarras meses={meses} escolhido={{ ano: dados.ano, mes: dados.mes }} aoEscolher={(m) => aoEscolher({ ano: m.ano, mes: m.mes })} />
}
