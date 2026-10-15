// Nova transação do v2 — a casca da tela: carrega contas, cartões e categorias e entrega pro
// FormularioTransacao (o mesmo da edição).
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
import Bloco, { Esqueleto } from "../componentes/Bloco"
import FormularioTransacao from "./FormularioTransacao"
import styles from "./NovaTransacao.module.css"

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
    <div className={styles.pagina}>
      <h1 className={styles.titulo}>Nova transação</h1>
      {erroCarga ? (
        <p className={styles.alerta} role="alert">Não foi possível carregar suas contas e categorias. Recarregue a página.</p>
      ) : carregando ? (
        <Bloco className={styles.esqueleto}><Esqueleto linhas={6} altura={18} /></Bloco>
      ) : (
        <FormularioTransacao contas={contas} cartoes={cartoes} categorias={categorias} subcategorias={subcategorias}
          aoSair={() => navigate(voltarPara, { replace: true })} aoSalvo={() => navigate(voltarPara, { replace: true })} />
      )}
    </div>
  )
}
