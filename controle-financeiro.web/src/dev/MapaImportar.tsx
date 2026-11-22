// Mapa do Importar (só dev, /dev/mapa-importar): cada tela do Importar extrato AO VIVO (a tela de verdade, no estado
// de exemplo do painel de dev), lado a lado, com uma etiqueta em cada botão dizendo o que ele muda e uma seta até a
// tela pra onde ele manda. Serve pra enxergar o caminho inteiro antes de mexer nele.
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from "react"
import styles from "./MapaImportar.module.css"

const ESCALA = 0.5
const LARGURA = 1360
const ALTURA_MIN = 640
const ALTURA_MAX = 1700

type Marca = { acha: (d: Document) => Element | null | undefined; texto: string; para?: string[]; lado?: "cima" | "baixo" }
type Tela = { id: string; estado: string; titulo: string; coluna: number; marcas: Marca[]; numero: string }

const CLICAVEIS = "main button, main a, main select, main [role=combobox]"
const rotulo = (re: RegExp) => (d: Document) =>
  Array.from(d.querySelectorAll(CLICAVEIS)).find((el) => re.test(el.getAttribute("aria-label") ?? "") || re.test((el.textContent ?? "").trim()))
const soltar = (d: Document) => d.querySelector('input[aria-label="Arquivo do extrato"]')?.closest("[role=button]")

// O caminho (decisões do Gustavo, 2026-11-22): UMA moldura em todas as telas (faixa em cima, lista à esquerda,
// conteúdo à direita). Ler cai na FILA, onde o lançamento aparece com os MESMOS campos de Nova transação; os números e
// o Importar ficam na faixa (não existe tela de resumo); importou, volta pro começo com a faixa dizendo o que entrou e
// o atalho pro que ficou sem categoria. Nada abre em cima da tela: as colunas entram no lugar da fila e "Trocar conta
// ou arquivos" é um passo atrás.
const TELAS: Tela[] = [
  { id: "comeco", numero: "1", estado: "inicio", titulo: "Começo: só a conta", coluna: 0, marcas: [
    { acha: (d) => d.querySelector('[aria-label="Contas"] button'), texto: "Escolher a conta abre a área do arquivo ao lado (a lista desliza pra esquerda)", para: ["arquivo"] },
  ] },
  { id: "arquivo", numero: "1b", estado: "conta", titulo: "A mesma tela, com a conta escolhida", coluna: 0, marcas: [
    { acha: (d) => d.querySelector('[aria-label="Contas"] button[aria-current]'), texto: "Dá pra trocar de conta aqui" },
    { acha: soltar, texto: "Escolher o arquivo já lê e cai na fila", para: ["fila", "colunas"] },
  ] },
  { id: "colunas", numero: "1c", estado: "colunas-nao-reconhecidas", titulo: "Só se o app não reconhecer o CSV", coluna: 0, marcas: [
    { acha: rotulo(/^O que é a coluna Dia$/), texto: "Diz o que é cada coluna; o exemplo embaixo muda na hora" },
    { acha: rotulo(/^Continuar$/), texto: "Lê com essas colunas e cai na fila", para: ["fila"] },
  ] },
  { id: "fila", numero: "2", estado: "lugares", titulo: "A fila (os campos são os de Nova transação)", coluna: 1, marcas: [
    { acha: rotulo(/^Trocar conta ou arquivos$/), texto: "Volta um passo, pro começo", para: ["trocar"] },
    { acha: rotulo(/^Importar( com)? \d+ (pendentes?|lançamentos?)$/), texto: "Importa direto daqui, mesmo com pendente", para: ["importado"] },
    { acha: (d) => d.querySelector('[aria-label="Lugares"] button'), texto: "A fila: em cima o que falta, embaixo o que já está resolvido" },
    { acha: rotulo(/^Qual é o nome\?$/), texto: "Abre as palavras ali mesmo, sem janela por cima" },
    { acha: (d) => d.querySelector('[aria-label^="Sugestões de categoria"] button'), texto: "Sugestão de categoria num clique (o campo é o mesmo de Nova transação)" },
    { acha: rotulo(/^Pular$/), texto: "Deixa na fila e mostra o próximo" },
    { acha: rotulo(/^Confirmar e próximo$/), texto: "Resolve o lugar e abre o próximo pendente" },
  ] },
  { id: "colunas-abertas", numero: "2b", estado: "colunas-abertas", titulo: "Colunas do arquivo, no lugar da fila (só CSV)", coluna: 2, marcas: [
    { acha: rotulo(/^Voltar pros lançamentos$/), texto: "A fila volta como estava", para: ["fila"] },
    { acha: rotulo(/^O que é a coluna Data$/), texto: "Trocar uma coluna e Ler de novo relê o arquivo" },
  ] },
  { id: "trocar", numero: "2c", estado: "trocar", titulo: "Trocar conta ou arquivos: um passo atrás", coluna: 2, marcas: [
    { acha: soltar, texto: "Somar um arquivo relê na hora" },
    { acha: rotulo(/^Pronto$/), texto: "Volta pra fila, com o que já foi escolhido", para: ["fila"] },
  ] },
  { id: "importado", numero: "3", estado: "importado", titulo: "Importado: volta pro começo, com o aviso em cima", coluna: 3, marcas: [
    { acha: rotulo(/^Resolver \d+ pendentes?$/), texto: "Abre só o que entrou sem categoria, pra resolver (sai do Importar)" },
    { acha: rotulo(/^Ver em Transações$/), texto: "Abre Transações da conta (sai do Importar)" },
    { acha: soltar, texto: "Já dá pra importar outro extrato", para: ["fila"] },
  ] },
]
const NUMERO: Record<string, string> = Object.fromEntries(TELAS.map((t) => [t.id, t.numero]))
const ORDEM = Object.fromEntries(TELAS.map((t, i) => [t.id, i]))
const COLUNAS = [0, 1, 2, 3].map((c) => TELAS.filter((t) => t.coluna === c))
const endereco = (t: Tela) => `/importar#${t.estado}`

type Caixa = { x: number; y: number; l: number; a: number }
type Ponto = { chave: string; caixa: Caixa; texto: string; destinos: string; balao: Caixa; fio: string }
type Seta = { chave: string; d: string }
// Os balões ficam FORA da tela, na margem direita dela, pra não tapar nada: um embaixo do outro, na altura do botão
// de cada um quando cabe, ligados ao botão por um fio.
const BALAO_LARGURA = 240
const BALAO_FOLGA = 16
const alturaDoBalao = (letras: number) => 12 + 17 * Math.max(1, Math.ceil((letras * 6.7) / (BALAO_LARGURA - 20)))
type Desenho = { pontos: Ponto[]; setas: Seta[]; alturas: Record<string, number>; largura: number; altura: number }
const VAZIO: Desenho = { pontos: [], setas: [], alturas: {}, largura: 0, altura: 0 }

export default function MapaImportar() {
  const quadros = useRef<Record<string, HTMLDivElement | null>>({})
  const janelas = useRef<Record<string, HTMLIFrameElement | null>>({})
  const palco = useRef<HTMLDivElement | null>(null)
  const rolagem = useRef<HTMLDivElement | null>(null)
  const [desenho, setDesenho] = useState<Desenho>(VAZIO)
  const [zoom, setZoom] = useState(0)
  // Uma tela por vez: quinze cópias do app abrindo juntas estouram o navegador (e algumas ficam em branco).
  const [abertas, setAbertas] = useState(1)
  const abrirProxima = (ordem: number) => { window.setTimeout(() => setAbertas((n) => Math.max(n, ordem + 2)), 700) }

  // As telas são páginas vivas: mede de tempo em tempo onde cada botão está e redesenha etiquetas e setas.
  useEffect(() => {
    const medir = () => {
      const p0 = palco.current
      if (!p0 || p0.offsetWidth === 0) return
      // Tudo medido pelo que está NA TELA (retângulos de verdade) e trazido pra medida do palco: o palco é aproximado
      // por transform, então a conta é só dividir pela aproximação.
      const base = p0.getBoundingClientRect()
      const s = base.width / p0.offsetWidth
      const noPalco = (r: DOMRect): Caixa => ({ x: (r.left - base.left) / s, y: (r.top - base.top) / s, l: r.width / s, a: r.height / s })
      const alturas: Record<string, number> = {}
      const lugar: Record<string, Caixa> = {}
      for (const t of TELAS) {
        const q = quadros.current[t.id]
        const doc = janelas.current[t.id]?.contentDocument
        if (q) lugar[t.id] = noPalco(q.getBoundingClientRect())
        if (doc?.documentElement) alturas[t.id] = Math.min(ALTURA_MAX, Math.max(ALTURA_MIN, doc.documentElement.scrollHeight))
      }
      const pontos: Ponto[] = []
      const setas: Seta[] = []
      const chegadas: Record<string, number> = {}
      for (const t of TELAS) {
        const doc = janelas.current[t.id]?.contentDocument
        const q = lugar[t.id]
        const janela = janelas.current[t.id]
        if (!doc || !q || !janela) continue
        const j = noPalco(janela.getBoundingClientRect())
        const achadas = t.marcas.flatMap((m, i) => {
          const el = m.acha(doc)
          // O que a tela escondeu (área desligada com `inert`) não ganha balão: não está à vista.
          const r = el && !el.closest("[inert]") ? el.getBoundingClientRect() : null
          if (!r || r.width === 0) return []
          return [{ m, i, caixa: { x: j.x + r.left * ESCALA, y: j.y + r.top * ESCALA, l: r.width * ESCALA, a: r.height * ESCALA } }]
        }).sort((x, y) => x.caixa.y + x.caixa.a / 2 - (y.caixa.y + y.caixa.a / 2))
        let chao = j.y
        for (const { m, i, caixa } of achadas) {
          const destinos = (m.para ?? []).map((p) => NUMERO[p]).join(", ")
          const alto = alturaDoBalao(m.texto.length + (destinos ? destinos.length + 4 : 0))
          const meioY = caixa.y + caixa.a / 2
          const balao = { x: j.x + j.l + BALAO_FOLGA, y: Math.max(chao, meioY - alto / 2), l: BALAO_LARGURA, a: alto }
          chao = balao.y + alto + 8
          const chave = `${t.id}-${i}`
          const by = balao.y + alto / 2
          pontos.push({ chave, caixa, texto: m.texto, destinos, balao, fio: `M ${caixa.x + caixa.l} ${meioY} L ${balao.x} ${by}` })
          for (const p of m.para ?? []) {
            const alvo = lugar[p]
            const destino = TELAS.find((x) => x.id === p)
            if (!alvo || !destino) continue
            const n = (chegadas[p] = (chegadas[p] ?? 0) + 1)
            const sx = balao.x + balao.l
            if (destino.coluna > t.coluna) {
              const tx = alvo.x - 6, ty = alvo.y + 24 + n * 26, meio = Math.max(30, (tx - sx) / 2)
              setas.push({ chave: `${chave}-${p}`, d: `M ${sx} ${by} C ${sx + meio} ${by}, ${tx - meio} ${ty}, ${tx} ${ty}` })
            } else if (destino.coluna === t.coluna && alvo.y > q.y) {
              const sx2 = balao.x + balao.l / 2, tx = alvo.x + alvo.l - 60 * n, ty = alvo.y - 6
              setas.push({ chave: `${chave}-${p}`, d: `M ${sx2} ${balao.y + alto} C ${sx2} ${ty - 30}, ${tx} ${ty - 90}, ${tx} ${ty}` })
            }
          }
        }
      }
      const novo = { pontos, setas, alturas, largura: p0.offsetWidth, altura: p0.offsetHeight }
      setDesenho((v) => (JSON.stringify(v) === JSON.stringify(novo) ? v : novo))
    }
    const id = window.setInterval(medir, 1000)
    return () => window.clearInterval(id)
  }, [])

  // Começa com o mapa inteiro cabendo na largura; os botões aproximam.
  useEffect(() => {
    if (zoom === 0 && rolagem.current && palco.current) setZoom(Math.max(0.1, Math.min(1, (rolagem.current.clientWidth - 4) / palco.current.offsetWidth)))
  }, [zoom, desenho])
  const LIMITES = [0.1, 2] as const
  const mudar = (fator: number) => setZoom((z) => Math.max(LIMITES[0], Math.min(LIMITES[1], Math.round(z * fator * 100) / 100)))

  // Mouse: a roda aproxima e afasta em volta do cursor; segurar e arrastar anda pelo mapa. (As telas ficam sem clique
  // aqui dentro, senão a roda e o arrasto morrem em cima delas; o título de cada uma abre ela de verdade.)
  const zoomAtual = useRef(zoom)
  zoomAtual.current = zoom
  const ancora = useRef<{ x: number; y: number; px: number; py: number } | null>(null)
  useEffect(() => {
    const r = rolagem.current
    if (!r) return
    const roda = (e: WheelEvent) => {
      e.preventDefault()
      const z = zoomAtual.current
      if (!z) return
      const caixa = r.getBoundingClientRect()
      const px = e.clientX - caixa.left, py = e.clientY - caixa.top
      const novo = Math.max(LIMITES[0], Math.min(LIMITES[1], z * Math.exp(-e.deltaY * 0.0015)))
      ancora.current = { x: (r.scrollLeft + px) / z, y: (r.scrollTop + py) / z, px, py }
      setZoom(novo)
    }
    r.addEventListener("wheel", roda, { passive: false })
    return () => r.removeEventListener("wheel", roda)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const r = rolagem.current, a = ancora.current
    if (!r || !a || !zoom) return
    r.scrollLeft = a.x * zoom - a.px
    r.scrollTop = a.y * zoom - a.py
    ancora.current = null
  }, [zoom])
  const arrasto = useRef<{ x: number; y: number; sl: number; st: number } | null>(null)
  const pegar = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("a, button")) return
    const r = e.currentTarget
    arrasto.current = { x: e.clientX, y: e.clientY, sl: r.scrollLeft, st: r.scrollTop }
    r.setPointerCapture(e.pointerId)
    r.dataset.arrastando = "true"
  }
  const andar = (e: PointerEvent<HTMLDivElement>) => {
    const a = arrasto.current
    if (!a) return
    e.currentTarget.scrollLeft = a.sl - (e.clientX - a.x)
    e.currentTarget.scrollTop = a.st - (e.clientY - a.y)
  }
  const soltarMapa = (e: PointerEvent<HTMLDivElement>) => { arrasto.current = null; delete e.currentTarget.dataset.arrastando }

  return (
    <div className={styles.pagina}>
      <div className={styles.barra}>
        <span className={styles.legenda}><i data-tipo="vai" />Leva pra outra tela<i data-tipo="muda" />Muda a própria tela</span>
        <span className={styles.zoom}>
          <button type="button" onClick={() => mudar(1 / 1.25)} aria-label="Afastar">−</button>
          <button type="button" onClick={() => setZoom(0)}>Ver tudo</button>
          <button type="button" onClick={() => mudar(1.25)} aria-label="Aproximar">+</button>
        </span>
      </div>
      <div className={styles.rolagem} ref={rolagem} onPointerDown={pegar} onPointerMove={andar} onPointerUp={soltarMapa} onPointerCancel={soltarMapa}>
        <div style={{ width: desenho.largura * (zoom || 0.2), height: desenho.altura * (zoom || 0.2) }}>
        <div className={styles.palco} ref={palco} style={{ transform: `scale(${zoom || 0.2})` }}>
          <section className={styles.caminho}>
            <div className={styles.linha}>
              {COLUNAS.map((telas, n) => (
                <div key={n} className={styles.coluna}>
                  {telas.map((t) => (
                    <div key={t.id} className={styles.quadro} ref={(el) => { quadros.current[t.id] = el }}>
                      <div className={styles.cabeca}>
                        <a className={styles.titulo} href={endereco(t)} target="_blank" rel="noreferrer"><b>{NUMERO[t.id]}</b>{t.titulo}</a>
                        <button type="button" className={styles.recarregar} aria-label={`Recarregar ${t.titulo}`} title="Recarregar só esta tela"
                          onClick={() => janelas.current[t.id]?.contentWindow?.location.reload()}>↻</button>
                      </div>
                      <div className={styles.moldura} style={{ height: (desenho.alturas[t.id] ?? ALTURA_MIN) * ESCALA }}>
                        <iframe title={t.titulo} src={ORDEM[t.id] < abertas ? endereco(t) : undefined}
                          onLoad={() => { if (ORDEM[t.id] < abertas) abrirProxima(ORDEM[t.id]) }} ref={(el) => { janelas.current[t.id] = el }}
                          style={{ width: LARGURA, height: desenho.alturas[t.id] ?? ALTURA_MIN, transform: `scale(${ESCALA})` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
          <svg className={styles.setas} aria-hidden="true">
            <defs><marker id="ponta" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1L9 5L1 9z" /></marker></defs>
            {desenho.pontos.map((p) => <path key={p.chave} className={styles.fio} data-tipo={p.destinos ? "vai" : "muda"} d={p.fio} />)}
            {desenho.setas.map((s) => <path key={s.chave} d={s.d} markerEnd="url(#ponta)" />)}
          </svg>
          {desenho.pontos.map((p) => (
            <div key={p.chave} className={styles.ponto} data-tipo={p.destinos ? "vai" : "muda"}
              style={{ left: p.caixa.x, top: p.caixa.y, width: p.caixa.l, height: p.caixa.a }} />
          ))}
          {desenho.pontos.map((p) => (
            <span key={p.chave} className={styles.etiqueta} data-tipo={p.destinos ? "vai" : "muda"}
              style={{ left: p.balao.x, top: p.balao.y, width: p.balao.l, minHeight: p.balao.a }}>{p.texto}{p.destinos && <b>→ {p.destinos}</b>}</span>
          ))}
        </div>
        </div>
      </div>
    </div>
  )
}
