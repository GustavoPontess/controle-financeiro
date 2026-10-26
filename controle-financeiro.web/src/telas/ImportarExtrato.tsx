// Importar extrato (/importar) — três momentos na mesma tela:
// 1. a conta e o arquivo (OFX ou CSV, até 2 MB);
// 2. só no CSV que o app não reconheceu: "qual coluna é o quê" (data, descrição, valor numa coluna ou entrada e
//    saída), com as primeiras linhas do arquivo pra ver. A escolha é lembrada pra essa conta: da próxima vez o
//    mesmo banco entra direto;
// 3. a prévia: cada linha marcada pra entrar, com a categoria sugerida (troca na linha). O que já está no app vem
//    desmarcado. Importar grava tudo numa transação só; a chave de idempotência nasce com a prévia, então repetir
//    (clique duplo, rede que caiu) não importa de novo.
// Planilha de banco não tem padrão nem documentação: por isso a tela pergunta em vez de o código adivinhar.
import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { CheckCircle2, FileText, RotateCcw, Upload } from "lucide-react"
import { getContas } from "../services/contaService"
import { getCategories } from "../services/categoryService"
import { confirmarImportacao, previewImportacao } from "../services/importacaoService"
import { mensagemDeErro } from "../api/cliente"
import type { Conta } from "../types/Conta"
import type { Category } from "../types/Category"
import type { ExtratoLinha, LinhaImportar, MapeamentoCsv, PreviewImportacao, ResultadoImportacao } from "../types/Importacao"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import { Dinheiro } from "../componentes/Dinheiro"
import Etiqueta from "../componentes/Etiqueta"
import { LinhaCampos, RodapeFormulario } from "../componentes/Formulario"
import Marcar from "../componentes/Marcar"
import Selecao from "../componentes/Selecao"
import { rotuloMesFatura } from "../dominio/fatura"
import { aceitaTipo } from "../dominio/categoria"
import { TIPO } from "../dominio/transacao"
import styles from "./ImportarExtrato.module.css"

const TAMANHO_MAX = 2 * 1024 * 1024
const dataBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`

/** O que foi pra conta (pra tela final): o período e quanto entrou e saiu. Pix no crédito e pagamento de fatura
 *  não são ganho nem gasto, então ficam fora das somas. */
type Resumo = { resultado: ResultadoImportacao; de: string; ate: string; entrou: number; saiu: number }
function resumir(r: ResultadoImportacao, enviadas: LinhaImportar[], previa: PreviewImportacao): Resumo {
  const datas = enviadas.map((l) => l.data.slice(0, 10)).sort()
  const conta = (l: LinhaImportar) => !previa.linhas.some((p) => p.descricao === l.descricao && p.data === l.data
    && p.valor === l.valor && (p.pixNoCredito || p.pagaFaturaFechamento))
  const soma = (tipo: number) => enviadas.filter((l) => l.tipo === tipo && conta(l)).reduce((t, l) => t + l.valor, 0)
  return { resultado: r, de: datas[0] ?? "", ate: datas[datas.length - 1] ?? "", entrou: soma(TIPO.receita), saiu: soma(TIPO.despesa) }
}

export default function ImportarExtrato() {
  const navigate = useNavigate()
  const [contas, setContas] = useState<Conta[] | null>(null)
  const [categorias, setCategorias] = useState<Category[]>([])
  const [erroCarga, setErroCarga] = useState(false)

  const [contaId, setContaId] = useState("")
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [erros, setErros] = useState<{ conta?: string; arquivo?: string }>({})
  const [erro, setErro] = useState<string | null>(null)
  const [lendo, setLendo] = useState(false)
  const [previa, setPrevia] = useState<PreviewImportacao | null>(null)
  // O que a pessoa escolheu nas colunas (só esse vai pra ser lembrado na conta).
  const [mapaEscolhido, setMapaEscolhido] = useState<MapeamentoCsv | null>(null)
  const [trocandoColunas, setTrocandoColunas] = useState(false)
  const [resumo, setResumo] = useState<Resumo | null>(null)
  // Cada leitura nova remonta a prévia (marcações e categorias recomeçam, chave nova).
  const [leituraN, setLeituraN] = useState(0)
  const entradaArquivo = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let vivo = true
    Promise.all([getContas(), getCategories()])
      .then(([cts, cats]) => { if (!vivo) return; setContas(cts); setCategorias(cats); if (cts.length === 1) setContaId(cts[0].id) })
      .catch(() => { if (vivo) setErroCarga(true) })
    return () => { vivo = false }
  }, [])

  const ler = async (mapeamento?: MapeamentoCsv) => {
    setErro(null)
    const e: typeof erros = {}
    if (!contaId) e.conta = "Escolha a conta"
    if (!arquivo) e.arquivo = "Escolha o arquivo"
    else if (!/\.(ofx|csv)$/i.test(arquivo.name)) e.arquivo = "Envie um arquivo .ofx ou .csv"
    else if (arquivo.size > TAMANHO_MAX) e.arquivo = "O arquivo passa de 2 MB"
    setErros(e)
    if (Object.keys(e).length > 0) return
    setLendo(true)
    try {
      const p = await previewImportacao(contaId, arquivo!, mapeamento)
      if (mapeamento && p.precisaMapear) setErro("Com essas colunas não deu pra ler nenhum lançamento. Confira e tente de novo.")
      setPrevia(p)
      setLeituraN((n) => n + 1)
      setMapaEscolhido(mapeamento ?? null)
      setTrocandoColunas(false)
    } catch (err) {
      setErro(mensagemDeErro(err))
    } finally {
      setLendo(false)
    }
  }

  const recomecar = () => { setPrevia(null); setMapaEscolhido(null); setResumo(null); setArquivo(null); setErro(null); setTrocandoColunas(false) }
  const conta = contas?.find((c) => c.id === contaId)

  if (erroCarga) return <div className={styles.pagina}><p className={styles.alerta} role="alert">Não foi possível carregar suas contas. Recarregue a página.</p></div>
  if (!contas) return <div className={styles.pagina}><Bloco><Esqueleto linhas={3} altura={18} /></Bloco></div>

  if (resumo) {
    const { resultado: r } = resumo
    // As somas só batem quando entrou tudo o que foi enviado (nada pulado nem repetido).
    const somasExatas = !r.repetido && !r.jaExistiam
    // Tudo o que foi marcado já estava na conta (o servidor pulou pelo código do banco).
    const nadaNovo = !r.repetido && r.importadas === 0 && !!r.jaExistiam
    return (
      <div className={styles.pagina}>
        <Bloco className={styles.pronto}>
          <span className={styles.prontoIcone} data-repetido={r.repetido || nadaNovo || undefined} aria-hidden="true"><CheckCircle2 size={26} strokeWidth={2} /></span>
          <h2 className={styles.prontoTitulo}>
            {r.repetido ? "Esse extrato já tinha sido importado"
              : nadaNovo ? "Nada novo pra importar"
              : `${r.importadas} ${r.importadas === 1 ? "lançamento importado" : "lançamentos importados"}`}
          </h2>
          <p className={styles.prontoTexto}>
            {r.repetido ? "Nada foi gravado de novo."
              : nadaNovo ? <>{r.jaExistiam === 1 ? "O lançamento já estava" : `Os ${r.jaExistiam} lançamentos já estavam`} em <strong>{conta?.nome}</strong>.</>
              : <>Em <strong>{conta?.nome}</strong>{resumo.de && <>, de {dataBR(resumo.de)} a {dataBR(resumo.ate)}</>}.</>}
          </p>
          {somasExatas && (resumo.entrou > 0 || resumo.saiu > 0) && (
            <div className={styles.prontoNumeros}>
              <div><span>Entrou</span><Dinheiro valor={resumo.entrou} tom="positivo" className={styles.prontoValor} /></div>
              <div><span>Saiu</span><Dinheiro valor={resumo.saiu} tom="negativo" className={styles.prontoValor} /></div>
            </div>
          )}
          {!!r.jaExistiam && !nadaNovo && (
            <p className={styles.prontoTexto}>{r.jaExistiam} {r.jaExistiam === 1 ? "já estava" : "já estavam"} na conta e {r.jaExistiam === 1 ? "ficou" : "ficaram"} de fora.</p>
          )}
          <div className={styles.prontoAcoes}>
            <Botao tamanho="lg" onClick={recomecar} icone={<RotateCcw size={15} strokeWidth={2.25} aria-hidden="true" />}>Importar outro</Botao>
            <Botao tamanho="lg" variante="primario" onClick={() => navigate("/transacoes", { state: { filtros: { contaId } } })}>Ver em Transações</Botao>
          </div>
        </Bloco>
      </div>
    )
  }

  return (
    <div className={styles.pagina}>
      <Bloco>
        {erro && <p className={styles.alerta} role="alert">{erro}</p>}
        <LinhaCampos colunas="minmax(0, 1fr) minmax(0, 1.4fr) auto">
          <Campo rotulo="Conta" erro={erros.conta}>
            <Selecao valor={contaId} placeholder={contas.length === 0 ? "Nenhuma conta" : "Escolha a conta"} desabilitado={!!previa || contas.length === 0}
              onChange={(x) => { setContaId(x); setErros((v) => ({ ...v, conta: undefined })) }}
              opcoes={contas.map((c) => ({ valor: c.id, rotulo: c.nome }))} />
          </Campo>
          <Campo rotulo="Arquivo do banco" erro={erros.arquivo} grupo>
            <input ref={entradaArquivo} type="file" accept=".ofx,.csv" hidden aria-label="Arquivo do extrato"
              onChange={(e) => { setArquivo(e.target.files?.[0] ?? null); setErros((v) => ({ ...v, arquivo: undefined })); e.target.value = "" }} />
            <Botao tamanho="lg" className={styles.escolherArquivo} disabled={!!previa} onClick={() => entradaArquivo.current?.click()}
              icone={<FileText size={15} strokeWidth={2.25} aria-hidden="true" />}>
              {arquivo ? arquivo.name : "Escolher arquivo (OFX ou CSV)"}
            </Botao>
          </Campo>
          <div className={styles.acaoLer}>
            {previa
              ? <Botao tamanho="lg" onClick={recomecar} icone={<RotateCcw size={15} strokeWidth={2.25} aria-hidden="true" />}>Outro arquivo</Botao>
              : <Botao tamanho="lg" variante="primario" disabled={lendo} onClick={() => { void ler() }}
                icone={<Upload size={15} strokeWidth={2.25} aria-hidden="true" />}>{lendo ? "Lendo…" : "Ler extrato"}</Botao>}
          </div>
        </LinhaCampos>
      </Bloco>

      {previa && (previa.precisaMapear || trocandoColunas) && previa.colunas && (
        <EscolherColunas titulo={trocandoColunas ? "Qual coluna é o quê" : "Não reconhecemos as colunas desse arquivo"}
          colunas={previa.colunas} amostra={previa.amostra ?? []} inicial={previa.mapeamento ?? mapaEscolhido}
          lendo={lendo} aoLer={(m) => { void ler(m) }} aoCancelar={trocandoColunas ? () => setTrocandoColunas(false) : undefined} />
      )}

      {previa && !previa.precisaMapear && !trocandoColunas && (
        <Previa key={leituraN} previa={previa} conta={conta} categorias={categorias}
          aoTrocarColunas={previa.formato === "csv" ? () => setTrocandoColunas(true) : undefined}
          aoCancelar={recomecar}
          aoImportar={async (linhas, chave) => {
            const r = await confirmarImportacao(contaId, linhas, chave, mapaEscolhido, previa.assinatura)
            setResumo(resumir(r, linhas, previa))
          }} />
      )}
    </div>
  )
}

// ── Qual coluna é o quê (CSV não reconhecido) ─────────────────────────────────────────────
// Do jeito que o mercado faz (YNAB, Actual, Goodbudget; pesquisa de 2026-10-17): a prévia do arquivo em cima, do
// jeito que ele veio, e embaixo um campo por informação que o app precisa (Data, Descrição, Dinheiro que entrou,
// Dinheiro que saiu), cada um uma seleção das colunas do arquivo com um exemplo ao lado. A coluna escolhida ganha
// a etiqueta no cabeçalho da prévia. Uma coluna só de valor (Nubank: "Valor" com sinal) é a mesma em entrou e em
// saiu, igual ao YNAB; escolher uma preenche a outra. Sem "valor com sinal" nem "não usar" pra entender; a prévia
// de como vai ficar fica sempre à vista. Antes disso vieram três versões que o Gustavo não entendeu de primeira
// (campos soltos sem ligação com a tabela, a escolha no cabeçalho de cada coluna, uma grade de rádio).

type Linha = "data" | "descricao" | "entrou" | "saiu"
type Escolha = Record<Linha, number | null>
const LINHAS: { chave: Linha; rotulo: string; etiqueta: string }[] = [
  { chave: "data", rotulo: "Data", etiqueta: "Data" },
  { chave: "descricao", rotulo: "Descrição", etiqueta: "Descrição" },
  { chave: "entrou", rotulo: "Dinheiro que entrou", etiqueta: "Entrou" },
  { chave: "saiu", rotulo: "Dinheiro que saiu", etiqueta: "Saiu" },
]
const PARECE_DATA = /^\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}/
const PARECE_VALOR = /^[+-]?\(?\s*(R\$\s*)?[\d.,]+\)?\s*[DC-]?$/i

/** Número como o servidor lê: "1.234,56", "1,234.56", "-50.00", "150,00 D". Null se não for número. */
function lerValor(bruto: string): number | null {
  let s = bruto.trim().replace(/R\$/i, "").replace(/\s/g, "")
  if (!s) return null
  let negativo = false
  if (/[Dd]$/.test(s)) { negativo = true; s = s.slice(0, -1) } else if (/[Cc]$/.test(s)) s = s.slice(0, -1)
  if (s.endsWith("-")) { negativo = true; s = s.slice(0, -1) }
  if (s.startsWith("(") && s.endsWith(")")) { negativo = true; s = s.slice(1, -1) }
  if (!/^[+-]?[\d.,]+$/.test(s)) return null
  const v = s.lastIndexOf(","), p = s.lastIndexOf(".")
  s = v >= 0 && p >= 0 ? (v > p ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "")) : v >= 0 ? s.replace(",", ".") : s
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return negativo ? -Math.abs(n) : n
}

/** Primeiro palpite pelos exemplos: a coluna com cara de data, a única de número (entrou e saiu juntos) e o texto
 *  mais comprido. Duas colunas de número (débito/crédito) não dá pra saber qual é qual: a pessoa escolhe. */
function palpite(colunas: string[], amostra: string[][]): Escolha {
  const e: Escolha = { data: null, descricao: null, entrou: null, saiu: null }
  const celulas = (i: number) => amostra.map((l) => (l[i] ?? "").trim()).filter(Boolean)
  const data = colunas.findIndex((_, i) => celulas(i).length > 0 && celulas(i).every((c) => PARECE_DATA.test(c)))
  if (data >= 0) e.data = data
  const numeros = colunas.map((_, i) => i).filter((i) => i !== data && celulas(i).length > 0 && celulas(i).every((c) => PARECE_VALOR.test(c)))
  if (numeros.length === 1) { e.entrou = numeros[0]; e.saiu = numeros[0] }
  let texto = -1, maior = 0
  colunas.forEach((_, i) => {
    if (i === data || numeros.includes(i)) return
    const cs = celulas(i)
    if (cs.length === 0) return
    const media = cs.reduce((t, c) => t + c.length, 0) / cs.length
    if (media > maior) { maior = media; texto = i }
  })
  if (texto >= 0) e.descricao = texto
  return e
}

function escolhaDoMapa(m: MapeamentoCsv): Escolha {
  return m.valor !== null
    ? { data: m.data, descricao: m.descricao, entrou: m.valor, saiu: m.valor }
    : { data: m.data, descricao: m.descricao, entrou: m.entrada, saiu: m.saida }
}

function EscolherColunas({ titulo, colunas, amostra, inicial, lendo, aoLer, aoCancelar }: {
  titulo: string; colunas: string[]; amostra: string[][]; inicial: MapeamentoCsv | null; lendo: boolean
  aoLer: (m: MapeamentoCsv) => void; aoCancelar?: () => void
}) {
  const [escolha, setEscolha] = useState<Escolha>(() => (inicial ? escolhaDoMapa(inicial) : palpite(colunas, amostra)))
  const [inverter, setInverter] = useState(!!inicial?.inverterSinal)
  // Tentou continuar com campo vazio: o campo mostra o erro, como em qualquer formulário.
  const [tentou, setTentou] = useState(false)
  const nome = (i: number) => colunas[i] || `Coluna ${i + 1}`
  // Nas opções, cada coluna vem com o primeiro exemplo não vazio: "A · 0,30" diz mais que "A".
  const opcoes = colunas.map((_, i) => ({ valor: String(i), rotulo: nome(i), detalhe: amostra.map((l) => (l[i] ?? "").trim()).find(Boolean) }))

  const escolherColuna = (linha: Linha, v: string) => {
    const coluna = Number(v)
    setTentou(false)
    setEscolha((atual) => {
      const n: Escolha = { ...atual, [linha]: coluna }
      // Uma coluna só é uma coisa (fora entrou e saiu, que podem ser a mesma): sai de onde estava.
      const outras: Linha[] = linha === "entrou" || linha === "saiu" ? ["data", "descricao"] : LINHAS.map((l) => l.chave).filter((l) => l !== linha)
      for (const o of outras) if (n[o] === coluna) n[o] = null
      // Disse onde entrou e ainda não disse onde saiu (ou o contrário): é a mesma coluna, o caso mais comum.
      if (linha === "entrou" && n.saiu === null) n.saiu = coluna
      if (linha === "saiu" && n.entrou === null) n.entrou = coluna
      return n
    })
  }

  const juntos = escolha.entrou !== null && escolha.entrou === escolha.saiu
  const valorDaLinha = (l: string[]): number | null => {
    if (juntos) { const v = lerValor(l[escolha.entrou!] ?? ""); return v === null ? null : inverter ? -v : v }
    const e = escolha.entrou !== null ? lerValor(l[escolha.entrou] ?? "") : null
    const s = escolha.saiu !== null ? lerValor(l[escolha.saiu] ?? "") : null
    if (e) return Math.abs(e)
    if (s) return -Math.abs(s)
    return null
  }
  const temValor = escolha.entrou !== null || escolha.saiu !== null
  const etiquetas = (i: number) => {
    const e = LINHAS.filter((l) => escolha[l.chave] === i).map((l) => l.etiqueta)
    return e.includes("Entrou") && e.includes("Saiu") ? [...e.filter((x) => x !== "Entrou" && x !== "Saiu"), "Entrou e saiu"] : e
  }

  const continuar = () => {
    if (LINHAS.some((l) => escolha[l.chave] === null)) { setTentou(true); return }
    const { data, descricao, entrou, saiu } = escolha as Record<Linha, number>
    aoLer(juntos
      ? { data, descricao, valor: entrou, entrada: null, saida: null, id: inicial?.id ?? null, inverterSinal: inverter }
      : { data, descricao, valor: null, entrada: entrou, saida: saiu, id: inicial?.id ?? null, inverterSinal: false })
  }

  return (
    <Bloco titulo={titulo}>
      <div className={styles.arquivoRolagem}>
        <table className={styles.arquivo}>
          <thead>
            <tr>
              {colunas.map((c, i) => {
                const tags = etiquetas(i)
                return (
                  <th key={i} scope="col" data-usada={tags.length > 0 || undefined}>
                    <span className={styles.arquivoNome} title={c}>{nome(i)}</span>
                    {tags.map((t) => <Etiqueta key={t} className={styles.arquivoEtiqueta}>{t}</Etiqueta>)}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {amostra.slice(0, 3).map((l, j) => (
              <tr key={j}>
                {colunas.map((_, i) => {
                  const v = (l[i] ?? "").trim()
                  return <td key={i} data-usada={etiquetas(i).length > 0 || undefined} data-vazio={v ? undefined : "true"}><span title={v}>{v || "vazio"}</span></td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.escolhas}>
        <LinhaCampos>
          {LINHAS.slice(0, 2).map((l) => (
            <Campo key={l.chave} rotulo={l.rotulo} erro={tentou && escolha[l.chave] === null ? "Falta escolher" : undefined}>
              <Selecao valor={escolha[l.chave] === null ? "" : String(escolha[l.chave])} placeholder="Escolha a coluna" opcoes={opcoes}
                onChange={(v) => escolherColuna(l.chave, v)} />
            </Campo>
          ))}
        </LinhaCampos>
        <LinhaCampos>
          {LINHAS.slice(2).map((l) => (
            <Campo key={l.chave} rotulo={l.rotulo} erro={tentou && escolha[l.chave] === null ? "Falta escolher" : undefined}>
              <Selecao valor={escolha[l.chave] === null ? "" : String(escolha[l.chave])} placeholder="Escolha a coluna" opcoes={opcoes}
                onChange={(v) => escolherColuna(l.chave, v)} />
            </Campo>
          ))}
        </LinhaCampos>
      </div>

      <div className={styles.mapearPrevia}>
        <div className={styles.mapearPreviaTopo}>
          <span className={styles.mapearPreviaTitulo}>Vai ficar assim</span>
          {juntos && (
            <Botao variante="texto" onClick={() => setInverter((v) => !v)} icone={<RotateCcw size={14} strokeWidth={2.25} aria-hidden="true" />}>
              Está ao contrário? Inverter
            </Botao>
          )}
        </div>
        <ul className={styles.mapearPreviaLista} aria-label="Como as primeiras linhas vão ficar">
          {amostra.slice(0, 3).map((l, i) => {
            const v = temValor ? valorDaLinha(l) : null
            return (
              <li key={i}>
                <span className={styles.data}>{escolha.data !== null ? l[escolha.data] ?? "" : <span className={styles.mudo}>data?</span>}</span>
                <span className={styles.descricao}>{escolha.descricao !== null ? l[escolha.descricao] || "Sem descrição" : <span className={styles.mudo}>descrição?</span>}</span>
                {v === null ? <span className={styles.mudo}>{temValor ? "sem valor" : "valor?"}</span>
                  : <span className={styles.mapearPreviaValor}><span className={styles.mudo}>{v < 0 ? "saiu" : "entrou"}</span>
                    <Dinheiro valor={Math.abs(v)} tom={v < 0 ? "negativo" : "positivo"} className={styles.valor} /></span>}
              </li>
            )
          })}
        </ul>
      </div>

      <RodapeFormulario>
        {aoCancelar && <Botao onClick={aoCancelar} disabled={lendo}>Cancelar</Botao>}
        <Botao variante="primario" disabled={lendo} onClick={continuar}>{lendo ? "Lendo…" : "Continuar"}</Botao>
      </RodapeFormulario>
    </Bloco>
  )
}

// ── Prévia: o que vai entrar ────────────────────────────────────────────────────────────────

function Previa({ previa, conta, categorias, aoTrocarColunas, aoCancelar, aoImportar }: {
  previa: PreviewImportacao; conta?: Conta; categorias: Category[]
  aoTrocarColunas?: () => void; aoCancelar: () => void
  aoImportar: (linhas: Parameters<typeof confirmarImportacao>[1], chave: string) => Promise<void>
}) {
  const [marcadas, setMarcadas] = useState(() => previa.linhas.map((l) => !l.duplicada))
  const [cats, setCats] = useState(() => previa.linhas.map((l) => l.categoriaSugeridaId ?? ""))
  const [erro, setErro] = useState<string | null>(null)
  const [importando, setImportando] = useState(false)
  // Uma chave por prévia: toda tentativa de importar ESTA leitura usa a mesma.
  const [chave] = useState(() => crypto.randomUUID())

  const opcoesPorTipo = useMemo(() => {
    const de = (tipo: number) => [{ valor: "", rotulo: "Sem categoria" },
      ...categorias.filter((c) => aceitaTipo(c, tipo))
        .sort((a, b) => a.descricao.localeCompare(b.descricao, "pt-BR"))
        .map((c) => ({ valor: c.id, rotulo: c.descricao }))]
    return { [TIPO.despesa]: de(TIPO.despesa), [TIPO.receita]: de(TIPO.receita) } as Record<number, { valor: string; rotulo: string }[]>
  }, [categorias])

  const qtd = marcadas.filter(Boolean).length
  const todas = qtd === previa.linhas.length
  const marcarTodas = (on: boolean) => setMarcadas(previa.linhas.map(() => on))

  const importar = async () => {
    setErro(null)
    const linhas = previa.linhas.flatMap((l, i) => (marcadas[i]
      ? [{ data: l.data, descricao: l.descricao, valor: l.valor, tipo: l.tipo, fitId: l.fitId,
        categoriaId: l.pagaFaturaFechamento || l.pixNoCredito ? null : cats[i] || null }]
      : []))
    if (linhas.length === 0) { setErro("Marque pelo menos um lançamento."); return }
    setImportando(true)
    try {
      await aoImportar(linhas, chave)
    } catch (e) {
      setErro(mensagemDeErro(e)); setImportando(false)
    }
  }

  return (
    <Bloco semRespiro>
      <div className={styles.previaTopo}>
        <div className={styles.resumo}>
          <span><strong>{previa.total}</strong> {previa.total === 1 ? "lançamento" : "lançamentos"}{conta ? ` pra ${conta.nome}` : ""}</span>
          {previa.duplicadas > 0 && <span className={styles.resumoMudo}>{previa.duplicadas} já no app</span>}
          {previa.mapeamentoLembrado && <span className={styles.resumoMudo}>colunas lembradas desta conta</span>}
        </div>
        {aoTrocarColunas && <Botao variante="texto" onClick={aoTrocarColunas}>Trocar colunas</Botao>}
      </div>
      {erro && <p className={`${styles.alerta} ${styles.alertaLista}`} role="alert">{erro}</p>}
      <div className={styles.cabecalhoLista}>
        <Marcar marcado={todas} misto={qtd > 0 && !todas} onChange={marcarTodas} ariaLabel="Marcar todos" />
        <span>Data</span><span>Descrição</span><span>Categoria</span><span className={styles.direita}>Valor</span>
      </div>
      <ul className={styles.lista} aria-label="Lançamentos do extrato">
        {previa.linhas.map((l, i) => (
          <Linha key={i} l={l} marcada={marcadas[i]} categoria={cats[i]} opcoes={opcoesPorTipo[l.tipo] ?? []}
            aoMarcar={(on) => setMarcadas((m) => m.map((x, j) => (j === i ? on : x)))}
            aoCategoria={(c) => setCats((v) => v.map((x, j) => (j === i ? c : x)))} />
        ))}
      </ul>
      <div className={styles.pe}>
        <RodapeFormulario>
          <Botao onClick={aoCancelar} disabled={importando}>Cancelar</Botao>
          <Botao variante="primario" disabled={importando || qtd === 0} onClick={() => { void importar() }}>
            {importando ? "Importando…" : `Importar ${qtd} ${qtd === 1 ? "lançamento" : "lançamentos"}`}
          </Botao>
        </RodapeFormulario>
      </div>
    </Bloco>
  )
}

function Linha({ l, marcada, categoria, opcoes, aoMarcar, aoCategoria }: {
  l: ExtratoLinha; marcada: boolean; categoria: string; opcoes: { valor: string; rotulo: string }[]
  aoMarcar: (on: boolean) => void; aoCategoria: (c: string) => void
}) {
  const receita = l.tipo === TIPO.receita
  // Pagamento de fatura e Pix no crédito não levam categoria (não são gasto nem ganho).
  const semCategoria = !!l.pagaFaturaFechamento || !!l.pixNoCredito
  return (
    <li className={styles.linha} data-desmarcada={marcada ? undefined : "true"}>
      <Marcar marcado={marcada} onChange={aoMarcar} ariaLabel={`Importar ${l.descricao}`} />
      <span className={styles.data}>{dataBR(l.data)}</span>
      <span className={styles.texto}>
        <span className={styles.descricao} title={l.descricao}>{l.descricao}</span>
        {(l.duplicada || l.pixNoCredito || l.pagaFaturaFechamento) && (
          <span className={styles.etiquetas}>
            {l.duplicada && <Etiqueta tom="alerta">Já está no app</Etiqueta>}
            {l.pixNoCredito && <Etiqueta>Pix no crédito</Etiqueta>}
            {l.pagaFaturaFechamento && <Etiqueta>Paga a fatura de {rotuloMesFatura(l.pagaFaturaFechamento)}</Etiqueta>}
          </span>
        )}
      </span>
      <span className={styles.categoria}>
        {semCategoria ? <span className={styles.mudo}>Não é gasto nem ganho</span> : (
          <Selecao tamanho="xs" valor={categoria} placeholder="Sem categoria" ariaLabel={`Categoria de ${l.descricao}`}
            desabilitado={!marcada} onChange={aoCategoria} opcoes={opcoes} />
        )}
      </span>
      <Dinheiro valor={l.valor} tom={receita ? "positivo" : "negativo"} className={styles.valor} />
    </li>
  )
}
