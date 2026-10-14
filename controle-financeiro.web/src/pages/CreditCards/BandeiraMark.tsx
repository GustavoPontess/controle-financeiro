import { CreditCard } from "lucide-react"
// Logos reais das bandeiras — vendorizados localmente (Apache-2.0, ver src/assets/bandeiras/LICENSE.txt),
// sem dependência de runtime pra 6 arquivos estáticos.
import visaLogo from "@/assets/bandeiras/visa.svg"
import mastercardLogo from "@/assets/bandeiras/mastercard.svg"
import eloLogo from "@/assets/bandeiras/elo.svg"
import hipercardLogo from "@/assets/bandeiras/hipercard.svg"
import amexLogo from "@/assets/bandeiras/amex.svg"

// Logo oficial real da bandeira — mesmo princípio já usado pro logo do banco
// (PontesBankBadge): marca de verdade, não abstração nossa. "Outros" não tem
// logo (não é uma bandeira real) — usa o ícone genérico de cartão.
const BANDEIRA_LOGO: Record<number, string> = {
  1: visaLogo, 2: mastercardLogo, 3: eloLogo, 4: hipercardLogo, 5: amexLogo,
}
export default function BandeiraMark({ bandeira, width = 46, genericColor = "#fff" }: { bandeira: number; width?: number; genericColor?: string }) {
  const logo = BANDEIRA_LOGO[bandeira]
  if (!logo) return <CreditCard size={Math.round(width * 0.5)} color={genericColor} strokeWidth={2} />
  return <img src={logo} alt="" width={width} style={{ display: "block", borderRadius: 4 }} />
}
