import { useNavigate, useParams, Navigate } from "react-router-dom"
import { FamiliaDetalhe } from "./FamiliaDetalhe"

/** Rota /familias/:id — casca fina que injeta o id e o "voltar" no componente de detalhe. */
export default function FamiliaDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  if (!id) return <Navigate to="/familias" replace />
  return <FamiliaDetalhe familiaId={id} showBack onClose={() => navigate("/familias")} />
}
