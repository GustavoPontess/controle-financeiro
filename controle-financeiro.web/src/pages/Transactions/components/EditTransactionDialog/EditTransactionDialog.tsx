import { useEffect, useState } from "react"
import { PontesModal } from "@/components/pontes"
import TransactionForm from "../TransactionForm/TransactionForm"
import type { TransactionFormData } from "../TransactionForm/TransactionForm"
import { getCategories } from "../../../../services/categoryService"
import { getSubcategories } from "../../../../services/subcategoryService"
import { updateTransaction } from "../../../../services/transactionService"
import { getContas } from "../../../../services/contaService"
import { getCartoes } from "../../../../services/cartaoCreditoService"
import type { Category } from "../../../../types/Category"
import type { Subcategory } from "../../../../types/Subcategory"
import type { Conta } from "../../../../types/Conta"
import type { CartaoCredito } from "../../../../types/CartaoCredito"

export interface EditableTransaction {
  id: string
  descricao: string
  valor: number
  tipo: number
  categoriaId?: string
  subcategoriaId?: string
  contaId?: string
  cartaoCreditoId?: string
  meioPagamento?: number
  /** Dia "YYYY-MM-DD". */
  data: string
  /** Hora "HH:MM:SS" ou null/ausente. */
  hora?: string | null
}

type Notification = { open: boolean; message: string; severity: "success" | "error" }

type Props = {
  transaction: EditableTransaction | null
  onClose: () => void
  onSaved: () => void
  notify: React.Dispatch<React.SetStateAction<Notification>>
}

/** Converte string BR ("1.234,56") para número. */
function parseValor(v: string): number {
  return Number(v.replace(/\./g, "").replace(",", "."))
}

/** Converte número para string BR ("1.234,56"). */
function formatValor(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function EditTransactionDialog({ transaction, onClose, onSaved, notify }: Props) {
  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [contas, setContas] = useState<Conta[]>([])
  const [cartoes, setCartoes] = useState<CartaoCredito[]>([])

  useEffect(() => {
    if (!transaction) return
    Promise.all([getCategories(), getSubcategories(), getContas(), getCartoes()]).then(
      ([cats, subs, cts, carts]) => {
        setCategories(cats)
        setSubcategories(subs)
        setContas(cts)
        setCartoes(carts)
      }
    )
  }, [transaction])

  if (!transaction) return null

  const initial: Partial<TransactionFormData> = {
    natureza: transaction.tipo === 2 ? "receita" : "despesa",
    tipo: transaction.tipo,
    meioPagamento: transaction.meioPagamento ?? 4,
    categoriaId: transaction.categoriaId ?? "",
    subcategoriaId: transaction.subcategoriaId ?? "",
    contaId: transaction.contaId ?? "",
    cartaoCreditoId: transaction.cartaoCreditoId ?? "",
    valor: formatValor(transaction.valor),
    data: transaction.data,
    hora: transaction.hora ? transaction.hora.slice(0, 5) : "",
    descricao: transaction.descricao,
  }

  const handleSave = async (data: TransactionFormData) => {
    const valor = parseValor(data.valor)
    if (!valor || valor <= 0) {
      notify({ open: true, message: "Informe um valor válido", severity: "error" })
      return
    }
    if (!data.categoriaId) {
      notify({ open: true, message: "Selecione a categoria", severity: "error" })
      return
    }
    try {
      await updateTransaction(transaction.id, {
        descricao: data.descricao,
        valor,
        tipo: data.tipo,
        categoriaId: data.categoriaId || null,
        subcategoriaId: data.subcategoriaId || null,
        contaId: transaction.contaId,
        cartaoCreditoId: transaction.cartaoCreditoId,
        meioPagamento: data.meioPagamento,
        // date e time separados (sem fuso): data "YYYY-MM-DD", hora "HH:MM:SS" ou null.
        data: data.data,
        hora: data.hora ? `${data.hora}:00` : null,
      })
      notify({ open: true, message: "Transação atualizada", severity: "success" })
      onSaved()
      onClose()
    } catch {
      notify({ open: true, message: "Erro ao atualizar transação", severity: "error" })
    }
  }

  return (
    <PontesModal open={!!transaction} title="Editar transação" onClose={onClose}>
      <TransactionForm
        mode="edit"
        initial={initial}
        categories={categories}
        subcategories={subcategories}
        contas={contas}
        cartoes={cartoes}
        onSubmit={handleSave}
        onCancel={onClose}
      />
    </PontesModal>
  )
}
