// Formulário do cartão (novo e editar — o mesmo): nome, bandeira e dígitos, banco e conta vinculada,
// funções (crédito / débito / pré-pago) e, no crédito, limite + dias de fechamento e vencimento.
// Prévia ao lado igual à linha da lista. Regras iguais às do servidor: nome ≤ 100, dígitos = 4 números,
// limite > 0 e dias de 1 a 28 quando tem crédito; pré-pago não tem conta vinculada.
import { useMemo, useState } from "react"
import { createCartao, updateCartao } from "../services/cartaoCreditoService"
import { mensagemDeErro } from "../api/cliente"
import type { Banco } from "../types/Banco"
import type { Conta } from "../types/Conta"
import type { CartaoCredito, CriarCartaoCredito } from "../types/CartaoCredito"
import Bloco from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import Entrada from "../componentes/Entrada"
import EntradaValor from "../componentes/EntradaValor"
import Etiqueta from "../componentes/Etiqueta"
import FaceCartao from "../componentes/FaceCartao"
import Formulario, { Campos, Lado, LinhaCampos, RodapeFormulario } from "../componentes/Formulario"
import Interruptor from "../componentes/Interruptor"
import Selecao from "../componentes/Selecao"
import { NOME_BANDEIRA } from "../dominio/fatura"
import { formatMoney, moneyParaCampo, parseMoney } from "../utils/money"
import styles from "./FormularioCartao.module.css"

const MAX_NOME = 100
const BANDEIRAS = Object.entries(NOME_BANDEIRA).map(([valor, rotulo]) => ({ valor, rotulo }))
/** O servidor só aceita 1–28 (todo mês tem). */
const DIAS = Array.from({ length: 28 }, (_, i) => ({ valor: String(i + 1), rotulo: `Dia ${i + 1}` }))

type Erros = Partial<Record<"nome" | "digitos" | "funcoes" | "limite" | "fecha" | "vence", string>>

export default function FormularioCartao({ cartao, bancos, contas, aoSair, aoSalvo }: {
  /** Com cartão = editar; sem = novo. */
  cartao?: CartaoCredito
  bancos: Banco[]
  contas: Conta[]
  aoSair: () => void
  /** Recebe o id do cartão salvo (o novo ou o mesmo). */
  aoSalvo: (id: string) => void
}) {
  const c = cartao ?? null
  const [nome, setNome] = useState(c?.nome ?? "")
  const [digitos, setDigitos] = useState(c?.ultimosDigitos ?? "")
  const [bandeira, setBandeira] = useState(String(c?.bandeira ?? 6))
  const [bancoId, setBancoId] = useState(c?.bancoId ?? "")
  const [contaId, setContaId] = useState(c?.contaId ?? "")
  const [credito, setCredito] = useState(c?.temCredito ?? true)
  const [debito, setDebito] = useState(c?.temDebito ?? false)
  const [prePago, setPrePago] = useState(c?.ehPrePago ?? false)
  const [limite, setLimite] = useState(c?.limite ? moneyParaCampo(c.limite) : "")
  const [fecha, setFecha] = useState(c?.diaFechamento ? String(c.diaFechamento) : "")
  const [vence, setVence] = useState(c?.diaVencimento ? String(c.diaVencimento) : "")
  const [erros, setErros] = useState<Erros>({})
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const limpa = (...chaves: (keyof Erros)[]) => setErros((e) => { const n = { ...e }; for (const k of chaves) delete n[k]; return n })

  const banco = useMemo(() => bancos.find((b) => b.id === bancoId), [bancos, bancoId])
  const limiteNum = parseMoney(limite)

  const validar = (): Erros => {
    const e: Erros = {}
    if (!nome.trim()) e.nome = "Dê um nome ao cartão."
    else if (nome.trim().length > MAX_NOME) e.nome = `No máximo ${MAX_NOME} caracteres.`
    if (digitos && !/^\d{4}$/.test(digitos)) e.digitos = "São os 4 últimos números do cartão."
    if (!credito && !debito) e.funcoes = "Marque crédito, débito ou os dois."
    if (credito) {
      if (!(limiteNum > 0)) e.limite = "Informe o limite do cartão."
      if (!fecha) e.fecha = "Escolha o dia."
      if (!vence) e.vence = "Escolha o dia."
    }
    return e
  }

  const enviar = async () => {
    const e = validar()
    setErros(e)
    if (Object.keys(e).length > 0) return
    setSalvando(true); setErro(null)
    const dto: CriarCartaoCredito = {
      nome: nome.trim(),
      ultimosDigitos: digitos || undefined,
      bandeira: Number(bandeira),
      temCredito: credito, temDebito: debito, ehPrePago: prePago,
      limite: credito ? limiteNum : undefined,
      diaFechamento: credito ? Number(fecha) : undefined,
      diaVencimento: credito ? Number(vence) : undefined,
      contaId: prePago ? undefined : (contaId || undefined),
      bancoId: bancoId || undefined,
    }
    try {
      if (c) { await updateCartao(c.id, dto); aoSalvo(c.id) }
      else { const novo = await createCartao(dto); aoSalvo(novo.id) }
    } catch (err) {
      setErro(mensagemDeErro(err)); setSalvando(false)
    }
  }

  return (
    <Formulario layout="lateral" onSubmit={() => { void enviar() }}>
      <Campos>
        {erro && <p className={styles.alerta} role="alert">{erro}</p>}

        <Campo rotulo="Nome" erro={erros.nome}>
          <Entrada value={nome} maxLength={MAX_NOME} placeholder="Nubank" autoFocus={!c}
            onChange={(e) => { setNome(e.target.value); limpa("nome") }} />
        </Campo>
        <LinhaCampos>
          <Campo rotulo="Bandeira">
            <Selecao valor={bandeira} onChange={setBandeira} opcoes={BANDEIRAS} />
          </Campo>
          <Campo rotulo="Últimos 4 dígitos (opcional)" erro={erros.digitos}>
            <Entrada inputMode="numeric" maxLength={4} placeholder="1234" value={digitos}
              onChange={(e) => { setDigitos(e.target.value.replace(/\D/g, "")); limpa("digitos") }} />
          </Campo>
        </LinhaCampos>
        <LinhaCampos>
          <Campo rotulo="Banco">
            <Selecao valor={bancoId} placeholder="Sem banco" onChange={setBancoId}
              opcoes={[{ valor: "", rotulo: "Sem banco" }, ...bancos.map((b) => ({ valor: b.id, rotulo: b.nome }))]} />
          </Campo>
          {!prePago && (
            <Campo rotulo="Conta vinculada">
              <Selecao valor={contaId} placeholder="Nenhuma" onChange={setContaId} desabilitado={contas.length === 0}
                opcoes={[{ valor: "", rotulo: "Nenhuma" }, ...contas.map((x) => ({ valor: x.id, rotulo: x.nome }))]} />
            </Campo>
          )}
        </LinhaCampos>

        <Campo rotulo="Funções" grupo erro={erros.funcoes}>
          <div className={styles.funcoes}>
            <Interruptor ligado={credito} onChange={(on) => { setCredito(on); limpa("funcoes", "limite", "fecha", "vence") }}>Crédito</Interruptor>
            <Interruptor ligado={debito} onChange={(on) => { setDebito(on); limpa("funcoes") }}>Débito</Interruptor>
            <Interruptor ligado={prePago} onChange={setPrePago}>Pré-pago</Interruptor>
          </div>
        </Campo>

        {credito && (
          <LinhaCampos colunas="2fr 1fr 1fr">
            <Campo rotulo="Limite" erro={erros.limite}>
              <EntradaValor valor={limite} tom="neutro" onChange={(x) => { setLimite(x); limpa("limite") }} />
            </Campo>
            <Campo rotulo="Fecha" erro={erros.fecha}>
              <Selecao valor={fecha} placeholder="Dia" onChange={(x) => { setFecha(x); limpa("fecha") }} opcoes={DIAS} />
            </Campo>
            <Campo rotulo="Vence" erro={erros.vence}>
              <Selecao valor={vence} placeholder="Dia" onChange={(x) => { setVence(x); limpa("vence") }} opcoes={DIAS} />
            </Campo>
          </LinhaCampos>
        )}
      </Campos>

      <Lado>
        <PreviaCartao nome={nome} bandeira={Number(bandeira)} cor={banco?.cor} digitos={digitos}
          credito={credito} prePago={prePago} fecha={fecha} vence={vence} limite={limiteNum} />
        <RodapeFormulario>
          <Botao onClick={aoSair} disabled={salvando}>Cancelar</Botao>
          <Botao variante="primario" type="submit" disabled={salvando}>{salvando ? "Salvando…" : c ? "Salvar" : "Adicionar cartão"}</Botao>
        </RodapeFormulario>
      </Lado>
    </Formulario>
  )
}

/** "Como vai aparecer": a carinha + a linha da lista de Cartões, com o que já foi preenchido. */
function PreviaCartao({ nome, bandeira, cor, digitos, credito, prePago, fecha, vence, limite }: {
  nome: string; bandeira: number; cor?: string | null; digitos: string
  credito: boolean; prePago: boolean; fecha: string; vence: string; limite: number
}) {
  const n = nome.trim()
  const detalhe = [
    NOME_BANDEIRA[bandeira] ?? "Cartão",
    digitos ? `•••• ${digitos}` : null,
    credito && fecha ? `fecha dia ${fecha}` : null,
    credito && vence ? `vence dia ${vence}` : null,
  ].filter(Boolean).join(" · ")
  return (
    <Bloco titulo="Como vai aparecer" className={styles.previa}>
      <div className={styles.previaLinha}>
        <FaceCartao bandeira={bandeira} cor={cor} ultimosDigitos={digitos} tamanho="lg" />
        <span className={styles.previaTexto}>
          <span className={styles.previaNome} data-vazio={n ? undefined : "true"}>{n || "Nome do cartão"}</span>
          <span className={styles.previaDetalhe}>{detalhe}</span>
          {credito && limite > 0 && <span className={styles.previaDetalhe}>limite {formatMoney(limite)}</span>}
        </span>
      </div>
      {(!credito || prePago) && (
        <div className={styles.etiquetas}>
          {!credito && <Etiqueta>Só débito</Etiqueta>}
          {prePago && <Etiqueta>Pré-pago</Etiqueta>}
        </div>
      )}
    </Bloco>
  )
}
