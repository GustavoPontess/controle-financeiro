// Bancos (contas) do v2: três números (saldo total, disponível em conta corrente + carteira, guardado na
// poupança) e a lista de contas — abertas ou encerradas. Linha → página da conta. As contas vêm todas de
// uma vez (são poucas), então Abertas | Encerradas filtra a lista já carregada.
import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Plus, Wallet } from "lucide-react"
import { getContas } from "../services/contaService"
import type { Conta } from "../types/Conta"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import { Dinheiro } from "../componentes/Dinheiro"
import Etiqueta from "../componentes/Etiqueta"
import LogoMarca from "../componentes/LogoMarca"
import Segmentos from "../componentes/Segmentos"
import { TIPO_CONTA, descreverConta } from "../dominio/conta"
import { dataBR } from "../utils/dateTime"
import styles from "./Bancos.module.css"

type Situacao = "abertas" | "encerradas"
const SITUACOES: { valor: Situacao; rotulo: string }[] = [
  { valor: "abertas", rotulo: "Abertas" },
  { valor: "encerradas", rotulo: "Encerradas" },
]

export default function Bancos() {
  const navigate = useNavigate()
  const [contas, setContas] = useState<Conta[] | null>(null)
  const [erro, setErro] = useState(false)
  const [situacao, setSituacao] = useState<Situacao>("abertas")

  useEffect(() => {
    let vivo = true
    getContas({ incluirEncerradas: true }).then((c) => { if (vivo) setContas(c) }).catch(() => { if (vivo) setErro(true) })
    return () => { vivo = false }
  }, [])

  const abertas = useMemo(() => (contas ?? []).filter((c) => !c.encerradaEm), [contas])
  const encerradas = useMemo(() => (contas ?? []).filter((c) => !!c.encerradaEm), [contas])
  // Carteira primeiro, depois por nome — a carteira é a conta do dia a dia.
  const visiveis = (situacao === "abertas" ? abertas : encerradas)
    .slice().sort((a, b) => Number(b.isCarteira) - Number(a.isCarteira) || a.nome.localeCompare(b.nome, "pt-BR"))

  const totais = useMemo(() => {
    if (!contas) return null
    const soma = (f: (c: Conta) => boolean) => abertas.filter(f).reduce((s, c) => s + c.saldoAtual, 0)
    return {
      total: soma(() => true),
      disponivel: soma((c) => c.tipo !== TIPO_CONTA.poupanca),
      guardado: soma((c) => c.tipo === TIPO_CONTA.poupanca),
    }
  }, [contas, abertas])

  return (
    <div className={styles.pagina}>
      <Bloco className={styles.resumo}>
        <div className={styles.numeros}>
          <Numero rotulo="Saldo total" valor={totais?.total} />
          <Numero rotulo="Disponível" valor={totais?.disponivel} />
          <Numero rotulo="Guardado na poupança" valor={totais?.guardado} />
        </div>
      </Bloco>

      <Bloco semRespiro>
        <div className={styles.toolbar}>
          <Segmentos ariaLabel="Situação" valor={situacao} onChange={setSituacao}
            opcoes={SITUACOES.map((s) => ({ ...s, rotulo: s.valor === "encerradas" && encerradas.length > 0 ? `${s.rotulo} (${encerradas.length})` : s.rotulo }))} />
          <Botao compactoNoCelular onClick={() => navigate("/bancos/nova", { state: { voltarPara: "/bancos" } })}
            icone={<Plus size={15} strokeWidth={2.5} aria-hidden="true" />}>Nova conta</Botao>
        </div>
        {contas === null && !erro ? (
          <div className={styles.respiro}><Esqueleto linhas={3} altura={18} /></div>
        ) : erro ? (
          <p className={styles.vazio}>Não deu pra carregar as contas.</p>
        ) : visiveis.length === 0 ? (
          <p className={styles.vazio}>{situacao === "abertas" ? "Nenhuma conta ainda." : "Nenhuma conta encerrada."}</p>
        ) : (
          <ul className={styles.lista}>
            {visiveis.map((c) => <Linha key={c.id} c={c} />)}
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
      {valor === undefined ? <span className={styles.numeroEsqueleto} />
        : <Dinheiro valor={valor} className={styles.numeroValor} tom={valor < 0 ? "negativo" : undefined} />}
    </div>
  )
}

/** Uma linha: marca do banco (carteira: ícone), nome + etiqueta, detalhe; à direita o saldo. */
function Linha({ c }: { c: Conta }) {
  return (
    <li>
      <Link to={`/bancos/${c.id}`} className={styles.linha} data-encerrada={c.encerradaEm ? "true" : undefined}>
        {c.isCarteira
          ? <span className={styles.carteira} aria-hidden="true"><Wallet size={18} strokeWidth={2} /></span>
          : <LogoMarca nome={c.bancoNome || c.nome} logoUrl={c.bancoLogoUrl} cor={c.bancoCor} tamanho={36} />}
        <span className={styles.texto}>
          <span className={styles.nomeLinha}>
            <span className={styles.nome}>{c.nome}</span>
            {c.isCarteira && <Etiqueta>Carteira</Etiqueta>}
            {c.encerradaEm && <Etiqueta>Encerrada em {dataBR(c.encerradaEm)}</Etiqueta>}
          </span>
          <span className={styles.sub}>{descreverConta(c)}</span>
        </span>
        <Dinheiro valor={c.saldoAtual} className={styles.valor} tom={c.encerradaEm ? "neutro" : c.saldoAtual < 0 ? "negativo" : undefined} />
      </Link>
    </li>
  )
}
