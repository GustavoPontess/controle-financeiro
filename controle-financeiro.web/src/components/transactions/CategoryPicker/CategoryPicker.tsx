import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, Check } from "lucide-react"
import type { Category } from "../../../types/Category"
import type { Subcategory } from "../../../types/Subcategory"
import styles from "./CategoryPicker.module.css"

type Props = {
  categories: Category[]
  subcategories: Subcategory[]
  tipo: number // 1=Despesa, 2=Receita — filtra por finalidade
  categoriaId: string
  subcategoriaId: string
  onChange: (categoriaId: string, subcategoriaId: string) => void
}

/**
 * Dropdown agrupado: categoria-cabeçalho (clicável = só categoria) + subcategorias
 * indentadas (clicável = categoria + subcategoria). Específico de transação.
 */
export default function CategoryPicker({
  categories, subcategories, tipo, categoriaId, subcategoriaId, onChange,
}: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [open])

  const cats = useMemo(() => categories.filter((c) =>
    tipo === 1 ? (c.finalidade === 1 || c.finalidade === 3)
    : tipo === 2 ? (c.finalidade === 2 || c.finalidade === 3)
    : true
  ), [categories, tipo])

  const subsByCat = useMemo(() => {
    const m: Record<string, Subcategory[]> = {}
    for (const s of subcategories) (m[s.categoriaId] ??= []).push(s)
    return m
  }, [subcategories])

  const selCat = categories.find((c) => c.id === categoriaId)
  const selSub = subcategories.find((s) => s.id === subcategoriaId)
  const label = selSub ? `${selCat?.descricao ?? ""} · ${selSub.nome}` : selCat?.descricao ?? ""

  const pick = (catId: string, subId: string) => { onChange(catId, subId); setOpen(false) }

  return (
    <div className={styles.wrap} ref={ref}>
      <button type="button" className={styles.trigger} data-empty={!categoriaId} onClick={() => setOpen((o) => !o)}>
        <span className={styles.triggerText}>{label || "Selecione a categoria"}</span>
        <span className={styles.chev} data-open={open}><ChevronDown size={16} /></span>
      </button>

      {open && (
        <div className={styles.panel}>
          {cats.length === 0 ? (
            <div className={styles.empty}>Nenhuma categoria</div>
          ) : (
            cats.map((c) => (
              <div key={c.id}>
                <button type="button" className={styles.catRow} data-active={categoriaId === c.id && !subcategoriaId} onClick={() => pick(c.id, "")}>
                  <span className={styles.label}>{c.descricao}</span>
                  {categoriaId === c.id && !subcategoriaId && <span className={styles.check}><Check size={14} strokeWidth={2.5} /></span>}
                </button>
                {(subsByCat[c.id] ?? []).map((s) => (
                  <button key={s.id} type="button" className={styles.subRow} data-active={subcategoriaId === s.id} onClick={() => pick(c.id, s.id)}>
                    <span className={styles.label}>{s.nome}</span>
                    {subcategoriaId === s.id && <span className={styles.check}><Check size={14} strokeWidth={2.5} /></span>}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
