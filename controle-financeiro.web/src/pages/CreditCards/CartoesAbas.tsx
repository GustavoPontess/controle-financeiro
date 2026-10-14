// Abas do topo de Cartões: parcelamento é do cartão (o Pix no crédito fora do cartão é empréstimo),
// então a lista de parcelamentos mora aqui dentro em vez de ter item próprio no menu.
// Dentro da bancada de layout (/credit-cards/lab-x) as abas ficam NA variante: Cartões e Parcelamentos
// de cada layout são uma coisa só.
import { useLocation, useNavigate } from "react-router-dom"
import { PontesTabs } from "@/components/pontes"

type Aba = "cartoes" | "parcelamentos"

/** Base das abas: a variante da bancada (/credit-cards/lab-a) ou a tela real (/credit-cards). */
const baseDe = (pathname: string) => pathname.match(/^\/credit-cards\/lab-[a-z]+/)?.[0] ?? "/credit-cards"

export default function CartoesAbas() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const base = baseDe(pathname)
  const atual: Aba = pathname.startsWith(`${base}/parcelamentos`) ? "parcelamentos" : "cartoes"
  return (
    <PontesTabs<Aba> variant="underline" value={atual}
      options={[{ value: "cartoes", label: "Cartões" }, { value: "parcelamentos", label: "Parcelamentos" }]}
      onChange={(v) => navigate(v === "parcelamentos" ? `${base}/parcelamentos` : base)} />
  )
}
