// Barra de estados, SÓ EM DESENVOLVIMENTO (regra do Gustavo, 2026-10-26): pílula preta embaixo que pula direto pra
// cada jeito de ver uma tela (passo de fluxo, vazio x com dados, erro…), sem login nem API. Nunca importar direto:
// a tela usa <BarraDev> (BarraDev.tsx), que só carrega este arquivo com import.meta.env.DEV; no build ele some.
import { Fragment, useEffect, useRef } from "react"
import { Link, useLocation } from "react-router-dom"
import type { GruposEstadosDev } from "./tipos"
import css from "./BarraEstadosDev.module.css"

/** `para` = rota + #estado (o mesmo endereço que a tela lê no useEstadoDev). */
export default function BarraEstadosDev({ grupos, atual }: { grupos: GruposEstadosDev; atual: string }) {
  const { pathname } = useLocation()
  const ativo = (para: string) => {
    const [caminho, estado] = para.split("#")
    return caminho.split("?")[0] === pathname && estado === atual
  }
  // No celular a barra rola de lado: o estado ativo fica sempre à vista.
  const barra = useRef<HTMLElement>(null)
  useEffect(() => {
    const b = barra.current, on = b?.querySelector<HTMLElement>("[data-on]")
    if (b && on) b.scrollLeft = on.offsetLeft - (b.clientWidth - on.offsetWidth) / 2
  }, [pathname, atual])
  return (
    <nav ref={barra} className={css.barra} aria-label="Estados da tela (só em desenvolvimento)">
      {grupos.map((grupo, i) => (
        <Fragment key={i}>
          {i > 0 && <span className={css.sep} />}
          {grupo.map((e) => <Link key={e.para} to={e.para} data-on={ativo(e.para) || undefined}>{e.rotulo}</Link>)}
        </Fragment>
      ))}
    </nav>
  )
}
