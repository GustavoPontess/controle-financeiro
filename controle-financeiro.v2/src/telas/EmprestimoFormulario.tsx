// Novo empréstimo (/emprestimos/novo): emprestei ou peguei, com quem (pessoa ou, quando pegou, um banco), quanto e
// desde quando; à vista (combinado pra uma data) ou parcelado (quantas e quando vence a 1ª), juros e multa opcionais;
// e, opcional, a conta de onde o dinheiro saiu (emprestei) ou onde entrou (peguei), que vira o lançamento de verdade.
// Linguagem de fato (memória "copy sensível"). A Idempotency-Key nasce ao abrir a tela (duplo clique não cria dois).
import { useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { createEmprestimo } from "../services/emprestimoService"
import { getBancos } from "../services/bancoService"
import { getCategories } from "../services/categoryService"
import { getContas } from "../services/contaService"
import { mensagemDeErro } from "../api/cliente"
import type { Banco } from "../types/Banco"
import type { Category } from "../types/Category"
import type { Conta } from "../types/Conta"
import { FormaPagamentoEmprestimo, TipoEmprestimo } from "../types/Emprestimo"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import Entrada from "../componentes/Entrada"
import EntradaValor from "../componentes/EntradaValor"
import Formulario, { Campos, LinhaCampos, PaginaFormulario, RodapeFormulario } from "../componentes/Formulario"
import Segmentos from "../componentes/Segmentos"
import Selecao from "../componentes/Selecao"
import SeletorData from "../componentes/SeletorData"
import { dataLocalISO } from "../utils/dateTime"
import { formatMoney, parseMoney } from "../utils/money"
import { categoriaDeEmprestimo, meioDiaUtc, parsePercentual, soPercentual } from "../dominio/emprestimo"
import styles from "./EmprestimoFormulario.module.css"

type Lado = "emprestei" | "peguei"
type Forma = "avista" | "parcelado"
type Erros = Partial<Record<"pessoa" | "valor" | "inicio" | "vencimento" | "primeiro" | "juros" | "multa" | "categoria", string>>
const PARCELAS = Array.from({ length: 35 }, (_, i) => i + 2) // 2 a 36 (regra do servidor)

/** Limites do servidor (docs/REGRAS_CAMPOS.md). */
const MAX_PESSOA = 200
const MAX_DESCRICAO = 255
const MAX_OBSERVACAO = 1000

export default function EmprestimoFormulario() {
  const navigate = useNavigate()
  const voltarPara = (useLocation().state as { voltarPara?: string } | null)?.voltarPara ?? "/emprestimos"
  const [lado, setLado] = useState<Lado>("emprestei")
  const [pessoa, setPessoa] = useState("")
  const [bancoId, setBancoId] = useState("")
  const [descricao, setDescricao] = useState("")
  const [valor, setValor] = useState("")
  const [inicio, setInicio] = useState(dataLocalISO)
  const [forma, setForma] = useState<Forma>("avista")
  const [vencimento, setVencimento] = useState("")
  const [parcelas, setParcelas] = useState("2")
  const [primeiro, setPrimeiro] = useState("")
  const [juros, setJuros] = useState("")
  const [multa, setMulta] = useState("")
  const [contaId, setContaId] = useState("")
  const [categoriaId, setCategoriaId] = useState("")
  const [observacao, setObservacao] = useState("")
  const [bancos, setBancos] = useState<Banco[]>([])
  const [contas, setContas] = useState<Conta[]>([])
  const [categorias, setCategorias] = useState<Category[]>([])
  const [erros, setErros] = useState<Erros>({})
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [chave] = useState(() => crypto.randomUUID())
  const limpa = (k: keyof Erros) => setErros((e) => ({ ...e, [k]: undefined }))
  const emprestei = lado === "emprestei"

  useEffect(() => {
    let vivo = true
    getContas().then((c) => { if (vivo) setContas(c) }).catch(() => { /* sem contas: o lançamento fica opcional mesmo */ })
    getCategories().then((c) => { if (vivo) setCategorias(c) }).catch(() => { /* idem */ })
    getBancos().then((b) => { if (vivo) setBancos(b.filter((x) => x.ativo)) }).catch(() => { /* sem banco: só pessoa */ })
    return () => { vivo = false }
  }, [])

  // Categoria do lançamento: saída (emprestei) ou entrada (peguei); a de "empréstimo" já vem escolhida.
  const cats = useMemo(() => categorias.filter((c) => c.finalidade === 3 || c.finalidade === (emprestei ? 1 : 2)), [categorias, emprestei])
  useEffect(() => { if (contaId && !cats.some((c) => c.id === categoriaId)) setCategoriaId(categoriaDeEmprestimo(cats)?.id ?? "") }, [contaId, cats, categoriaId])

  const trocarLado = (l: Lado) => { setLado(l); if (l === "emprestei") setBancoId(""); setErros({}) }
  const escolherBanco = (id: string) => {
    setBancoId(id)
    // Sem nome digitado, o do banco (o nome curto dá pra mudar: o catálogo traz a razão social).
    const b = bancos.find((x) => x.id === id)
    if (b && !pessoa.trim()) { setPessoa(b.nomeFantasia || b.nome); limpa("pessoa") }
  }

  const enviar = async () => {
    setErro(null)
    const e: Erros = {}
    const v = parseMoney(valor)
    const j = parsePercentual(juros)
    const m = parsePercentual(multa)
    if (!pessoa.trim()) e.pessoa = emprestei ? "Diga pra quem emprestou." : "Diga com quem pegou."
    if (!(v > 0)) e.valor = "Diga quanto."
    if (!inicio) e.inicio = "Diga quando."
    if (forma === "avista" && vencimento && vencimento < inicio) e.vencimento = "Não pode ser antes do dia do empréstimo."
    if (forma === "parcelado" && !primeiro) e.primeiro = "Diga quando vence a 1ª parcela."
    if (j === null || j > 100) e.juros = "De 0 a 100% ao mês."
    if (m === null || m > 100) e.multa = "De 0 a 100%."
    if (contaId && !categoriaId) e.categoria = "Escolha a categoria do lançamento."
    setErros(e)
    if (Object.keys(e).length > 0) return
    setEnviando(true)
    try {
      const criado = await createEmprestimo({
        tipo: emprestei ? TipoEmprestimo.Emprestei : TipoEmprestimo.PeguiEmprestado,
        pessoa: pessoa.trim(),
        bancoId: !emprestei && bancoId ? bancoId : undefined,
        descricao: descricao.trim(),
        valorTotal: v,
        dataInicio: meioDiaUtc(inicio),
        formaPagamento: forma === "parcelado" ? FormaPagamentoEmprestimo.Parcelado : FormaPagamentoEmprestimo.AVista,
        dataVencimento: forma === "avista" && vencimento ? meioDiaUtc(vencimento) : undefined,
        quantidadeParcelas: forma === "parcelado" ? Number(parcelas) : undefined,
        primeiroVencimento: forma === "parcelado" ? meioDiaUtc(primeiro) : undefined,
        taxaJuroMensal: j || undefined,
        percentualMultaAtraso: m || undefined,
        contaId: contaId || undefined,
        categoriaId: contaId ? categoriaId : undefined,
        observacao: observacao.trim() || undefined,
        idempotencyKey: chave,
      })
      navigate(voltarPara, { replace: true, state: { abrir: criado.id } })
    } catch (err) {
      setErro(mensagemDeErro(err))
      setEnviando(false)
    }
  }

  const v = parseMoney(valor)
  return (
    <PaginaFormulario titulo="Novo empréstimo">
      <Formulario onSubmit={() => { void enviar() }}>
        <Campos>
          {erro && <p className={styles.alerta} role="alert">{erro}</p>}
          <Segmentos<Lado> ariaLabel="Emprestei ou peguei" cheio valor={lado} onChange={trocarLado}
            opcoes={[{ valor: "emprestei", rotulo: "Emprestei" }, { valor: "peguei", rotulo: "Peguei" }]} />
          <LinhaCampos>
            <Campo rotulo={emprestei ? "Pra quem" : "Com quem"} erro={erros.pessoa}>
              <Entrada value={pessoa} maxLength={MAX_PESSOA} placeholder={emprestei ? "João" : "Ana, Itaú"}
                onChange={(x) => { setPessoa(x.target.value); limpa("pessoa") }} />
            </Campo>
            {!emprestei && (
              <Campo rotulo="Se for de banco">
                <Selecao valor={bancoId} placeholder="Não é de banco" onChange={escolherBanco}
                  opcoes={[{ valor: "", rotulo: "Não é de banco" }, ...bancos.map((b) => ({ valor: b.id, rotulo: b.nomeFantasia || b.nome }))]} />
              </Campo>
            )}
          </LinhaCampos>
          <LinhaCampos colunas="minmax(0, 1fr) minmax(0, 1fr)">
            <Campo rotulo="Quanto" erro={erros.valor}>
              <EntradaValor compacto valor={valor} onChange={(x) => { setValor(x); limpa("valor") }} />
            </Campo>
            <Campo rotulo={emprestei ? "Quando emprestou" : "Quando pegou"} erro={erros.inicio}>
              <SeletorData valor={inicio} max={dataLocalISO()} onChange={(x) => { setInicio(x); limpa("inicio"); limpa("vencimento") }} />
            </Campo>
          </LinhaCampos>
          <Campo rotulo="Descrição">
            <Entrada value={descricao} maxLength={MAX_DESCRICAO} placeholder={emprestei ? "Conserto do carro" : "Notebook"}
              onChange={(x) => setDescricao(x.target.value)} />
          </Campo>

          <Segmentos<Forma> ariaLabel="Como volta" valor={forma} onChange={(f) => { setForma(f); limpa("vencimento"); limpa("primeiro") }}
            opcoes={[{ valor: "avista", rotulo: "De uma vez" }, { valor: "parcelado", rotulo: "Parcelado" }]} />
          {forma === "avista" ? (
            <Campo rotulo="Combinado pra (opcional)" erro={erros.vencimento}>
              <SeletorData valor={vencimento} limpavel min={inicio} placeholder="Sem data" onChange={(x) => { setVencimento(x); limpa("vencimento") }} />
            </Campo>
          ) : (
            <LinhaCampos colunas="minmax(0, 1fr) minmax(0, 1fr)">
              <Campo rotulo="Parcelas">
                <Selecao valor={parcelas} onChange={setParcelas}
                  opcoes={PARCELAS.map((n) => ({ valor: String(n), rotulo: v > 0 ? `${n}x de ${formatMoney(Math.round((v / n) * 100) / 100)}` : `${n}x` }))} />
              </Campo>
              <Campo rotulo="1ª parcela vence" erro={erros.primeiro}>
                <SeletorData valor={primeiro} min={inicio} onChange={(x) => { setPrimeiro(x); limpa("primeiro") }} />
              </Campo>
            </LinhaCampos>
          )}
          <LinhaCampos colunas="minmax(0, 1fr) minmax(0, 1fr)">
            <Campo rotulo="Juros ao mês (opcional)" erro={erros.juros}>
              <Entrada inputMode="decimal" value={juros} placeholder="0" sufixo="%" maxLength={6}
                onChange={(x) => { setJuros(soPercentual(x.target.value)); limpa("juros") }} />
            </Campo>
            <Campo rotulo="Multa se atrasar (opcional)" erro={erros.multa}>
              <Entrada inputMode="decimal" value={multa} placeholder="0" sufixo="%" maxLength={6}
                onChange={(x) => { setMulta(soPercentual(x.target.value)); limpa("multa") }} />
            </Campo>
          </LinhaCampos>

          <LinhaCampos>
            <Campo rotulo={emprestei ? "O dinheiro saiu de qual conta? (opcional)" : "O dinheiro entrou em qual conta? (opcional)"}>
              <Selecao valor={contaId} placeholder="Não lançar agora" onChange={(x) => { setContaId(x); limpa("categoria") }}
                opcoes={[{ valor: "", rotulo: "Não lançar agora" }, ...contas.map((c) => ({ valor: c.id, rotulo: c.nome }))]} />
            </Campo>
            {contaId && (
              <Campo rotulo="Categoria do lançamento" erro={erros.categoria}>
                <Selecao valor={categoriaId} placeholder="Escolha a categoria" onChange={(x) => { setCategoriaId(x); limpa("categoria") }}
                  opcoes={cats.map((c) => ({ valor: c.id, rotulo: c.descricao }))} />
              </Campo>
            )}
          </LinhaCampos>
          <Campo rotulo="Observação (opcional)">
            <Entrada value={observacao} maxLength={MAX_OBSERVACAO} onChange={(x) => setObservacao(x.target.value)} />
          </Campo>
        </Campos>
        <RodapeFormulario>
          <Botao onClick={() => navigate(voltarPara, { replace: true })} disabled={enviando}>Cancelar</Botao>
          <Botao variante="primario" type="submit" disabled={enviando}>{enviando ? "Salvando…" : "Adicionar"}</Botao>
        </RodapeFormulario>
      </Formulario>
    </PaginaFormulario>
  )
}
