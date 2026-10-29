// A resposta de uma tela em uma frase (docs/features/respostas/visao.md): o número e o que dá pra fazer, com o tom
// da situação. O texto vem pronto do servidor; aqui só a caixa e as ações. Quando a resposta tem itens (ex.: as contas
// que ficam sem dinheiro), eles vêm como filhos, embaixo da frase, e o `detalhe` (o dado que explica) fecha a caixa.
import type { ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import Botao from "./Botao"
import styles from "./Resposta.module.css"

export default function Resposta({ tom = "neutro", texto, acoes = [], detalhe, compacta, children }: {
  tom?: "positivo" | "alerta" | "negativo" | "neutro"
  texto: string
  acoes?: { rotulo: string; para: string }[]
  /** Linha mais apagada no fim (ex.: "Saldo da conta hoje: R$ 300,00."). */
  detalhe?: string
  /** Numa lista de respostas (Relatórios › O que vale olhar): menos respiro, ação como link de texto. */
  compacta?: boolean
  children?: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <div className={styles.resposta} data-tom={tom} data-compacta={compacta || undefined}>
      {/* "R$" nunca fica numa linha e o número na outra. */}
      <p className={styles.texto}>{texto.replace(/R\$ /g, "R$\u00A0")}</p>
      {children && <div className={styles.itens}>{children}</div>}
      {detalhe && <p className={styles.detalhe}>{detalhe.replace(/R\$ /g, "R$\u00A0")}</p>}
      {acoes.length > 0 && (
        <div className={styles.acoes}>
          {acoes.map((a) => <Botao key={a.para} variante={compacta ? "texto" : undefined} onClick={() => navigate(a.para)}>{a.rotulo}</Botao>)}
        </div>
      )}
    </div>
  )
}
