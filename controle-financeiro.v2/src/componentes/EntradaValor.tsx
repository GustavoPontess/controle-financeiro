// Valor em destaque (R$ grande, só a linha de baixo) — o campo principal de lançar dinheiro.
// Dígitos viram centavos ("690" → "6,90"); nunca negativo (não aceita sinal); até 12 dígitos
// (R$ 9.999.999.999,99). Dentro de um Campo, herda id e erro.
import { maskMoney } from "../utils/money"
import { useCampo } from "./campoContexto"
import styles from "./EntradaValor.module.css"

const MAX_DIGITOS = 12

export default function EntradaValor({ valor, onChange, autoFocus, tom }: {
  /** Texto já mascarado ("1.234,56") ou "" */
  valor: string
  onChange: (valor: string) => void
  autoFocus?: boolean
  /** Cor do número digitado: negativo (despesa), positivo (receita), neutro (transferência). */
  tom?: "positivo" | "negativo" | "neutro"
}) {
  const campo = useCampo()
  const inv = campo?.invalido ?? false
  return (
    <span className={styles.moldura} data-invalido={inv || undefined} data-tom={tom}>
      <em aria-hidden="true">R$</em>
      <input id={campo?.id} inputMode="numeric" autoComplete="off" placeholder="0,00" value={valor} autoFocus={autoFocus}
        aria-invalid={inv || undefined} aria-describedby={inv && campo ? campo.erroId : undefined}
        onChange={(e) => onChange(maskMoney(e.target.value.replace(/\D/g, "").slice(0, MAX_DIGITOS), valor))} />
    </span>
  )
}
