// Nova conta fixa — a casca da tela: carrega contas, cartões e categorias e entrega pro FormularioContaFixa.
// Duas rotas:
// - /contas-fixas/nova: do zero, ou com o que a Nova transação já tinha (state.rascunho, botão
//   "Transformar em conta fixa");
// - /transacoes/:id/conta-fixa: transforma um lançamento que já existe (o servidor troca um pelo outro numa
//   transação só). Parcela, ocorrência de conta fixa, transferência e pagamento de fatura não viram conta fixa.
import { useEffect, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { getContas } from "../services/contaService"
import { getCartoes } from "../services/cartaoCreditoService"
import { getCategories } from "../services/categoryService"
import { getTransaction } from "../services/transactionService"
import type { Conta } from "../types/Conta"
import type { CartaoCredito } from "../types/CartaoCredito"
import type { Category } from "../types/Category"
import type { Transaction } from "../types/Transaction"
import { PaginaFormulario } from "../componentes/Formulario"
import FormularioContaFixa, { type RascunhoContaFixa } from "./FormularioContaFixa"

type Estado = { voltarPara?: string; rascunho?: RascunhoContaFixa } | null

/** Lançamento que o servidor recusa transformar (parcela, ocorrência, transferência, pagamento de fatura). */
const naoVira = (t: Transaction) =>
  !!(t.parcelamentoId || t.parcelaTransacaoId || t.recorrenteOrigemId || t.ehTransferencia || t.ehPagamentoFatura)

export default function NovaContaFixa({ deTransacao }: {
  /** Rota /transacoes/:id/conta-fixa: transformar esse lançamento. */
  deTransacao?: boolean
} = {}) {
  const { id = "" } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const estado = location.state as Estado
  const voltarPara = estado?.voltarPara ?? (deTransacao ? `/transacoes/${id}` : "/contas-fixas")

  const [t, setT] = useState<Transaction | null>(null)
  const [contas, setContas] = useState<Conta[]>([])
  const [cartoes, setCartoes] = useState<CartaoCredito[]>([])
  const [categorias, setCategorias] = useState<Category[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    Promise.all([deTransacao ? getTransaction(id) : Promise.resolve(null), getContas(), getCartoes(), getCategories()])
      .then(([tx, cts, cars, cats]) => {
        if (!vivo) return
        if (tx && naoVira(tx)) { setErroCarga("Este lançamento não vira conta fixa."); return }
        setT(tx); setContas(cts); setCartoes(cars); setCategorias(cats)
      })
      .catch(() => { if (vivo) setErroCarga(deTransacao ? "Não foi possível carregar o lançamento. Recarregue a página." : "Não foi possível carregar suas contas e categorias. Recarregue a página.") })
      .finally(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
  }, [deTransacao, id])

  return (
    <PaginaFormulario titulo={deTransacao ? "Transformar em conta fixa" : "Nova conta fixa"} carregando={carregando} erroCarga={erroCarga}>
      {(!deTransacao || t) && (
        <FormularioContaFixa transacao={t ?? undefined} inicial={estado?.rascunho} contas={contas} cartoes={cartoes} categorias={categorias}
          aoSair={() => navigate(voltarPara, { replace: true })}
          // Transformar: o lançamento antigo não existe mais, então abre a conta fixa que nasceu dele.
          aoSalvo={(novoId) => deTransacao
            ? navigate(`/contas-fixas/${novoId}`, { replace: true, state: { voltarPara: "/contas-fixas" } })
            : navigate(voltarPara, { replace: true })} />
      )}
    </PaginaFormulario>
  )
}
