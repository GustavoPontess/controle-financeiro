// Nova conta fixa (/contas-fixas/nova) — a casca da tela: carrega contas, cartões e categorias e entrega pro
// FormularioContaFixa (o mesmo da edição).
import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { getContas } from "../services/contaService"
import { getCartoes } from "../services/cartaoCreditoService"
import { getCategories } from "../services/categoryService"
import type { Conta } from "../types/Conta"
import type { CartaoCredito } from "../types/CartaoCredito"
import type { Category } from "../types/Category"
import { PaginaFormulario } from "../componentes/Formulario"
import FormularioContaFixa from "./FormularioContaFixa"

export default function NovaContaFixa() {
  const navigate = useNavigate()
  const location = useLocation()
  const voltarPara = (location.state as { voltarPara?: string } | null)?.voltarPara ?? "/contas-fixas"

  const [contas, setContas] = useState<Conta[]>([])
  const [cartoes, setCartoes] = useState<CartaoCredito[]>([])
  const [categorias, setCategorias] = useState<Category[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga] = useState(false)

  useEffect(() => {
    let vivo = true
    Promise.all([getContas(), getCartoes(), getCategories()])
      .then(([cts, cars, cats]) => { if (!vivo) return; setContas(cts); setCartoes(cars); setCategorias(cats) })
      .catch(() => { if (vivo) setErroCarga(true) })
      .finally(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
  }, [])

  return (
    <PaginaFormulario titulo="Nova conta fixa" carregando={carregando}
      erroCarga={erroCarga ? "Não foi possível carregar suas contas e categorias. Recarregue a página." : null}>
      <FormularioContaFixa contas={contas} cartoes={cartoes} categorias={categorias}
        aoSair={() => navigate(voltarPara, { replace: true })} aoSalvo={() => navigate(voltarPara, { replace: true })} />
    </PaginaFormulario>
  )
}
