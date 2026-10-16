// Editar conta fixa (/contas-fixas/:id/editar): a regra (valor, descrição, categoria, como paga, conta/cartão,
// repete, começo/fim), no FormularioContaFixa (o mesmo de criar). Ocorrência avulsa se edita em Transações;
// "só a próxima" tem página própria.
import { useEffect, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { getRecorrente } from "../services/recorrenteService"
import { getContas } from "../services/contaService"
import { getCartoes } from "../services/cartaoCreditoService"
import { getCategories } from "../services/categoryService"
import { getSubcategories } from "../services/subcategoryService"
import type { Recorrente } from "../types/Recorrente"
import type { Conta } from "../types/Conta"
import type { CartaoCredito } from "../types/CartaoCredito"
import type { Category } from "../types/Category"
import type { Subcategory } from "../types/Subcategory"
import { PaginaFormulario } from "../componentes/Formulario"
import FormularioContaFixa from "./FormularioContaFixa"

export default function EditarContaFixa() {
  const { id = "" } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const voltarPara = (location.state as { voltarPara?: string } | null)?.voltarPara ?? `/contas-fixas/${id}`
  const [r, setR] = useState<Recorrente | null>(null)
  const [contas, setContas] = useState<Conta[]>([])
  const [cartoes, setCartoes] = useState<CartaoCredito[]>([])
  const [categorias, setCategorias] = useState<Category[]>([])
  const [subcategorias, setSubcategorias] = useState<Subcategory[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    Promise.all([getRecorrente(id), getContas(), getCartoes(), getCategories(), getSubcategories()])
      .then(([rec, cts, cars, cats, subs]) => {
        if (!vivo) return
        if (rec.situacao === "cancelada" || rec.situacao === "encerrada") { setErroCarga("Conta fixa encerrada não se edita."); return }
        setR(rec); setContas(cts); setCartoes(cars); setCategorias(cats); setSubcategorias(subs)
      })
      .catch(() => { if (vivo) setErroCarga("Não foi possível carregar a conta fixa. Recarregue a página.") })
      .finally(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
  }, [id])

  return (
    <PaginaFormulario titulo="Editar conta fixa" carregando={carregando} erroCarga={erroCarga}>
      {r && (
        <FormularioContaFixa recorrente={r} contas={contas} cartoes={cartoes} categorias={categorias} subcategorias={subcategorias}
          aoSair={() => navigate(voltarPara, { replace: true })} aoSalvo={() => navigate(voltarPara, { replace: true })} />
      )}
    </PaginaFormulario>
  )
}
