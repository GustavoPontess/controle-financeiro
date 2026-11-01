// Registrar o que voltou (/emprestimos/:id/registrar, quem emprestou) ou o que devolvi (quem pegou): quanto, quando e
// em qual conta o dinheiro entrou ou de qual saiu, com a categoria do lançamento (vira um lançamento de verdade). Em
// empréstimo parcelado o valor vai abatendo as parcelas mais antigas. Se o outro também acompanha e quem registra é
// quem pegou, fica esperando o outro confirmar. A Idempotency-Key nasce ao abrir a tela.
import { useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { getEmprestimo, listParcelasEmprestimo, solicitarPagamentoEmprestimo } from "../services/emprestimoService"
import { getCategories } from "../services/categoryService"
import { getContas } from "../services/contaService"
import { mensagemDeErro } from "../api/cliente"
import type { Category } from "../types/Category"
import type { Conta } from "../types/Conta"
import type { Emprestimo } from "../types/Emprestimo"
import { StatusParcelaEmprestimo } from "../types/Emprestimo"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import { Dinheiro } from "../componentes/Dinheiro"
import EntradaValor from "../componentes/EntradaValor"
import Formulario, { Campos, LinhaCampos, PaginaFormulario, RodapeFormulario } from "../componentes/Formulario"
import LancamentoJaNoApp, { JA_NO_APP } from "../componentes/LancamentoJaNoApp"
import Selecao from "../componentes/Selecao"
import SeletorData from "../componentes/SeletorData"
import { acompanhaJunto, categoriaDeEmprestimo, emprestei, meioDiaUtc, parcelado, quemDoOutroLado, rotuloFalta, rotuloRegistrar } from "../dominio/emprestimo"
import { dataLocalISO } from "../utils/dateTime"
import { formatMoney, moneyParaCampo, parseMoney } from "../utils/money"
import styles from "./EmprestimoFormulario.module.css"

type Erros = Partial<Record<"valor" | "data" | "conta" | "categoria" | "lancamento", string>>

export default function RegistrarEmprestimo() {
  const { id = "" } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const st = useLocation().state as { voltarPara?: string; emprestimo?: Emprestimo } | null
  const voltarPara = st?.voltarPara ?? "/emprestimos"
  const [e, setE] = useState<Emprestimo | null>(st?.emprestimo?.id === id ? st.emprestimo : null)
  const [contas, setContas] = useState<Conta[]>([])
  const [categorias, setCategorias] = useState<Category[]>([])
  const [erroCarga, setErroCarga] = useState<string | null>(null)
  const [valor, setValor] = useState("")
  const [data, setData] = useState(dataLocalISO)
  const [contaId, setContaId] = useState("")
  const [categoriaId, setCategoriaId] = useState("")
  // "Já está no app": liga um lançamento que já existe (importado) em vez de lançar outro.
  const [lancamentoId, setLancamentoId] = useState("")
  const jaNoApp = contaId === JA_NO_APP
  const [erros, setErros] = useState<Erros>({})
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [chave] = useState(() => crypto.randomUUID())
  const limpa = (k: keyof Erros) => setErros((x) => ({ ...x, [k]: undefined }))

  useEffect(() => {
    let vivo = true
    const carregar = e ? Promise.resolve(e) : getEmprestimo(id)
    Promise.all([carregar, getContas(), getCategories()])
      .then(async ([emp, cs, cats]) => {
        if (!vivo) return
        setE(emp); setContas(cs); setCategorias(cats)
        if (cs.length === 1) setContaId(cs[0].id)
        // Sugere o que falta da próxima parcela (parcelado) ou o que falta todo (de uma vez).
        let sugestao = emp.valorRestante
        if (parcelado(emp)) {
          const ps = await listParcelasEmprestimo(emp.id).catch(() => [])
          const prox = ps.find((p) => p.status === StatusParcelaEmprestimo.Pendente)
          if (prox) sugestao = (prox.valorComMulta ?? prox.valorComJuros ?? prox.valor) - prox.valorPago
        }
        if (vivo && sugestao > 0) setValor(moneyParaCampo(sugestao))
      })
      .catch(() => { if (vivo) setErroCarga("Não deu pra carregar o empréstimo.") })
    return () => { vivo = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Quem emprestou recebe (entrada); quem pegou devolve (saída). A categoria de "empréstimo" já vem escolhida.
  const recebe = e ? emprestei(e) : true
  const cats = useMemo(() => categorias.filter((c) => c.finalidade === 3 || c.finalidade === (recebe ? 2 : 1)), [categorias, recebe])
  useEffect(() => { if (!cats.some((c) => c.id === categoriaId)) setCategoriaId(categoriaDeEmprestimo(cats)?.id ?? "") }, [cats, categoriaId])

  const enviar = async () => {
    if (!e) return
    setErro(null)
    const x: Erros = {}
    const v = parseMoney(valor)
    if (!(v > 0)) x.valor = "Diga quanto."
    if (!data) x.data = "Diga quando."
    if (!contaId) x.conta = recebe ? "Escolha em qual conta entrou." : "Escolha de qual conta saiu."
    if (jaNoApp && !lancamentoId) x.lancamento = "Escolha o lançamento."
    if (!jaNoApp && !categoriaId) x.categoria = "Escolha a categoria do lançamento."
    setErros(x)
    if (Object.keys(x).length > 0) return
    setEnviando(true)
    try {
      await solicitarPagamentoEmprestimo(e.id, jaNoApp
        ? { valor: v, data: meioDiaUtc(data), transacaoExistenteId: lancamentoId, idempotencyKey: chave }
        : { valor: v, data: meioDiaUtc(data), contaId, categoriaId, idempotencyKey: chave })
      navigate(voltarPara, { replace: true, state: { abrir: e.id } })
    } catch (err) {
      setErro(mensagemDeErro(err))
      setEnviando(false)
    }
  }

  return (
    <PaginaFormulario titulo={e ? `${rotuloRegistrar(e)} · ${quemDoOutroLado(e)}` : "Registrar"} carregando={!e && !erroCarga} erroCarga={erroCarga}>
      {e && (
        <Formulario onSubmit={() => { void enviar() }}>
          <Campos>
            {erro && <p className={styles.alerta} role="alert">{erro}</p>}
            <div className={styles.resumo}>
              {/* "de" = o total a pagar, com os juros (o já pago + o que falta); sem juros é o próprio valor emprestado. */}
              <span>{rotuloFalta(e)} <strong><Dinheiro valor={e.valorRestante} /></strong> de <Dinheiro valor={Math.max(e.valorTotal, e.valorPago + e.valorRestante)} /></span>
            </div>
            <LinhaCampos colunas="minmax(0, 1fr) minmax(0, 1fr)">
              <Campo rotulo="Quanto" erro={erros.valor}>
                <EntradaValor compacto autoFocus valor={valor} onChange={(x) => { setValor(x); limpa("valor") }} />
              </Campo>
              <Campo rotulo="Quando" erro={erros.data}>
                <SeletorData valor={data} max={dataLocalISO()} onChange={(x) => { setData(x); limpa("data") }} />
              </Campo>
            </LinhaCampos>
            <LinhaCampos>
              <Campo rotulo={recebe ? "Em qual conta entrou" : "De qual conta saiu"} erro={erros.conta}>
                <Selecao valor={contaId} placeholder="Escolha a conta" onChange={(x) => { setContaId(x); limpa("conta"); limpa("lancamento") }}
                  opcoes={[...contas.map((c) => ({ valor: c.id, rotulo: c.nome, detalhe: `${formatMoney(c.saldoAtual)} na conta` })),
                    { valor: JA_NO_APP, rotulo: "Já está no app (importado)" }]} />
              </Campo>
              {jaNoApp ? (
                <Campo rotulo="Qual lançamento" erro={erros.lancamento}>
                  <LancamentoJaNoApp entrada={recebe} valor={parseMoney(valor)} escolhido={lancamentoId}
                    onChange={(t) => { setLancamentoId(t.id); setValor(moneyParaCampo(t.valor)); setData(t.data.slice(0, 10)); limpa("lancamento") }} />
                </Campo>
              ) : (
                <Campo rotulo="Categoria do lançamento" erro={erros.categoria}>
                  <Selecao valor={categoriaId} placeholder="Escolha a categoria" onChange={(x) => { setCategoriaId(x); limpa("categoria") }}
                    opcoes={cats.map((c) => ({ valor: c.id, rotulo: c.descricao }))} />
                </Campo>
              )}
            </LinhaCampos>
            {parcelado(e) && <p className={styles.aviso}>O valor vai abatendo as parcelas mais antigas.</p>}
            {acompanhaJunto(e) && !e.souCredor && (
              <p className={styles.aviso}>{quemDoOutroLado(e)} acompanha junto: fica esperando confirmar.</p>
            )}
          </Campos>
          <RodapeFormulario>
            <Botao onClick={() => navigate(voltarPara, { replace: true, state: { abrir: e.id } })} disabled={enviando}>Cancelar</Botao>
            <Botao variante="primario" type="submit" disabled={enviando}>{enviando ? "Salvando…" : "Registrar"}</Botao>
          </RodapeFormulario>
        </Formulario>
      )}
    </PaginaFormulario>
  )
}
