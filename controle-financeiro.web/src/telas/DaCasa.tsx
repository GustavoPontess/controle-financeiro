// "Dividir com {família}" de uma conta ou cartão (passo 5 do espaço da família: contas da casa, modelo Honeydue/Monarch).
// Ligado, toda despesa que nasce ali daqui pra frente já nasce dividida (lançamento, extrato, conta fixa); o que já
// existe não muda. Usado na ficha da conta (Bancos) e na página do cartão. Sem família, não aparece.
import { useEffect, useState } from "react"
import { getFamilias } from "../services/familiaService"
import { mensagemDeErro } from "../api/cliente"
import type { Familia } from "../types/Familia"
import Bloco from "../componentes/Bloco"
import Interruptor from "../componentes/Interruptor"
import Selecao from "../componentes/Selecao"
import styles from "./DaCasa.module.css"

export default function DaCasa({ tipo, familiaId, aoMudar, emBloco, className }: {
  /** O rótulo diz o que é: "Cartão da casa: as compras já entram divididas…" / "Conta da casa: as despesas…". */
  tipo: "conta" | "cartao"
  familiaId: string | null | undefined
  /** Dentro de um Bloco "Família" (página do cartão); sem família, nem o Bloco aparece. */
  emBloco?: boolean
  /** Só posição no layout de quem usa (ex.: o fio em cima, na ficha da conta). */
  className?: string
  /** Grava (null = deixa de ser da casa). */
  aoMudar: (familiaId: string | null) => Promise<void>
}) {
  const [familias, setFamilias] = useState<Familia[] | null>(null)
  const [atual, setAtual] = useState<string | null>(familiaId ?? null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => { setAtual(familiaId ?? null) }, [familiaId])
  useEffect(() => {
    let vivo = true
    getFamilias().then((f) => { if (vivo) setFamilias(f) }).catch(() => { if (vivo) setFamilias([]) })
    return () => { vivo = false }
  }, [])
  if (!familias || familias.length === 0) return null

  const gravar = async (fid: string | null) => {
    setOcupado(true); setErro(null)
    try { await aoMudar(fid); setAtual(fid) } catch (e) { setErro(mensagemDeErro(e)) }
    setOcupado(false)
  }
  const nome = (familias.find((f) => f.id === atual) ?? familias[0]).nome
  const conteudo = (
    <div className={className ? `${styles.daCasa} ${className}` : styles.daCasa}>
      <Interruptor ligado={!!atual} desabilitado={ocupado} onChange={(on) => { void gravar(on ? (atual ?? familias[0].id) : null) }}>
        {tipo === "cartao" ? "Cartão da casa: as compras já entram divididas" : "Conta da casa: as despesas já entram divididas"}
        {familias.length > 1 && !atual ? "" : ` com ${nome}`}
      </Interruptor>
      {atual && familias.length > 1 && (
        <Selecao tamanho="sm" ariaLabel="Família" valor={atual} desabilitado={ocupado} onChange={(v) => { void gravar(v) }}
          opcoes={familias.map((f) => ({ valor: f.id, rotulo: f.nome }))} />
      )}
      {erro && <p className={styles.erro} role="alert">{erro}</p>}
    </div>
  )
  return emBloco ? <Bloco titulo="Família">{conteudo}</Bloco> : conteudo
}
