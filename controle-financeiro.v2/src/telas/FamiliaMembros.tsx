// Membros da família (/familias/:id/membros): QUEM é da casa (docs/features/familia/membros-e-permissoes.md, passo 2).
// Convidar e adicionar alguém sem conta ficam à vista no topo; uma linha por pessoa (foto, nome, relação, perfil,
// situação). Clicar abre a página da pessoa (perfil, o que pode, renda, remover/sair), não uma ficha na linha.
// Convites pendentes e quem saiu ficam embaixo. O que cada um pode fazer quem decide é o servidor.
import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { UserPlus, UserRoundPlus } from "lucide-react"
import { useAuth } from "../auth/useAuth"
import { getDependentes, revogarConvite } from "../services/familiaService"
import { mensagemDeErro } from "../api/cliente"
import type { ConviteFamilia, Dependente } from "../types/Familia"
import { urlFoto } from "../componentes/Avatar"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Etiqueta from "../componentes/Etiqueta"
import { GrupoFicha, InicialFicha, LinhaFicha, ListaFicha } from "../componentes/ListaFicha"
import { ROTULO_PERMISSAO, rotuloTipoDependente } from "../dominio/familia"
import { mesAnoCurto } from "../dominio/meta"
import { diaDeInstante } from "../utils/dateTime"
import { Alerta, idade, papeisDe, useFamilia } from "./FamiliaPecas"
import styles from "./Familia.module.css"

export default function FamiliaMembros() {
  const { id = "" } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const meuId = usuario?.id ?? ""
  const [versao, setVersao] = useState(0)
  const { detalhe, erro } = useFamilia(id, versao)
  const [dependentes, setDependentes] = useState<Dependente[] | null>(null)

  useEffect(() => {
    let vivo = true
    getDependentes(id).then((d) => { if (vivo) setDependentes(d) }).catch(() => { if (vivo) setDependentes([]) })
    return () => { vivo = false }
  }, [id, versao])

  if (erro) return <div className={styles.pagina}><Alerta erro={erro} /></div>
  if (!detalhe) return <div className={styles.pagina}><Bloco><Esqueleto linhas={5} altura={16} /></Bloco></div>

  const { admin, podeAgir } = papeisDe(detalhe, meuId)
  const aqui = `/familias/${detalhe.id}/membros`
  // Você primeiro, depois os responsáveis, os adultos e quem só vê.
  const membros = [...detalhe.membros].sort((a, b) =>
    Number(b.usuarioId === meuId) - Number(a.usuarioId === meuId) || a.papelPermissao - b.papelPermissao || a.nomeUsuario.localeCompare(b.nomeUsuario))

  return (
    <div className={styles.pagina}>
      <Bloco semRespiro>
        {(admin || podeAgir) && (
          <div className={styles.membrosTopo}>
            {admin && <Botao variante="primario" onClick={() => navigate(`/familias/${detalhe.id}/convidar`)} icone={<UserPlus size={15} strokeWidth={2.25} aria-hidden="true" />}>Convidar</Botao>}
            {podeAgir && <Botao onClick={() => navigate(`/familias/${detalhe.id}/dependentes/novo`)} icone={<UserRoundPlus size={15} strokeWidth={2.25} aria-hidden="true" />}>Adicionar alguém sem conta</Botao>}
          </div>
        )}
        <ListaFicha rotulo="Membros">
          <GrupoFicha rotulo="Na casa">
            {membros.map((m) => (
              <LinhaFicha key={m.id} para={`${aqui}/${m.id}`}
                marca={<InicialFicha texto={m.nomeUsuario} destaque={m.usuarioId === meuId} foto={urlFoto(m.usuarioId, m.fotoEm)} />}
                titulo={<>{m.nomeUsuario}{m.usuarioId === meuId && <span className={styles.voce}> você</span>}</>}
                detalhe={`${m.papel} · desde ${diaDeInstante(m.entrouEm)}`}
                direita={<Etiqueta>{ROTULO_PERMISSAO[m.papelPermissao]}</Etiqueta>} />
            ))}
            {dependentes === null ? <li className={styles.respiro}><Esqueleto linhas={1} altura={18} /></li>
              : dependentes.map((d) => {
                const anos = d.dataNascimento ? idade(d.dataNascimento) : null
                return (
                  <LinhaFicha key={d.id} para={`/familias/${detalhe.id}/dependentes/${d.id}`}
                    marca={<InicialFicha texto={d.nome} />} titulo={d.apelido ? `${d.nome} (${d.apelido})` : d.nome}
                    detalhe={anos !== null ? `${rotuloTipoDependente(d.tipo)} · ${anos} ${anos === 1 ? "ano" : "anos"}` : rotuloTipoDependente(d.tipo)}
                    direita={<Etiqueta>Sem conta</Etiqueta>} />
                )
              })}
          </GrupoFicha>
          {detalhe.convitesPendentes.length > 0 && (
            <GrupoFicha rotulo="Convites">
              {detalhe.convitesPendentes.map((c) => <ConviteLinha key={c.id} c={c} familiaId={detalhe.id} admin={admin} aoMudar={() => setVersao((v) => v + 1)} />)}
            </GrupoFicha>
          )}
          {/* Quem saiu continua no histórico (as despesas que dividiu seguem no equilíbrio dos meses em que estava). */}
          {(detalhe.quemSaiu?.length ?? 0) > 0 && (
            <GrupoFicha rotulo="Saíram">
              {detalhe.quemSaiu!.map((m) => (
                <LinhaFicha key={m.usuarioId} apagado marca={<InicialFicha texto={m.nome} />} titulo={m.nome}
                  detalhe={m.saiuEm ? `saiu em ${mesAnoCurto(m.saiuEm)}` : "saiu"} />
              ))}
            </GrupoFicha>
          )}
        </ListaFicha>
      </Bloco>
    </div>
  )
}

/** Convite que ainda não foi aceito: quem foi convidado, como, até quando; quem administra cancela na linha. */
function ConviteLinha({ c, familiaId, admin, aoMudar }: { c: ConviteFamilia; familiaId: string; admin: boolean; aoMudar: () => void }) {
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const cancelar = async () => {
    setOcupado(true); setErro(null)
    try { await revogarConvite(familiaId, c.id); aoMudar() } catch (e) { setErro(mensagemDeErro(e)); setOcupado(false) }
  }
  return (
    <>
      <LinhaFicha apagado marca={<InicialFicha texto={c.emailConvidado} />} titulo={c.emailConvidado}
        detalhe={`${c.papel} · ${ROTULO_PERMISSAO[c.papelPermissao]} · vale até ${diaDeInstante(c.expiraEm)}`}
        direita={<Etiqueta tom="alerta">Aguardando</Etiqueta>}
        acao={admin ? <Botao variante="texto" perigo disabled={ocupado} onClick={cancelar}>Cancelar convite</Botao> : undefined} />
      {erro && <li><Alerta erro={erro} /></li>}
    </>
  )
}
