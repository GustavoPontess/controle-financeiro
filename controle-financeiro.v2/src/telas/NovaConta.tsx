// Nova conta do v2 — carrega os bancos e entrega pro FormularioConta (o mesmo da edição). Salvou → página da conta.
import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { getBancos } from "../services/bancoService"
import type { Banco } from "../types/Banco"
import { PaginaFormulario } from "../componentes/Formulario"
import FormularioConta from "./FormularioConta"

export default function NovaConta() {
  const navigate = useNavigate()
  const location = useLocation()
  const voltarPara = (location.state as { voltarPara?: string } | null)?.voltarPara ?? "/bancos"
  const [bancos, setBancos] = useState<Banco[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga] = useState(false)

  useEffect(() => {
    let vivo = true
    getBancos().then((b) => { if (vivo) setBancos(b) }).catch(() => { if (vivo) setErroCarga(true) }).finally(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
  }, [])

  return (
    <PaginaFormulario titulo="Nova conta" carregando={carregando} erroCarga={erroCarga ? "Não foi possível carregar os bancos. Recarregue a página." : null}>
      <FormularioConta bancos={bancos} aoSair={() => navigate(voltarPara, { replace: true })}
        aoSalvo={(id) => navigate(`/bancos/${id}`, { replace: true })} />
    </PaginaFormulario>
  )
}
