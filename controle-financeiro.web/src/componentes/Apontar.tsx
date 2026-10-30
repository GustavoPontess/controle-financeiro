// Selo "Beta" (solicitações): a pessoa conta o que está errado ou o que podia melhorar (título + descrição) e, se
// quiser, anexa até 5 imagens da tela: o PRINT do que está vendo ou um BLOCO apontado (a foto só daquele bloco). Fechar
// o formulário (×, Esc, clique fora) recolhe ele pra barra no pé com o rascunho: a pessoa navega, anexa de outras telas
// e abre de novo sem perder nada ("Descartar" é que joga fora). Tocar numa miniatura abre a imagem grande.
// Apontar: no computador, passar o mouse destaca o bloco (com o nome) e o clique escolhe; no celular (sem mouse), o 1º
// toque marca e "É este" confirma. Enquanto aponta, nenhum clique do app vale. Esc ou "Cancelar" volta pra onde estava.
// Valores: Esconder (padrão) liga o olho só durante a foto e o texto do bloco vai mascarado (aqui e no servidor);
// Mostrar manda os números (erro de soma, valor errado). A escolha vale pra cada anexo na hora em que ele é tirado.
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import { toJpeg } from "html-to-image"
import { useLocation } from "react-router-dom"
import { Camera, CornerDownLeft, MessageCircleMore, MousePointerClick, Plus, X } from "lucide-react"
import Dialogo from "./Dialogo"
import Campo from "./Campo"
import AreaTexto from "./AreaTexto"
import Entrada from "./Entrada"
import Segmentos from "./Segmentos"
import Botao from "./Botao"
import VerAnexos from "./VerAnexos"
import Menu from "./Menu"
import Interruptor from "./Interruptor"
import { isBalanceHidden, setHideBalance } from "../estado/ocultar"
import {
  MAXIMO_DE_ANEXOS, abrirSolicitacao, adicionarAnexo, descartarRascunho, editarRascunho, iniciarApontar, lerRascunho,
  pararApontar, recolherFormulario, removerAnexo, useRascunho, type AnexoRascunho,
} from "../estado/apontar"
import { enviarSolicitacao } from "../services/solicitacaoService"
import { mensagemDeErro } from "../api/cliente"
import type { TipoSolicitacao } from "../types/Solicitacao"
import styles from "./Apontar.module.css"

const BLOCOS = "[data-bloco], section, form, nav, header, aside"
const MAX_TITULO = 100
const MAX_DESCRICAO = 2000
const ALTURA_MAXIMA = 4000
const SEM_IMAGEM = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"

/** Esconde valores: "R$ 1.234,56" e números com 5+ caracteres (conta, cartão, documento, data). */
export function mascarar(texto: string): string {
  return texto.replace(/R\$\s*-?\s*[\d.,]+/g, "R$ ••••").replace(/\d[\d.,\-/]{3,}\d/g, "••••")
}

const doisQuadros = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
const novoId = () => Math.random().toString(36).slice(2)
const rotuloDaTela = () => document.querySelector("header h1")?.textContent?.trim() || "Tela"

/** Foto de um pedaço da tela. `soVisivel`: só o que está dentro da janela (o print); senão o elemento inteiro (o bloco).
 *  Com `esconder`, liga o olho só durante a foto. Os gráficos (SVG) pintam pelo CSS e a foto não leva essas cores:
 *  copia a cor calculada pro elemento. Imagem de outro site não pode ser copiada e derruba a foto: vira uma vazia.
 *  Tudo volta como estava no fim. */
async function fotografar(alvo: HTMLElement, soVisivel: boolean, esconder: boolean): Promise<string> {
  const antes = isBalanceHidden()
  if (antes !== esconder) { setHideBalance(esconder); await doisQuadros() }
  const pintados: [SVGElement, string | null][] = []
  alvo.querySelectorAll<SVGElement>("svg *").forEach((el) => {
    const cs = getComputedStyle(el)
    pintados.push([el, el.getAttribute("style")])
    el.style.fill = cs.fill; el.style.stroke = cs.stroke; el.style.opacity = cs.opacity
    el.style.fontSize = cs.fontSize; el.style.fontWeight = cs.fontWeight
  })
  const deFora: [HTMLImageElement, string, string][] = []
  alvo.querySelectorAll("img").forEach((img) => {
    const src = img.currentSrc || img.src
    if (!src || src.startsWith("data:") || src.startsWith("blob:") || new URL(src, location.href).origin === location.origin) return
    deFora.push([img, img.getAttribute("src") ?? "", img.getAttribute("srcset") ?? ""])
    img.removeAttribute("srcset"); img.src = SEM_IMAGEM
  })
  try {
    const caixa = alvo.getBoundingClientRect()
    const deslocamento = soVisivel ? Math.max(0, -caixa.top) : 0
    const altura = soVisivel
      ? Math.min(window.innerHeight - Math.max(0, caixa.top), caixa.height - deslocamento, ALTURA_MAXIMA)
      : Math.min(caixa.height, ALTURA_MAXIMA)
    return await toJpeg(alvo, {
      quality: 0.82, pixelRatio: 1, skipFonts: true, cacheBust: false,
      height: Math.max(1, Math.round(altura)),
      style: deslocamento ? { transform: `translateY(-${Math.round(deslocamento)}px)` } : undefined,
      backgroundColor: getComputedStyle(document.body).backgroundColor,
      filter: (n) => !(n instanceof Element && n.closest("[data-apontar-ui]")),
    })
  } finally {
    pintados.forEach(([el, estilo]) => { if (estilo === null) el.removeAttribute("style"); else el.setAttribute("style", estilo) })
    deFora.forEach(([img, src, srcset]) => { img.setAttribute("src", src); if (srcset) img.setAttribute("srcset", srcset) })
    if (antes !== esconder) setHideBalance(antes)
  }
}

function nomeDoBloco(el: Element): string {
  const proprio = (el as HTMLElement).dataset?.bloco
  if (proprio) return proprio
  const titulo = el.querySelector("h1, h2, h3")?.textContent?.trim()
  if (titulo) return titulo.slice(0, 120)
  const rotulo = el.getAttribute("aria-label")
  if (rotulo) return rotulo.slice(0, 120)
  const tag = el.tagName.toLowerCase()
  if (tag === "nav" || tag === "aside") return "Menu"
  if (tag === "header") return "Topo"
  return rotuloDaTela().slice(0, 120)
}

function blocoDe(alvo: EventTarget | null): Element | null {
  if (!(alvo instanceof Element) || alvo.closest("[data-apontar-ui]")) return null
  return alvo.closest(BLOCOS) ?? alvo.closest("main")
}

export default function Apontar() {
  const r = useRascunho()
  const { pathname } = useLocation()
  const [hover, setHover] = useState<Element | null>(null)
  const [tocado, setTocado] = useState<Element | null>(null) // celular: marcado, falta "É este"
  const [tirando, setTirando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erroTitulo, setErroTitulo] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [vendo, setVendo] = useState<number | null>(null)
  const [, redesenhar] = useState(0)
  const toque = useRef(false)
  const cheio = r.anexos.length >= MAXIMO_DE_ANEXOS

  const fechar = useCallback(() => {
    descartarRascunho(); setHover(null); setTocado(null); setEnviado(false); setErroTitulo(null); setErro(null); setVendo(null)
  }, [])
  // ×, Esc e clique fora: recolhe pra barra (enviado, fecha de vez).
  // ×, Esc e clique fora: sem nada escrito nem anexado, fecha; com algo, pergunta (descartar, navegar e anexar depois, ou
  // continuar escrevendo). Depois de enviar, fecha de vez.
  const [perguntando, setPerguntando] = useState(false)
  const temAlgo = !!(r.titulo.trim() || r.descricao.trim() || r.anexos.length)
  const pedirFechar = useCallback(() => {
    if (enviado || !temAlgo) fechar()
    else setPerguntando((v) => !v) // Esc de novo na pergunta volta pro formulário
  }, [enviado, temAlgo, fechar])
  useEffect(() => { if (!r.formulario) setPerguntando(false) }, [r.formulario])
  const sairDoApontar = useCallback(() => { setHover(null); setTocado(null); pararApontar() }, [])

  /** Anexa o bloco escolhido: foto só dele + o nome e o texto. */
  const anexarBloco = useCallback(async (el: Element) => {
    const { mostrarValores } = lerRascunho()
    const bruto = ((el as HTMLElement).innerText ?? el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 500)
    const nome = nomeDoBloco(el)
    setHover(null); setTocado(null)
    setTirando(true)
    try {
      const imagem = await fotografar(el as HTMLElement, false, !mostrarValores)
      adicionarAnexo({
        id: novoId(), tipo: 2, tela: location.pathname, rotuloTela: rotuloDaTela(), bloco: nome,
        textoDoBloco: (mostrarValores ? bruto : mascarar(bruto)) || null, mostrarValores, imagem,
      })
    } catch {
      setErro("Não deu pra fotografar esse bloco.")
    } finally {
      setTirando(false)
      pararApontar()
    }
  }, [])

  /** Anexa o print do que a pessoa está vendo. */
  const anexarPrint = useCallback(async () => {
    const alvo = document.querySelector("main") as HTMLElement | null
    if (!alvo || lerRascunho().anexos.length >= MAXIMO_DE_ANEXOS) return
    const { mostrarValores } = lerRascunho()
    setTirando(true); setErro(null)
    try {
      const imagem = await fotografar(alvo, true, !mostrarValores)
      adicionarAnexo({ id: novoId(), tipo: 1, tela: location.pathname, rotuloTela: rotuloDaTela(), bloco: null, textoDoBloco: null, mostrarValores, imagem })
    } catch {
      setErro("Não deu pra tirar o print desta tela.")
    } finally {
      setTirando(false)
    }
  }, [])

  // Enquanto aponta: o mouse destaca, o clique escolhe (e não chega no app), Esc volta.
  useEffect(() => {
    if (!r.apontando) return
    const mover = (e: PointerEvent) => {
      toque.current = e.pointerType === "touch"
      if (!toque.current && !tocado) setHover(blocoDe(e.target))
    }
    const descer = (e: PointerEvent) => { toque.current = e.pointerType === "touch" }
    const clicar = (e: MouseEvent) => {
      const bloco = blocoDe(e.target)
      if (!bloco) return // clique na própria faixa/barra: deixa passar
      e.preventDefault(); e.stopPropagation()
      if (toque.current) { setTocado(bloco); setHover(bloco) }
      else void anexarBloco(bloco)
    }
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") sairDoApontar() }
    const rolar = () => redesenhar((n) => n + 1)
    document.addEventListener("pointermove", mover, true)
    document.addEventListener("pointerdown", descer, true)
    document.addEventListener("click", clicar, true)
    document.addEventListener("keydown", tecla)
    window.addEventListener("scroll", rolar, true)
    window.addEventListener("resize", rolar)
    document.body.dataset.apontando = ""
    return () => {
      document.removeEventListener("pointermove", mover, true)
      document.removeEventListener("pointerdown", descer, true)
      document.removeEventListener("click", clicar, true)
      document.removeEventListener("keydown", tecla)
      window.removeEventListener("scroll", rolar, true)
      window.removeEventListener("resize", rolar)
      delete document.body.dataset.apontando
    }
  }, [r.apontando, tocado, anexarBloco, sairDoApontar])

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    const t = r.titulo.trim()
    if (!t) { setErroTitulo("Dê um título"); return }
    setEnviando(true); setErro(null)
    try {
      await enviarSolicitacao({
        tipo: r.tipo, titulo: t, descricao: r.descricao.trim() || null, tela: pathname,
        janela: `${window.innerWidth}x${window.innerHeight}`,
        anexos: r.anexos.map((a) => ({
          tipo: a.tipo, tela: a.tela, bloco: a.bloco, textoDoBloco: a.textoDoBloco, mostrarValores: a.mostrarValores, imagemBase64: a.imagem,
        })),
      })
      setEnviado(true)
    } catch (err) {
      setErro(mensagemDeErro(err))
    } finally {
      setEnviando(false)
    }
  }

  const realce = r.apontando ? (tocado ?? hover) : null
  const caixa = realce?.getBoundingClientRect()
  const celular = typeof window !== "undefined" && window.matchMedia?.("(hover: none)").matches
  const quantos = r.anexos.length === 1 ? "1 anexo" : `${r.anexos.length} anexos`

  return (
    <>
      {r.apontando && (
        <div className={styles.faixa} data-apontar-ui role="status">
          <MousePointerClick size={16} strokeWidth={2} aria-hidden="true" />
          <span className={styles.faixaTexto}>{celular ? "Toque" : "Clique"} no que está errado ou no que podia melhorar</span>
          <Botao variante="texto" onClick={sairDoApontar}>Cancelar</Botao>
        </div>
      )}
      {caixa && realce && (
        <div className={styles.realce} aria-hidden="true"
          style={{ top: caixa.top - 4, left: caixa.left - 4, width: caixa.width + 8, height: caixa.height + 8 }}>
          <span className={styles.realceNome}>{nomeDoBloco(realce)}</span>
        </div>
      )}
      {r.apontando && tocado && (
        <div className={styles.confirmar} data-apontar-ui>
          <Botao cheio onClick={() => { setTocado(null); setHover(null) }}>Outro</Botao>
          <Botao cheio variante="primario" onClick={() => void anexarBloco(tocado)}>É este</Botao>
        </div>
      )}

      {/* Navegando com o rascunho: barra no pé pra anexar desta tela e voltar pro formulário. */}
      {r.navegando && !r.apontando && (
        <div className={styles.barra} data-apontar-ui role="region" aria-label="Solicitação em andamento">
          <MessageCircleMore size={16} strokeWidth={2} aria-hidden="true" />
          <span className={styles.barraTexto}>{tirando ? "Tirando o print..." : `Solicitação · ${quantos}`}</span>
          <button type="button" className={styles.barraBotao} disabled={cheio || tirando} onClick={() => void anexarPrint()}>Print</button>
          <button type="button" className={styles.barraBotao} disabled={cheio || tirando} onClick={iniciarApontar}>Apontar</button>
          <button type="button" className={styles.barraVoltar} onClick={abrirSolicitacao}>Abrir</button>
          <button type="button" className={styles.barraDescartar} aria-label="Descartar a solicitação" title="Descartar" onClick={fechar}>
            <X size={16} strokeWidth={2.25} aria-hidden="true" />
          </button>
        </div>
      )}

      <Dialogo aberto={r.formulario} titulo={enviado ? "Recebida" : r.tipo === 1 ? "Contar um problema" : "Sugerir uma melhoria"} onFechar={pedirFechar} travado={enviando} folhaNoCelular comX>
        {perguntando && !enviado ? (
          <div className={styles.corpo}>
            <p className={styles.pronto}>O que fazer com o que você escreveu?</p>
            <div className={styles.escolhas}>
              <Botao cheio variante="primario" onClick={() => { setPerguntando(false); recolherFormulario() }}>Navegar e anexar depois</Botao>
              <Botao cheio onClick={() => setPerguntando(false)}>Continuar escrevendo</Botao>
              <Botao cheio perigo variante="texto" onClick={fechar}>Descartar</Botao>
            </div>
          </div>
        ) : enviado ? (
          <div className={styles.corpo}>
            <p className={styles.pronto}>Obrigado. A gente lê tudo que chega por aqui.</p>
            <div className={styles.botoes}>
              <Botao variante="primario" onClick={fechar}>Fechar</Botao>
            </div>
          </div>
        ) : (
          <form className={styles.corpo} onSubmit={enviar} noValidate>
            {erro && <p className={styles.erro} role="alert">{erro}</p>}
            <Segmentos ariaLabel="O que é" cheio valor={String(r.tipo)} onChange={(v) => editarRascunho({ tipo: Number(v) as TipoSolicitacao })}
              opcoes={[{ valor: "1", rotulo: "Algo errado" }, { valor: "2", rotulo: "Melhoria" }]} />
            <Campo rotulo="Título" erro={erroTitulo}>
              <Entrada value={r.titulo} maxLength={MAX_TITULO} autoComplete="off" data-autofoco
                placeholder={r.tipo === 1 ? "Os outros meses somem no gráfico" : "Fatura no topo da Visão geral"}
                onChange={(e) => { editarRascunho({ titulo: e.target.value }); setErroTitulo(null) }} />
            </Campo>
            <Campo rotulo={r.tipo === 1 ? "O que aconteceu? (opcional)" : "Conte mais (opcional)"}>
              {/* Como campo de chat: "+" à esquerda (Print da tela / Apontar um bloco) e ↵ à direita (enviar), os dois no pé da
                  caixa, descendo junto com o texto (a caixa começa baixa e cresce). */}
              <div className={styles.caixaTexto}>
                <AreaTexto value={r.descricao} maxLength={MAX_DESCRICAO} rows={1} comAcoes cresce
                  placeholder={r.tipo === 1 ? "O que você fez e o que apareceu" : "Como ajudaria no seu dia a dia"}
                  onChange={(e) => editarRascunho({ descricao: e.target.value })} />
                <div className={styles.mais}>
                  {tirando ? <span className={styles.tirando} aria-live="polite">...</span> : !cheio && (
                    <Menu ariaLabel="Anexar da tela" aEsquerda acima classeGatilho={styles.maisBotao}
                      gatilho={<Plus size={18} strokeWidth={2.25} aria-hidden="true" />}
                      itens={[
                        { rotulo: "Print da tela", icone: <Camera size={16} strokeWidth={2} aria-hidden="true" />, onClick: () => void anexarPrint() },
                        { rotulo: "Apontar um bloco", icone: <MousePointerClick size={16} strokeWidth={2} aria-hidden="true" />, onClick: iniciarApontar },
                      ]} />
                  )}
                </div>
                <button type="submit" className={styles.enviarBotao} aria-label="Enviar" title="Enviar" disabled={enviando || tirando}>
                  <CornerDownLeft size={18} strokeWidth={2.25} aria-hidden="true" />
                </button>
              </div>
            </Campo>
            {r.anexos.length > 0 && (
              <ul className={styles.anexos} aria-label="Anexos">
                {r.anexos.map((a, i) => <Miniatura key={a.id} a={a} aoVer={() => setVendo(i)} />)}
              </ul>
            )}
            {r.anexos.length > 0 && (
              <Interruptor ligado={r.mostrarValores} onChange={(v) => editarRascunho({ mostrarValores: v })}>
                Mostrar meus valores nos anexos
              </Interruptor>
            )}
            {r.anexos.length > 0 && r.mostrarValores && <p className={styles.aviso}>Os próximos anexos vão com os seus valores. Só a equipe do Pontes vê.</p>}
            {enviando && <p className={styles.enviando} role="status">Enviando...</p>}
          </form>
        )}
      </Dialogo>
      {vendo !== null && r.anexos[vendo] && (
        <VerAnexos indice={vendo} aoMudar={setVendo} aoFechar={() => setVendo(null)}
          anexos={r.anexos.map((a) => ({ url: a.imagem, nome: nomeDoAnexo(a), texto: a.textoDoBloco, mostrarValores: a.mostrarValores }))} />
      )}
    </>
  )
}

const nomeDoAnexo = (a: AnexoRascunho) => (a.tipo === 1 ? `Print de ${a.rotuloTela}` : `${a.bloco ?? "Bloco"} (${a.rotuloTela})`)

function Miniatura({ a, aoVer }: { a: AnexoRascunho; aoVer: () => void }) {
  const nome = nomeDoAnexo(a)
  return (
    <li className={styles.miniatura} title={nome}>
      <button type="button" className={styles.ver} aria-label={`Ver ${nome}`} onClick={aoVer}>
        <img src={a.imagem} alt={nome} />
      </button>
      <span className={styles.miniaturaRotulo}>{a.tipo === 1 ? a.rotuloTela : a.bloco}</span>
      <button type="button" className={styles.remover} aria-label={`Tirar ${nome}`} onClick={() => removerAnexo(a.id)}>
        <X size={12} strokeWidth={2.5} aria-hidden="true" />
      </button>
    </li>
  )
}
