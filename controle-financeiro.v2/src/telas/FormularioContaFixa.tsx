// Formulário da conta fixa — UM só pra criar e editar a regra (senão os dois divergem).
// Separado do FormularioTransacao (Gustavo, 2026-10-15): conta fixa não tem hora, parcela, subcategoria nem
// "Já paguei"; tem subcategoria (opcional), repetição, começo/fim e COMO paga (débito automático, boleto…), que é o que diz se a pessoa
// precisa lembrar de pagar. Regras:
// - no cartão o meio é sempre Crédito (o servidor grava sozinho); numa conta, qualquer meio menos Crédito;
// - criar leva Idempotency-Key (nasce ao abrir a tela e vale pra toda tentativa: reenviar não cria duas);
// - começo entre 12 meses atrás e 5 anos à frente ao criar (o servidor valida igual); na edição o começo
//   antigo continua valendo;
// - conta a pagar pode ser DA CASA ("Dividir com {família}"): cada cobrança nasce dividida pela regra da família;
//   ligar/desligar vale pras próximas cobranças.
import { useEffect, useMemo, useState } from "react"
import { createRecorrente, updateRecorrente } from "../services/recorrenteService"
import { getFamilias } from "../services/familiaService"
import type { Familia } from "../types/Familia"
import Bloco from "../componentes/Bloco"
import Interruptor from "../componentes/Interruptor"
import { mensagemDeErro } from "../api/cliente"
import type { Recorrente } from "../types/Recorrente"
import type { Conta } from "../types/Conta"
import type { CartaoCredito } from "../types/CartaoCredito"
import type { Category } from "../types/Category"
import type { Subcategory } from "../types/Subcategory"
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
import { aceitaTipo } from "../dominio/categoria"
import { FREQUENCIA, descreverRegra, limitesDoInicio } from "../dominio/contaFixa"
import { moneyParaCampo, parseMoney } from "../utils/money"
import { dataLocalISO } from "../utils/dateTime"
import styles from "./FormularioContaFixa.module.css"

type Natureza = "despesa" | "receita"
const NATUREZAS: { valor: Natureza; rotulo: string }[] = [
  { valor: "despesa", rotulo: "Despesa" },
  { valor: "receita", rotulo: "Receita" },
]

export default function FormularioContaFixa({ recorrente, contas = [], cartoes = [], categorias, subcategorias = [], familiaInicial, aoSair, aoSalvo }: {
  /** Com conta fixa = editar a regra dela; sem = nova. */
  recorrente?: Recorrente
  /** Nova conta fixa aberta pela aba Contas fixas da família: já nasce dividida com ela. */
  familiaInicial?: string
  contas?: Conta[]
  cartoes?: CartaoCredito[]
  categorias: Category[]
  subcategorias?: Subcategory[]
  aoSair: () => void
  /** Recebe o id da conta fixa salva. */
  aoSalvo: (id: string) => void
}) {
  const r = recorrente ?? null
  const editando = !!r

  const naturezaInicial: Natureza = r?.tipo === TIPO.receita ? "receita" : "despesa"
  // O meio gravado só vale se está na lista do tipo (ex.: receita em "Débito", de antes): senão começa vazio
  // e a pessoa escolhe, em vez de um valor escondido passar na validação.
  const meioInicial = (): number | "" => {
    const m = r ? (r.cartaoCreditoId ? MEIO.credito : r.meioPagamento) : null
    const lista = naturezaInicial === "receita" ? MEIOS_RECEBIMENTO_FIXO : MEIOS_CONTA_FIXA
    return m != null && lista.some((x) => x.valor === m) ? m : ""
  }

  const [natureza, setNatureza] = useState<Natureza>(naturezaInicial)
  const [valor, setValor] = useState(r ? moneyParaCampo(r.valor) : "")
  const [descricao, setDescricao] = useState(r?.descricao ?? "")
  const [meio, setMeio] = useState<number | "">(meioInicial)
  const [contaId, setContaId] = useState(r?.contaId ?? "")
  const [cartaoId, setCartaoId] = useState(r?.cartaoCreditoId ?? "")
  const [categoriaId, setCategoriaId] = useState(r?.categoriaId ?? "")
  const [subcategoriaId, setSubcategoriaId] = useState(r?.subcategoriaId ?? "")
  const [frequencia, setFrequencia] = useState<number>(r?.frequencia ?? FREQUENCIA.mensal)
  const [data, setData] = useState(() => r?.dataInicio.slice(0, 10) ?? dataLocalISO())
  const [dataFim, setDataFim] = useState(r?.dataFim?.slice(0, 10) ?? "")
  const [erros, setErros] = useState<Record<string, string>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  // Da casa: as famílias da pessoa e com qual dividir (null = só sua).
  const [familias, setFamilias] = useState<Familia[]>([])
  const [familiaId, setFamiliaId] = useState<string | null>(r?.familiaId ?? familiaInicial ?? null)
  useEffect(() => {
    let vivo = true
    getFamilias().then((f) => { if (vivo) setFamilias(f) }).catch(() => { /* sem família, sem o interruptor */ })
    return () => { vivo = false }
  }, [])
  // Idempotency-Key: uma por abertura da tela, reusada em toda tentativa de criar.
  const [chaveEnvio] = useState(() => crypto.randomUUID())

  const receita = natureza === "receita"
  const tipo = receita ? TIPO.receita : TIPO.despesa
  const credito = !receita && meio === MEIO.credito
  const hoje = dataLocalISO()
  // Na edição o começo antigo vale (pode ter sido há mais de 12 meses); criar segue o limite.
  const limites = editando ? null : limitesDoInicio(hoje)

  const cats = useMemo(() => categorias.filter((c) => aceitaTipo(c, tipo)), [categorias, tipo])
  const subs = useMemo(() => subcategorias.filter((s) => s.categoriaId === categoriaId), [subcategorias, categoriaId])
  const cartoesCredito = useMemo(() => cartoes.filter((c) => c.temCredito && c.ativo !== false), [cartoes])
  const meios = receita ? MEIOS_RECEBIMENTO_FIXO : MEIOS_CONTA_FIXA
  const nomeConta = (id: string) => contas.find((c) => c.id === id)?.nome ?? (r && id === r.contaId ? r.contaNome : undefined)
  const nomeCartao = (id: string) => cartoesCredito.find((c) => c.id === id)?.nome ?? (r && id === r.cartaoCreditoId ? r.cartaoCreditoNome : undefined)

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
    if (atual && !aceitaTipo(atual, novoTipo)) { setCategoriaId(""); setSubcategoriaId("") }
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
          subcategoriaId: subcategoriaId || undefined,
          contaId: credito ? undefined : contaId,
          cartaoCreditoId: credito ? cartaoId : undefined,
          meioPagamento: credito ? undefined : m,
          frequencia,
          dia: Number(data.slice(8, 10)),
          dataInicio: data,
          dataFim: dataFim || undefined,
          familiaId: receita ? null : familiaId,
        })
        id = r.id
      } else {
        const criada = await createRecorrente({
          descricao: desc, valor: v, tipo, categoriaId,
          subcategoriaId: subcategoriaId || undefined,
          contaId: credito ? undefined : contaId,
          cartaoCreditoId: credito ? cartaoId : undefined,
          meioPagamento: credito ? undefined : m,
          frequencia,
          // O back gera pelas datas; "dia" é o dia do mês do começo (lido do texto, sem fuso).
          dia: Number(data.slice(8, 10)),
          dataInicio: data,
          dataFim: dataFim || undefined,
          familiaId: receita ? null : familiaId,
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
  const subNome = subs.find((s) => s.id === subcategoriaId)?.nome ?? (r && subcategoriaId === r.subcategoriaId ? r.subcategoriaNome : undefined)
  const meioRotulo = meios.find((x) => x.valor === meio)?.rotulo
  const detalhe = [origemNome, subNome ? `${catNome} › ${subNome}` : catNome, credito ? undefined : meioRotulo].filter(Boolean).join(" · ")
  const efeito = data
    ? `${descreverRegra(frequencia, data, dataFim || undefined)}.${origemNome
      ? credito ? ` Cada cobrança vai pra fatura do ${origemNome}.` : ` ${receita ? "Entra no" : "Sai do"} ${origemNome}.`
      : ""}`
    : null
  const rotuloSalvar = salvando ? "Salvando…" : editando ? "Salvar" : "Criar conta fixa"
  const podeDividir = !receita && familias.length > 0
  const nomeFamilia = (familias.find((f) => f.id === familiaId) ?? familias[0])?.nome

  return (
    <Formulario layout="lateral" onSubmit={() => { void enviar() }}>
      <Campos>
        {erro && <p className={styles.alerta} role="alert">{erro}</p>}

        <Segmentos ariaLabel="Tipo da conta fixa" cheio valor={natureza} onChange={trocarNatureza} opcoes={NATUREZAS} />

        <Campo rotulo="Valor" erro={erros.valor}>
          <EntradaValor valor={valor} tom={tom} autoFocus={!editando} onChange={(x) => { setValor(x); limpa("valor") }} />
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

        <LinhaCampos>
          <Campo rotulo="Categoria" erro={erros.categoria}>
            <Selecao valor={categoriaId} placeholder="Escolha a categoria"
              onChange={(x) => { setCategoriaId(x); setSubcategoriaId(""); limpa("categoria") }}
              opcoes={cats.map((c) => ({ valor: c.id, rotulo: c.descricao }))} />
          </Campo>
          <Campo rotulo="Subcategoria">
            <Selecao valor={subcategoriaId} desabilitado={subs.length === 0}
              placeholder={subs.length === 0 ? "Nenhuma" : "Opcional"} onChange={setSubcategoriaId}
              opcoes={subs.length === 0 ? [] : [{ valor: "", rotulo: "Sem subcategoria" }, ...subs.map((s) => ({ valor: s.id, rotulo: s.nome }))]} />
          </Campo>
        </LinhaCampos>
      </Campos>

      <Lado>
        <PreviaLancamento descricao={descricao} valor={v} tom={tom} detalhe={detalhe} efeito={efeito}
          etiquetas={<Etiqueta>Conta fixa</Etiqueta>} />

        {podeDividir && (
          <Bloco titulo="Opções" className={styles.opcoes}>
            <Interruptor ligado={!!familiaId} onChange={(on) => setFamiliaId(on ? (familiaId ?? familias[0].id) : null)}>
              Dividir com {familias.length > 1 && !familiaId ? "a família" : nomeFamilia}
            </Interruptor>
            {familiaId && familias.length > 1 && (
              <Selecao tamanho="sm" ariaLabel="Família" valor={familiaId} onChange={setFamiliaId}
                opcoes={familias.map((f) => ({ valor: f.id, rotulo: f.nome }))} />
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
