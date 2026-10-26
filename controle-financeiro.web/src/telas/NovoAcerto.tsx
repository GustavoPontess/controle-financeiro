// Dinheiro entre vocês (/familias/:id/acertos/novo; passo 3 do espaço da família): "Eu passei" ou "Eu recebi", pra/de
// quem, quanto, o dia e a conta (de onde saiu / onde entrou). Vem preenchido com o que o equilíbrio do mês diz (quem
// pagou a menos passa pra quem pagou a mais). Com conta, o lançamento nasce na sua conta, fora do resultado. Quem passou
// registra → espera a outra pessoa confirmar; quem recebeu registra → já vale. Chave de idempotência por tentativa.
import { useEffect, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { useAuth } from "../auth/useAuth"
import { getBalancoFamilia, getFamilia, registrarAcerto } from "../services/familiaService"
import { getContas } from "../services/contaService"
import { mensagemDeErro } from "../api/cliente"
import type { FamiliaDetalhe } from "../types/Familia"
import type { Conta } from "../types/Conta"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import Entrada from "../componentes/Entrada"
import EntradaValor from "../componentes/EntradaValor"
import Formulario, { Campos, LinhaCampos, PaginaFormulario, RodapeFormulario } from "../componentes/Formulario"
import Segmentos from "../componentes/Segmentos"
import Selecao from "../componentes/Selecao"
import SeletorData from "../componentes/SeletorData"
import { PAPEL_PERMISSAO, primeiroNome } from "../dominio/familia"
import { dataLocalISO } from "../utils/dateTime"
import { moneyParaCampo, parseMoney } from "../utils/money"
import styles from "./Familia.module.css"

type Lado = "passei" | "recebi"
type Erros = Partial<Record<"outro" | "valor" | "data" | "conta", string>>
const SEM_CONTA = "sem-conta"

export default function NovoAcerto() {
  const { id = "" } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const meuId = usuario?.id ?? ""
  // "Pra equilibrar o mês" na página da família manda quem passa, pra quem e quanto.
  const sugestao = (useLocation().state as { de?: string; para?: string; valor?: number; voltarPara?: string } | null) ?? null
  const [familia, setFamilia] = useState<FamiliaDetalhe | null>(null)
  const [contas, setContas] = useState<Conta[]>([])
  const [erroCarga, setErroCarga] = useState<string | null>(null)
  const [lado, setLado] = useState<Lado>("passei")
  const [outro, setOutro] = useState("")
  const [valor, setValor] = useState("")
  const [data, setData] = useState(() => dataLocalISO())
  const [contaId, setContaId] = useState("")
  const [observacao, setObservacao] = useState("")
  const [erros, setErros] = useState<Erros>({})
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [chave, setChave] = useState(() => crypto.randomUUID())
  const hoje = new Date()
  const mes = hoje.getMonth() + 1, ano = hoje.getFullYear()
  const voltar = () => navigate(sugestao?.voltarPara ?? `/familias/${id}/entre-voces`, { replace: true })

  useEffect(() => {
    let vivo = true
    Promise.all([getFamilia(id), getBalancoFamilia(id, mes, ano).catch(() => null), getContas().catch(() => [] as Conta[])])
      .then(([f, b, c]) => {
        if (!vivo) return
        setFamilia(f)
        setContas(c)
        setContaId((c.find((k) => k.isCarteira) ?? c[0])?.id ?? SEM_CONTA)
        // Da sugestão do equilíbrio (quando eu sou um dos dois), senão do meu saldo no mês.
        if (sugestao?.de && sugestao.para && (sugestao.de === meuId || sugestao.para === meuId)) {
          const passei = sugestao.de === meuId
          setLado(passei ? "passei" : "recebi"); setOutro(passei ? sugestao.para : sugestao.de)
          setValor(sugestao.valor ? moneyParaCampo(sugestao.valor) : "")
          return
        }
        const meu = b?.saldos.find((s) => s.usuarioId === meuId)
        const aMais = b?.saldos.find((s) => s.saldo > 0.005 && s.usuarioId !== meuId)
        const aMenos = b?.saldos.find((s) => s.saldo < -0.005 && s.usuarioId !== meuId)
        if (meu && meu.saldo < -0.005 && aMais) { setLado("passei"); setOutro(aMais.usuarioId); setValor(moneyParaCampo(Math.min(-meu.saldo, aMais.saldo))) }
        else if (meu && meu.saldo > 0.005 && aMenos) { setLado("recebi"); setOutro(aMenos.usuarioId); setValor(moneyParaCampo(Math.min(meu.saldo, -aMenos.saldo))) }
      })
      .catch(() => { if (vivo) setErroCarga("Não deu pra carregar a família. Recarregue a página.") })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, mes, ano, meuId])

  // Os outros que lançam (quem só vê não entra na divisão, então não passa nem recebe).
  const outros = (familia?.membros ?? []).filter((m) => m.usuarioId !== meuId && m.papelPermissao !== PAPEL_PERMISSAO.dependente)
  const opcoesOutro = outros.map((m) => ({ valor: m.usuarioId, rotulo: primeiroNome(m.nomeUsuario) }))
  useEffect(() => { if (!outro && outros.length === 1) setOutro(outros[0].usuarioId) }, [outro, outros])
  const passei = lado === "passei"

  const enviar = async () => {
    setErro(null)
    const e: Erros = {}
    if (!outro) e.outro = passei ? "Pra quem?" : "De quem?"
    if (!(parseMoney(valor) > 0)) e.valor = "Quanto foi?"
    if (!data) e.data = "Que dia?"
    else if (data > dataLocalISO()) e.data = "Não pode ser no futuro."
    if (!contaId) e.conta = "Escolha a conta."
    setErros(e)
    if (Object.keys(e).length > 0) return
    setSalvando(true)
    try {
      await registrarAcerto(id, {
        deUsuarioId: passei ? meuId : outro, paraUsuarioId: passei ? outro : meuId, valor: parseMoney(valor), mes, ano,
        observacao: observacao.trim() || null, idempotencyKey: chave, contaId: contaId === SEM_CONTA ? null : contaId, data,
      })
      voltar()
    } catch (err) { setErro(mensagemDeErro(err)); setChave(crypto.randomUUID()); setSalvando(false) }
  }
  const limpa = (k: keyof Erros) => setErros((x) => ({ ...x, [k]: undefined }))

  return (
    <PaginaFormulario titulo="Dinheiro entre vocês" carregando={!familia && !erroCarga} erroCarga={erroCarga}>
      <Formulario onSubmit={() => { void enviar() }}>
        <Campos>
          {erro && <p className={styles.alerta} role="alert">{erro}</p>}
          <Segmentos ariaLabel="Quem passou" cheio valor={lado} onChange={(l) => { setLado(l); limpa("outro") }}
            opcoes={[{ valor: "passei", rotulo: "Eu passei" }, { valor: "recebi", rotulo: "Eu recebi" }]} />
          <LinhaCampos>
            <Campo rotulo={passei ? "Pra quem" : "De quem"} erro={erros.outro}>
              <Selecao valor={outro} placeholder="Escolha" opcoes={opcoesOutro} onChange={(v) => { setOutro(v); limpa("outro") }} />
            </Campo>
            <Campo rotulo="Valor" erro={erros.valor}>
              <EntradaValor compacto valor={valor} onChange={(v) => { setValor(v); limpa("valor") }} />
            </Campo>
          </LinhaCampos>
          <LinhaCampos>
            <Campo rotulo="Dia" erro={erros.data}>
              <SeletorData valor={data} max={dataLocalISO()} onChange={(d) => { setData(d); limpa("data") }} />
            </Campo>
            <Campo rotulo={passei ? "Saiu de" : "Entrou em"} erro={erros.conta}>
              <Selecao valor={contaId} placeholder="Escolha a conta" onChange={(v) => { setContaId(v); limpa("conta") }}
                opcoes={[...contas.map((c) => ({ valor: c.id, rotulo: c.nome })), { valor: SEM_CONTA, rotulo: "Não registrar em conta" }]} />
            </Campo>
          </LinhaCampos>
          <Campo rotulo="Nota">
            <Entrada value={observacao} maxLength={255} placeholder="Pix do mercado e da luz" onChange={(e) => setObservacao(e.target.value)} />
          </Campo>
        </Campos>
        <RodapeFormulario>
          <Botao onClick={voltar} disabled={salvando}>Cancelar</Botao>
          <Botao variante="primario" type="submit" disabled={salvando}>{salvando ? "Registrando…" : "Registrar"}</Botao>
        </RodapeFormulario>
      </Formulario>
    </PaginaFormulario>
  )
}
