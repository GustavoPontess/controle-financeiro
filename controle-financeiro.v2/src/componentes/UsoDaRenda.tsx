// Uso da renda (docs/features/respostas/visao.md, ideia do Gustavo a partir do medidor de contexto do Claude Code):
// o total da barra é a renda do mês e cada pedaço é o que come ela, uma cor por categoria; o que ainda vem (conta
// fixa prevista) fica listrado; o vazio no fim é o que sobra. Passou da renda: a barra cresce além da marca "sua
// renda". Embaixo, a legenda (já saiu · ainda vem · livre ou passou) e a resposta do mês com as ações. Só mostra:
// a conta toda vem pronta do servidor (DinheiroDoMesService). Usado no Início, na Renda e em Relatórios.
import { Link, useNavigate } from "react-router-dom"
import type { DinheiroDoMes, ParteDoMes } from "../types/DinheiroDoMes"
import Botao from "./Botao"
import { Dinheiro } from "./Dinheiro"
import styles from "./UsoDaRenda.module.css"

const pct = (v: number) => `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(v)}%`

/** Cor de cada pedaço: séries na ordem; "Sem categoria" e "Outras" em cinza. */
function series(partes: ParteDoMes[]): string[] {
  let i = 0
  return partes.map((p) => p.categoriaId !== null ? String((i++ % 5) + 1) : p.nome === "Outras" ? "cinza-2" : "cinza")
}

export default function UsoDaRenda({ dados }: { dados: DinheiroDoMes }) {
  const navigate = useNavigate()
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

      {dados.aindaVem.length > 0 && (
        <>
          <span className={styles.grupo}>Ainda vem este mês</span>
          <ul className={styles.legenda} data-vem="true" aria-label="Ainda vem este mês">
            {dados.aindaVem.map((a) => (
              <li key={a.transacaoId}>
                <span className={styles.ponto} data-vem="true" aria-hidden="true" />
                <Link className={styles.nome} to={a.contaFixaId ? `/contas-fixas/${a.contaFixaId}` : `/transacoes/${a.transacaoId}`}>
                  {a.descricao}<span className={styles.mudo}> · dia {Number(a.data.slice(8, 10))} · {a.categoria}</span>
                </Link>
                <Dinheiro valor={a.valor} className={styles.valor} />
                {temRenda && <span className={styles.pct}>{pct(Math.round((a.valor * 1000) / dados.rendaBase) / 10)}</span>}
              </li>
            ))}
          </ul>
        </>
      )}

      {temRenda && (
        <div className={styles.livre} data-passou={passou || undefined}>
          <span className={styles.nome}>{passou ? "Passou da renda" : "Livre"}</span>
          <Dinheiro valor={Math.abs(dados.livre)} className={styles.valor} />
          <span className={styles.pct}>{pct(Math.round((Math.abs(dados.livre) * 1000) / dados.rendaBase) / 10)}</span>
        </div>
      )}

      <div className={styles.resposta} data-tom={dados.resposta.tom}>
        <p className={styles.respostaTexto}>{dados.resposta.texto}</p>
        {dados.resposta.acoes.length > 0 && (
          <div className={styles.acoes}>
            {dados.resposta.acoes.map((a) => <Botao key={a.para} onClick={() => navigate(a.para)}>{a.rotulo}</Botao>)}
          </div>
        )}
      </div>
    </div>
  )
}
