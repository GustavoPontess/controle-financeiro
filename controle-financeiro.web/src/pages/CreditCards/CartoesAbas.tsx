// Abas do topo de Cartões: parcelamento é do cartão (o Pix no crédito fora do cartão é empréstimo),
// então a lista de parcelamentos mora aqui dentro em vez de ter item próprio no menu.
import { useLocation, useNavigate } from "react-router-dom"
import { PontesTabs } from "@/components/pontes"

type Aba = "/credit-cards" | "/credit-cards/parcelamentos"

const ABAS: { value: Aba; label: string }[] = [
  { value: "/credit-cards", label: "Cartões" },
  { value: "/credit-cards/parcelamentos", label: "Parcelamentos" },
]

export default function CartoesAbas() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const atual: Aba = pathname.startsWith("/credit-cards/parcelamentos") ? "/credit-cards/parcelamentos" : "/credit-cards"
  return <PontesTabs variant="underline" options={ABAS} value={atual} onChange={(v) => navigate(v)} />
}
