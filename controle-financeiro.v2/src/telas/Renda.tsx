// Renda (/renda, menu principal): o mês da pessoa como FATO (o que caiu em "Renda") e o que ela DECLARA esperar:
// a fixa (salário, aposentadoria, benefício) e a variável (comissão, bico, diária). Vale até ela mudar. Nada a ver
// com "contas fixas", que são contas a pagar (o Gustavo, 2026-10-18). O que a família vê disso se escolhe NA
// família (ficha do próprio membro), não aqui. Spec: docs/features/familia/renda-e-visibilidade.md.
import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { definirRendaPrevista, getRendaMes, limparRendaPrevista } from "../services/rendaService"
import { mensagemDeErro } from "../api/cliente"
import type { RendaMes } from "../types/Renda"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import { Dinheiro } from "../componentes/Dinheiro"
import EntradaValor from "../componentes/EntradaValor"
import { LinhaCampos } from "../componentes/Formulario"
import { nomeDoMes } from "../dominio/familia"
import { dataBR } from "../utils/dateTime"
import { moneyParaCampo, parseMoney } from "../utils/money"
import styles from "./Renda.module.css"

export default function Renda() {
  const hoje = new Date()
  const [periodo, setPeriodo] = useState({ ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 })
  const [renda, setRenda] = useState<RendaMes | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [fixa, setFixa] = useState("")
  const [variavel, setVariavel] = useState("")
  const [salvando, setSalvando] = useState(false)

  const aplicar = (r: RendaMes) => {
    setRenda(r)
    setFixa(r.fixaEsperada ? moneyParaCampo(r.fixaEsperada) : "")
    setVariavel(r.variavelEsperada ? moneyParaCampo(r.variavelEsperada) : "")
  }

  useEffect(() => {
    let vivo = true
    setRenda(null); setErro(null)
    getRendaMes(periodo.ano, periodo.mes)
      .then((r) => { if (vivo) aplicar(r) })
      .catch((e) => { if (vivo) setErro(mensagemDeErro(e)) })
    return () => { vivo = false }
  }, [periodo])

  const mudarMes = (delta: number) => setPeriodo((p) => { const d = new Date(p.ano, p.mes - 1 + delta, 1); return { ano: d.getFullYear(), mes: d.getMonth() + 1 } })
  const rodar = async (acao: () => Promise<RendaMes>) => {
    setSalvando(true); setErro(null)
    try { aplicar(await acao()) } catch (e) { setErro(mensagemDeErro(e)) }
    setSalvando(false)
  }
  const salvar = () => rodar(() => definirRendaPrevista(periodo.ano, periodo.mes, parseMoney(fixa), parseMoney(variavel)))
  const usarMedia = (media: number) => rodar(() => definirRendaPrevista(periodo.ano, periodo.mes, media, 0))
  const mesNome = nomeDoMes(periodo.mes, periodo.ano)
  const mudou = !!renda && (parseMoney(fixa) !== renda.fixaEsperada || parseMoney(variavel) !== renda.variavelEsperada)

  return (
    <div className={styles.pagina}>
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
              <Numero rotulo="Esperado" valor={renda.previsto} />
              <Numero rotulo="Recebido" valor={renda.recebido} tom="positivo" />
              <Numero rotulo={renda.falta > 0 ? "Falta" : "A mais"} valor={renda.falta > 0 ? renda.falta : Math.max(0, renda.recebido - renda.previsto)} />
            </div>

            {/* O que a pessoa espera receber: fixa + variável. Declara uma vez, vale até mudar. */}
            <div className={styles.esperado} aria-label="O que você espera receber">
              <span className={styles.esperadoTitulo}>
                O que você espera receber por mês
                {renda.previsto > 0 && !renda.declaradoNoMes && <span className={styles.mudo}> · vale o que você declarou antes</span>}
              </span>
              <LinhaCampos>
                <Campo rotulo="Fixa (salário, aposentadoria, benefício)">
                  <EntradaValor compacto valor={fixa} onChange={setFixa} />
                </Campo>
                <Campo rotulo="Variável (comissão, bico, extra)">
                  <EntradaValor compacto valor={variavel} onChange={setVariavel} />
                </Campo>
              </LinhaCampos>
              <div className={styles.esperadoAcoes}>
                {renda.sugestaoMedia3Meses !== null && renda.previsto === 0 && (
                  <span className={styles.dica}>Nos últimos meses caiu em média <Dinheiro valor={renda.sugestaoMedia3Meses} /> por mês.{" "}
                    <button type="button" className={styles.linkBotao} disabled={salvando} onClick={() => usarMedia(renda.sugestaoMedia3Meses!)}>Usar como esperado</button></span>
                )}
                <span className={styles.esperadoBotoes}>
                  {renda.declaradoNoMes && <Botao variante="texto" disabled={salvando} onClick={() => rodar(() => limparRendaPrevista(periodo.ano, periodo.mes))}>Limpar este mês</Botao>}
                  <Botao variante="primario" disabled={salvando || !mudou} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</Botao>
                </span>
              </div>
            </div>

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
    </div>
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
