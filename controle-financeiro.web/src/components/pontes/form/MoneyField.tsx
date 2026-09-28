/**
 * MoneyField — campo de DINHEIRO de formulário (mesma altura/visual do PontesInput, prefixo "R$").
 * O `PontesMoneyInput` é o campo grande de destaque; em formulário comum use este.
 *
 * Acaba com o parser de dinheiro de cada tela (havia 7, um deles gravava "1.500" como R$ 1,50):
 * digitar só acumula dígitos como centavos ("150000" → 1.500,00), então não existe ponto/vírgula
 * ambíguo nem valor negativo. Valor numérico entra e sai (`number | undefined`).
 */

import { forwardRef } from "react"
import { PontesInput, type PontesInputProps } from "./Input"
import { formatarCampoDinheiro, lerCampoDinheiro, lerColagemDinheiro } from "./moneyFieldFormat"

export type PontesMoneyFieldProps = Omit<PontesInputProps, "value" | "onChange" | "inputMode" | "iconStart" | "type"> & {
  value: number | undefined
  onChange: (valor: number | undefined) => void
}

export const PontesMoneyField = forwardRef<HTMLInputElement, PontesMoneyFieldProps>(function PontesMoneyField(
  { value, onChange, placeholder = "0,00", ...rest }, ref,
) {
  return (
    <PontesInput
      ref={ref}
      {...rest}
      iconStart="R$"
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      value={formatarCampoDinheiro(value)}
      onChange={(e) => onChange(lerCampoDinheiro(e.target.value))}
      // Colar "1.500" é R$ 1.500,00 (valor escrito), não 15,00 (dígitos de centavo).
      onPaste={(e) => {
        const v = lerColagemDinheiro(e.clipboardData.getData("text"))
        if (v === undefined) return
        e.preventDefault()
        onChange(v)
      }}
    />
  )
})
