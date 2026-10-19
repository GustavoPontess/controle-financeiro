// Metas (/metas), no modelo de reserva (Monarch; decisão do Gustavo em 2026-10-19): guardar numa meta reserva
// parte do saldo de uma conta real, sem mover dinheiro. No topo: quanto está guardado nas metas, quanto falta e
// quanto guardar por mês pra chegar nos prazos. Barra da lista no padrão de Bancos: Em andamento | Concluídas à
// esquerda, "Nova meta" à direita; em andamento vem em Com prazo e Sem prazo. A linha mostra o progresso e a
// situação (no ritmo / atrás / prazo passou / chegou lá); a ficha mostra onde o dinheiro está guardado e as
// ações (Guardar, Tirar, Editar, Excluir). Metas da família moram no espaço da família.
import { useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { ArrowDownToLine, ArrowUpFromLine, Pencil, Plus, Target, Trash2 } from "lucide-react"
import { excluirMeta, getMetas } from "../services/metaService"
import { mensagemDeErro } from "../api/cliente"
import type { Meta } from "../types/Meta"
import BarraProgresso from "../componentes/BarraProgresso"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Confirmar from "../componentes/Confirmar"
import { Dinheiro } from "../componentes/Dinheiro"
import Etiqueta from "../componentes/Etiqueta"
import Segmentos from "../componentes/Segmentos"
import { AcoesFicha, DadosFicha, GrupoFicha, ItemFicha, ListaFicha } from "../componentes/ListaFicha"
import { SITUACAO_META, mesAnoCurto } from "../dominio/meta"
import styles from "./Metas.module.css"

type Aba = "andamento" | "concluidas"

export default function Metas() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const [metas, setMetas] = useState<Meta[] | null>(null)
  const [erro, setErro] = useState(false)
  const [abertaId, setAbertaId] = useState<string | null>(() => (state as { abrir?: string } | null)?.abrir ?? null)
  const [aba, setAba] = useState<Aba>("andamento")
  const carregar = () => getMetas(true).then(setMetas).catch(() => setErro(true))
  useEffect(() => { void carregar() }, [])

  const andamento = useMemo(() => (metas ?? []).filter((m) => !m.concluida), [metas])
  const concluidas = useMemo(() => (metas ?? []).filter((m) => m.concluida), [metas])
  // Chegou com uma meta concluída pra abrir (ex.: acabou de guardar o que faltava): mostra a aba dela.
  const abrirConcluida = !!metas?.find((m) => m.id === abertaId)?.concluida
  useEffect(() => { if (abrirConcluida) setAba("concluidas") }, [abrirConcluida])
  // Em andamento: com prazo primeiro (o mais perto em cima), depois as sem prazo. Concluídas: um grupo só.
  const grupos = aba === "concluidas"
    ? [{ chave: "concluidas", rotulo: "Concluídas", metas: concluidas }]
    : [
      { chave: "prazo", rotulo: "Com prazo", metas: andamento.filter((m) => m.dataLimite).sort((a, b) => a.dataLimite!.localeCompare(b.dataLimite!)) },
      { chave: "sem-prazo", rotulo: "Sem prazo", metas: andamento.filter((m) => !m.dataLimite) },
    ].filter((g) => g.metas.length > 0)
  const totais = useMemo(() => metas && ({
    guardado: metas.reduce((s, m) => s + m.guardado, 0),
    falta: andamento.reduce((s, m) => s + m.falta, 0),
    porMes: andamento.reduce((s, m) => s + (m.porMes ?? 0), 0),
  }), [metas, andamento])
  const nova = () => navigate("/metas/nova", { state: { voltarPara: "/metas" } })

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
          <Botao compactoNoCelular onClick={nova} icone={<Plus size={15} strokeWidth={2.5} aria-hidden="true" />}>Nova meta</Botao>
        </div>
        {metas === null && !erro ? <div className={styles.respiro}><Esqueleto linhas={3} altura={18} /></div>
          : erro ? <p className={styles.vazio} role="alert">Não deu pra carregar as metas.</p>
          : grupos.length === 0 ? (
            <p className={styles.vazio}>{metas!.length === 0 ? "Nenhuma meta ainda." : aba === "andamento" ? "Nenhuma meta em andamento." : "Nenhuma meta concluída."}</p>
          ) : (
            <ListaFicha rotulo="Metas">
              {grupos.map((g) => (
                <GrupoFicha key={g.chave} rotulo={g.rotulo}>
                  {g.metas.map((m) => <Linha key={m.id} m={m} aberta={m.id === abertaId} aoAbrir={() => setAbertaId((a) => (a === m.id ? null : m.id))} aoMudar={carregar} />)}
                </GrupoFicha>
              ))}
            </ListaFicha>
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

function Linha({ m, aberta, aoAbrir, aoMudar }: { m: Meta; aberta: boolean; aoAbrir: () => void; aoMudar: () => void }) {
  const navigate = useNavigate()
  const [excluindo, setExcluindo] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const situacao = SITUACAO_META[m.situacao]
  const voltar = { state: { voltarPara: "/metas" } }
  const excluir = async () => {
    setOcupado(true); setErro(null)
    try { await excluirMeta(m.id); setExcluindo(false); aoMudar() }
    catch (e) { setErro(mensagemDeErro(e)); setOcupado(false); setExcluindo(false) }
  }

  return (
    <>
      <ItemFicha id={`meta-${m.id}`} aberto={aberta} aoAbrir={aoAbrir}
        marca={<span className={styles.icone} data-concluida={m.concluida || undefined} aria-hidden="true"><Target size={17} strokeWidth={2.25} /></span>}
        titulo={m.nome}
        detalhe={<><Dinheiro valor={m.guardado} /> de <Dinheiro valor={m.valorAlvo} />{m.dataLimite ? ` · até ${mesAnoCurto(m.dataLimite)}` : " · sem prazo"}</>}
        direita={
          <span className={styles.direita}>
            <span className={styles.direitaTopo}>
              {situacao && <Etiqueta tom={situacao.tom}>{situacao.rotulo}</Etiqueta>}
              {m.porMes !== null ? <span className={styles.valor}><Dinheiro valor={m.porMes} />/mês</span>
                : <span className={styles.pct}>{Math.round(m.percentualConcluido)}%</span>}
            </span>
            <span className={styles.barra}>
              <BarraProgresso fracao={m.valorAlvo > 0 ? m.guardado / m.valorAlvo : 0} tom={m.concluida ? "positivo" : m.situacao === "atras" || m.situacao === "prazo-passou" ? "alerta" : undefined}
                rotulo={`${Math.round(m.percentualConcluido)}% guardado`} />
            </span>
          </span>
        }>
        {erro && <p className={styles.alerta} role="alert">{erro}</p>}
        <div className={styles.guardado}>
          <span className={styles.guardadoTitulo}>Onde está guardado</span>
          {m.reservas.length === 0 ? <span className={styles.dica}>Nada guardado ainda.</span> : (
            <ul className={styles.reservas} aria-label="Onde está guardado">
              {m.reservas.map((r) => (
                <li key={r.contaId}><span>{r.contaNome}{r.bancoNome ? <span className={styles.dica}> · {r.bancoNome}</span> : null}</span><Dinheiro valor={r.valor} /></li>
              ))}
            </ul>
          )}
        </div>
        <DadosFicha>
          <div><dt>Quanto quer juntar</dt><dd><Dinheiro valor={m.valorAlvo} /></dd></div>
          <div><dt>Falta</dt><dd><Dinheiro valor={m.falta} /></dd></div>
          {m.dataLimite && <div><dt>Prazo</dt><dd>{mesAnoCurto(m.dataLimite)}{m.mesesRestantes ? ` · ${m.mesesRestantes} ${m.mesesRestantes === 1 ? "mês" : "meses"}` : ""}</dd></div>}
          {m.porMes !== null && <div><dt>Por mês pra chegar no prazo</dt><dd><Dinheiro valor={m.porMes} /></dd></div>}
        </DadosFicha>
        <AcoesFicha>
          <Botao variante="texto" perigo disabled={ocupado} onClick={() => setExcluindo(true)} icone={<Trash2 size={15} strokeWidth={2.25} aria-hidden="true" />}>Excluir</Botao>
          {m.guardado > 0 && <Botao onClick={() => navigate(`/metas/${m.id}/tirar`, voltar)} icone={<ArrowUpFromLine size={15} strokeWidth={2.25} aria-hidden="true" />}>Tirar</Botao>}
          <Botao onClick={() => navigate(`/metas/${m.id}/editar`, voltar)} icone={<Pencil size={15} strokeWidth={2.25} aria-hidden="true" />}>Editar</Botao>
          <Botao variante="primario" onClick={() => navigate(`/metas/${m.id}/guardar`, voltar)} icone={<ArrowDownToLine size={15} strokeWidth={2.25} aria-hidden="true" />}>Guardar</Botao>
        </AcoesFicha>
      </ItemFicha>
      <Confirmar aberto={excluindo} perigo ocupado={ocupado} titulo={`Excluir a meta ${m.nome}?`}
        texto={m.guardado > 0 ? "O dinheiro guardado nela volta a ficar livre nas contas. Nada sai das contas." : undefined}
        rotuloConfirmar="Excluir" onConfirmar={() => void excluir()} onCancelar={() => setExcluindo(false)} />
    </>
  )
}
