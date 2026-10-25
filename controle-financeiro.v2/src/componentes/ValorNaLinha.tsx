// Valor editável na própria linha da Planilha: parece um valor; clica, digita, Enter salva, Esc desiste (sair do
// campo também salva). Sem valor, mostra `rotuloVazio` como um link ("Planejar"). `aceitaZero` = dá pra zerar
// (ex.: renda variável); senão, vazio ou zero desiste.
import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react"
import { Dinheiro } from "./Dinheiro"
import EntradaValor from "./EntradaValor"
import { moneyParaCampo, parseMoney } from "../utils/money"
import styles from "./ValorNaLinha.module.css"

export default function ValorNaLinha({ valor, rotulo, editavel = true, editando, ocupado, rotuloVazio, aceitaZero, aoEditar, aoCancelar, aoSalvar }: {
  valor: number
  /** Nome acessível do botão e do campo (ex.: "Mudar o planejado de Mercado"). */
  rotulo: string
  editavel?: boolean
  editando: boolean
  ocupado?: boolean
  rotuloVazio?: string
  aceitaZero?: boolean
  aoEditar: () => void
  aoCancelar: () => void
  aoSalvar: (valor: number) => void
}) {
  const [texto, setTexto] = useState("")
  useEffect(() => { if (editando) setTexto(valor > 0 ? moneyParaCampo(valor) : "") }, [editando, valor])
  if (!editavel) return <Dinheiro valor={valor} />
  if (!editando) return (
    <button type="button" className={styles.valor} data-vazio={valor > 0 || !rotuloVazio ? undefined : "true"} onClick={aoEditar} aria-label={rotulo}>
      {valor > 0 || !rotuloVazio ? <Dinheiro valor={valor} /> : rotuloVazio}
    </button>
  )
  const enviar = (e?: FormEvent) => {
    e?.preventDefault()
    const v = texto.trim() ? parseMoney(texto) : 0
    if ((!aceitaZero && !(v > 0)) || v === valor) { aoCancelar(); return }
    aoSalvar(v)
  }
  const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") aoCancelar() }
  return (
    <form className={styles.edicao} onSubmit={enviar} onKeyDown={tecla} aria-label={rotulo} aria-busy={ocupado || undefined}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) enviar() }}>
      <EntradaValor compacto autoFocus valor={texto} onChange={setTexto} />
    </form>
  )
}
