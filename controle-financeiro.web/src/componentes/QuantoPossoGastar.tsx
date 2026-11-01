// O topo de Relatórios em qualquer mês, sempre o mesmo desenho (Gustavo, 2026-11-01: "a pessoa troca de mês e estranha
// não ver a tela do mesmo jeito"), com as palavras de cada mês ("essa parte é pra ser bem dinâmica"). No mês atual olha
// pra frente: a renda do mês menos o que já saiu e o que ainda vem (contas fixas previstas) é o quanto ainda dá pra
// gastar, por dia até o fim do mês. No mês que já acabou (`fechado`), quanto sobrou e a parte do que entrou. Ao lado, o
// que entrou e o que saiu (Gustavo: "sentindo falta de mostrar quanto entrou, quanto saiu"), cada um com a frase que
// faz sentido no mês: no atual, o que entrou de quanto se esperava e o que saiu contra o seu normal; no fechado, contra
// o mês anterior. Os limites dizem quanto ainda dá (mês atual) ou quanto sobrou ou passou (fechado). A barra é a renda: o que já
// saiu, um pedaço por categoria na cor dela (as mesmas cores do "Pra onde foi"; pedido do Gustavo, 2026-11-01: "tirou
// as cores, ficou feio"), o que ainda vem listrado e o vazio é o livre; passou da renda, a barra cresce além da marca
// "sua renda". Embaixo, o que ainda vem e os limites por categoria (gasto + o que ainda vem contra o limite, na cor da
// categoria). A distribuição da renda pelas categorias (olhando pra trás) é outra seção ("Pra onde foi a sua renda").
// As faturas de cartão a pagar ficam só em "Contas fixas e parcelas" (não somam no livre: as compras delas já contaram
// quando foram feitas). A conta vem pronta do servidor (DinheiroDoMesService e LimiteService); aqui só a vitrine e os
// dias que faltam.
import { Link } from "react-router-dom"
import type { DinheiroDoMes } from "../types/DinheiroDoMes"
import type { LimiteDoMes, LimitesDoMes } from "../types/Limite"
import { dataLocalISO } from "../utils/dateTime"
import { Dinheiro } from "./Dinheiro"
import Etiqueta from "./Etiqueta"
import ListaAindaVem from "./ListaAindaVem"
import styles from "./QuantoPossoGastar.module.css"

/** O que ainda vem com linha própria; o resto vira "e mais N". */
const MAX_AINDA_VEM = 5

export default function QuantoPossoGastar({ dados, limites, serieDe, fechado, comparacao, gastoNormal }: {
  dados: DinheiroDoMes
  limites: LimitesDoMes | null
  /** A cor de cada categoria (dominio/serieDaCategoria), a mesma das outras seções. */
  serieDe: (categoriaId: string | null, nome: string) => string
  /** O mês já acabou: "sobrou" no lugar de "ainda dá pra gastar". */
  fechado?: boolean
  /** Entrou e saiu contra o mês anterior, em % (do check-up), e o nome curto do mês anterior. */
  comparacao?: { entrou: number | null; saiu: number | null; anterior: string | null }
  /** O gasto normal por mês (média dos meses anteriores), pra pôr o que já saiu em perspectiva no mês atual. */
  gastoNormal?: number | null
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
  const comLimite = limites?.limites ?? []

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
        <>
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
          </div>
          <div className={styles.legenda} aria-hidden="true">
            {dados.jaSaiuPorCategoria.filter((p) => p.valor > 0).map((p, i) => (
              <span key={`${p.categoriaId ?? p.nome}-${i}`}><i data-serie={serieDe(p.categoriaId, p.nome)} />{p.nome}</span>
            ))}
            {(!fechado || dados.aindaVemTotal > 0) && <span><i data-tipo="vem" />{fechado ? "Ficou previsto" : "Ainda vem"}</span>}
            {!passou && <span><i data-tipo="livre" />{fechado ? "Sobrou" : "Livre"}</span>}
          </div>
        </>
      )}

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

      <div className={styles.parte}>
        <h3 className={styles.titulo}>Limites por categoria</h3>
        {comLimite.length === 0 ? (
          <span className={styles.extra}>Nenhum limite neste mês.{!fechado && <> <Link to="/orcamento">Pôr um limite</Link> avisa antes de passar.</>}</span>
        ) : (
          <ul className={styles.limites} aria-label="Limites por categoria">
            {comLimite.map((l) => <LinhaLimite key={l.categoriaId ?? "todos"} l={l} serie={serieDe(l.categoriaId, l.categoria)} fechado={fechado} />)}
          </ul>
        )}
      </div>

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

const ETIQUETA: Record<LimiteDoMes["situacao"], { texto: string; tom: "negativo" | "alerta" } | null> = {
  passou: { texto: "Passou", tom: "negativo" },
  "vai-passar": { texto: "Vai passar", tom: "alerta" },
  perto: { texto: "Perto", tom: "alerta" },
  ok: null,
}

/** Um limite: gasto (cheio) + ainda vem (listrado), na cor da categoria, contra o limite (a trilha); o que sobra ou
 *  quanto passou. A situação (passou, vai passar, perto) vai na etiqueta, com o texto. No mês fechado não tem "ainda
 *  vem" nem "vai passar": só quanto sobrou do limite ou quanto passou. */
function LinhaLimite({ l, serie, fechado }: { l: LimiteDoMes; serie: string; fechado?: boolean }) {
  if (fechado) l = { ...l, previsto: 0 }
  const escala = Math.max(l.limite, l.gasto + l.previsto) || 1
  const pct = (v: number) => `${(v / escala) * 100}%`
  const etiqueta = fechado ? (l.gasto > l.limite ? ETIQUETA.passou : null) : ETIQUETA[l.situacao]
  const resta = l.limite - l.gasto - l.previsto
  return (
    <li>
      <span className={styles.limiteTopo}>
        <span className={styles.limiteNome}>{l.categoriaId ? l.categoria : "Todos os gastos"}</span>
        {etiqueta && <Etiqueta tom={etiqueta.tom}>{etiqueta.texto}</Etiqueta>}
        <span className={styles.limiteValor}><Dinheiro valor={l.gasto + l.previsto} /> <span className={styles.sub}>de <Dinheiro valor={l.limite} /></span></span>
      </span>
      <span className={styles.trilha} aria-hidden="true">
        <span className={styles.medida} data-serie={serie} style={{ width: pct(l.gasto) }} />
        {l.previsto > 0 && <span className={styles.medidaVem} data-serie={serie} style={{ left: pct(l.gasto), width: pct(l.previsto) }} />}
        {l.gasto + l.previsto > l.limite && <span className={styles.limiteMarca} style={{ left: pct(l.limite) }} />}
      </span>
      <span className={styles.sub}>
        {/* A sobra do servidor é limite − gasto; aqui conta também o que ainda vem (é o que dá pra gastar de verdade). */}
        {fechado ? (resta >= 0 ? <>sobrou <Dinheiro valor={resta} /> do limite</> : <>passou <Dinheiro valor={-resta} /></>)
          : resta >= 0 ? <>dá pra gastar mais <Dinheiro valor={resta} /></>
          : l.sobra < 0 ? <>passou <Dinheiro valor={-l.sobra} /></>
          : <>passa <Dinheiro valor={-resta} /> com o que ainda vem</>}
        {l.previsto > 0 && resta >= 0 && <> · já contando <Dinheiro valor={l.previsto} /> que ainda vem</>}
      </span>
    </li>
  )
}
