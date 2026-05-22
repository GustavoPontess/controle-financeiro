/**
 * FileDrop — drop zone para upload. Cor via var(--pontes-*).
 * `p`/`font` override escopado opcional (#122).
 */

import { type DragEvent, type ChangeEvent, useRef, useState, type CSSProperties } from "react"
import { scopedThemeVars, type Palette } from "../theme"
import styles from "./FileDrop.module.css"

export type PontesFileDropProps = {
  p?: Palette
  font?: string
  accept?: string
  multiple?: boolean
  title?: string
  helper?: string
  formats?: string
  onFiles: (files: File[]) => void
}

export function PontesFileDrop({
  p, font, accept, multiple, title = "Arraste seu arquivo aqui", helper = "ou", formats, onFiles,
}: PontesFileDropProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [hover, setHover] = useState(false)

  const handle = (files: FileList | null) => { if (files) onFiles(Array.from(files)) }
  const onDrop = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setHover(false); handle(e.dataTransfer.files) }
  const onDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setHover(true) }
  const onDragLeave = () => setHover(false)
  const onPick = (e: ChangeEvent<HTMLInputElement>) => handle(e.target.files)

  return (
    <div
      onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
      onClick={() => inputRef.current?.click()}
      className={styles.zone}
      data-hover={hover ? "true" : undefined}
      style={scopedThemeVars(p, font) as CSSProperties}
    >
      <div className={styles.icon}>↑</div>
      <div className={styles.title}>{title}</div>
      <div className={styles.helper}>
        {helper} <span className={styles.helperLink}>clique pra selecionar</span>
      </div>
      {formats && <div className={styles.formats}>{formats}</div>}
      <input ref={inputRef} type="file" accept={accept} multiple={multiple} onChange={onPick} className={styles.hidden} />
    </div>
  )
}
