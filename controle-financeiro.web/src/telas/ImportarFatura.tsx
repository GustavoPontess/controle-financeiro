// Importar a fatura do cartão (docs/features/cartao-credito/fatura-a-detalhar.md, passo 3; Gustavo 2026-11-22: "eu
// jogo os extratos aqui, ele já se vira"). Entra no lado direito do Importar quando a pessoa escolhe um cartão na
// lista do começo (a mesma moldura do extrato da conta). Escolher os arquivos já lê; a leitura diz o que vai entrar
// (compras, parcelamentos, como cada fatura fica) e o Importar grava tudo numa transação só. O que ficar sem categoria
// vai pra fila de Pendentes, como no extrato.
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { CheckCircle2 } from "lucide-react"
import { previewFatura, confirmarFatura } from "../services/importacaoService"
import { mensagemDeErro } from "../api/cliente"
import { recarregarPendentes } from "../estado/pendentes"
import type { CartaoCredito } from "../types/CartaoCredito"
import type { PreviewFatura, ResultadoFatura } from "../types/Importacao"
import Bloco from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import Etiqueta from "../componentes/Etiqueta"
import LogoMarca from "../componentes/LogoMarca"
import SoltarArquivos from "../componentes/SoltarArquivos"
import { Dinheiro } from "../componentes/Dinheiro"
import { RodapeFormulario } from "../componentes/Formulario"
import { GrupoFicha, LinhaFicha, ListaFicha } from "../componentes/ListaFicha"
import { marcaDoCartao } from "../dominio/conta"
import styles from "./ImportarExtrato.module.css"

const TAMANHO_MAX = 2 * 1024 * 1024
const MAX_ARQUIVOS = 48
const dataBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

const SITUACAO = {
  "paga-pela-conta": { texto: "Paga pela conta", tom: "positivo" },
  paga: { texto: "Paga", tom: undefined },
  "a-pagar": { texto: "A pagar", tom: "alerta" },
} as const

export default function ImportarFatura({ cartao }: { cartao: CartaoCredito }) {
  const navigate = useNavigate()
  const [arquivos, setArquivos] = useState<File[]>([])
  const [previa, setPrevia] = useState<PreviewFatura | null>(null)
  const [resultado, setResultado] = useState<ResultadoFatura | null>(null)
  const [erroArquivo, setErroArquivo] = useState<string>()
  const [erro, setErro] = useState<string | null>(null)
  const [lendo, setLendo] = useState(false)
  const [importando, setImportando] = useState(false)
  // A chave nasce com a leitura: clique duplo ou rede que caiu não importa duas vezes.
  const [chave, setChave] = useState(() => crypto.randomUUID())

  const ler = async (novos: File[]) => {
    const lista = [...arquivos, ...novos.filter((n) => !arquivos.some((a) => a.name === n.name))]
    const fora = lista.find((a) => !/\.(ofx|csv)$/i.test(a.name))
    const grande = lista.find((a) => a.size > TAMANHO_MAX)
    const e = lista.length > MAX_ARQUIVOS ? `Escolha até ${MAX_ARQUIVOS} arquivos`
      : fora ? `${fora.name} não é .ofx nem .csv`
      : grande ? `${grande.name} passa de 2 MB`
      : lista.every((a) => a.size === 0) ? "O arquivo está vazio" : undefined
    setErroArquivo(e)
    if (e) return
    setErro(null); setResultado(null); setLendo(true)
    try {
      const p = await previewFatura(cartao.id, lista)
      setArquivos(lista); setPrevia(p); setChave(crypto.randomUUID())
    } catch (err) {
      setErro(mensagemDeErro(err))
    } finally {
      setLendo(false)
    }
  }

  const importar = async () => {
    setErro(null); setImportando(true)
    try {
      const r = await confirmarFatura(cartao.id, arquivos, chave)
      setResultado(r); setPrevia(null); setArquivos([])
      recarregarPendentes()
    } catch (err) {
      setErro(mensagemDeErro(err))
    } finally {
      setImportando(false)
    }
  }

  const recusados = previa?.arquivos.filter((a) => a.erro) ?? []
  const nada = !!previa && previa.compras === 0 && previa.parcelamentos === 0

  return (
    <Bloco>
      <div className={styles.comecoMiolo}>
        {erro && <p className={styles.alerta} role="alert">{erro}</p>}
        {resultado && (
          <div className={styles.resumoTopo}>
            <div className={styles.importadoTitulo}>
              <span className={styles.prontoIcone} data-repetido={resultado.repetido || undefined} aria-hidden="true"><CheckCircle2 size={26} strokeWidth={2} /></span>
              <div className={styles.resumoTitulo}>
                <h2>{resultado.repetido ? "Essa fatura já tinha sido importada"
                  : plural(resultado.compras + resultado.parcelamentos, "compra importada", "compras importadas")}</h2>
                <span className={styles.mudo}>
                  {resultado.repetido ? "Nada foi gravado de novo." : [
                    resultado.parcelamentos > 0 && plural(resultado.parcelamentos, "parcelada", "parceladas"),
                    resultado.pagamentosLigados > 0 && plural(resultado.pagamentosLigados, "pagamento da conta ligado à fatura", "pagamentos da conta ligados às faturas"),
                    resultado.jaNoApp > 0 && `${resultado.jaNoApp} já no app`,
                  ].filter(Boolean).join(" · ")}
                </span>
              </div>
            </div>
            <div className={styles.resumoAcoes}>
              <Botao variante={resultado.semCategoria > 0 ? "secundario" : "primario"} onClick={() => navigate("/cartoes")}>Ver fatura</Botao>
              {resultado.semCategoria > 0 && (
                <Botao variante="primario" onClick={() => navigate("/pendentes")}>
                  {`Resolver ${plural(resultado.semCategoria, "pendente", "pendentes")}`}</Botao>
              )}
            </div>
          </div>
        )}
        <div className={styles.comecoTopo}>
          <LogoMarca {...marcaDoCartao(cartao)} tamanho={48} />
          <div className={styles.comecoNome}>
            <h2 className={styles.confirmarTitulo}>{cartao.nome}</h2>
            <span className={styles.mudo}>Fatura do cartão</span>
          </div>
        </div>
        <Campo rotulo="Arquivos da fatura" erro={erroArquivo} grupo>
          <SoltarArquivos aceita=".ofx,.csv" varios ariaLabel="Arquivo da fatura" invalido={!!erroArquivo} desabilitado={lendo || importando}
            convite={arquivos.length > 0 ? "Escolher mais arquivos" : "Escolher arquivos"}
            titulo={lendo ? "Lendo…" : arquivos.length > 0 ? "Arraste mais faturas pra cá" : "Arraste a fatura do banco pra cá"}
            detalhe="OFX ou CSV, um mês ou vários de uma vez" onChange={(a) => { void ler(a) }} />
        </Campo>
        {previa && (
          <>
            <div className={styles.resumoNumeros}>
              <div><span>Compras</span><Dinheiro valor={previa.valorCompras} className={styles.resumoValor} /></div>
              <div><span>À vista</span><span className={styles.resumoValor}>{previa.compras}</span></div>
              <div><span>Parceladas</span><span className={styles.resumoValor}>{previa.parcelamentos}</span></div>
              {previa.jaNoApp > 0 && <div><span>Já no app</span><span className={styles.resumoValor}>{previa.jaNoApp}</span></div>}
            </div>
            {previa.faturas.length > 0 && (
              <ListaFicha rotulo="Faturas">
                <GrupoFicha rotulo="Faturas">
                  {previa.faturas.map((f) => (
                    <LinhaFicha key={f.vencimento} titulo={`Vence ${dataBR(f.vencimento)}`}
                      detalhe={plural(f.lancamentos, "lançamento", "lançamentos")}
                      direita={<><Dinheiro valor={f.compras} /> <Etiqueta tom={SITUACAO[f.situacao].tom}>{SITUACAO[f.situacao].texto}</Etiqueta></>} />
                  ))}
                </GrupoFicha>
              </ListaFicha>
            )}
            {(previa.pagamentos > 0 || previa.creditos > 0) && (
              <p className={styles.importadoNota}>
                {[previa.pagamentos > 0 && `${plural(previa.pagamentos, "pagamento da fatura fica", "pagamentos da fatura ficam")} de fora (já saíram da conta)`,
                  previa.creditos > 0 && `${plural(previa.creditos, "estorno fica", "estornos ficam")} de fora por enquanto`].filter(Boolean).join("; ")}.
              </p>
            )}
            {recusados.map((a) => <p key={a.nome} className={styles.importadoNota} data-falha>{a.nome}: {a.erro}</p>)}
            <RodapeFormulario>
              <Botao onClick={() => { setPrevia(null); setArquivos([]) }} disabled={importando}>Trocar arquivos</Botao>
              <Botao variante="primario" disabled={importando || nada} onClick={() => { void importar() }}>
                {importando ? "Importando…" : nada ? "Nada novo pra importar" : "Importar"}</Botao>
            </RodapeFormulario>
          </>
        )}
      </div>
    </Bloco>
  )
}
