// Caixa de texto de várias linhas do v2 (<textarea>), mesma moldura da Entrada. Dentro de um Campo, herda id, vermelho e o erro.
// `comAcoes`: guarda espaço nos dois lados pra botões dentro da caixa (ex.: o "+" e o ↵ do selo Beta).
// `cresce`: começa com `rows` linhas e cresce conforme a pessoa digita (até um teto, depois rola).
import { useLayoutEffect, useRef, type ComponentPropsWithRef } from "react"
import { useCampo } from "./campoContexto"
import styles from "./AreaTexto.module.css"

type Props = Omit<ComponentPropsWithRef<"textarea">, "className"> & { invalido?: boolean; comAcoes?: boolean; cresce?: boolean }

export default function AreaTexto({ invalido, comAcoes, cresce, id, rows = 4, value, ...resto }: Props) {
  const campo = useCampo()
  const inv = invalido ?? campo?.invalido ?? false
  const ref = useRef<HTMLTextAreaElement | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!cresce || !el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight + 2}px`
  }, [cresce, value])
  return (
    <textarea ref={ref} id={id ?? campo?.id} className={styles.area} rows={rows} value={value}
      data-invalido={inv || undefined} data-acoes={comAcoes || undefined} data-cresce={cresce || undefined}
      aria-invalid={inv || undefined} aria-describedby={inv && campo ? campo.erroId : undefined} {...resto} />
  )
}
