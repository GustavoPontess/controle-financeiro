// A "carinha" do cartão: um retângulo pequeno na cor do banco com a marca da bandeira. Logos reais das
// bandeiras (Apache-2.0, ver assets/bandeiras/LICENSE.txt); "Outra" usa o ícone genérico.
import { CreditCard } from "lucide-react"
import visa from "../assets/bandeiras/visa.svg"
import mastercard from "../assets/bandeiras/mastercard.svg"
import elo from "../assets/bandeiras/elo.svg"
import hipercard from "../assets/bandeiras/hipercard.svg"
import amex from "../assets/bandeiras/amex.svg"
import styles from "./FaceCartao.module.css"

const LOGO: Record<number, string> = { 1: visa, 2: mastercard, 3: elo, 4: hipercard, 5: amex }

export default function FaceCartao({ bandeira, cor, tamanho = "md" }: {
  bandeira: number
  /** Cor do banco (dado do cartão, valor de runtime). Sem cor: tinta. */
  cor?: string | null
  /** md = 64×40 (linha da lista) · lg = 96×60 (cabeçalho do cartão) */
  tamanho?: "md" | "lg"
}) {
  const logo = LOGO[bandeira]
  return (
    <span className={styles.face} data-tamanho={tamanho} style={cor ? { background: cor } : undefined} aria-hidden="true">
      {logo ? <img src={logo} alt="" className={styles.logo} /> : <CreditCard size={tamanho === "lg" ? 28 : 20} strokeWidth={2} />}
    </span>
  )
}
