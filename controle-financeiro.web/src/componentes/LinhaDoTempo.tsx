// A linha do tempo de Relatórios: escolhe o mês e, de quebra, mostra como venho indo (Gustavo, 2026-11-01: "não estou
// gostando desse jeito de passar os meses; dá pra melhorar passando pelo gráfico?"). Uma coluna por mês, do primeiro com
// lançamento até o mês atual (o mais recente na ponta direita): três pílulas por mês, na mesma escala pra todos os
// meses (Gustavo, 2026-11-01: "receita, despesa e investimentos, coloca 3 barras diferentes"): receita (verde), despesa
// (vermelho) e investimento (azul; aportes menos resgates, fora do saiu porque investir não é gasto). Como na planilha
// do Gustavo, cada pílula empilha três tons da mesma cor: vivo = o que aconteceu, até o planejado; escuro, por cima = o
// que passou do planejado (na despesa, estouro); claro, por cima = o planejado que ainda não aconteceu. O planejado é
// o do mês (renda esperada, soma dos limites, fontes de investimento planejadas); sem planejado, tudo é vivo. As cores são próprias, fora das séries das categorias logo abaixo, pra não
// confundir. Embaixo, o mês e o que sobrou (verde ou vermelho). Tocar num mês leva a tela inteira pra ele; o
// escolhido fica destacado. A linha não muda quando a pessoa troca de mês, só o destaque anda (a tela não muda de jeito).
// No celular vira uma faixa que rola de lado e abre já no mês escolhido. Substitui o seletor de setas e o gráfico
// "Entradas e saídas por mês", que repetia esta mesma informação no pé da tela. Barras altas (120px no computador) e
// uma legenda curta embaixo: é o gráfico de destaque da tela (Gustavo: "tá muito pequeno, dá um destaque").
import { useEffect, useRef } from "react"
import { useHideBalance } from "../estado/ocultar"
import { MONEY_MASK, formatMoney } from "../utils/money"
import { curto } from "./GraficoLinha"
import { nomeDoPeriodo } from "./NavegadorMes"
import styles from "./LinhaDoTempo.module.css"

export type MesDaLinha = {
  ano: number; mes: number; entrou: number; saiu: number; sobrou: number; investido: number
  rendaEsperada: number; despesasPlanejadas: number; investimentosPlanejados: number
}

const CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]

/** Um ano por vez, de janeiro a dezembro (o ano atual até o mês de hoje); o ano e o período se escolhem no título do
 *  bloco. O mês escolhido fica colorido e os outros em cinza (Gustavo: "se eu clicar num mês, os outros devem ficar
 *  cinza"); passar o mouse num mês cinza devolve a cor dele. No "Ano completo" (escolhido = null) todos ficam coloridos. */
export default function LinhaDoTempo({ meses, escolhido, aoEscolher, hoje }: {
  meses: MesDaLinha[]
  escolhido: { ano: number; mes: number } | null
  aoEscolher: (m: { ano: number; mes: number }) => void
  /** O mês de hoje: os depois dele ainda não chegaram (aparecem apagados, só com o planejado, e não dá pra escolher). */
  hoje: { ano: number; mes: number }
}) {
  const [oculto] = useHideBalance()
  const faixa = useRef<HTMLDivElement | null>(null)
  const maior = Math.max(1, ...meses.map((m) => Math.max(m.entrou, m.saiu, m.investido, m.rendaEsperada, m.despesasPlanejadas, m.investimentosPlanejados)))
  const temPlanejado = meses.some((m) => m.rendaEsperada > 0 || m.despesasPlanejadas > 0 || m.investimentosPlanejados > 0)
  // A pilha enche a trilha no maior valor da linha; com valor, nunca menor que a largura (vira um ponto redondo).
  const altura = (v: number) => (v > 0 ? `max(10px, ${Math.round((v / maior) * 1000) / 10}%)` : "0")
  /** Uma pílula: vivo até o planejado, escuro o que passou, claro o que falta (cada pedaço pelo flex-grow). */
  const Pilula = ({ tipo, realizado, planejado }: { tipo: string; realizado: number; planejado: number }) => {
    const r = Math.max(0, realizado)
    const ate = planejado > 0 ? Math.min(r, planejado) : r
    const alem = planejado > 0 ? Math.max(0, r - planejado) : 0
    const falta = Math.max(0, planejado - r)
    const pedaco = (v: number) => (v > 0 ? { flexGrow: v, minHeight: 3 } : { flexGrow: 0, minHeight: 0 })
    return (
      <span className={styles.trilha} data-tipo={tipo}>
        <span className={styles.pilha} style={{ height: altura(Math.max(r, planejado)) }}>
          <span data-tom="realizado" style={pedaco(ate)} />
          <span data-tom="alem" style={pedaco(alem)} />
          <span data-tom="planejado" style={pedaco(falta)} />
        </span>
      </span>
    )
  }
  const dinheiro = (v: number) => (oculto ? MONEY_MASK : formatMoney(v))
  const ehEscolhido = (m: MesDaLinha) => !!escolhido && m.ano === escolhido.ano && m.mes === escolhido.mes
  const naoChegou = (m: MesDaLinha) => m.ano * 12 + m.mes > hoje.ano * 12 + hoje.mes

  // Abre (e acompanha) no mês escolhido, no meio da faixa (no celular ela rola de lado; assim os vizinhos aparecem). Rola
  // só a faixa (scrollLeft), nunca a página; e de novo quando a largura muda (girar o celular, abrir o painel).
  useEffect(() => {
    const caixa = faixa.current
    if (!caixa) return
    const centrar = () => {
      const el = caixa.querySelector<HTMLElement>("[aria-pressed='true']")
      if (el) caixa.scrollLeft = el.offsetLeft - (caixa.clientWidth - el.offsetWidth) / 2 // a faixa é position: relative
      else caixa.scrollLeft = caixa.scrollWidth // ano completo: abre nos meses mais recentes
    }
    centrar()
    if (typeof ResizeObserver === "undefined") return // ambiente sem (testes)
    const ro = new ResizeObserver(centrar)
    ro.observe(caixa)
    return () => ro.disconnect()
  }, [escolhido?.ano, escolhido?.mes, meses.length])

  return (
    <div className={styles.linha}>
    <div ref={faixa} className={styles.faixa} role="group" aria-label="Meses" data-com-escolhido={meses.some(ehEscolhido) || undefined}>
      {meses.map((m) => {
        const rotulo = CURTOS[m.mes - 1]
        const planejado = (v: number) => (v > 0 ? ` (planejado ${dinheiro(v)})` : "")
        if (naoChegou(m)) {
          const previsto = `${nomeDoPeriodo(m)}: ainda não chegou${m.rendaEsperada > 0 || m.despesasPlanejadas > 0 ? ` (planejado: renda ${dinheiro(m.rendaEsperada)}, despesas ${dinheiro(m.despesasPlanejadas)})` : ""}`
          return (
            <button key={`${m.ano}-${m.mes}`} type="button" className={styles.mes} data-futuro aria-pressed={false} disabled aria-label={previsto} title={previsto}>
              <span className={styles.barras} aria-hidden="true">
                <Pilula tipo="receita" realizado={0} planejado={m.rendaEsperada} />
                <Pilula tipo="despesa" realizado={0} planejado={m.despesasPlanejadas} />
                <Pilula tipo="investimento" realizado={0} planejado={m.investimentosPlanejados} />
              </span>
              <span className={styles.rotulo} aria-hidden="true">{CURTOS[m.mes - 1]}</span>
              <span className={styles.sobrou} aria-hidden="true">–</span>
            </button>
          )
        }
        const descricao = `${nomeDoPeriodo(m)}: entrou ${dinheiro(m.entrou)}${planejado(m.rendaEsperada)}, saiu ${dinheiro(m.saiu)}${planejado(m.despesasPlanejadas)}, ` +
          `investiu ${dinheiro(m.investido)}${planejado(m.investimentosPlanejados)}, sobrou ${dinheiro(m.sobrou)}`
        return (
          <button key={`${m.ano}-${m.mes}`} type="button" className={styles.mes} aria-pressed={ehEscolhido(m)} aria-label={descricao}
            title={descricao} onClick={() => aoEscolher(m)}>
            <span className={styles.barras} aria-hidden="true">
              <Pilula tipo="receita" realizado={m.entrou} planejado={m.rendaEsperada} />
              <Pilula tipo="despesa" realizado={m.saiu} planejado={m.despesasPlanejadas} />
              <Pilula tipo="investimento" realizado={m.investido} planejado={m.investimentosPlanejados} />
            </span>
            <span className={styles.rotulo} aria-hidden="true">{rotulo}</span>
            <span className={styles.sobrou} data-tom={m.sobrou < 0 ? "negativo" : m.sobrou > 0 ? "positivo" : undefined} aria-hidden="true">
              {m.sobrou < 0 && !oculto ? "−" : ""}{curto(Math.abs(m.sobrou), oculto)}
            </span>
          </button>
        )
      })}
    </div>
    <div className={styles.legenda} aria-hidden="true">
      <span><i data-tipo="receita" />Receita</span>
      <span><i data-tipo="despesa" />Despesa</span>
      <span><i data-tipo="investimento" />Investimentos</span>
      {temPlanejado && <span><i data-tom="planejado" />claro: planejado que falta · escuro: passou do planejado</span>}
    </div>
    </div>
  )
}
