// Tela da transação do v2 — ver, editar e excluir. Mesmas regras do app atual:
// - pagamento de fatura e perna de transferência não se editam (o outro lado ficaria desemparelhado):
//   o pagamento se ESTORNA, a transferência se exclui inteira (as duas pernas juntas);
// - a edição não troca conta nem cartão (o back ignora) — eles aparecem fixos, sem select enganoso;
// - data futura só em compra no cartão ou lançamento previsto (o back recusa o resto);
// - lançamento sem hora pode continuar sem hora (decisão do Gustavo, PR #299); com hora, ela é obrigatória.
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Pencil, Trash2, Undo2 } from "lucide-react"
import { deleteTransaction, getTransaction, updateTransaction } from "../services/transactionService"
import { estornarPagamento } from "../services/faturaService"
import { getCategories } from "../services/categoryService"
import { getSubcategories } from "../services/subcategoryService"
import { mensagemDeErro } from "../api/cliente"
import type { Transaction } from "../types/Transaction"
import type { Category } from "../types/Category"
import type { Subcategory } from "../types/Subcategory"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import Confirmar from "../componentes/Confirmar"
import Selecao from "../componentes/Selecao"
import { Dinheiro, type TomDinheiro } from "../componentes/Dinheiro"
import { maskMoney, moneyParaCampo, parseMoney, formatMoney } from "../utils/money"
import { dataLocalISO, mascararHora } from "../utils/dateTime"
import styles from "./Transacao.module.css"

// Meios de pagamento de conta (crédito não entra: compra no cartão não troca de meio na edição).
const MEIOS_CONTA = [
  { valor: 4, rotulo: "Pix" },
  { valor: 2, rotulo: "Débito" },
  { valor: 1, rotulo: "Dinheiro" },
  { valor: 5, rotulo: "TED / DOC" },
  { valor: 6, rotulo: "Boleto" },
]
const MAX_DESCRICAO = 255 // [MaxLength(255)] no back
const MAX_DIGITOS_VALOR = 12 // até R$ 9.999.999.999,99

const naturezaDe = (t: Transaction) =>
  t.ehTransferencia ? "Transferência" : t.ehPagamentoFatura ? "Pagamento de fatura" : t.tipo === 2 ? "Receita" : "Despesa"
const fmtData = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`

export default function Transacao() {
  const { id = "" } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const editando = location.pathname.endsWith("/editar")
  const voltarPara = (location.state as { voltarPara?: string } | null)?.voltarPara ?? "/transacoes"

  const [t, setT] = useState<Transaction | null>(null)
  const [naoEncontrada, setNaoEncontrada] = useState(false)
  const [categorias, setCategorias] = useState<Category[]>([])
  const [subcategorias, setSubcategorias] = useState<Subcategory[]>([])

  // Relê ao trocar de modo: depois de salvar, o "ver" mostra o que ficou gravado.
  useEffect(() => {
    let vivo = true
    setT(null); setNaoEncontrada(false)
    getTransaction(id).then((x) => { if (vivo) setT(x) }).catch(() => { if (vivo) setNaoEncontrada(true) })
    return () => { vivo = false }
  }, [id, editando])

  useEffect(() => {
    let vivo = true
    getCategories().then((c) => { if (vivo) setCategorias(c) }).catch(() => { /* fica sem nome de categoria */ })
    getSubcategories().then((s) => { if (vivo) setSubcategorias(s) }).catch(() => { /* idem */ })
    return () => { vivo = false }
  }, [])

  const voltar = <Link to={voltarPara} className={styles.voltar}><ArrowLeft size={16} strokeWidth={2.25} aria-hidden="true" /> Transações</Link>

  if (naoEncontrada)
    return (
      <div className={styles.pagina}>
        {voltar}
        <h1 className={styles.titulo}>Transação não encontrada</h1>
        <p className={styles.muted}>Ela pode ter sido excluída.</p>
      </div>
    )
  if (!t) return <div className={styles.pagina}>{voltar}<Bloco><Esqueleto linhas={5} altura={16} /></Bloco></div>

  const editavel = !t.ehPagamentoFatura && !t.ehTransferencia
  if (editando && editavel)
    return <Editar t={t} categorias={categorias} subcategorias={subcategorias} voltar={voltar}
      aoSalvar={() => navigate(`/transacoes/${t.id}`, { replace: true, state: location.state })}
      aoCancelar={() => navigate(`/transacoes/${t.id}`, { replace: true, state: location.state })} />

  return <Ver t={t} categorias={categorias} subcategorias={subcategorias} voltar={voltar} editavel={editavel}
    aoEditar={() => navigate(`/transacoes/${t.id}/editar`, { replace: true, state: location.state })}
    aoSair={() => navigate(voltarPara, { replace: true })} />
}

// ─────────────────────────────────────────────────────────────────────────────── ver

function Ver({ t, categorias, subcategorias, voltar, editavel, aoEditar, aoSair }: {
  t: Transaction; categorias: Category[]; subcategorias: Subcategory[]; voltar: React.ReactNode
  editavel: boolean; aoEditar: () => void; aoSair: () => void
}) {
  const [excluindo, setExcluindo] = useState(false)
  const [estornando, setEstornando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  // Idempotency-Key do estorno: nasce quando a confirmação ABRE e vale pra toda tentativa dela — se a rede
  // cair depois de o servidor estornar, confirmar de novo devolve o mesmo estorno em vez de estornar 2x.
  const chaveEstorno = useRef("")

  const neutro = !!(t.ehTransferencia || t.ehPagamentoFatura)
  const tom: TomDinheiro | undefined = neutro ? "neutro" : t.tipo === 2 ? "positivo" : "negativo"
  const cat = categorias.find((c) => c.id === t.categoriaId)
  const sub = subcategorias.find((s) => s.id === t.subcategoriaId)
  const parcela = t.numeroParcela && t.parcelas && t.parcelas > 1 ? `Parcela ${t.numeroParcela} de ${t.parcelas}` : null

  const dados: [string, string][] = [
    ["Data", t.hora ? `${fmtData(t.data)} às ${t.hora.slice(0, 5)}` : fmtData(t.data)],
    [t.cartaoCreditoId ? "Cartão" : "Conta", t.cartaoCreditoNome ?? t.contaNome ?? "—"],
    ["Meio de pagamento", t.meioPagamentoDescricao ?? "—"],
    ["Categoria", cat ? (sub ? `${cat.descricao} › ${sub.nome}` : cat.descricao) : "—"],
  ]

  const excluir = async () => {
    setOcupado(true); setErro(null)
    try { await deleteTransaction(t.id) } catch (e) { setErro(mensagemDeErro(e)); setOcupado(false); setExcluindo(false); return }
    aoSair()
  }

  const abrirEstorno = () => { chaveEstorno.current = crypto.randomUUID(); setErro(null); setEstornando(true) }
  const estornar = async () => {
    setOcupado(true); setErro(null)
    try {
      await estornarPagamento(t.id, chaveEstorno.current)
    } catch (e) {
      // 409 = já estornado (outra aba, retry): o resultado é o mesmo — sai. Rede/5xx: fica pra tentar de novo (mesma chave).
      if ((e as { response?: { status?: number } })?.response?.status === 409) { aoSair(); return }
      setErro(mensagemDeErro(e)); setOcupado(false); return
    }
    aoSair()
  }

  return (
    <div className={styles.pagina}>
      {voltar}
      <header className={styles.cabecalho}>
        <div className={styles.tituloBloco}>
          <h1 className={styles.titulo}>{t.descricao}</h1>
          <div className={styles.chips}>
            <span className={styles.chip} data-tom={neutro ? undefined : t.tipo === 2 ? "positivo" : "negativo"}>{naturezaDe(t)}</span>
            {t.statusTransacao === 0
              ? <span className={styles.chip} data-tom="alerta">Previsto</span>
              : <span className={styles.chip}>Efetivado</span>}
            {t.recorrenteOrigemId && <span className={styles.chip}>Conta fixa</span>}
            {parcela && <span className={styles.chip}>{parcela}</span>}
          </div>
        </div>
        <div className={styles.acoes}>
          {editavel && (
            <button type="button" className={styles.botao} onClick={aoEditar}><Pencil size={15} strokeWidth={2.25} aria-hidden="true" /> Editar</button>
          )}
          {t.ehPagamentoFatura ? (
            <button type="button" className={styles.botao} onClick={abrirEstorno}><Undo2 size={15} strokeWidth={2.25} aria-hidden="true" /> Estornar pagamento</button>
          ) : (
            <button type="button" className={styles.botao} data-perigo="true" onClick={() => { setErro(null); setExcluindo(true) }}>
              <Trash2 size={15} strokeWidth={2.25} aria-hidden="true" /> Excluir
            </button>
          )}
        </div>
      </header>

      {erro && <p className={styles.alerta} role="alert">{erro}</p>}

      <Bloco>
        <Dinheiro valor={t.valor} tom={tom} className={styles.valor} />
        <dl className={styles.dados}>
          {dados.map(([rotulo, valor]) => (
            <div key={rotulo} className={styles.dado}><dt>{rotulo}</dt><dd>{valor}</dd></div>
          ))}
        </dl>
      </Bloco>

      <Confirmar
        aberto={excluindo}
        titulo="Excluir transação?"
        texto={t.ehTransferencia
          ? <>{t.descricao} · {formatMoney(t.valor)} — <strong>as duas pernas da transferência</strong> saem juntas.</>
          : <>{t.descricao} · {formatMoney(t.valor)}</>}
        rotuloConfirmar="Excluir"
        perigo
        ocupado={ocupado}
        onConfirmar={() => { void excluir() }}
        onCancelar={() => setExcluindo(false)}
      />
      <Confirmar
        aberto={estornando}
        titulo="Estornar pagamento?"
        texto={<>{formatMoney(t.valor)} voltam pra conta e a fatura volta a dever esse valor.{erro && <span className={styles.erroDialogo}>{erro}</span>}</>}
        rotuloConfirmar="Estornar"
        ocupado={ocupado}
        onConfirmar={() => { void estornar() }}
        onCancelar={() => { setEstornando(false); setErro(null) }}
      />
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────── editar

function Editar({ t, categorias, subcategorias, voltar, aoSalvar, aoCancelar }: {
  t: Transaction; categorias: Category[]; subcategorias: Subcategory[]; voltar: React.ReactNode
  aoSalvar: () => void; aoCancelar: () => void
}) {
  const noCartao = !!t.cartaoCreditoId
  const horaOpcional = !t.hora // lançamento sem hora (ex.: extrato importado) pode continuar sem hora
  const [tipo, setTipo] = useState(t.tipo === 2 ? 2 : 1)
  const [valor, setValor] = useState(moneyParaCampo(t.valor))
  const [data, setData] = useState(t.data)
  const [hora, setHora] = useState(t.hora ? t.hora.slice(0, 5) : "")
  const [meio, setMeio] = useState(t.meioPagamento ?? 4)
  const [categoriaId, setCategoriaId] = useState(t.categoriaId ?? "")
  const [subcategoriaId, setSubcategoriaId] = useState(t.subcategoriaId ?? "")
  const [descricao, setDescricao] = useState(t.descricao)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  // Data futura só no cartão ou em lançamento previsto (o back recusa o resto).
  const dataMax = noCartao || t.statusTransacao === 0 ? undefined : dataLocalISO()
  // Categorias que servem pro tipo (1 = despesa, 2 = receita, 3 = ambas).
  const cats = useMemo(() => categorias.filter((c) => c.finalidade === 3 || c.finalidade === tipo), [categorias, tipo])
  const subs = useMemo(() => subcategorias.filter((s) => s.categoriaId === categoriaId), [subcategorias, categoriaId])
  const limpa = (campo: string) => setErros((e) => { if (!e[campo]) return e; const n = { ...e }; delete n[campo]; return n })

  const trocarTipo = (novo: number) => {
    setTipo(novo)
    // Categoria que não serve pro tipo novo cai fora (o select não teria como mostrá-la).
    const atual = categorias.find((c) => c.id === categoriaId)
    if (atual && atual.finalidade !== 3 && atual.finalidade !== novo) { setCategoriaId(""); setSubcategoriaId("") }
  }

  const validar = () => {
    const e: Record<string, string> = {}
    if (parseMoney(valor) <= 0) e.valor = "Informe um valor"
    if (!descricao.trim()) e.descricao = "Informe a descrição"
    if (!data) e.data = "Informe a data"
    else if (dataMax && data > dataMax) e.data = "A data não pode ser futura"
    if (!categoriaId) e.categoria = "Escolha a categoria"
    if (hora) {
      const m = hora.match(/^(\d{2}):(\d{2})$/)
      if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) e.hora = "Hora inválida (HH:MM)"
    } else if (!horaOpcional) e.hora = "Informe a hora"
    setErros(e)
    return Object.keys(e).length === 0
  }

  const enviar = async (ev: FormEvent) => {
    ev.preventDefault()
    setErro(null)
    if (!validar()) return
    setSalvando(true)
    try {
      await updateTransaction(t.id, {
        descricao: descricao.trim(),
        valor: parseMoney(valor),
        tipo: noCartao ? t.tipo : tipo,
        categoriaId: categoriaId || null,
        subcategoriaId: subcategoriaId || null,
        contaId: t.contaId,
        cartaoCreditoId: t.cartaoCreditoId,
        meioPagamento: noCartao ? t.meioPagamento : meio,
        data,
        hora: hora ? `${hora}:00` : null,
      })
    } catch (e) {
      setErro(mensagemDeErro(e)); setSalvando(false); return
    }
    aoSalvar()
  }

  return (
    <div className={styles.pagina}>
      {voltar}
      <h1 className={styles.titulo}>Editar transação</h1>
      {erro && <p className={styles.alerta} role="alert">{erro}</p>}

      <Bloco>
        <form className={styles.form} onSubmit={(e) => { void enviar(e) }} noValidate>
          {!noCartao && (
            <div className={styles.segmentos} role="group" aria-label="Tipo">
              <button type="button" className={styles.segmento} data-ativo={tipo === 1 ? "true" : undefined} onClick={() => trocarTipo(1)}>Despesa</button>
              <button type="button" className={styles.segmento} data-ativo={tipo === 2 ? "true" : undefined} onClick={() => trocarTipo(2)}>Receita</button>
            </div>
          )}

          <label className={styles.campo}>
            <span>Valor</span>
            <span className={styles.valorCampo} data-invalido={erros.valor ? "true" : undefined}>
              <em>R$</em>
              <input inputMode="numeric" autoComplete="off" value={valor} aria-invalid={!!erros.valor}
                onChange={(e) => { setValor(maskMoney(e.target.value.replace(/\D/g, "").slice(0, MAX_DIGITOS_VALOR), valor)); limpa("valor") }} />
            </span>
            {erros.valor && <small className={styles.erro}>{erros.valor}</small>}
          </label>

          <div className={styles.grade2}>
            <label className={styles.campo}>
              <span>Data</span>
              <input type="date" value={data} max={dataMax} aria-invalid={!!erros.data} data-invalido={erros.data ? "true" : undefined}
                onChange={(e) => { setData(e.target.value); limpa("data") }} />
              {erros.data && <small className={styles.erro}>{erros.data}</small>}
            </label>
            <label className={styles.campo}>
              <span>Hora{horaOpcional ? " (opcional)" : ""}</span>
              <input inputMode="numeric" placeholder="HH:MM" maxLength={5} value={hora} aria-invalid={!!erros.hora} data-invalido={erros.hora ? "true" : undefined}
                onChange={(e) => { setHora(mascararHora(e.target.value)); limpa("hora") }} />
              {erros.hora && <small className={styles.erro}>{erros.hora}</small>}
            </label>
          </div>

          <div className={styles.grade2}>
            <div className={styles.campo}>
              <span>{noCartao ? "Cartão" : "Conta"}</span>
              <span className={styles.fixo} title="Conta e cartão não mudam na edição">{t.cartaoCreditoNome ?? t.contaNome ?? "—"}</span>
            </div>
            {noCartao ? (
              <div className={styles.campo}>
                <span>Meio de pagamento</span>
                <span className={styles.fixo}>Crédito</span>
              </div>
            ) : (
              <div className={styles.campo}>
                <span>Meio de pagamento</span>
                <Selecao ariaLabel="Meio de pagamento" valor={String(meio)} onChange={(v) => setMeio(Number(v))}
                  opcoes={MEIOS_CONTA.map((m) => ({ valor: String(m.valor), rotulo: m.rotulo }))} />
              </div>
            )}
          </div>

          <div className={styles.grade2}>
            <div className={styles.campo}>
              <span>Categoria</span>
              <Selecao ariaLabel="Categoria" valor={categoriaId} invalido={!!erros.categoria}
                onChange={(v) => { setCategoriaId(v); setSubcategoriaId(""); limpa("categoria") }}
                opcoes={cats.map((c) => ({ valor: c.id, rotulo: c.descricao }))} />
              {erros.categoria && <small className={styles.erro}>{erros.categoria}</small>}
            </div>
            <div className={styles.campo}>
              <span>Subcategoria (opcional)</span>
              <Selecao ariaLabel="Subcategoria" valor={subcategoriaId} desabilitado={subs.length === 0}
                placeholder={subs.length === 0 ? "Nenhuma" : "Sem subcategoria"} onChange={setSubcategoriaId}
                opcoes={subs.length === 0 ? [] : [{ valor: "", rotulo: "Sem subcategoria" }, ...subs.map((s) => ({ valor: s.id, rotulo: s.nome }))]} />
            </div>
          </div>

          <label className={styles.campo}>
            <span>Descrição</span>
            <input value={descricao} maxLength={MAX_DESCRICAO} aria-invalid={!!erros.descricao} data-invalido={erros.descricao ? "true" : undefined}
              onChange={(e) => { setDescricao(e.target.value); limpa("descricao") }} />
            {erros.descricao && <small className={styles.erro}>{erros.descricao}</small>}
          </label>

          <div className={styles.rodapeForm}>
            <button type="button" className={styles.botao} onClick={aoCancelar} disabled={salvando}>Cancelar</button>
            <button type="submit" className={styles.botaoPrimario} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</button>
          </div>
        </form>
      </Bloco>
    </div>
  )
}
