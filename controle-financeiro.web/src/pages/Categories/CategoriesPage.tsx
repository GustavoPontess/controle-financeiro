import { useEffect, useMemo, useState } from "react"
import { useOutletContext } from "react-router-dom"
import { Plus, ChevronRight, Lock, Pencil, Trash2 } from "lucide-react"
import {
  PontesButton, PontesIconButton, PontesBadge, PontesCard,
  PontesModal, PontesDialog, PontesField, PontesInput, PontesSelect, PontesColorPicker,
} from "@/components/pontes"
import type { Category } from "../../types/Category"
import type { Subcategory } from "../../types/Subcategory"
import { getCategories, createCategory, deleteCategory } from "../../services/categoryService"
import {
  getSubcategories, createSubcategory, updateSubcategory, deleteSubcategory,
} from "../../services/subcategoryService"
import styles from "./CategoriesPage.module.css"

type Notification = { open: boolean; message: string; severity: "success" | "error" }
type OutletContextType = {
  notify: React.Dispatch<React.SetStateAction<Notification>>
  refreshTransactionRequirements: () => Promise<void>
}

const FINALIDADE: Record<number, { label: string; tone: "danger" | "success" | "neutral" }> = {
  1: { label: "Despesa", tone: "danger" },
  2: { label: "Receita", tone: "success" },
  3: { label: "Ambas", tone: "neutral" },
}

const SUB_COLORS = ["#1E40AF", "#F59E0B", "#10B981", "#DC2626", "#0EA5E9", "#A855F7", "#EC4899", "#14B8A6", "#64748B", "#0B1220"]

type SubModalState = { open: boolean; categoriaId: string; editing: Subcategory | null }
type DeleteState = { tipo: "cat" | "sub"; id: string; nome: string } | null

export default function CategoriesPage() {
  const { notify, refreshTransactionRequirements } = useOutletContext<OutletContextType>()
  const [categories, setCategories] = useState<Category[]>([])
  const [subcats, setSubcats] = useState<Subcategory[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Modal categoria
  const [catModalOpen, setCatModalOpen] = useState(false)
  const [catDesc, setCatDesc] = useState("")
  const [catFinalidade, setCatFinalidade] = useState("1")
  const [savingCat, setSavingCat] = useState(false)

  // Modal subcategoria
  const [subModal, setSubModal] = useState<SubModalState>({ open: false, categoriaId: "", editing: null })
  const [subNome, setSubNome] = useState("")
  const [subCor, setSubCor] = useState(SUB_COLORS[0])
  const [savingSub, setSavingSub] = useState(false)

  // Confirmação de exclusão
  const [del, setDel] = useState<DeleteState>(null)

  const load = async () => {
    const [cats, subs] = await Promise.all([getCategories(), getSubcategories()])
    setCategories(cats)
    setSubcats(subs)
  }

  useEffect(() => { void load() }, [])

  const subsByCategoria = useMemo(() => {
    const map: Record<string, Subcategory[]> = {}
    for (const s of subcats) (map[s.categoriaId] ??= []).push(s)
    return map
  }, [subcats])

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // ── Categoria ──
  const abrirNovaCategoria = () => {
    setCatDesc(""); setCatFinalidade("1"); setCatModalOpen(true)
  }
  const salvarCategoria = async () => {
    if (!catDesc.trim()) { notify({ open: true, message: "Informe a descrição", severity: "error" }); return }
    setSavingCat(true)
    try {
      await createCategory({ descricao: catDesc.trim(), finalidade: Number(catFinalidade) })
      setCatModalOpen(false)
      notify({ open: true, message: "Categoria criada", severity: "success" })
      await load()
      await refreshTransactionRequirements()
    } catch {
      notify({ open: true, message: "Erro ao criar categoria", severity: "error" })
    } finally {
      setSavingCat(false)
    }
  }

  // ── Subcategoria ──
  const abrirNovaSub = (categoriaId: string) => {
    setSubModal({ open: true, categoriaId, editing: null }); setSubNome(""); setSubCor(SUB_COLORS[0])
  }
  const abrirEditarSub = (sub: Subcategory) => {
    setSubModal({ open: true, categoriaId: sub.categoriaId, editing: sub })
    setSubNome(sub.nome); setSubCor(sub.cor || SUB_COLORS[0])
  }
  const salvarSub = async () => {
    if (!subNome.trim()) { notify({ open: true, message: "Informe o nome", severity: "error" }); return }
    setSavingSub(true)
    try {
      if (subModal.editing) {
        await updateSubcategory(subModal.editing.id, { nome: subNome.trim(), cor: subCor })
      } else {
        await createSubcategory({ nome: subNome.trim(), cor: subCor, categoriaId: subModal.categoriaId })
        setExpanded((prev) => new Set(prev).add(subModal.categoriaId))
      }
      setSubModal({ open: false, categoriaId: "", editing: null })
      notify({ open: true, message: subModal.editing ? "Subcategoria atualizada" : "Subcategoria criada", severity: "success" })
      await load()
    } catch {
      notify({ open: true, message: "Erro ao salvar subcategoria", severity: "error" })
    } finally {
      setSavingSub(false)
    }
  }

  // ── Exclusão ──
  const confirmarExclusao = async () => {
    if (!del) return
    try {
      if (del.tipo === "cat") {
        await deleteCategory(del.id)
        await refreshTransactionRequirements()
      } else {
        await deleteSubcategory(del.id)
      }
      notify({ open: true, message: "Removido", severity: "success" })
      await load()
    } catch {
      notify({ open: true, message: "Erro ao remover", severity: "error" })
    } finally {
      setDel(null)
    }
  }

  const pessoais = categories.filter((c) => !c.isPadrao)
  const padrao = categories.filter((c) => c.isPadrao)

  const renderCategoria = (cat: Category) => {
    const subs = subsByCategoria[cat.id] ?? []
    const isOpen = expanded.has(cat.id)
    const fin = FINALIDADE[cat.finalidade] ?? FINALIDADE[3]
    return (
      <div key={cat.id} className={styles.catRow}>
        <div className={styles.catMain} data-clickable="true" onClick={() => toggle(cat.id)}>
          <span className={styles.chevron} data-open={isOpen}><ChevronRight size={16} strokeWidth={2.5} /></span>
          <div className={styles.catInfo}>
            <span className={styles.catName}>{cat.descricao}</span>
            <PontesBadge tone={fin.tone} size="sm">{fin.label}</PontesBadge>
            {subs.length > 0 && <span className={styles.subCount}>{subs.length} sub</span>}
          </div>
          <div className={styles.catActions} onClick={(e) => e.stopPropagation()}>
            <PontesIconButton size={32} variant="ghost" aria-label="Nova subcategoria" onClick={() => abrirNovaSub(cat.id)}>
              <Plus size={15} strokeWidth={2.5} />
            </PontesIconButton>
            {cat.isPadrao
              ? <span className={styles.lockIcon} title="Categoria padrão"><Lock size={14} strokeWidth={2} /></span>
              : (
                <PontesIconButton size={32} variant="ghost" aria-label="Remover categoria" onClick={() => setDel({ tipo: "cat", id: cat.id, nome: cat.descricao })}>
                  <Trash2 size={15} strokeWidth={2} />
                </PontesIconButton>
              )}
          </div>
        </div>

        {isOpen && (
          <div className={styles.subList}>
            {subs.length === 0
              ? <div className={styles.subEmpty}>Nenhuma subcategoria. Clique no + pra adicionar.</div>
              : subs.map((s) => (
                <div key={s.id} className={styles.subRow}>
                  <span className={styles.subDot} style={s.cor ? { background: s.cor } : undefined} />
                  <span className={styles.subName}>{s.nome}</span>
                  {!s.isPadrao && (
                    <div className={styles.subActions}>
                      <PontesIconButton size={32} variant="ghost" aria-label="Editar" onClick={() => abrirEditarSub(s)}>
                        <Pencil size={13} strokeWidth={2} />
                      </PontesIconButton>
                      <PontesIconButton size={32} variant="ghost" aria-label="Remover" onClick={() => setDel({ tipo: "sub", id: s.id, nome: s.nome })}>
                        <Trash2 size={13} strokeWidth={2} />
                      </PontesIconButton>
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Categorias</h1>
          <div className={styles.subtitle}>Organize receitas, despesas e subcategorias</div>
        </div>
        <PontesButton size="sm" iconStart={<Plus size={16} strokeWidth={2.5} />} onClick={abrirNovaCategoria}>
          Nova Categoria
        </PontesButton>
      </div>

      {/* Minhas categorias */}
      <PontesCard padding={0} radius={14}>
        <div className={styles.sectionHead}>
          <div>
            <div className={styles.sectionTitle}>Minhas Categorias</div>
            <div className={styles.sectionSub}>Criadas por você — podem ser removidas</div>
          </div>
          <PontesBadge tone="neutral" size="sm">{pessoais.length}</PontesBadge>
        </div>
        {pessoais.length === 0
          ? (
            <div className={styles.empty}>
              Você ainda não criou nenhuma categoria pessoal
              <div className={styles.emptyHint}>Clique em "Nova Categoria" para adicionar</div>
            </div>
          )
          : pessoais.map(renderCategoria)}
      </PontesCard>

      {/* Padrão */}
      <PontesCard padding={0} radius={14}>
        <div className={styles.sectionHead}>
          <div>
            <div className={styles.sectionTitle}>Categorias Padrão</div>
            <div className={styles.sectionSub}>Disponíveis para todos — você pode criar subcategorias próprias</div>
          </div>
          <PontesBadge tone="neutral" size="sm">{padrao.length}</PontesBadge>
        </div>
        {padrao.map(renderCategoria)}
      </PontesCard>

      {/* Modal nova categoria */}
      <PontesModal
        open={catModalOpen}
        title="Nova categoria"
        onClose={() => setCatModalOpen(false)}
        footer={<>
          <PontesButton variant="outline" onClick={() => setCatModalOpen(false)}>Cancelar</PontesButton>
          <PontesButton onClick={salvarCategoria} loading={savingCat} disabled={savingCat}>Criar</PontesButton>
        </>}
      >
        <div className={styles.formCol}>
          <PontesField label="Descrição" required>
            <PontesInput value={catDesc} onChange={(e) => setCatDesc(e.target.value)} placeholder="Ex: Educação" />
          </PontesField>
          <PontesField label="Finalidade">
            <PontesSelect
              value={catFinalidade}
              onChange={setCatFinalidade}
              options={[
                { value: "1", label: "Despesa" },
                { value: "2", label: "Receita" },
                { value: "3", label: "Ambas" },
              ]}
            />
          </PontesField>
        </div>
      </PontesModal>

      {/* Modal subcategoria (criar/editar) */}
      <PontesModal
        open={subModal.open}
        title={subModal.editing ? "Editar subcategoria" : "Nova subcategoria"}
        onClose={() => setSubModal({ open: false, categoriaId: "", editing: null })}
        footer={<>
          <PontesButton variant="outline" onClick={() => setSubModal({ open: false, categoriaId: "", editing: null })}>Cancelar</PontesButton>
          <PontesButton onClick={salvarSub} loading={savingSub} disabled={savingSub}>{subModal.editing ? "Salvar" : "Criar"}</PontesButton>
        </>}
      >
        <div className={styles.formCol}>
          <PontesField label="Nome" required>
            <PontesInput value={subNome} onChange={(e) => setSubNome(e.target.value)} placeholder="Ex: Hortifruti" />
          </PontesField>
          <PontesField label="Cor">
            <PontesColorPicker value={subCor} onChange={setSubCor} colors={SUB_COLORS} />
          </PontesField>
        </div>
      </PontesModal>

      {/* Confirmação de exclusão */}
      <PontesDialog
        open={del !== null}
        title={del?.tipo === "cat" ? "Remover categoria?" : "Remover subcategoria?"}
        description={del?.tipo === "cat"
          ? `Remover "${del?.nome}"? Transações vinculadas ficarão sem categoria.`
          : `Remover "${del?.nome}"? Transações vinculadas ficarão sem subcategoria.`}
        confirmLabel="Remover"
        onConfirm={confirmarExclusao}
        onCancel={() => setDel(null)}
      />
    </div>
  )
}
