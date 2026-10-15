// Nova transação do v2 — a casca da tela: carrega contas, cartões e categorias e entrega pro
// FormularioTransacao (o mesmo da edição). "Transformar em conta fixa" leva o que foi preenchido pra
// /contas-fixas/nova (formulário próprio).
import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { getContas } from "../services/contaService"
import { getCartoes } from "../services/cartaoCreditoService"
import { getCategories } from "../services/categoryService"
import { getSubcategories } from "../services/subcategoryService"
import type { Conta } from "../types/Conta"
import type { CartaoCredito } from "../types/CartaoCredito"
import type { Category } from "../types/Category"
import type { Subcategory } from "../types/Subcategory"
import { PaginaFormulario } from "../componentes/Formulario"
import FormularioTransacao from "./FormularioTransacao"

export default function NovaTransacao() {
  const navigate = useNavigate()
  const location = useLocation()
  const voltarPara = (location.state as { voltarPara?: string } | null)?.voltarPara ?? "/transacoes"

  const [contas, setContas] = useState<Conta[]>([])
  const [cartoes, setCartoes] = useState<CartaoCredito[]>([])
  const [categorias, setCategorias] = useState<Category[]>([])
  const [subcategorias, setSubcategorias] = useState<Subcategory[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga] = useState(false)

  useEffect(() => {
    let vivo = true
    Promise.all([getContas(), getCartoes(), getCategories(), getSubcategories()])
      .then(([cts, cars, cats, subs]) => { if (!vivo) return; setContas(cts); setCartoes(cars); setCategorias(cats); setSubcategorias(subs) })
      .catch(() => { if (vivo) setErroCarga(true) })
      .finally(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
  }, [])

  return (
    <PaginaFormulario titulo="Nova transação" carregando={carregando}
      erroCarga={erroCarga ? "Não foi possível carregar suas contas e categorias. Recarregue a página." : null}>
      <FormularioTransacao contas={contas} cartoes={cartoes} categorias={categorias} subcategorias={subcategorias}
        aoSair={() => navigate(voltarPara, { replace: true })} aoSalvo={() => navigate(voltarPara, { replace: true })}
        aoVirarContaFixa={(rascunho) => navigate("/contas-fixas/nova", { replace: true, state: { voltarPara, rascunho } })} />
    </PaginaFormulario>
  )
}
