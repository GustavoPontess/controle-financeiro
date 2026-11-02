// O topo de Relatórios em qualquer mês, sempre o mesmo desenho (Gustavo, 2026-11-01: "a pessoa troca de mês e estranha
// não ver a tela do mesmo jeito"), com as palavras de cada mês ("essa parte é pra ser bem dinâmica"). No mês atual olha
// pra frente: a renda do mês menos o que já saiu e o que ainda vem (contas fixas previstas) é o quanto ainda dá pra
// gastar, por dia até o fim do mês. No mês que já acabou (`fechado`), quanto sobrou e a parte do que entrou. Ao lado, o
// que entrou e o que saiu (Gustavo: "sentindo falta de mostrar quanto entrou, quanto saiu"), cada um com a frase que
// faz sentido no mês: no atual, o que entrou de quanto se esperava e o que saiu contra o seu normal; no fechado, contra
// o mês anterior. A barra é a renda: o que já saiu, um pedaço por categoria na cor dela (pedido do Gustavo,
// 2026-11-01: "tirou as cores, ficou feio"), o que ainda vem listrado e o vazio é o livre; passou da renda, a barra
// cresce além da marca "sua renda". Logo abaixo da barra (`children`) vem a lista das categorias, que é a legenda dela
// e junta o pra onde foi, o normal e o limite de cada uma (Gustavo: "dá pra juntar tudo sem repetir"); depois, o que
// ainda vem no mês, item por item. As faturas de cartão a pagar ficam só em "Contas fixas e parcelas" (não somam no
// livre: as compras delas já contaram quando foram feitas). A conta vem pronta do servidor (DinheiroDoMesService);
// aqui só a vitrine e os dias que faltam.
import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import type { DinheiroDoMes } from "../types/DinheiroDoMes"
import { dataLocalISO } from "../utils/dateTime"
import { Dinheiro } from "./Dinheiro"
import ListaAindaVem from "./ListaAindaVem"
import styles from "./QuantoPossoGastar.module.css"

/** O que ainda vem com linha própria; o resto vira "e mais N". */
const MAX_AINDA_VEM = 5

export default function QuantoPossoGastar({ dados, serieDe, fechado, comparacao, gastoNormal, children }: {
  dados: DinheiroDoMes
  /** A cor de cada categoria (dominio/serieDaCategoria), a mesma da lista de categorias. */
  serieDe: (categoriaId: string | null, nome: string) => string
  /** O mês já acabou: "sobrou" no lugar de "ainda dá pra gastar". */
  fechado?: boolean
  /** Entrou e saiu contra o mês anterior, em % (do check-up), e o nome curto do mês anterior. */
  comparacao?: { entrou: number | null; saiu: number | null; anterior: string | null }
  /** O gasto normal por mês (média dos meses anteriores), pra pôr o que já saiu em perspectiva no mês atual. */
  gastoNormal?: number | null
  /** Logo abaixo da barra: a lista das categorias (a legenda da barra, com o normal e o limite de cada uma). */
  children?: ReactNode
}) {
  const temRenda = dados.rendaBase > 0
  const usado = dados.jaSaiu + dados.aindaVemTotal
  const escala = Math.max(dados.rendaBase, usado) || 1
  const largura = (v: number) => `${(v / escala) * 100}%`
  const passou = dados.livre < 0
  const hoje = dataLocalISO()
  const ultimoDia = new Date(dados.ano, dados.mes, 0).getDate()
  const faltam = Math.max(1, ultimoDia - Number(hoje.slice(8, 10)) + 1)
  const porDia = temRenda && !passou && !fechado ? dados.livre / faltam : null
  const pct = (v: number) => `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(v)}%`

  return (
    <div className={styles.gastar}>
      <div className={styles.cabeca}>
        <div className={styles.heroi}>
          <span className={styles.rotulo}>{!temRenda ? (fechado ? "Gastou" : "Já saiu") : passou ? "Passou da renda" : fechado ? "Sobrou" : "Ainda dá pra gastar"}</span>
          <Dinheiro valor={temRenda ? Math.abs(dados.livre) : dados.jaSaiu} className={styles.valor} tom={passou ? "negativo" : undefined} />
          {porDia != null && (
            <span className={styles.extra}>
              ≈ <Dinheiro valor={porDia} /> por dia {faltam === 1 ? "hoje, último dia do mês" : `nos ${faltam} dias que faltam`}
            </span>
          )}
          {fechado && temRenda && !passou && <span className={styles.extra}>{pct((dados.livre * 100) / dados.rendaBase)} do que entrou</span>}
          {!temRenda && (fechado ? <span className={styles.extra}>Nenhuma renda lançada neste mês.</span>
            : <span className={styles.extra}>Sem renda esperada neste mês: <Link to="/orcamento">pôr a renda</Link> pra saber quanto sobra.</span>)}
        </div>
        <dl className={styles.conta}>
          <div>
            <dt>Entrou</dt>
            <dd><Dinheiro valor={dados.rendaRecebida} /></dd>
            {!fechado && dados.rendaEsperada > dados.rendaRecebida
              ? <dd className={styles.sub}>de <Dinheiro valor={dados.rendaEsperada} /> esperados</dd>
              : <Variacao valor={comparacao?.entrou ?? null} sobeEhBom anterior={comparacao?.anterior ?? null} />}
          </div>
          <div>
            <dt>Saiu</dt>
            <dd><Dinheiro valor={dados.jaSaiu} /></dd>
            {!fechado && gastoNormal
              ? <dd className={styles.sub}>seu normal é <Dinheiro valor={gastoNormal} /></dd>
              : <Variacao valor={comparacao?.saiu ?? null} anterior={comparacao?.anterior ?? null} />}
          </div>
          {(!fechado || dados.aindaVemTotal > 0) && (
            <div><dt>{fechado ? "Ficou previsto" : "Ainda vem"}</dt><dd><Dinheiro valor={dados.aindaVemTotal} /></dd></div>
          )}
        </dl>
      </div>

      {temRenda && (
        <div className={styles.barraLugar}>
          <div className={styles.barra} role="img"
            aria-label={`Da renda: já saiu ${Math.round((dados.jaSaiu / dados.rendaBase) * 100)}%, ainda vem ${Math.round((dados.aindaVemTotal / dados.rendaBase) * 100)}%`}>
            {dados.jaSaiuPorCategoria.filter((p) => p.valor > 0).map((p, i) => (
              <span key={`${p.categoriaId ?? p.nome}-${i}`} className={styles.pedaco} data-serie={serieDe(p.categoriaId, p.nome)}
                style={{ width: largura(p.valor) }} title={`${p.nome}: já saiu`} />
            ))}
            {dados.aindaVemTotal > 0 && <span className={styles.pedaco} data-tipo="vem" style={{ width: largura(dados.aindaVemTotal) }} title="Ainda vem" />}
          </div>
          {passou && <span className={styles.marca} style={{ left: largura(dados.rendaBase) }}><span className={styles.marcaRotulo}>sua renda</span></span>}
          {/* As categorias têm a legenda delas (a lista logo abaixo); aqui só o que não é categoria. */}
          <div className={styles.legenda} aria-hidden="true">
            {(!fechado || dados.aindaVemTotal > 0) && <span><i data-tipo="vem" />{fechado ? "Ficou previsto" : "Ainda vem"}</span>}
            {!passou && <span><i data-tipo="livre" />{fechado ? "Sobrou" : "Livre"}</span>}
          </div>
        </div>
      )}

      {children}

      {dados.aindaVem.length > 0 && (
        <div className={styles.parte}>
          <h3 className={styles.titulo}>{fechado ? "Ficou previsto e não foi pago" : "Ainda vem este mês"}</h3>
          <ListaAindaVem itens={dados.aindaVem.slice(0, MAX_AINDA_VEM)} base={temRenda ? dados.rendaBase : undefined} />
          {dados.aindaVem.length > MAX_AINDA_VEM && (
            <span className={styles.extra}>
              e mais {dados.aindaVem.length - MAX_AINDA_VEM}: <Dinheiro valor={dados.aindaVem.slice(MAX_AINDA_VEM).reduce((s, a) => s + a.valor, 0)} />
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/** Contra o mês anterior: a cor diz se foi bom (entrar mais é bom, sair mais não); sem sinal +/−. */
function Variacao({ valor, sobeEhBom, anterior }: { valor: number | null; sobeEhBom?: boolean; anterior: string | null }) {
  if (valor == null || valor === 0 || !anterior) return null
  const bom = sobeEhBom ? valor > 0 : valor < 0
  return (
    <dd className={styles.sub}>
      <span className={styles.variacao} data-bom={bom || undefined}>{Math.abs(valor)}% {valor > 0 ? "a mais" : "a menos"}</span> que {anterior}
    </dd>
  )
}
