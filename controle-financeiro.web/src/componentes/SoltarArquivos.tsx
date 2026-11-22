// Área pra arrastar arquivos (ou clicar e escolher). A tela diz o que aceita e recebe a lista; a validação de cada
// arquivo (tipo, tamanho) fica na tela, que mostra o erro no Campo. Teclado: Enter ou espaço abre o seletor.
import { useRef, useState, type DragEvent, type ReactNode } from "react"
import { UploadCloud } from "lucide-react"
import styles from "./SoltarArquivos.module.css"

export default function SoltarArquivos({ aceita, varios, titulo, detalhe, escolhidos, desabilitado, invalido, compacto, convite, ariaLabel, onChange }: {
  /** A área é o assunto da tela (começo do Importar): alta, fundo claro, ícone no acento e o botão escrito. */
  convite?: string
  /** Uma linha só, da altura de um campo (pra somar arquivo depois que a tela já tem o que mostrar). Sem o detalhe. */
  compacto?: boolean
  /** Igual ao `accept` do input (".ofx,.csv"). O navegador não garante: a tela confere. */
  aceita: string
  varios?: boolean
  /** O convite ("Arraste os arquivos do banco aqui"). */
  titulo: ReactNode
  /** Uma linha apagada embaixo ("OFX ou CSV, até 24 de uma vez"). */
  detalhe?: ReactNode
  /** O que já foi escolhido, no lugar do convite ("22 arquivos"). */
  escolhidos?: ReactNode
  desabilitado?: boolean
  invalido?: boolean
  ariaLabel: string
  onChange: (arquivos: File[]) => void
}) {
  const entrada = useRef<HTMLInputElement | null>(null)
  const [sobre, setSobre] = useState(false)

  const soltar = (e: DragEvent) => {
    e.preventDefault()
    setSobre(false)
    if (desabilitado) return
    const lista = Array.from(e.dataTransfer.files)
    if (lista.length > 0) onChange(varios ? lista : lista.slice(0, 1))
  }

  return (
    <div role="button" tabIndex={desabilitado ? -1 : 0} aria-disabled={desabilitado || undefined} aria-invalid={invalido || undefined}
      className={styles.area} data-sobre={sobre || undefined} data-escolhido={escolhidos ? true : undefined} data-compacto={compacto || undefined} data-convite={convite ? true : undefined}
      onClick={() => { if (!desabilitado) entrada.current?.click() }}
      onKeyDown={(e) => { if (!desabilitado && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); entrada.current?.click() } }}
      onDragOver={(e) => { e.preventDefault(); if (!desabilitado) setSobre(true) }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSobre(false) }}
      onDrop={soltar}>
      <input ref={entrada} type="file" accept={aceita} multiple={varios} hidden aria-label={ariaLabel}
        onChange={(e) => { onChange(Array.from(e.target.files ?? [])); e.target.value = "" }} />
      <span className={styles.icone} aria-hidden="true"><UploadCloud size={compacto ? 18 : 22} strokeWidth={2} /></span>
      <span className={styles.titulo}>{sobre ? "Pode soltar" : escolhidos ?? titulo}</span>
      {detalhe && !sobre && !compacto && <span className={styles.detalhe}>{detalhe}</span>}
      {convite && !sobre && <span className={styles.botao} aria-hidden="true">{convite}</span>}
    </div>
  )
}
