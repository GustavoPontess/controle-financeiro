// Editar conta do v2 — carrega a conta e os bancos e entrega pro FormularioConta (o mesmo da nova).
// Carteira e conta encerrada não se editam (o servidor também recusa a carteira).
import { useEffect, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { getConta } from "../services/contaService"
import { getBancos } from "../services/bancoService"
import type { Banco } from "../types/Banco"
import type { Conta } from "../types/Conta"
import { PaginaFormulario } from "../componentes/Formulario"
import FormularioConta from "./FormularioConta"

export default function EditarConta() {
  const { id = "" } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const voltarPara = (location.state as { voltarPara?: string } | null)?.voltarPara ?? "/bancos"
  const [conta, setConta] = useState<Conta | null>(null)
  const [bancos, setBancos] = useState<Banco[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    Promise.all([getConta(id), getBancos()])
      .then(([c, b]) => {
        if (!vivo) return
        if (c.isCarteira) { setErroCarga("A carteira não se edita."); return }
        if (c.encerradaEm) { setErroCarga("Conta encerrada não se edita — reabra antes."); return }
        setConta(c); setBancos(b)
      })
      .catch(() => { if (vivo) setErroCarga("Não foi possível carregar a conta. Recarregue a página.") })
      .finally(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
  }, [id])

  return (
    <PaginaFormulario titulo="Editar conta" carregando={carregando} erroCarga={erroCarga}>
      {conta && <FormularioConta conta={conta} bancos={bancos} aoSair={() => navigate(voltarPara, { replace: true, state: { abrir: id } })} aoSalvo={() => navigate(voltarPara, { replace: true, state: { abrir: id } })} />}
    </PaginaFormulario>
  )
}
