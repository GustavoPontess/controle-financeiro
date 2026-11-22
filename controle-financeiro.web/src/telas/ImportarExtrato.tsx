// Importar extrato (/importar). UMA moldura do começo ao fim (Gustavo, 2026-11-22: "as telas mudam demais de uma pra
// outra"): faixa em cima, lista à esquerda, conteúdo à direita.
// 1. Começo: só as contas ("De qual conta é o extrato?"). Escolheu, a lista vai pra esquerda e a área do arquivo entra
//    ao lado (OFX ou CSV, até 2 MB cada; vários de uma vez, o repetido entre eles sai). Escolher o arquivo já lê.
// 2. Só no CSV que o app não reconheceu: "qual coluna é o quê" (telas/ColunasDoArquivo). A escolha é lembrada pra essa
//    conta. No CSV reconhecido, "Colunas do arquivo" abre a mesma peça NO LUGAR da fila.
// 3. A fila ("a ideia é categorizar tudo"): em cima a faixa (conta, arquivos, os números e o Importar, sempre à
//    vista); à esquerda os lugares (Pendentes em cima, Resolvidos embaixo; o que é só registro, "Pagamento de fatura",
//    "Pix no crédito", "Entre suas contas", "Já está no app", entra como item sem categoria); à direita o lançamento
//    com os MESMOS campos de Nova transação (as peças de telas/CamposLancamento). Lançamento que não é como o resto do
//    lugar a pessoa SEPARA (categoria só dele, sem mudar o que o app lembra do lugar) e os separados ela JUNTA num
//    grupo dela. Lugar com sugestão forte (regra da pessoa ou coletivo) já vem resolvido.
// 4. Dá pra importar com pendente: o que entrou sem categoria fica na fila de /pendentes. Importou, a tela volta pro
//    começo com uma faixa dizendo o que entrou. Importar grava tudo numa transação só; a chave de idempotência nasce
//    com a prévia, então repetir (clique duplo, rede que caiu) não importa de novo.
// Planilha de banco não tem padrão nem documentação: por isso a tela pergunta em vez de o código adivinhar.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { AlertTriangle, Check, CheckCircle2, ChevronRight, Files, FileText, Layers, Minus, Pencil, Search, Split, TextCursorInput, Undo2, X } from "lucide-react"
import { getContas } from "../services/contaService"
import { getCategories } from "../services/categoryService"
import { getSubcategories } from "../services/subcategoryService"
import { confirmarImportacao, ensinarNome, getImportacoesAnteriores, previewImportacao } from "../services/importacaoService"
import MarcarNome from "./MarcarNome"
import { BarraDev, useEstadoDev } from "../dev/BarraDev"
import { GRUPOS_IMPORTAR, estadoImportar } from "../dev/estadosImportar"
import { enviarAnexo } from "../services/anexoService"
import { mensagemDeErro } from "../api/cliente"
import type { Conta } from "../types/Conta"
import type { Category } from "../types/Category"
import type { Subcategory } from "../types/Subcategory"
import type { Ponto } from "../types/Transaction"
import Anexos from "../componentes/Anexos"
import Localizacao from "../componentes/Localizacao"
import Cupom, { LinhaCupom } from "../componentes/Cupom"
import type { ArquivoLido, ExtratoLinha, ImportacaoAnterior, LinhaImportar, MapeamentoCsv, PreviewImportacao, ResultadoImportacao } from "../types/Importacao"
import BarraProgresso from "../componentes/BarraProgresso"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import LogoMarca from "../componentes/LogoMarca"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import Entrada from "../componentes/Entrada"
import SoltarArquivos from "../componentes/SoltarArquivos"
import { Dinheiro } from "../componentes/Dinheiro"
import Formulario, { LinhaCampos, RodapeFormulario } from "../componentes/Formulario"
import { CampoDescricao, CampoFixo, CampoMeio, CampoValor, CamposCategoria } from "./CamposLancamento"
import { moneyParaCampo } from "../utils/money"
import ColunasDoArquivo from "./ColunasDoArquivo"
import { GrupoFicha, InicialFicha, LinhaFicha, ListaFicha } from "../componentes/ListaFicha"
import Marcar from "../componentes/Marcar"
import { rotuloMesFatura } from "../dominio/fatura"
import { marcaDaConta } from "../dominio/conta"
import { nomeLegivel } from "../dominio/lugar"
import { recarregarPendentes } from "../estado/pendentes"
import { aceitaTipo, ehOutros } from "../dominio/categoria"
import { MEIOS_CONTA, MEIOS_RECEBIMENTO, TIPO, horaValida } from "../dominio/transacao"
import { diaDeInstante, mascararHora } from "../utils/dateTime"
import styles from "./ImportarExtrato.module.css"

const TAMANHO_MAX = 2 * 1024 * 1024
// O limite é o que a pessoa VÊ: um cartão por extrato (o OFX e o CSV do mesmo mês são um cartão só, Gustavo
// 2026-11-07). O servidor aceita o dobro em arquivos (ImportacaoService.MaxArquivos), pra caber o par de cada cartão.
const MAX_EXTRATOS = 24
const MAX_ARQUIVOS = MAX_EXTRATOS * 2
/** O nome do lugar legível (regra em dominio/lugar.ts): só na tela, nada gravado muda. */
const nomeNaTela = nomeLegivel
const dataBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
// Só registro: mexe no saldo e não é ganho nem gasto, então não tem categoria. Pagamento de fatura (os gastos estão
// na fatura), o valor que o cartão pôs na conta pro Pix no crédito (o gasto é o Pix) e dinheiro entre suas contas.
const soRegistro = (l: ExtratoLinha) => !!l.pagaFaturaFechamento || l.natureza === "pagamento-fatura" || !!l.pixNoCredito || l.natureza === "entre-contas"

/** O que foi pra conta (pra tela final): o período e quanto entrou e saiu. Pix no crédito, pagamento de fatura,
 *  dinheiro entre suas contas e empréstimo não são ganho nem gasto, então ficam fora das somas. */
type Resumo = { resultado: ResultadoImportacao; de: string; ate: string; entrou: number; saiu: number; anexosFalharam?: number; semCategoria?: number
  /** A conta que recebeu (a faixa fica na tela do começo, onde a pessoa pode escolher outra). */
  contaId?: string; contaNome?: string }
function resumir(r: ResultadoImportacao, enviadas: LinhaImportar[], previa: PreviewImportacao): Resumo {
  const datas = enviadas.map((l) => l.data.slice(0, 10)).sort()
  const conta = (l: LinhaImportar) => !previa.linhas.some((p) => p.descricao === l.descricao && p.data === l.data
    && p.valor === l.valor && (soRegistro(p) || p.natureza === "emprestimo"))
  const soma = (tipo: number) => enviadas.filter((l) => l.tipo === tipo && conta(l)).reduce((t, l) => t + l.valor, 0)
  return { resultado: r, de: datas[0] ?? "", ate: datas[datas.length - 1] ?? "", entrou: soma(TIPO.receita), saiu: soma(TIPO.despesa),
    // O que foi pra conta sem categoria (o que é só registro e empréstimo não leva categoria): a fila que ficou pra depois.
    semCategoria: enviadas.filter((l) => !l.categoriaId && conta(l)).length }
}

export default function ImportarExtrato() {
  const navigate = useNavigate()
  const [contas, setContas] = useState<Conta[] | null>(null)
  const [categorias, setCategorias] = useState<Category[]>([])
  const [subcategorias, setSubcategorias] = useState<Subcategory[]>([])
  const [erroCarga, setErroCarga] = useState(false)
  // As importações já feitas (a lista da primeira tela). Se não carregar, a tela só fica sem a lista.
  const [anteriores, setAnteriores] = useState<ImportacaoAnterior[]>([])
  const carregarAnteriores = () => { getImportacoesAnteriores().then(setAnteriores).catch(() => { /* segue sem */ }) }

  const [contaId, setContaId] = useState("")
  // Vários arquivos da mesma conta de uma vez (a Nubank só exporta mês a mês).
  const [arquivos, setArquivos] = useState<File[]>([])
  const [erros, setErros] = useState<{ conta?: string; arquivo?: string }>({})
  const [erro, setErro] = useState<string | null>(null)
  const [lendo, setLendo] = useState(false)
  const [previa, setPrevia] = useState<PreviewImportacao | null>(null)
  // O que a pessoa escolheu nas colunas (só esse vai pra ser lembrado na conta).
  const [mapaEscolhido, setMapaEscolhido] = useState<MapeamentoCsv | null>(null)
  const [resumo, setResumo] = useState<Resumo | null>(null)
  // Cada leitura nova remonta a prévia (chave nova). Adicionar ou tirar arquivo relê tudo, mas o que a pessoa já
  // escolheu (marcado, categoria, lugar respondido, aba) passa pra prévia nova pelas linhas que continuam lá.
  const [leituraN, setLeituraN] = useState(0)
  const escolhas = useRef<Escolhas | null>(null)
  const [anterior, setAnterior] = useState<Escolhas | null>(null)
  // O arquivo escolhido nos cartões de cima: a prévia mostra só os lançamentos dele (null = todos).
  const [doc, setDoc] = useState<string | null>(null)
  // "Trocar conta ou arquivos" volta pro começo (a fila fica guardada); as colunas do CSV reconhecido abrem a pedido,
  // no lugar da fila.
  const [topoAberto, setTopoAberto] = useState(false)
  const [colunasAbertas, setColunasAbertas] = useState(false)
  const [buscaConta, setBuscaConta] = useState("")

  useEffect(() => {
    let vivo = true
    Promise.all([getContas(), getCategories()])
      .then(([cts, cats]) => { if (!vivo) return; setContas(cts); setCategorias(cats); if (cts.length === 1) setContaId(cts[0].id) })
      .catch(() => { if (vivo) setErroCarga(true) })
    // Subcategoria é opcional: sem ela a ficha só não mostra a escolha.
    getSubcategories().then((s) => { if (vivo) setSubcategorias(s) }).catch(() => { /* segue sem */ })
    getImportacoesAnteriores().then((a) => { if (vivo) setAnteriores(a) }).catch(() => { /* segue sem */ })
    return () => { vivo = false }
  }, [])
  // DEV: cada passo do Importar pelo painel (dados de exemplo, sem arquivo nem API).
  const [estadoDev, setEstadoDev] = useState("")
  const [nomeAbertoDev, setNomeAbertoDev] = useState(false)
  useEstadoDev(import.meta.env.DEV ? (e) => {
    const s = estadoImportar(e)
    if (!s) return
    setEstadoDev(e); setErro(null); setErros({}); setMapaEscolhido(null); setDoc(null)
    if (e === "inicio") setContaId("")
    escolhas.current = null; setAnterior(null)
    setArquivos(s.arquivos); setPrevia(s.previa); setResumo(s.resumo ?? null)
    setNomeAbertoDev(!!s.nomeAberto); setTopoAberto(!!s.topoAberto); setColunasAbertas(!!s.colunasAbertas); setLeituraN((n) => n + 1)
  } : undefined)
  // DEV: depois de ler já existe conta (ela vem primeiro); os estados de exemplo usam a primeira.
  useEffect(() => {
    // (Também depois de importar: na vida real a conta continua escolhida quando a tela volta pro começo.)
    if (import.meta.env.DEV && estadoDev && (previa || resumo || estadoDev === "conta") && !contaId && contas?.length) setContaId(contas[0].id)
  }, [estadoDev, previa, resumo, contaId, contas])
  const painelDev = import.meta.env.DEV && <BarraDev grupos={GRUPOS_IMPORTAR} atual={estadoDev} />

  const ler = async (mapeamento?: MapeamentoCsv, lista: File[] = arquivos, conta: string = contaId) => {
    setErro(null)
    const e: typeof erros = {}
    if (!conta) e.conta = "Escolha a conta"
    const fora = lista.find((a) => !/\.(ofx|csv)$/i.test(a.name))
    const grande = lista.find((a) => a.size > TAMANHO_MAX)
    if (lista.length === 0) e.arquivo = "Escolha o arquivo"
    else if (fichasDosArquivos(lista).length > MAX_EXTRATOS || lista.length > MAX_ARQUIVOS) e.arquivo = `Escolha até ${MAX_EXTRATOS} extratos`
    else if (fora) e.arquivo = lista.length === 1 ? "Envie um arquivo .ofx ou .csv" : `${fora.name} não é .ofx nem .csv`
    else if (grande) e.arquivo = lista.length === 1 ? "O arquivo passa de 2 MB" : `${grande.name} passa de 2 MB`
    // Vazio no meio de outros vai pro servidor e volta listado com o motivo; sozinho, não tem o que ler.
    else if (lista.every((a) => a.size === 0)) e.arquivo = lista.length === 1 ? "O arquivo está vazio" : "Os arquivos estão vazios"
    setErros(e)
    if (Object.keys(e).length > 0) return false
    setLendo(true)
    try {
      const p = await previewImportacao(conta || null, lista.length === 1 ? lista[0] : lista, mapeamento)
      if (mapeamento && p.precisaMapear) setErro("Com essas colunas não deu pra ler nenhum lançamento. Confira e tente de novo.")
      setAnterior(previa ? escolhas.current : null)
      setArquivos(lista)
      setResumo(null)
      setPrevia(p)
      setLeituraN((n) => n + 1)
      setMapaEscolhido(mapeamento ?? null)
      return true
    } catch (err) {
      setErro(mensagemDeErro(err))
      return false
    } finally {
      setLendo(false)
    }
  }

  const recomecar = () => {
    setPrevia(null); setMapaEscolhido(null); setResumo(null); setArquivos([]); setErro(null)
    setTopoAberto(false); setColunasAbertas(false)
    escolhas.current = null; setAnterior(null)
  }
  // Escolher o arquivo já lê (não existe "Ler extrato"). Mais arquivos somam aos que já estão (o mesmo nome entra uma
  // vez) e somar ou tirar relê na hora, sem perder o que a pessoa já escolheu na fila.
  const juntar = (novos: File[]) => [...arquivos, ...novos.filter((n) => !arquivos.some((a) => a.name === n.name))]
  const adicionar = (novos: File[]) => {
    setErros((v) => ({ ...v, arquivo: undefined }))
    const lista = juntar(novos)
    if (previa) { void ler(mapaEscolhido ?? undefined, lista); return }
    setArquivos(lista)
    if (contaId) void ler(undefined, lista)
    else setErros((v) => ({ ...v, conta: "Escolha a conta" }))
  }
  const tirar = (nomes: string[]) => {
    const lista = arquivos.filter((a) => !nomes.includes(a.name))
    setErros((v) => ({ ...v, arquivo: undefined }))
    if (!previa) setArquivos(lista)
    else if (lista.length === 0) recomecar()
    else void ler(mapaEscolhido ?? undefined, lista)
  }
  const conta = contas?.find((c) => c.id === contaId)
  const trocarConta = (id: string) => {
    setContaId(id)
    setErros((v) => ({ ...v, conta: undefined }))
    if (previa || arquivos.length > 0) void ler(mapaEscolhido ?? undefined, arquivos, id)
  }

  if (erroCarga) return <div className={styles.pagina}><p className={styles.alerta} role="alert">Não foi possível carregar suas contas. Recarregue a página.</p></div>
  if (!contas) return <div className={styles.pagina}><Bloco><Esqueleto linhas={3} altura={18} /></Bloco></div>

  // O que o servidor disse de cada arquivo (quantos lançamentos trouxe ou por que ficou de fora).
  const lidos = previa ? previa.arquivos ?? (arquivos.length === 1 ? [{ nome: arquivos[0].name, linhas: previa.total }] : null) : null

  const documentos = fichasDosArquivos(arquivos, lidos)
  const revisando = !!previa && !previa.precisaMapear
  const docValido = documentos.some((d) => d.chave === doc && !d.erro) ? doc : null
  const faixa = !!previa && !topoAberto
  // Importou: a tela volta pro começo com esta faixa em cima (o que entrou, o que ficou sem categoria e os atalhos).
  const faixaImportado = resumo && !previa ? (() => {
    const { resultado: r } = resumo
    const somasExatas = !r.repetido && !r.jaExistiam
    const nadaNovo = !r.repetido && r.importadas === 0 && !!r.jaExistiam
    const pendentesDepois = somasExatas ? resumo.semCategoria ?? 0 : 0
    const onde = resumo.contaNome ?? conta?.nome ?? "sua conta"
    const contaDaFaixa = resumo.contaId ?? contaId
    return (
      <Bloco>
        <div className={styles.resumoTopo}>
          <div className={styles.importadoTitulo}>
            <span className={styles.prontoIcone} data-repetido={r.repetido || nadaNovo || undefined} aria-hidden="true"><CheckCircle2 size={26} strokeWidth={2} /></span>
            <div className={styles.resumoTitulo}>
              <h2>
                {r.repetido ? "Esse extrato já tinha sido importado"
                  : nadaNovo ? "Nada novo pra importar"
                  : `${r.importadas} ${r.importadas === 1 ? "lançamento importado" : "lançamentos importados"}`}
              </h2>
              <span className={styles.mudo}>
                {r.repetido ? "Nada foi gravado de novo."
                  : nadaNovo ? `${r.jaExistiam === 1 ? "O lançamento já estava" : `Os ${r.jaExistiam} lançamentos já estavam`} em ${onde}.`
                  : `Em ${onde}${resumo.de ? `, de ${dataBR(resumo.de)} a ${dataBR(resumo.ate)}` : ""}`}
              </span>
            </div>
          </div>
          <div className={styles.resumoAcoes}>
            <Botao variante="texto" onClick={() => setResumo(null)}>Fechar</Botao>
            <Botao variante={pendentesDepois > 0 ? "secundario" : "primario"} onClick={() => navigate("/transacoes", { state: { filtros: { contaId: contaDaFaixa } } })}>Ver em Transações</Botao>
            {pendentesDepois > 0 && (
              <Botao variante="primario"
                onClick={() => navigate("/pendentes")}>
                {`Resolver ${pendentesDepois} ${pendentesDepois === 1 ? "pendente" : "pendentes"}`}</Botao>
            )}
          </div>
        </div>
        {somasExatas && (resumo.entrou > 0 || resumo.saiu > 0 || pendentesDepois > 0) && (
          <div className={styles.resumoNumeros}>
            <div><span>Entrou</span><Dinheiro valor={resumo.entrou} tom="positivo" className={styles.resumoValor} /></div>
            <div><span>Saiu</span><Dinheiro valor={resumo.saiu} tom="negativo" className={styles.resumoValor} /></div>
            {pendentesDepois > 0 && <div><span>Sem categoria</span><span className={styles.resumoValor}>{pendentesDepois}</span></div>}
          </div>
        )}
        {!!r.jaExistiam && !nadaNovo && (
          <p className={styles.importadoNota}>{r.jaExistiam} {r.jaExistiam === 1 ? "já estava" : "já estavam"} na conta e {r.jaExistiam === 1 ? "ficou" : "ficaram"} de fora.</p>
        )}
        {!!resumo.anexosFalharam && (
          <p className={styles.importadoNota} data-falha>{resumo.anexosFalharam === 1 ? "1 anexo não subiu" : `${resumo.anexosFalharam} anexos não subiram`}. Dá pra anexar de novo pela transação.</p>
        )}
      </Bloco>
    )
  })() : null
  // A conta e os arquivos lidos (a parte esquerda da faixa) e os atalhos dela: na fila, quem desenha a faixa é a prévia
  // (junto dos números e do Importar); com o CSV que o app não reconheceu, a faixa fica aqui.
  const faixaConta = faixa ? <>
    {conta && <LogoMarca {...marcaDaConta(conta)} tamanho={36} />}
    <div className={styles.faixaConta}><span className={styles.mudo}>Conta</span><strong>{conta?.nome}</strong></div>
  </> : null
  const faixaArquivos = faixa ? (
    <div className={styles.faixaArquivos}>
      <ListaArquivos arquivos={arquivos} lendo={lendo} aoTirar={tirar} lidos={lidos}
        atual={revisando ? docValido : undefined} aoEscolher={revisando ? setDoc : undefined} total={previa?.total}
        // "Só posso enviar um arquivo por vez?" (Gustavo, 2026-11-22): o primeiro arquivo já lê e cai na fila, então
        // somar outro tem que estar à vista ali, sem voltar pro começo.
        adicionar={<SoltarArquivos compacto aceita=".ofx,.csv" varios ariaLabel="Adicionar arquivo" desabilitado={lendo}
          titulo={lendo ? "Lendo…" : "Adicionar arquivo"} onChange={adicionar} />} />
    </div>
  ) : null
  // As colunas do CSV (uma peça, dois lugares): sozinhas na tela quando o app não reconheceu o arquivo; com o arquivo
  // reconhecido, entram NO LUGAR da fila, embaixo da faixa (Gustavo, 2026-11-22: abrir em cima da tela
  // empurrava tudo e não dava pra entender). Ler de novo volta pros lançamentos.
  const colunasDoArquivo = previa?.colunas ? (
    <ColunasDoArquivo key={`colunas-${leituraN}`} colunas={previa.colunas} amostra={previa.amostra ?? []} inicial={previa.mapeamento ?? mapaEscolhido}
      motivos={previa.motivos} naoReconhecido={!!previa.precisaMapear} lendo={lendo} aoLer={(m) => { setColunasAbertas(false); void ler(m) }} />
  ) : null
  const faixaAtalhos = faixa ? <>
    {previa?.colunas && !previa.precisaMapear && (
      <Botao onClick={() => setColunasAbertas((v) => !v)}>{colunasAbertas ? "Voltar pros lançamentos" : "Colunas do arquivo"}</Botao>
    )}
    <Botao onClick={() => setTopoAberto(true)}>Trocar conta ou arquivos</Botao>
  </> : null

  return (
    <div className={styles.pagina}>
      {painelDev}
      {faixaImportado}
      {faixa && !revisando && <Bloco>
        {erro && <p className={styles.alerta} role="alert">{erro}</p>}
        <div className={styles.faixaTopo}>
          <div className={styles.faixaLida}>{faixaConta}</div>
          <div className={styles.resumoAcoes}>{faixaAtalhos}</div>
        </div>
        {faixaArquivos}
      </Bloco>}
      {!faixa && (() => {
        const q = buscaConta.trim().toLocaleLowerCase("pt-BR")
        const visiveis = contas.filter((c) => !q || c.nome.toLocaleLowerCase("pt-BR").includes(q))
        const ultimaDe = (id: string) => anteriores.find((a) => a.contaId === id)
        const daConta = anteriores.filter((a) => !contaId || a.contaId === contaId)
        const ultima = contaId ? ultimaDe(contaId) : undefined
        // Dois momentos na mesma tela (Gustavo, 2026-11-22: "saí selecionando os arquivos e não entendi por que não foi
        // pro próximo"): sem conta, só a lista de contas (não há onde soltar arquivo, então não tem como errar a ordem);
        // escolheu, a lista desliza pra esquerda e a área do arquivo aparece ao lado.
        const semConta = !contaId
        return (
          <div className={styles.comeco} data-sem-conta={semConta || undefined}>
            <Bloco semRespiro className={`${styles.oficinaFila} ${styles.comecoContas}`}>
              <aside className={styles.lugares}>
                <div className={styles.lugaresTopo}>
                  <p className={styles.lugaresConta}><strong className={semConta ? styles.comecoPergunta : undefined}>De qual conta é o extrato?</strong></p>
                  {contas.length > 6 && (
                    <Entrada tamanho="sm" value={buscaConta} onChange={(e) => setBuscaConta(e.target.value)} placeholder="Buscar conta" aria-label="Buscar conta"
                      prefixo={<Search size={15} aria-hidden="true" />} />
                  )}
                </div>
                <ul className={styles.lugaresLista} aria-label="Contas">
                  {visiveis.map((c) => {
                    const u = ultimaDe(c.id)
                    return (
                      <li key={c.id}>
                        <button type="button" className={styles.lugar} data-conta aria-current={c.id === contaId || undefined} disabled={lendo} onClick={() => trocarConta(c.id)}>
                          <LogoMarca {...marcaDaConta(c)} tamanho={36} />
                          <span className={styles.lugarTexto}>
                            <span className={styles.lugarNome}>{c.nome}</span>
                            <span className={styles.lugarSub}>{u ? `Importado até ${dataBR(u.ate)}` : "Ainda sem importação"}</span>
                          </span>
                          <span className={styles.lugarSinal} aria-hidden="true">{c.id === contaId ? <Check size={16} strokeWidth={2.5} /> : semConta ? <ChevronRight size={16} strokeWidth={2.25} /> : null}</span>
                        </button>
                      </li>
                    )
                  })}
                  {visiveis.length === 0 && <li className={styles.lugaresVazio}>Nenhuma conta com "{buscaConta.trim()}"</li>}
                </ul>
              </aside>
            </Bloco>
            <div className={styles.comecoArquivo} aria-hidden={semConta || undefined} inert={semConta || undefined}>
            <Bloco>
              <div className={styles.comecoMiolo}>
                {erro && <p className={styles.alerta} role="alert">{erro}</p>}
                <div className={styles.comecoTopo}>
                  {conta && <LogoMarca {...marcaDaConta(conta)} tamanho={48} />}
                  <div className={styles.comecoNome}>
                    <h2 className={styles.confirmarTitulo}>{conta ? conta.nome : "Escolha a conta"}</h2>
                    {conta && <span className={styles.mudo}>{ultima ? `Última importação: até ${dataBR(ultima.ate)}` : "Ainda sem importação"}</span>}
                  </div>
                </div>
                <Campo rotulo="Arquivos do banco" erro={erros.arquivo} grupo>
                  <SoltarArquivos aceita=".ofx,.csv" varios ariaLabel="Arquivo do extrato" invalido={!!erros.arquivo} desabilitado={lendo}
                    convite={arquivos.length > 0 ? "Escolher mais arquivos" : "Escolher arquivos"}
                    titulo={lendo ? "Lendo…" : arquivos.length > 0 ? "Arraste mais arquivos pra cá" : "Arraste o extrato do banco pra cá"}
                    detalhe={`OFX ou CSV, até ${MAX_EXTRATOS} de uma vez`} onChange={adicionar} />
                  {arquivos.length > 0 && <ListaArquivos arquivos={arquivos} lendo={lendo} aoTirar={tirar} lidos={lidos} total={previa?.total} />}
                </Campo>
                {!previa && arquivos.length > 0 && !!erro && (
                  <RodapeFormulario><Botao variante="primario" disabled={lendo} onClick={() => { void ler() }}>{lendo ? "Lendo…" : "Ler de novo"}</Botao></RodapeFormulario>
                )}
                {previa && <RodapeFormulario><Botao variante="primario" onClick={() => setTopoAberto(false)}>Pronto</Botao></RodapeFormulario>}
                {!previa && daConta.length > 0 && (
                  <ListaFicha rotulo="Importações">
                    <GrupoFicha rotulo="Importações anteriores">
                      {daConta.map((i) => (
                        <LinhaFicha key={i.id} para="/transacoes" estado={{ filtros: { contaId: i.contaId, de: i.de, ate: i.ate } }}
                          marca={(() => { const c = contas.find((x) => x.id === i.contaId); return c ? <LogoMarca {...marcaDaConta(c)} tamanho={36} /> : <InicialFicha texto={i.contaNome} /> })()}
                          titulo={contaId ? (i.de === i.ate ? dataBR(i.de) : `${dataBR(i.de)} a ${dataBR(i.ate)}`) : i.contaNome}
                          detalhe={`${contaId ? "" : `${i.de === i.ate ? dataBR(i.de) : `${dataBR(i.de)} a ${dataBR(i.ate)}`} · `}${i.quantidade === 1 ? "1 lançamento" : `${i.quantidade} lançamentos`}`}
                          direita={<span className={styles.anteriorQuando}>Importado em {diaDeInstante(i.criadoEm)}</span>} />
                      ))}
                    </GrupoFicha>
                  </ListaFicha>
                )}
              </div>
            </Bloco>
            </div>
          </div>
        )
      })()}
      {/* CSV que o servidor não reconheceu: pede as colunas antes da fila ("Ler de novo" relê com a escolha). */}
      {previa?.colunas && previa.precisaMapear && !topoAberto && colunasDoArquivo}

      {/* "Trocar conta ou arquivos" é um passo atrás (o começo sozinho na tela); a fila fica guardada, com o
          que a pessoa já escolheu, e volta no "Pronto". */}
      {previa && !previa.precisaMapear && (
        <div className={styles.guardado} hidden={topoAberto}>
        <Previa key={`previa-${leituraN}`} previa={previa} categorias={categorias} subcategorias={subcategorias}
          contaNome={contas.find((c) => c.id === contaId)?.nome ?? ""} contaId={contaId}
          documentos={documentos} doc={docValido} aoVerTodos={() => setDoc(null)} aoReler={async () => { await ler(mapaEscolhido ?? undefined) }}
          nomeAbertoDev={import.meta.env.DEV && nomeAbertoDev}
          faixaConta={faixaConta} faixaArquivos={faixaArquivos} faixaAtalhos={faixaAtalhos}
          noLugarDaFila={colunasAbertas && previa.colunas ? colunasDoArquivo : null}
          anterior={anterior} guardar={(e) => { escolhas.current = e }}
          aoImportar={async (linhas, chave, anexos) => {
            const r = await confirmarImportacao(contaId, linhas, chave, mapaEscolhido, previa.assinatura)
            // Os anexos da ficha sobem pro lançamento que cada linha virou (um por vez: o servidor redesenha a foto).
            let anexosFalharam = 0
            for (const [k, arquivos] of anexos.entries()) {
              const id = r.ids?.[k]
              for (const a of arquivos) {
                if (!id) { anexosFalharam++; continue }
                try { await enviarAnexo(id, a) } catch { anexosFalharam++ }
              }
            }
            setResumo({ ...resumir(r, linhas, previa), anexosFalharam, contaId, contaNome: conta?.nome })
            carregarAnteriores()
            void recarregarPendentes() // o que entrou sem categoria já conta no número do menu
            // Importou: volta pro começo (a faixa de cima diz o que entrou).
            setPrevia(null); setArquivos([]); setMapaEscolhido(null); setTopoAberto(false); setColunasAbertas(false)
            escolhas.current = null; setAnterior(null)
          }} />
        </div>
      )}
    </div>
  )
}

// ── Arquivos: um por linha, com o que cada um trouxe ─────────────────────────────────────────

const MESES_ARQUIVO = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"]
const MESES_ROTULO = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
const MES_NO_NOME = /\d{2}(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)(\d{4})/i

/** O nome sem o que muda entre o OFX, o CSV e a cópia baixada de novo: a extensão, o "-CSV"/"-OFX" do fim (Inter:
 *  "Extrato-06-01-2026-a-03-11-2026-CSV.csv") e o " (1)" que o navegador põe. Arquivos com a mesma base são um cartão. */
const baseDoNome = (nome: string) => nome.replace(/\.[^.]+$/, "").replace(/\s*\(\d+\)$/, "").replace(/[-_ ]?(csv|ofx)$/i, "").trim()
const PERIODO_NO_NOME = /(\d{2})-(\d{2})-(\d{4})-a-(\d{2})-(\d{2})-(\d{4})/i
/** "06-01-2026-a-03-11-2026" vira "06/01 a 03/11/2026" (com o ano dos dois lados quando mudam). */
const tituloDaBase = (base: string) => {
  const p = PERIODO_NO_NOME.exec(base)
  if (!p) return base
  const [, d1, m1, a1, d2, m2, a2] = p
  return a1 === a2 ? `${d1}/${m1} a ${d2}/${m2}/${a2}` : `${d1}/${m1}/${a1} a ${d2}/${m2}/${a2}`
}

/** Os arquivos do mesmo extrato juntos (o banco dá o mesmo período em OFX e em CSV, com os mesmos lançamentos; o
 *  servidor tira o repetido). Com o mês no nome do Nubank ("NU_..._01JAN2026_31JAN2026.ofx"), "Jan 2026"; senão,
 *  pelo nome sem extensão nem "-CSV"/"-OFX"/"(1)" (Gustavo, 2026-11-07). */
type FichaArquivo = { chave: string; titulo: string; ordem: string; nomes: string[]; tipos: string[]; lancamentos: number | null; erro: string | null; detalhe: string }
function fichasDosArquivos(arquivos: File[], lidos?: ArquivoLido[] | null): FichaArquivo[] {
  const porChave = new Map<string, FichaArquivo>()
  for (const a of arquivos) {
    const m = MES_NO_NOME.exec(a.name)
    const mes = m ? MESES_ARQUIVO.indexOf(m[1].toUpperCase()) : -1
    const base = baseDoNome(a.name)
    const chave = m ? `${m[2]}-${String(mes + 1).padStart(2, "0")}` : `~${base.toLowerCase()}`
    const f = porChave.get(chave) ?? {
      chave, titulo: m ? `${MESES_ROTULO[mes]} ${m[2]}` : tituloDaBase(base), ordem: chave,
      nomes: [], tipos: [], lancamentos: null, erro: null, detalhe: "",
    }
    f.nomes.push(a.name)
    const tipo = (/\.([a-z0-9]+)$/i.exec(a.name)?.[1] ?? "").toUpperCase()
    if (tipo && !f.tipos.includes(tipo)) { f.tipos.push(tipo); f.tipos.sort().reverse() } // sempre "OFX + CSV"
    porChave.set(chave, f)
  }
  for (const f of porChave.values()) {
    const deles = f.nomes.map((n) => lidos?.find((x) => x.nome === n)).filter((x): x is ArquivoLido => !!x)
    if (deles.length === 0) { f.detalhe = f.nomes.join(", "); continue }
    const bons = deles.filter((x) => !x.erro)
    // Os do mesmo mês trazem os mesmos lançamentos (o servidor tira o repetido): conta o maior, não a soma.
    if (bons.length > 0) f.lancamentos = Math.max(...bons.map((x) => x.linhas))
    else f.erro = deles[0].erro ?? null
    f.detalhe = deles.map((x) => (x.erro ? `${x.nome}: ${x.erro}` : x.nome)).join("\n")
  }
  return [...porChave.values()].sort((a, b) => a.ordem.localeCompare(b.ordem))
}

const tamanhoLegivel = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`)

/**
 * Os arquivos escolhidos, um cartão por mês (modelo das referências do Dribbble que o Gustavo escolheu em 2026-11-04:
 * a área de soltar fica sempre em cima e cada arquivo vira um cartão embaixo). O cartão diz o mês, os tipos e o
 * tamanho e, depois de ler, quantos lançamentos trouxe; o mês que não trouxe nada fica em laranja com o motivo.
 * Enquanto lê, uma barra corre no pé de cada cartão. O X tira o mês (e relê, se já tinha lido).
 */
function ListaArquivos({ arquivos, lidos, lendo, aoTirar, atual, aoEscolher, total, adicionar }: {
  arquivos: File[]; lidos?: ArquivoLido[] | null; lendo: boolean; aoTirar: (nomes: string[]) => void
  /** Com `aoEscolher`, o cartão vira botão: clicar mostra só os lançamentos daquele arquivo (clicar de novo volta). Com
   *  mais de um arquivo, o primeiro cartão é "Todos os arquivos" (`total` = quantos lançamentos vieram ao todo). */
  atual?: string | null; aoEscolher?: (chave: string | null) => void; total?: number
  /** O último cartão: somar mais arquivos ali mesmo (na faixa da fila). */
  adicionar?: ReactNode
}) {
  const tamanhos = new Map(arquivos.map((a) => [a.name, a.size]))
  const fichas = fichasDosArquivos(arquivos, lidos)
  return (
    <ul className={styles.arquivos} data-topo={aoEscolher ? true : undefined} aria-label="Arquivos escolhidos">
      {aoEscolher && fichas.length > 1 && (
        <li className={styles.cartaoArq} data-atual={atual == null || undefined} role="presentation">
          <button type="button" className={styles.cartaoArqAbrir} data-todos aria-pressed={atual == null} onClick={() => aoEscolher(null)}>
            <span className={styles.cartaoArqIcone} aria-hidden="true"><Files size={18} strokeWidth={2} /></span>
            <span className={styles.cartaoArqTexto}>
              <span className={styles.cartaoArqNome}>Todos os arquivos</span>
              {total != null && <span className={styles.cartaoArqSub}>{total === 1 ? "1 lançamento" : `${total} lançamentos`}</span>}
            </span>
          </button>
        </li>
      )}
      {fichas.map((f) => {
        const bytes = f.nomes.reduce((t, n) => t + (tamanhos.get(n) ?? 0), 0)
        const situacao = f.erro ? (/nenhuma/i.test(f.erro) ? "Sem lançamentos" : "Não deu pra ler")
          : f.lancamentos !== null ? (f.lancamentos === 1 ? "1 lançamento" : `${f.lancamentos} lançamentos`) : null
        const miolo = <>
          <span className={styles.cartaoArqIcone} aria-hidden="true"><FileText size={18} strokeWidth={2} /></span>
          <span className={styles.cartaoArqTexto}>
            <span className={styles.cartaoArqNome}>{f.titulo}</span>
            <span className={styles.cartaoArqSub}>
              {/* Depois de ler, o que importa é quantos lançamentos vieram: o tamanho sai e o tipo desce pra linha de baixo
                  (o cartão é estreito; o nome do arquivo segue na dica do cartão). */}
              {!aoEscolher && [f.tipos.join(" + "), bytes > 0 ? tamanhoLegivel(bytes) : null].filter(Boolean).join(" · ")}
              {(lendo || situacao) && <>{!aoEscolher && " · "}<span className={styles.cartaoArqSituacao}>{lendo ? "Lendo…" : situacao}</span></>}
            </span>
            {/* O tipo continua à vista depois de ler: "OFX + CSV" mostra que o mês juntou os dois (Gustavo, 2026-11-07). */}
            {aoEscolher && f.tipos.length > 0 && <span className={styles.cartaoArqSub}>{f.tipos.join(" + ")}</span>}
            {f.erro && !lendo && <span className={styles.cartaoArqMotivo}>{f.erro}</span>}
          </span>
        </>
        const escolhe = aoEscolher && !f.erro && fichas.length > 1
        return (
          <li key={f.chave} className={styles.cartaoArq} data-fora={f.erro ? true : undefined} data-lendo={lendo || undefined}
            data-atual={atual === f.chave || undefined} title={f.detalhe}>
            {escolhe
              ? <button type="button" className={styles.cartaoArqAbrir} aria-pressed={atual === f.chave} onClick={() => aoEscolher(atual === f.chave ? null : f.chave)}>{miolo}</button>
              : miolo}
            <button type="button" className={styles.cartaoArqTirar} aria-label={`Tirar ${f.titulo}`} disabled={lendo} onClick={() => aoTirar(f.nomes)}>
              <X size={14} strokeWidth={2.5} aria-hidden="true" />
            </button>
            {lendo && <span className={styles.cartaoArqBarra} aria-hidden="true" />}
          </li>
        )
      })}
      {adicionar && <li className={styles.cartaoSoltar} role="presentation">{adicionar}</li>}
    </ul>
  )
}

/** O que a pessoa já escolheu na prévia, por linha (pelo código do banco ou data+descrição+valor) e por lugar. */
type Escolhas = {
  linhas: Record<string, { marcada: boolean; cat: string; separado?: string; det?: Detalhe }>
  respondidos: Record<string, Resposta>; nomes: Record<string, string>
}
type Resposta = "confirmado" | "pulado" | "fora"
/** O que a pessoa confere em cada lançamento, além da categoria (2026-11-05: a ficha é "quase uma nova transação").
 *  Tipo, valor, data e conta são os do banco e não mudam. */
/** O que a pessoa confere na ficha. `ponto` e `anexos` (2026-11-07): onde foi e os arquivos (sobem depois de importar). */
type Detalhe = { descricao: string; sub: string; meio: number | null; hora: string; ponto: Ponto | null; anexos: File[] }
/** A hora que o banco mandou (00:00 = não mandou). */
const horaDoBanco = (iso: string) => { const h = iso.slice(11, 16); return h && h !== "00:00" ? h : "" }
const detalheInicial = (l: ExtratoLinha): Detalhe => ({ descricao: l.descricao, sub: "", meio: l.meioSugerido ?? null, hora: horaDoBanco(l.data), ponto: null, anexos: [] })
const meiosDe = (tipo: number) => (tipo === TIPO.receita ? MEIOS_RECEBIMENTO : MEIOS_CONTA)
const rotuloMeio = (tipo: number, meio: number | null) => meiosDe(tipo).find((m) => m.valor === meio)?.rotulo ?? null
const idDaLinha = (l: ExtratoLinha) => l.fitId || `${l.data}|${l.descricao}|${l.valor}`

// ── Prévia: o que vai entrar ────────────────────────────────────────────────────────────────

/** O que não é lugar pra categorizar: só registro (mexe no saldo, não é ganho nem gasto) ou já está no app. Cada um é
 *  um item no começo da lista, sem categoria. "Pix no crédito" junta as entradas do cartão, cada uma com o gasto dela
 *  (o Pix, que tem a categoria do lugar dele). */
type Especial = "fatura" | "pix" | "entre-contas" | "duplicada"
const ESPECIAIS: { chave: Especial; nome: string; dica: string }[] = [
  { chave: "fatura", nome: "Pagamento de fatura", dica: "Paga o cartão, os gastos estão na fatura" },
  { chave: "pix", nome: "Pix no crédito", dica: "O cartão pôs o valor na conta e o Pix saiu. O gasto é o Pix" },
  { chave: "entre-contas", nome: "Entre suas contas", dica: "O dinheiro só muda de conta" },
  { chave: "duplicada", nome: "Já está no app", dica: "Já foi lançado nessa conta, fica de fora" },
]
const especialDe = (l: ExtratoLinha): Especial | null =>
  l.duplicada ? "duplicada" : l.pagaFaturaFechamento || l.natureza === "pagamento-fatura" ? "fatura" : l.pixNoCredito ? "pix"
    : l.natureza === "entre-contas" ? "entre-contas" : null

/** Um lugar do extrato (mesma chave do servidor) ou um grupo especial: os lançamentos dele e quanto somam. */
type Grupo = {
  chave: string; nome: string; tipo: number; indices: number[]; total: number
  /** A sugestão que veio pro lugar e de onde; `forte` = regra da pessoa ou coletivo (já vem pronto, fora da fila). */
  sugestao: string | null; origem: ExtratoLinha["sugestaoDe"]; forte: boolean
  especial: Especial | null
  /** Separado pela pessoa: um lançamento sozinho ou os que ela juntou (grupo dela, com o nome que ela deu). */
  separado?: "sozinho" | "juntos"
}
const ORIGEM_FORTE = new Set<ExtratoLinha["sugestaoDe"]>(["regra", "coletivo"])

/** Agrupa pelo lugar o que é ganho ou gasto e ainda não está no app (sem lugar, pela descrição). Primeiro os que
 *  vieram sem categoria, do maior total pro menor; depois os que já vieram com categoria; no fim, os especiais. */
function agrupar(linhas: ExtratoLinha[]): Grupo[] {
  const porChave = new Map<string, Grupo>()
  const especiais = new Map<Especial, Grupo>()
  linhas.forEach((l, i) => {
    const esp = especialDe(l)
    if (esp) {
      const e = especiais.get(esp) ?? { chave: `!${esp}`, nome: ESPECIAIS.find((x) => x.chave === esp)!.nome, tipo: l.tipo, indices: [], total: 0,
        sugestao: null, origem: null, forte: true, especial: esp }
      e.indices.push(i)
      e.total += l.valor
      especiais.set(esp, e)
      return
    }
    const chave = l.chave || `~${l.tipo}:${l.descricao.trim().toLowerCase()}`
    const g = porChave.get(chave) ?? {
      chave, nome: l.estabelecimento || l.descricao, tipo: l.tipo, indices: [], total: 0,
      sugestao: l.categoriaSugeridaId, origem: l.sugestaoDe ?? null, forte: true, especial: null,
    }
    g.indices.push(i)
    g.total += l.valor
    g.forte &&= !!l.categoriaSugeridaId && ORIGEM_FORTE.has(l.sugestaoDe)
    porChave.set(chave, g)
  })
  const semCategoria = (g: Grupo) => g.indices.some((i) => !linhas[i].categoriaSugeridaId)
  const lugares = [...porChave.values()].sort((a, b) =>
    Number(semCategoria(b)) - Number(semCategoria(a)) || b.total - a.total || b.indices.length - a.indices.length)
  return [...lugares, ...ESPECIAIS.flatMap((e) => especiais.get(e.chave) ?? [])]
}

/**
 * Os grupos da tela: os lugares (sem os lançamentos que a pessoa separou), depois os separados (cada chave "+n" é um
 * item: um lançamento sozinho ou os que ela juntou, na ordem em que foram criados) e, no fim, os especiais.
 */
function montarGrupos(base: Grupo[], linhas: ExtratoLinha[], separados: Record<number, string>, nomes: Record<string, string>): Grupo[] {
  const soma = (ix: number[]) => ix.reduce((t, i) => t + linhas[i].valor, 0)
  const lugares = base.flatMap((g) => {
    if (g.especial) return []
    const ix = g.indices.filter((i) => separados[i] === undefined)
    return ix.length === g.indices.length ? [g] : ix.length > 0 ? [{ ...g, indices: ix, total: soma(ix) }] : []
  })
  const porChave = new Map<string, number[]>()
  Object.entries(separados).forEach(([i, k]) => porChave.set(k, [...(porChave.get(k) ?? []), Number(i)]))
  const seps = [...porChave.entries()].sort((a, b) => Number(a[0].slice(1)) - Number(b[0].slice(1))).map(([chave, ix]): Grupo => {
    ix.sort((a, b) => a - b)
    const l = linhas[ix[0]]
    return {
      chave, nome: nomes[chave] ?? (l.estabelecimento || l.descricao), tipo: l.tipo, indices: ix, total: soma(ix),
      sugestao: null, origem: null, forte: false, especial: null, separado: ix.length === 1 ? "sozinho" : "juntos",
    }
  })
  return [...lugares, ...seps, ...base.filter((g) => g.especial)]
}

type Situacao = "pendente" | "feito" | "pronto" | "especial"

/**
 * Por lugar: duas colunas, como uma caixa de e-mail. À esquerda todos os lugares (busca em cima; o que precisa de
 * revisão com um ponto, o que já veio pronto ou foi respondido com um check; dá pra pular pra qualquer um). À
 * direita a ficha do lugar escolhido: nome, total, as 4 categorias mais prováveis em botão (a sugerida primeiro,
 * depois as mais usadas nesse extrato), "Outra…" com todas ("Outros" nunca em botão, só no fim do
 * "Outra…") e os lançamentos dele. Teclado na ficha: Enter confirma e vai pro próximo pendente. "Confirmar as sugeridas" fecha de uma vez todas as que vieram com sugestão.
 */
function RevisarLugares({ grupos, linhas, categorias, subcategorias, cats, marcadas, detalhes, contaNome, respondidos, opcoesPorTipo, aoCategoria, aoSubcategoria, aoDetalhe, aoMarcar, aoResponder, aoSeparar, aoSepararPorDocumento, aoVoltar, aoJuntar, aoRenomear, aoEnsinarNome, nomeAbertoDev }: {
  grupos: Grupo[]; linhas: ExtratoLinha[]; categorias: Category[]; subcategorias: Subcategory[]; cats: string[]; marcadas: boolean[]
  detalhes: Detalhe[]; contaNome: string
  aoSubcategoria: (g: Grupo, subcategoriaId: string) => void
  aoDetalhe: (i: number, mudou: Partial<Detalhe>) => void
  respondidos: Record<string, Resposta>
  opcoesPorTipo: Record<number, { valor: string; rotulo: string }[]>
  aoCategoria: (g: Grupo, categoriaId: string) => void
  aoMarcar: (i: number, marcada: boolean) => void
  aoResponder: (chaves: string[], como: Resposta) => void
  /** Tira o lançamento do grupo dele: vira um item sozinho em "Separados". */
  aoSeparar: (i: number) => void
  /** Mesmo nome com CPF/CNPJ diferente: cada documento (fora o primeiro) vira um grupo separado. */
  aoSepararPorDocumento: (g: Grupo) => void
  /** Devolve os lançamentos do grupo separado pro lugar de onde vieram. */
  aoVoltar: (g: Grupo) => void
  /** Junta os separados escolhidos num grupo da pessoa; devolve a chave do grupo novo. */
  aoJuntar: (chaves: string[]) => string
  aoRenomear: (chave: string, nome: string) => void
  /** "Qual parte é o nome?": `lembrar` guarda o padrão e relê a prévia; sem, só renomeia o grupo. */
  aoEnsinarNome: (descricao: string, nome: string, chave: string, lembrar: boolean) => Promise<void>
  nomeAbertoDev?: boolean
}) {
  const situacao = (g: Grupo): Situacao => (g.especial ? "especial" : respondidos[g.chave] ? "feito" : g.forte ? "pronto" : "pendente")
  const lugares = grupos.filter((g) => !g.especial)
  const pendentes = lugares.filter((g) => situacao(g) === "pendente")
  const [chaveAtual, setChaveAtual] = useState<string | null>(() => pendentes[0]?.chave ?? lugares[0]?.chave ?? grupos[0]?.chave ?? null)
  const [busca, setBusca] = useState("")
  const atual = grupos.find((g) => g.chave === chaveAtual) ?? null
  // Lugares em que a pessoa disse "Manter juntos" mesmo com documentos diferentes.
  const [juntosMesmo, setJuntosMesmo] = useState<Set<string>>(() => new Set())
  // O lançamento mostrado no formulário de cima (Gustavo, 2026-11-06: valor, tipo, data, forma de pagamento e conta são
  // de UM lançamento; os agrupados ficam embaixo e o Editar de cada um traz ele pra cima). Começa no primeiro.
  const [aberto, setAberto] = useState<number | null>(null)
  useEffect(() => { setAberto(null) }, [chaveAtual])
  const mostrado = atual && aberto != null && atual.indices.includes(aberto) ? aberto : atual?.indices[0] ?? null
  const [marcandoNome, setMarcandoNome] = useState(!!nomeAbertoDev)
  const [editandoHora, setEditandoHora] = useState<number | null>(null)

  // A ordem da lista nasce com a prévia e não muda enquanto a pessoa responde: em cima o que é só registro (pagamento
  // de fatura, Pix no crédito, entre suas contas, já no app), depois o que precisa de revisão e o que já veio pronto
  // (cada parte do maior total pro menor, como os grupos já vêm).
  // Separar e juntar mudam os grupos: a ordem é refeita, mas os lugares seguem na ordem de antes.
  const ordenados = useMemo(() => {
    const doLugar = lugares.filter((g) => !g.separado)
    return [...grupos.filter((g) => g.especial), ...doLugar.filter((g) => !g.forte), ...doLugar.filter((g) => g.forte), ...lugares.filter((g) => g.separado)]
  }, [grupos]) // eslint-disable-line react-hooks/exhaustive-deps
  // Separados marcados pra juntar.
  const [praJuntar, setPraJuntar] = useState<string[]>([])
  const separadosVivos = lugares.filter((g) => g.separado)
  const juntaveis = praJuntar.filter((k) => separadosVivos.some((g) => g.chave === k))
  const tiposJuntos = new Set(juntaveis.map((k) => separadosVivos.find((g) => g.chave === k)!.tipo))
  // Se o grupo atual sumiu (o último lançamento dele foi separado ou juntado), a ficha vai pro primeiro que sobrou.
  useEffect(() => {
    if (chaveAtual && !grupos.some((g) => g.chave === chaveAtual)) setChaveAtual(null)
  }, [grupos, chaveAtual])
  // A busca acha pelo nome do lugar e pela descrição de qualquer lançamento dele (no Pix no crédito, também o gasto
  // que acompanha a entrada do cartão).
  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const bate = (i: number) => linhas[i].descricao.toLowerCase().includes(q)
    return q ? ordenados.filter((g) => g.nome.toLowerCase().includes(q)
      || g.indices.some((i) => bate(i) || (linhas[i].pixNoCredito && linhas[i].parPixNoCredito != null && bate(linhas[i].parPixNoCredito!)))) : ordenados
  }, [ordenados, busca, linhas])

  // As mais usadas nesse extrato, por tipo (a sugestão do servidor conta): o que a pessoa mais vai querer.
  const maisUsadas = useMemo(() => {
    const conta = new Map<string, number>()
    linhas.forEach((l) => {
      if (!l.categoriaSugeridaId || l.duplicada) return
      const k = `${l.tipo}:${l.categoriaSugeridaId}`
      conta.set(k, (conta.get(k) ?? 0) + 1)
    })
    return conta
  }, [linhas])
  const nomeDe = (id: string) => categorias.find((c) => c.id === id)?.descricao ?? ""
  const categoriaDe = (g: Grupo) => {
    const daGente = g.indices.map((i) => cats[i])
    return daGente.every((c) => c === daGente[0]) ? (daGente[0] ? nomeDe(daGente[0]) : "Sem categoria") : "Várias"
  }

  // O próximo pendente depois do atual (dá a volta); null = não sobrou nenhum.
  const proximoPendente = () => {
    const i = ordenados.findIndex((g) => g.chave === chaveAtual)
    return [...ordenados.slice(i + 1), ...ordenados.slice(0, Math.max(i, 0))].find((g) => situacao(g) === "pendente" && g.chave !== chaveAtual) ?? null
  }
  const responder = (como: Resposta) => {
    if (!atual) return
    aoResponder([atual.chave], como)
    setChaveAtual(proximoPendente()?.chave ?? null)
  }
  const comSugestao = pendentes.filter((g) => cats[g.indices[0]])

  const escolhida = atual ? cats[atual.indices[0]] ?? "" : ""
  const subsDaEscolhida = escolhida ? subcategorias.filter((s) => s.categoriaId === escolhida) : []
  const candidatas = (() => {
    if (!atual || atual.especial) return []
    const ids: string[] = []
    // "Outros" nunca vira botão (Gustavo, 2026-11-05: é a última opção; se tudo cai lá, a categoria não diz nada).
    // Fica só no fim do "Outra…".
    const por = (id: string | null | undefined) => { if (id && !ids.includes(id) && categorias.some((c) => c.id === id && aceitaTipo(c, atual.tipo) && !ehOutros(c))) ids.push(id) }
    por(atual.sugestao)
    const prefixo = `${atual.tipo}:`
    ;[...maisUsadas.entries()].filter(([k]) => k.startsWith(prefixo)).sort((a, b) => b[1] - a[1]).forEach(([k]) => por(k.slice(prefixo.length)))
    opcoesPorTipo[atual.tipo]?.forEach((o) => por(o.valor))
    const top = ids.slice(0, 4)
    if (escolhida && !top.includes(escolhida)) top[top.length - 1] = escolhida
    return top
  })()
  // Um lançamento na ficha: a caixinha (entra ou não), a data, a descrição e, no grupo com mais de um, "Separar" (tira
  // ele do grupo pra ter a categoria só dele).
  const lancamento = (i: number, separavel: boolean) => {
    const l = linhas[i]
    const d = detalhes[i]
    const nota = l.pagaFaturaFechamento ? `Paga a fatura de ${rotuloMesFatura(l.pagaFaturaFechamento)}`
      : l.natureza === "entre-contas" && l.juntaComConta ? `Junta com ${l.juntaComConta}`
      : l.pagoNoCredito ? "Pix no crédito" : null
    const meio = rotuloMeio(l.tipo, d.meio)
    const abre = mostrado === i
    const horaRuim = d.hora.length > 0 && (d.hora.length < 5 || !horaValida(d.hora))
    return (
      <li key={i} data-fora={!marcadas[i] || undefined} data-aberto={abre || undefined}>
        <div className={styles.fichaLinha}>
          <Marcar marcado={marcadas[i]} onChange={(on) => aoMarcar(i, on)} ariaLabel={`Importar ${l.descricao}`} />
          <span className={styles.fichaData}>{dataBR(l.data)}{d.hora && !horaRuim ? ` ${d.hora}` : ""}</span>
          <span className={styles.fichaDescricao} title={d.descricao || l.descricao}>
            {/* A descrição do banco inteira, com o pedaço que virou o nome destacado e o resto apagado (2026-11-21: o
                Gustavo via o nome sem saber de onde ele vinha). Editada pela pessoa, mostra a dela. */}
            <span className={styles.fichaDescricaoTexto}>
              {(!d.descricao || d.descricao === l.descricao) && l.pedacos?.length
                ? l.pedacos.map((p, j) => <span key={j} className={styles.pedaco} data-parte={p.parte}>{p.texto}</span>)
                : d.descricao || l.descricao}
            </span>
            {(nota || meio || separavel || l.tipoMovimento || l.documento) && <span className={styles.fichaNota}>
              {[l.tipoMovimento, l.documento, nota, meio].filter(Boolean).join(" · ")}
              {separavel && !meio && <span className={styles.fichaNotaFalta}>{nota || l.tipoMovimento || l.documento ? " · " : ""}Sem forma de pagamento</span>}
            </span>}
          </span>
          {/* Só pra ler; quem quiser mexe num só pelo Editar (o resto segue o lugar). */}
          <span className={styles.fichaAcoes}>
            <button type="button" className={styles.fichaSeparar} data-ativo={abre || undefined} aria-pressed={abre}
              onClick={() => setAberto(i)} aria-label={`Editar ${d.descricao || l.descricao}`} title="Mostrar este lá em cima">
              <Pencil size={13} strokeWidth={2.25} aria-hidden="true" />Editar
            </button>
            {separavel && (
              <button type="button" className={styles.fichaSeparar} onClick={() => aoSeparar(i)} aria-label={`Separar ${l.descricao}`} title="Separar do grupo">
                <Split size={14} strokeWidth={2.25} aria-hidden="true" />Separar
              </button>
            )}
          </span>
          <span className={styles.fichaValor} data-tom={!marcadas[i] ? undefined : l.tipo === TIPO.receita ? "positivo" : "negativo"}><Dinheiro valor={l.valor} /></span>
        </div>
      </li>
    )
  }
  // Mesmo nome, documento diferente (2026-11-21): pode ser outra pessoa com o mesmo nome. Avisa antes de juntar a
  // categoria das duas; "Separar" deixa cada documento no seu grupo.
  const avisoDocumentos = (g: Grupo) => {
    const docs = new Set(g.indices.map((i) => linhas[i].documento).filter(Boolean))
    if (docs.size < 2 || juntosMesmo.has(g.chave)) return null
    return (
      <div className={styles.avisoDocs} role="status">
        <AlertTriangle size={16} strokeWidth={2.25} aria-hidden="true" />
        <span>Mesmo nome, documentos diferentes. Pode ser outra pessoa.</span>
        <span className={styles.avisoDocsAcoes}>
          <Botao onClick={() => setJuntosMesmo((v) => new Set(v).add(g.chave))}>Manter juntos</Botao>
          <Botao variante="primario" onClick={() => aoSepararPorDocumento(g)}>Separar</Botao>
        </span>
      </div>
    )
  }
  // Os outros do grupo que ainda estão sem forma de pagamento: um clique põe a mesma neles.
  const usarNosOutros = (g: Grupo, i: number) => {
    const d = detalhes[i]
    const meio = rotuloMeio(g.tipo, d.meio)
    const semMeio = g.indices.filter((j) => j !== i && marcadas[j] && detalhes[j].meio == null)
    if (d.meio == null || semMeio.length === 0) return null
    return (
      <Botao variante="texto" onClick={() => semMeio.forEach((j) => aoDetalhe(j, { meio: d.meio }))}>
        {semMeio.length === 1 ? `Usar ${meio} no outro sem forma de pagamento` : `Usar ${meio} nos outros ${semMeio.length} sem forma de pagamento`}
      </Botao>
    )
  }
  const periodoDe = (g: Grupo) => {
    const dias = g.indices.map((j) => linhas[j].data.slice(0, 10)).sort()
    const [de, ate] = [dias[0], dias[dias.length - 1]]
    return de === ate ? dataBR(de) : `${de.slice(0, 4) === ate.slice(0, 4) ? dataBR(de).slice(0, 5) : dataBR(de)} a ${dataBR(ate)}`
  }
  const rotuloMeioDe = (g: Grupo) => (g.tipo === TIPO.receita ? "Recebido por" : "Pago com")
  const opcoesMeio = (g: Grupo) => meiosDe(g.tipo).map((m) => ({ valor: String(m.valor), rotulo: m.rotulo }))
  // A lista de categorias do campo: as mais prováveis primeiro, depois todas ("Outros" só no fim).
  const opcoesCategoria = (g: Grupo) => [...candidatas.map((id) => ({ valor: id, rotulo: nomeDe(id) })),
    ...(opcoesPorTipo[g.tipo] ?? []).filter((o) => o.valor && !candidatas.includes(o.valor))]
  const horaRuimDe = (j: number) => detalhes[j].hora.length > 0 && (detalhes[j].hora.length < 5 || !horaValida(detalhes[j].hora))
  // Pix no crédito: o gasto que acompanha a entrada do cartão (o Pix que ela pagou). Mostra o lugar e a categoria dele;
  // a categoria se escolhe no lugar (o botão leva pra lá).
  const gastoDoPix = (j: number) => {
    const l = linhas[j]
    const lugar = lugares.find((g) => g.indices.includes(j))
    const nome = l.estabelecimento || l.descricao
    return (
      <li key={j} data-par data-fora={!marcadas[j] || undefined}><div className={styles.fichaLinha}>
        <Marcar marcado={marcadas[j]} onChange={(on) => aoMarcar(j, on)} ariaLabel={`Importar ${l.descricao}`} />
        <span className={styles.fichaData}>Gasto</span>
        <span className={styles.fichaDescricao} title={l.descricao}>
          {nome}
          {lugar && (
            <button type="button" className={styles.fichaCategoria} onClick={() => setChaveAtual(lugar.chave)} aria-label={`Categoria de ${nome}: ${cats[j] ? nomeDe(cats[j]) : "Sem categoria"}`}>
              {cats[j] ? nomeDe(cats[j]) : "Sem categoria"}<ChevronRight size={12} aria-hidden="true" />
            </button>
          )}
        </span>
        <span className={styles.fichaValor} data-tom={marcadas[j] ? "negativo" : undefined}><Dinheiro valor={l.valor} /></span>
      </div></li>
    )
  }

  const lista = (
      <aside className={styles.lugares}>
        <div className={styles.lugaresTopo}>
          <p className={styles.lugaresConta}>
            <strong className={styles.filaFaltam}>{pendentes.length === 0 ? "Nada pendente" : pendentes.length === 1 ? "Falta 1" : `Faltam ${pendentes.length}`}</strong>{lugares.length > 0 && ` de ${lugares.length}`}
          </p>
          {lugares.length > 0 && <BarraProgresso fracao={(lugares.length - pendentes.length) / lugares.length} rotulo={`${lugares.length - pendentes.length} de ${lugares.length} lugares revisados`} />}
          <Entrada tamanho="sm" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar lugar ou lançamento" aria-label="Buscar lugar"
            prefixo={<Search size={15} aria-hidden="true" />} />
        </div>
        <ul className={styles.lugaresLista} aria-label="Lugares">
          {[...visiveis.filter((g) => situacao(g) === "pendente"), ...visiveis.filter((g) => situacao(g) !== "pendente")].map((g, n, lista) => {
            const sit = situacao(g)
            // A lista é a FILA. Em cima o que falta resolver; embaixo o que já está (resolvido aqui, já vindo com
            // categoria ou só registro). Resolver um lugar tira ele de cima.
            const secaoFila = n === 0 ? (sit === "pendente" ? "Pendentes" : "Resolvidos")
              : sit !== "pendente" && situacao(lista[n - 1]) === "pendente" ? "Resolvidos" : null
            return (
              <li key={g.chave} className={secaoFila ? styles.lugarComSecao : undefined} data-separado={g.separado ? true : undefined}>
                {secaoFila && <span className={styles.lugaresSecao}>{secaoFila}</span>}
                {g.separado && separadosVivos.length > 1 && <span className={styles.lugarJuntar}>
                  <Marcar marcado={praJuntar.includes(g.chave)} ariaLabel={`Juntar ${g.separado === "sozinho" ? linhas[g.indices[0]].descricao : g.nome}`}
                    onChange={(on) => setPraJuntar((v) => (on ? [...v, g.chave] : v.filter((k) => k !== g.chave)))} />
                </span>}
                <button type="button" className={styles.lugar} aria-current={g.chave === chaveAtual || undefined} data-situacao={sit} onClick={() => setChaveAtual(g.chave)}>
                  <span className={styles.lugarSinal} aria-hidden="true">{sit === "pendente" ? <span className={styles.ponto} /> : sit === "especial" ? <Minus size={14} strokeWidth={2.5} /> : <Check size={14} strokeWidth={2.5} />}</span>
                  <span className={styles.lugarTexto}>
                    <span className={styles.lugarNome}>{nomeNaTela(g.nome) || "Grupo sem nome"}</span>
                    <span className={styles.lugarSub}>{g.separado === "sozinho" ? dataBR(linhas[g.indices[0]].data) : g.indices.length === 1 ? "1 lançamento" : `${g.indices.length} lançamentos`}{g.especial ? "" : ` · ${categoriaDe(g)}`}</span>
                  </span>
                  <span className={styles.lugarTotal}><Dinheiro valor={g.total} /></span>
                </button>
              </li>
            )
          })}
          {visiveis.length === 0 && <li className={styles.lugaresVazio}>Nenhum lugar com "{busca.trim()}"</li>}
        </ul>
        {juntaveis.length > 1 ? (
          <div className={styles.lugaresPe}>
            <Botao onClick={() => setPraJuntar([])}>Cancelar</Botao>
            <Botao variante="primario" icone={<Layers size={15} aria-hidden="true" />} disabled={tiposJuntos.size > 1}
              title={tiposJuntos.size > 1 ? "Entrada e saída não ficam no mesmo grupo" : undefined}
              onClick={() => { const k = aoJuntar(juntaveis); setPraJuntar([]); setChaveAtual(k) }}>Juntar {juntaveis.length}</Botao>
          </div>
        ) : comSugestao.length > 1 && <div className={styles.lugaresPe}>
          <Botao variante="texto" onClick={() => { aoResponder(comSugestao.map((g) => g.chave), "confirmado"); setChaveAtual(null) }}>Confirmar as {comSugestao.length} sugeridas</Botao>
        </div>}
      </aside>
  )

  // A fila à esquerda (um bloco) e, à direita, o formulário de Nova transação com o lançamento.
  const formularioDoLancamento = (g: Grupo) => {
    const n = g.indices.length
    const i = mostrado != null && g.indices.includes(mostrado) ? mostrado : g.indices[0]
    const l = linhas[i]
    const d = detalhes[i]
    const receita = g.tipo === TIPO.receita
    const ruim = horaRuimDe(i)
    const sub = detalhes[g.indices[0]].sub ?? ""
    // O campo mostra o que a pessoa escreveu (vazio também: apagar tudo deixa o texto do banco só como dica, e é ele
    // que vale ao importar).
    const mudouDescricao = !!d.descricao.trim() && d.descricao.trim() !== l.descricao
    const foraTodos = g.indices.every((k) => !marcadas[k])
    const sugestoes = escolhida ? [] : candidatas
    // O nome do lugar é o título do cartão (Gustavo, 2026-11-22: fora do cartão sobrava um vão em cima do cupom).
    return (
      <Bloco>
        <div className={styles.oficinaTitulo}>
          <div className={styles.resumoTitulo}>
            {g.separado === "juntos"
              ? <input className={styles.fichaNomeEditar} value={g.nome} aria-label="Nome do grupo" maxLength={60} onChange={(e) => aoRenomear(g.chave, e.target.value)} />
              : <h2>{nomeNaTela(g.nome)}</h2>}
            <span className={styles.mudo}>{n === 1 ? "1 lançamento" : `${n} lançamentos, ${periodoDe(g)}`}</span>
          </div>
          <button type="button" className={styles.fichaSeparar} onClick={() => setMarcandoNome((v) => !v)}>
            <TextCursorInput size={14} strokeWidth={2.25} aria-hidden="true" />Qual é o nome?
          </button>
        </div>
        {marcandoNome && (
          <div className={styles.oficinaNome}>
            <MarcarNome descricao={l.descricao} pedacos={l.pedacos ?? undefined}
              onFechar={() => setMarcandoNome(false)}
              aoSalvar={(nome, lembrar) => aoEnsinarNome(l.descricao, nome, g.chave, lembrar)} />
          </div>
        )}
        {/* Enxuto e ABERTO (Gustavo, 2026-11-22: "muita input pra selecionar, muita coisa pra ver na tela"; e depois
            "odiei esse mais detalhe / menos detalhe, já tem que vir aberto"): um cartão só, tudo à vista. À esquerda o
            que veio do banco como resumo (o valor grande e uma linha) e as duas decisões em campo (categoria e forma de
            pagamento); à direita, no cupom, o que é opcional escrito como texto com o lápis (descrição, hora, local,
            anexos), sem virar mais caixa de preencher. Os campos são as peças de CamposLancamento. */}
          <Formulario onSubmit={() => responder("confirmado")}>
            <div className={styles.lancGrade}>
              {/* Esquerda: os campos, na ordem de Nova transação (valor, descrição, forma de pagamento e conta, categoria e
                  subcategoria). O valor e a conta vieram prontos: ficam no lugar deles, como texto. */}
              <div className={styles.lancPrincipal}>
                <CampoValor valor={moneyParaCampo(l.valor)} tom={receita ? "positivo" : "negativo"} fixo />
                <CampoDescricao valor={d.descricao} placeholder={l.descricao} onChange={(x) => aoDetalhe(i, { descricao: x })} />
                {mudouDescricao && <span className={styles.noExtrato}>No extrato: {l.descricao}</span>}
                <LinhaCampos>
                  <CampoMeio rotulo={rotuloMeioDe(g)} valor={d.meio == null ? "" : String(d.meio)} placeholder="Escolha"
                    opcoes={opcoesMeio(g)} onChange={(x) => aoDetalhe(i, { meio: x ? Number(x) : null })} />
                  <CampoFixo rotulo="Conta">{contaNome}</CampoFixo>
                </LinhaCampos>
                {usarNosOutros(g, i)}
                <CamposCategoria categoriaId={escolhida} subcategoriaId={sub}
                  categorias={opcoesCategoria(g)} subcategorias={subsDaEscolhida.map((x) => ({ valor: x.id, rotulo: x.nome }))}
                  aoCategoria={(c) => aoCategoria(g, c)} aoSubcategoria={(x) => aoSubcategoria(g, x)} />
                {sugestoes.length > 0 && (
                  <div className={styles.sugestoes} role="group" aria-label={`Sugestões de categoria pra ${g.nome}`}>
                    <span className={styles.mudo}>Sugestões</span>
                    {sugestoes.map((id) => <button key={id} type="button" className={styles.chip} onClick={() => aoCategoria(g, id)}>{nomeDe(id)}</button>)}
                  </div>
                )}
              </div>
              {/* Direita: os detalhes do lançamento, um por linha com o rótulo (o que veio do banco e o que é opcional). */}
              <Cupom rotulo="Detalhes do lançamento">
                <LinhaCupom rotulo="Tipo">{receita ? "Receita" : "Despesa"}</LinhaCupom>
                <LinhaCupom rotulo="Data">{dataBR(l.data)}</LinhaCupom>
                <LinhaCupom rotulo="Hora">
                  {editandoHora === i || ruim
                    ? <input className={styles.fHoraEditar} data-invalido={ruim || undefined} inputMode="numeric" placeholder="HH:MM" maxLength={5}
                        value={d.hora} aria-label="Hora" aria-invalid={ruim || undefined} autoFocus={editandoHora === i}
                        onChange={(e) => aoDetalhe(i, { hora: mascararHora(e.target.value) })}
                        onBlur={() => setEditandoHora(null)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setEditandoHora(null) } }} />
                    : <button type="button" className={styles.fEditavel} aria-label="Editar hora" title="Editar hora" onClick={() => setEditandoHora(i)}>
                        <span data-vazio={!d.hora || undefined}>{d.hora || "Sem hora"}</span>
                        <Pencil size={16} strokeWidth={2.25} className={styles.fichaLapis} aria-hidden="true" />
                      </button>}
                </LinhaCupom>
                <LinhaCupom rotulo="Localização"><Localizacao valor={d.ponto} onChange={(pt) => aoDetalhe(i, { ponto: pt })} /></LinhaCupom>
                <LinhaCupom rotulo="Anexos" empilhado>
                  <Anexos itens={d.anexos.map((x, k) => ({ chave: String(k), nome: x.name, tipo: x.type, arquivo: x }))}
                    onAdicionar={(novos) => aoDetalhe(i, { anexos: [...d.anexos, ...novos] })}
                    onRemover={(k) => aoDetalhe(i, { anexos: d.anexos.filter((_, x) => String(x) !== k) })} />
                </LinhaCupom>
              </Cupom>
            </div>
            {n > 1 && <>
              <p className={styles.fichaSecao}>Lançamentos agrupados</p>
              {avisoDocumentos(g)}
              <ul className={styles.fichaLancamentos} aria-label={`Lançamentos de ${g.nome}`}>
                {g.indices.map((k) => lancamento(k, true))}
              </ul>
            </>}
            <RodapeFormulario>
              <span className={styles.rodapeEsquerda}>
                {foraTodos
                  ? <Botao variante="texto" onClick={() => g.indices.forEach((k) => aoMarcar(k, true))}>Incluir de novo</Botao>
                  : <Botao variante="texto" onClick={() => responder("fora")}>Deixar de fora</Botao>}
                {g.separado && <Botao variante="texto" icone={<Undo2 size={15} aria-hidden="true" />} onClick={() => aoVoltar(g)}>
                  {g.separado === "sozinho" ? "Voltar pro lugar" : "Desfazer grupo"}</Botao>}
              </span>
              {/* Pular deixa o lugar na fila e mostra o próximo; só confirmar (com categoria) resolve. */}
              <Botao onClick={() => { const p = proximoPendente(); if (p) setChaveAtual(p.chave) }}>Pular</Botao>
              <Botao variante="primario" type="submit" disabled={!escolhida}>Confirmar e próximo</Botao>
            </RodapeFormulario>
          </Formulario>
      </Bloco>
    )
  }
  return (
    <div className={styles.oficina}>
      <Bloco semRespiro className={styles.oficinaFila}>{lista}</Bloco>
      <div className={styles.oficinaMiolo}>
        {atual && !atual.especial ? formularioDoLancamento(atual) : atual ? (
          <Bloco>
            <div className={styles.fichaTopo}>
              <span className={styles.fichaIcone} data-tipo="registro"><FileText size={22} /></span>
              <span className={styles.fichaNomeBloco}>
                <span className={styles.fichaNome}>{atual.nome}</span>
                <span className={styles.mudo}>
                  {atual.indices.length === 1 ? "1 lançamento" : `${atual.indices.length} lançamentos`} · {ESPECIAIS.find((e) => e.chave === atual.especial)!.dica}
                </span>
              </span>
              <span className={styles.fichaTotal}><Dinheiro valor={atual.total} /></span>
            </div>
            <ul className={styles.fichaLancamentos} aria-label={`Lançamentos de ${atual.nome}`}>
              {atual.indices.flatMap((i) => {
                const par = linhas[i].pixNoCredito ? linhas[i].parPixNoCredito : null
                return par == null ? [lancamento(i, false)] : [lancamento(i, false), gastoDoPix(par)]
              })}
            </ul>
          </Bloco>
        ) : (
          <Bloco className={styles.fichaPronto}>
            <span className={styles.prontoIcone}><CheckCircle2 size={26} /></span>
            <p className={styles.prontoTitulo}>Fila zerada</p>
            <p className={styles.prontoTexto}>{lugares.length === 1 ? "1 lugar" : `${lugares.length} lugares`} com categoria. Confira na lista ao lado ou importe.</p>
          </Bloco>
        )}
      </div>
    </div>
  )
}

function Previa({ previa, categorias, subcategorias, contaNome, contaId, documentos, doc, aoVerTodos, anterior, guardar, aoImportar, aoReler, nomeAbertoDev, faixaConta, faixaArquivos, faixaAtalhos, noLugarDaFila }: {
  /** A conta, os arquivos lidos (a linha de baixo) e os atalhos da faixa, que a tela de fora monta. */
  faixaConta?: ReactNode; faixaArquivos?: ReactNode; faixaAtalhos?: ReactNode
  /** O que ocupa o lugar da fila enquanto está aberto (as colunas do arquivo). A fila fica guardada. */
  noLugarDaFila?: ReactNode
  previa: PreviewImportacao; categorias: Category[]; subcategorias: Subcategory[]; contaNome: string
  /** A conta do extrato (escolhida antes do arquivo). */
  contaId: string
  /** Lê de novo os mesmos arquivos (depois de ensinar um nome), guardando as escolhas. */
  aoReler: () => Promise<void>
  /** DEV: abre o "Qual parte é o nome?" (estado do painel). */
  nomeAbertoDev?: boolean
  /** Os arquivos lidos e o que foi escolhido nos cartões de cima (null = todos). */
  documentos: FichaArquivo[]; doc: string | null; aoVerTodos: () => void
  anterior: Escolhas | null; guardar: (e: Escolhas) => void
  /** `anexos[k]`: os arquivos da linha `linhas[k]` (sobem depois, pro lançamento que ela virou). */
  aoImportar: (linhas: Parameters<typeof confirmarImportacao>[1], chave: string, anexos: File[][]) => Promise<void>
}) {
  const [marcadas, setMarcadas] = useState(() => previa.linhas.map((l) => anterior?.linhas[idDaLinha(l)]?.marcada ?? !l.duplicada))
  const [cats, setCats] = useState(() => previa.linhas.map((l) => anterior?.linhas[idDaLinha(l)]?.cat ?? l.categoriaSugeridaId ?? ""))
  const [detalhes, setDetalhes] = useState<Detalhe[]>(() => previa.linhas.map((l) => ({ ...detalheInicial(l), ...anterior?.linhas[idDaLinha(l)]?.det })))
  const [erro, setErro] = useState<string | null>(null)
  const [importando, setImportando] = useState(false)
  // Uma chave por prévia: toda tentativa de importar ESTA leitura usa a mesma.
  const [chave] = useState(() => crypto.randomUUID())
  const opcoesPorTipo = useMemo(() => {
    const de = (tipo: number) => [{ valor: "", rotulo: "Sem categoria" },
      ...categorias.filter((c) => aceitaTipo(c, tipo))
        .sort((a, b) => Number(ehOutros(a)) - Number(ehOutros(b)) || a.descricao.localeCompare(b.descricao, "pt-BR"))
        .map((c) => ({ valor: c.id, rotulo: c.descricao }))]
    return { [TIPO.despesa]: de(TIPO.despesa), [TIPO.receita]: de(TIPO.receita) } as Record<number, { valor: string; rotulo: string }[]>
  }, [categorias])

  const qtd = marcadas.filter(Boolean).length

  // Por lugar: as linhas do mesmo estabelecimento juntas, pra categorizar o grupo de uma vez (e o servidor lembra pra
  // próxima). A ordem nasce com a prévia e não muda enquanto a pessoa escolhe: primeiro o que veio sem categoria, do
  // lugar que mais aparece pro que menos. Quem respondeu (confirmou, pulou ou deixou de fora) ganha o check.
  const [base] = useState(() => agrupar(previa.linhas))
  // Linha separada -> a chave do item dela em "Separados" ("+n": sozinha ou junto com outras).
  const [separados, setSeparados] = useState<Record<number, string>>(() => Object.fromEntries(previa.linhas.flatMap((l, i) => {
    const k = anterior?.linhas[idDaLinha(l)]?.separado
    return k ? [[i, k]] : []
  })))
  const [nomes, setNomes] = useState<Record<string, string>>(() => anterior?.nomes ?? {})
  const seq = useRef(Math.max(0, ...Object.values(separados).map((k) => Number(k.slice(1)))) + 1)
  const novaChave = () => `+${seq.current++}`
  const grupos = useMemo(() => montarGrupos(base, previa.linhas, separados, nomes), [base, previa.linhas, separados, nomes])
  const [respondidos, setRespondidos] = useState<Record<string, Resposta>>(() => anterior?.respondidos ?? {})
  const faltamRevisar = grupos.filter((g) => !g.especial && !g.forte && !respondidos[g.chave]).length
  // Um arquivo por vez: a lista mostra só os lançamentos dele. É só o que aparece; a categoria continua sendo do lugar
  // inteiro (vale também pros lançamentos dele nos outros arquivos) e o "Importar" leva tudo o que está marcado.
  const gruposVisiveis = useMemo(() => {
    const nomes = doc ? documentos.find((d) => d.chave === doc)?.nomes : null
    if (!nomes) return grupos
    const dele = (i: number) => { const a = previa.linhas[i].arquivo; return !a || nomes.includes(a) }
    return grupos.flatMap((g) => {
      const ix = g.indices.filter(dele)
      return ix.length === g.indices.length ? [g] : ix.length > 0 ? [{ ...g, indices: ix, total: ix.reduce((t, i) => t + previa.linhas[i].valor, 0) }] : []
    })
  }, [grupos, doc, documentos, previa.linhas])
  const visiveis = gruposVisiveis === grupos ? previa.total : new Set(gruposVisiveis.flatMap((g) => g.indices)).size
  useEffect(() => {
    guardar({ linhas: Object.fromEntries(previa.linhas.map((l, i) => [idDaLinha(l), { marcada: marcadas[i], cat: cats[i], separado: separados[i], det: detalhes[i] }])), respondidos, nomes })
  }, [previa, marcadas, cats, detalhes, respondidos, separados, nomes, guardar])

  const importar = async () => {
    setErro(null)
    if (!contaId) { setErro("Escolha a conta"); return }
    const horaRuim = previa.linhas.findIndex((_, i) => marcadas[i] && detalhes[i].hora && !horaValida(detalhes[i].hora))
    if (horaRuim >= 0) { setErro(`Confira a hora de "${detalhes[horaRuim].descricao || previa.linhas[horaRuim].descricao}".`); return }
    const linhas = previa.linhas.flatMap((l, i) => (marcadas[i]
      ? [{ data: l.data, descricao: l.descricao, valor: l.valor, tipo: l.tipo, fitId: l.fitId,
        categoriaId: soRegistro(l) ? null : cats[i] || null,
        // O que a pessoa conferiu na ficha. Descrição igual à do banco (ou vazia) não vai: o servidor usa a do banco.
        descricaoEditada: detalhes[i].descricao.trim() && detalhes[i].descricao.trim() !== l.descricao ? detalhes[i].descricao.trim() : null,
        subcategoriaId: !soRegistro(l) && cats[i] && detalhes[i].sub ? detalhes[i].sub : null,
        meioPagamento: detalhes[i].meio,
        hora: detalhes[i].hora ? `${detalhes[i].hora}:00` : null,
        latitude: detalhes[i].ponto?.latitude ?? null,
        longitude: detalhes[i].ponto?.longitude ?? null,
        // Separado do lugar: a categoria vale só pra ele, não muda o que o app lembra do lugar.
        ...(separados[i] !== undefined ? { naoLembrar: true } : {}) }]
      : []))
    if (linhas.length === 0) { setErro("Marque pelo menos um lançamento."); return }
    const anexos = previa.linhas.flatMap((_, i) => (marcadas[i] ? [detalhes[i].anexos] : []))
    setImportando(true)
    try {
      await aoImportar(linhas, chave, anexos)
    } catch (e) {
      setErro(mensagemDeErro(e)); setImportando(false)
    }
  }

  // Os números da faixa: só o que está marcado; o que é só registro e o dinheiro de empréstimo não contam como entrou/saiu.
  const resumoDaJanela = (() => {
    const ix = previa.linhas.map((_, i) => i).filter((i) => marcadas[i])
    const conta = (i: number) => { const l = previa.linhas[i]; return !soRegistro(l) && l.natureza !== "emprestimo" }
    const soma = (tipo: number) => ix.filter((i) => previa.linhas[i].tipo === tipo && conta(i)).reduce((t, i) => t + previa.linhas[i].valor, 0)
    const dias = ix.map((i) => previa.linhas[i].data.slice(0, 10)).sort()
    return {
      entrou: soma(TIPO.receita), saiu: soma(TIPO.despesa),
      periodo: dias.length === 0 ? "" : dias[0] === dias[dias.length - 1] ? dataBR(dias[0]) : `${dataBR(dias[0])} a ${dataBR(dias[dias.length - 1])}`,
      semCategoria: ix.filter((i) => !soRegistro(previa.linhas[i]) && !cats[i]).length,
    }
  })()
  // A faixa de cima (conta, arquivos, os números e o Importar, sempre à vista) e a fila embaixo.
  return (
    <>
      <Bloco>
          <div className={styles.faixaTopo}>
            <div className={styles.faixaLida}>{faixaConta}</div>
            <div className={styles.resumoAcoes}>
              {faixaAtalhos}
              <Botao variante={faltamRevisar === 0 ? "primario" : "secundario"} disabled={importando || qtd === 0} onClick={() => { void importar() }}>
                {importando ? "Importando…"
                  : faltamRevisar === 0 ? `Importar ${qtd} ${qtd === 1 ? "lançamento" : "lançamentos"}`
                  : `Importar com ${faltamRevisar} ${faltamRevisar === 1 ? "pendente" : "pendentes"}`}</Botao>
            </div>
          </div>
          {faixaArquivos}
          {erro && <p className={styles.alerta} role="alert">{erro}</p>}
          <div className={styles.resumoNumeros} role="group" aria-label="O que vai entrar">
            <div><span>{resumoDaJanela.periodo || "Lançamentos"}</span><span className={styles.resumoValor}>{qtd} {qtd === 1 ? "lançamento" : "lançamentos"}</span></div>
            <div><span>Entrou</span><Dinheiro valor={resumoDaJanela.entrou} tom="positivo" className={styles.resumoValor} /></div>
            <div><span>Saiu</span><Dinheiro valor={resumoDaJanela.saiu} tom="negativo" className={styles.resumoValor} /></div>
            <div><span>Sem categoria</span><span className={styles.resumoValor}>{resumoDaJanela.semCategoria}</span></div>
          </div>
          {visiveis !== previa.total && <p className={styles.importadoNota}><Botao variante="texto" onClick={aoVerTodos}>Ver todos os arquivos</Botao></p>}
      </Bloco>
      {noLugarDaFila}
      {grupos.length > 0 && (
        <div className={styles.guardado} hidden={!!noLugarDaFila}>
        <RevisarLugares nomeAbertoDev={nomeAbertoDev} key={doc ?? ""} grupos={gruposVisiveis} linhas={previa.linhas} categorias={categorias} subcategorias={subcategorias}
          cats={cats} marcadas={marcadas} detalhes={detalhes} contaNome={contaNome}
          respondidos={respondidos} opcoesPorTipo={opcoesPorTipo}
          aoDetalhe={(i, mudou) => setDetalhes((v) => v.map((d, j) => (j === i ? { ...d, ...mudou } : d)))}
          aoSubcategoria={(g, s) => {
            const todos = grupos.find((x) => x.chave === g.chave)?.indices ?? g.indices
            setDetalhes((v) => v.map((d, j) => (todos.includes(j) ? { ...d, sub: s } : d)))
          }}
          aoCategoria={(g, c) => {
            // A categoria é do lugar inteiro, mesmo vendo só um arquivo.
            const todos = grupos.find((x) => x.chave === g.chave)?.indices ?? g.indices
            setCats((v) => v.map((x, j) => (todos.includes(j) ? c : x)))
            // Outra categoria: a subcategoria era da antiga.
            setDetalhes((v) => v.map((d, j) => (todos.includes(j) && d.sub ? { ...d, sub: "" } : d)))
          }}
          aoSeparar={(i) => setSeparados((v) => ({ ...v, [i]: novaChave() }))}
          aoSepararPorDocumento={(g) => {
            // O primeiro documento fica no lugar; cada outro vira um grupo dele, com o documento no nome.
            const porDoc = new Map<string, number[]>()
            for (const i of g.indices) { const d = previa.linhas[i].documento ?? ""; porDoc.set(d, [...(porDoc.get(d) ?? []), i]) }
            const novos = [...porDoc.entries()].slice(1).map(([d, ix]) => ({ k: novaChave(), d, ix }))
            setSeparados((v) => ({ ...v, ...Object.fromEntries(novos.flatMap(({ k, ix }) => ix.map((i) => [i, k]))) }))
            setNomes((v) => ({ ...v, ...Object.fromEntries(novos.map(({ k, d }) => [k, d ? `${g.nome} · ${d}` : g.nome])) }))
          }}
          aoVoltar={(g) => setSeparados((v) => Object.fromEntries(Object.entries(v).filter(([i]) => !g.indices.includes(Number(i)))))}
          aoJuntar={(chaves) => {
            const k = novaChave()
            const juntos = new Set(grupos.filter((g) => chaves.includes(g.chave)).flatMap((g) => g.indices))
            // A categoria do primeiro que já tinha uma vale pro grupo novo.
            const cat = [...juntos].map((i) => cats[i]).find(Boolean) ?? ""
            setSeparados((v) => ({ ...v, ...Object.fromEntries([...juntos].map((i) => [i, k])) }))
            setCats((v) => v.map((x, j) => (juntos.has(j) ? cat : x)))
            return k
          }}
          aoRenomear={(k, nome) => setNomes((v) => ({ ...v, [k]: nome }))}
          aoEnsinarNome={async (descricao, nome, k, lembrar) => {
            if (!lembrar) { setNomes((v) => ({ ...v, [k]: nome })); return }
            await ensinarNome(descricao, nome)
            await aoReler()
          }}
          aoMarcar={(i, on) => setMarcadas((m) => m.map((x, j) => (j === i ? on : x)))}
          aoResponder={(chaves, como) => {
            setRespondidos((r) => ({ ...r, ...Object.fromEntries(chaves.map((k) => [k, como])) }))
            if (como === "fora") {
              const fora = new Set(grupos.filter((g) => chaves.includes(g.chave)).flatMap((g) => g.indices))
              setMarcadas((m) => m.map((x, j) => (fora.has(j) ? false : x)))
            }
          }} />
        </div>
      )}
    </>
  )
}
