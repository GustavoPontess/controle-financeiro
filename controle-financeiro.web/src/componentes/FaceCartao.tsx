// A "carinha" do cartão: um cartão de verdade em miniatura — proporção de cartão (1,6:1), chip no canto,
// bandeira embaixo à direita, a cor do banco como plástico e, no tamanho grande, os últimos dígitos.
// Logos reais das bandeiras (Apache-2.0, ver assets/bandeiras/LICENSE.txt); "Outra" usa o ícone genérico.
import { CreditCard } from "lucide-react"
import visa from "../assets/bandeiras/visa.svg"
import mastercard from "../assets/bandeiras/mastercard.svg"
import elo from "../assets/bandeiras/elo.svg"
import hipercard from "../assets/bandeiras/hipercard.svg"
import amex from "../assets/bandeiras/amex.svg"
import styles from "./FaceCartao.module.css"

const LOGO: Record<number, string> = { 1: visa, 2: mastercard, 3: elo, 4: hipercard, 5: amex }

export default function FaceCartao({ bandeira, cor, ultimosDigitos, tamanho = "md" }: {
  bandeira: number
  /** Cor do banco (dado do cartão, valor de runtime). Sem cor: tinta. */
  cor?: string | null
  /** Aparece só no tamanho grande (no pequeno não dá pra ler). */
  ultimosDigitos?: string | null
  /** md = 72×45 (linha da lista) · lg = 112×70 (cabeçalho do cartão) */
  tamanho?: "md" | "lg"
}) {
  const logo = LOGO[bandeira]
  return (
    <span className={styles.face} data-tamanho={tamanho} style={cor ? { background: cor } : undefined} aria-hidden="true">
      <span className={styles.chip} />
      {tamanho === "lg" && ultimosDigitos && <span className={styles.digitos}>•••• {ultimosDigitos}</span>}
      {logo ? <img src={logo} alt="" className={styles.logo} /> : <CreditCard size={tamanho === "lg" ? 22 : 14} strokeWidth={2} className={styles.generico} />}
    </span>
  )
}
