// Editar cartão do v2 — carrega o cartão, bancos e contas e entrega pro FormularioCartao (o mesmo do
// novo). Salvou ou cancelou → volta pra página do cartão.
import { useEffect, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { getCartoes } from "../services/cartaoCreditoService"
import { getBancos } from "../services/bancoService"
import { getContas } from "../services/contaService"
import type { Banco } from "../types/Banco"
import type { CartaoCredito } from "../types/CartaoCredito"
import type { Conta } from "../types/Conta"
import { PaginaFormulario } from "../componentes/Formulario"
import FormularioCartao from "./FormularioCartao"

export default function EditarCartao() {
  const { id = "" } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const voltarPara = (location.state as { voltarPara?: string } | null)?.voltarPara ?? `/cartoes/${id}`
  const [cartao, setCartao] = useState<CartaoCredito | null>(null)
  const [bancos, setBancos] = useState<Banco[]>([])
  const [contas, setContas] = useState<Conta[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    Promise.all([getCartoes(), getBancos(), getContas()])
      .then(([cards, bs, cs]) => {
        if (!vivo) return
        const c = cards.find((x) => x.id === id) ?? null
        if (!c) { setErroCarga("Cartão não encontrado."); return }
        setCartao(c); setBancos(bs); setContas(cs)
      })
      .catch(() => { if (vivo) setErroCarga("Não foi possível carregar o cartão. Recarregue a página.") })
      .finally(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
  }, [id])

  return (
    <PaginaFormulario titulo="Editar cartão" carregando={carregando} erroCarga={erroCarga}>
      {cartao && (
        <FormularioCartao cartao={cartao} bancos={bancos} contas={contas}
          aoSair={() => navigate(voltarPara, { replace: true })}
          aoSalvo={() => navigate(voltarPara, { replace: true })} />
      )}
    </PaginaFormulario>
  )
}
