/**
 * TagInput — chips removíveis com input pra adicionar novos.
 * Enter ou vírgula adiciona; Backspace remove última.
 */

import { type KeyboardEvent, useState } from "react"
import type { Palette } from "./theme"

export type PontesTagInputProps = {
  p: Palette
  font: string
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
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault(); commit()
    } else if (e.key === "Backspace" && !draft && tags.length > 0) {
      onChange(tags.slice(0, -1))
    }
  }

  const remove = (t: string) => onChange(tags.filter((x) => x !== t))

  return (
    <div style={{
      background: p.surface, border: `1px solid ${p.border}`,
      borderRadius: 12, padding: 10,
      display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center",
      maxWidth: 480,
    }}>
      {tags.map((tag) => (
        <span key={tag} style={{
          background: p.primarySoft, color: p.primary,
          padding: "5px 10px", borderRadius: 8,
          fontSize: 12, fontWeight: 600,
          display: "inline-flex", alignItems: "center", gap: 6, fontFamily: font,
        }}>
          {tag}
          <button
            type="button"
            onClick={() => remove(tag)}
            style={{
              background: "transparent", border: "none", color: p.primary,
              cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0,
            }}
          >×</button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKey}
        onBlur={commit}
        placeholder={tags.length === 0 ? placeholder : ""}
        style={{
          flex: 1, minWidth: 100, border: "none", background: "transparent",
          padding: "6px 8px", fontSize: 13, color: p.text, outline: "none", fontFamily: font,
        }}
      />
    </div>
  )
}
