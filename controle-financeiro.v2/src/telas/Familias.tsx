// Famílias (/familias): os convites que chegaram pra pessoa (aceita ou recusa aqui) e as famílias de que ela
// faz parte. Cada família é uma linha que abre, ali embaixo, o resumo (quem está nela, o balanço do mês e o que
// é seu nele) e o botão pra entrar na página dela. Nova família é uma página (/familias/nova).
import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Plus, Users } from "lucide-react"
import { useAuth } from "../auth/useAuth"
import { aceitarConvite, getBalancoFamilia, getFamilia, getFamilias, getConvitesPendentes, recusarConvite } from "../services/familiaService"
import { mensagemDeErro } from "../api/cliente"
import type { BalancoFamilia, ConviteFamilia, Familia, FamiliaDetalhe } from "../types/Familia"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import { Dinheiro } from "../componentes/Dinheiro"
import Etiqueta from "../componentes/Etiqueta"
import { AcoesFicha, DadosFicha, GrupoFicha, InicialFicha, ItemFicha, ListaFicha } from "../componentes/ListaFicha"
import { fraseSaldo, nomeDoMes, primeiroNome, rotuloModoRateio } from "../dominio/familia"
import styles from "./Familias.module.css"

type Resumo = { detalhe: FamiliaDetalhe; balanco: BalancoFamilia | null }

export default function Familias() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const [familias, setFamilias] = useState<Familia[] | null>(null)
  const [convites, setConvites] = useState<ConviteFamilia[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [abertaId, setAbertaId] = useState<string | null>(() => (state as { abrir?: string } | null)?.abrir ?? null)
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    let vivo = true
    getFamilias().then((f) => { if (vivo) setFamilias(f) }).catch(() => { if (vivo) setErro("Não deu pra carregar as famílias.") })
    getConvitesPendentes().then((c) => { if (vivo) setConvites(c) }).catch(() => { /* sem convites na tela */ })
    return () => { vivo = false }
  }, [versao])
  const recarregar = () => setVersao((v) => v + 1)

  return (
    <div className={styles.pagina}>
      {convites.length > 0 && (
        <Bloco titulo="Convites pra você" semRespiro>
          <ul className={styles.convites} aria-label="Convites pra você">
            {convites.map((c) => <Convite key={c.id} c={c} aoResponder={recarregar} />)}
          </ul>
        </Bloco>
      )}

      <Bloco semRespiro>
        <div className={styles.toolbar}>
          <span className={styles.toolbarTitulo}>Suas famílias</span>
          <Botao compactoNoCelular onClick={() => navigate("/familias/nova", { state: { voltarPara: "/familias" } })}
            icone={<Plus size={15} strokeWidth={2.5} aria-hidden="true" />}>Nova família</Botao>
        </div>
        {familias === null && !erro ? (
          <div className={styles.respiro}><Esqueleto linhas={2} altura={18} /></div>
        ) : erro ? (
          <p className={styles.vazio} role="alert">{erro}</p>
        ) : familias!.length === 0 ? (
          <p className={styles.vazio}>Você ainda não está em nenhuma família. Crie uma e convide quem divide a vida com você.</p>
        ) : (
          <ListaFicha rotulo="Famílias">
            <GrupoFicha rotulo="Suas famílias">
              {familias!.map((f) => (
                <Linha key={f.id} f={f} meuId={usuario?.id ?? ""} aberta={f.id === abertaId}
                  aoAbrir={() => setAbertaId((atual) => (atual === f.id ? null : f.id))} />
              ))}
            </GrupoFicha>
          </ListaFicha>
        )}
      </Bloco>
    </div>
  )
}

function Convite({ c, aoResponder }: { c: ConviteFamilia; aoResponder: () => void }) {
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const responder = async (aceitar: boolean) => {
    setOcupado(true); setErro(null)
    try { await (aceitar ? aceitarConvite(c.token) : recusarConvite(c.token)); aoResponder() }
    catch (e) { setErro(mensagemDeErro(e)); setOcupado(false) }
  }
  return (
    <li className={styles.convite}>
      <span className={styles.conviteIcone} aria-hidden="true"><Users size={16} strokeWidth={2.25} /></span>
      <span className={styles.conviteTexto}>
        <strong>{c.nomeFamilia}</strong> te convidou como {c.papel}
        {erro && <span className={styles.conviteErro} role="alert">{erro}</span>}
      </span>
      <span className={styles.conviteAcoes}>
        <Botao disabled={ocupado} onClick={() => responder(false)}>Recusar</Botao>
        <Botao variante="primario" disabled={ocupado} onClick={() => responder(true)}>Aceitar</Botao>
      </span>
    </li>
  )
}

/** Uma família: a linha (inicial, nome, quantos membros) e, aberta, o resumo do mês com o botão de entrar. */
function Linha({ f, meuId, aberta, aoAbrir }: { f: Familia; meuId: string; aberta: boolean; aoAbrir: () => void }) {
  const navigate = useNavigate()
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const hoje = new Date()
  const mes = hoje.getMonth() + 1, ano = hoje.getFullYear()

  useEffect(() => {
    if (!aberta || resumo) return
    let vivo = true
    Promise.all([getFamilia(f.id), getBalancoFamilia(f.id, mes, ano).catch(() => null)])
      .then(([detalhe, balanco]) => { if (vivo) setResumo({ detalhe, balanco }) })
      .catch(() => { /* a ficha fica só com o botão */ })
    return () => { vivo = false }
  }, [aberta, resumo, f.id, mes, ano])

  const meuSaldo = resumo?.balanco?.saldos.find((s) => s.usuarioId === meuId)?.saldo
  const frase = meuSaldo === undefined ? null : fraseSaldo(meuSaldo)

  return (
    <ItemFicha id={`familia-${f.id}`} aberto={aberta} aoAbrir={aoAbrir}
      marca={<InicialFicha texto={f.nome} destaque />}
      titulo={f.nome}
      detalhe={`${f.totalMembros} ${f.totalMembros === 1 ? "membro" : "membros"}`}
      direita={f.ehAdmin ? <Etiqueta>Admin</Etiqueta> : undefined}>
      {resumo === null ? <Esqueleto linhas={2} altura={16} /> : (
        <DadosFicha>
          <div><dt>Quem está</dt><dd>{resumo.detalhe.membros.map((m) => primeiroNome(m.nomeUsuario)).join(", ")}</dd></div>
          <div><dt>Divisão</dt><dd>{rotuloModoRateio(resumo.detalhe.modoRateioPadrao)}</dd></div>
          {resumo.balanco && <div><dt>{nomeDoMes(mes, ano)}</dt><dd><Dinheiro valor={resumo.balanco.total} /> em despesas da família</dd></div>}
          {frase && meuSaldo !== undefined && (
            <div><dt>Você</dt><dd className={styles.meuSaldo} data-tom={frase.tom}>{frase.tom === "neutro" ? "Em dia" : <>{frase.texto} <Dinheiro valor={Math.abs(meuSaldo)} /></>}</dd></div>
          )}
        </DadosFicha>
      )}
      <AcoesFicha>
        <Botao variante="primario" onClick={() => navigate(`/familias/${f.id}`)}>Abrir família</Botao>
      </AcoesFicha>
    </ItemFicha>
  )
}
