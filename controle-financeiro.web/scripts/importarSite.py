"""Traz o site público do Pontes do rascunho aprovado (hub Pontes Dev) pro app, sem redesenhar.

Fonte da verdade: docs/design-home/site (o rascunho, trazido do hub Pontes Dev em 2026-11-18). Gera:
  - src/site/paginas/<rota>.html : o <body> de cada página do rascunho, com os links trocados pelas rotas do app,
    as imagens apontando pra /site/ e sem o que é só do rascunho (barra "Telas internas", <script>);
  - src/site/site.css            : o comum.css inteiro, com o tema do app ([data-tema="escuro"] no lugar de .escuro);
  - public/site/                 : logos, fotos, prints do app (claro/escuro) e a imagem de compartilhamento.
Rodar de novo sempre que o rascunho mudar:  python scripts/importarSite.py   (da pasta controle-financeiro.web)
"""
import os, re, shutil, sys
from io import BytesIO
from PIL import Image, ImageOps

ORIGEM = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'docs', 'design-home', 'site'))
AQUI = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.dirname(AQUI)
PAGINAS = os.path.join(WEB, 'src', 'site', 'paginas')
PUBLICO = os.path.join(WEB, 'public', 'site')

# Página do rascunho → rota do app.
ROTAS = {
    'home.html': '/', 'recursos.html': '/recursos', 'casa.html': '/casa', 'contadores.html': '/contadores',
    'planos.html': '/planos', 'seguranca.html': '/seguranca', 'sobre.html': '/sobre',
    'entrar.html': '/entrar', 'acesso.html': '/cadastro', 'nova-senha.html': '/redefinir-senha', 'proteja.html': '/proteja-sua-conta',
}
SITE = ['home', 'recursos', 'casa', 'contadores', 'planos', 'seguranca', 'sobre']
LARGURA_CELULAR = 800   # versão '-m' das fotos grandes (celular de 390px com tela 2x)
LARGURA_MAXIMA = 1400   # nenhuma foto precisa de mais que isso (metade de uma tela 2x de 1440)
QUALIDADE_WEBP = 78

# Botão de tema dentro do menu ☰ do celular (o mesmo [data-tema-troca] que o comportamentos.ts liga).
TEMA_NO_MENU = ('<button class="so-cel tema-menu" type="button" data-tema-troca aria-label="Alternar modo claro e escuro">'
                '<svg class="sol" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/></svg>'
                '<svg class="lua" viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/></svg>'
                '<span class="se-claro">Modo escuro</span><span class="se-escuro">Modo claro</span></button>')

# Ajustes pedidos pelo Gustavo direto no app, por cima do rascunho (vão no fim do site.css e sobrevivem a rodar o
# script de novo). Quando o rascunho do hub receber o mesmo ajuste, sai daqui.
AJUSTES = """
/* ===== Ajustes do app por cima do rascunho (scripts/importarSite.py, AJUSTES) ===== */
/* 2026-10-26, Gustavo: com o topo apertado, fica o "Entrar" (quem já tem conta precisa dele pra chegar no login) e sai o
   "Pedir acesso" do topo (ele continua no começo e no fim de toda página). O rascunho fazia o contrário. */
@media (max-width: 1200px) and (min-width: 901px) { .nav .acoes .btn--linha { display: flex; } .nav .acoes .btn--acc { display: none; } }
@media (max-width: 900px) { .acoes .btn--linha { display: flex; height: 46px; padding: 0 18px; } .acoes .btn--acc { display: none; } }

/* 2026-10-26, Gustavo: chamada do fim com texto em cima e botões embaixo do cartão, em qualquer tamanho de tela
   (o rascunho encostava tudo embaixo). */
.cta { align-items: stretch; }
.cta .txt { display: flex; flex-direction: column; flex: 1 1 auto; min-height: 460px; }
.cta .txt .btns { margin-top: auto; }

/* 2026-10-26, revisão do celular (Gustavo). */
.btns { display: flex; gap: 10px; flex-wrap: wrap; }
/* Botão de tema no menu ☰ (o do topo some no celular). */
.tema-menu { display: none; }
.tema-menu svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.tema-menu .lua, .tema-menu .se-escuro, [data-tema="escuro"] .tema-menu .sol, [data-tema="escuro"] .tema-menu .se-claro { display: none; }
[data-tema="escuro"] .tema-menu .lua, [data-tema="escuro"] .tema-menu .se-escuro { display: block; }
/* Print do app em tamanho de celular (public/site/telas/*-movel.png, scripts/printsMoveis.mjs): moldura vira um celular. */
.moldura:has(img[data-movel]) { max-width: 300px; margin-left: auto; margin-right: auto; }
@media (max-width: 900px) {
  .hamb { flex: none; }                                            /* não encolhe: fica redondo */
  .acoes .tema-bt { display: none; }
  .nav nav .tema-menu { display: flex; align-items: center; gap: 12px; width: 100%; padding: 14px 16px; margin-top: 6px; border: 0; border-top: 1px solid var(--line); border-radius: 0 0 14px 14px; background: none; font: 500 17px 'Plus Jakarta Sans', sans-serif; color: var(--fg); text-align: left; cursor: pointer; }
  /* Abas dos prints: as quatro cabem numa linha, metade do espaço pra cada (antes a última ficava cortada). */
  .abas { width: 100%; max-width: 100%; gap: 3px; padding: 5px; }
  .abas button { flex: 1 1 0; min-width: 0; white-space: nowrap; padding: 9px 3px; font-size: 11.5px; letter-spacing: -.01em; text-align: center; }
  /* Rodapé: as três listas lado a lado, menores, e menos espaço vazio embaixo. */
  .rodape { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px 10px; padding: 48px 0 40px; font-size: 14px; }
  .rodape nav { gap: 8px; } .rodape nav b { font-size: 13px; }
  .rod-marca p { max-width: none; }
  .rod-base { gap: 4px 16px; padding-top: 20px; font-size: 12px; }
  /* Seletor preso da /casa: escondido de verdade até a pessoa rolar (antes sobrava um pedaço na tela). */
  .seletor-fixo { transform: translateY(calc(100% + 90px)); }
  /* Tabela de comparação cabe na tela, sem rolagem de lado. */
  .comp { overflow: visible; border-radius: 22px; }
  .comp table { min-width: 0; width: 100%; table-layout: fixed; font-size: 13px; }
  .comp th, .comp td { padding: 12px 8px; }
  .comp th:first-child, .comp td:first-child { width: 44%; padding-left: 14px; }
  .comp thead th { font-size: 11px; line-height: 1.2; padding: 10px 4px; vertical-align: bottom; }
  .comp thead th.nos { font-size: 12px; }
  .comp thead th.nos img { display: block; width: 18px; margin: 0 auto 4px; }
  .comp td .meio { font-size: 11px; }
  /* Par de botões (topo, plano, chamada do fim) lado a lado, metade pra cada um; texto longo quebra dentro do botão. */
  .btns, .topo .btns { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .btns .btn { height: auto; min-height: 48px; padding: 10px 12px; justify-content: center; text-align: center; font-size: 14px; line-height: 1.2; }
  /* 2026-10-29: "Pedir acesso ao beta" não cabe em meia linha: ele ocupa a linha toda e o outro botão vem embaixo. */
  .btns .btn--acc { grid-column: 1 / -1; white-space: nowrap; }
  /* Painel do contador: número cabe no cartão. */
  .painel .kpis { grid-template-columns: 1fr 1fr; gap: 8px; } .painel .kpi:last-child { grid-column: 1 / -1; } .painel .kpi b { white-space: nowrap; }
}
"""


def link(m):
    href = m.group(1)
    pagina, _, ancora = href.partition('#')
    if pagina in ROTAS:
        return 'href="' + ROTAS[pagina] + ('#' + ancora if ancora else '') + '"'
    if pagina == '../telas-app/comparar.html':
        return 'href="/dashboard"'
    return m.group(0)


def converte(html):
    corpo = re.search(r'<body>(.*)</body>', html, re.S).group(1)
    corpo = re.sub(r'<script[^>]*></script>\s*', '', corpo)
    corpo = re.sub(r'<div class="troca">.*?</div>\s*', '', corpo, flags=re.S)     # barra só do rascunho
    corpo = re.sub(r'href="([^"]*)"', link, corpo)
    corpo = corpo.replace('../assets/fotos/', '/site/fotos/').replace('../assets/', '/site/')
    corpo = corpo.replace('../telas-app/proposta/', '/site/telas/')
    # Rodapé do site: Termos e Privacidade apontam pras páginas legais do app (o resto segue "#" até existir).
    corpo = corpo.replace('<a href="#">Termos de uso</a>', '<a href="/termos-de-uso">Termos de uso</a>')
    corpo = corpo.replace('<a href="#">Privacidade</a>', '<a href="/privacidade">Privacidade</a>')
    # "Pedir acesso" (topo e chamada do fim) leva pro cadastro do app (decisão do Gustavo, 2026-10-26; antes ficava sem ação).
    corpo = re.sub(r'href="#(?:acesso)?">Pedir acesso', 'href="/cadastro">Pedir acesso', corpo)
    # 2026-10-29, Gustavo: o botão diz que é o BETA ("Pedir acesso ao beta"), não um cadastro aberto.
    corpo = corpo.replace('href="/cadastro">Pedir acesso', 'href="/cadastro">Pedir acesso ao beta')
    # Celular (revisão do Gustavo, 2026-10-26): "Família com filhos" vira "Família" (quebrava em duas linhas no seletor e no menu);
    # o botão de tema sai do topo apertado e entra no menu ☰ (no lugar do "Entrar" do menu, que agora fica no topo).
    corpo = corpo.replace('Família com filhos', 'Família').replace('FAMÍLIA COM FILHOS', 'FAMÍLIA')
    corpo = corpo.replace('<a class="so-cel" href="/entrar">Entrar</a>', TEMA_NO_MENU)
    # Par de botões (plano do beta, chamada do fim) ganha a mesma classe do par do topo, pra ficar lado a lado no celular.
    corpo = corpo.replace('<div style="display:flex;gap:10px;flex-wrap:wrap">', '<div class="btns">')
    # Imagens (2026-10-26, site rápido no celular): tudo em WebP; foto grande ganha uma versão de 800px pro celular
    # (srcset); print do app e foto fora da primeira tela carregam só quando chegam perto (lazy); a primeira foto da
    # página tem prioridade alta.
    corpo = re.sub(r'(src="/site/(?:fotos|telas)/[^"]+)\.(?:jpg|png)"', r'\1.webp"', corpo)
    def srcset(m):
        nome, larg = m.group(1), int(m.group(2))
        if larg < LARGURA_CELULAR * 1.25:
            return m.group(0)
        return f'src="/site/fotos/{nome}-{larg}.webp" srcset="/site/fotos/{nome}-{larg}-m.webp {LARGURA_CELULAR}w, /site/fotos/{nome}-{larg}.webp {larg}w" sizes="(max-width: 900px) 100vw, 60vw"'
    corpo = re.sub(r'src="/site/fotos/([^"]+)-(\d+)\.webp"', srcset, corpo)
    corpo = re.sub(r'<img (?=[^>]*data-(?:print|tela-img))(?![^>]*loading=)', '<img loading="lazy" decoding="async" ', corpo)
    corpo = re.sub(r'<img (?=[^>]*src="/site/fotos/[^"]*-(?:[6-9]\d\d|\d{4})\.webp)(?![^>]*(?:loading=|fetchpriority=))', '<img fetchpriority="high" ', corpo, count=1)
    return corpo.strip() + '\n'


def webp(im, destino):
    im.save(destino, 'WEBP', quality=QUALIDADE_WEBP, method=6)


def titulo(html):
    return re.search(r'<title>(.*?)</title>', html).group(1)


def main():
    os.makedirs(PAGINAS, exist_ok=True)
    titulos = {}
    for nome in SITE:
        html = open(os.path.join(ORIGEM, 'rascunhos', nome + '.html'), encoding='utf-8').read()
        open(os.path.join(PAGINAS, nome + '.html'), 'w', encoding='utf-8', newline='\n').write(converte(html))
        titulos[nome] = titulo(html)

    # Topo (logo, menu, Entrar) e rodapé do site, pras páginas do app que vestem a roupa do site (Termos, Privacidade:
    # src/site/MolduraSite.tsx). Saem da home, que não marca nenhum item do menu como a página atual.
    home = converte(open(os.path.join(ORIGEM, 'rascunhos', 'home.html'), encoding='utf-8').read())
    topo = re.search(r'<div class="nav">[\s\S]*?<div class="acoes">[\s\S]*?</div>\s*</div>', home).group(0)
    rodape = re.search(r'<footer class="rodape">[\s\S]*?</footer>', home).group(0)
    open(os.path.join(PAGINAS, '_topo.html'), 'w', encoding='utf-8', newline='\n').write(topo + '\n')
    open(os.path.join(PAGINAS, '_rodape.html'), 'w', encoding='utf-8', newline='\n').write(rodape + '\n')

    # Títulos das abas (o <head> do rascunho não vem junto).
    with open(os.path.join(PAGINAS, 'titulos.json'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('{\n' + ',\n'.join(f'  "{k}": "{v}"' for k, v in titulos.items()) + '\n}\n')

    css = open(os.path.join(ORIGEM, 'rascunhos', 'comum.css'), encoding='utf-8').read()
    antes = css.count('.escuro')
    css = re.sub(r'(?<![\w-])\.escuro(?=[\s{,.])', '[data-tema="escuro"]', css)
    cab = ('/* Site público e telas de acesso do Pontes: o comum.css do rascunho aprovado (hub Pontes Dev, 2026-10-26), inteiro.\n'
           '   Gerado por scripts/importarSite.py: não editar à mão (mudou o rascunho, roda o script de novo).\n'
           '   Única troca: o tema é o do app ([data-tema="escuro"] no <html>, chave v2:tema), no lugar da classe .escuro. */\n')
    open(os.path.join(WEB, 'src', 'site', 'site.css'), 'w', encoding='utf-8', newline='\n').write(cab + css + AJUSTES)

    # Imagens: logos, fotos, prints do app e a imagem de compartilhamento.
    # Os prints de celular (telas/*-movel.*) são gerados aqui (scripts/printsMoveis.mjs), não vêm do rascunho: ficam.
    moveis = {}
    if os.path.isdir(os.path.join(PUBLICO, 'telas')):
        for arq in os.listdir(os.path.join(PUBLICO, 'telas')):
            if re.search(r'-movel\.(png|webp)$', arq):
                moveis[arq] = open(os.path.join(PUBLICO, 'telas', arq), 'rb').read()
    if os.path.isdir(PUBLICO):
        shutil.rmtree(PUBLICO)
    os.makedirs(os.path.join(PUBLICO, 'fotos'))
    os.makedirs(os.path.join(PUBLICO, 'telas'))
    # Fotos: WebP no tamanho original e, nas grandes, uma versão pro celular.
    for arq in os.listdir(os.path.join(ORIGEM, 'assets', 'fotos')):
        nome, ext = os.path.splitext(arq)
        if ext.lower() not in ('.jpg', '.jpeg', '.png'):
            shutil.copy(os.path.join(ORIGEM, 'assets', 'fotos', arq), os.path.join(PUBLICO, 'fotos', arq))
            continue
        im = ImageOps.exif_transpose(Image.open(os.path.join(ORIGEM, 'assets', 'fotos', arq))).convert('RGB')
        if im.width > LARGURA_MAXIMA:
            im = im.resize((LARGURA_MAXIMA, round(im.height * LARGURA_MAXIMA / im.width)), Image.LANCZOS)
        webp(im, os.path.join(PUBLICO, 'fotos', nome + '.webp'))
        if im.width >= LARGURA_CELULAR * 1.25:
            m = im.resize((LARGURA_CELULAR, round(im.height * LARGURA_CELULAR / im.width)), Image.LANCZOS)
            webp(m, os.path.join(PUBLICO, 'fotos', nome + '-m.webp'))
    # Prints do app (computador, do rascunho) em WebP.
    for arq in os.listdir(os.path.join(ORIGEM, 'telas-app', 'proposta')):
        if arq.endswith('.png'):
            webp(Image.open(os.path.join(ORIGEM, 'telas-app', 'proposta', arq)).convert('RGB'), os.path.join(PUBLICO, 'telas', arq[:-4] + '.webp'))
    for arq in ['estaiada-laranja.svg', 'estaiada-claro.svg', 'estaiada-escuro.svg', 'estaiada-icone.svg', 'og-pontes.jpg']:
        shutil.copy(os.path.join(ORIGEM, 'assets', arq), os.path.join(PUBLICO, arq))
    for arq, dados in moveis.items():
        if arq.endswith('.png'):
            webp(Image.open(BytesIO(dados)).convert('RGB'), os.path.join(PUBLICO, 'telas', arq[:-4] + '.webp'))
        else:
            open(os.path.join(PUBLICO, 'telas', arq), 'wb').write(dados)

    sys.stdout.reconfigure(encoding='utf-8')
    print('páginas:', ', '.join(SITE))
    print('css: .escuro trocado', antes, 'vezes; sobrou', css.count('.escuro'))
    print('imagens:', sum(len(f) for _, _, f in os.walk(PUBLICO)))


if __name__ == '__main__':
    main()
