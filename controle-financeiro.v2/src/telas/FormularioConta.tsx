// Formulário da conta (nova e editar — o mesmo): tipo (corrente / poupança / investimentos / dinheiro),
// nome, banco, agência e número (dinheiro não tem nada disso); na nova, saldo inicial e desde quando.
// Prévia ao lado igual à linha da lista. Regras iguais às do
// servidor: nome ≤ 100, agência só números (até 10), número só números com dígito opcional depois do
// hífen, saldo inicial nunca negativo e data nunca futura.
import { useMemo, useState } from "react"
import { createConta, updateConta } from "../services/contaService"
import { mensagemDeErro } from "../api/cliente"
import type { Banco } from "../types/Banco"
import type { Conta } from "../types/Conta"
import Bloco from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import { Dinheiro } from "../componentes/Dinheiro"
import Entrada from "../componentes/Entrada"
import EntradaValor from "../componentes/EntradaValor"
import Formulario, { Campos, Lado, LinhaCampos, RodapeFormulario } from "../componentes/Formulario"
import LogoMarca from "../componentes/LogoMarca"
import Segmentos from "../componentes/Segmentos"
import Selecao from "../componentes/Selecao"
import SeletorData from "../componentes/SeletorData"
import { AGENCIA, MAX_NOME_CONTA, NUMERO_CONTA, TIPOS_CONTA, TIPO_CONTA, descreverConta, temDadosBancarios } from "../dominio/conta"
import { parseMoney } from "../utils/money"
import { dataLocalISO } from "../utils/dateTime"
import styles from "./FormularioConta.module.css"

type Erros = Partial<Record<"nome" | "agencia" | "numero" | "data", string>>

export default function FormularioConta({ conta, bancos, aoSair, aoSalvo }: {
  /** Com conta = editar; sem = nova. */
  conta?: Conta
  bancos: Banco[]
  aoSair: () => void
  /** Recebe o id da conta salva (a nova ou a mesma). */
  aoSalvo: (id: string) => void
}) {
  const c = conta ?? null
  const hoje = dataLocalISO()
  const [nome, setNome] = useState(c?.nome ?? "")
  const [bancoId, setBancoId] = useState(c?.bancoId ?? "")
  const [tipo, setTipo] = useState(String(TIPOS_CONTA.some((t) => t.valor === String(c?.tipo)) ? c!.tipo : TIPO_CONTA.corrente))
  const [agencia, setAgencia] = useState(c?.agencia ?? "")
  const [numero, setNumero] = useState(c?.numeroConta ?? "")
  const [saldoInicial, setSaldoInicial] = useState("")
  const [desde, setDesde] = useState(hoje)
  const [erros, setErros] = useState<Erros>({})
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const limpa = (...chaves: (keyof Erros)[]) => setErros((e) => { const n = { ...e }; for (const k of chaves) delete n[k]; return n })

  const banco = useMemo(() => bancos.find((b) => b.id === bancoId), [bancos, bancoId])
  const opcoesBanco = useMemo(() => [{ valor: "", rotulo: "Sem banco" },
    ...bancos.slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((b) => ({ valor: b.id, rotulo: b.nome }))], [bancos])
  const saldo = parseMoney(saldoInicial)
  // Dinheiro (cofrinho, caixa de casa) não tem banco, agência nem número — os campos somem e não vão.
  const bancario = temDadosBancarios(Number(tipo))
  const exemplo = TIPOS_CONTA.find((t) => t.valor === tipo)?.exemplo ?? "Nubank"

  const validar = (): Erros => {
    const e: Erros = {}
    if (!nome.trim()) e.nome = "Dê um nome à conta."
    else if (nome.trim().length > MAX_NOME_CONTA) e.nome = `No máximo ${MAX_NOME_CONTA} caracteres.`
    if (bancario && agencia && !AGENCIA.test(agencia)) e.agencia = "Só números, até 10."
    if (bancario && numero && !NUMERO_CONTA.test(numero)) e.numero = "Só números, com o dígito depois do hífen (ex.: 12345-6)."
    if (!c && saldo > 0 && desde > hoje) e.data = "Não pode ser no futuro."
    return e
  }

  const enviar = async () => {
    const e = validar()
    setErros(e)
    if (Object.keys(e).length > 0) return
    setSalvando(true); setErro(null)
    const base = {
      nome: nome.trim(), tipo: Number(tipo), isCarteira: false,
      bancoId: bancario && bancoId ? bancoId : undefined, agencia: bancario && agencia ? agencia : undefined, numeroConta: bancario && numero ? numero : undefined,
    }
    try {
      if (c) { await updateConta(c.id, base); aoSalvo(c.id) }
      else {
        const nova = await createConta({ ...base, saldoInicial: saldo > 0 ? saldo : undefined, dataSaldoInicial: saldo > 0 ? desde : undefined })
        aoSalvo(nova.id)
      }
    } catch (err) {
      setErro(mensagemDeErro(err)); setSalvando(false)
    }
  }

  return (
    <Formulario layout="lateral" onSubmit={() => { void enviar() }}>
      <Campos>
        {erro && <p className={styles.alerta} role="alert">{erro}</p>}
        <Campo rotulo="Tipo" grupo>
          <Segmentos ariaLabel="Tipo" cheio valor={tipo} onChange={(v) => { setTipo(v); limpa("agencia", "numero") }}
            opcoes={TIPOS_CONTA.map((t) => ({ valor: t.valor, rotulo: t.curto }))} />
        </Campo>
        <Campo rotulo="Nome" erro={erros.nome}>
          <Entrada value={nome} maxLength={MAX_NOME_CONTA} placeholder={exemplo} autoFocus={!c}
            onChange={(e) => { setNome(e.target.value); limpa("nome") }} />
        </Campo>
        {bancario && (
          <>
            <Campo rotulo="Banco">
              <Selecao valor={bancoId} placeholder="Sem banco" onChange={setBancoId} opcoes={opcoesBanco} />
            </Campo>
            <LinhaCampos>
              <Campo rotulo="Agência (opcional)" erro={erros.agencia}>
                <Entrada inputMode="numeric" maxLength={10} placeholder="0001" value={agencia}
                  onChange={(e) => { setAgencia(e.target.value.replace(/\D/g, "")); limpa("agencia") }} />
              </Campo>
              <Campo rotulo="Número (opcional)" erro={erros.numero}>
                <Entrada inputMode="numeric" maxLength={33} placeholder="12345-6" value={numero}
                  onChange={(e) => { setNumero(e.target.value.replace(/[^\d-]/g, "")); limpa("numero") }} />
              </Campo>
            </LinhaCampos>
          </>
        )}
        {!c && (
          <LinhaCampos colunas="2fr 1fr">
            <Campo rotulo="Saldo hoje (opcional)">
              <EntradaValor valor={saldoInicial} tom="neutro" onChange={setSaldoInicial} />
            </Campo>
            <Campo rotulo="Desde" erro={erros.data}>
              <SeletorData valor={desde} max={hoje} onChange={(x) => { setDesde(x); limpa("data") }} />
            </Campo>
          </LinhaCampos>
        )}
      </Campos>

      <Lado>
        <Bloco titulo="Como vai aparecer" className={styles.previa}>
          <div className={styles.previaLinha}>
            <LogoMarca nome={(bancario && banco?.nome) || nome || "?"} logoUrl={bancario ? banco?.logoUrl : undefined} cor={bancario ? banco?.cor : undefined} tamanho={36} />
            <span className={styles.previaTexto}>
              <span className={styles.previaNome} data-vazio={nome.trim() ? undefined : "true"}>{nome.trim() || "Nome da conta"}</span>
              <span className={styles.previaDetalhe}>{descreverConta({ tipo: Number(tipo), agencia, numeroConta: numero, isCarteira: false })}</span>
            </span>
            {!c && <Dinheiro valor={saldo} className={styles.previaValor} />}
          </div>
        </Bloco>
        <RodapeFormulario>
          <Botao onClick={aoSair} disabled={salvando}>Cancelar</Botao>
          <Botao variante="primario" type="submit" disabled={salvando}>{salvando ? "Salvando…" : c ? "Salvar" : "Adicionar conta"}</Botao>
        </RodapeFormulario>
      </Lado>
    </Formulario>
  )
}
