// Comportamentos do site público: o comum.js do rascunho aprovado (hub Pontes Dev, 2026-10-26), portado linha a linha
// pra rodar sobre o HTML da página (src/site/paginas/*.html) e desligar tudo ao sair dela. Mudou o rascunho, muda aqui
// igual. Única troca de fundo: o tema é o do app (useTema: data-tema + v2:tema), não a classe .escuro.
import type { Tema } from "../layout/useTema"

type Opcoes = { tema: () => Tema; alternarTema: () => void }

/** Liga tudo na página e devolve quem desliga (observers, relógios, cliques, o seletor preso no topo). */
export function ligarSite(raiz: HTMLElement, { tema, alternarTema }: Opcoes): () => void {
  const desligar: (() => void)[] = []
  const ouvir = <K extends keyof HTMLElementEventMap>(el: EventTarget, ev: K | string, fn: (e: Event) => void) => {
    el.addEventListener(ev, fn); desligar.push(() => el.removeEventListener(ev, fn))
  }
  const observar = (obs: IntersectionObserver) => { desligar.push(() => obs.disconnect()); return obs }
  const todos = <T extends Element = HTMLElement>(sel: string, de: ParentNode = raiz) => Array.from(de.querySelectorAll<T>(sel) as NodeListOf<T>)

  // ----- Prints reais do app acompanham o modo da página. -----
  const print = (nome: string) => `/site/telas/${nome}-${tema()}.png`
  const aplicaPrints = () => {
    todos<HTMLImageElement>("img[data-print]").forEach((i) => { i.src = print(i.dataset.print!) })
    todos(".abas").forEach((abas) => {
      const on = abas.querySelector<HTMLElement>("[data-tela].on") ?? abas.querySelector<HTMLElement>("[data-tela]")
      const img = abas.closest("section")?.querySelector<HTMLImageElement>("[data-tela-img]")
      if (img && on) img.src = print(on.dataset.tela!)
    })
  }
  aplicaPrints()
  todos("[data-tema-troca]").forEach((bt) => ouvir(bt, "click", () => { alternarTema(); requestAnimationFrame(aplicaPrints) }))

  // ----- Setas (→ ↗) dos botões e links ganham um <span> pra poderem andar no hover. -----
  todos("a, button, .ir").forEach((el) => {
    Array.from(el.childNodes).forEach((n) => {
      if (n.nodeType !== 3 || !/[→↗]/.test(n.nodeValue ?? "")) return
      const frag = document.createDocumentFragment()
      ;(n.nodeValue ?? "").split(/([→↗])/).forEach((parte) => {
        if (!parte) return
        if (/[→↗]/.test(parte)) { const sp = document.createElement("span"); sp.className = "seta"; sp.textContent = parte; frag.appendChild(sp) }
        else frag.appendChild(document.createTextNode(parte))
      })
      el.replaceChild(frag, n)
    })
  })

  // ----- Pra sua casa: o seletor troca os textos, fotos e dúvidas de cada tipo de casa (#casal, #familia, #ape). -----
  const seletor = raiz.querySelector<HTMLElement>(".seletor")
  if (seletor) {
    const nomes: Record<string, string> = {}
    todos("[data-escolhe]", seletor).forEach((b) => { nomes[b.dataset.escolhe!] = b.textContent ?? "" })
    const casos = Object.keys(nomes)

    // Selo nos trechos que mudam conforme o caso, pra ficar claro que a página toda acompanha a escolha.
    todos("main [data-caso]").forEach((el) => {
      const selo = document.createElement("span")
      selo.className = "selo-caso"
      selo.textContent = nomes[el.dataset.caso!]
      if (el.matches(".bloco")) el.querySelector("h3")?.before(selo)
      else if (el.matches("details")) el.querySelector("summary")?.prepend(selo)
      else el.prepend(selo)
    })

    // Cópia do seletor que fica presa no topo enquanto a pessoa rola a página.
    const fixo = document.createElement("div")
    fixo.className = "seletor-fixo"
    fixo.innerHTML = "<span>Vendo como</span>"
    fixo.appendChild(seletor.cloneNode(true))
    fixo.querySelector(".seletor")?.removeAttribute("aria-label")
    raiz.appendChild(fixo)
    observar(new IntersectionObserver((es) => {
      fixo.classList.toggle("mostra", !es[0].isIntersecting && es[0].boundingClientRect.top < 0)
    })).observe(seletor)

    let atual: string | null = null
    const escolhe = (caso: string, animar: boolean) => {
      todos(".seletor [data-escolhe]").forEach((b) => {
        b.classList.toggle("on", b.dataset.escolhe === caso); b.setAttribute("aria-selected", String(b.dataset.escolhe === caso))
      })
      todos("[data-caso]").forEach((el) => {
        const ativo = el.dataset.caso === caso
        el.classList.toggle("ativo", ativo)
        el.classList.remove("trocou")
        if (!ativo) return
        el.classList.add("visto"); todos(".revela", el).forEach((r) => r.classList.add("visto"))
        if (animar) { void el.offsetWidth; el.classList.add("trocou") }
      })
      atual = caso
    }
    ouvir(raiz, "click", (ev) => {
      const b = (ev.target as Element).closest<HTMLElement>(".seletor [data-escolhe]")
      if (!b || b.dataset.escolhe === atual) return
      escolhe(b.dataset.escolhe!, true)
      history.replaceState(history.state, "", location.search + "#" + b.dataset.escolhe)
    })
    const doLink = location.hash.slice(1)
    escolhe(casos.includes(doLink) ? doLink : casos[0], false)
    if (casos.includes(doLink)) window.scrollTo(0, 0)
  }

  // ----- Menu ☰ no celular. -----
  const nav = raiz.querySelector<HTMLElement>(".topo .nav"), hamb = nav?.querySelector<HTMLElement>(".hamb")
  if (nav && hamb) {
    ouvir(hamb, "click", () => { hamb.setAttribute("aria-expanded", String(nav.classList.toggle("aberto"))) })
    todos("nav a", nav).forEach((a) => ouvir(a, "click", () => { nav.classList.remove("aberto"); hamb.setAttribute("aria-expanded", "false") }))
  }

  // ----- Ponte estaiada: cabos em leque saindo dos pilares inclinados (como na logo) e os marcos no tabuleiro. -----
  todos<SVGSVGElement>(".ponte").forEach((ponte) => {
    const ns = "http://www.w3.org/2000/svg", sec = ponte.closest("section")
    const deckY = (x: number) => { const t = x / 1200; return 272 - 128 * t * (1 - t) }
    const pilarX = (base: number, y: number) => base - 16 + 36 * (352 - y) / 312
    const cabos = ponte.querySelector("[data-cabos]"), marcos = ponte.querySelector("[data-marcos]")
    ;[330, 870].forEach((base, p) => {
      for (let i = 0; i < 7; i++) {
        const y = 64 + i * 16, dx = 280 - i * 36
        ;[-1, 1].forEach((lado) => {
          const x2 = base + lado * dx, c = document.createElementNS(ns, "path")
          c.setAttribute("class", "cabo"); c.setAttribute("pathLength", "1")
          c.setAttribute("d", "M" + pilarX(base, y).toFixed(1) + " " + y + " L" + x2 + " " + deckY(x2).toFixed(1))
          c.style.transitionDelay = (1.7 + p * 0.35 + (6 - i) * 0.07) + "s"
          cabos?.appendChild(c)
        })
      }
    })
    const nomes = (ponte.dataset.marcos || "Hoje|Este mês|Este ano|Futuro").split("|")
    nomes.forEach((nome, k) => {
      const x = 150 + k * (900 / (nomes.length - 1)), y = deckY(x).toFixed(1), g = document.createElementNS(ns, "g"), fim = k === nomes.length - 1
      g.setAttribute("class", fim ? "marco fim" : "marco")
      g.style.transitionDelay = (2.6 + k * 0.18) + "s"
      g.innerHTML = (fim ? '<circle class="onda" cx="' + x + '" cy="' + y + '" r="14"/>' : "") +
        '<circle class="anel" cx="' + x + '" cy="' + y + '" r="14"/><circle class="miolo" cx="' + x + '" cy="' + y + '" r="5"/>' +
        '<text x="' + x + '" y="' + (+y + 44) + '">' + nome + "</text>"
      marcos?.appendChild(g)
    })
    let relogio: number | undefined
    const obs = observar(new IntersectionObserver((es) => {
      if (!es[0].isIntersecting) return
      sec?.classList.add("viva"); obs.disconnect()
      relogio = window.setTimeout(() => {
        sec?.classList.add("anda")
        ponte.querySelector<SVGAnimationElement>("[data-carro]")?.beginElement()
      }, 3300)
    }, { threshold: 0.25 }))
    obs.observe(ponte)
    desligar.push(() => clearTimeout(relogio))
  })

  // ----- Blocos surgem de leve ao entrar na tela. -----
  todos(".sec .wrap > .olho, .sec .wrap > .h2, .sec .wrap > .lede, .topo-sec, .moldura, .mosaico, .papel, .etapa, .faq, .cta, .of .g > div, .notas, .bloco, .passo-l")
    .forEach((el) => el.classList.add("revela"))
  const surgir = observar(new IntersectionObserver((es) => {
    es.forEach((e) => {
      if (!e.isIntersecting) return
      const el = e.target as HTMLElement
      const irmaos = Array.from(el.parentNode?.children ?? []).filter((x) => x.classList.contains("revela"))
      el.style.transitionDelay = Math.min(irmaos.indexOf(el), 4) * 90 + "ms"
      el.classList.add("visto"); surgir.unobserve(el)
    })
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }))
  todos(".revela").forEach((el) => surgir.observe(el))

  // ----- Abas com prints do app: trocam sozinhas a cada 5 s; um clique pausa 12 s. -----
  todos(".abas").forEach((abas) => {
    const bts = todos("[data-tela]", abas)
    const moldura = abas.closest("section")?.querySelector<HTMLElement>(".moldura")
    const img = moldura?.querySelector<HTMLImageElement>("[data-tela-img]")
    if (!moldura || !img) return
    let relogio: number | null = null, visivel = false, pausa: number | null = null
    const liga = () => { if (!relogio) { abas.classList.add("auto"); relogio = window.setInterval(proxima, 5000) } }
    const desliga = () => { if (relogio) clearInterval(relogio); relogio = null; abas.classList.remove("auto") }
    const mostra = (b: HTMLElement) => {
      bts.forEach((x) => x.classList.toggle("on", x === b))
      img.src = print(b.dataset.tela!)
      img.alt = "Tela " + b.textContent + " do Pontes"
    }
    function proxima() {
      const i = bts.findIndex((b) => b.classList.contains("on"))
      mostra(bts[(i + 1) % bts.length])
      abas.classList.remove("auto"); void abas.offsetWidth; abas.classList.add("auto")
    }
    bts.forEach((b) => ouvir(b, "click", () => {
      mostra(b)
      // Clique da pessoa pausa a troca por 12 s, pra dar tempo de ver a tela escolhida.
      desliga(); if (pausa) clearTimeout(pausa)
      pausa = window.setTimeout(() => { pausa = null; if (visivel) liga() }, 12000)
    }))
    observar(new IntersectionObserver((es) => { visivel = es[0].isIntersecting; if (visivel && !pausa) liga(); else desliga() }, { threshold: 0.3 })).observe(moldura)
    desligar.push(() => { desliga(); if (pausa) clearTimeout(pausa) })
  })

  return () => desligar.forEach((f) => f())
}
