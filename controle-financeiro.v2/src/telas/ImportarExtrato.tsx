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
import Segmentos from "../componentes/Segmentos"
import Selecao from "../componentes/Selecao"
import { rotuloMesFatura } from "../dominio/fatura"
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
    return (
      <div className={styles.pagina}>
        <Bloco className={styles.pronto}>
          <span className={styles.prontoIcone} data-repetido={r.repetido || undefined} aria-hidden="true"><CheckCircle2 size={26} strokeWidth={2} /></span>
          <h2 className={styles.prontoTitulo}>
            {r.repetido ? "Esse extrato já tinha sido importado" : `${r.importadas} ${r.importadas === 1 ? "lançamento importado" : "lançamentos importados"}`}
          </h2>
          <p className={styles.prontoTexto}>
            {r.repetido ? "Nada foi gravado de novo." : <>Em <strong>{conta?.nome}</strong>{resumo.de && <>, de {dataBR(resumo.de)} a {dataBR(resumo.ate)}</>}.</>}
          </p>
          {somasExatas && (resumo.entrou > 0 || resumo.saiu > 0) && (
            <div className={styles.prontoNumeros}>
              <div><span>Entrou</span><Dinheiro valor={resumo.entrou} tom="positivo" className={styles.prontoValor} /></div>
              <div><span>Saiu</span><Dinheiro valor={resumo.saiu} tom="negativo" className={styles.prontoValor} /></div>
            </div>
          )}
          {!!r.jaExistiam && (
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
        <EscolherColunas colunas={previa.colunas} amostra={previa.amostra ?? []} inicial={previa.mapeamento ?? mapaEscolhido}
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

type ModoValor = "uma" | "duas"

function EscolherColunas({ colunas, amostra, inicial, lendo, aoLer, aoCancelar }: {
  colunas: string[]; amostra: string[][]; inicial: MapeamentoCsv | null; lendo: boolean
  aoLer: (m: MapeamentoCsv) => void; aoCancelar?: () => void
}) {
  const ix = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n))
  const [data, setData] = useState(ix(inicial?.data))
  const [descricao, setDescricao] = useState(ix(inicial?.descricao))
  const [modo, setModo] = useState<ModoValor>(inicial && inicial.valor === null && inicial.entrada !== null ? "duas" : "uma")
  const [valor, setValor] = useState(ix(inicial?.valor))
  const [entrada, setEntrada] = useState(ix(inicial?.entrada))
  const [saida, setSaida] = useState(ix(inicial?.saida))
  const [inverter, setInverter] = useState(!!inicial?.inverterSinal)
  const [erros, setErros] = useState<Record<string, string>>({})
  const opcoes = colunas.map((c, i) => ({ valor: String(i), rotulo: c }))

  const continuar = () => {
    const e: Record<string, string> = {}
    if (!data) e.data = "Escolha a coluna da data"
    if (!descricao) e.descricao = "Escolha a coluna da descrição"
    if (modo === "uma" && !valor) e.valor = "Escolha a coluna do valor"
    if (modo === "duas" && !entrada) e.entrada = "Escolha a coluna de entrada"
    if (modo === "duas" && !saida) e.saida = "Escolha a coluna de saída"
    const usadas = [data, descricao, ...(modo === "uma" ? [valor] : [entrada, saida])].filter(Boolean)
    if (Object.keys(e).length === 0 && new Set(usadas).size !== usadas.length) e.geral = "Cada coluna só pode ter um papel."
    setErros(e)
    if (Object.keys(e).length > 0) return
    aoLer({
      data: Number(data), descricao: Number(descricao),
      valor: modo === "uma" ? Number(valor) : null,
      entrada: modo === "duas" ? Number(entrada) : null,
      saida: modo === "duas" ? Number(saida) : null,
      id: inicial?.id ?? null,
      inverterSinal: modo === "uma" && inverter,
    })
  }
  const limpa = (k: string) => setErros((v) => { const n = { ...v }; delete n[k]; delete n.geral; return n })

  return (
    <Bloco titulo="Qual coluna é o quê">
      <div className={styles.amostraRolagem}>
        <table className={styles.amostra}>
          <thead><tr>{colunas.map((c, i) => <th key={i} scope="col">{c}</th>)}</tr></thead>
          <tbody>{amostra.map((l, i) => <tr key={i}>{colunas.map((_, j) => <td key={j}>{l[j] ?? ""}</td>)}</tr>)}</tbody>
        </table>
      </div>
      {erros.geral && <p className={styles.alerta} role="alert">{erros.geral}</p>}
      <LinhaCampos>
        <Campo rotulo="Data" erro={erros.data}>
          <Selecao valor={data} placeholder="Escolha" onChange={(x) => { setData(x); limpa("data") }} opcoes={opcoes} />
        </Campo>
        <Campo rotulo="Descrição" erro={erros.descricao}>
          <Selecao valor={descricao} placeholder="Escolha" onChange={(x) => { setDescricao(x); limpa("descricao") }} opcoes={opcoes} />
        </Campo>
      </LinhaCampos>
      <Segmentos ariaLabel="Como vem o valor" valor={modo} onChange={(m) => { setModo(m); setErros({}) }}
        opcoes={[{ valor: "uma", rotulo: "Valor numa coluna" }, { valor: "duas", rotulo: "Entrada e saída separadas" }]} />
      {modo === "uma" ? (
        <LinhaCampos>
          <Campo rotulo="Valor" erro={erros.valor}>
            <Selecao valor={valor} placeholder="Escolha" onChange={(x) => { setValor(x); limpa("valor") }} opcoes={opcoes} />
          </Campo>
          <div className={styles.inverter}>
            <Marcar marcado={inverter} onChange={setInverter}>Saída aparece sem o sinal de menos</Marcar>
          </div>
        </LinhaCampos>
      ) : (
        <LinhaCampos>
          <Campo rotulo="Entrada" erro={erros.entrada}>
            <Selecao valor={entrada} placeholder="Escolha" onChange={(x) => { setEntrada(x); limpa("entrada") }} opcoes={opcoes} />
          </Campo>
          <Campo rotulo="Saída" erro={erros.saida}>
            <Selecao valor={saida} placeholder="Escolha" onChange={(x) => { setSaida(x); limpa("saida") }} opcoes={opcoes} />
          </Campo>
        </LinhaCampos>
      )}
      <RodapeFormulario>
        {aoCancelar && <Botao onClick={aoCancelar} disabled={lendo}>Cancelar</Botao>}
        <Botao variante="primario" disabled={lendo} onClick={continuar}>{lendo ? "Lendo…" : "Ler com essas colunas"}</Botao>
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
      ...categorias.filter((c) => c.finalidade === 3 || c.finalidade === tipo)
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
