// Fila de pendentes (/pendentes, 2026-11-22; Gustavo: "a ideia é categorizar tudo", o que entra sem categoria não pode
// se perder). Os lançamentos que JÁ estão na conta e ficaram sem categoria, juntos por lugar: à esquerda a fila; à
// direita o lugar aberto, no MESMO desenho da fila do Importar extrato (as peças de CamposLancamento, as sugestões em
// botões, o cupom de detalhes). Aqui "Confirmar e próximo" grava na hora (o lançamento já existe): a categoria vale
// pros lançamentos marcados do lugar e vira a regra dele (a próxima importação já sugere). A ficha tem os MESMOS campos
// da transação (Gustavo, 2026-11-22: "cadê localização, cadê o documento? tá faltando campo"): descrição, hora, forma
// de pagamento, localização e anexos, gravados junto com a categoria. Valor, conta e data se mexem pela transação
// ("Abrir"). A conta mora no servidor: o que é pendente, de quem é e o que a categoria aceita
// (ImportacaoService.PendentesDe / CategorizarPendentesAsync).
import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { CheckCircle2, Pencil, Search, TextCursorInput } from "lucide-react"
import { getCategories } from "../services/categoryService"
import { getSubcategories } from "../services/subcategoryService"
import { categorizarPendentes, ensinarNome, getPendentes } from "../services/importacaoService"
import { getContas } from "../services/contaService"
import { juntarComoTransferencia } from "../services/transferenciaService"
import type { Conta } from "../types/Conta"
import Campo from "../componentes/Campo"
import Selecao from "../componentes/Selecao"
import { definirLocalizacao, enviarAnexo, listarAnexos, urlDoAnexo } from "../services/anexoService"
import { mensagemDeErro } from "../api/cliente"
import { definirPendentes } from "../estado/pendentes"
import type { Category } from "../types/Category"
import type { Subcategory } from "../types/Subcategory"
import type { AjustePendente, Pendente } from "../types/Importacao"
import type { AnexoTransacao, Ponto } from "../types/Transaction"
import Anexos from "../componentes/Anexos"
import Localizacao from "../componentes/Localizacao"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Cupom, { LinhaCupom } from "../componentes/Cupom"
import { Dinheiro } from "../componentes/Dinheiro"
import Entrada from "../componentes/Entrada"
import Formulario, { LinhaCampos, RodapeFormulario } from "../componentes/Formulario"
import Marcar from "../componentes/Marcar"
import { formatarData } from "../componentes/SeletorData"
import { CampoDescricao, CampoFixo, CampoMeio, CamposCategoria, TituloLancamento } from "./CamposLancamento"
import MarcarNome from "./MarcarNome"
import { aceitaTipo, ehOutros, maisRepetidos, sugestoesDeCategoria } from "../dominio/categoria"
import { nomeLegivel } from "../dominio/lugar"
import { MEIO, MEIOS_CONTA, MEIOS_RECEBIMENTO, TIPO, horaValida } from "../dominio/transacao"
import { mascararHora } from "../utils/dateTime"
import { moneyParaCampo } from "../utils/money"
// O desenho é o da fila do Importar extrato (mesma moldura, mesma lista, mesmo cartão): usa as classes dela, pra uma
// tela não desandar da outra.
import styles from "./ImportarExtrato.module.css"

type Lugar = { chave: string; nome: string; tipo: number; itens: Pendente[] }
/** O que a pessoa mexeu num lançamento da fila e ainda não gravou (vai junto com a categoria). */
type Edicao = { descricao?: string; hora?: string; meio?: number; ponto?: Ponto | null; anexos?: File[] }

/** Junta os pendentes por lugar (a chave já vem do servidor, com o tipo na frente), na ordem em que chegaram. `nomes`:
 *  o nome que a pessoa deu ao lugar nesta visita ("Qual é o nome?" sem "Usar nas próximas"). */
function porLugar(pendentes: Pendente[], nomes: Record<string, string>): Lugar[] {
  const mapa = new Map<string, Lugar>()
  for (const p of pendentes) {
    const g = mapa.get(p.chave)
    if (g) g.itens.push(p)
    else mapa.set(p.chave, { chave: p.chave, nome: nomes[p.chave] ?? (p.lugar || p.descricao), tipo: p.tipo, itens: [p] })
  }
  return [...mapa.values()]
}
const periodo = (itens: Pendente[]) => {
  const dias = itens.map((p) => p.data).sort()
  return dias[0] === dias[dias.length - 1] ? formatarData(dias[0]) : `${formatarData(dias[0])} a ${formatarData(dias[dias.length - 1])}`
}

export default function Pendentes() {
  const navigate = useNavigate()
  const [pendentes, setPendentes] = useState<Pendente[] | null>(null)
  const [total, setTotal] = useState(0)
  const [categorias, setCategorias] = useState<Category[]>([])
  const [subcategorias, setSubcategorias] = useState<Subcategory[]>([])
  const [erroCarga, setErroCarga] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [busca, setBusca] = useState("")
  const [chaveAtual, setChaveAtual] = useState<string | null>(null)
  // O que a pessoa escolheu em cada lugar (fica enquanto ela anda pela fila) e os lançamentos que ela tirou do lote.
  const [escolhas, setEscolhas] = useState<Record<string, { categoriaId: string; subcategoriaId: string }>>({})
  const [fora, setFora] = useState<Set<string>>(new Set())
  // O lançamento à vista na ficha (lugar com vários) e o que a pessoa mexeu em cada um.
  const [mostrado, setMostrado] = useState<string | null>(null)
  const [edicoes, setEdicoes] = useState<Record<string, Edicao>>({})
  const [editandoHora, setEditandoHora] = useState(false)
  const [jaAnexados, setJaAnexados] = useState<{ id: string; itens: AnexoTransacao[] } | null>(null)
  // "Foi entre minhas contas" (2026-11-22, a Swile mandando pro Nubank): o lugar aberto vira transferência com a conta
  // escolhida. Uma chave por lançamento e conta, guardada: repetir o clique não cria a perna duas vezes.
  const [entreContas, setEntreContas] = useState<{ chave: string; contaId: string; erro?: string } | null>(null)
  const [contas, setContas] = useState<Conta[]>([])
  const [chaves] = useState(() => new Map<string, string>())
  // "Qual é o nome?": aberto no lugar à vista, e os nomes que a pessoa deu sem guardar o padrão.
  const [marcandoNome, setMarcandoNome] = useState(false)
  const [nomes, setNomes] = useState<Record<string, string>>({})

  const carregar = async () => {
    try {
      const [fila, cats] = await Promise.all([getPendentes(), getCategories()])
      setPendentes(fila.itens); setTotal(fila.total); setCategorias(cats); definirPendentes(fila.total)
    } catch { setErroCarga(true) }
  }
  useEffect(() => {
    void carregar()
    // Subcategoria é opcional: sem ela o campo só fica sem opções.
    getSubcategories().then(setSubcategorias).catch(() => { /* segue sem */ })
  }, [])

  const lugares = useMemo(() => porLugar(pendentes ?? [], nomes), [pendentes, nomes])
  // As sugestões que o app tem pros pendentes, por tipo (as mais repetidas primeiro): entram depois das do lugar.
  const usadasPorTipo = useMemo(() => {
    const porTipo = new Map<number, string[]>()
    for (const tipo of new Set((pendentes ?? []).map((p) => p.tipo)))
      porTipo.set(tipo, maisRepetidos((pendentes ?? []).filter((p) => p.tipo === tipo).map((p) => p.categoriaSugeridaId)))
    return porTipo
  }, [pendentes])
  const visiveis = useMemo(() => {
    const q = busca.trim().toLocaleLowerCase("pt-BR")
    return q ? lugares.filter((g) => g.nome.toLocaleLowerCase("pt-BR").includes(q) || g.itens.some((p) => p.descricao.toLocaleLowerCase("pt-BR").includes(q))) : lugares
  }, [lugares, busca])
  const atual = lugares.find((g) => g.chave === chaveAtual) ?? lugares[0] ?? null
  const aVista = atual ? atual.itens.find((p) => p.id === mostrado) ?? atual.itens[0] : null
  // Trocou de lugar: o "Qual é o nome?" fecha.
  const chaveAberta = atual?.chave ?? null
  useEffect(() => { setMarcandoNome(false) }, [chaveAberta])
  // Os anexos que o lançamento à vista já tem (ele existe na conta): só pra mostrar; tirar é pela transação.
  const idAVista = aVista?.id ?? null
  useEffect(() => {
    if (!idAVista) return
    let vivo = true
    listarAnexos(idAVista).then((itens) => { if (vivo) setJaAnexados({ id: idAVista, itens }) }).catch(() => { /* sem a lista, só não mostra */ })
    return () => { vivo = false }
  }, [idAVista])

  if (erroCarga) return <div className={styles.pagina}><p className={styles.alerta} role="alert">Não foi possível carregar os pendentes. Recarregue a página.</p></div>
  if (!pendentes) return <div className={styles.pagina}><Bloco><Esqueleto linhas={4} altura={18} /></Bloco></div>

  if (lugares.length === 0) {
    return (
      <div className={styles.pagina}>
        <Bloco className={styles.fichaPronto}>
          <span className={styles.prontoIcone}><CheckCircle2 size={26} /></span>
          <p className={styles.prontoTitulo}>Nada pendente</p>
          <p className={styles.prontoTexto}>Todos os seus lançamentos têm categoria.</p>
        </Bloco>
      </div>
    )
  }

  const proximo = (chave: string) => {
    const i = lugares.findIndex((g) => g.chave === chave)
    return [...lugares.slice(i + 1), ...lugares.slice(0, Math.max(i, 0))].find((g) => g.chave !== chave)?.chave ?? null
  }

  const cartao = (g: Lugar, p: Pendente) => {
    const receita = g.tipo === TIPO.receita
    const marcados = g.itens.filter((x) => !fora.has(x.id))
    const n = g.itens.length
    const escolha = escolhas[g.chave] ?? { categoriaId: "", subcategoriaId: "" }
    const opcoes = categorias.filter((c) => aceitaTipo(c, g.tipo))
      .sort((x, y) => Number(ehOutros(x)) - Number(ehOutros(y)))
      .map((c) => ({ valor: c.id, rotulo: c.descricao }))
    const subs = subcategorias.filter((x) => x.categoriaId === escolha.categoriaId).map((x) => ({ valor: x.id, rotulo: x.nome }))
    // Os botões de sugestão (a mesma regra do Importar): o que o app sugere pro lugar, os mais sugeridos da fila, depois
    // as categorias do tipo.
    const sugestoes = escolha.categoriaId ? [] : sugestoesDeCategoria(categorias, g.tipo,
      [...maisRepetidos(g.itens.map((x) => x.categoriaSugeridaId)), ...(usadasPorTipo.get(g.tipo) ?? []), ...opcoes.map((o) => o.valor)])
    const escolher = (categoriaId: string) => { setErro(null); setEscolhas((v) => ({ ...v, [g.chave]: { categoriaId, subcategoriaId: "" } })) }

    // O lançamento à vista, com o que a pessoa já mexeu nele.
    const e = edicoes[p.id] ?? {}
    const mexer = (mudou: Edicao) => { setErro(null); setEdicoes((v) => ({ ...v, [p.id]: { ...v[p.id], ...mudou } })) }
    const descricao = e.descricao ?? p.descricao
    const hora = e.hora ?? (p.hora ? p.hora.slice(0, 5) : "")
    const horaRuim = hora.length > 0 && !horaValida(hora)
    const noCartao = p.meioPagamento === MEIO.credito
    const meio = e.meio ?? p.meioPagamento ?? null
    const pontoSalvo: Ponto | null = p.latitude != null && p.longitude != null ? { latitude: p.latitude, longitude: p.longitude } : null
    const ponto = e.ponto !== undefined ? e.ponto : pontoSalvo
    const novos = e.anexos ?? []
    const anexados = jaAnexados?.id === p.id ? jaAnexados.itens : []

    const confirmar = async () => {
      if (!escolha.categoriaId || marcados.length === 0 || salvando) return
      const comHoraRuim = marcados.find((x) => { const h = edicoes[x.id]?.hora; return !!h && !horaValida(h) })
      if (comHoraRuim) { setMostrado(comHoraRuim.id); setErro("Confira a hora (HH:MM)."); return }
      const semDescricao = marcados.find((x) => edicoes[x.id]?.descricao !== undefined && !edicoes[x.id]!.descricao!.trim())
      if (semDescricao) { setMostrado(semDescricao.id); setErro("Informe a descrição."); return }
      setErro(null); setSalvando(true)
      try {
        const ajustes: AjustePendente[] = marcados.flatMap((x) => {
          const ed = edicoes[x.id]
          if (!ed) return []
          const a: AjustePendente = { transacaoId: x.id }
          if (ed.descricao !== undefined && ed.descricao.trim() !== x.descricao) a.descricao = ed.descricao.trim()
          if (ed.hora) a.hora = `${ed.hora}:00`
          if (ed.meio !== undefined && ed.meio !== x.meioPagamento) a.meioPagamento = ed.meio
          return Object.keys(a).length > 1 ? [a] : []
        })
        // Só vira regra do lugar quando a categoria vale pra ele inteiro (ninguém ficou de fora do lote).
        const r = await categorizarPendentes(marcados.map((x) => x.id), escolha.categoriaId, escolha.subcategoriaId || null, marcados.length === n, ajustes)
        // Localização e anexos, depois da categoria gravada (o lançamento já existe: cada um vai pro dele).
        let falhas = 0
        for (const x of marcados) {
          const ed = edicoes[x.id]
          if (!ed) continue
          if (ed.ponto !== undefined) { try { await definirLocalizacao(x.id, ed.ponto) } catch { falhas++ } }
          for (const arquivo of ed.anexos ?? []) { try { await enviarAnexo(x.id, arquivo) } catch { falhas++ } }
        }
        const feitos = new Set(marcados.map((x) => x.id))
        const sobrou = marcados.length < n
        setPendentes((v) => (v ?? []).filter((x) => !feitos.has(x.id)))
        setTotal(r.restam); definirPendentes(r.restam)
        setFora((v) => { const novo = new Set(v); g.itens.forEach((x) => novo.delete(x.id)); return novo })
        setEdicoes((v) => Object.fromEntries(Object.entries(v).filter(([id]) => !feitos.has(id))))
        setMostrado(null)
        if (!sobrou) { setEscolhas((v) => { const { [g.chave]: _, ...resto } = v; return resto }); setChaveAtual(proximo(g.chave)) }
        if (falhas > 0) setErro(falhas === 1 ? "A categoria foi salva, mas uma coisa não subiu (local ou anexo). Dá pra pôr de novo pela transação."
          : `A categoria foi salva, mas ${falhas} coisas não subiram (local ou anexos). Dá pra pôr de novo pela transação.`)
      } catch (falha) {
        setErro(mensagemDeErro(falha))
      } finally {
        setSalvando(false)
      }
    }

    const abrindoEntreContas = entreContas?.chave === g.chave
    const abrirEntreContas = () => {
      setErro(null); setEntreContas({ chave: g.chave, contaId: "" })
      if (contas.length === 0) getContas().then(setContas).catch(() => setEntreContas((v) => v && { ...v, erro: "Não foi possível carregar as contas." }))
    }
    const outrasContas = contas.filter((c) => c.nome !== p.origem).map((c) => ({ valor: c.id, rotulo: c.nome }))
    const juntar = async () => {
      if (!entreContas || salvando) return
      if (!entreContas.contaId) { setEntreContas({ ...entreContas, erro: "Escolha a conta" }); return }
      setSalvando(true)
      const feitos = new Set<string>()
      try {
        for (const x of marcados) {
          const k = `${x.id}:${entreContas.contaId}`
          if (!chaves.has(k)) chaves.set(k, crypto.randomUUID())
          await juntarComoTransferencia(x.id, entreContas.contaId, chaves.get(k)!)
          feitos.add(x.id)
        }
        setEntreContas(null)
      } catch (falha) {
        setErro(mensagemDeErro(falha))
      } finally {
        if (feitos.size > 0) {
          const restam = Math.max(0, total - feitos.size)
          setPendentes((v) => (v ?? []).filter((x) => !feitos.has(x.id)))
          setTotal(restam); definirPendentes(restam)
          setMostrado(null)
          if (feitos.size === n) setChaveAtual(proximo(g.chave))
        }
        setSalvando(false)
      }
    }

    return (
      <Bloco>
        <TituloLancamento titulo={nomeLegivel(g.nome)} valor={moneyParaCampo(p.valor)} tom={receita ? "positivo" : "negativo"}
          meta={<>
            <span>{n === 1 ? "1 lançamento" : `${n} lançamentos, ${periodo(g.itens)}`}</span>
            <button type="button" className={styles.fichaSeparar} data-ativo={marcandoNome || undefined} aria-expanded={marcandoNome}
              onClick={() => setMarcandoNome((v) => !v)}>
              <TextCursorInput size={14} strokeWidth={2.25} aria-hidden="true" />Qual é o nome?
            </button>
          </>} />
        {marcandoNome && (
          <div className={styles.oficinaNome}>
            <MarcarNome key={p.id} descricao={p.descricao} pedacos={p.pedacos ?? undefined}
              onFechar={() => setMarcandoNome(false)}
              aoSalvar={async (nome, lembrar) => {
                if (!lembrar) { setNomes((v) => ({ ...v, [g.chave]: nome })); return }
                // Guardou o padrão: a fila vem de novo do servidor (os lançamentos com a mesma forma se juntam) e o
                // cartão continua no lançamento que estava aberto.
                await ensinarNome(p.descricao, nome)
                const fila = await getPendentes()
                setNomes((v) => { const { [g.chave]: _, ...resto } = v; return resto })
                setPendentes(fila.itens); setTotal(fila.total); definirPendentes(fila.total)
                const k = fila.itens.find((x) => x.id === p.id)?.chave
                if (k) setChaveAtual(k)
              }} />
          </div>
        )}
          <Formulario onSubmit={() => { void confirmar() }}>
            {erro && <p className={styles.alerta} role="alert">{erro}</p>}
            <div className={styles.lancGrade}>
              {/* Esquerda: os campos, na ordem de Nova transação (as peças de CamposLancamento). O valor e a conta são
                  do lançamento que já existe: ficam no lugar deles, como texto. */}
              <div className={styles.lancPrincipal}>
                <CampoDescricao valor={descricao} placeholder={p.descricao} onChange={(x) => mexer({ descricao: x })} />
                <LinhaCampos>
                  {noCartao
                    ? <CampoFixo rotulo="Pago com">Crédito</CampoFixo>
                    : <CampoMeio rotulo={receita ? "Recebido por" : "Pago com"} valor={meio == null ? "" : String(meio)} placeholder="Escolha"
                        opcoes={(receita ? MEIOS_RECEBIMENTO : MEIOS_CONTA).map((m) => ({ valor: String(m.valor), rotulo: m.rotulo }))}
                        onChange={(x) => { if (x) mexer({ meio: Number(x) }) }} />}
                  <CampoFixo rotulo={noCartao ? "Cartão" : "Conta"}>{p.origem}</CampoFixo>
                </LinhaCampos>
                <CamposCategoria categoriaId={escolha.categoriaId} subcategoriaId={escolha.subcategoriaId} categorias={opcoes} subcategorias={subs}
                  aoCategoria={escolher}
                  aoSubcategoria={(x) => setEscolhas((v) => ({ ...v, [g.chave]: { ...escolha, subcategoriaId: x } }))} />
                {sugestoes.length > 0 && (
                  <div className={styles.sugestoes} role="group" aria-label={`Sugestões de categoria pra ${g.nome}`}>
                    <span className={styles.mudo}>Sugestões</span>
                    {sugestoes.map((id) => (
                      <button key={id} type="button" className={styles.chip} onClick={() => escolher(id)}>{opcoes.find((o) => o.valor === id)?.rotulo}</button>
                    ))}
                  </div>
                )}
              </div>
              {/* Direita: os detalhes do lançamento, um por linha com o rótulo (o mesmo cupom da fila do Importar). */}
              <Cupom rotulo="Detalhes do lançamento">
                <LinhaCupom rotulo="Tipo">{receita ? "Receita" : "Despesa"}</LinhaCupom>
                <LinhaCupom rotulo="Data">{formatarData(p.data)}</LinhaCupom>
                <LinhaCupom rotulo="Hora">
                  {editandoHora || horaRuim
                    ? <input className={styles.fHoraEditar} data-invalido={horaRuim || undefined} inputMode="numeric" placeholder="HH:MM" maxLength={5}
                        value={hora} aria-label="Hora" aria-invalid={horaRuim || undefined} autoFocus={editandoHora}
                        onChange={(ev) => mexer({ hora: mascararHora(ev.target.value) })}
                        onBlur={() => setEditandoHora(false)}
                        onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); setEditandoHora(false) } }} />
                    : <button type="button" className={styles.fEditavel} aria-label="Editar hora" title="Editar hora" onClick={() => setEditandoHora(true)}>
                        <span data-vazio={!hora || undefined}>{hora || "Sem hora"}</span>
                        <Pencil size={16} strokeWidth={2.25} className={styles.fichaLapis} aria-hidden="true" />
                      </button>}
                </LinhaCupom>
                <LinhaCupom rotulo="Localização"><Localizacao valor={ponto} onChange={(pt) => mexer({ ponto: pt })} desabilitado={salvando} /></LinhaCupom>
                <LinhaCupom rotulo="Anexos" empilhado>
                  <Anexos desabilitado={salvando}
                    itens={[
                      ...anexados.map((x) => ({ chave: x.id, nome: x.nome, tipo: x.tipoConteudo, url: urlDoAnexo(p.id, x.id) })),
                      ...novos.map((f, k) => ({ chave: `novo-${k}`, nome: f.name, tipo: f.type, arquivo: f })),
                    ]}
                    onAdicionar={(arquivos) => mexer({ anexos: [...novos, ...arquivos] })}
                    onRemover={(chave) => { if (chave.startsWith("novo-")) mexer({ anexos: novos.filter((_, k) => `novo-${k}` !== chave) }) }} />
                </LinhaCupom>
              </Cupom>
            </div>
            {n > 1 && <>
              <p className={styles.fichaSecao}>Lançamentos</p>
              <Cupom rotulo={`Lançamentos de ${g.nome}`}>
                {g.itens.map((x) => (
                  <div key={x.id} className={styles.cupomLanc} data-fora={fora.has(x.id) || undefined} data-aberto={x.id === p.id || undefined}>
                    <Marcar marcado={!fora.has(x.id)} ariaLabel={`Categorizar ${x.descricao} de ${formatarData(x.data)}`}
                      onChange={(on) => setFora((v) => { const novo = new Set(v); if (on) novo.delete(x.id); else novo.add(x.id); return novo })} />
                    <button type="button" className={styles.cupomLancTexto} aria-pressed={x.id === p.id} aria-label={`Ver os detalhes de ${formatarData(x.data)}`}
                      onClick={() => { setEditandoHora(false); setMostrado(x.id) }}>
                      <span className={styles.cupomLancData}>{formatarData(x.data)}{x.hora ? ` ${x.hora.slice(0, 5)}` : ""}</span>
                      <span className={styles.noExtrato}>{edicoes[x.id]?.descricao ?? x.descricao}</span>
                    </button>
                    <Link className={styles.fichaSeparar} to={`/transacoes/${x.id}`} state={{ voltarPara: "/pendentes" }}>Abrir</Link>
                    <span className={styles.fichaValor} data-tom={fora.has(x.id) ? undefined : receita ? "positivo" : "negativo"}><Dinheiro valor={x.valor} /></span>
                  </div>
                ))}
              </Cupom>
            </>}
            {abrindoEntreContas && (
              <LinhaCampos>
                <Campo rotulo={receita ? "Veio da conta" : "Foi pra conta"} erro={entreContas?.erro}>
                  <Selecao valor={entreContas?.contaId ?? ""} opcoes={outrasContas} placeholder="Escolha" semBusca
                    onChange={(v) => setEntreContas({ chave: g.chave, contaId: v })} />
                </Campo>
                <div className={styles.rodapeEsquerda}>
                  <Botao disabled={salvando} onClick={() => setEntreContas(null)}>Cancelar</Botao>
                  <Botao variante="primario" disabled={salvando} onClick={() => { void juntar() }}>
                    {salvando ? "Salvando…" : marcados.length > 1 ? `Juntar os ${marcados.length}` : "Juntar"}</Botao>
                </div>
              </LinhaCampos>
            )}
            <RodapeFormulario>
              <span className={styles.rodapeEsquerda}>
                {n === 1 && <Botao variante="texto" onClick={() => navigate(`/transacoes/${p.id}`, { state: { voltarPara: "/pendentes" } })}>Abrir a transação</Botao>}
                {!noCartao && !abrindoEntreContas && <Botao variante="texto" disabled={salvando} onClick={abrirEntreContas}>Foi entre minhas contas</Botao>}
              </span>
              {lugares.length > 1 && <Botao disabled={salvando} onClick={() => { setErro(null); setEditandoHora(false); setMostrado(null); setChaveAtual(proximo(g.chave)) }}>Pular</Botao>}
              <Botao variante="primario" type="submit" disabled={salvando || !escolha.categoriaId || marcados.length === 0}>
                {salvando ? "Salvando…" : lugares.length > 1 ? "Confirmar e próximo" : "Confirmar"}</Botao>
            </RodapeFormulario>
          </Formulario>
      </Bloco>
    )
  }

  return (
    <div className={styles.pagina}>
      <div className={styles.oficina}>
        <Bloco semRespiro className={styles.oficinaFila}>
          <aside className={styles.lugares}>
            <div className={styles.lugaresTopo}>
              <p className={styles.lugaresConta}>
                <strong className={styles.filaFaltam}>{total === 1 ? "Falta 1" : `Faltam ${total}`}</strong>
                {total > pendentes.length && ` · os ${pendentes.length} mais recentes`}
              </p>
              {lugares.length > 6 && (
                <Entrada tamanho="sm" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar lugar ou lançamento" aria-label="Buscar lugar"
                  prefixo={<Search size={15} aria-hidden="true" />} />
              )}
            </div>
            <ul className={styles.lugaresLista} aria-label="Lugares pendentes">
              {visiveis.map((g) => (
                <li key={g.chave}>
                  <button type="button" className={styles.lugar} aria-current={g.chave === atual?.chave || undefined} data-situacao="pendente"
                    onClick={() => { setErro(null); setEditandoHora(false); setMostrado(null); setChaveAtual(g.chave) }}>
                    <span className={styles.lugarSinal} aria-hidden="true"><span className={styles.ponto} /></span>
                    <span className={styles.lugarTexto}>
                      <span className={styles.lugarNome}>{nomeLegivel(g.nome)}</span>
                      <span className={styles.lugarSub}>{g.itens.length === 1 ? formatarData(g.itens[0].data) : `${g.itens.length} lançamentos`}</span>
                    </span>
                    <span className={styles.lugarTotal}><Dinheiro valor={g.itens.reduce((t, p) => t + p.valor, 0)} /></span>
                  </button>
                </li>
              ))}
              {visiveis.length === 0 && <li className={styles.lugaresVazio}>Nenhum lugar com "{busca.trim()}"</li>}
            </ul>
          </aside>
        </Bloco>
        <div className={styles.oficinaMiolo}>{atual && aVista && cartao(atual, aVista)}</div>
      </div>
    </div>
  )
}
