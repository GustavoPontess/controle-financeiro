// Lista com ficha na linha (modelo Pierre) — a anatomia de Bancos e Categorias: grupos com cabeçalho, linhas que
// são botões e, aberta, a ficha logo embaixo com os dados e as ações. A tela só passa o conteúdo; medida, cor e
// o abre/fecha moram aqui (memória "tela só do seu assunto": nada de página de detalhe pra cadastro).
import type { ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import Avatar from "./Avatar"
import { RodapeFormulario } from "./Formulario"
import styles from "./ListaFicha.module.css"

/** A lista inteira (grupos dentro). */
export function ListaFicha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return <ul className={styles.lista} aria-label={rotulo}>{children}</ul>
}

/** Um grupo: cabeçalho (ícone + rótulo à esquerda, `extra` à direita, ex.: o total) e as linhas. */
export function GrupoFicha({ rotulo, icone, extra, children }: { rotulo: string; icone?: ReactNode; extra?: ReactNode; children: ReactNode }) {
  return (
    <li className={styles.grupo}>
      <h3 className={styles.grupoTopo}><span className={styles.grupoRotulo}>{icone}{rotulo}</span>{extra}</h3>
      <ul className={styles.grupoLista} aria-label={rotulo}>{children}</ul>
    </li>
  )
}

/** Uma linha: marca · título + detalhe · direita · seta. Aberta, mostra a ficha (`children`) embaixo. */
export function ItemFicha({ id, aberto, aoAbrir, marca, titulo, detalhe, direita, apagado, children }: {
  /** Único na tela (liga o botão à ficha pro leitor de tela). */
  id: string
  aberto: boolean
  aoAbrir: () => void
  marca?: ReactNode
  titulo: ReactNode
  /** Linha de baixo do título; some quando a ficha está aberta (ela já diz tudo). */
  detalhe?: ReactNode
  direita?: ReactNode
  /** Esmaecido (ex.: conta encerrada). */
  apagado?: boolean
  children?: ReactNode
}) {
  const ficha = `ficha-${id}`
  return (
    <li className={styles.item} data-aberta={aberto || undefined} data-apagado={apagado || undefined}>
      <button type="button" className={styles.linha} data-sem-marca={marca ? undefined : "true"}
        aria-expanded={aberto} aria-controls={ficha} onClick={aoAbrir}>
        {marca}
        <span className={styles.texto}>
          <span className={styles.nome}>{titulo}</span>
          {detalhe && <span className={styles.sub}>{detalhe}</span>}
        </span>
        {direita ?? <span />}
        <ChevronDown size={18} strokeWidth={2} aria-hidden="true" className={styles.seta} />
      </button>
      {aberto && <div id={ficha} className={styles.ficha} data-sem-marca={marca ? undefined : "true"}>{children}</div>}
    </li>
  )
}

/** Dados da ficha: rótulo à esquerda, valor à direita, um por linha (filhos `<div><dt/><dd/></div>`). */
export function DadosFicha({ children }: { children: ReactNode }) {
  return <dl className={styles.dados}>{children}</dl>
}

/** Ações no pé da ficha, à direita (destrutiva à esquerda, principal à direita). */
export function AcoesFicha({ children }: { children: ReactNode }) {
  return <div className={styles.acoes}><RodapeFormulario>{children}</RodapeFormulario></div>
}

/** Bolinha com a inicial (quando a linha não tem logo), ou a foto de perfil quando a pessoa tem.
 *  `destaque` pinta com o acento (ex.: o que é da pessoa). */
export function InicialFicha({ texto, destaque, foto }: { texto: string; destaque?: boolean; foto?: string }) {
  return <Avatar className={styles.inicial} destaque={destaque} foto={foto} texto={texto.trim().charAt(0).toUpperCase() || "?"} />
}

/** Linha de "nada aqui" dentro de um grupo. */
export function VazioFicha({ children }: { children: ReactNode }) {
  return <li className={styles.vazio}>{children}</li>
}
