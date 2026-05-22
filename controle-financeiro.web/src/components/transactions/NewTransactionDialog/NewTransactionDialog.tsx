import { useEffect, useState } from "react"
import { PontesModal } from "@/components/pontes"
import TransactionForm from "../TransactionForm/TransactionForm"
import type { TransactionFormData } from "../TransactionForm/TransactionForm"
import { getCategories } from "../../../services/categoryService"
import { getSubcategories } from "../../../services/subcategoryService"
import { createTransaction } from "../../../services/transactionService"
import { getContas } from "../../../services/contaService"
import { getCartoes } from "../../../services/cartaoCreditoService"
import type { Category } from "../../../types/Category"
import type { Subcategory } from "../../../types/Subcategory"
import type { Conta } from "../../../types/Conta"
import type { CartaoCredito } from "../../../types/CartaoCredito"

type Notification = { open: boolean; message: string; severity: "success" | "error" }
type Props = {
  open: boolean
  onClose: () => void
  notify: React.Dispatch<React.SetStateAction<Notification>>
}

/** Converte string BR ("1.234,56") para número. */
function parseValor(v: string): number {
  return Number(v.replace(/\./g, "").replace(",", "."))
}

export default function NewTransactionDialog({ open, onClose, notify }: Props) {
  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [contas, setContas] = useState<Conta[]>([])
  const [cartoes, setCartoes] = useState<CartaoCredito[]>([])

  useEffect(() => {
    if (!open) return
    Promise.all([getCategories(), getSubcategories(), getContas(), getCartoes()]).then(
      ([cats, subs, cts, carts]) => {
        setCategories(cats)
        setSubcategories(subs)
        setContas(cts)
        setCartoes(carts)
      }
    )
  }, [open])

  const handleCreate = async (data: TransactionFormData) => {
    const valor = parseValor(data.valor)
    if (!valor || valor <= 0) {
      notify({ open: true, message: "Informe um valor válido", severity: "error" })
      return
    }
    if (!data.categoriaId) {
      notify({ open: true, message: "Selecione a categoria", severity: "error" })
      return
    }
    const isCredito = data.meioPagamento === 3
    if (isCredito && !data.cartaoCreditoId) {
      notify({ open: true, message: "Selecione o cartão", severity: "error" })
      return
    }
    if (!isCredito && !data.contaId) {
      notify({ open: true, message: "Selecione a conta", severity: "error" })
      return
    }
    try {
      await createTransaction({
        descricao: data.descricao,
        valor,
        tipo: data.tipo,
        categoriaId: data.categoriaId || null,
        subcategoriaId: data.subcategoriaId || null,
        contaId: isCredito ? undefined : data.contaId || undefined,
        cartaoCreditoId: isCredito ? data.cartaoCreditoId || undefined : undefined,
        usadoComoCredito: isCredito,
        meioPagamento: data.meioPagamento,
        parcelas: isCredito && data.parcelas > 1 ? data.parcelas : undefined,
        data: data.data,
      })
      notify({ open: true, message: "Transação criada com sucesso", severity: "success" })
      window.dispatchEvent(new Event("transactionCreated"))
      onClose()
    } catch {
      notify({ open: true, message: "Erro ao criar transação", severity: "error" })
    }
  }

  return (
    <PontesModal open={open} title="Nova transação" onClose={onClose}>
      <TransactionForm
        categories={categories}
        subcategories={subcategories}
        contas={contas}
        cartoes={cartoes}
        onSubmit={handleCreate}
        onCancel={onClose}
      />
    </PontesModal>
  )
}
