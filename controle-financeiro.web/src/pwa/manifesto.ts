// App instalável (PWA, 2026-11-17): nome, ícone e cores que o celular e o computador mostram ao instalar o Pontes.
// O vite.config.ts publica este JSON como /manifest.webmanifest (no dev, servido na hora; no build, arquivo no dist).
// Ícones: public/icones/, gerados do public/icon.svg por PontesDev/base/ferramentas/icones-app.mjs (fundo #110D0B).
//
// Pra abrir SEM a barra de endereço e os menus do navegador (o que incomodava no CRM):
//  - display "standalone" e scope "/": toda tela do app fica dentro do app instalado;
//  - nenhum endereço do app sai pra outra origem (a API é a mesma origem, por /api);
//  - link interno não abre aba nova quando está instalado (pwa/instalar.ts, propsDeLinkInterno): aba nova no app
//    instalado é o navegador, com a barra.

/** Fundo da página em cada tema (--v2-bg em estilo/tokens.css): a barra do celular acompanha. */
export const COR_DA_BARRA = { claro: "#FBF7F3", escuro: "#110D0B" } as const

/** Onde o app instalado abre: a Visão geral (sem sessão, o Protegido manda pro /entrar). */
export const INICIO_DO_APP = "/dashboard"

export function manifesto() {
  return {
    id: "/",
    name: "Pontes",
    short_name: "Pontes",
    description: "Finanças pessoais e da casa.",
    lang: "pt-BR",
    dir: "ltr",
    start_url: INICIO_DO_APP,
    scope: "/",
    display: "standalone",
    display_override: ["standalone"],
    background_color: COR_DA_BARRA.escuro,
    theme_color: COR_DA_BARRA.escuro,
    categories: ["finance"],
    icons: [
      { src: "/icones/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icones/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icones/icone-mascara-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
