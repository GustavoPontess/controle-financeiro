// Renda (/renda, menu principal): o mês da pessoa como FATO (o que caiu em renda) e o que ela esperava
// (contas fixas de receita + a variável que ela digita e muda quando quiser); e, por família, o que a família vê
// disso: nada, só o peso, o valor pra quem ela marcar, ou pra todos. Só a própria pessoa mexe aqui. É página do
// dia a dia, não configuração (o Gustavo mandou tirar de Configurações, 2026-10-18).
// Spec: docs/features/familia/renda-e-visibilidade.md.
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useAuth } from "../auth/useAuth"
import { definirVariavelEsperada, definirVisibilidadeRenda, getRendaMes } from "../services/rendaService"
import { getFamilia, getFamilias } from "../services/familiaService"
import { mensagemDeErro } from "../api/cliente"
import type { RendaMes, VisibilidadeRenda } from "../types/Renda"
import { VISIBILIDADE_RENDA } from "../types/Renda"
import type { FamiliaDetalhe } from "../types/Familia"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import { Dinheiro } from "../componentes/Dinheiro"
import EntradaValor from "../componentes/EntradaValor"
import Marcar from "../componentes/Marcar"
import Selecao from "../componentes/Selecao"
import { nomeDoMes, primeiroNome } from "../dominio/familia"
import { dataBR } from "../utils/dateTime"
import { moneyParaCampo, parseMoney } from "../utils/money"
import styles from "./Renda.module.css"

export const NIVEIS_VISIBILIDADE: { valor: VisibilidadeRenda; rotulo: string; detalhe: string }[] = [
  { valor: VISIBILIDADE_RENDA.nada, rotulo: "Nada", detalhe: "nem o peso; na divisão proporcional você entra com parte igual" },
  { valor: VISIBILIDADE_RENDA.soPeso, rotulo: "Só o peso", detalhe: "a divisão proporcional usa, mas ninguém vê o valor" },
  { valor: VISIBILIDADE_RENDA.valorParaAlguns, rotulo: "O valor, pra quem eu marcar", detalhe: "" },
  { valor: VISIBILIDADE_RENDA.valorParaTodos, rotulo: "O valor, pra toda a família", detalhe: "quem só vê a família não vê renda de ninguém" },
]
export const rotuloVisibilidade = (v: VisibilidadeRenda) => NIVEIS_VISIBILIDADE.find((n) => n.valor === v)?.rotulo ?? "Só o peso"

export default function Renda() {
  const hoje = new Date()
  const [periodo, setPeriodo] = useState({ ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 })
  const [renda, setRenda] = useState<RendaMes | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [variavel, setVariavel] = useState("")
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    let vivo = true
    setRenda(null); setErro(null)
    getRendaMes(periodo.ano, periodo.mes)
      .then((r) => { if (vivo) { setRenda(r); setVariavel(r.variavelEsperada ? moneyParaCampo(r.variavelEsperada) : "") } })
      .catch((e) => { if (vivo) setErro(mensagemDeErro(e)) })
    return () => { vivo = false }
  }, [periodo])

  const mudarMes = (delta: number) => setPeriodo((p) => { const d = new Date(p.ano, p.mes - 1 + delta, 1); return { ano: d.getFullYear(), mes: d.getMonth() + 1 } })
  const salvar = async (valor: number | null) => {
    setSalvando(true); setErro(null)
    try {
      const r = await definirVariavelEsperada(periodo.ano, periodo.mes, valor)
      setRenda(r); setVariavel(r.variavelEsperada ? moneyParaCampo(r.variavelEsperada) : "")
    } catch (e) { setErro(mensagemDeErro(e)) }
    setSalvando(false)
  }
  const mesNome = nomeDoMes(periodo.mes, periodo.ano)

  return (
    <>
      <Bloco semRespiro>
        <div className={styles.toolbar}>
          <span className={styles.toolbarTitulo}>Renda de {mesNome.toLowerCase()}</span>
          <span className={styles.meses}>
            <Botao soIcone aria-label="Mês anterior" onClick={() => mudarMes(-1)}><ChevronLeft size={16} strokeWidth={2.25} /></Botao>
            <Botao soIcone aria-label="Próximo mês" onClick={() => mudarMes(1)}><ChevronRight size={16} strokeWidth={2.25} /></Botao>
          </span>
        </div>
        {erro && <p className={styles.alerta} role="alert">{erro}</p>}
        {!renda ? <div className={styles.respiro}><Esqueleto linhas={3} altura={18} /></div> : (
          <div className={styles.miolo}>
            <div className={styles.numeros}>
              <Numero rotulo="Previsto" valor={renda.previsto} />
              <Numero rotulo="Recebido" valor={renda.recebido} tom="positivo" />
              <Numero rotulo={renda.falta > 0 ? "Falta" : "A mais"} valor={renda.falta > 0 ? renda.falta : Math.max(0, renda.recebido - renda.previsto)} />
            </div>

            <dl className={styles.composicao} aria-label="De onde vem o previsto">
              <div>
                <dt>Contas fixas de receita</dt>
                <dd><Dinheiro valor={renda.fixas} /> <Link to="/contas-fixas" className={styles.link}>ver contas fixas</Link></dd>
              </div>
              <div>
                <dt>Variável esperada{renda.variavelEsperada > 0 && !renda.variavelDoMes && <span className={styles.mudo}> · vale a do mês anterior</span>}</dt>
                <dd>
                  <div className={styles.variavel}>
                    <Campo rotulo="Quanto você espera de comissão, bico, extra" className={styles.variavelCampo}>
                      <EntradaValor compacto valor={variavel} onChange={setVariavel} />
                    </Campo>
                    <Botao variante="primario" disabled={salvando} onClick={() => salvar(parseMoney(variavel))}>Salvar</Botao>
                    {renda.variavelDoMes && <Botao variante="texto" disabled={salvando} onClick={() => salvar(null)}>Limpar</Botao>}
                  </div>
                  {renda.sugestaoMedia3Meses !== null && renda.previsto === 0 && (
                    <p className={styles.dica}>Nos últimos meses você recebeu em média <Dinheiro valor={renda.sugestaoMedia3Meses} /> por mês.{" "}
                      <button type="button" className={styles.linkBotao} onClick={() => salvar(renda.sugestaoMedia3Meses!)}>Usar como esperado</button></p>
                  )}
                </dd>
              </div>
            </dl>

            {renda.entradas.length === 0 ? <p className={styles.vazio}>Nenhuma entrada de renda em {mesNome.toLowerCase()}.</p> : (
              <ul className={styles.entradas} aria-label="Entradas do mês">
                {renda.entradas.map((e) => (
                  <li key={e.id} data-prevista={e.recebida ? undefined : "true"}>
                    <span className={styles.entradaData}>{dataBR(e.data)}</span>
                    <span className={styles.entradaTexto}>{e.descricao}{e.subcategoria && <span className={styles.mudo}> · {e.subcategoria}</span>}{!e.recebida && <span className={styles.mudo}> · ainda vai cair</span>}</span>
                    <Dinheiro valor={e.valor} className={styles.entradaValor} tom={e.recebida ? "positivo" : "neutro"} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Bloco>

      <QuemVe />
    </>
  )
}

function Numero({ rotulo, valor, tom }: { rotulo: string; valor: number; tom?: "positivo" }) {
  return (
    <div className={styles.numero}>
      <span className={styles.rotulo}>{rotulo}</span>
      <Dinheiro valor={valor} className={styles.numeroValor} tom={tom} />
    </div>
  )
}

// ── Por família: o que ela vê da minha renda ──────────────────────────────────────────────────────────────
function QuemVe() {
  const { usuario } = useAuth()
  const [familias, setFamilias] = useState<FamiliaDetalhe[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    getFamilias()
      .then((fs) => Promise.all(fs.map((f) => getFamilia(f.id))))
      .then((ds) => { if (vivo) setFamilias(ds) })
      .catch((e) => { if (vivo) { setFamilias([]); setErro(mensagemDeErro(e)) } })
    return () => { vivo = false }
  }, [])

  if (familias === null) return <Bloco titulo="Quem vê a sua renda"><Esqueleto linhas={2} altura={18} /></Bloco>
  if (familias.length === 0) return null

  return (
    <Bloco titulo="Quem vê a sua renda">
      {erro && <p className={styles.alerta} role="alert">{erro}</p>}
      <ul className={styles.familias} aria-label="Famílias">
        {familias.map((f) => <FamiliaVisibilidade key={f.id} familia={f} meuId={usuario?.id ?? ""} />)}
      </ul>
    </Bloco>
  )
}

function FamiliaVisibilidade({ familia, meuId }: { familia: FamiliaDetalhe; meuId: string }) {
  const eu = familia.membros.find((m) => m.usuarioId === meuId)
  const outros = familia.membros.filter((m) => m.usuarioId !== meuId)
  const [nivel, setNivel] = useState<VisibilidadeRenda>(eu?.visibilidadeRenda ?? VISIBILIDADE_RENDA.soPeso)
  const [para, setPara] = useState<string[]>(eu?.rendaVisivelPara ?? [])
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  if (!eu) return null

  const salvar = async (n: VisibilidadeRenda, p: string[]) => {
    setOcupado(true); setErro(null)
    try { await definirVisibilidadeRenda(familia.id, eu.id, n, n === VISIBILIDADE_RENDA.valorParaAlguns ? p : []) }
    catch (e) { setErro(mensagemDeErro(e)) }
    setOcupado(false)
  }
  const mudarNivel = (v: string) => { const n = Number(v) as VisibilidadeRenda; setNivel(n); void salvar(n, para) }
  const marcar = (id: string, on: boolean) => { const p = on ? [...para, id] : para.filter((x) => x !== id); setPara(p); void salvar(nivel, p) }
  const detalhe = NIVEIS_VISIBILIDADE.find((n) => n.valor === nivel)?.detalhe

  return (
    <li className={styles.familia}>
      <span className={styles.familiaNome}>{familia.nome}</span>
      {erro && <p className={styles.alerta} role="alert">{erro}</p>}
      <Campo rotulo={`O que ${familia.nome} vê da sua renda`}>
        <Selecao valor={String(nivel)} desabilitado={ocupado} onChange={mudarNivel}
          opcoes={NIVEIS_VISIBILIDADE.map((n) => ({ valor: String(n.valor), rotulo: n.rotulo, detalhe: n.detalhe || undefined }))} />
      </Campo>
      {nivel === VISIBILIDADE_RENDA.valorParaAlguns && (
        <div className={styles.quem} role="group" aria-label={`Quem vê o valor em ${familia.nome}`}>
          {outros.length === 0 ? <span className={styles.mudo}>Ninguém mais na família ainda.</span> : outros.map((m) => (
            <Marcar key={m.id} marcado={para.includes(m.usuarioId)} desabilitado={ocupado} onChange={(on) => marcar(m.usuarioId, on)}>
              {primeiroNome(m.nomeUsuario)}{m.papelPermissao === 3 && <span className={styles.mudo}> · só vê a família, não vê renda</span>}
            </Marcar>
          ))}
        </div>
      )}
      {detalhe && nivel !== VISIBILIDADE_RENDA.valorParaAlguns && <p className={styles.dica}>{detalhe.charAt(0).toUpperCase() + detalhe.slice(1)}.</p>}
    </li>
  )
}
