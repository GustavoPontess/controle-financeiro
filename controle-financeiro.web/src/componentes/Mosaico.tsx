// Mosaico do v2 (estilo Pinterest): as caixas em colunas de mesma largura, cada uma caindo na coluna MAIS CURTA, na
// ordem em que vêm. Assim nenhuma coluna fica com buraco embaixo de uma caixa baixa (pedido do Gustavo, 2026-10-19,
// na Visão geral). Mede a altura real de cada caixa (ResizeObserver) e reposiciona quando muda (dados chegando,
// janela mudando). Quantas colunas: as que couberem com `larguraMin`; no celular, uma só, na ordem.
import { Children, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import styles from "./Mosaico.module.css"

export default function Mosaico({ children, larguraMin = 380, espaco = 20 }: {
  children: ReactNode
  /** Largura mínima de cada coluna (px); abaixo disso, uma coluna a menos. */
  larguraMin?: number
  /** Espaço entre as caixas (px), na horizontal e na vertical. */
  espaco?: number
}) {
  const itens = Children.toArray(children).filter(Boolean)
  const raiz = useRef<HTMLDivElement | null>(null)
  const caixas = useRef<(HTMLDivElement | null)[]>([])
  const [largura, setLargura] = useState(0)
  const [alturas, setAlturas] = useState<number[]>([])

  // Largura do mosaico (decide quantas colunas).
  useLayoutEffect(() => {
    const el = raiz.current
    if (!el) return
    const medir = () => setLargura(el.clientWidth)
    medir()
    if (typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Altura de cada caixa (muda quando os dados chegam ou a largura da coluna muda).
  useLayoutEffect(() => {
    const medir = () => {
      const novas = caixas.current.slice(0, itens.length).map((c) => c?.offsetHeight ?? 0)
      setAlturas((antes) => (antes.length === novas.length && antes.every((h, i) => h === novas[i]) ? antes : novas))
    }
    medir()
    if (typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(medir)
    caixas.current.slice(0, itens.length).forEach((c) => c && ro.observe(c))
    return () => ro.disconnect()
  }, [itens.length])

  const colunas = Math.max(1, Math.floor((largura + espaco) / (larguraMin + espaco)))
  const larguraColuna = colunas > 1 ? (largura - espaco * (colunas - 1)) / colunas : largura

  // Uma coluna (celular ou antes de medir): fluxo normal, sem posicionar.
  if (colunas === 1 || largura === 0)
    return (
      <div ref={raiz} className={styles.pilha} style={{ gap: espaco }}>
        {itens.map((item, i) => <div key={i} ref={(el) => { caixas.current[i] = el }}>{item}</div>)}
      </div>
    )

  // Várias colunas: cada caixa vai pra coluna mais curta até agora.
  const fundo = new Array<number>(colunas).fill(0)
  const posicoes = itens.map((_, i) => {
    const col = fundo.indexOf(Math.min(...fundo))
    const pos = { x: col * (larguraColuna + espaco), y: fundo[col] }
    fundo[col] += (alturas[i] ?? 0) + espaco
    return pos
  })
  const altura = Math.max(0, Math.max(...fundo) - espaco)

  return (
    <div ref={raiz} className={styles.mosaico} style={{ height: altura }}>
      {itens.map((item, i) => (
        <div key={i} ref={(el) => { caixas.current[i] = el }} className={styles.caixa}
          style={{ width: larguraColuna, transform: `translate(${posicoes[i].x}px, ${posicoes[i].y}px)` }}>
          {item}
        </div>
      ))}
    </div>
  )
}
