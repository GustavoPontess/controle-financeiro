// Formulário da conta fixa — UM só pra criar, editar a regra e transformar um lançamento em conta fixa.
// Separado do FormularioTransacao (Gustavo, 2026-10-15): conta fixa não tem hora, parcela, subcategoria nem
// "Já paguei"; tem repetição, começo/fim e COMO paga (débito automático, boleto…), que é o que diz se a pessoa
// precisa lembrar de pagar. Regras:
// - no cartão o meio é sempre Crédito (o servidor grava sozinho); numa conta, qualquer meio menos Crédito;
// - criar leva Idempotency-Key (nasce ao abrir a tela e vale pra toda tentativa: reenviar não cria duas);
// - transformar usa a conversão do servidor (PUT da transação com `contaFixa`): o lançamento antigo sai e a
//   conta fixa nasce numa transação só do banco, sem duplicar;
// - começo entre 12 meses atrás e 5 anos à frente ao criar (o servidor valida igual); na edição o começo
//   antigo continua valendo.
import { useMemo, useState } from "react"
import { createRecorrente, updateRecorrente } from "../services/recorrenteService"
import { updateTransaction } from "../services/transactionService"
import { mensagemDeErro } from "../api/cliente"
import type { Recorrente } from "../types/Recorrente"
import type { Transaction } from "../types/Transaction"
import type { Conta } from "../types/Conta"
import type { CartaoCredito } from "../types/CartaoCredito"
import type { Category } from "../types/Category"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import Entrada from "../componentes/Entrada"
import EntradaValor from "../componentes/EntradaValor"
import Etiqueta from "../componentes/Etiqueta"
import Formulario, { Campos, Lado, LinhaCampos, RodapeFormulario } from "../componentes/Formulario"
import PreviaLancamento from "../componentes/PreviaLancamento"
import Segmentos from "../componentes/Segmentos"
import Selecao from "../componentes/Selecao"
import SeletorData from "../componentes/SeletorData"
import { FREQUENCIAS, MAX_DESCRICAO, MEIO, MEIOS_CONTA_FIXA, MEIOS_RECEBIMENTO_FIXO, TIPO } from "../dominio/transacao"
import { FREQUENCIA, descreverRegra, limitesDoInicio } from "../dominio/contaFixa"
import { moneyParaCampo, parseMoney } from "../utils/money"
import { dataLocalISO } from "../utils/dateTime"
import styles from "./FormularioContaFixa.module.css"

type Natureza = "despesa" | "receita"
const NATUREZAS: { valor: Natureza; rotulo: string }[] = [
  { valor: "despesa", rotulo: "Despesa" },
  { valor: "receita", rotulo: "Receita" },
]

/** O que a Nova transação já tinha preenchido quando a pessoa pediu "Transformar em conta fixa". */
export type RascunhoContaFixa = {
  tipo?: number
  valor?: string
  descricao?: string
  meio?: number
  contaId?: string
  cartaoId?: string
  categoriaId?: string
  data?: string
}

export default function FormularioContaFixa({ recorrente, transacao, inicial, contas = [], cartoes = [], categorias, aoSair, aoSalvo }: {
  /** Com conta fixa = editar a regra dela. */
  recorrente?: Recorrente
  /** Com transação = transformar esse lançamento em conta fixa (o servidor troca um pelo outro). */
  transacao?: Transaction
  /** Começa com o que veio da tela anterior (Nova transação ou Editar transação). */
  inicial?: RascunhoContaFixa
  contas?: Conta[]
  cartoes?: CartaoCredito[]
  categorias: Category[]
  aoSair: () => void
  /** Recebe o id da conta fixa salva (na transformação é uma conta fixa nova). */
  aoSalvo: (id: string) => void
}) {
  const r = recorrente ?? null
  const t = transacao ?? null
  const ini = inicial ?? {}
  const editando = !!r
  const transformando = !r && !!t

  const naturezaInicial: Natureza = (ini.tipo ?? r?.tipo ?? t?.tipo) === TIPO.receita ? "receita" : "despesa"
  // O meio que veio de fora só vale se está na lista do tipo (ex.: receita "Débito" não existe aqui): senão
  // começa vazio e a pessoa escolhe, em vez de um valor escondido passar na validação.
  const meioInicial = (): number | "" => {
    const m = ini.meio ?? (r ? (r.cartaoCreditoId ? MEIO.credito : r.meioPagamento) : t ? (t.cartaoCreditoId ? MEIO.credito : t.meioPagamento) : null)
    const lista = naturezaInicial === "receita" ? MEIOS_RECEBIMENTO_FIXO : MEIOS_CONTA_FIXA
    return m != null && lista.some((x) => x.valor === m) ? m : ""
  }

  const [natureza, setNatureza] = useState<Natureza>(naturezaInicial)
  const [valor, setValor] = useState(ini.valor ?? (r ? moneyParaCampo(r.valor) : t ? moneyParaCampo(t.valor) : ""))
  const [descricao, setDescricao] = useState(ini.descricao ?? r?.descricao ?? t?.descricao ?? "")
  const [meio, setMeio] = useState<number | "">(meioInicial)
  const [contaId, setContaId] = useState(ini.contaId ?? r?.contaId ?? t?.contaId ?? "")
  const [cartaoId, setCartaoId] = useState(ini.cartaoId ?? r?.cartaoCreditoId ?? t?.cartaoCreditoId ?? "")
  const [categoriaId, setCategoriaId] = useState(ini.categoriaId ?? r?.categoriaId ?? t?.categoriaId ?? "")
  const [frequencia, setFrequencia] = useState<number>(r?.frequencia ?? FREQUENCIA.mensal)
  const [data, setData] = useState(() => ini.data ?? r?.dataInicio.slice(0, 10) ?? t?.data ?? dataLocalISO())
  const [dataFim, setDataFim] = useState(r?.dataFim?.slice(0, 10) ?? "")
  const [erros, setErros] = useState<Record<string, string>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  // Idempotency-Key: uma por abertura da tela, reusada em toda tentativa (criar e transformar).
  const [chaveEnvio] = useState(() => crypto.randomUUID())

  const receita = natureza === "receita"
  const tipo = receita ? TIPO.receita : TIPO.despesa
  const credito = !receita && meio === MEIO.credito
  const hoje = dataLocalISO()
  // Na edição o começo antigo vale (pode ter sido há mais de 12 meses); criar e transformar seguem o limite.
  const limites = editando ? null : limitesDoInicio(hoje)

  const cats = useMemo(() => categorias.filter((c) => c.finalidade === 3 || c.finalidade === tipo), [categorias, tipo])
  const cartoesCredito = useMemo(() => cartoes.filter((c) => c.temCredito && c.ativo !== false), [cartoes])
  const meios = receita ? MEIOS_RECEBIMENTO_FIXO : MEIOS_CONTA_FIXA
  const nomeConta = (id: string) => contas.find((c) => c.id === id)?.nome ?? (r && id === r.contaId ? r.contaNome : undefined) ?? (t && id === t.contaId ? t.contaNome : undefined)
  const nomeCartao = (id: string) => cartoesCredito.find((c) => c.id === id)?.nome ?? (r && id === r.cartaoCreditoId ? r.cartaoCreditoNome : undefined) ?? (t && id === t.cartaoCreditoId ? t.cartaoCreditoNome : undefined)

  const limpa = (...campos: string[]) => setErros((e) => {
    if (!campos.some((c) => e[c])) return e
    const n = { ...e }
    for (const c of campos) delete n[c]
    return n
  })

  const trocarNatureza = (n: Natureza) => {
    setNatureza(n)
    setErros({})
    const novoTipo = n === "receita" ? TIPO.receita : TIPO.despesa
    // O meio que não serve pro tipo novo cai fora (receita não tem cartão nem débito automático).
    const lista = n === "receita" ? MEIOS_RECEBIMENTO_FIXO : MEIOS_CONTA_FIXA
    if (meio !== "" && !lista.some((m) => m.valor === meio)) setMeio("")
    const atual = categorias.find((c) => c.id === categoriaId)
    if (atual && atual.finalidade !== 3 && atual.finalidade !== novoTipo) setCategoriaId("")
  }
  const trocarMeio = (m: number) => { setMeio(m); limpa("meio", "conta", "cartao") }
  const escolherData = (x: string) => { setData(x); limpa("data", "dataFim") }

  const validar = () => {
    const e: Record<string, string> = {}
    if (parseMoney(valor) <= 0) e.valor = "Informe um valor"
    if (!descricao.trim()) e.descricao = "Informe a descrição"
    if (meio === "") e.meio = receita ? "Escolha como recebe" : "Escolha como paga"
    else if (credito && !cartaoId) e.cartao = "Escolha o cartão"
    else if (!credito && !contaId) e.conta = "Escolha a conta"
    if (!categoriaId) e.categoria = "Escolha a categoria"
    if (!data) e.data = "Informe a data"
    else if (limites && (data < limites.min || data > limites.max)) e.data = "Entre 12 meses atrás e 5 anos à frente"
    if (dataFim && data && dataFim < data) e.dataFim = "Precisa ser depois do começo"
    setErros(e)
    return Object.keys(e).length === 0
  }

  const enviar = async () => {
    setErro(null)
    if (!validar()) return
    setSalvando(true)
    const v = parseMoney(valor)
    const desc = descricao.trim()
    const m = meio as number
    try {
      let id: string
      if (r) {
        await updateRecorrente(r.id, {
          descricao: desc, valor: v, tipo, categoriaId,
          contaId: credito ? undefined : contaId,
          cartaoCreditoId: credito ? cartaoId : undefined,
          meioPagamento: credito ? undefined : m,
          frequencia,
          dia: Number(data.slice(8, 10)),
          dataInicio: data,
          dataFim: dataFim || undefined,
        })
        id = r.id
      } else if (t) {
        const res = await updateTransaction(t.id, {
          descricao: desc, valor: v, tipo,
          categoriaId,
          subcategoriaId: null,
          contaId: credito ? null : contaId,
          cartaoCreditoId: credito ? cartaoId : null,
          meioPagamento: credito ? null : m,
          parcelas: null,
          efetivado: credito ? true : t.statusTransacao !== 0,
          data,
          hora: null,
          transferencia: null,
          contaFixa: { frequencia, dataFim: dataFim || null },
        }, chaveEnvio)
        id = res.id
      } else {
        const criada = await createRecorrente({
          descricao: desc, valor: v, tipo, categoriaId,
          contaId: credito ? undefined : contaId,
          cartaoCreditoId: credito ? cartaoId : undefined,
          meioPagamento: credito ? undefined : m,
          frequencia,
          // O back gera pelas datas; "dia" é o dia do mês do começo (lido do texto, sem fuso).
          dia: Number(data.slice(8, 10)),
          dataInicio: data,
          dataFim: dataFim || undefined,
        }, chaveEnvio)
        id = criada.id
      }
      aoSalvo(id)
    } catch (e) {
      setErro(mensagemDeErro(e))
      setSalvando(false)
    }
  }

  // ── Prévia: como a cobrança aparece na lista + a regra por extenso ──────────────────────────────────
  const v = parseMoney(valor)
  const tom = receita ? "positivo" : "negativo"
  const origemNome = credito ? nomeCartao(cartaoId) : nomeConta(contaId)
  const catNome = categorias.find((c) => c.id === categoriaId)?.descricao
  const meioRotulo = meios.find((x) => x.valor === meio)?.rotulo
  const detalhe = [origemNome, catNome, credito ? undefined : meioRotulo].filter(Boolean).join(" · ")
  const efeito = data
    ? `${descreverRegra(frequencia, data, dataFim || undefined)}.${origemNome
      ? credito ? ` Cada cobrança vai pra fatura do ${origemNome}.` : ` ${receita ? "Entra no" : "Sai do"} ${origemNome}.`
      : ""}`
    : null
  const rotuloSalvar = salvando ? "Salvando…" : editando ? "Salvar" : transformando ? "Transformar em conta fixa" : "Criar conta fixa"

  return (
    <Formulario layout="lateral" onSubmit={() => { void enviar() }}>
      <Campos>
        {erro && <p className={styles.alerta} role="alert">{erro}</p>}

        <Segmentos ariaLabel="Tipo da conta fixa" cheio valor={natureza} onChange={trocarNatureza} opcoes={NATUREZAS} />

        <Campo rotulo="Valor" erro={erros.valor}>
          <EntradaValor valor={valor} tom={tom} autoFocus={!editando && !transformando} onChange={(x) => { setValor(x); limpa("valor") }} />
        </Campo>
        <Campo rotulo="Descrição" erro={erros.descricao}>
          <Entrada value={descricao} maxLength={MAX_DESCRICAO} placeholder={receita ? "Salário" : "Aluguel"}
            onChange={(e) => { setDescricao(e.target.value); limpa("descricao") }} />
        </Campo>

        <LinhaCampos>
          <Campo rotulo="Repete">
            <Selecao valor={String(frequencia)} onChange={(x) => setFrequencia(Number(x))}
              opcoes={FREQUENCIAS.map((f) => ({ valor: String(f.valor), rotulo: f.rotulo }))} />
          </Campo>
          <Campo rotulo={receita ? "Primeiro recebimento" : "Primeira cobrança"} erro={erros.data}>
            <SeletorData valor={data} min={limites?.min} max={limites?.max} onChange={escolherData} />
          </Campo>
          <Campo rotulo="Até" erro={erros.dataFim}>
            <SeletorData valor={dataFim} min={data || undefined} limpavel placeholder="Sem fim" onChange={(x) => { setDataFim(x); limpa("dataFim") }} />
          </Campo>
        </LinhaCampos>

        <LinhaCampos>
          <Campo rotulo={receita ? "Como recebe" : "Como paga"} erro={erros.meio}>
            <Selecao valor={meio === "" ? "" : String(meio)} placeholder="Escolha" onChange={(x) => trocarMeio(Number(x))}
              opcoes={meios.map((x) => ({ valor: String(x.valor), rotulo: x.rotulo }))} />
          </Campo>
          {credito ? (
            <Campo rotulo="Cartão" erro={erros.cartao}>
              <Selecao valor={cartaoId} desabilitado={cartoesCredito.length === 0}
                placeholder={cartoesCredito.length === 0 ? "Nenhum cartão de crédito" : "Escolha o cartão"}
                onChange={(x) => { setCartaoId(x); limpa("cartao") }}
                opcoes={cartoesCredito.map((c) => ({ valor: c.id, rotulo: c.ultimosDigitos ? `${c.nome} •••• ${c.ultimosDigitos}` : c.nome }))} />
            </Campo>
          ) : (
            <Campo rotulo={receita ? "Entra na conta" : "Sai da conta"} erro={erros.conta}>
              <Selecao valor={contaId} desabilitado={contas.length === 0}
                placeholder={contas.length === 0 ? "Nenhuma conta" : "Escolha a conta"}
                onChange={(x) => { setContaId(x); limpa("conta") }} opcoes={contas.map((c) => ({ valor: c.id, rotulo: c.nome }))} />
            </Campo>
          )}
        </LinhaCampos>

        <LinhaCampos colunas="minmax(0, 1fr) minmax(0, 1fr)">
          <Campo rotulo="Categoria" erro={erros.categoria}>
            <Selecao valor={categoriaId} placeholder="Escolha a categoria"
              onChange={(x) => { setCategoriaId(x); limpa("categoria") }}
              opcoes={cats.map((c) => ({ valor: c.id, rotulo: c.descricao }))} />
          </Campo>
        </LinhaCampos>
      </Campos>

      <Lado>
        <PreviaLancamento descricao={descricao} valor={v} tom={tom} detalhe={detalhe} efeito={efeito}
          etiquetas={<Etiqueta>Conta fixa</Etiqueta>} />

        <RodapeFormulario>
          <Botao onClick={aoSair} disabled={salvando}>Cancelar</Botao>
          <Botao variante="primario" type="submit" disabled={salvando}>{rotuloSalvar}</Botao>
        </RodapeFormulario>
      </Lado>
    </Formulario>
  )
}
