// Relatórios do v2 = o check-up do mês (plano: docs/features/relatorios/plano.md). A tela é uma linha de raciocínio, de
// cima pra baixo, cada seção respondendo a pergunta que a anterior levanta (Gustavo, 2026-11-01: "por onde faz sentido
// começar e o próximo dado que a pessoa vai querer ver"):
//   Ao lado do título: o ano (uma lista, já no atual), o período (um mês ou "Ano completo") e o Baixar (Gustavo,
//      2026-11-01: "o seletor de ano vem automático no ano atual, e outro pra meses chamado período, pra selecionar o ano
//      completo"). O Baixar é este relatório em PDF (Gustavo: "é pra baixar esse relatório em pdf, não as transações"):
//      abre a impressão do navegador só com o relatório (sem o menu e os botões), e lá a pessoa salva como PDF. No "Ano completo" o bloco de cima mostra o ano somado (entrou, saiu, investiu e sobrou contra o
//      planejado, e as categorias somadas, contra o mesmo período do ano anterior e o limite do ano); o que é próprio de
//      mês (quanto dá pra gastar por dia, o que dá pra fazer, contas fixas, reserva) não aparece.
//   A linha do tempo, dentro do bloco de cima, logo abaixo do título (Gustavo: "quero que fique logo abaixo do bloco"):
//      um mês por coluna (entrou × saiu e o que sobrou), do primeiro com lançamento até o atual; tocar num mês leva a
//      tela pra ele (Gustavo, 2026-11-01: "não estou gostando desse jeito de passar os meses; dá pra melhorar passando
//      pelo gráfico?"). É o "como venho indo" e o seletor de mês ao mesmo tempo, no lugar das setas e do gráfico
//      "Entradas e saídas por mês" que ficava no pé da tela. Ela não muda quando o mês muda. Ao lado do título, "Baixar"
//      (os lançamentos do mês em CSV) no lugar do link pro Orçamento.
//   1. Como estou e por quê? Um bloco só, o mesmo em qualquer mês (Gustavo, 2026-11-01: "a pessoa troca de mês e
//      estranha não ver a tela do mesmo jeito"): quanto ainda dá pra gastar (ou quanto sobrou), o que entrou e o que
//      saiu, a barra da renda e, logo abaixo, as categorias numa lista só, que é a legenda da barra e junta o pra onde
//      foi, o normal e o limite de cada uma (Gustavo: "dá pra juntar tudo sem repetir"); depois, o que ainda vem. O
//      título diz o mês ("Novembro até agora", "Como foi outubro"). O resumo entrou/saiu/sobrou só aparece se o
//      dinheiro do mês não carregar (com a mesma lista embaixo).
//   2. O que eu faço? Onde dá pra economizar e os avisos das outras telas, juntos.
//   3. O que vem pela frente? Contas fixas e parcelas (quanto da renda já tem dono).
//   4. Se apertar, aguento? A reserva de emergência (régua de 0 a 12 meses).
// Cada coisa num lugar só (Gustavo, 2026-11-01: "estamos com dois lugares que fazem a mesma coisa"): sem achados curtos
// no topo (repetiam outras seções); a barra da renda aparece uma vez; o aviso de limite sai dos avisos quando os limites
// estão nas linhas das categorias (com a etiqueta); as faturas a pagar ficam só em "Contas fixas e parcelas".
// Os títulos das seções dizem o que é (pedido do Gustavo, 2026-10-29). A conta e as frases vêm prontas do servidor (GET
// /relatorios/check-up, /relatorios/sinais, /dinheiro-do-mes e /orcamentos); aqui só a vitrine e os gráficos. Tocar numa
// categoria abre Transações filtrada (pela URL). Exporta os lançamentos do mês em CSV.
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Download } from "lucide-react"
import { getAno, getCheckUp, getSinais } from "../services/relatorioService"
import { getDinheiroDoMes } from "../services/dinheiroDoMesService"
import { getLimitesDoMes } from "../services/limiteService"
import type { AnoDoCheckUp, CheckUp, Sinal } from "../types/Relatorio"
import type { DinheiroDoMes } from "../types/DinheiroDoMes"
import type { LimiteDoMes, LimitesDoMes } from "../types/Limite"
import { seriesDasCategorias } from "../dominio/serieDaCategoria"
import { agora } from "../utils/dateTime"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import Bullet from "../componentes/Bullet"
import { Dinheiro } from "../componentes/Dinheiro"
import Etiqueta from "../componentes/Etiqueta"
import GraficoBarrasComparacao, { type LinhaComparacao } from "../componentes/GraficoBarrasComparacao"
import LinhaDoTempo from "../componentes/LinhaDoTempo"
import { nomeDoPeriodo, periodoDeHoje, type Periodo } from "../componentes/NavegadorMes"
import QuantoPossoGastar from "../componentes/QuantoPossoGastar"
import Selecao from "../componentes/Selecao"
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
  /** O ano escolhido (começa no atual) e o "Ano completo" no lugar de um mês. */
  const [ano, setAno] = useState(hoje.ano)
  const [anoCompleto, setAnoCompleto] = useState(false)
  /** Os anos já buscados: os meses da linha do tempo e o "Ano completo" vêm daqui. */
  const [anos, setAnos] = useState<Record<number, AnoDoCheckUp>>({})
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

  // O ano somado (linha do tempo e "Ano completo"), uma vez por ano.
  useEffect(() => {
    if (anos[ano]) return
    let vivo = true
    getAno(ano).then((a) => { if (vivo) setAnos((x) => ({ ...x, [ano]: a })) }).catch(() => { /* a linha fica no esqueleto */ })
    return () => { vivo = false }
  }, [ano, anos])

  const doAno = anos[ano] ?? null
  const ateMes = ano === hoje.ano ? hoje.mes : 12
  /** Trocar de ano: no "Ano completo" fica nele; num mês, vai pro mesmo mês do outro ano (no atual, até o de hoje). */
  const mudarAno = (a: number) => {
    setAno(a)
    if (!anoCompleto) setPeriodo({ ano: a, mes: a === hoje.ano ? Math.min(periodo.mes, hoje.mes) : periodo.mes })
  }
  const escolherMes = (m: Periodo) => { setAnoCompleto(false); setAno(m.ano); setPeriodo(m) }
  const escolherPeriodo = (valor: string) => (valor === "ano" ? setAnoCompleto(true) : escolherMes({ ano, mes: Number(valor) }))

  const mesNome = nomeDoPeriodo(periodo).toLowerCase()
  // De janeiro a dezembro do ano mostrado (o atual até o mês de hoje); o servidor já manda o mês zerado.
  const mesesDaLinha = doAno?.meses ?? null
  // Ao trocar de mês o check-up anterior fica na tela até o novo chegar: a comparação do topo só usa o do mês certo.
  const dadosDoMes = dados && dados.ano === periodo.ano && dados.mes === periodo.mes ? dados : null
  /** "Novembro" (sem o ano), pro título do topo. */
  const soOMes = nomeDoPeriodo(periodo).split(" de ")[0]
  const mesQuery = `${periodo.ano}-${String(periodo.mes).padStart(2, "0")}`
  const verCategoria = (chave: string) => navigate(`/transacoes?categoriaId=${chave}&mes=${mesQuery}`)
  // Os limites estão nas linhas das categorias, com a etiqueta (Passou, Vai passar): o aviso de limite não se repete.
  const limitesNaTela = !!dados && !!limites
  const lista = dados ? [...dados.sinais, ...avisos.filter((s) => !(limitesNaTela && s.origem === "limite"))].slice(0, MAX_AVISOS) : []
  const anterior = dados ? CURTOS[(dados.mes + 10) % 12] : null
  // Uma cor por categoria, a mesma em todas as seções (a ordem do "Pra onde foi" manda; o resto vem depois).
  const serieDe = useMemo(() => seriesDasCategorias(dados?.praOndeFoi ?? [], doMes?.jaSaiuPorCategoria ?? [],
    (limites?.limites ?? []).map((l) => ({ categoriaId: l.categoriaId, nome: l.categoria }))), [dados, doMes, limites])

  // A linha do tempo (escolher o mês) logo abaixo do título; ao lado do título, o ano, o período e o "Baixar".
  const linhaDoTempo = (
    <div className={styles.linhaDoTempo}>
      {mesesDaLinha ? <LinhaDoTempo meses={mesesDaLinha} escolhido={anoCompleto ? null : periodo} aoEscolher={escolherMes} hoje={hoje} />
        : <Esqueleto linhas={1} altura={72} />}
    </div>
  )
  // Os anos da lista: do primeiro com lançamento até o atual (o mais recente primeiro); o escolhido sempre está nela.
  const primeiroAno = Math.min(anos[hoje.ano]?.primeiroAno ?? doAno?.primeiroAno ?? hoje.ano, ano)
  const listaDeAnos = Array.from({ length: hoje.ano - primeiroAno + 1 }, (_, i) => hoje.ano - i)
  /** O que o relatório mostra, pro nome do PDF e pro cabeçalho impresso ("novembro de 2026", "2026"). */
  const doQue = anoCompleto ? String(ano) : mesNome
  // O PDF: a impressão do navegador só com o relatório; o título da página vira o nome sugerido do arquivo.
  const baixarPdf = () => {
    const antes = document.title
    document.title = `Relatório ${doQue}`
    window.addEventListener("afterprint", () => { document.title = antes }, { once: true })
    window.print()
  }
  const baixar = (
    <div className={styles.controles} data-nao-imprime>
      {/* A Seleção do v2 (a lista aberta no visual do site, não a do sistema). */}
      <div className={styles.ano}>
        <Selecao tamanho="xs" ariaLabel="Ano" valor={String(ano)} onChange={(v) => mudarAno(Number(v))}
          opcoes={listaDeAnos.map((a) => ({ valor: String(a), rotulo: String(a) }))} />
      </div>
      <div className={styles.periodo}>
        <Selecao tamanho="xs" ariaLabel="Período" semBusca valor={anoCompleto ? "ano" : String(periodo.mes)} onChange={escolherPeriodo}
          opcoes={[{ valor: "ano", rotulo: "Ano completo" },
            ...Array.from({ length: ateMes }, (_, i) => ({ valor: String(i + 1), rotulo: nomeDoPeriodo({ ano, mes: i + 1 }).split(" de ")[0] }))]} />
      </div>
      <button type="button" className={styles.baixar} onClick={baixarPdf} title="Baixar este relatório em PDF" aria-label="Baixar este relatório em PDF">
        <Download size={15} strokeWidth={2.25} aria-hidden="true" /><span className={styles.baixarTexto}>Baixar</span>
      </button>
    </div>
  )
  // As categorias do mês: dentro do topo, logo abaixo da barra da renda (ou embaixo do resumo, sem o dinheiro do mês).
  const categorias = !dados ? <Esqueleto linhas={4} altura={18} /> : (
    <CategoriasDoMes dados={dados} limites={limites} renda={doMes ? doMes.rendaBase : dados.entrou} serieDe={serieDe}
      fechado={!ehHoje} mesNome={mesNome} aoEscolher={verCategoria} />
  )

  return (
    <div className={styles.pagina}>
      {/* Só no PDF: o que é o relatório (na tela, o título e os seletores já dizem). */}
      <p className={styles.soNoPdf}>Relatório de {doQue} · Pontes · gerado em {agora().toLocaleDateString("pt-BR")}</p>
      {anoCompleto ? (
        // O ano somado: o mesmo desenho do bloco de sempre (a resposta grande, a conta ao lado, as categorias embaixo).
        <Bloco titulo={ano === hoje.ano ? `${ano} até agora` : `Como foi ${ano}`} lado={baixar}>
          {linhaDoTempo}
          {!doAno ? <Esqueleto linhas={4} altura={18} /> : (
            <div className={styles.cartao}>
              <ResumoDoAno a={doAno} />
              <CategoriasDoAno a={doAno} aoEscolher={(chave) => navigate(`/transacoes?categoriaId=${chave}`)} />
            </div>
          )}
        </Bloco>
      ) : erro ? <Bloco lado={baixar}>{linhaDoTempo}<p className={styles.vazio} role="alert">Não deu pra carregar o check-up.</p></Bloco> : (
        <>
          {/* 1. Como estou e por quê? O mesmo bloco em qualquer mês, com as categorias numa lista só (a legenda da barra). */}
          {topoDaRenda ? (
            <Bloco titulo={ehHoje ? `${soOMes} até agora` : `Como foi ${soOMes.toLowerCase()}`} lado={baixar}>
              {linhaDoTempo}
              {!doMes ? <Esqueleto linhas={3} altura={18} /> : (
                <QuantoPossoGastar dados={doMes} serieDe={serieDe} fechado={!ehHoje} gastoNormal={dados?.gastoNormal}
                  comparacao={dadosDoMes ? { entrou: dadosDoMes.variacaoEntrou, saiu: dadosDoMes.variacaoSaiu, anterior } : undefined}>
                  {categorias}
                </QuantoPossoGastar>
              )}
            </Bloco>
          ) : (
            <Bloco titulo={dados?.mesAtual ? "Resumo do mês até agora" : "Resumo do mês"} lado={baixar}>
              {linhaDoTempo}
              {!dados ? <Esqueleto linhas={3} altura={18} /> : <div className={styles.cartao}><ResumoDoMes dados={dados} anterior={anterior} />{categorias}</div>}
            </Bloco>
          )}

          {/* 2. O que eu faço? Onde dá pra economizar + os avisos das outras telas, juntos */}
          {(dados?.corte || lista.length > 0) && (
            <Bloco titulo="O que dá pra fazer">
              <OQueDaPraFazer corte={dados?.corte ?? null} avisos={lista} aoEscolher={verCategoria}
                aoPlanejar={() => navigate("/orcamento")} aoVerContaFixa={(id) => navigate(`/contas-fixas/${id}`)} />
            </Bloco>
          )}

          {/* 3. O que vem pela frente? */}
          <Bloco titulo="Contas fixas e parcelas">
            {!dados ? <Esqueleto linhas={3} altura={18} /> : <Comprometido dados={dados} mesNome={mesNome} />}
          </Bloco>

          {/* 4. Se apertar, aguento? */}
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

/** As 5 maiores categorias têm cor; da 6ª em diante (cinza claro) ficam atrás de "Mais N categorias", a última linha da
 *  lista (Gustavo, 2026-11-01: "onde vou ver todas se não for em Relatórios?" e "sempre mostra por último"). Sem categoria
 *  (cinza escuro, com a ação de classificar) fica à vista. */
const recolherAsMenores = (linhas: LinhaComparacao[]): LinhaComparacao[] =>
  linhas.map((l) => (l.serie === "cinza-2" ? { ...l, recolhida: true } : l))

/** O topo do "Ano completo": quanto sobrou no ano em destaque e, ao lado, entrou, saiu e investiu, cada um com o
 *  planejado do ano embaixo (a soma do planejado de cada mês; sem planejado, a linha some). */
function ResumoDoAno({ a }: { a: AnoDoCheckUp }) {
  const pct = a.entrou > 0 ? Math.round((a.sobrou * 100) / a.entrou) : null
  const fato = (rotulo: ReactNode, valor: number, planejado: number) => (
    <div>
      <dt>{rotulo}</dt>
      <dd><Dinheiro valor={valor} /></dd>
      {planejado > 0 && <dd className={styles.planejado}>de <Dinheiro valor={planejado} /> planejados</dd>}
    </div>
  )
  return (
    <div className={styles.cabeca}>
      <div className={styles.heroi}>
        <span className={styles.rotulo}>{a.anoAtual ? "Sobrou até agora" : "Sobrou no ano"}</span>
        <Dinheiro valor={a.sobrou} className={styles.heroiValor} tom={a.sobrou < 0 ? "negativo" : undefined} />
        <span className={styles.extra}>
          {pct != null && a.sobrou >= 0 && `${pct}% do que entrou · `}
          {a.anoAtual ? `janeiro a ${nomeDoPeriodo({ ano: a.ano, mes: a.ateMes }).split(" de ")[0].toLowerCase()}` : "janeiro a dezembro"}
        </span>
      </div>
      <dl className={`${styles.conta} ${styles.contaDoAno}`}>
        {fato("Entrou", a.entrou, a.rendaEsperada)}
        {fato(<><span aria-hidden="true">− </span>Saiu</>, a.saiu, a.despesasPlanejadas)}
        {/* Mais resgate que aporte no ano: "Resgatou", sem valor negativo. */}
        {a.investido < 0 ? fato("Resgatou", -a.investido, 0) : fato("Investiu", a.investido, a.investimentosPlanejados)}
      </dl>
    </div>
  )
}

/** As categorias do ano numa lista só, como as do mês: o que saiu no ano e a parte do que entrou, o traço do mesmo
 *  período do ano anterior e a marca do limite do ano (a soma do limite de cada mês). Sem categoria por último. */
function CategoriasDoAno({ a, aoEscolher }: { a: AnoDoCheckUp; aoEscolher: (chave: string) => void }) {
  const serieDe = seriesDasCategorias(a.categorias)
  const daRenda = a.entrou > 0
  const parte = (valor: number, doGasto: number) => (daRenda ? Math.round((valor * 1000) / a.entrou) / 10 : doGasto)
  const antes = a.ano - 1
  const linhas: LinhaComparacao[] = a.categorias.map((c) => {
    const resta = c.limite != null ? c.limite - c.valor : 0
    return {
      chave: c.categoriaId, nome: c.nome, valor: c.valor, normal: c.normal, variacao: c.variacaoPercentual,
      parte: parte(c.valor, c.percentualDoGasto), serie: serieDe(c.categoriaId, c.nome),
      ...(c.limite != null ? {
        limite: { valor: c.limite, texto: <>limite do ano <Dinheiro valor={c.limite} />: {resta >= 0 ? <>sobrou <Dinheiro valor={resta} /></> : <>passou <Dinheiro valor={-resta} /></>}</> },
        etiqueta: resta < 0 ? ETIQUETA_DO_LIMITE.passou ?? undefined : undefined,
      } : {}),
    }
  })
  const sc = a.semCategoria
  if (sc) linhas.push({
    chave: SEM_CATEGORIA, nome: "Sem categoria", valor: sc.valor, normal: null, variacao: null, parte: parte(sc.valor, sc.percentualDoGasto), serie: "cinza",
    extra: `${sc.quantidade} ${sc.quantidade === 1 ? "lançamento" : "lançamentos"} pra classificar`,
  })
  const periodoAntes = a.anoAtual ? `jan–${CURTOS[a.ateMes - 1]}/${antes}` : String(antes)
  return (
    <div className={styles.categorias}>
      <h3 className={styles.subtitulo}>Por categoria</h3>
      {linhas.length === 0 ? <p className={styles.vazioSemRespiro}>Nenhum gasto em {a.ano}.</p> : (
        <GraficoBarrasComparacao rotulo="Categorias do ano" linhas={recolherAsMenores(linhas)} aoEscolher={aoEscolher}
          contra={{ de: `de ${periodoAntes}`, igual: `igual a ${periodoAntes}`, rotulo: periodoAntes, novo: `Nova em ${a.ano}`, sem: `Sem ${antes} pra comparar` }} />
      )}
      <span className={styles.legendaNormal}>
        {a.categorias.some((c) => c.normal) && <><i aria-hidden="true" />{periodoAntes} · </>}
        {a.categorias.some((c) => c.limite != null) && <><i data-tipo="limite" aria-hidden="true" />claro: orçamento do ano · escuro: passou dele · </>}
        % {daRenda ? "do que entrou" : "do gasto"} · toque pra ver os lançamentos
      </span>
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

const ETIQUETA_DO_LIMITE: Record<LimiteDoMes["situacao"], { texto: string; tom: "negativo" | "alerta" } | null> = {
  passou: { texto: "Passou", tom: "negativo" },
  "vai-passar": { texto: "Vai passar", tom: "alerta" },
  perto: { texto: "Perto", tom: "alerta" },
  ok: null,
}

/** A situação do limite na etiqueta. No mês fechado não existe "vai passar" nem "perto": só se passou. */
const etiquetaDoLimite = (l: LimiteDoMes, fechado: boolean) =>
  fechado ? (l.gasto > l.limite ? ETIQUETA_DO_LIMITE.passou : null) : ETIQUETA_DO_LIMITE[l.situacao]

/** "limite R$ 850: dá pra gastar mais R$ 220". A sobra do servidor é limite − gasto; no mês atual a frase conta também
 *  o que ainda vem (é o que dá pra gastar de verdade); no fechado, o previsto que não veio não conta. */
function TextoDoLimite({ l, fechado }: { l: LimiteDoMes; fechado: boolean }) {
  const resta = l.limite - l.gasto - (fechado ? 0 : l.previsto)
  return (
    <>
      limite <Dinheiro valor={l.limite} />:{" "}
      {fechado ? (resta >= 0 ? <>sobrou <Dinheiro valor={resta} /></> : <>passou <Dinheiro valor={-resta} /></>)
        : resta >= 0 ? <>dá pra gastar mais <Dinheiro valor={resta} /></>
        : l.sobra < 0 ? <>passou <Dinheiro valor={-l.sobra} /></>
        : <>passa <Dinheiro valor={-resta} /> com o que ainda vem</>}
    </>
  )
}

/** As categorias do mês numa lista só (2026-11-01, Gustavo: "dá pra juntar tudo sem repetir"): é a legenda da barra da
 *  renda logo acima e junta, numa linha por categoria, o que saiu e a parte da renda, o que ainda vem (listrado), o traço
 *  do normal e a marca do limite, com uma frase só (normal + limite). Antes isso estava em quatro lugares (a legenda, os
 *  limites, o "Pra onde foi" com outra barra da renda e o "onde dá pra economizar"). Ordem do servidor (as maiores
 *  primeiro); depois as que têm limite e não estão na lista (nada gasto ainda, ou dentro de "Outras"); Sem categoria por
 *  último. O limite de todos os gastos (sem categoria) vem numa linha acima. `renda`: a do topo (no mês atual, o maior
 *  entre o esperado e o recebido, porque no dia 1 quase nada entrou ainda; no fechado, o que entrou); sem renda, a parte
 *  é do gasto. A cor de cada categoria é a mesma da barra (serieDe). */
function CategoriasDoMes({ dados, limites, renda, serieDe, fechado, mesNome, aoEscolher }: {
  dados: CheckUp; limites: LimitesDoMes | null; renda: number; serieDe: (categoriaId: string | null, nome: string) => string
  fechado: boolean; mesNome: string; aoEscolher: (chave: string) => void
}) {
  const daRenda = renda > 0
  const parte = (valor: number, doGasto: number) => (daRenda ? Math.round((valor * 1000) / renda) / 10 : doGasto)
  const porCategoria = new Map((limites?.limites ?? []).filter((l) => l.categoriaId).map((l) => [l.categoriaId!, l]))
  const geral = limites?.limites.find((l) => !l.categoriaId)
  const doLimite = (categoriaId: string | null): Pick<LinhaComparacao, "limite" | "etiqueta"> => {
    const l = categoriaId ? porCategoria.get(categoriaId) : undefined
    return l ? { limite: { valor: l.limite, texto: <TextoDoLimite l={l} fechado={fechado} /> }, etiqueta: etiquetaDoLimite(l, fechado) ?? undefined } : {}
  }
  const linhas: LinhaComparacao[] = dados.praOndeFoi.map((c) => ({
    chave: c.categoriaId ?? c.nome, nome: c.nome, valor: c.valor, previsto: c.previsto, normal: c.normal, variacao: c.variacaoPercentual,
    parte: parte(c.valor, c.percentualDoGasto), serie: serieDe(c.categoriaId, c.nome), ...doLimite(c.categoriaId),
  }))
  const naLista = new Set(dados.praOndeFoi.map((c) => c.categoriaId))
  for (const l of porCategoria.values())
    if (!naLista.has(l.categoriaId)) linhas.push({
      chave: l.categoriaId!, nome: l.categoria, valor: l.gasto, previsto: fechado ? 0 : l.previsto, normal: null, variacao: null,
      parte: parte(l.gasto, 0), serie: serieDe(l.categoriaId, l.categoria), ...doLimite(l.categoriaId),
    })
  const sc = dados.semCategoria
  if (sc) linhas.push({
    chave: SEM_CATEGORIA, nome: "Sem categoria", valor: sc.valor, normal: null, variacao: null, parte: parte(sc.valor, sc.percentualDoGasto), serie: "cinza",
    extra: `${sc.quantidade} ${sc.quantidade === 1 ? "lançamento" : "lançamentos"} pra classificar`,
  })
  const etiquetaGeral = geral ? etiquetaDoLimite(geral, fechado) : null
  return (
    <div className={styles.categorias}>
      <h3 className={styles.subtitulo}>Por categoria</h3>
      {geral && (
        <p className={styles.limiteGeral}>
          Todos os gastos, <TextoDoLimite l={geral} fechado={fechado} />
          {etiquetaGeral && <Etiqueta tom={etiquetaGeral.tom}>{etiquetaGeral.texto}</Etiqueta>}
        </p>
      )}
      {linhas.length === 0 ? <p className={styles.vazioSemRespiro}>Nenhum gasto em {mesNome}.</p> : (
        <GraficoBarrasComparacao rotulo="Categorias do mês" linhas={recolherAsMenores(linhas)} aoEscolher={aoEscolher} />
      )}
      <span className={styles.legendaNormal}>
        {dados.praOndeFoi.some((c) => c.normal) && <><i aria-hidden="true" />o seu normal · </>}
        {porCategoria.size > 0 && <><i data-tipo="limite" aria-hidden="true" />claro: orçamento · escuro: passou dele · </>}
        listrado: ainda vem · % {!daRenda ? "do gasto" : fechado ? "do que entrou" : "da renda do mês"} · toque pra ver os lançamentos
        {porCategoria.size === 0 && !geral && !fechado && <> · nenhum limite neste mês: <Link to="/orcamento">pôr um limite</Link></>}
      </span>
    </div>
  )
}

/** "O que dá pra fazer": onde dá pra economizar (a frase do servidor, as contas fixas novas e as categorias acima do
 *  normal com as ações, sem repetir os números que já estão na linha da categoria) e os avisos das outras telas. */
function OQueDaPraFazer({ corte, avisos, aoEscolher, aoPlanejar, aoVerContaFixa }: {
  corte: CheckUp["corte"]; avisos: Sinal[]
  aoEscolher: (chave: string) => void; aoPlanejar: () => void; aoVerContaFixa: (id: string) => void
}) {
  return (
    <div className={styles.fazer}>
      {corte && (
        <div className={styles.cartao}>
          <h3 className={styles.subtitulo}>Onde dá pra economizar</h3>
          <Resposta tom={corte.resposta.tom} texto={corte.resposta.texto} />
          {corte.itens.length > 0 && (
            <ul className={styles.cortes}>
              {corte.itens.map((i) => (
                <li key={`${i.tipo}-${i.id ?? i.nome}`}>
                  <span className={styles.corteTopo}>
                    <span className={styles.corteNome}>{i.tipo === "conta-fixa" ? `Conta fixa nova: ${i.nome}` : i.nome}</span>
                    <span className={styles.corteAMais}><Dinheiro valor={i.aMais} />{i.tipo === "conta-fixa" ? " por mês" : " a mais"}</span>
                  </span>
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
      {avisos.length > 0 && (
        <div className={styles.cartao}>
          <h3 className={styles.subtitulo}>Avisos</h3>
          <div className={styles.avisos}>
            {avisos.map((s) => <Resposta key={s.chave} compacta tom={s.resposta.tom} texto={s.resposta.texto} acoes={s.resposta.acoes} />)}
          </div>
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
