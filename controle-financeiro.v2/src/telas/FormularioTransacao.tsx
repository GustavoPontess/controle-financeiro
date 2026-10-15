// Formulário da transação — UM só pra criar e editar (senão os dois divergem). Duas colunas: campos à
// esquerda; à direita a prévia de como vai aparecer, as opções e os botões. Regras do app atual:
// - crédito só em despesa: escolhe o cartão; "Parcelado" abre o número de vezes;
// - parcelado não guarda hora (cada parcela cai numa fatura) e não anda junto com conta fixa;
// - conta fixa repete sozinha a partir da data de início; não tem hora nem subcategoria (o back não guarda);
// - data futura só no cartão, em conta fixa (início) ou como previsão (desligar "Já paguei");
// - transferência: entre duas contas diferentes, nunca no futuro;
// - conta fixa leva Idempotency-Key (nasce ao abrir a tela e vale pra toda tentativa: reenviar não cria duas).
// Editar: conta/cartão e tipo de compra no cartão não mudam (o back ignora) — aparecem fixos; sem
// transferência (a perna se exclui inteira), sem conta fixa/parcelado/"já paguei" (não se trocam na edição);
// lançamento sem hora pode continuar sem hora (PR #299).
import { useMemo, useState } from "react"
import { createTransaction, updateTransaction } from "../services/transactionService"
import { createTransferencia } from "../services/transferenciaService"
import { createRecorrente } from "../services/recorrenteService"
import { mensagemDeErro } from "../api/cliente"
import type { Transaction } from "../types/Transaction"
import type { Conta } from "../types/Conta"
import type { CartaoCredito } from "../types/CartaoCredito"
import type { Category } from "../types/Category"
import type { Subcategory } from "../types/Subcategory"
import Bloco from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Campo, { ValorFixo } from "../componentes/Campo"
import Entrada from "../componentes/Entrada"
import EntradaValor from "../componentes/EntradaValor"
import Etiqueta from "../componentes/Etiqueta"
import Formulario, { Campos, Lado, LinhaCampos, RodapeFormulario } from "../componentes/Formulario"
import Interruptor from "../componentes/Interruptor"
import PreviaLancamento from "../componentes/PreviaLancamento"
import Segmentos from "../componentes/Segmentos"
import Selecao from "../componentes/Selecao"
import SeletorData, { formatarData } from "../componentes/SeletorData"
import { FREQUENCIAS, MAX_DESCRICAO, MEIO, MEIOS_CONTA, MEIOS_PAGAMENTO, PARCELAS, TIPO, horaValida } from "../dominio/transacao"
import { formatMoney, moneyParaCampo, parseMoney } from "../utils/money"
import { dataLocalISO, horaLocalHHMM, mascararHora, somaDias } from "../utils/dateTime"
import styles from "./FormularioTransacao.module.css"

type Natureza = "despesa" | "receita" | "transferencia"
const NATUREZAS: { valor: Natureza; rotulo: string }[] = [
  { valor: "despesa", rotulo: "Despesa" },
  { valor: "receita", rotulo: "Receita" },
  { valor: "transferencia", rotulo: "Transferência" },
]
const centavos = (n: number) => Math.round(n * 100) / 100

export default function FormularioTransacao({ transacao, contas = [], cartoes = [], categorias, subcategorias, aoSair, aoSalvo }: {
  /** Com transação = editar; sem = nova. */
  transacao?: Transaction
  contas?: Conta[]
  cartoes?: CartaoCredito[]
  categorias: Category[]
  subcategorias: Subcategory[]
  aoSair: () => void
  aoSalvo: () => void
}) {
  const t = transacao ?? null
  const editando = !!t
  const horaOpcional = !!t && !t.hora

  const [natureza, setNatureza] = useState<Natureza>(t?.tipo === TIPO.receita ? "receita" : "despesa")
  const [valor, setValor] = useState(t ? moneyParaCampo(t.valor) : "")
  const [descricao, setDescricao] = useState(t?.descricao ?? "")
  const [meio, setMeio] = useState<number>(t ? (t.cartaoCreditoId ? MEIO.credito : t.meioPagamento ?? MEIO.pix) : MEIO.pix)
  const [contaId, setContaId] = useState(t?.contaId ?? "")
  const [cartaoId, setCartaoId] = useState(t?.cartaoCreditoId ?? "")
  const [parcelas, setParcelas] = useState(1)
  const [fixa, setFixa] = useState(false)
  const [frequencia, setFrequencia] = useState(2)
  const [dataFim, setDataFim] = useState("")
  const [efetivado, setEfetivado] = useState(t ? t.statusTransacao !== 0 : true)
  const [data, setData] = useState(() => t?.data ?? dataLocalISO())
  const [hora, setHora] = useState(() => (t ? (t.hora ? t.hora.slice(0, 5) : "") : horaLocalHHMM()))
  const [categoriaId, setCategoriaId] = useState(t?.categoriaId ?? "")
  const [subcategoriaId, setSubcategoriaId] = useState(t?.subcategoriaId ?? "")
  const [origemId, setOrigemId] = useState("")
  const [destinoId, setDestinoId] = useState("")
  const [erros, setErros] = useState<Record<string, string>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  // Idempotency-Key da conta fixa: uma por abertura da tela, reusada em toda tentativa.
  const [chaveFixa] = useState(() => crypto.randomUUID())

  const transferencia = natureza === "transferencia"
  const receita = natureza === "receita"
  const tipo = receita ? TIPO.receita : TIPO.despesa
  const credito = !transferencia && meio === MEIO.credito
  // Conta fixa e parcelado só ao criar (o interruptor lembra a escolha se a pessoa voltar da transferência).
  const ehFixa = !transferencia && !editando && fixa
  const parcelado = credito && !editando && !ehFixa && parcelas > 1
  const comHora = !ehFixa && !parcelado
  const hoje = dataLocalISO()
  const ontem = somaDias(hoje, -1)
  // Futuro só no cartão, como início de conta fixa ou como previsão.
  const dataMax = transferencia || (!credito && !ehFixa && efetivado) ? hoje : undefined

  const cats = useMemo(() => categorias.filter((c) => c.finalidade === 3 || c.finalidade === tipo), [categorias, tipo])
  const subs = useMemo(() => subcategorias.filter((s) => s.categoriaId === categoriaId), [subcategorias, categoriaId])
  const cartoesCredito = useMemo(() => cartoes.filter((c) => c.temCredito && c.ativo !== false), [cartoes])
  const opcoesConta = contas.map((c) => ({ valor: c.id, rotulo: c.nome }))
  const nomeConta = (id: string) => contas.find((c) => c.id === id)?.nome
  const nomeCartao = (id: string) => cartoesCredito.find((c) => c.id === id)?.nome

  const limpa = (...campos: string[]) => setErros((e) => {
    if (!campos.some((c) => e[c])) return e
    const n = { ...e }
    for (const c of campos) delete n[c]
    return n
  })

  const trocarNatureza = (n: Natureza) => {
    setNatureza(n)
    setErros({})
    if (n === "transferencia") return
    // Receita não usa cartão; categoria que não serve pro tipo novo cai fora.
    if (n === "receita" && meio === MEIO.credito) { setMeio(MEIO.pix); setParcelas(1) }
    const novoTipo = n === "receita" ? TIPO.receita : TIPO.despesa
    const atual = categorias.find((c) => c.id === categoriaId)
    if (atual && atual.finalidade !== 3 && atual.finalidade !== novoTipo) { setCategoriaId(""); setSubcategoriaId("") }
  }
  const trocarMeio = (m: number) => {
    setMeio(m)
    if (m !== MEIO.credito) setParcelas(1)
    limpa("conta", "cartao", "data")
  }
  const trocarFixa = (on: boolean) => {
    setFixa(on)
    if (on) { setParcelas(1); setSubcategoriaId("") }
    limpa("data", "hora")
  }
  const escolherData = (x: string) => { setData(x); limpa("data", "dataFim") }

  const validar = () => {
    const e: Record<string, string> = {}
    if (parseMoney(valor) <= 0) e.valor = "Informe um valor"
    if (!descricao.trim()) e.descricao = "Informe a descrição"
    if (transferencia) {
      if (!origemId) e.origem = "Escolha a conta de origem"
      if (!destinoId) e.destino = "Escolha a conta de destino"
      else if (destinoId === origemId) e.destino = "Origem e destino precisam ser contas diferentes"
    } else {
      if (!editando && credito && !cartaoId) e.cartao = "Escolha o cartão"
      if (!editando && !credito && !contaId) e.conta = "Escolha a conta"
      if (!categoriaId) e.categoria = "Escolha a categoria"
    }
    if (!data) e.data = "Informe a data"
    else if (dataMax && data > dataMax)
      e.data = transferencia ? "Transferência não pode ser no futuro" : editando ? "A data não pode ser futura" : `Data futura só como previsão: desligue "${receita ? "Já recebi" : "Já paguei"}"`
    if (comHora) {
      if (!hora) { if (!horaOpcional) e.hora = "Informe a hora" }
      else if (!horaValida(hora)) e.hora = "Hora inválida (HH:MM)"
    }
    if (ehFixa && dataFim && dataFim < data) e.dataFim = "Precisa ser depois do início"
    setErros(e)
    return Object.keys(e).length === 0
  }

  const enviar = async () => {
    setErro(null)
    if (!validar()) return
    setSalvando(true)
    const v = parseMoney(valor)
    const desc = descricao.trim()
    const horaEnvio = comHora && hora ? `${hora}:00` : null
    try {
      if (t) {
        await updateTransaction(t.id, {
          descricao: desc, valor: v,
          tipo: credito ? t.tipo : tipo,
          categoriaId: categoriaId || null,
          subcategoriaId: subcategoriaId || null,
          contaId: t.contaId,
          cartaoCreditoId: t.cartaoCreditoId,
          meioPagamento: credito ? t.meioPagamento : meio,
          data,
          hora: horaEnvio,
        })
      } else if (transferencia) {
        await createTransferencia({ contaOrigemId: origemId, contaDestinoId: destinoId, valor: v, data, hora: horaEnvio, descricao: desc })
      } else if (ehFixa) {
        await createRecorrente({
          descricao: desc, valor: v, tipo,
          categoriaId,
          contaId: credito ? undefined : contaId,
          cartaoCreditoId: credito ? cartaoId : undefined,
          frequencia,
          // O back gera pelas datas; "dia" é o dia do mês do início (lido do texto, sem fuso).
          dia: Number(data.slice(8, 10)),
          dataInicio: data,
          dataFim: dataFim || undefined,
        }, chaveFixa)
      } else {
        await createTransaction({
          descricao: desc, valor: v, tipo,
          categoriaId,
          subcategoriaId: subcategoriaId || null,
          contaId: credito ? undefined : contaId,
          cartaoCreditoId: credito ? cartaoId : undefined,
          usadoComoCredito: credito,
          meioPagamento: meio,
          parcelas: parcelado ? parcelas : undefined,
          // No cartão não existe "previsão": a compra vai pra fatura.
          efetivado: credito ? true : efetivado,
          data,
          hora: horaEnvio,
        })
      }
    } catch (e) {
      setErro(mensagemDeErro(e))
      setSalvando(false)
      return
    }
    aoSalvo()
  }

  // ── Prévia: como vai aparecer na lista + o que acontece ao salvar ───────────────────────────────
  const v = parseMoney(valor)
  const tom = transferencia ? "neutro" : receita ? "positivo" : "negativo"
  const origemNome = t ? (t.cartaoCreditoNome ?? t.contaNome) : credito ? nomeCartao(cartaoId) : nomeConta(contaId)
  const catNome = categorias.find((c) => c.id === categoriaId)?.descricao
  const meioRotulo = MEIOS_PAGAMENTO.find((m) => m.valor === meio)?.rotulo
  const detalhe = transferencia
    ? [nomeConta(origemId), nomeConta(destinoId)].filter(Boolean).join(" → ")
    : [origemNome, catNome, meioRotulo].filter(Boolean).join(" · ")
  const quando = (() => {
    const dia = data === hoje ? "hoje" : data === ontem ? "ontem" : `em ${formatarData(data)}`
    return comHora && horaValida(hora) ? `${dia} às ${hora}` : dia
  })()
  const efeito = (() => {
    if (transferencia) {
      const de = nomeConta(origemId), para = nomeConta(destinoId)
      return de && para ? `Sai de ${de} e entra em ${para} ${quando}.` : null
    }
    if (ehFixa) {
      const freq = FREQUENCIAS.find((f) => f.valor === frequencia)?.rotulo.toLowerCase()
      const onde = credito ? (origemNome ? ` Cada uma vai pra fatura do ${origemNome}.` : "") : origemNome ? ` ${receita ? "Entra no" : "Sai do"} ${origemNome}.` : ""
      return `Repete ${freq} a partir de ${formatarData(data)}${dataFim ? ` até ${formatarData(dataFim)}` : ""}.${onde}`
    }
    if (!origemNome) return null
    if (credito) return parcelado ? `${parcelas}x de ${formatMoney(centavos(v / parcelas))} nas próximas faturas do ${origemNome}.` : `${editando ? "Na" : "Vai pra"} fatura do ${origemNome}.`
    return efetivado ? `${receita ? "Entra no" : "Sai do"} ${origemNome} ${quando}.` : `Fica como previsão no ${origemNome} para ${formatarData(data)}.`
  })()
  const previsto = !credito && !ehFixa && !transferencia && !efetivado
  const rotuloSalvar = salvando ? "Salvando…" : editando ? "Salvar" : transferencia ? "Transferir" : ehFixa ? "Criar conta fixa" : "Adicionar"
  // Tipo de compra no cartão não muda na edição: os segmentos saem.
  const mostraTipos = !(editando && credito)

  return (
    <Formulario layout="lateral" onSubmit={() => { void enviar() }}>
      <Campos>
        {erro && <p className={styles.alerta} role="alert">{erro}</p>}

        {mostraTipos && (
          <Segmentos ariaLabel="Tipo de lançamento" cheio valor={natureza} onChange={trocarNatureza}
            opcoes={editando ? NATUREZAS.filter((n) => n.valor !== "transferencia") : NATUREZAS} />
        )}

        <Campo rotulo="Valor" erro={erros.valor}>
          <EntradaValor valor={valor} tom={tom} autoFocus={!editando} onChange={(x) => { setValor(x); limpa("valor") }} />
        </Campo>
        <Campo rotulo="Descrição" erro={erros.descricao}>
          <Entrada value={descricao} maxLength={MAX_DESCRICAO} placeholder={transferencia ? "Reserva de emergência" : "Mercado"}
            onChange={(e) => { setDescricao(e.target.value); limpa("descricao") }} />
        </Campo>

        <LinhaCampos colunas={comHora ? "minmax(0, 2fr) minmax(0, 1fr)" : undefined}>
          <Campo rotulo={ehFixa ? "Começa em" : parcelado ? "Data da compra" : "Data"} erro={erros.data}>
            <div className={styles.dataRapida}>
              <Botao tamanho="lg" ativo={data === hoje} onClick={() => escolherData(hoje)}>Hoje</Botao>
              <Botao tamanho="lg" ativo={data === ontem} onClick={() => escolherData(ontem)}>Ontem</Botao>
              <SeletorData valor={data} max={dataMax} onChange={escolherData} />
            </div>
          </Campo>
          {comHora && (
            <Campo rotulo={horaOpcional ? "Hora (opcional)" : "Hora"} erro={erros.hora}>
              <Entrada inputMode="numeric" placeholder="HH:MM" maxLength={5} value={hora}
                onChange={(e) => { setHora(mascararHora(e.target.value)); limpa("hora") }} />
            </Campo>
          )}
        </LinhaCampos>

        {transferencia ? (
          <LinhaCampos>
            <Campo rotulo="De" erro={erros.origem}>
              <Selecao valor={origemId} placeholder="Conta de origem" onChange={(x) => { setOrigemId(x); limpa("origem", "destino") }}
                opcoes={opcoesConta.filter((o) => o.valor !== destinoId)} />
            </Campo>
            <Campo rotulo="Para" erro={erros.destino}>
              <Selecao valor={destinoId} placeholder="Conta de destino" onChange={(x) => { setDestinoId(x); limpa("destino") }}
                opcoes={opcoesConta.filter((o) => o.valor !== origemId)} />
            </Campo>
          </LinhaCampos>
        ) : (
          <>
            <LinhaCampos>
              {editando && credito ? (
                <Campo rotulo="Pago com" estatico><ValorFixo>Crédito</ValorFixo></Campo>
              ) : (
                <Campo rotulo={receita ? "Recebido por" : "Pago com"}>
                  <Selecao valor={String(meio)} onChange={(x) => trocarMeio(Number(x))}
                    opcoes={(receita || editando ? MEIOS_CONTA : MEIOS_PAGAMENTO).map((m) => ({ valor: String(m.valor), rotulo: m.rotulo }))} />
                </Campo>
              )}
              {editando ? (
                <Campo rotulo={credito ? "Cartão" : "Conta"} estatico>
                  <ValorFixo title="Conta e cartão não mudam na edição">{origemNome ?? "—"}</ValorFixo>
                </Campo>
              ) : credito ? (
                <Campo rotulo="Cartão" erro={erros.cartao}>
                  <Selecao valor={cartaoId} desabilitado={cartoesCredito.length === 0}
                    placeholder={cartoesCredito.length === 0 ? "Nenhum cartão de crédito" : "Escolha o cartão"}
                    onChange={(x) => { setCartaoId(x); limpa("cartao") }}
                    opcoes={cartoesCredito.map((c) => ({ valor: c.id, rotulo: c.ultimosDigitos ? `${c.nome} •••• ${c.ultimosDigitos}` : c.nome }))} />
                </Campo>
              ) : (
                <Campo rotulo="Conta" erro={erros.conta}>
                  <Selecao valor={contaId} desabilitado={contas.length === 0}
                    placeholder={contas.length === 0 ? "Nenhuma conta" : "Escolha a conta"}
                    onChange={(x) => { setContaId(x); limpa("conta") }} opcoes={opcoesConta} />
                </Campo>
              )}
            </LinhaCampos>
            <LinhaCampos>
              <Campo rotulo="Categoria" erro={erros.categoria}>
                <Selecao valor={categoriaId} placeholder="Escolha a categoria"
                  onChange={(x) => { setCategoriaId(x); setSubcategoriaId(""); limpa("categoria") }}
                  opcoes={cats.map((c) => ({ valor: c.id, rotulo: c.descricao }))} />
              </Campo>
              {!ehFixa && (
                <Campo rotulo="Subcategoria">
                  <Selecao valor={subcategoriaId} desabilitado={subs.length === 0}
                    placeholder={subs.length === 0 ? "Nenhuma" : "Opcional"} onChange={setSubcategoriaId}
                    opcoes={subs.length === 0 ? [] : [{ valor: "", rotulo: "Sem subcategoria" }, ...subs.map((s) => ({ valor: s.id, rotulo: s.nome }))]} />
                </Campo>
              )}
            </LinhaCampos>
          </>
        )}
      </Campos>

      <Lado>
        <PreviaLancamento descricao={descricao} valor={v} tom={tom} detalhe={detalhe} efeito={efeito}
          etiquetas={previsto || ehFixa || parcelado ? (
            <>
              {previsto && <Etiqueta tom="alerta">Previsto</Etiqueta>}
              {ehFixa && <Etiqueta>Conta fixa</Etiqueta>}
              {parcelado && <Etiqueta>{parcelas}x</Etiqueta>}
            </>
          ) : undefined} />

        {!transferencia && !editando && (
          <Bloco titulo="Opções" className={styles.opcoes}>
            {!credito && !ehFixa && (
              <Interruptor ligado={efetivado} onChange={(on) => { setEfetivado(on); limpa("data") }}>{receita ? "Já recebi" : "Já paguei"}</Interruptor>
            )}
            <Interruptor ligado={fixa} onChange={trocarFixa}>Conta fixa</Interruptor>
            {ehFixa && (
              <div className={styles.subOpcoes}>
                <Campo rotulo="Repete">
                  <Selecao tamanho="sm" valor={String(frequencia)} onChange={(x) => setFrequencia(Number(x))}
                    opcoes={FREQUENCIAS.map((f) => ({ valor: String(f.valor), rotulo: f.rotulo }))} />
                </Campo>
                <Campo rotulo="Até" erro={erros.dataFim}>
                  <SeletorData tamanho="sm" valor={dataFim} min={data} limpavel placeholder="Sem fim" onChange={(x) => { setDataFim(x); limpa("dataFim") }} />
                </Campo>
              </div>
            )}
            {credito && !ehFixa && (
              <Interruptor ligado={parcelas > 1} onChange={(on) => setParcelas(on ? 2 : 1)}>Parcelado</Interruptor>
            )}
            {parcelado && (
              <div className={styles.subOpcoes}>
                <Campo rotulo="Vezes">
                  <Selecao tamanho="sm" valor={String(parcelas)} onChange={(x) => setParcelas(Number(x))}
                    opcoes={PARCELAS.filter((n) => n > 1).map((n) => ({ valor: String(n), rotulo: `${n}x de ${formatMoney(centavos(v / n))}` }))} />
                </Campo>
              </div>
            )}
          </Bloco>
        )}

        <RodapeFormulario>
          <Botao onClick={aoSair} disabled={salvando}>Cancelar</Botao>
          <Botao variante="primario" type="submit" disabled={salvando}>{rotuloSalvar}</Botao>
        </RodapeFormulario>
      </Lado>
    </Formulario>
  )
}
