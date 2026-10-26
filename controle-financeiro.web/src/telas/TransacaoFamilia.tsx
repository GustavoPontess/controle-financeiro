// Quadro "Família" na página de uma despesa (passo 2 do espaço da família; docs/features/familia/espaco-da-familia.md).
// Só sua: "Dividir com {família}" e, se a família tem dependentes, "Pra quem" (vale sem dividir: o gasto do Theo que
// só você pagou). Dividida: a situação, como divide (Igual · Pela renda · Do meu jeito: muda SÓ esta despesa e regrava
// as partes), a parte de cada um (gravada ao dividir, não muda sozinha), quem cuida dessa conta (só rótulo na lista da
// família), pra quem, e "Parar de dividir". A página é só de quem lançou, então tudo aqui é dele.
import { useEffect, useMemo, useState } from "react"
import { useAuth } from "../auth/useAuth"
import {
  atribuirDependente, atribuirResponsavel, compartilharTransacao, definirRateioTransacao, descompartilharTransacao,
  getDependentes, getFamilia, getFamilias, getRateioTransacao,
} from "../services/familiaService"
import { mensagemDeErro } from "../api/cliente"
import type { Transaction } from "../types/Transaction"
import type { Dependente, Familia, FamiliaDetalhe, ModoRateio, RateioTransacao } from "../types/Familia"
import Bloco from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import Confirmar from "../componentes/Confirmar"
import { Dinheiro } from "../componentes/Dinheiro"
import Entrada from "../componentes/Entrada"
import Etiqueta from "../componentes/Etiqueta"
import { LinhaCampos } from "../componentes/Formulario"
import Selecao from "../componentes/Selecao"
import { mesAnoCurto } from "../dominio/meta"
import { APROVACAO, MODOS_RATEIO, PAPEL_PERMISSAO, primeiroNome } from "../dominio/familia"
import styles from "./Transacao.module.css"

const MODO = { igual: 1, pelaRenda: 2, doMeuJeito: 3 } as const satisfies Record<string, ModoRateio>
/** "33,33": o % como texto pra caixa (vírgula, até 2 casas). */
const pctParaCampo = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",")
const pctDoCampo = (s: string) => (s.trim() === "" ? NaN : Number(s.replace(",", ".")))
/** Só dígitos e UMA vírgula, 2 casas ("2,52,5" não entra). */
const soPercentual = (s: string) => {
  const [inteiro, ...resto] = s.replace(/[^\d,]/g, "").split(",")
  return resto.length ? `${inteiro},${resto.join("").slice(0, 2)}` : inteiro
}
const fmtPct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`

export default function TransacaoFamilia({ t, aoMudar }: { t: Transaction; aoMudar: () => void }) {
  const { usuario } = useAuth()
  const dividida = !!t.familiaId
  const [familias, setFamilias] = useState<Familia[] | null>(null)
  const [escolhida, setEscolhida] = useState("")
  const [detalhe, setDetalhe] = useState<FamiliaDetalhe | null>(null)
  const [dependentes, setDependentes] = useState<Dependente[]>([])
  const [rateio, setRateio] = useState<RateioTransacao | null>(null)
  // Sobe a cada ação que deu certo: relê as partes (o modo muda sem a transação mudar).
  const [versao, setVersao] = useState(0)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [parando, setParando] = useState(false)
  // "Do meu jeito" aberto: o % de cada um enquanto edita (texto, pra aceitar vírgula).
  const [meuJeito, setMeuJeito] = useState<Record<string, string> | null>(null)
  const [erroJeito, setErroJeito] = useState<string | null>(null)
  const familiaId = t.familiaId ?? escolhida

  // Só sua: as famílias da pessoa, pra escolher com quem dividir.
  useEffect(() => {
    if (dividida) return
    let vivo = true
    getFamilias()
      .then((f) => { if (!vivo) return; setFamilias(f); setEscolhida((e) => e || f[0]?.id || "") })
      .catch(() => { if (vivo) setFamilias([]) })
    return () => { vivo = false }
  }, [dividida])

  useEffect(() => {
    if (!familiaId) return
    let vivo = true
    getFamilia(familiaId).then((d) => { if (vivo) setDetalhe(d) }).catch(() => { /* sem a ficha, o quadro mostra só o básico */ })
    getDependentes(familiaId).then((d) => { if (vivo) setDependentes(d.filter((x) => x.ativo)) }).catch(() => { /* sem "pra quem" */ })
    return () => { vivo = false }
  }, [familiaId])

  useEffect(() => {
    if (!dividida) { setRateio(null); return }
    let vivo = true
    getRateioTransacao(t.id).then((r) => { if (vivo) setRateio(r) }).catch(() => { /* sem as partes, o quadro mostra o resto */ })
    return () => { vivo = false }
  }, [t.id, dividida, versao])

  // Quem entra na divisão: os membros que lançam (quem "só vê" fica fora).
  const membros = useMemo(() => (detalhe?.membros ?? []).filter((m) => m.papelPermissao !== PAPEL_PERMISSAO.dependente), [detalhe])
  const soVe = useMemo(() => (detalhe?.membros ?? []).filter((m) => m.papelPermissao === PAPEL_PERMISSAO.dependente).map((m) => primeiroNome(m.nomeUsuario)), [detalhe])

  if (!dividida && (familias === null || familias.length === 0)) return null

  const rodar = async (acao: () => Promise<unknown>) => {
    setOcupado(true); setErro(null)
    try { await acao(); setVersao((v) => v + 1); aoMudar() } catch (e) { setErro(mensagemDeErro(e)) }
    setOcupado(false)
  }
  const nomeFamilia = detalhe?.nome ?? familias?.find((f) => f.id === familiaId)?.nome ?? "a família"
  const nomeDe = (id: string) => {
    const m = detalhe?.membros.find((x) => x.usuarioId === id)
    if (m) return m.usuarioId === usuario?.id ? `${primeiroNome(m.nomeUsuario)} (você)` : primeiroNome(m.nomeUsuario)
    const r = rateio?.membros.find((x) => x.usuarioId === id)
    return r ? primeiroNome(r.nome) : "Membro que saiu"
  }

  const praQuem = dependentes.length > 0 && (
    <div className={styles.familiaCampos}>
      <LinhaCampos>
        <Campo rotulo="Pra quem">
          <Selecao valor={t.dependenteId ?? ""} desabilitado={ocupado}
            opcoes={[{ valor: "", rotulo: "Ninguém em especial" }, ...dependentes.map((d) => ({ valor: d.id, rotulo: d.apelido || d.nome }))]}
            onChange={(v) => { void rodar(() => atribuirDependente(t.id, v || null)) }} />
        </Campo>
        <div />
      </LinhaCampos>
    </div>
  )

  if (!dividida)
    return (
      <Bloco titulo="Família">
        {erro && <p className={styles.alerta} role="alert">{erro}</p>}
        <div className={styles.familiaLinha}>
          <p className={styles.familiaTexto}>Só sua. Dividindo com {nomeFamilia}, entra no equilíbrio do mês.</p>
          <span className={styles.familiaAcoes}>
            {familias!.length > 1 && (
              <Selecao tamanho="sm" ariaLabel="Família" valor={escolhida} onChange={setEscolhida}
                opcoes={familias!.map((f) => ({ valor: f.id, rotulo: f.nome }))} />
            )}
            <Botao variante="primario" disabled={ocupado || !familiaId} onClick={() => { void rodar(() => compartilharTransacao(t.id, familiaId)) }}>
              Dividir com {nomeFamilia}
            </Botao>
          </span>
        </div>
        {praQuem}
      </Bloco>
    )

  // ── dividida ──
  const modoGravado = rateio?.modo ?? MODO.igual
  const modoAtual = meuJeito ? MODO.doMeuJeito : modoGravado
  const abrirMeuJeito = () => {
    // Começa do que está gravado (ou igual), pra pessoa só ajustar.
    const igual = 100 / Math.max(1, membros.length)
    setMeuJeito(Object.fromEntries(membros.map((m) => [m.usuarioId, pctParaCampo(rateio?.membros.find((r) => r.usuarioId === m.usuarioId)?.percentual ?? igual)])))
    setErroJeito(null)
  }
  const trocarModo = (valor: string) => {
    const modo = Number(valor) as ModoRateio
    if (modo === MODO.doMeuJeito) { abrirMeuJeito(); return }
    setMeuJeito(null); setErroJeito(null)
    void rodar(() => definirRateioTransacao(t.id, modo, null))
  }
  const salvarMeuJeito = () => {
    if (!meuJeito) return
    const itens = membros.map((m) => ({ usuarioId: m.usuarioId, percentual: pctDoCampo(meuJeito[m.usuarioId] ?? "") }))
    if (itens.some((i) => !Number.isFinite(i.percentual) || i.percentual < 0)) { setErroJeito("Diga a parte de cada um, em %."); return }
    const soma = itens.reduce((s, i) => s + i.percentual, 0)
    if (Math.abs(soma - 100) > 0.01) { setErroJeito(`As partes somam ${fmtPct(soma)}; têm que somar 100%.`); return }
    setErroJeito(null)
    void rodar(async () => { await definirRateioTransacao(t.id, MODO.doMeuJeito, itens); setMeuJeito(null) })
  }

  const situacao = t.statusAprovacao === APROVACAO.pendente ? <Etiqueta tom="alerta">Esperando aprovação</Etiqueta>
    : t.statusAprovacao === APROVACAO.rejeitada ? <Etiqueta tom="negativo">Recusada</Etiqueta>
    : <Etiqueta>No equilíbrio do mês</Etiqueta>
  const opcoesCuida = membros.map((m) => ({ valor: m.usuarioId, rotulo: nomeDe(m.usuarioId) }))
  if (t.responsavelUsuarioId && !opcoesCuida.some((o) => o.valor === t.responsavelUsuarioId))
    opcoesCuida.push({ valor: t.responsavelUsuarioId, rotulo: nomeDe(t.responsavelUsuarioId) })

  return (
    <Bloco titulo={<span className={styles.familiaTitulo}>Família · {nomeFamilia} {situacao}</span>}>
      {erro && <p className={styles.alerta} role="alert">{erro}</p>}
      <LinhaCampos>
        <Campo rotulo="Como divide">
          <Selecao valor={String(modoAtual)} desabilitado={ocupado} onChange={trocarModo}
            opcoes={MODOS_RATEIO.map((m) => ({ valor: String(m.valor), rotulo: m.rotulo, detalhe: m.detalhe }))} />
        </Campo>
        <Campo rotulo="Quem cuida dessa conta">
          <Selecao valor={t.responsavelUsuarioId ?? ""} desabilitado={ocupado}
            opcoes={[{ valor: "", rotulo: "Ninguém em especial" }, ...opcoesCuida]}
            onChange={(v) => { void rodar(() => atribuirResponsavel(t.familiaId!, t.id, v || null)) }} />
        </Campo>
      </LinhaCampos>

      {meuJeito ? (
        <div className={styles.meuJeito}>
          <span className={styles.partesTitulo}>A parte de cada um, em %</span>
          <div className={styles.meuJeitoCampos}>
            {membros.map((m) => (
              <Campo key={m.usuarioId} rotulo={nomeDe(m.usuarioId)}>
                <Entrada tamanho="sm" inputMode="decimal" sufixo="%" value={meuJeito[m.usuarioId] ?? ""}
                  onChange={(e) => { const v = soPercentual(e.target.value); setMeuJeito((j) => ({ ...(j ?? {}), [m.usuarioId]: v })); setErroJeito(null) }} />
              </Campo>
            ))}
          </div>
          {erroJeito && <p className={styles.alerta} role="alert">{erroJeito}</p>}
          <div className={styles.meuJeitoAcoes}>
            <Botao disabled={ocupado} onClick={() => { setMeuJeito(null); setErroJeito(null) }}>Cancelar</Botao>
            <Botao variante="primario" disabled={ocupado} onClick={salvarMeuJeito}>Salvar a divisão</Botao>
          </div>
        </div>
      ) : rateio && rateio.membros.length > 0 && (
        <div className={styles.partes}>
          <div className={styles.partesTopo}>
            <span className={styles.partesTitulo}>Parte de cada um</span>
            {modoGravado === MODO.doMeuJeito && <Botao variante="texto" disabled={ocupado} onClick={abrirMeuJeito}>Ajustar</Botao>}
          </div>
          <ul className={styles.partesLista} aria-label="Parte de cada um">
            {/* Você primeiro, quem saiu por último. */}
            {[...rateio.membros].sort((a, b) => Number(b.usuarioId === usuario?.id) - Number(a.usuarioId === usuario?.id) || Number(!!a.saiuEm) - Number(!!b.saiuEm)).map((m) => (
              <li key={m.usuarioId}>
                <span>{nomeDe(m.usuarioId)}{m.saiuEm && <span className={styles.mudo}> · saiu em {mesAnoCurto(m.saiuEm)}</span>}</span>
                <span className={styles.mudo}>{fmtPct(m.percentual)}</span>
                <Dinheiro valor={m.valor} className={styles.parteValor} />
              </li>
            ))}
          </ul>
          {soVe.length > 0 && <p className={styles.mudo}>{soVe.join(", ")} só vê: fica fora da divisão.</p>}
        </div>
      )}

      {praQuem}
      <div className={styles.familiaRodape}>
        <Botao disabled={ocupado} onClick={() => setParando(true)}>Parar de dividir</Botao>
      </div>
      <Confirmar aberto={parando} titulo="Parar de dividir?" rotuloConfirmar="Parar de dividir" ocupado={ocupado}
        texto={<>{t.descricao} volta a ser só sua e sai do equilíbrio do mês de {nomeFamilia}.</>}
        onConfirmar={() => { void rodar(async () => { await descompartilharTransacao(t.id); setParando(false) }) }}
        onCancelar={() => setParando(false)} />
    </Bloco>
  )
}
