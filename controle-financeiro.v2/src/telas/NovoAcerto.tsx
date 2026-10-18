// Registrar acerto (/familias/:id/acertos/novo): quem passou dinheiro pra quem, quanto e uma nota. Vem
// preenchido com o que o balanço do mês diz que falta (quem está "a acertar" paga pra quem está "a receber").
// É só o registro: as contas de cada um não mudam. Chave de idempotência por tentativa.
import { useEffect, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { useAuth } from "../auth/useAuth"
import { getBalancoFamilia, getFamilia, registrarAcerto } from "../services/familiaService"
import { mensagemDeErro } from "../api/cliente"
import type { FamiliaDetalhe } from "../types/Familia"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import Entrada from "../componentes/Entrada"
import EntradaValor from "../componentes/EntradaValor"
import Formulario, { Campos, LinhaCampos, PaginaFormulario, RodapeFormulario } from "../componentes/Formulario"
import Selecao from "../componentes/Selecao"
import { primeiroNome } from "../dominio/familia"
import { moneyParaCampo, parseMoney } from "../utils/money"
import styles from "./Familia.module.css"

type Erros = Partial<Record<"de" | "para" | "valor", string>>

export default function NovoAcerto() {
  const { id = "" } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { usuario } = useAuth()
  // "Pra equilibrar o mês" na página da família manda quem passa, pra quem e quanto.
  const sugestao = (useLocation().state as { de?: string; para?: string; valor?: number } | null) ?? null
  const [familia, setFamilia] = useState<FamiliaDetalhe | null>(null)
  const [erroCarga, setErroCarga] = useState<string | null>(null)
  const [de, setDe] = useState("")
  const [para, setPara] = useState("")
  const [valor, setValor] = useState("")
  const [observacao, setObservacao] = useState("")
  const [erros, setErros] = useState<Erros>({})
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [chave, setChave] = useState(() => crypto.randomUUID())
  const hoje = new Date()
  const mes = hoje.getMonth() + 1, ano = hoje.getFullYear()
  const voltar = () => navigate(`/familias/${id}`, { replace: true })

  useEffect(() => {
    let vivo = true
    Promise.all([getFamilia(id), getBalancoFamilia(id, mes, ano).catch(() => null)])
      .then(([f, b]) => {
        if (!vivo) return
        setFamilia(f)
        if (sugestao?.de && sugestao.para) { setDe(sugestao.de); setPara(sugestao.para); setValor(sugestao.valor ? moneyParaCampo(sugestao.valor) : ""); return }
        // Sem sugestão: quem pagou a menos passa pra quem pagou a mais; começa por você.
        const meu = b?.saldos.find((s) => s.usuarioId === usuario?.id)
        const aMais = b?.saldos.find((s) => s.saldo > 0.005)
        const aMenos = b?.saldos.find((s) => s.saldo < -0.005)
        if (meu && meu.saldo < -0.005 && aMais) { setDe(meu.usuarioId); setPara(aMais.usuarioId); setValor(moneyParaCampo(-meu.saldo)) }
        else if (aMenos && aMais) { setDe(aMenos.usuarioId); setPara(aMais.usuarioId); setValor(moneyParaCampo(-aMenos.saldo)) }
        else setDe(usuario?.id ?? "")
      })
      .catch(() => { if (vivo) setErroCarga("Não deu pra carregar a família. Recarregue a página.") })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, mes, ano, usuario?.id])

  const opcoes = (familia?.membros ?? []).map((m) => ({ valor: m.usuarioId, rotulo: m.usuarioId === usuario?.id ? `${primeiroNome(m.nomeUsuario)} (você)` : primeiroNome(m.nomeUsuario) }))

  const enviar = async () => {
    setErro(null)
    const e: Erros = {}
    if (!de) e.de = "Quem passou o dinheiro?"
    if (!para) e.para = "Pra quem?"
    if (de && para && de === para) e.para = "Tem que ser outra pessoa."
    if (!(parseMoney(valor) > 0)) e.valor = "Quanto foi?"
    setErros(e)
    if (Object.keys(e).length > 0) return
    setSalvando(true)
    try {
      await registrarAcerto(id, { deUsuarioId: de, paraUsuarioId: para, valor: parseMoney(valor), mes, ano, observacao: observacao.trim() || null, idempotencyKey: chave })
      voltar()
    } catch (err) { setErro(mensagemDeErro(err)); setChave(crypto.randomUUID()); setSalvando(false) }
  }

  return (
    <PaginaFormulario titulo="Dinheiro entre vocês" carregando={!familia && !erroCarga} erroCarga={erroCarga}>
      <Formulario onSubmit={() => { void enviar() }}>
        <Campos>
          {erro && <p className={styles.alerta} role="alert">{erro}</p>}
          <LinhaCampos>
            <Campo rotulo="Quem passou" erro={erros.de}>
              <Selecao valor={de} placeholder="Escolha" opcoes={opcoes} onChange={(v) => { setDe(v); setErros((x) => ({ ...x, de: undefined, para: undefined })) }} />
            </Campo>
            <Campo rotulo="Pra quem" erro={erros.para}>
              <Selecao valor={para} placeholder="Escolha" opcoes={opcoes} onChange={(v) => { setPara(v); setErros((x) => ({ ...x, para: undefined })) }} />
            </Campo>
          </LinhaCampos>
          <Campo rotulo="Valor" erro={erros.valor}>
            <EntradaValor compacto valor={valor} onChange={(v) => { setValor(v); setErros((x) => ({ ...x, valor: undefined })) }} />
          </Campo>
          <Campo rotulo="Nota">
            <Entrada value={observacao} maxLength={255} placeholder="Pix do mercado e da luz" onChange={(e) => setObservacao(e.target.value)} />
          </Campo>
          <p className={styles.dica}>É só o registro de que o valor foi passado de uma pessoa pra outra; as contas de cada um não mudam. Pra mexer no saldo, lance uma transferência.</p>
        </Campos>
        <RodapeFormulario>
          <Botao onClick={voltar} disabled={salvando}>Cancelar</Botao>
          <Botao variante="primario" type="submit" disabled={salvando}>{salvando ? "Registrando…" : "Registrar"}</Botao>
        </RodapeFormulario>
      </Formulario>
    </PaginaFormulario>
  )
}
