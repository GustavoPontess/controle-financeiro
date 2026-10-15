// Nova transação do v2 — despesa, receita ou transferência numa tela só. Mesmas regras do app atual:
// - crédito só em despesa: escolhe o cartão e as parcelas; fora do crédito, escolhe a conta;
// - parcelado não guarda hora (cada parcela cai numa fatura) e não anda junto com conta fixa;
// - conta fixa repete sozinha a partir da data de início; não tem hora nem subcategoria (o back não guarda);
// - data futura só no cartão, em conta fixa (início) ou como previsão (desligar "Já paguei");
// - transferência: entre duas contas diferentes, nunca no futuro;
// - conta fixa leva Idempotency-Key (nasce ao abrir a tela e vale pra toda tentativa: reenviar não cria duas).
import { useEffect, useMemo, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { createTransaction } from "../services/transactionService"
import { createTransferencia } from "../services/transferenciaService"
import { createRecorrente } from "../services/recorrenteService"
import { getContas } from "../services/contaService"
import { getCartoes } from "../services/cartaoCreditoService"
import { getCategories } from "../services/categoryService"
import { getSubcategories } from "../services/subcategoryService"
import { mensagemDeErro } from "../api/cliente"
import { useDetalheNoCaminho } from "../layout/caminho"
import type { Conta } from "../types/Conta"
import type { CartaoCredito } from "../types/CartaoCredito"
import type { Category } from "../types/Category"
import type { Subcategory } from "../types/Subcategory"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import Entrada from "../componentes/Entrada"
import EntradaValor from "../componentes/EntradaValor"
import Formulario, { LinhaCampos, RodapeFormulario } from "../componentes/Formulario"
import Interruptor from "../componentes/Interruptor"
import Segmentos from "../componentes/Segmentos"
import Selecao from "../componentes/Selecao"
import SeletorData from "../componentes/SeletorData"
import { FREQUENCIAS, MAX_DESCRICAO, MEIO, MEIOS_CONTA, MEIOS_PAGAMENTO, PARCELAS, TIPO, horaValida } from "../dominio/transacao"
import { parseMoney } from "../utils/money"
import { dataLocalISO, horaLocalHHMM, mascararHora } from "../utils/dateTime"
import styles from "./NovaTransacao.module.css"

type Natureza = "despesa" | "receita" | "transferencia"
const NATUREZAS: { valor: Natureza; rotulo: string }[] = [
  { valor: "despesa", rotulo: "Despesa" },
  { valor: "receita", rotulo: "Receita" },
  { valor: "transferencia", rotulo: "Transferência" },
]

export default function NovaTransacao() {
  const navigate = useNavigate()
  const location = useLocation()
  const voltarPara = (location.state as { voltarPara?: string } | null)?.voltarPara ?? "/transacoes"
  useDetalheNoCaminho("Nova transação")

  const [contas, setContas] = useState<Conta[]>([])
  const [cartoes, setCartoes] = useState<CartaoCredito[]>([])
  const [categorias, setCategorias] = useState<Category[]>([])
  const [subcategorias, setSubcategorias] = useState<Subcategory[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga] = useState(false)

  useEffect(() => {
    let vivo = true
    Promise.all([getContas(), getCartoes(), getCategories(), getSubcategories()])
      .then(([cts, cars, cats, subs]) => { if (!vivo) return; setContas(cts); setCartoes(cars); setCategorias(cats); setSubcategorias(subs) })
      .catch(() => { if (vivo) setErroCarga(true) })
      .finally(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
  }, [])

  const voltar = <Link to={voltarPara} className={styles.voltar}><ArrowLeft size={16} strokeWidth={2.25} aria-hidden="true" /> Transações</Link>

  return (
    <div className={styles.pagina}>
      {voltar}
      <h1 className={styles.titulo}>Nova transação</h1>
      {erroCarga ? (
        <p className={styles.alerta} role="alert">Não foi possível carregar suas contas e categorias. Recarregue a página.</p>
      ) : carregando ? (
        <Bloco><Esqueleto linhas={6} altura={18} /></Bloco>
      ) : (
        <Bloco>
          <Form contas={contas} cartoes={cartoes} categorias={categorias} subcategorias={subcategorias}
            aoSair={() => navigate(voltarPara, { replace: true })} />
        </Bloco>
      )}
    </div>
  )
}

function Form({ contas, cartoes, categorias, subcategorias, aoSair }: {
  contas: Conta[]; cartoes: CartaoCredito[]; categorias: Category[]; subcategorias: Subcategory[]; aoSair: () => void
}) {
  const [natureza, setNatureza] = useState<Natureza>("despesa")
  const [valor, setValor] = useState("")
  const [meio, setMeio] = useState<number>(MEIO.pix)
  const [contaId, setContaId] = useState("")
  const [cartaoId, setCartaoId] = useState("")
  const [parcelas, setParcelas] = useState(1)
  const [fixa, setFixa] = useState(false)
  const [frequencia, setFrequencia] = useState(2)
  const [dataFim, setDataFim] = useState("")
  const [efetivado, setEfetivado] = useState(true)
  const [data, setData] = useState(() => dataLocalISO())
  const [hora, setHora] = useState(() => horaLocalHHMM())
  const [categoriaId, setCategoriaId] = useState("")
  const [subcategoriaId, setSubcategoriaId] = useState("")
  const [origemId, setOrigemId] = useState("")
  const [destinoId, setDestinoId] = useState("")
  const [descricao, setDescricao] = useState("")
  const [erros, setErros] = useState<Record<string, string>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  // Idempotency-Key da conta fixa: uma por abertura da tela, reusada em toda tentativa.
  const [chaveFixa] = useState(() => crypto.randomUUID())

  const transferencia = natureza === "transferencia"
  const receita = natureza === "receita"
  const tipo = receita ? TIPO.receita : TIPO.despesa
  const credito = !transferencia && meio === MEIO.credito
  // Conta fixa só vale fora da transferência (o interruptor lembra a escolha se a pessoa voltar).
  const ehFixa = !transferencia && fixa
  const parcelado = credito && !ehFixa && parcelas > 1
  const comHora = !ehFixa && !parcelado
  const hoje = dataLocalISO()
  // Futuro só no cartão, como início de conta fixa ou como previsão.
  const dataMax = transferencia || (!credito && !ehFixa && efetivado) ? hoje : undefined

  const cats = useMemo(() => categorias.filter((c) => c.finalidade === 3 || c.finalidade === tipo), [categorias, tipo])
  const subs = useMemo(() => subcategorias.filter((s) => s.categoriaId === categoriaId), [subcategorias, categoriaId])
  const cartoesCredito = useMemo(() => cartoes.filter((c) => c.temCredito && c.ativo !== false), [cartoes])
  const opcoesConta = contas.map((c) => ({ valor: c.id, rotulo: c.nome }))

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

  const validar = () => {
    const e: Record<string, string> = {}
    if (parseMoney(valor) <= 0) e.valor = "Informe um valor"
    if (transferencia) {
      if (!origemId) e.origem = "Escolha a conta de origem"
      if (!destinoId) e.destino = "Escolha a conta de destino"
      else if (destinoId === origemId) e.destino = "Origem e destino precisam ser contas diferentes"
    } else {
      if (credito && !cartaoId) e.cartao = "Escolha o cartão"
      if (!credito && !contaId) e.conta = "Escolha a conta"
      if (!categoriaId) e.categoria = "Escolha a categoria"
    }
    if (!data) e.data = "Informe a data"
    else if (dataMax && data > dataMax)
      e.data = transferencia ? "Transferência não pode ser no futuro" : `Data futura só como previsão: desligue "${receita ? "Já recebi" : "Já paguei"}"`
    if (comHora) {
      if (!hora) e.hora = "Informe a hora"
      else if (!horaValida(hora)) e.hora = "Hora inválida (HH:MM)"
    }
    if (ehFixa && dataFim && dataFim < data) e.dataFim = "Precisa ser depois do início"
    if (!descricao.trim()) e.descricao = "Informe a descrição"
    setErros(e)
    return Object.keys(e).length === 0
  }

  const enviar = async () => {
    setErro(null)
    if (!validar()) return
    setSalvando(true)
    const v = parseMoney(valor)
    const desc = descricao.trim()
    try {
      if (transferencia) {
        await createTransferencia({ contaOrigemId: origemId, contaDestinoId: destinoId, valor: v, data, hora: `${hora}:00`, descricao: desc })
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
          hora: comHora ? `${hora}:00` : null,
        })
      }
    } catch (e) {
      setErro(mensagemDeErro(e))
      setSalvando(false)
      return
    }
    aoSair()
  }

  const rotuloSalvar = salvando ? "Salvando…" : transferencia ? "Transferir" : ehFixa ? "Criar conta fixa" : "Adicionar"

  return (
    <Formulario onSubmit={() => { void enviar() }}>
      {erro && <p className={styles.alerta} role="alert">{erro}</p>}

      <Segmentos ariaLabel="Tipo de lançamento" cheio valor={natureza} onChange={trocarNatureza} opcoes={NATUREZAS} />

      <Campo rotulo="Valor" erro={erros.valor}>
        <EntradaValor valor={valor} autoFocus onChange={(v) => { setValor(v); limpa("valor") }} />
      </Campo>

      {transferencia ? (
        <LinhaCampos>
          <Campo rotulo="De" erro={erros.origem}>
            <Selecao valor={origemId} placeholder="Conta de origem" onChange={(v) => { setOrigemId(v); limpa("origem", "destino") }}
              opcoes={opcoesConta.filter((o) => o.valor !== destinoId)} />
          </Campo>
          <Campo rotulo="Para" erro={erros.destino}>
            <Selecao valor={destinoId} placeholder="Conta de destino" onChange={(v) => { setDestinoId(v); limpa("destino") }}
              opcoes={opcoesConta.filter((o) => o.valor !== origemId)} />
          </Campo>
        </LinhaCampos>
      ) : (
        <LinhaCampos>
          <Campo rotulo="Meio de pagamento">
            <Selecao valor={String(meio)} onChange={(v) => trocarMeio(Number(v))}
              opcoes={(receita ? MEIOS_CONTA : MEIOS_PAGAMENTO).map((m) => ({ valor: String(m.valor), rotulo: m.rotulo }))} />
          </Campo>
          {credito ? (
            <Campo rotulo="Cartão" erro={erros.cartao}>
              <Selecao valor={cartaoId} desabilitado={cartoesCredito.length === 0}
                placeholder={cartoesCredito.length === 0 ? "Nenhum cartão de crédito" : "Escolha o cartão"}
                onChange={(v) => { setCartaoId(v); limpa("cartao") }}
                opcoes={cartoesCredito.map((c) => ({ valor: c.id, rotulo: c.ultimosDigitos ? `${c.nome} •••• ${c.ultimosDigitos}` : c.nome }))} />
            </Campo>
          ) : (
            <Campo rotulo="Conta" erro={erros.conta}>
              <Selecao valor={contaId} desabilitado={contas.length === 0}
                placeholder={contas.length === 0 ? "Nenhuma conta" : "Escolha a conta"}
                onChange={(v) => { setContaId(v); limpa("conta") }} opcoes={opcoesConta} />
            </Campo>
          )}
        </LinhaCampos>
      )}

      {!transferencia && (
        <div className={styles.opcoes}>
          <Interruptor ligado={fixa} onChange={trocarFixa}>Conta fixa</Interruptor>
          {!credito && !fixa && (
            <Interruptor ligado={efetivado} onChange={(on) => { setEfetivado(on); limpa("data") }}>{receita ? "Já recebi" : "Já paguei"}</Interruptor>
          )}
        </div>
      )}

      {ehFixa ? (
        <LinhaCampos>
          <Campo rotulo="Começa em" erro={erros.data}>
            <SeletorData valor={data} onChange={(v) => { setData(v); limpa("data", "dataFim") }} />
          </Campo>
          <Campo rotulo="Repete">
            <Selecao valor={String(frequencia)} onChange={(v) => setFrequencia(Number(v))}
              opcoes={FREQUENCIAS.map((f) => ({ valor: String(f.valor), rotulo: f.rotulo }))} />
          </Campo>
          <Campo rotulo="Até (opcional)" erro={erros.dataFim}>
            <SeletorData valor={dataFim} min={data} limpavel placeholder="Sem fim" onChange={(v) => { setDataFim(v); limpa("dataFim") }} />
          </Campo>
        </LinhaCampos>
      ) : (
        <LinhaCampos>
          <Campo rotulo={parcelado ? "Data da compra" : "Data"} erro={erros.data}>
            <SeletorData valor={data} max={dataMax} onChange={(v) => { setData(v); limpa("data") }} />
          </Campo>
          {comHora && (
            <Campo rotulo="Hora" erro={erros.hora}>
              <Entrada inputMode="numeric" placeholder="HH:MM" maxLength={5} value={hora}
                onChange={(e) => { setHora(mascararHora(e.target.value)); limpa("hora") }} />
            </Campo>
          )}
          {credito && (
            <Campo rotulo="Parcelas">
              <Selecao valor={String(parcelas)} onChange={(v) => setParcelas(Number(v))}
                opcoes={PARCELAS.map((n) => ({ valor: String(n), rotulo: n === 1 ? "À vista" : `${n}x` }))} />
            </Campo>
          )}
        </LinhaCampos>
      )}

      {!transferencia && (
        <LinhaCampos>
          <Campo rotulo="Categoria" erro={erros.categoria}>
            <Selecao valor={categoriaId} placeholder="Escolha a categoria"
              onChange={(v) => { setCategoriaId(v); setSubcategoriaId(""); limpa("categoria") }}
              opcoes={cats.map((c) => ({ valor: c.id, rotulo: c.descricao }))} />
          </Campo>
          {!ehFixa && (
            <Campo rotulo="Subcategoria (opcional)">
              <Selecao valor={subcategoriaId} desabilitado={subs.length === 0}
                placeholder={subs.length === 0 ? "Nenhuma" : "Sem subcategoria"} onChange={setSubcategoriaId}
                opcoes={subs.length === 0 ? [] : [{ valor: "", rotulo: "Sem subcategoria" }, ...subs.map((s) => ({ valor: s.id, rotulo: s.nome }))]} />
            </Campo>
          )}
        </LinhaCampos>
      )}

      <Campo rotulo="Descrição" erro={erros.descricao}>
        <Entrada value={descricao} maxLength={MAX_DESCRICAO} placeholder={transferencia ? "Ex.: Reserva de emergência" : "Ex.: Mercado"}
          onChange={(e) => { setDescricao(e.target.value); limpa("descricao") }} />
      </Campo>

      <RodapeFormulario>
        <Botao onClick={aoSair} disabled={salvando}>Cancelar</Botao>
        <Botao variante="primario" type="submit" disabled={salvando}>{rotuloSalvar}</Botao>
      </RodapeFormulario>
    </Formulario>
  )
}
