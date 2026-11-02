// As categorias do mês em Relatórios: uma barra por categoria, das maiores pras menores, com o valor e a parte da renda
// direto na linha, o que ainda vem listrado no fim da barra, UM traço no ponto do normal (bullet do Few: passou do
// traço, gastou acima do normal) e, se a categoria tem limite, a marca tracejada dele. Embaixo, uma frase só com a
// comparação com o normal e o limite (2026-11-01, Gustavo: "dá pra juntar tudo sem repetir": a lista é ao mesmo tempo
// a legenda da barra da renda, o "pra onde foi" e os limites). Barra e não pizza: pizza só mostra proporção e não
// marca o normal. A cor segue a série da categoria; "Outras" e "Sem categoria" em cinza. Linha inteira com 44px de
// toque. Os números e o "acima/abaixo" vêm do servidor; aqui só a geometria (largura = valor ÷ maior).
import { useState, type ReactNode } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Dinheiro } from "./Dinheiro"
import Etiqueta from "./Etiqueta"
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
  /** % da renda (ou do gasto, sem renda). */
  parte?: number
  /** "1".."5" (séries na ordem) ou "cinza"/"cinza-2". */
  serie: string
  /** Texto à direita no lugar da comparação (ex.: "37 lançamentos"). */
  extra?: string
  /** O limite da categoria no mês (a marca tracejada) e a frase dele ("limite R$ 850: dá pra gastar mais R$ 220"). */
  limite?: { valor: number; texto: ReactNode }
  /** Situação do limite (Passou, Vai passar, Perto), ao lado do nome. */
  etiqueta?: { texto: string; tom: "negativo" | "alerta" }
  /** Fica atrás de "Mais N categorias" (a última linha da lista), que abre ali mesmo. */
  recolhida?: boolean
}

/** Passou do normal quando é pelo menos 30% e R$ 50 a mais (a mesma régua do servidor pra frase). */
const passou = (l: LinhaComparacao) => l.variacao != null && l.normal != null && l.variacao >= 30 && l.valor - l.normal >= 50

/** Contra o quê a linha compara (o traço): o normal dos últimos meses, ou o ano anterior no "Ano completo". */
export type Contra = { de: string; igual: string; rotulo: string; novo: string; sem: string }
const CONTRA_O_NORMAL: Contra = { de: "do normal", igual: "igual ao normal", rotulo: "normal", novo: "Novo neste mês", sem: "Sem meses pra comparar" }

function comparacao(l: LinhaComparacao, contra: Contra): { texto: string; tom?: "alerta" | "positivo" } | null {
  if (l.extra) return { texto: l.extra }
  if (l.normal == null || l.variacao == null) return l.valor > 0 ? { texto: l.normal === 0 ? contra.novo : contra.sem } : null
  if (l.variacao === 0) return { texto: contra.igual }
  const texto = `${Math.abs(l.variacao)}% ${l.variacao > 0 ? "acima" : "abaixo"} ${contra.de}`
  return { texto, tom: passou(l) ? "alerta" : l.variacao < 0 ? "positivo" : undefined }
}

export default function GraficoBarrasComparacao({ linhas: todas, aoEscolher, rotulo, contra = CONTRA_O_NORMAL }: {
  linhas: LinhaComparacao[]
  contra?: Contra
  /** Tocar na linha (ex.: abre Transações filtrada pela categoria). */
  aoEscolher?: (chave: string) => void
  rotulo: string
}) {
  const [abertas, setAbertas] = useState(false)
  // A escala é a de todas (abrir as recolhidas não muda o tamanho das barras de cima).
  const maior = Math.max(1, ...todas.map((l) => Math.max(l.valor + (l.previsto ?? 0), l.normal ?? 0, l.limite?.valor ?? 0)))
  const recolhidas = todas.filter((l) => l.recolhida)
  const linhas = abertas ? [...todas.filter((l) => !l.recolhida), ...recolhidas] : todas.filter((l) => !l.recolhida)
  const pct = (v: number) => `${Math.min(100, (v / maior) * 100)}%`
  return (
    <ul className={styles.lista} aria-label={rotulo}>
      {linhas.map((l) => {
        const c = comparacao(l, contra)
        const conteudo = (
          <>
            <span className={styles.topo}>
              <span className={styles.nome}><i data-serie={l.serie} aria-hidden="true" /><span className={styles.nomeTexto}>{l.nome}</span>
                {l.etiqueta && <Etiqueta tom={l.etiqueta.tom}>{l.etiqueta.texto}</Etiqueta>}</span>
              <span className={styles.valor}>
                <Dinheiro valor={l.valor} />
                {l.parte != null && <span className={styles.parte}>{String(l.parte).replace(".", ",")}%</span>}
              </span>
            </span>
            <span className={styles.trilha} aria-hidden="true">
              <span className={styles.barra} data-serie={l.serie} style={{ width: pct(l.valor) }} />
              {!!l.previsto && <span className={styles.previsto} data-serie={l.serie} data-sozinho={l.valor <= 0 || undefined} style={{ left: pct(l.valor), width: pct(l.previsto) }} />}
              {l.normal != null && l.normal > 0 && <span className={styles.normal} style={{ left: pct(l.normal) }} />}
              {l.limite && <span className={styles.limite} style={{ left: pct(l.limite.valor) }} />}
            </span>
            <span className={styles.comparacao}>
              {c && <span data-tom={c.tom}>{c.texto}</span>}
              {l.normal != null && l.normal > 0 && !l.extra && <> · {contra.rotulo} <Dinheiro valor={l.normal} /></>}
              {!!l.previsto && <> · ainda vem <Dinheiro valor={l.previsto} /></>}
              {l.limite && <>{(c || !!l.previsto) && " · "}{l.limite.texto}</>}
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
      {recolhidas.length > 0 && (
        <li>
          <button type="button" className={styles.mais} aria-expanded={abertas} onClick={() => setAbertas((v) => !v)}>
            {abertas ? <>Mostrar menos <ChevronUp size={16} strokeWidth={2.25} aria-hidden="true" /></>
              : <>Mais {recolhidas.length} {recolhidas.length === 1 ? "categoria" : "categorias"} · <Dinheiro valor={recolhidas.reduce((s, l) => s + l.valor, 0)} /> <ChevronDown size={16} strokeWidth={2.25} aria-hidden="true" /></>}
          </button>
        </li>
      )}
    </ul>
  )
}
