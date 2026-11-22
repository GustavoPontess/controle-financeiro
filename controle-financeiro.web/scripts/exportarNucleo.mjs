// Núcleo Pontes (2026-11-18, pedido do Gustavo): gera, FORA dos repositórios, a pasta com o que é comum a todo
// projeto da Pontes Dev (design system, layout, login e segurança, travas, regras), SEM nada de finanças.
// Outro projeto (o Pontes CRM) puxa dessa pasta e não edita a cópia: mudou algo comum, muda AQUI e roda de novo.
//
// Uso: node scripts/exportarNucleo.mjs [pasta de saída]   (padrão: E:\VSCode\pontes\nucleo-pontes)
//
// Entra: a lista ARQUIVOS (cópia do app) e os modelos de nucleo/ (a versão genérica do que no app tem cara de
// finanças, ex. o layout com o menu). Na cópia, linha de comentário que cita finanças sai sozinha; código que cita
// passa por TROCAS. O script FALHA (e não deixa a pasta pela metade sem avisar) se:
//  - sobrar palavra de finanças em qualquer arquivo gerado (PROIBIDAS);
//  - um arquivo gerado importar outro que não foi junto (o núcleo tem que se sustentar sozinho);
//  - uma troca não achar o texto (o app mudou: rever a troca).
import { execSync } from "node:child_process"
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"

const WEB = path.resolve(import.meta.dirname, "..")
const SAIDA = path.resolve(process.argv[2] ?? "E:/VSCode/pontes/nucleo-pontes")
const DESTINO_WEB = path.join(SAIDA, "web")

// Palavras do domínio de finanças: nenhuma sai no núcleo (nem em comentário).
const PROIBIDAS = /transa[cç]|fatura|cart[aã]o de cr[eé]dito|cart[oõ]es|or[cç]ament|parcel|empr[eé]stim|fam[ií]lias?\b(?! de fonte)|\brenda\b|receita|despesa|categori|saldo|extrato|reconcilia|finan[cç]|lan[cç]amento|dinheiro da sua casa|sua casab|contas? fixas?|\bmetas?\b|\bbancos?\b(?! local| de dados)|investiment|planejad|planejar|acerto|entre voc[eê]s|dinheiro da casa|divide a casa/i
const FALSO = /import\.meta|<meta|meta\[|meta name|theme-color|categories:/

// Componentes do app que são de finanças e NÃO vão: FaceCartao, LancamentoJaNoApp, ListaAindaVem, PreviaLancamento,
// QuantoPossoGastar, UsoDaRenda, GraficoBarrasComparacao, LinhaDoTempo, Cupom, Anexos, Localizacao, ValorNaLinha, Apontar.
const COMPONENTES = ["AreaTexto", "Avatar", "AvisoDeFuso", "BarraProgresso", "Bloco", "Botao", "Bullet", "Busca", "Campo", "Confirmar",
  "Dialogo", "Dinheiro", "Entrada", "EntradaValor", "Etiqueta", "Formulario", "GraficoLinha", "Interruptor", "ListaFicha",
  "ListaNotificacoes", "ListaPorDia", "LogoMarca", "Marcar", "Menu", "Mosaico", "NavSecoes", "NavegadorMes", "Paginacao",
  "PainelFiltros", "Planilha", "Resposta", "SecaoPlanilha", "Segmentos", "Selecao", "SeletorData", "SoltarArquivos", "VerAnexos",
  "VerificacaoHumana"]

// Cópia (caminhos relativos a controle-financeiro.web/). O .module.css ao lado vai junto quando existe.
const ARQUIVOS = [
  "src/estilo/global.css", "src/estilo/tokens.css",
  ...COMPONENTES.map((n) => `src/componentes/${n}.tsx`), "src/componentes/campoContexto.ts", "src/componentes/gatilho.module.css",
  // Sessão, API, estado entre telas, relógio
  "src/api/cliente.ts",
  "src/auth/AuthProvider.tsx", "src/auth/Protegido.tsx", "src/auth/SairPorInatividade.tsx", "src/auth/contexto.ts", "src/auth/useAuth.ts",
  "src/auth/useTokenDoLink.ts",
  "src/estado/notificacoes.ts", "src/estado/ocultar.ts",
  "src/utils/dateTime.ts", "src/utils/mascararEmail.ts", "src/utils/money.ts", "src/utils/useAtrasado.ts",
  "src/services/mfaService.ts", "src/services/minhaContaService.ts", "src/services/sessaoService.ts", "src/services/dispositivoService.ts",
  "src/services/notificacaoService.ts", "src/services/verificacaoService.ts", "src/services/cadastroService.ts",
  "src/services/rosterService.ts", "src/services/senhaService.ts", "src/services/adminService.ts",
  "src/types/Notificacao.ts", "src/types/Sessao.ts", "src/types/Admin.ts", "src/types/Solicitacao.ts", "src/types/NotificacaoAdmin.ts",
  "src/types/Paged.ts",
  "src/dominio/senha.ts", "src/dominio/dispositivo.ts",
  // Layout: o .tsx é o modelo de src/nucleo/ (menu genérico); o CSS é o do app, igual
  "src/layout/V2Layout.module.css", "src/layout/PainelNotificacoes.tsx", "src/layout/useTema.ts",
  // App instalável
  "src/pwa/instalar.ts", "src/pwa/registrar.ts", "src/pwa/manifesto.ts", "src/pwa/sw.js",
  // Painel de dev
  "src/dev/BarraDev.tsx", "src/dev/BarraEstadosDev.tsx", "src/dev/tipos.ts", "src/dev/estadosAcesso.ts", "src/dev/semInatividade.ts",
  "src/dev/ManterVivoDev.tsx",
  // Telas de acesso (entrar, pedir acesso, esqueci/criar senha, links do e-mail, proteger a conta) e a moldura delas
  "src/site/MolduraAcesso.tsx", "src/site/Acesso.module.css", "src/site/usarFolhaDoSite.ts", "src/site/site.css",
  "src/telas/Entrar.tsx", "src/telas/Cadastro.tsx", "src/telas/RedefinirSenha.tsx", "src/telas/LinkDoPedido.tsx", "src/telas/ProtejaConta.tsx",
  // Configurações (conta e segurança)
  "src/telas/Configuracoes.tsx", "src/telas/SegurancaMfa.tsx", "src/telas/SegurancaDispositivos.tsx", "src/telas/TrocarSenha.tsx",
  "src/telas/useAtivacaoMfa.ts", "src/telas/Perfil.tsx", "src/telas/DadosConta.tsx", "src/telas/AppNoCelular.tsx", "src/telas/Notificacoes.tsx",
  // Admin (mini-app à parte: aprova pedidos de acesso, solicitações)
  "admin.html", "src/admin/main.tsx", "src/admin/AreaAdmin.tsx", "src/admin/SolicitacoesAdmin.tsx", "src/admin/irPara.ts",
  // Fotos da moldura de acesso
  "public/site/fotos/1740679954227-a0cd19c042a6-1400.webp", "public/site/fotos/1694185752018-2ff397cb99b4-1800.webp",
  "public/site/fotos/1758523417185-5d46089b870a-1400.webp", "public/site/fotos/1752652015365-52bf1f527e01-900.webp",
  // Marca: a logo "< ponte >" (claro, escuro, laranja, ícone) e os ícones do app instalado
  "public/site/estaiada-claro.svg", "public/site/estaiada-escuro.svg", "public/site/estaiada-laranja.svg",
  "public/site/estaiada-icone.svg", "public/icon.svg", "public/icones/apple-touch-icon.png",
  "public/icones/icone-192.png", "public/icones/icone-512.png", "public/icones/icone-mascara-512.png",
  // Travas do build e testes que leem o código
  "scripts/conferirAdminFora.mjs", "scripts/conferirDevFora.mjs", "scripts/conferirCspInline.mjs",
  "src/test/relogioUnico.test.ts", "src/test/semTravessao.test.ts", "src/test/adminForaDoPacoteComum.test.ts",
  // Regras do front (as linhas de finanças saem)
  "CONVENCOES.md",
]

// Modelos genéricos: nucleo/<caminho> entra no lugar do arquivo de mesmo caminho (ou como arquivo novo).
const MODELOS = "nucleo"

// Código (não comentário) que cita finanças: [de, para]. Uma troca que não acha o texto é erro.
const TROCAS = {
  "src/telas/Entrar.tsx": [
    ['frase="O dinheiro da casa," fraseSuave="sem briga."\n      lead="Um lugar só pra você e pra quem divide a casa com você. Divisão clara, aprovação de despesas e o acerto do mês pronto."\n      benef={["Divisão meio a meio, pela renda ou por porcentagem", "Aprovação de gasto grande em 1 toque", "Conexão com Open Finance (em breve)"]}>',
      'frase="Bem-vindo," fraseSuave="de volta."\n      lead="O texto do produto mora aqui."\n      benef={["Primeiro benefício", "Segundo benefício", "Terceiro benefício"]}>'],
  ],
  "src/telas/LinkDoPedido.tsx": [['frase="O dinheiro da casa," fraseSuave="sem briga."\n      lead="Um lugar só pra você e pra quem divide a casa com você.">',
    'frase="Bem-vindo," fraseSuave="de volta."\n      lead="O texto do produto mora aqui.">']],
  "src/types/Paged.ts": [[" * (transacoes, recorrentes, transferencias, emprestimos, parcelamentos).", " * (as listas paginadas)."]],
  "src/telas/DadosConta.tsx": [
    ['import { useEffect, useState } from "react"', 'import { useState } from "react"'],
    ['import { getFamilias } from "../services/familiaService"\n', ""],
    ["Uma cópia de tudo que é seu, em JSON: perfil, contas, cartões, lançamentos, contas fixas, compras parceladas, empréstimos, metas, limites, renda e categorias.", "Uma cópia de tudo que é seu, em JSON."],
    [/\n *\{temFamilia && [^\n]*/, ""],
    ['  const [temFamilia, setTemFamilia] = useState(false)\n  useEffect(() => {\n    let vivo = true\n    getFamilias().then((f) => { if (vivo) setTemFamilia(f.length > 0) }).catch(() => { /* sem o aviso */ })\n    return () => { vivo = false }\n  }, [])\n', ""],
  ],
  "src/pwa/manifesto.ts": [['categories: ["finance"]', 'categories: ["business"]'], ['description: "Finanças pessoais e da casa."', 'description: "Descrição do produto."']],
  "src/telas/ProtejaConta.tsx": [['lead="Num app com o dinheiro da sua casa, a verificação', 'lead="Num app com os seus dados, a verificação']],
  "CONVENCOES.md": [["# Convenções do front (controle-financeiro.web)", "# Convenções do front"]],
  "src/site/MolduraAcesso.tsx": [['Pontes · o dinheiro da casa', 'Pontes']],
  "src/telas/Cadastro.tsx": [
    ['lead="Peça o seu acesso em 2 minutos. Sem cartão de crédito, sem fidelidade."', 'lead="Peça o seu acesso em 2 minutos."'],
    ['"Convide quem divide a casa sem custo extra"', '"Segundo benefício"'],
  ],
  "src/types/Admin.ts": [["  contas: unknown[]\n  cartoes: unknown[]\n  transacoes: unknown[]\n  metas: unknown[]\n  orcamentos: unknown[]\n", "  [assunto: string]: unknown\n"]],
  "src/componentes/Planilha.tsx": [
    ["rotuloCategoria", "rotuloEscolha"],
    ['rotuloEscolha = "Categoria"', 'rotuloEscolha = "Item"'],
    ['"Todas já têm planejado" : "Escolha a categoria"', '"Todos já estão na lista" : "Escolha"'],
  ],
}

// Arquivo que vai só em parte (função que recebe o texto do app e devolve o do núcleo).
const RECORTES = {
  // Do CSS do site público, só a base e as telas de acesso (a moldura do entrar/pedir acesso/senha).
  "src/site/site.css": (t) => {
    const l = t.split("\n")
    const de = (marca, desde = 0) => { const i = l.findIndex((x, k) => k >= desde && x.includes(marca)); if (i < 0) erros.push(`recorte do site.css não achou: ${marca}`); return i }
    const base = l.slice(0, de(".foto img { width: 100%"))
    const acesso = l.slice(de("TELAS DE ACESSO"), de("Barra do rascunho com todas"))
    // A logo (.marca) mora no MENU do site, fora da base: vai junto, senão a imagem sai no tamanho natural.
    const marca = l.filter((x) => /^  (\.marca[ :]|@media \(max-width: 600px\) \{ \.marca)/.test(x))
    // Microanimações dos botões e da seta (→) que as telas de acesso usam.
    const microDe = de("MICROANIMAÇÕES: botões")
    const animacoes = [...l.slice(microDe, de(".canal .ir {", microDe)),
      "  @media (prefers-reduced-motion: reduce) { .btn, .seta, .seta-volta, .marca img { transition: none !important; } .btn--acc::after { display: none; } }"]
    const escuro = l.filter((x) => x.startsWith('  [data-tema="escuro"] { --bg'))
    const tema = l.slice(de("Botão de modo claro/escuro no menu"), de("Barra de navegação do rascunho"))
    const movel = de(".acesso { grid-template-columns: 1fr; }")
    return ["/* Núcleo: recorte do CSS do site com a base e as telas de acesso. */", ...base.slice(3), "", ...marca, "", ...animacoes, "", ...acesso, ...escuro, "", ...tema,
      "  @media (max-width: 900px) {", ...l.slice(movel, movel + 5), "  }", ""].join("\n")
  },
  // As cores da linha do tempo de Relatórios (receita, despesa, investimento) são de finanças: saem.
  "src/estilo/tokens.css": (t) => t
    .replace(/\n  \/\* A linha do tempo de Relatórios[\s\S]*?--v2-investimento-alem: #173E8C;/, "")
    .replace(/\n  \/\* No fundo escuro o "além"[\s\S]*?--v2-investimento-alem: #A9C6F5;/, ""),
}

const erros = []
const lerTexto = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n")
const ehTexto = (rel) => /\.(tsx?|m?js|css|md|json|html)$/.test(rel)

/** Tira linha de comentário que cita finanças (o código fica igual): `// …` inteira, `/* … *\/` de uma linha só,
 *  e no .md a linha toda. Comentário de várias linhas que cita finanças no meio fica pra TROCAS (erro avisa). */
function semFinancasNosComentarios(rel, texto) {
  const md = rel.endsWith(".md")
  return texto.split("\n").filter((l) => {
    const m = l.match(PROIBIDAS)
    if (!m || FALSO.test(l)) return true
    if (md) return false
    const t = l.trim()
    if (t.startsWith("//")) return false
    if (/^(\{?\/\*).*\*\/\}?$/.test(t)) return false
    return true
  }).join("\n")
}

function copiar(rel, origem) {
  const de = path.join(WEB, origem ?? rel)
  if (!existsSync(de)) { erros.push(`não existe: ${origem ?? rel}`); return }
  const para = path.join(DESTINO_WEB, rel)
  mkdirSync(path.dirname(para), { recursive: true })
  if (!ehTexto(rel)) { cpSync(de, para); return }
  let texto = lerTexto(de)
  if (RECORTES[rel]) texto = RECORTES[rel](texto)
  for (const [a, b] of TROCAS[rel] ?? []) {
    if (a instanceof RegExp ? !a.test(texto) : !texto.includes(a)) erros.push(`troca não achou em ${rel}: ${String(a).slice(0, 70)}`)
    texto = a instanceof RegExp ? texto.replace(a, b) : texto.split(a).join(b)
  }
  writeFileSync(para, origem ? texto : semFinancasNosComentarios(rel, texto))
}

rmSync(DESTINO_WEB, { recursive: true, force: true })
const listarModelos = (dir) => readdirSync(path.join(WEB, dir), { withFileTypes: true })
  .flatMap((e) => e.isDirectory() ? listarModelos(`${dir}/${e.name}`) : [`${dir}/${e.name}`])
const dosModelos = new Map(existsSync(path.join(WEB, MODELOS)) ? listarModelos(MODELOS).map((f) => [f.slice(MODELOS.length + 1), f]) : [])
const todos = new Set()
for (const rel of ARQUIVOS) {
  for (const r of [rel, rel.replace(/\.tsx$/, ".module.css")]) {
    if (r !== rel && (!existsSync(path.join(WEB, r)) || ARQUIVOS.includes(r))) continue
    todos.add(r)
  }
}
for (const rel of dosModelos.keys()) todos.add(rel)
for (const rel of todos) copiar(rel, dosModelos.get(rel))

// Conferências no que saiu.
for (const rel of todos) {
  const p = path.join(DESTINO_WEB, rel)
  if (!existsSync(p) || !ehTexto(rel)) continue
  const texto = lerTexto(p)
  texto.split("\n").forEach((l, i) => {
    const m = l.match(PROIBIDAS)
    if (m && !FALSO.test(l)) erros.push(`finanças em ${rel}:${i + 1} ("${m[0]}"): ${l.trim().slice(0, 110)}`)
  })
  // Arquivo público citado (logo, foto, ícone) tem que ter ido junto: senão dá 404 no projeto.
  for (const [, pub] of texto.matchAll(/["'(]\/((?:site|icones)\/[^"'()?#\s]+\.(?:svg|png|webp|jpe?g|ico)|icon\.svg)/g)) {
    if (!existsSync(path.join(DESTINO_WEB, "public", pub))) erros.push(`${rel} usa /${pub}, que não foi junto`)
  }
  if (!/\.(tsx?|m?js)$/.test(rel)) continue
  for (const [, imp] of texto.matchAll(/(?:from|import)\s*\(?\s*["']((?:\.{1,2}|@)\/[^"']+)["']/g)) {
    const alvo = (imp.startsWith("@/") ? "src/" + imp.slice(2) : path.posix.normalize(path.posix.join(path.posix.dirname(rel), imp))).replace(/\?.*$/, "")
    const achou = ["", ".ts", ".tsx", ".js", ".mjs", "/index.ts"].some((ext) => existsSync(path.join(DESTINO_WEB, alvo + ext)))
    if (!achou) erros.push(`${rel} importa ${imp}, que não foi junto`)
  }
}

// Classe global (className="x" escrita na mão) usada no que saiu tem que ter regra num CSS global que saiu.
const cssGlobal = [...todos].filter((r) => r.endsWith(".css") && !r.endsWith(".module.css"))
  .map((r) => lerTexto(path.join(DESTINO_WEB, r))).join("\n")
const cssGlobalDoApp = ["src/site/site.css", "src/estilo/global.css", "src/estilo/tokens.css"]
  .map((r) => lerTexto(path.join(WEB, r))).join("\n")
for (const rel of todos) {
  if (!rel.endsWith(".tsx") || !existsSync(path.join(DESTINO_WEB, rel))) continue
  for (const [, lista] of lerTexto(path.join(DESTINO_WEB, rel)).matchAll(/className="([^"]+)"/g)) {
    for (const cls of lista.split(/\s+/)) {
      const regra = new RegExp(`\\.${cls}(?![\\w-])`)
      // Só cobra a que tem regra no app (a "seta" do botão é só um gancho, sem estilo, lá também).
      if (!regra.test(cssGlobal) && regra.test(cssGlobalDoApp)) erros.push(`${rel} usa a classe "${cls}", sem regra no CSS do núcleo`)
    }
  }
}

if (erros.length) {
  rmSync(DESTINO_WEB, { recursive: true, force: true })
  console.error(`Núcleo com problema (${erros.length}); conserte e rode de novo:\n` + erros.map((e) => "  - " + e).join("\n"))
  process.exit(1)
}
const versao = execSync("git rev-parse --short HEAD", { cwd: WEB, encoding: "utf8" }).trim()
const sujo = execSync("git status --porcelain", { cwd: WEB, encoding: "utf8" }).trim() ? " (com mudanças ainda sem commit)" : ""
writeFileSync(path.join(SAIDA, "VERSAO.txt"), `Gerado do app Pontes @ ${versao}${sujo}\n`)
console.log(`núcleo gerado em ${SAIDA}: ${todos.size} arquivos do front (versão ${versao}${sujo})`)
