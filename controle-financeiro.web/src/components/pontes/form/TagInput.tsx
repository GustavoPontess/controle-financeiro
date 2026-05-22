/**
 * TagInput — chips removíveis com input. Enter/vírgula adiciona; Backspace remove.
 * Cor via var(--pontes-*). `p`/`font` override escopado opcional (#122).
 */

import { type KeyboardEvent, useState, type CSSProperties } from "react"
import { scopedThemeVars, type Palette } from "../theme"
import styles from "./TagInput.module.css"

export type PontesTagInputProps = {
  p?: Palette
  font?: string
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  maxTags?: number
}

export function PontesTagInput({
  p, font, tags, onChange, placeholder = "Adicionar tag...", maxTags,
}: PontesTagInputProps) {
  const [draft, setDraft] = useState("")

  const commit = () => {
    const v = draft.trim()
    if (!v) return
    if (tags.includes(v)) { setDraft(""); return }
    if (maxTags && tags.length >= maxTags) return
    onChange([...tags, v]); setDraft("")
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit() }
    else if (e.key === "Backspace" && !draft && tags.length > 0) onChange(tags.slice(0, -1))
  }

  return (
    <div className={styles.wrap} style={scopedThemeVars(p, font) as CSSProperties}>
      {tags.map((tag) => (
        <span key={tag} className={styles.tag}>
          {tag}
          <button type="button" onClick={() => onChange(tags.filter((x) => x !== tag))} className={styles.remove}>×</button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKey}
        onBlur={commit}
        placeholder={tags.length === 0 ? placeholder : ""}
        className={styles.input}
      />
    </div>
  )
}
