"""Traz o site público do Pontes do rascunho aprovado (hub Pontes Dev) pro app, sem redesenhar.

Fonte da verdade: E:\\VSCode\\pontes\\PontesDev\\clientes\\pontes-financas\\site (só leitura). Gera:
  - src/site/paginas/<rota>.html : o <body> de cada página do rascunho, com os links trocados pelas rotas do app,
    as imagens apontando pra /site/ e sem o que é só do rascunho (barra "Telas internas", <script>);
  - src/site/site.css            : o comum.css inteiro, com o tema do app ([data-tema="escuro"] no lugar de .escuro);
  - public/site/                 : logos, fotos, prints do app (claro/escuro) e a imagem de compartilhamento.
Rodar de novo sempre que o rascunho mudar:  python scripts/importarSite.py   (da pasta controle-financeiro.web)
"""
import os, re, shutil, sys

ORIGEM = r'E:\VSCode\pontes\PontesDev\clientes\pontes-financas\site'
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

# Ajustes pedidos pelo Gustavo direto no app, por cima do rascunho (vão no fim do site.css e sobrevivem a rodar o
# script de novo). Quando o rascunho do hub receber o mesmo ajuste, sai daqui.
AJUSTES = ""  # vazio: o rascunho já tem tudo (a logo maior de 2026-10-26 entrou no comum.css do hub)


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
    return corpo.strip() + '\n'


def titulo(html):
    return re.search(r'<title>(.*?)</title>', html).group(1)


def main():
    os.makedirs(PAGINAS, exist_ok=True)
    titulos = {}
    for nome in SITE:
        html = open(os.path.join(ORIGEM, 'rascunhos', nome + '.html'), encoding='utf-8').read()
        open(os.path.join(PAGINAS, nome + '.html'), 'w', encoding='utf-8', newline='\n').write(converte(html))
        titulos[nome] = titulo(html)

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
    if os.path.isdir(PUBLICO):
        shutil.rmtree(PUBLICO)
    shutil.copytree(os.path.join(ORIGEM, 'assets', 'fotos'), os.path.join(PUBLICO, 'fotos'))
    os.makedirs(os.path.join(PUBLICO, 'telas'))
    for arq in os.listdir(os.path.join(ORIGEM, 'telas-app', 'proposta')):
        if arq.endswith('.png'):
            shutil.copy(os.path.join(ORIGEM, 'telas-app', 'proposta', arq), os.path.join(PUBLICO, 'telas', arq))
    for arq in ['estaiada-laranja.svg', 'estaiada-claro.svg', 'estaiada-escuro.svg', 'estaiada-icone.svg', 'og-pontes.jpg']:
        shutil.copy(os.path.join(ORIGEM, 'assets', arq), os.path.join(PUBLICO, arq))

    sys.stdout.reconfigure(encoding='utf-8')
    print('páginas:', ', '.join(SITE))
    print('css: .escuro trocado', antes, 'vezes; sobrou', css.count('.escuro'))
    print('imagens:', sum(len(f) for _, _, f in os.walk(PUBLICO)))


if __name__ == '__main__':
    main()
