// Lista de lançamentos agrupada por dia — a mesma anatomia em Transações, na fatura do cartão e onde mais
// houver "linha com valor por dia": cabeçalho do dia (Hoje / Ontem / "Quinta-feira, 8 de outubro"), linha
// com ícone (inicial ou ícone), nome, detalhe, hora, etiqueta e valor colorido. Mantém a ordem recebida.
import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { Dinheiro, type TomDinheiro } from "./Dinheiro"
import styles from "./ListaPorDia.module.css"

export type ItemDoDia = {
  id: string
  /** "YYYY-MM-DD" — o agrupamento lê o texto, sem fuso. */
  dia: string
  /** Destino do clique; sem ele a linha não é link. */
  para?: string
  /** Inicial ("M") ou um ícone. */
  icone: ReactNode
  tomIcone?: "positivo" | "neutro"
  nome: string
  sub?: string
  /** "HH:MM" */
  hora?: string | null
  etiqueta?: ReactNode
  valor: number
  tom?: TomDinheiro
}

/** Cabeçalho do dia: "Hoje" / "Ontem" / "Quarta-feira, 8 de outubro" (ano só quando não é o atual). */
export function rotuloDoDia(iso: string): string {
  const hoje = new Date()
  const dia = new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
  const diff = Math.round((new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime() - dia.getTime()) / 86400000)
  if (diff === 0) return "Hoje"
  if (diff === 1) return "Ontem"
  const opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long", ...(dia.getFullYear() !== hoje.getFullYear() ? { year: "numeric" } : {}) }
  const txt = new Intl.DateTimeFormat("pt-BR", opts).format(dia)
  return txt.charAt(0).toUpperCase() + txt.slice(1)
}

/** Agrupa por dia mantendo a ordem recebida (quem chama decide a ordem: o servidor, ou o sort da tela). */
export function porDia<T extends { dia: string }>(itens: T[]): { dia: string; itens: T[] }[] {
  const grupos: { dia: string; itens: T[] }[] = []
  for (const t of itens) {
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.dia === t.dia) ultimo.itens.push(t)
    else grupos.push({ dia: t.dia, itens: [t] })
  }
  return grupos
}

export default function ListaPorDia({ itens }: { itens: ItemDoDia[] }) {
  return (
    <div className={styles.lista}>
      {porDia(itens).map((g) => (
        <section key={g.dia} className={styles.grupo}>
          <h3 className={styles.dia}>{rotuloDoDia(g.dia)}</h3>
          <ul className={styles.linhas}>
            {g.itens.map((i) => {
              const miolo = (
                <>
                  <span className={styles.icone} data-tom={i.tomIcone}>{i.icone}</span>
                  <span className={styles.texto}>
                    <span className={styles.nome}>{i.nome}</span>
                    {i.sub && <span className={styles.sub}>{i.sub}</span>}
                  </span>
                  {i.hora && <span className={styles.hora}>{i.hora}</span>}
                  {i.etiqueta && <span className={styles.etiqueta}>{i.etiqueta}</span>}
                  <Dinheiro valor={i.valor} tom={i.tom} className={styles.valor} />
                </>
              )
              return (
                <li key={i.id}>
                  {i.para ? <Link to={i.para} className={styles.linha}>{miolo}</Link> : <div className={styles.linha}>{miolo}</div>}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
