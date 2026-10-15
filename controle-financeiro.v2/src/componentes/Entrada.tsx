// Caixa de texto do v2 (<input>). Dentro de um Campo, herda id, vermelho e o erro sozinha.
// `prefixo` = texto fixo à esquerda (ex.: "R$"); `sufixo` = ação dentro da caixa, à direita (ex.: olho da senha).
import type { ComponentPropsWithRef, ReactNode } from "react"
import { useCampo } from "./campoContexto"
import styles from "./Entrada.module.css"

type Props = Omit<ComponentPropsWithRef<"input">, "size" | "className" | "prefix"> & {
  /** md = 44px (formulário) · sm = 40px (painel de filtros) */
  tamanho?: "md" | "sm"
  invalido?: boolean
  prefixo?: ReactNode
  sufixo?: ReactNode
}

export default function Entrada({ tamanho = "md", invalido, prefixo, sufixo, id, ...resto }: Props) {
  const campo = useCampo()
  const inv = invalido ?? campo?.invalido ?? false
  const input = (
    <input id={id ?? campo?.id} className={styles.entrada} data-tamanho={tamanho}
      data-invalido={inv || undefined} aria-invalid={inv || undefined} aria-describedby={inv && campo ? campo.erroId : undefined}
      data-prefixo={prefixo ? true : undefined} data-sufixo={sufixo ? true : undefined} {...resto} />
  )
  if (!prefixo && !sufixo) return input
  return (
    <span className={styles.moldura}>
      {prefixo && <span className={styles.prefixo} aria-hidden="true">{prefixo}</span>}
      {input}
      {sufixo && <span className={styles.sufixo}>{sufixo}</span>}
    </span>
  )
}
