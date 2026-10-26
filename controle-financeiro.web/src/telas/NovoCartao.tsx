// Novo cartão do v2 — a casca da tela: carrega bancos e contas e entrega pro FormularioCartao (o mesmo
// da edição). Salvou → vai pra página do cartão novo.
import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { getBancos } from "../services/bancoService"
import { getContas } from "../services/contaService"
import type { Banco } from "../types/Banco"
import type { Conta } from "../types/Conta"
import { PaginaFormulario } from "../componentes/Formulario"
import FormularioCartao from "./FormularioCartao"

export default function NovoCartao() {
  const navigate = useNavigate()
  const location = useLocation()
  const voltarPara = (location.state as { voltarPara?: string } | null)?.voltarPara ?? "/cartoes"
  const [bancos, setBancos] = useState<Banco[]>([])
  const [contas, setContas] = useState<Conta[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga] = useState(false)

  useEffect(() => {
    let vivo = true
    Promise.all([getBancos(), getContas()])
      .then(([bs, cs]) => { if (!vivo) return; setBancos(bs); setContas(cs) })
      .catch(() => { if (vivo) setErroCarga(true) })
      .finally(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
  }, [])

  return (
    <PaginaFormulario titulo="Novo cartão" carregando={carregando}
      erroCarga={erroCarga ? "Não foi possível carregar bancos e contas. Recarregue a página." : null}>
      <FormularioCartao bancos={bancos} contas={contas}
        aoSair={() => navigate(voltarPara, { replace: true })}
        aoSalvo={(id) => navigate(`/cartoes/${id}`, { replace: true })} />
    </PaginaFormulario>
  )
}
