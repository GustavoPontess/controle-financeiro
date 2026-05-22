/**
 * FileDrop — drop zone para upload (OFX, CSV, etc).
 */

import { type DragEvent, type ChangeEvent, useRef, useState } from "react"
import type { Palette } from "../theme"

export type PontesFileDropProps = {
  p: Palette
  font: string
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

  const handle = (files: FileList | null) => {
    if (!files) return
    onFiles(Array.from(files))
  }
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setHover(false)
    handle(e.dataTransfer.files)
  }
  const onDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setHover(true) }
  const onDragLeave = () => setHover(false)
  const onPick = (e: ChangeEvent<HTMLInputElement>) => handle(e.target.files)

  return (
    <div
      onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
      onClick={() => inputRef.current?.click()}
      style={{
        background: hover ? p.primarySoft : p.surface,
        border: `2px dashed ${p.primary}`, borderRadius: 14,
        padding: 32, textAlign: "center", maxWidth: 480,
        cursor: "pointer", fontFamily: font,
        transition: "background 150ms ease",
      }}
    >
      <div style={{
        width: 56, height: 56, borderRadius: 14, background: p.primarySoft,
        color: p.primary, margin: "0 auto 14px",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26,
      }}>↑</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: p.text, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: p.textMuted, marginBottom: 16 }}>
        {helper} <span style={{ color: p.primary, fontWeight: 600 }}>clique pra selecionar</span>
      </div>
      {formats && <div style={{ fontSize: 11, color: p.textMuted }}>{formats}</div>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={onPick}
        style={{ display: "none" }}
      />
    </div>
  )
}
