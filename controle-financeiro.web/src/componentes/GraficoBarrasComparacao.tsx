// "Pra onde foi" do v2 (Relatórios): uma barra por categoria, das maiores pras menores, com o valor e a parte do gasto
// direto na linha, o que ainda vem listrado no fim da barra e UM traço no ponto do normal (bullet do Few: passou do
// traço, gastou acima do normal). Barra e não pizza: pizza só mostra proporção e não marca o normal. A cor segue a
// série da categoria (a mesma do UsoDaRenda); "Outras" e "Sem categoria" em cinza. Linha inteira com 44px de toque.
// Os números e o "acima/abaixo" vêm do servidor; aqui só a geometria (largura = valor ÷ maior).
import { Dinheiro } from "./Dinheiro"
import styles from "./GraficoBarrasComparacao.module.css"

export type LinhaComparacao = {
  chave: string
  nome: string
  valor: number
  /** Ainda vem este mês (listrado no fim da barra). */
  previsto?: number
  /** Média dos meses anteriores (o traço); null sem histórico. */
  normal: number | null
  /** % acima (+) ou abaixo (−) do normal; null sem histórico. */
  variacao: number | null
  /** % do gasto do mês. */
  parte?: number
  /** "1".."5" (séries na ordem) ou "cinza"/"cinza-2". */
  serie: string
  /** Texto à direita no lugar da comparação (ex.: "37 lançamentos"). */
  extra?: string
}

/** Passou do normal quando é pelo menos 30% e R$ 50 a mais (a mesma régua do servidor pra frase). */
const passou = (l: LinhaComparacao) => l.variacao != null && l.normal != null && l.variacao >= 30 && l.valor - l.normal >= 50

function comparacao(l: LinhaComparacao): { texto: string; tom?: "alerta" | "positivo" } {
  if (l.extra) return { texto: l.extra }
  if (l.normal == null || l.variacao == null) return { texto: l.normal === 0 ? "Novo neste mês" : "Sem meses pra comparar" }
  if (l.variacao === 0) return { texto: "igual ao normal" }
  const texto = `${Math.abs(l.variacao)}% ${l.variacao > 0 ? "acima" : "abaixo"} do normal`
  return { texto, tom: passou(l) ? "alerta" : l.variacao < 0 ? "positivo" : undefined }
}

export default function GraficoBarrasComparacao({ linhas, aoEscolher, rotulo }: {
  linhas: LinhaComparacao[]
  /** Tocar na linha (ex.: abre Transações filtrada pela categoria). */
  aoEscolher?: (chave: string) => void
  rotulo: string
}) {
  const maior = Math.max(1, ...linhas.map((l) => Math.max(l.valor + (l.previsto ?? 0), l.normal ?? 0)))
  const pct = (v: number) => `${Math.min(100, (v / maior) * 100)}%`
  return (
    <ul className={styles.lista} aria-label={rotulo}>
      {linhas.map((l) => {
        const c = comparacao(l)
        const conteudo = (
          <>
            <span className={styles.topo}>
              <span className={styles.nome}><i data-serie={l.serie} aria-hidden="true" />{l.nome}</span>
              <span className={styles.valor}>
                <Dinheiro valor={l.valor} />
                {l.parte != null && <span className={styles.parte}>{String(l.parte).replace(".", ",")}%</span>}
              </span>
            </span>
            <span className={styles.trilha} aria-hidden="true">
              <span className={styles.barra} data-serie={l.serie} style={{ width: pct(l.valor) }} />
              {!!l.previsto && <span className={styles.previsto} data-serie={l.serie} style={{ left: pct(l.valor), width: pct(l.previsto) }} />}
              {l.normal != null && l.normal > 0 && <span className={styles.normal} style={{ left: pct(l.normal) }} />}
            </span>
            <span className={styles.comparacao} data-tom={c.tom}>
              {c.texto}
              {l.normal != null && l.normal > 0 && !l.extra && <> · normal <Dinheiro valor={l.normal} /></>}
              {!!l.previsto && <> · ainda vem <Dinheiro valor={l.previsto} /></>}
            </span>
          </>
        )
        return (
          <li key={l.chave}>
            {aoEscolher ? <button type="button" className={styles.linha} onClick={() => aoEscolher(l.chave)}>{conteudo}</button>
              : <div className={styles.linha}>{conteudo}</div>}
          </li>
        )
      })}
    </ul>
  )
}
