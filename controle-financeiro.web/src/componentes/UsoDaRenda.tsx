// Uso da renda (docs/features/respostas/visao.md, ideia do Gustavo a partir do medidor de contexto do Claude Code):
// o total da barra é a renda do mês e cada pedaço é o que come ela, uma cor por categoria; o que ainda vem (conta
// fixa prevista) fica listrado; o vazio no fim é o que sobra. Passou da renda: a barra cresce além da marca "sua
// renda". Embaixo, a legenda (já saiu · ainda vem · livre ou passou), as faturas de cartão a pagar no mês (à parte:
// é quando o dinheiro sai da conta, e as compras delas já contaram no mês em que foram feitas; nunca somam no gasto
// nem no livre), as parcelas já compradas pros próximos meses (o que já está comprometido lá) e a resposta do mês
// com as ações. Só mostra:
// a conta toda vem pronta do servidor (DinheiroDoMesService). Usado no Início, na Renda e em Relatórios.
import { Link } from "react-router-dom"
import type { DinheiroDoMes, FaturaDoMes, ParteDoMes } from "../types/DinheiroDoMes"
import { Dinheiro } from "./Dinheiro"
import Etiqueta from "./Etiqueta"
import { nomeDoPeriodo } from "./NavegadorMes"
import ListaAindaVem from "./ListaAindaVem"
import Resposta from "./Resposta"
import styles from "./UsoDaRenda.module.css"

const pct = (v: number) => `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(v)}%`

/** Cor de cada pedaço: séries na ordem; "Sem categoria" e "Outras" em cinza. */
function series(partes: ParteDoMes[]): string[] {
  let i = 0
  return partes.map((p) => p.categoriaId !== null ? String((i++ % 5) + 1) : p.nome === "Outras" ? "cinza-2" : "cinza")
}

/** `compacta` (Relatórios): só a barra, o que já saiu e o livre; faturas, parcelas e a frase moram em outras seções lá. */
export default function UsoDaRenda({ dados, compacta }: { dados: DinheiroDoMes; compacta?: boolean }) {
  const usado = dados.jaSaiu + dados.aindaVemTotal
  const temRenda = dados.rendaBase > 0
  const escala = Math.max(dados.rendaBase, usado) || 1
  const largura = (v: number) => `${(v / escala) * 100}%`
  const cores = series(dados.jaSaiuPorCategoria)
  const passou = dados.livre < 0

  return (
    <div className={styles.uso}>
      <div className={styles.topo}>
        <span className={styles.usado}>{temRenda ? `${pct(Math.round(dados.percentualUsado))} usado` : <>Gastou <Dinheiro valor={dados.jaSaiu} /></>}</span>
        {temRenda && <span className={styles.conta}><Dinheiro valor={usado} /> de <Dinheiro valor={dados.rendaBase} /></span>}
      </div>
      {temRenda && (
        <span className={styles.recebeu}>
          Recebeu <Dinheiro valor={dados.rendaRecebida} />
          {dados.rendaEsperada > dados.rendaRecebida && <> de <Dinheiro valor={dados.rendaEsperada} /> esperados</>}
        </span>
      )}

      <div className={styles.barraLugar}>
        <div className={styles.barra} role="img" aria-label={temRenda ? `${Math.round(dados.percentualUsado)}% da renda usada` : "Gastos do mês"}>
          {dados.jaSaiuPorCategoria.map((p, i) => (
            <span key={`${p.nome}-${i}`} className={styles.pedaco} data-serie={cores[i]} style={{ width: largura(p.valor) }} />
          ))}
          {dados.aindaVemTotal > 0 && <span className={styles.pedaco} data-vem="true" style={{ width: largura(dados.aindaVemTotal) }} />}
        </div>
        {temRenda && usado > dados.rendaBase && (
          <span className={styles.marca} style={{ left: largura(dados.rendaBase) }}><span className={styles.marcaRotulo}>sua renda</span></span>
        )}
      </div>

      {dados.jaSaiuPorCategoria.length > 0 && (
        <>
          <span className={styles.grupo}>Já saiu</span>
          <ul className={styles.legenda} aria-label="Já saiu">
            {dados.jaSaiuPorCategoria.map((p, i) => (
              <li key={`${p.nome}-${i}`}>
                <span className={styles.ponto} data-serie={cores[i]} aria-hidden="true" />
                <span className={styles.nome}>{p.nome}</span>
                <Dinheiro valor={p.valor} className={styles.valor} />
                {temRenda && <span className={styles.pct}>{pct(p.percentualDaRenda)}</span>}
              </li>
            ))}
          </ul>
        </>
      )}

      {!compacta && dados.aindaVem.length > 0 && (
        <>
          <span className={styles.grupo}>Ainda vem este mês</span>
          <ListaAindaVem itens={dados.aindaVem} base={temRenda ? dados.rendaBase : undefined} />
        </>
      )}

      {temRenda && (
        <div className={styles.livre} data-passou={passou || undefined}>
          <span className={styles.nome}>{passou ? "Passou da renda" : "Livre"}</span>
          <Dinheiro valor={Math.abs(dados.livre)} className={styles.valor} />
          <span className={styles.pct}>{pct(Math.round((Math.abs(dados.livre) * 1000) / dados.rendaBase) / 10)}</span>
        </div>
      )}

      {!compacta && dados.faturas.length > 0 && (
        <>
          <span className={styles.grupo}>
            Faturas a pagar este mês <Dinheiro valor={dados.faturasAPagar} className={styles.grupoTotal} />
          </span>
          <ul className={styles.faturas} aria-label="Faturas a pagar este mês">
            {dados.faturas.map((f) => <LinhaFatura key={f.faturaId} f={f} />)}
          </ul>
        </>
      )}

      {!compacta && dados.parcelasFuturas.total > 0 && (
        <>
          <span className={styles.grupo}>
            Parcelas já compradas pros próximos meses <Dinheiro valor={dados.parcelasFuturas.total} className={styles.grupoTotal} />
          </span>
          <ul className={styles.parcelas} aria-label="Parcelas já compradas pros próximos meses">
            {dados.parcelasFuturas.porMes.slice(0, MESES_DE_PARCELAS).map((p) => (
              <li key={`${p.ano}-${p.mes}`}>
                <span>{nomeDoPeriodo(p).toLowerCase()}</span>
                <Dinheiro valor={p.valor} className={styles.valor} />
              </li>
            ))}
            {dados.parcelasFuturas.porMes.length > MESES_DE_PARCELAS && (
              <li>
                <span>depois, até {nomeDoPeriodo({ ano: dados.parcelasFuturas.ateAno!, mes: dados.parcelasFuturas.ateMes! }).toLowerCase()}</span>
                <Dinheiro valor={dados.parcelasFuturas.porMes.slice(MESES_DE_PARCELAS).reduce((s, p) => s + p.valor, 0)} className={styles.valor} />
              </li>
            )}
          </ul>
        </>
      )}

      {!compacta && (
        <div className={styles.respostaLugar}>
          <Resposta tom={dados.resposta.tom} texto={dados.resposta.texto} acoes={dados.resposta.acoes} />
        </div>
      )}
    </div>
  )
}

/** Meses de parcelas com linha própria; o resto vira "depois, até …". */
const MESES_DE_PARCELAS = 3

/** "3/9" a partir de "2026-09-03..." */
const diaMes = (iso: string) => `${Number(iso.slice(8, 10))}/${Number(iso.slice(5, 7))}`

/** Uma fatura: cartão, quando vence e de quando são as compras; o que falta pagar (e de quanto, se já pagou parte). */
function LinhaFatura({ f }: { f: FaturaDoMes }) {
  return (
    <li>
      <Link className={styles.faturaNome} to={`/cartoes/${f.cartaoId}`}>
        {f.cartao}
        <span className={styles.mudo}>
          {" · "}{f.atrasada ? `venceu ${diaMes(f.dataVencimento)}` : `vence dia ${Number(f.dataVencimento.slice(8, 10))}`}
          {" · compras de "}{diaMes(f.dataInicio)} a {diaMes(f.dataFechamento)}
        </span>
      </Link>
      {f.atrasada && <Etiqueta tom="negativo">Atrasada</Etiqueta>}
      <span className={styles.faturaValor}>
        <Dinheiro valor={f.restante} />
        {f.pago > 0 && <span className={styles.mudo}> de <Dinheiro valor={f.total} /></span>}
      </span>
    </li>
  )
}
