// Botão do v2 — o ÚNICO jeito de pôr botão numa tela. Medida e cor moram aqui; a tela só escolhe
// variante e tamanho. `className` é só pra posição/largura no layout da tela, nunca pra cor ou medida.
import type { ComponentPropsWithRef, ReactNode } from "react"
import styles from "./Botao.module.css"

type Props = ComponentPropsWithRef<"button"> & {
  /** primario = tinta cheia (a ação principal) · secundario = contorno · texto = sem moldura */
  variante?: "primario" | "secundario" | "texto"
  /** Ação destrutiva: primário vira vermelho cheio; secundário e texto ficam com a letra vermelha. */
  perigo?: boolean
  /** md = 36px (barras, caixas, diálogos) · lg = 44px (formulário de página inteira, como o login) */
  tamanho?: "md" | "lg"
  /** Ocupa a largura toda. */
  cheio?: boolean
  /** Só o ícone, quadrado (exige aria-label). */
  soIcone?: boolean
  /** Ligado (ex.: "Filtros" com filtro aplicado ou painel aberto). */
  ativo?: boolean
  /** No celular, esconde o texto e fica só o ícone (o texto continua como nome acessível). */
  compactoNoCelular?: boolean
  icone?: ReactNode
}

export default function Botao({ variante = "secundario", perigo, tamanho = "md", cheio, soIcone, ativo, compactoNoCelular,
  icone, children, type = "button", className, ...resto }: Props) {
  return (
    <button type={type} className={className ? `${styles.botao} ${className}` : styles.botao}
      data-variante={variante} data-tamanho={tamanho} data-perigo={perigo || undefined} data-cheio={cheio || undefined}
      data-so-icone={soIcone || undefined} data-ativo={ativo || undefined} data-compacto={compactoNoCelular || undefined} {...resto}>
      {icone}
      {children != null && children !== false && <span className={styles.rotulo}>{children}</span>}
    </button>
  )
}
