// Seção em planilha do v2: UM componente com tudo (pedido do Gustavo 2026-10-21, "cria um componente com tudo"):
// o título, a faixa de números e a tabela com cabeçalho, linhas, barra, ação e a linha do botão no fim (`rodape`).
// As seções só passam os dados (Receita, Despesas e Guardar do Orçamento são a mesma peça). A tabela sempre tem
// a coluna da barra e a da ação, então as colunas de valor ficam alinhadas entre uma seção e outra.
import type { ReactNode } from "react"
import Bloco, { Esqueleto } from "./Bloco"
import { Dinheiro } from "./Dinheiro"
import { Planilha } from "./Planilha"
import styles from "./SecaoPlanilha.module.css"

/** `contagem`: número de coisas (cadastros, pessoas), sem R$. Padrão: dinheiro. */
export type NumeroSecao = { rotulo: string; valor?: number; tom?: "positivo" | "negativo"; contagem?: boolean }

export default function SecaoPlanilha({ titulo, numeros, acao, rotuloNome, colunas, rotulo, carregando, erro, vazio, rodape, semBarra, larguraAcao, children }: {
  titulo: string
  /** Nome da primeira coluna da tabela ("Categoria", "Meta"). */
  rotuloNome: string
  /** Os números do topo (em geral três: planejado, o que aconteceu, o que sobra/falta). `valor` sem número = carregando. */
  numeros: NumeroSecao[]
  /** Botão da seção, à direita dos números. */
  acao?: ReactNode
  /** Colunas de valor da tabela. */
  colunas: string[]
  /** Nome acessível da lista (padrão: o título). */
  rotulo?: string
  carregando?: boolean
  erro?: string | null
  /** Quando há, aparece no lugar da tabela. */
  vazio?: ReactNode
  /** As linhas (`LinhaPlanilha`, `GrupoPlanilha`). */
  children?: ReactNode
  /** A última linha da tabela (`LinhaBotaoPlanilha` com "Planejar categoria"); aparece mesmo com a tabela vazia. */
  rodape?: ReactNode
  /** Sem a coluna da barra (tabela que não tem progresso, como a do Admin). */
  semBarra?: boolean
  /** Coluna de ação com botões de texto (ver `Planilha`). */
  larguraAcao?: string
}) {
  return (
    <Bloco titulo={titulo} semRespiro>
      <div className={styles.resumo}>
        <div className={styles.numeros}>
          {numeros.map((n) => (
            <div key={n.rotulo} className={styles.numero}>
              <span className={styles.rotulo}>{n.rotulo}</span>
              {n.valor === undefined ? <span className={styles.esqueleto} aria-hidden="true" />
                : n.contagem ? <span className={styles.valor} data-tom={n.tom}>{n.valor.toLocaleString("pt-BR")}</span>
                : <Dinheiro valor={n.valor} className={styles.valor} tom={n.tom} />}
            </div>
          ))}
        </div>
        {acao && <span className={styles.acao}>{acao}</span>}
      </div>
      {erro && <p className={styles.alerta} role="alert">{erro}</p>}
      {carregando ? <div className={styles.respiro}><Esqueleto linhas={3} altura={18} /></div> : (
        <>
          {vazio && <div className={styles.vazio}>{vazio}</div>}
          {(!vazio || rodape) && (
            <Planilha rotulo={rotulo ?? titulo} rotuloNome={rotuloNome} colunas={colunas} barra={!semBarra} acao larguraAcao={larguraAcao} semCabecalho={!!vazio}>
              {!vazio && children}
              {rodape}
            </Planilha>
          )}
        </>
      )}
    </Bloco>
  )
}
