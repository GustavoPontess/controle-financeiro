// Página de uma conta (/bancos/:id): saldo, dados e o extrato dela (lançamentos por dia, paginado no
// servidor). Ações no pé: Excluir (só conta sem lançamentos — o servidor recusa as outras), Encerrar (conta
// fechada no banco: página própria, o saldo tem destino) e Editar; conta encerrada ganha Reabrir.
import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Ban, Pencil, RotateCcw, Trash2, Wallet } from "lucide-react"
import { deleteConta, getConta, reabrirConta } from "../services/contaService"
import { listTransactionsPage } from "../services/transactionService"
import { getCategories } from "../services/categoryService"
import { mensagemDeErro } from "../api/cliente"
import type { Conta } from "../types/Conta"
import type { Transaction } from "../types/Transaction"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Confirmar from "../componentes/Confirmar"
import { Dinheiro } from "../componentes/Dinheiro"
import Etiqueta from "../componentes/Etiqueta"
import { RodapeFormulario } from "../componentes/Formulario"
import ListaPorDia from "../componentes/ListaPorDia"
import LogoMarca from "../componentes/LogoMarca"
import Paginacao, { TAMANHOS } from "../componentes/Paginacao"
import { descreverConta } from "../dominio/conta"
import { linhaDoLancamento } from "../dominio/linhaLancamento"
import { dataBR } from "../utils/dateTime"
import styles from "./ContaDetalhe.module.css"

const CHAVE_POR_PAGINA = "v2:porPagina:extratoConta"
const porPaginaSalvo = (): number => {
  try { const n = Number(localStorage.getItem(CHAVE_POR_PAGINA)); return (TAMANHOS as readonly number[]).includes(n) ? n : 25 } catch { return 25 }
}

export default function ContaDetalhe() {
  const { id = "" } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [conta, setConta] = useState<Conta | null | undefined>(undefined)
  const [erro, setErro] = useState<string | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  const carregar = () => getConta(id).then(setConta).catch(() => setConta(null))
  useEffect(() => { setConta(undefined); void carregar() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (conta === undefined) return <div className={styles.pagina}><Bloco><Esqueleto linhas={5} altura={16} /></Bloco></div>
  if (conta === null) return <div className={styles.pagina}><Bloco><p className={styles.muted}>Conta não encontrada.</p></Bloco></div>

  const encerrada = !!conta.encerradaEm
  const excluir = async () => {
    setOcupado(true); setErro(null)
    try { await deleteConta(conta.id) } catch (e) { setErro(mensagemDeErro(e)); setOcupado(false); setExcluindo(false); return }
    navigate("/bancos", { replace: true })
  }
  const reabrir = async () => {
    setErro(null)
    try { await reabrirConta(conta.id); await carregar() } catch (e) { setErro(mensagemDeErro(e)) }
  }

  return (
    <div className={styles.pagina}>
      <header className={styles.cabecalho}>
        <div className={styles.identidade}>
          {conta.isCarteira
            ? <span className={styles.carteira} aria-hidden="true"><Wallet size={22} strokeWidth={2} /></span>
            : <LogoMarca nome={conta.bancoNome || conta.nome} logoUrl={conta.bancoLogoUrl} cor={conta.bancoCor} tamanho={48} />}
          <div className={styles.identidadeTexto}>
            <h2 className={styles.titulo}>{conta.nome}</h2>
            <span className={styles.muted}>{descreverConta(conta)}</span>
          </div>
        </div>
        <div className={styles.chips}>
          {conta.isCarteira && <Etiqueta>Carteira</Etiqueta>}
          {encerrada && <Etiqueta>Encerrada em {dataBR(conta.encerradaEm!)}</Etiqueta>}
        </div>
      </header>

      {erro && <p className={styles.alerta} role="alert">{erro}</p>}

      <div className={styles.grade}>
        <div className={styles.principal}>
          <Extrato contaId={conta.id} />
        </div>
        <aside className={styles.lado}>
          <Bloco titulo="Saldo">
            <Dinheiro valor={conta.saldoAtual} className={styles.saldo} tom={conta.saldoAtual < 0 ? "negativo" : undefined} />
          </Bloco>
          {!conta.isCarteira && (
            <RodapeFormulario>
              <Botao perigo onClick={() => { setErro(null); setExcluindo(true) }} icone={<Trash2 size={15} strokeWidth={2.25} aria-hidden="true" />}>Excluir</Botao>
              {encerrada ? (
                <Botao variante="primario" onClick={() => { void reabrir() }} icone={<RotateCcw size={15} strokeWidth={2.25} aria-hidden="true" />}>Reabrir</Botao>
              ) : (
                <>
                  <Botao perigo onClick={() => navigate(`/bancos/${conta.id}/encerrar`, { state: { voltarPara: `/bancos/${conta.id}` } })}
                    icone={<Ban size={15} strokeWidth={2.25} aria-hidden="true" />}>Encerrar</Botao>
                  <Botao variante="primario" onClick={() => navigate(`/bancos/${conta.id}/editar`, { state: { voltarPara: `/bancos/${conta.id}` } })}
                    icone={<Pencil size={15} strokeWidth={2.25} aria-hidden="true" />}>Editar</Botao>
                </>
              )}
            </RodapeFormulario>
          )}
        </aside>
      </div>

      <Confirmar
        aberto={excluindo}
        titulo="Excluir conta?"
        texto={<>Só dá pra excluir conta sem lançamentos (criada por engano). Conta com histórico se <strong>encerra</strong>: sai das listas e o histórico fica.</>}
        rotuloConfirmar="Excluir"
        perigo
        ocupado={ocupado}
        onConfirmar={() => { void excluir() }}
        onCancelar={() => setExcluindo(false)}
      />
    </div>
  )
}

/** Extrato da conta: os lançamentos dela por dia, do mais recente pro mais antigo, paginado no servidor. */
function Extrato({ contaId }: { contaId: string }) {
  const [itens, setItens] = useState<Transaction[] | null>(null)
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [porPagina, setPorPagina] = useState(porPaginaSalvo)
  const [categorias, setCategorias] = useState<Record<string, string>>({})
  const [erro, setErro] = useState(false)

  useEffect(() => {
    getCategories().then((cs) => setCategorias(Object.fromEntries(cs.map((c) => [c.id, c.descricao])))).catch(() => { /* sem nome de categoria */ })
  }, [])
  useEffect(() => {
    let vivo = true
    setErro(false)
    listTransactionsPage(pagina, porPagina, { contaId })
      .then((r) => { if (vivo) { setItens(r.items); setTotal(r.total) } })
      .catch(() => { if (vivo) { setItens([]); setErro(true) } })
    return () => { vivo = false }
  }, [contaId, pagina, porPagina])

  const linhas = useMemo(() => (itens ?? []).map((t) => linhaDoLancamento(t, categorias[t.categoriaId ?? ""], { semConta: true })), [itens, categorias])
  return (
    <Bloco titulo="Extrato" semRespiro>
      {itens === null ? <div className={styles.respiro}><Esqueleto linhas={4} altura={16} /></div>
        : erro ? <p className={styles.vazio}>Não deu pra carregar o extrato.</p>
        : itens.length === 0 ? <p className={styles.vazio}>Nenhum lançamento nesta conta.</p>
        : <ListaPorDia itens={linhas} />}
      {total > 0 && (
        <Paginacao total={total} pagina={pagina} porPagina={porPagina} onPagina={setPagina}
          onPorPagina={(n) => { setPorPagina(n); setPagina(1); try { localStorage.setItem(CHAVE_POR_PAGINA, String(n)) } catch { /* só não lembra */ } }}
          rotulo="lançamentos" rotuloSingular="lançamento" />
      )}
    </Bloco>
  )
}
