// Campo de formulário do v2 — rótulo + controle + erro, sempre do mesmo jeito em todas as telas.
// O controle de dentro (Entrada, Selecao) lê o contexto: ganha o id do rótulo (clicar no rótulo foca),
// fica vermelho e aponta pro erro (aria-describedby) sem a tela repetir nada disso.
import { useId, type ReactNode } from "react"
import { CampoContexto } from "./campoContexto"
import styles from "./Campo.module.css"

export default function Campo({ rotulo, erro, grupo, estatico, children, className }: {
  rotulo: ReactNode
  /** Mensagem de erro em vermelho embaixo (e o controle fica vermelho). */
  erro?: string | null
  /** Mais de um controle dentro (ex.: "de … até"): o rótulo nomeia o grupo e cada controle leva o seu aria-label. */
  grupo?: boolean
  /** Sem controle: só mostra um valor fixo (ex.: a conta, que não muda na edição). */
  estatico?: boolean
  children: ReactNode
  /** Só posição/largura no layout da tela. */
  className?: string
}) {
  const id = useId()
  const rotuloId = `${id}-rotulo`
  const erroId = `${id}-erro`
  const cls = className ? `${styles.campo} ${className}` : styles.campo
  const semLabel = grupo || estatico
  return (
    <div className={cls} role={grupo ? "group" : undefined} aria-labelledby={grupo ? rotuloId : undefined}>
      {semLabel
        ? <span id={rotuloId} className={styles.rotulo}>{rotulo}</span>
        : <label htmlFor={id} className={styles.rotulo}>{rotulo}</label>}
      <CampoContexto.Provider value={semLabel ? null : { id, erroId, invalido: !!erro }}>{children}</CampoContexto.Provider>
      {erro && <small id={erroId} className={styles.erro}>{erro}</small>}
    </div>
  )
}

/** Valor fixo dentro de um Campo estático — mesma altura do controle, fundo apagado. */
export function ValorFixo({ children, title }: { children: ReactNode; title?: string }) {
  return <span className={styles.fixo} title={title}>{children}</span>
}
