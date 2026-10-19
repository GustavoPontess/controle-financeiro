// Metas (/metas), no modelo de caixinha (como o Nubank; decisão do Gustavo em 2026-10-19): cada meta tem a
// própria caixinha e guardar TIRA o dinheiro da conta e põe nela (transferência de verdade). No topo: quanto
// está guardado nas metas, quanto falta e quanto guardar por mês pra chegar nos prazos. Barra da lista no padrão
// de Bancos: Em andamento | Concluídas à esquerda, "Nova meta" à direita. Cada meta é um cartão (ícone, nome,
// guardado, de quanto, barra, prazo e situação) que abre a página dela (/metas/:id), onde moram guardar,
// resgatar, o histórico e editar/excluir. Metas da família moram no espaço da família.
import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Plus } from "lucide-react"
import { getMetas } from "../services/metaService"
import type { Meta } from "../types/Meta"
import BarraProgresso from "../componentes/BarraProgresso"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import { Dinheiro } from "../componentes/Dinheiro"
import Etiqueta from "../componentes/Etiqueta"
import Segmentos from "../componentes/Segmentos"
import { etiquetaDaMeta, iconeDaMeta, mesAnoCurto, progressoDaMeta, tomDaBarra } from "../dominio/meta"
import styles from "./Metas.module.css"

type Aba = "andamento" | "concluidas"

export default function Metas() {
  const navigate = useNavigate()
  const [metas, setMetas] = useState<Meta[] | null>(null)
  const [erro, setErro] = useState(false)
  const [aba, setAba] = useState<Aba>("andamento")
  useEffect(() => {
    let vivo = true
    getMetas(true).then((m) => { if (vivo) setMetas(m) }).catch(() => { if (vivo) setErro(true) })
    return () => { vivo = false }
  }, [])

  const andamento = useMemo(() => (metas ?? []).filter((m) => !m.concluida), [metas])
  const concluidas = useMemo(() => (metas ?? []).filter((m) => m.concluida), [metas])
  // Em andamento: o prazo mais perto primeiro, as sem prazo depois.
  const visiveis = aba === "concluidas" ? concluidas
    : [...andamento.filter((m) => m.dataLimite).sort((a, b) => a.dataLimite!.localeCompare(b.dataLimite!)), ...andamento.filter((m) => !m.dataLimite)]
  const totais = useMemo(() => metas && ({
    guardado: metas.reduce((s, m) => s + m.guardado, 0),
    falta: andamento.reduce((s, m) => s + m.falta, 0),
    porMes: andamento.reduce((s, m) => s + (m.porMes ?? 0), 0),
  }), [metas, andamento])

  return (
    <div className={styles.pagina}>
      <Bloco className={styles.resumo}>
        <div className={styles.numeros}>
          <Numero rotulo="Guardado nas metas" valor={totais?.guardado} />
          <Numero rotulo="Falta" valor={totais?.falta} />
          <Numero rotulo="Por mês pra chegar no prazo" valor={totais?.porMes} />
        </div>
      </Bloco>

      <Bloco semRespiro>
        <div className={styles.toolbar}>
          <Segmentos<Aba> ariaLabel="Situação" valor={aba} onChange={setAba} opcoes={[
            { valor: "andamento", rotulo: "Em andamento" },
            { valor: "concluidas", rotulo: concluidas.length > 0 ? `Concluídas (${concluidas.length})` : "Concluídas" },
          ]} />
          <Botao compactoNoCelular onClick={() => navigate("/metas/nova", { state: { voltarPara: "/metas" } })}
            icone={<Plus size={15} strokeWidth={2.5} aria-hidden="true" />}>Nova meta</Botao>
        </div>
        {metas === null && !erro ? <div className={styles.respiro}><Esqueleto linhas={3} altura={18} /></div>
          : erro ? <p className={styles.vazio} role="alert">Não deu pra carregar as metas.</p>
          : visiveis.length === 0 ? (
            <p className={styles.vazio}>{metas!.length === 0 ? "Nenhuma meta ainda." : aba === "andamento" ? "Nenhuma meta em andamento." : "Nenhuma meta concluída."}</p>
          ) : (
            <ul className={styles.grade} aria-label="Metas">
              {visiveis.map((m) => <li key={m.id}><Cartao m={m} /></li>)}
            </ul>
          )}
      </Bloco>
    </div>
  )
}

function Numero({ rotulo, valor }: { rotulo: string; valor?: number }) {
  return (
    <div className={styles.numero}>
      <span className={styles.rotulo}>{rotulo}</span>
      {valor === undefined ? <span className={styles.numeroEsqueleto} aria-hidden="true" /> : <Dinheiro valor={valor} className={styles.numeroValor} />}
    </div>
  )
}

/** A caixinha da meta: ícone e situação em cima, nome, quanto tem, de quanto, a barra e o prazo. */
function Cartao({ m }: { m: Meta }) {
  const Icone = iconeDaMeta(m.icone)
  const situacao = etiquetaDaMeta(m)
  const pct = Math.round(m.percentualConcluido)
  const progresso = progressoDaMeta(m)
  return (
    <Link to={`/metas/${m.id}`} className={styles.cartao} data-concluida={m.concluida || undefined}>
      <span className={styles.cartaoTopo}>
        <span className={styles.icone} aria-hidden="true"><Icone size={18} strokeWidth={2.25} /></span>
        {situacao && <Etiqueta tom={situacao.tom}>{situacao.rotulo}</Etiqueta>}
      </span>
      <span className={styles.nome}>{m.nome}</span>
      <span className={styles.valores}>
        <Dinheiro valor={progresso} className={styles.guardado} />
        <span className={styles.de}>de <Dinheiro valor={m.valorAlvo} /></span>
      </span>
      <BarraProgresso fracao={m.valorAlvo > 0 ? progresso / m.valorAlvo : 0} tom={tomDaBarra(m.situacao)} rotulo={`${pct}% ${m.concluidaEm ? "juntado" : "guardado"}`} />
      <span className={styles.rodape}>
        <span>{m.concluidaEm ? `Concluída em ${mesAnoCurto(m.concluidaEm)}` : m.dataLimite ? `Até ${mesAnoCurto(m.dataLimite)}` : "Sem prazo"}</span>
        {m.porMes !== null ? <span className={styles.porMes}><Dinheiro valor={m.porMes} />/mês</span> : <span className={styles.pct}>{pct}%</span>}
      </span>
    </Link>
  )
}
