#!/usr/bin/env python3
"""Gera o site publicavel (17 rotas) a partir do prototipo em fonte/prototipo/.

    python3 fonte/build.py                  # producao (indexavel)
    python3 fonte/build.py --homologacao    # noindex + robots de homologacao
    python3 fonte/build.py --so-rota /o-clube/   # reconstroi uma rota so

O prototipo do Claude Design e um template: o support.js monta a pagina no
navegador a partir de marcadores {{ }}. Servir isso direto deixaria o HTML cru
cheio de {{ }} — o motivo pelo qual o handoff pede pre-renderizacao.

Aqui a montagem acontece no build, uma vez por rota, dentro de um Chromium
headless (fonte/prerender.mjs). Cada rota sai como HTML estatico no caminho
final (/unidades/cidade-continental/index.html, etc.), e o runtime volta
depois, com defer, so para reativar as interacoes. Ver o cabecalho do
fonte/prerender.mjs.

O que este arquivo faz antes de chamar o Chromium:

1. reescreve caminho relativo (img/, assets/, os .js do site) para caminho
   absoluto — as paginas moram em subpastas, entao `img/foto.webp` resolveria
   para /unidades/img/foto.webp;
2. aponta C.routes para C.paths no site-config.js, trocando os links internos
   de `unidades.dc.html` para `/unidades/`;
3. troca a Poppins do Google por uma copia local e o React do unpkg por
   vendor/, para a pagina nao depender de dominio de terceiro;
4. manda os componentes (SiteHeader, SiteFooter, PaginaMorenos) para /_dc/ e
   ensina o runtime a busca-los la, de qualquer profundidade de URL.
"""
import json
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

RAIZ = pathlib.Path(__file__).resolve().parent.parent
FONTE = RAIZ / "fonte"
PROTO = FONTE / "prototipo"
# Tudo que vai para o ar mora em public/ (e a convencao do .cpanel.yml deste
# repositorio: ele copia public/. para public_html e nada mais).
PUB = RAIZ / "public"

# Componentes: nao sao rotas, sao buscados pelo runtime em /_dc/.
COMPONENTES = ("SiteHeader", "SiteFooter", "PaginaMorenos")

# arquivo do prototipo -> caminho publicado. A ordem e a do HANDOFF.md.
ROTAS = [
    ("Home.dc.html", "index.html"),
    ("unidades.dc.html", "unidades/index.html"),
    ("cidade-continental.dc.html", "unidades/cidade-continental/index.html"),
    ("novo-horizonte-av-brasil.dc.html", "unidades/novo-horizonte-av-brasil/index.html"),
    ("novo-horizonte-av-industrial.dc.html", "unidades/novo-horizonte-av-industrial/index.html"),
    ("servicos.dc.html", "servicos/index.html"),
    ("corte-masculino.dc.html", "servicos/corte-masculino/index.html"),
    ("barboterapia.dc.html", "servicos/barboterapia/index.html"),
    ("visagismo.dc.html", "visagismo/index.html"),
    ("dia-do-noivo.dc.html", "dia-do-noivo/index.html"),
    ("o-clube.dc.html", "o-clube/index.html"),
    ("cultura.dc.html", "cultura/index.html"),
    ("corporativo.dc.html", "corporativo/index.html"),
    ("trabalhe-conosco.dc.html", "trabalhe-conosco/index.html"),
    ("politica-de-privacidade.dc.html", "politica-de-privacidade/index.html"),
    ("termos-de-uso.dc.html", "termos-de-uso/index.html"),
    # A pagina de erro e curta de proposito: minimo de texto menor.
    ("404.dc.html", "404.html", 300),
]

# Link interno do prototipo aponta para arquivo ("o-clube.dc.html"), porque e
# assim que ele e aberto no editor. No site publicado tem que ser a URL final.
# Aparece em atributo (href="Home.dc.html") e em string de logica
# ('o-clube.dc.html'), entao a troca e feita por texto, so quando vem logo
# depois de uma aspa — nunca dentro de <dc-import>, que usa nome, nao arquivo.
def troca_links(texto: str) -> str:
    for arquivo, saida, *_ in ROTAS:
        destino = "/" + saida.replace("index.html", "")
        if saida == "404.html":
            destino = "/404.html"
        for aspa in ('"', "'"):
            texto = texto.replace(aspa + arquivo, aspa + destino)
    return texto


# pastas copiadas do prototipo para a raiz publicada
# ------------------------------------------------------------- ambiente ---
# O site e publicado em dois lugares com regras OPOSTAS de indexacao:
#
#   producao      salaomorenos.com.br            entra no indice
#   homologacao   novosite.salaomorenos.com.br   NAO entra, e serve so para o
#                                                cliente aprovar
#
# Tudo que muda entre os dois sai daqui: endereco de base (canonical, og:url,
# JSON-LD, sitemap), o noindex, o robots.txt e o cabecalho HTTP. Antes, o
# noindex era injetado por JavaScript em tempo de execucao — o robo le o HTML,
# nao espera o JavaScript — e o robots de homologacao trazia "Disallow: /",
# que impede o robo de abrir a pagina e, com isso, de LER o noindex.
BASE_PRODUCAO = "https://salaomorenos.com.br"
BASE_HOMOLOGACAO = "https://novosite.salaomorenos.com.br"

# O prototipo escreve este endereco em canonical, og:url e JSON-LD.
BASE_NO_PROTOTIPO = BASE_PRODUCAO

NOINDEX = '<meta name="robots" content="noindex, nofollow">'

# Bloco que o build acrescenta ao .htaccess so em homologacao. O noindex ja vai
# no HTML; o cabecalho cobre o que nao e HTML (PDF, imagem) e vale como segunda
# tranca caso alguem publique o HTML errado.
HTACCESS_INICIO = "# >>> homologacao: inserido pelo build, nao editar a mao >>>"
HTACCESS_FIM = "# <<< homologacao <<<"
HTACCESS_HOMOLOGACAO = f"""{HTACCESS_INICIO}
# Ambiente de aprovacao. Nada daqui pode entrar no indice de busca.
<IfModule mod_headers.c>
  Header set X-Robots-Tag "noindex, nofollow"
</IfModule>
{HTACCESS_FIM}
"""


class Ambiente:
    """Decide tudo que difere entre homologacao e producao."""

    def __init__(self, homologacao: bool):
        self.homologacao = homologacao
        self.base = BASE_HOMOLOGACAO if homologacao else BASE_PRODUCAO
        self.indexavel = not homologacao

    @property
    def nome(self) -> str:
        return "homologacao" if self.homologacao else "producao"


ASSETS_PROTO = ("img", "assets")
# arquivos soltos do prototipo que vao para a raiz publicada
# Os quatro viram caminho absoluto nas paginas (elas moram em subpastas)...
JS_PAGINA = ("site-config.js", "site-loader.js", "smooth-scroll.js", "support.js")
# ...mas so estes dois sao publicados como arquivo: site-config.js e
# site-loader.js vao embutidos no <head> de cada pagina.
JS_SITE = ("smooth-scroll.js", "support.js")

FONTES_GOOGLE_RE = re.compile(
    r'<link rel="preconnect" href="https://fonts\.googleapis\.com">\s*'
    r'<link rel="preconnect" href="https://fonts\.gstatic\.com" crossorigin="">\s*'
    r'<link href="https://fonts\.googleapis\.com/css2\?family=Poppins[^"]*" rel="stylesheet">')
# A folha da Poppins bloqueava a renderizacao por uma requisicao inteira. Sao
# 3 KB: embutidos, somem da rede e o texto pinta no primeiro quadro.
FONTES_LOCAIS = "<style>/* Poppins local, embutida no build */\n__POPPINS__</style>"

# `src="img/x"`, `'img/x'`, `href="assets/y"` -> caminho absoluto.
# A aspa na frente e obrigatoria: evita estragar https://dominio/img/x.
RELATIVO_RE = re.compile(r'(["\'])(img/|assets/)')

SHIM = '''<script>
/* O runtime busca React e os componentes irmaos por aqui. `window.__resources`
   e o hook oficial (cdnScriptFor e ensureFetched em support.js): quando a URL
   pedida esta mapeada, ele carrega o caminho mapeado no lugar.
   - React sai de /vendor/ em vez do unpkg.com;
   - os componentes saem de /_dc/, que funciona em qualquer profundidade de URL
     (o padrao seria ./SiteHeader.dc.html, que em /unidades/ nao existe). */
window.__resources = {
  "https://unpkg.com/react@18.3.1/umd/react.production.min.js": "/vendor/react.production.min.js",
  "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js": "/vendor/react-dom.production.min.js",
__COMPONENTES__
};
</script>
<script src="/support.js" defer></script>'''


# O design nao traz favicon; o repositorio ja tinha os arquivos.
FAVICONS = """<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="icon" href="/favicon-192.png" sizes="192x192" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">"""

# A integracao de avaliacoes do Google e OPCIONAL e nasce DESLIGADA: por padrao
# a secao de depoimentos fica exatamente como o design a desenhou. Com
# --avaliacoes-google o build publica fonte/avaliacoes/ (o script e a rota PHP)
# e carrega o script nas paginas. Ver GOOGLE-REVIEWS-INTEGRATION.md.
SCRIPT_AVALIACOES = '<script src="/avaliacoes-google.js" defer></script>'
AVALIACOES_DIR = FONTE / "avaliacoes"

VIEWPORT = '<meta name="viewport" content="width=device-width, initial-scale=1">'

# O design usa animacao continua em varios lugares (o brilho metalico dos
# botoes, a faixa em marquise, a troca automatica das etapas). Quem pede menos
# movimento no sistema operacional tem que receber a pagina parada: a logica da
# Home ja respeita prefers-reduced-motion, as animacoes em CSS nao respeitavam.
# O support.js injeta, em toda pagina que nao tem $preview no data-props,
# FULL_PAGE_CSS: "html,body{height:100%}#dc-root,#dc-root>.sc-host{height:100%}".
# Isso serve para o canvas do Claude Design, onde a pagina ocupa a moldura.
# Publicado, prende a altura do documento no tamanho da janela: as 16 rotas
# montadas por componente (todas menos a Home, que tem $preview) ficavam sem
# rolagem nenhuma — o visitante via o hero e mais nada. O !important ganha da
# regra do runtime mesmo ela entrando depois no <head>.
ALTURA_LIVRE = ("<style>html,body{height:auto !important}"
                "#dc-root,#dc-root>.sc-host{height:auto !important}</style>")

MENOS_MOVIMENTO = """<style>@media (prefers-reduced-motion: reduce){
*,*::before,*::after{animation-duration:.01ms !important;animation-iteration-count:1 !important;
transition-duration:.01ms !important;scroll-behavior:auto !important}}</style>"""


# site-config.js e site-loader.js precisam rodar ANTES do primeiro quadro (a
# tela de abertura tem que cobrir a pagina desde o inicio), entao eram dois
# scripts bloqueantes. Embutidos, continuam rodando na mesma hora sem custar
# duas idas a rede. Juntos sao ~23 KB, ~6 KB comprimidos.
def embutir(tag: str, conteudo: str, html: str, nome: str) -> str:
    if html.count(tag) != 1:
        raise SystemExit(f"erro: esperava 1 ocorrencia de {nome} na pagina, achei {html.count(tag)}")
    if "</script" in conteudo:
        raise SystemExit(f"erro: {nome} contem '</script' e nao pode ser embutido")
    return html.replace(tag, "<script>/* " + nome + " embutido no build */\n" + conteudo + "</script>", 1)


JSONLD_RE = re.compile(r'<script type="application/ld\+json">.*?</script>', re.S)


def patch_pagina(html: str, avaliacoes: bool = False, config_js: str = "",
                 loader_js: str = "", poppins_css: str = "",
                 ambiente: "Ambiente" = None, jsonld: str = None,
                 srcsets: dict = None) -> str:
    """Prepara uma pagina do prototipo para virar pagina publicada."""
    falhas = []
    ambiente = ambiente or Ambiente(False)

    if html.count(VIEWPORT) != 1:
        falhas.append("a meta viewport")
    # O noindex entra no HTML inicial, logo depois da viewport: o robo le a
    # primeira resposta do servidor e nao executa o JavaScript da pagina.
    cabeca = (("" if ambiente.indexavel else NOINDEX + "\n")
              + FAVICONS + "\n" + ALTURA_LIVRE + "\n" + MENOS_MOVIMENTO
              + ("\n" + SCRIPT_AVALIACOES if avaliacoes else ""))
    html = html.replace(VIEWPORT, VIEWPORT + "\n" + cabeca, 1)

    # canonical, og:url e JSON-LD apontam para o ambiente em que a pagina vai
    # rodar. Em homologacao, apontar para o dominio final seria mandar o robo
    # para uma URL que ainda nao existe la.
    # (a pagina de erro nao tem canonical de proposito, e so ela)
    if '<link rel="canonical"' in html and BASE_NO_PROTOTIPO not in html:
        falhas.append(f"canonical que nao usa {BASE_NO_PROTOTIPO}")
    html = html.replace(BASE_NO_PROTOTIPO, ambiente.base)

    # Dados estruturados: o grafo escrito a mao no prototipo sai, o gerado
    # entra. Quem nao tinha grafo (as paginas juridicas) passa a ter.
    if jsonld is not None:
        quantos = len(JSONLD_RE.findall(html))
        if quantos > 1:
            falhas.append(f"{quantos} blocos JSON-LD na mesma pagina")
        elif quantos == 1:
            html = JSONLD_RE.sub(lambda _: jsonld, html, count=1)
        elif jsonld:
            html = html.replace(VIEWPORT, VIEWPORT + "\n" + jsonld, 1)

    html = troca_links(RELATIVO_RE.sub(r'\1/\2', html))

    # imagem grande ganha srcset: o celular baixa a versao do tamanho dele.
    # O <link rel=preload> da mesma imagem tem que combinar, senao o navegador
    # baixa a original pelo preload e o srcset nao serve para nada.
    for src, srcset in (srcsets or {}).items():
        def com_preload(m, _srcset=srcset):
            tag = m.group(0)
            if "imagesrcset=" in tag:
                return tag
            return tag[:-1].rstrip() + f' imagesrcset="{_srcset}" imagesizes="100vw">'
        html = re.sub(r'<link\b[^>]*rel="preload"[^>]*href="' + re.escape(src) + r'"[^>]*>',
                      com_preload, html)

    for src, srcset in (srcsets or {}).items():
        def com_srcset(m, _srcset=srcset):
            tag = m.group(0)
            if "srcset=" in tag:
                return tag
            return tag[:-1].rstrip() + f' srcset="{_srcset}" sizes="100vw">'
        html = re.sub(r'<img\b[^>]*\bsrc="' + re.escape(src) + r'"[^>]*>', com_srcset, html)

    for js in JS_PAGINA:
        html = html.replace(f'src="{js}"', f'src="/{js}"').replace(f'src="./{js}"', f'src="/{js}"')

    if not FONTES_GOOGLE_RE.search(html):
        falhas.append("links da Poppins do Google")
    html = FONTES_GOOGLE_RE.sub(lambda _: FONTES_LOCAIS.replace("__POPPINS__", poppins_css), html, count=1)

    # o smooth-scroll nao precisa rodar antes da pintura
    if html.count('<script src="/smooth-scroll.js"></script>') == 1:
        html = html.replace('<script src="/smooth-scroll.js"></script>',
                            '<script src="/smooth-scroll.js" defer></script>', 1)
    else:
        falhas.append("a tag do smooth-scroll.js")

    html = embutir('<script src="/site-config.js"></script>', config_js, html, "site-config.js")
    html = embutir('<script src="/site-loader.js"></script>', loader_js, html, "site-loader.js")

    mapa = ",\n".join(
        f'  "./{c}.dc.html": "/_dc/{c}.dc.html"' for c in COMPONENTES)
    shim = SHIM.replace("__COMPONENTES__", mapa)
    if html.count('<script src="/support.js"></script>') != 1:
        falhas.append("tag do support.js")
    html = html.replace('<script src="/support.js"></script>', shim, 1)

    if falhas:
        raise SystemExit("erro: nao achei no prototipo: " + ", ".join(falhas))
    return html


# O site-config.js vai embutido no <head> de todas as rotas. As anotacoes de
# procedencia ("validar com o cliente", "TODO: substituir...") ajudam quem
# mantem o arquivo e nao precisam viajar em 17 paginas publicas.
NOTA_JS_BLOCO = re.compile(
    r"[ \t]*/\*(?:(?!\*/).)*?(?:TODO|FIXME|needsConfirmation|com o cliente|nao usar|não usar)"
    r"(?:(?!\*/).)*?\*/[ \t]*\n?",
    re.IGNORECASE | re.DOTALL)
NOTA_JS_LINHA = re.compile(
    r"^[ \t]*//[^\n]*(?:TODO|FIXME|needsConfirmation|com o cliente|nao exibir|não exibir)[^\n]*\n",
    re.IGNORECASE | re.MULTILINE)


RECADOS_TIRADOS: list = []


def patch_config(js: str, ambiente: "Ambiente", srcsets: dict = None) -> str:
    """site-config.js: links internos para as URLs finais e caminhos absolutos."""
    js = troca_links(RELATIVO_RE.sub(r'\1/\2', js)).replace(BASE_NO_PROTOTIPO, ambiente.base)
    antes = len(js)
    js = NOTA_JS_LINHA.sub("", NOTA_JS_BLOCO.sub("", js))
    RECADOS_TIRADOS.append(("site-config.js", 1 if len(js) < antes else 0))

    agulha = "  C.locations = ["
    if js.count(agulha) != 1:
        raise SystemExit("erro: nao achei C.locations no site-config.js")
    # mapa de imagens responsivas, para o componente que monta o src por
    # template (o hero do PaginaMorenos) poder usar o mesmo srcset
    js = js.replace(agulha, "  C.imagens = " + json.dumps(srcsets or {}, ensure_ascii=False)
                    + ";  // gerado no build\n\n" + agulha, 1)
    ponte = (
        "  // --- aplicado no build (fonte/build.py) ---\n"
        "  // No prototipo, C.routes aponta para arquivos (unidades.dc.html) porque\n"
        "  // e assim que ele e aberto. No site publicado, link interno tem que ser\n"
        "  // a URL final — que ja esta pronta em C.paths.\n"
        "  C.routes = C.paths;\n\n")
    js = js.replace(agulha, ponte + agulha, 1)

    # A tela de abertura do prototipo reaparece a cada carga de pagina. Num
    # site de 17 rotas isso significa ver a intro em toda navegacao interna e a
    # cada volta para a aba. Uma vez por sessao e o comportamento certo em
    # producao (o proprio prototipo ja preve a chave).
    # Com a espera real pela pagina pronta, o teto vira rede de seguranca.
    js = js.replace("maximumVisibleTime: 4500", "maximumVisibleTime: 9000", 1)

    antes = "showOncePerSession: false"
    if antes not in js:
        raise SystemExit("erro: nao achei C.loader.showOncePerSession no site-config.js")
    js = js.replace(antes, "showOncePerSession: true", 1)

    estagio = ambiente.nome
    js, n = re.subn(r"stage: /novosite\\\./\.test\(location\.hostname\) \? 'homologacao' : 'producao',",
                    f"stage: '{estagio}',  // fixado no build", js, count=1)
    if not n:
        js, n = re.subn(r"stage: [^,]+,", f"stage: '{estagio}',  // fixado no build", js, count=1)
    if not n:
        raise SystemExit("erro: nao achei C.env.stage no site-config.js")
    return js


# --------------------------------------------------- tela de abertura ------
# O prototipo mostra a intro so na primeira pagina da sessao; da segunda em
# diante faz um fade de 0,22s, sem marca. Num site de 17 rotas isso significa
# marca na entrada e nada em toda navegacao interna.
#
# Aqui a MESMA tela passa a aparecer em toda carga, mas em dois tempos:
#   - 1a carga da sessao: intro completa (logo entrando, crescendo, 1,2s minimo);
#   - demais cargas: modo curto — a logo entra na hora e a tela sai assim que a
#     pagina esta pronta, sem espera minima. Na pratica ~0,5s, o suficiente para
#     cobrir o branco entre paginas sem cobrar tempo de quem clicou.
#
# Voltar para a aba nao dispara nada: o navegador restaura a pagina do cache,
# sem reexecutar o script.

LOADER_ESPERA_DE = """  // window.load não entra: esperaria imagens fora da primeira dobra
  var tudo = Promise.allSettled ? Promise.allSettled([domPronto, logoPronta, fontes, hero])
    : Promise.all([domPronto, logoPronta, fontes, hero].map(function (p) { return Promise.resolve(p).catch(function () {}); }));"""

LOADER_ESPERA_PARA = """  // A tela só sai com a PÁGINA PRONTA (ajuste do build). Três sinais além do
  // que o protótipo já esperava:
  //
  //   carregou  window.load — folhas de estilo, scripts e as imagens que a
  //             página realmente busca. Imagem lazy, fora da dobra, não entra
  //             (o navegador só a busca na rolagem), então isto não vira espera
  //             eterna.
  //   montado   a troca das duas camadas. A página publicada nasce como cópia
  //             estática e o runtime do Claude Design monta a versão viva por
  //             cima; `html.mo-vivo` é o sinal de que a troca aconteceu. Sem
  //             esperar por ele, o visitante via a troca depois da tela sumir.
  //
  // Os dois têm rede de segurança própria, e o teto de tempo (maximumVisibleTime)
  // continua valendo: a tela nunca prende o site.
  var montado = new Promise(function (r) {
    var raiz = document.documentElement;
    if (raiz.classList.contains('mo-vivo')) return r();
    var obs = new MutationObserver(function () {
      if (raiz.classList.contains('mo-vivo')) { obs.disconnect(); r(); }
    });
    obs.observe(raiz, { attributes: true, attributeFilter: ['class'] });
    // sem runtime (JS bloqueado, erro de rede) a cópia estática é a página:
    // não faz sentido segurar a tela esperando uma troca que não vem
    setTimeout(function () { obs.disconnect(); r(); }, 3500);
  });
  // window.load espera TODA imagem que a pagina comecou a buscar, inclusive a
  // que esta a tres rolagens de distancia. Numa rede de celular isso chegou a
  // 6s com a tela de abertura na frente do conteudo — o preloader deixou de
  // cobrir o carregamento e virou o carregamento. A espera continua, com
  // teto: 1,5s depois de o resto estar pronto, a tela sai de qualquer forma.
  // O que o visitante ve ja esta pintado; o que falta e rodape.
  var carregouComTeto = Promise.race([carregou, espera(1500)]);
  var sinais = [domPronto, logoPronta, fontes, hero, carregouComTeto, montado];
  var tudo = Promise.allSettled ? Promise.allSettled(sinais)
    : Promise.all(sinais.map(function (p) { return Promise.resolve(p).catch(function () {}); }));"""

# `carregou` e declarado depois na ordem original; sobe para antes do uso
LOADER_ORDEM_DE = """  var carregou = document.readyState === 'complete' ? Promise.resolve() : new Promise(function (r) { window.addEventListener('load', r, { once: true }); });

"""
LOADER_ORDEM_PARA = ""

LOADER_CARREGOU_DE = """  var hero = new Promise(function (resolve) {"""
LOADER_CARREGOU_PARA = """  var carregou = document.readyState === 'complete' ? Promise.resolve() : new Promise(function (r) { window.addEventListener('load', r, { once: true }); });
  var hero = new Promise(function (resolve) {"""

# Teto maior: agora a espera e real, e o teto e so rede de seguranca.
LOADER_TETO_DE = """      minimumVisibleTime: 0,      // sai no instante em que a página fica pronta
      maximumVisibleTime: 1800,   // teto baixo: navegação interna é rápida"""
LOADER_TETO_PARA = """      minimumVisibleTime: 0,      // sem espera artificial: sai quando ficar pronta
      maximumVisibleTime: 3500,   // rede de segurança, não alvo"""

LOADER_CURTO_DE = """  // Navegação interna: só um fade curto de entrada, sem logo.
  if (C.showOncePerSession && lerVisto()) {
    var f = document.createElement('style');
    f.textContent = reduz ? '' : '@keyframes slPageIn{from{opacity:0}to{opacity:1}}body{animation:slPageIn .22s ease both}';
    document.head.appendChild(f);
    return;
  }"""

LOADER_CURTO_PARA = """  // MODO CURTO (aplicado no build, ver fonte/build.py).
  // Primeira carga da sessão: intro completa. Da segunda em diante — navegação
  // interna, voltar, abrir outra página do site — a MESMA tela aparece, só que
  // a logo entra na hora e a tela sai assim que a página fica pronta, sem
  // espera mínima. Mantém a marca em toda navegação sem cobrar 1,2s por clique.
  var curto = !!lerVisto();
  if (curto) {
    C = {
      showOncePerSession: C.showOncePerSession, sessionKey: C.sessionKey,
      logo: C.logo, logoW: C.logoW, logoH: C.logoH,
      minimumVisibleTime: 0,      // sai no instante em que a página fica pronta
      maximumVisibleTime: 1800,   // teto baixo: navegação interna é rápida
      exitDuration: 260,
    };
  }"""

LOADER_ANIM_DE = ("animation:slLogoIn .95s cubic-bezier(.22,.61,.36,1) both,"
                  "slGrow 3.2s cubic-bezier(.33,0,.2,1) .95s forwards}',")
LOADER_ANIM_PARA = ("animation:' + (curto ? 'slLogoIn .42s cubic-bezier(.22,.61,.36,1) both' : "
                    "'slLogoIn .95s cubic-bezier(.22,.61,.36,1) both,"
                    "slGrow 3.2s cubic-bezier(.33,0,.2,1) .95s forwards') + '}',")

LOADER_BRILHO_DE = "animation:slShine 2.2s linear .35s infinite}',"
LOADER_BRILHO_PARA = "animation:slShine 2.2s linear ' + (curto ? '0s' : '.35s') + ' infinite}',"

# a pausa de 380ms antes da saida e a parte mais visivel da espera
LOADER_PAUSA_DE = """    var dur = reduz ? 250 : C.exitDuration;"""
LOADER_PAUSA_PARA = """    var dur = reduz ? 250 : C.exitDuration;
    var pausa = reduz ? 0 : (curto ? 100 : 240);   // modo curto quase nao pausa"""

PATCHES_LOADER = [
    (LOADER_CURTO_DE, LOADER_CURTO_PARA, "modo curto na navegacao interna"),
    (LOADER_ORDEM_DE, LOADER_ORDEM_PARA, "remocao do carregou fora de ordem"),
    (LOADER_CARREGOU_DE, LOADER_CARREGOU_PARA, "carregou declarado antes do uso"),
    (LOADER_ESPERA_DE, LOADER_ESPERA_PARA, "espera pela pagina carregada e pela troca de camadas"),
    (LOADER_TETO_DE, LOADER_TETO_PARA, "teto de tempo como rede de seguranca"),
    (LOADER_ANIM_DE, LOADER_ANIM_PARA, "entrada da logo mais rapida no modo curto"),
    (LOADER_BRILHO_DE, LOADER_BRILHO_PARA, "brilho da logo sem atraso no modo curto"),
    (LOADER_PAUSA_DE, LOADER_PAUSA_PARA, "pausa de saida encurtada no modo curto"),
    ("    }, reduz ? 0 : 380);", "    }, pausa);", "saida usa a pausa do modo"),
    ("    }, dur + 140 + (reduz ? 0 : 380));", "    }, dur + 140 + pausa);", "remocao usa a pausa do modo"),
]


def patch_loader(js: str) -> str:
    """Liga o modo curto da tela de abertura."""
    for agulha, troca, nome in PATCHES_LOADER:
        if js.count(agulha) != 1:
            raise SystemExit(
                f"erro: nao achei '{nome}' no site-loader.js ({js.count(agulha)} ocorrencias).\n"
                f"       O design mudou? Ajuste PATCHES_LOADER em fonte/build.py.")
        js = js.replace(agulha, troca, 1)
    return js


# ------------------------------------------- maquete do celular -----------
# A Home tem a secao da maquete do agendamento; a pagina /o-clube/ nao tinha,
# porque ela e montada pelo PaginaMorenos, que nao conhecia esse tipo de secao.
# Os recortes em fonte/maquete/ (markup, logica e keyframes, tirados da Home)
# sao injetados aqui. Ver fonte/maquete/LEIA-ME.md.
MAQUETE_DIR = FONTE / "maquete"

# onde encaixar o markup: logo antes do bloco do Clube
MAQUETE_ANCORA_MARKUP = '  <sc-if value="{{ s.isClube }}">'
# onde encaixar os metodos: antes do componentDidMount da classe
MAQUETE_ANCORA_LOGICA = "  componentDidMount() {"
# onde declarar os valores que a secao usa (o PaginaMorenos so devolve secoes)
MAQUETE_ANCORA_VALORES = "    return { secoes };"
# a maquete entra logo depois do hero da pagina do Clube, antes do "como funciona"
MAQUETE_ANCORA_PAGINA = "        { tipo: 'passos', id: 'como-funciona',"


def patch_maquete(js: str) -> str:
    """Leva a maquete do celular da Home para a pagina do Clube."""
    markup = (MAQUETE_DIR / "secao.html").read_text(encoding="utf-8").rstrip()
    logica = (MAQUETE_DIR / "logica.js").read_text(encoding="utf-8").rstrip()
    keyframes = (MAQUETE_DIR / "keyframes.css").read_text(encoding="utf-8").strip()

    for agulha, nome in ((MAQUETE_ANCORA_MARKUP, "o bloco do Clube"),
                         (MAQUETE_ANCORA_LOGICA, "o componentDidMount"),
                         (MAQUETE_ANCORA_VALORES, "o mapa de secoes do renderVals"),
                         (MAQUETE_ANCORA_PAGINA, "a pagina do Clube")):
        if js.count(agulha) != 1:
            raise SystemExit(
                f"erro: a maquete nao encontrou {nome} no PaginaMorenos.dc.html "
                f"({js.count(agulha)} ocorrencias). O design mudou? Ver fonte/maquete/LEIA-ME.md.")

    # 1) markup: as animacoes cine* so existem no <style> da Home, entao vao
    #    junto, dentro da propria secao.
    secao = ('  <sc-if value="{{ s.isMaquete }}">\n'
             '    <style>\n      /* animacoes da maquete (vieram do <helmet> da Home) */\n      '
             + keyframes.replace("\n", "\n      ") + "\n    </style>\n"
             + markup + "\n  </sc-if>\n\n")
    js = js.replace(MAQUETE_ANCORA_MARKUP, secao + MAQUETE_ANCORA_MARKUP, 1)

    # 2) logica: os quatro refs da Home
    js = js.replace(MAQUETE_ANCORA_LOGICA,
                    "  // --- maquete do celular (recorte da Home, injetado no build) ---\n"
                    + logica + "\n\n" + MAQUETE_ANCORA_LOGICA, 1)

    # 3) valores que o markup usa e o PaginaMorenos ainda nao tinha
    valores = """    return {
      secoes,
      // --- valores da maquete do celular (injetados no build) ---
      cineRef: this.cineRef,
      cardRef: this.cardRef,
      sheenRef: this.sheenRef,
      phoneRef: this.phoneRef,
      heroAlign: this.state.w < 760 ? 'center' : 'flex-start',
      heroTexto: this.state.w < 760 ? 'center' : 'left',
      clubeHref: M.links.membership,
      waVisitante: M.waLink(),
      trackClube: () => M.track('membership_click', { origem: 'o-clube-maquete' }),
      trackWa: () => M.track('whatsapp_click', { origem: 'o-clube-maquete' }),
    };"""
    js = js.replace(MAQUETE_ANCORA_VALORES, valores, 1)

    # 4) a secao entra na lista da pagina do Clube
    js = js.replace(MAQUETE_ANCORA_PAGINA,
                    "        { isMaquete: true, id: 'maquete' },\n" + MAQUETE_ANCORA_PAGINA, 1)
    return js


# Recados internos ("TODO: confirmar com cliente ...") sao uteis no fonte e
# nao tem lugar no HTML publicado: quem abre o codigo-fonte da pagina le a
# lista de pendencias da agencia. Ficam em fonte/PENDENCIAS.md.
RECADO_RE = re.compile(
    r"[ \t]*<!--(?:(?!-->).)*?(?:TODO|FIXME|needsConfirmation|confirmar com cliente|pendente de)"
    r"(?:(?!-->).)*?-->[ \t]*\n?",
    re.IGNORECASE | re.DOTALL)


def tira_recados(html: str, onde: str) -> str:
    html = NOTA_JS_LINHA.sub("", NOTA_JS_BLOCO.sub("", html))
    achados = RECADO_RE.findall(html)
    for a in achados:
        if "<script" in a.lower():
            raise SystemExit(f"erro: comentario suspeito em {onde} envolve um <script>: {a[:80]!r}")
    RECADOS_TIRADOS.append((onde, len(achados)))
    return RECADO_RE.sub("", html)


def monta_palco(palco: pathlib.Path, ambiente: Ambiente, avaliacoes: bool) -> None:
    """Monta a arvore que o Chromium vai enxergar — igual a publicada."""
    # as imagens entram primeiro: as variantes responsivas precisam existir
    # antes de as paginas serem escritas (e o srcset delas vai no HTML)
    for pasta in ASSETS_PROTO:
        shutil.copytree(PROTO / pasta, palco / pasta)
    srcsets = gera_variantes(palco)

    (palco / "_dc").mkdir(parents=True)
    # o hero do PaginaMorenos monta o src por template ({{ s.foto }}), entao o
    # srcset de la e resolvido no proprio componente, em renderVals
    for c in COMPONENTES:
        texto = (PROTO / f"{c}.dc.html").read_text(encoding="utf-8")
        if c == "PaginaMorenos":
            texto = patch_maquete(texto)
        texto = troca_links(RELATIVO_RE.sub(r'\1/\2', texto)).replace(
            BASE_NO_PROTOTIPO, ambiente.base)
        (palco / "_dc" / f"{c}.dc.html").write_text(
            tira_recados(texto, f"{c}.dc.html"), encoding="utf-8")

    config_js = patch_config((PROTO / "site-config.js").read_text(encoding="utf-8"), ambiente, srcsets)
    loader_js = patch_loader((PROTO / "site-loader.js").read_text(encoding="utf-8"))
    poppins_css = (PUB / "fonts" / "poppins.css").read_text(encoding="utf-8")

    cfg = le_config_json()
    for arquivo, saida, *_ in ROTAS:
        alvo = palco / arquivo
        alvo.write_text(
            tira_recados(patch_pagina((PROTO / arquivo).read_text(encoding="utf-8"), avaliacoes,
                                      config_js, loader_js, poppins_css, ambiente,
                                      grafo_da_rota(saida, ambiente, cfg), srcsets), arquivo),
            encoding="utf-8")

    shutil.copy2(PROTO / "smooth-scroll.js", palco / "smooth-scroll.js")
    shutil.copy2(PROTO / "support.js", palco / "support.js")

    # Durante a pre-renderizacao, /api/google-reviews nao existe: o script real
    # pintaria o estado de erro e ele ficaria congelado no HTML. O palco recebe
    # um stub, e a copia estatica guarda a secao como o design a desenhou. O
    # script de verdade (public/avaliacoes-google.js) so roda no site no ar.
    if avaliacoes:
        (palco / "avaliacoes-google.js").write_text(
            "/* stub de build: o script real roda so no site publicado */\n", encoding="utf-8")


    # A logo da tela de abertura vem com 720px e nunca passa de 200px na tela —
    # e esta no caminho critico, porque a tela espera por ela. Reduzida para
    # 400px e com o RGB achatado (so o alfa importa: e mascara CSS), cai 78%.
    logo = palco / "assets" / "morenos-loader-outline-white.webp"
    if logo.exists():
        r = subprocess.run(["node", str(FONTE / "scripts" / "reduzir-imagem.mjs"),
                            str(logo), str(logo), "400", "0.8", "--mascara"],
                           cwd=RAIZ, capture_output=True, text=True)
        print("  " + (r.stdout.strip() or "aviso: nao consegui reduzir a logo da abertura"))
    shutil.copytree(PUB / "fonts", palco / "fonts")
    shutil.copytree(PUB / "vendor", palco / "vendor")


def publica_estaticos(palco: pathlib.Path, ambiente: Ambiente, avaliacoes: bool, rotas) -> None:
    """Copia para a raiz do repositorio tudo que nao e pagina."""
    for pasta in (*ASSETS_PROTO, "_dc"):
        destino = PUB / pasta
        if destino.exists():
            shutil.rmtree(destino)
        shutil.copytree(palco / pasta, destino)
    for js in JS_SITE:
        shutil.copy2(palco / js, PUB / js)

    # Integracao de avaliacoes: publicada so quando pedida; caso contrario, o
    # que por acaso tenha sobrado de um build anterior sai de public/.
    destino_js = PUB / "avaliacoes-google.js"
    destino_api = PUB / "api"
    if avaliacoes:
        shutil.copy2(AVALIACOES_DIR / "avaliacoes-google.js", destino_js)
        if destino_api.exists():
            shutil.rmtree(destino_api)
        shutil.copytree(AVALIACOES_DIR / "api", destino_api)
    else:
        destino_js.unlink(missing_ok=True)
        if destino_api.exists():
            shutil.rmtree(destino_api)

    # site-config.js e site-loader.js passaram a ir embutidos nas paginas: se
    # sobraram de um build anterior, saem — arquivo orfao em producao so
    # confunde quem for depurar.
    for orfao in ("site-config.js", "site-loader.js"):
        (PUB / orfao).unlink(missing_ok=True)

    (PUB / "robots.txt").write_text(gera_robots(ambiente), encoding="utf-8")

    # O sitemap provisorio nao existe: em homologacao nao ha sitemap para
    # ninguem enviar ao Search Console por engano.
    destino_sitemap = PUB / "sitemap.xml"
    if ambiente.indexavel:
        destino_sitemap.write_text(gera_sitemap(ambiente, rotas), encoding="utf-8")
    else:
        destino_sitemap.unlink(missing_ok=True)

    ajusta_htaccess(ambiente)


# -------------------------------------------------- imagens responsivas ---
# A foto de abertura tem 1672px de largura e e a maior imagem do site. Num
# celular de 390px ela nunca precisa de mais que ~800px, e o navegador baixa
# os 143 KB inteiros assim mesmo — na imagem que decide o LCP. As variantes
# sao geradas aqui, no build, pelo mesmo reencodador da logo da abertura.
VARIANTES = {
    # caminho no palco: largura real do arquivo + larguras a gerar
    "img/hero-wide.webp": (1672, [900, 1200]),
}


def gera_variantes(palco: pathlib.Path) -> dict:
    """Reencoda as imagens grandes em larguras menores. Devolve o srcset pronto."""
    srcsets = {}
    for caminho, (largura_real, larguras) in VARIANTES.items():
        origem = palco / caminho
        if not origem.exists():
            print(f"  aviso: {caminho} nao existe no palco")
            continue
        partes = []
        for largura in larguras:
            saida = origem.with_name(f"{origem.stem}-{largura}{origem.suffix}")
            r = subprocess.run(
                ["node", str(FONTE / "scripts" / "reduzir-imagem.mjs"),
                 str(origem), str(saida), str(largura), "0.82"],
                capture_output=True, text=True, cwd=RAIZ)
            if r.returncode != 0 or not saida.exists():
                print(f"  aviso: nao consegui gerar {saida.name}")
                continue
            partes.append((f"/{pathlib.PurePosixPath(caminho).parent}/{saida.name}", largura))
            linha = (r.stdout.strip().splitlines() or [""])[-1]
            if linha:
                print("  " + linha)
        if not partes:
            continue
        partes.append((f"/{caminho}", largura_real))
        srcsets["/" + caminho] = ", ".join(f"{u} {w}w" for u, w in partes)
    return srcsets


def data_da_rota(arquivos: list) -> str:
    """Data do ultimo commit que mexeu no conteudo desta rota (AAAA-MM-DD).

    lastmod so vale se for verdade. Carimbar a data do build em todas as URLs a
    cada publicacao e ruido: diz "mudou" para dezesseis paginas quando mudou
    uma. Aqui a data vem do git, do ultimo commit que tocou os arquivos que
    compoem aquela rota. Sem git (ou arquivo sem historico), a rota sai sem
    lastmod — melhor nenhum do que inventado.
    """
    existentes = [a for a in arquivos if (RAIZ / a).exists()]
    if not existentes:
        return ""
    try:
        r = subprocess.run(["git", "-C", str(RAIZ), "log", "-1", "--format=%cs", "--"] + existentes,
                           capture_output=True, text=True, timeout=20)
    except Exception:
        return ""
    return r.stdout.strip() if r.returncode == 0 else ""


def gera_sitemap(ambiente: Ambiente, rotas) -> str:
    """Sitemap a partir das ROTAS reais, nao de um arquivo escrito a mao.

    So entra URL canonica, indexavel e que existe em disco. Fica de fora: a
    pagina de erro (noindex), qualquer rota com noindex e qualquer URL que o
    build nao tenha gerado.
    """
    linhas = ['<?xml version="1.0" encoding="UTF-8"?>',
              '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for entrada in rotas:
        origem, destino = entrada[0], entrada[1]
        if destino == "404.html":
            continue
        caminho = "" if destino == "index.html" else destino[: -len("index.html")]
        url = f"{ambiente.base}/{caminho}"
        # o que compoe ESTA rota: o arquivo dela, os dados e os componentes que
        # ela realmente usa (a Home nao passa pelo PaginaMorenos)
        arquivos = [f"fonte/prototipo/{origem}", "fonte/prototipo/site-config.js",
                    "fonte/prototipo/SiteHeader.dc.html", "fonte/prototipo/SiteFooter.dc.html"]
        if origem != "Home.dc.html":
            arquivos.append("fonte/prototipo/PaginaMorenos.dc.html")
        data = data_da_rota(arquivos)
        linhas.append(f"  <url><loc>{url}</loc>" + (f"<lastmod>{data}</lastmod>" if data else "") + "</url>")
    linhas.append("</urlset>")
    return "\n".join(linhas) + "\n"


def gera_robots(ambiente: Ambiente) -> str:
    """robots.txt por ambiente.

    Homologacao LIBERA o rastreio de proposito. "Disallow: /" nao tira nada do
    indice: ele impede o robo de abrir a pagina e, sem abrir, o robo nunca le o
    noindex — a URL pode continuar aparecendo na busca, so que sem titulo nem
    descricao. Para nao aparecer, o robo precisa ENTRAR e LER o noindex.
    """
    if ambiente.homologacao:
        return ("# Ambiente de aprovacao (nao e o site publico).\n"
                "# O rastreio fica liberado de proposito: e assim que o robo le o\n"
                "# noindex que cada pagina traz no <head> e no cabecalho HTTP.\n"
                "# Sem Sitemap: aqui — o sitemap definitivo e o do dominio final.\n"
                "User-agent: *\n"
                "Allow: /\n")
    return ("User-agent: *\n"
            "Allow: /\n"
            "\n"
            f"Sitemap: {ambiente.base}/sitemap.xml\n")


def ajusta_htaccess(ambiente: Ambiente) -> None:
    """Liga/desliga o bloco de homologacao do .htaccess publicado."""
    arquivo = PUB / ".htaccess"
    if not arquivo.exists():
        return
    texto = arquivo.read_text(encoding="utf-8")
    inicio = texto.find(HTACCESS_INICIO)
    if inicio != -1:
        fim = texto.find(HTACCESS_FIM, inicio)
        if fim == -1:
            raise SystemExit("erro: bloco de homologacao do .htaccess sem fim; conserte a mao.")
        texto = texto[:inicio] + texto[fim + len(HTACCESS_FIM):].lstrip("\n")
    if ambiente.homologacao:
        texto = HTACCESS_HOMOLOGACAO + "\n" + texto
    arquivo.write_text(texto, encoding="utf-8")


# --------------------------------------------- dados estruturados (JSON-LD) -
# Antes, cada pagina trazia o grafo escrito a mao. O mesmo lugar real aparecia
# com @id diferente em paginas diferentes (a Home chamava a unidade de
# "/#cidade-continental" e a pagina dela de ".../cidade-continental/#unidade"),
# e na Home a propriedade url de cada unidade apontava para a home. Para um
# buscador, isso e um lugar em cada pagina, nenhum deles com endereco proprio.
#
# Agora o grafo e gerado aqui, a partir do site-config.js — a mesma fonte dos
# enderecos que aparecem na tela. Um @id por entidade, igual em todas as rotas.
#
# O que NAO entra, de proposito: telefone por unidade (o WhatsApp e central, e
# dizer que e da unidade seria afirmar o que ninguem confirmou), horario por
# unidade (vem do site antigo, sem confirmacao), coordenada (ninguem mediu),
# foto de fachada nao confirmada, preco, nota e avaliacao.

TRILHAS = {
    "unidades/index.html": [("Unidades", "unidades/")],
    "unidades/cidade-continental/index.html": [("Unidades", "unidades/"), ("Cidade Continental", "unidades/cidade-continental/")],
    "unidades/novo-horizonte-av-brasil/index.html": [("Unidades", "unidades/"), ("Novo Horizonte — Av. Brasil", "unidades/novo-horizonte-av-brasil/")],
    "unidades/novo-horizonte-av-industrial/index.html": [("Unidades", "unidades/"), ("Novo Horizonte — Av. Industrial", "unidades/novo-horizonte-av-industrial/")],
    "servicos/index.html": [("Serviços", "servicos/")],
    "servicos/corte-masculino/index.html": [("Serviços", "servicos/"), ("Corte Masculino", "servicos/corte-masculino/")],
    "servicos/barboterapia/index.html": [("Serviços", "servicos/"), ("Barboterapia", "servicos/barboterapia/")],
    "visagismo/index.html": [("Serviços", "servicos/"), ("Visagismo", "visagismo/")],
    "dia-do-noivo/index.html": [("Serviços", "servicos/"), ("Dia do Noivo", "dia-do-noivo/")],
    "o-clube/index.html": [("O Clube", "o-clube/")],
    "cultura/index.html": [("Sobre a Morenos", "cultura/")],
    "corporativo/index.html": [("Corporativo", "corporativo/")],
    "trabalhe-conosco/index.html": [("Trabalhe Conosco", "trabalhe-conosco/")],
    "politica-de-privacidade/index.html": [("Política de Privacidade", "politica-de-privacidade/")],
    "termos-de-uso/index.html": [("Termos de Uso", "termos-de-uso/")],
}

# Pagina de servico -> como o servico se chama no grafo. So as quatro que tem
# pagina propria; o catalogo inteiro vive na pagina de servicos, como texto.
SERVICOS_NO_GRAFO = {
    "servicos/corte-masculino/index.html": ("Corte masculino", "Corte de cabelo masculino"),
    "servicos/barboterapia/index.html": ("Barboterapia", "Cuidado completo com a barba"),
    "visagismo/index.html": ("Visagismo", "Consultoria de visagismo masculino"),
    "dia-do-noivo/index.html": ("Dia do Noivo", "Atendimento de noivo para casamento"),
}

UNIDADE_POR_ROTA = {
    "unidades/cidade-continental/index.html": "cidade-continental",
    "unidades/novo-horizonte-av-brasil/index.html": "novo-horizonte-av-brasil",
    "unidades/novo-horizonte-av-industrial/index.html": "novo-horizonte-av-industrial",
}


def le_config_json() -> dict:
    """Os dados do site-config.js, em Python, pela unica fonte que existe."""
    r = subprocess.run(["node", str(FONTE / "scripts" / "dump-config.mjs")],
                       capture_output=True, text=True, cwd=RAIZ)
    if r.returncode != 0:
        raise SystemExit("erro: nao consegui ler o site-config.js:\n" + (r.stderr or "").strip())
    return json.loads(r.stdout)


def _id_org(base: str) -> str:
    return f"{base}/#organizacao"


def _unidade_no_grafo(base: str, l: dict) -> dict:
    endereco = {
        "@type": "PostalAddress",
        "streetAddress": l["logradouro"] + (f", {l['numero']}" if l.get("numero") else ""),
        "addressLocality": l["cidade"],
        "addressRegion": l["estado"],
        "postalCode": l["cep"],
        "addressCountry": "BR",
    }
    no = {
        "@type": "HairSalon",
        "@id": f"{base}/unidades/{l['id']}/#unidade",
        "name": l["nome"],
        "url": f"{base}/unidades/{l['id']}/",
        "address": endereco,
        "areaServed": "Serra, ES",
        "parentOrganization": {"@id": _id_org(base)},
    }
    # imagem so quando o cliente confirmou que a foto e daquele endereco
    if l.get("fotoConfirmada") and l.get("foto"):
        no["image"] = f"{base}/{l['foto'].lstrip('/')}"
    if l.get("googleProfile"):
        no["hasMap"] = l["googleProfile"]
    return no


def grafo_da_rota(saida: str, ambiente: Ambiente, cfg: dict) -> str:
    """O JSON-LD de uma rota. Vazio quando a rota nao deve declarar nada."""
    if saida == "404.html":
        return ""
    base = ambiente.base
    unidades = cfg["locations"]
    org = {
        "@type": "Organization",
        "@id": _id_org(base),
        "name": cfg["brand"]["name"] if isinstance(cfg.get("brand"), dict) and cfg["brand"].get("name") else "Salão Morenos",
        "url": f"{base}/",
        "logo": f"{base}/favicon-192.png",
        "areaServed": "Serra, ES",
        "contactPoint": {
            "@type": "ContactPoint",
            "contactType": "customer service",
            "telephone": "+" + cfg["whatsapp"]["phone"],
            "availableLanguage": "pt-BR",
        },
        "subOrganization": [{"@id": f"{base}/unidades/{l['id']}/#unidade"} for l in unidades],
    }
    site = {
        "@type": "WebSite",
        "@id": f"{base}/#site",
        "url": f"{base}/",
        "name": "Salão Morenos",
        "inLanguage": "pt-BR",
        "publisher": {"@id": _id_org(base)},
    }
    grafo = [org, site]

    if saida == "index.html":
        grafo += [_unidade_no_grafo(base, l) for l in unidades]

    trilha = TRILHAS.get(saida)
    if trilha:
        caminho = "" if saida == "index.html" else saida[: -len("index.html")]
        itens = [{"@type": "ListItem", "position": 1, "name": "Início", "item": f"{base}/"}]
        for i, (nome, c) in enumerate(trilha, start=2):
            itens.append({"@type": "ListItem", "position": i, "name": nome, "item": f"{base}/{c}"})
        grafo.append({
            "@type": "BreadcrumbList",
            "@id": f"{base}/{caminho}#trilha",
            "itemListElement": itens,
        })

    # /unidades/ e o indice das tres: a lista liga o hub as paginas por @id,
    # em vez de descrever as unidades de novo.
    if saida == "unidades/index.html":
        grafo.append({
            "@type": "ItemList",
            "@id": f"{base}/unidades/#lista",
            "name": "Unidades do Salão Morenos em Serra",
            "itemListElement": [
                {"@type": "ListItem", "position": i,
                 "item": {"@id": f"{base}/unidades/{l['id']}/#unidade"}}
                for i, l in enumerate(unidades, start=1)
            ],
        })

    unidade = UNIDADE_POR_ROTA.get(saida)
    if unidade:
        grafo.append(_unidade_no_grafo(base, next(l for l in unidades if l["id"] == unidade)))

    servico = SERVICOS_NO_GRAFO.get(saida)
    if servico:
        caminho = saida[: -len("index.html")]
        nome, tipo = servico
        # sem availableAtOrFrom: nem todo servico esta em todas as unidades, e
        # a lista por unidade ainda nao foi confirmada pelo cliente.
        grafo.append({
            "@type": "Service",
            "@id": f"{base}/{caminho}#servico",
            "name": nome,
            "serviceType": tipo,
            "url": f"{base}/{caminho}",
            "provider": {"@id": _id_org(base)},
            "areaServed": "Serra, ES",
        })

    corpo = json.dumps({"@context": "https://schema.org", "@graph": grafo},
                       ensure_ascii=False, separators=(",", ":"))
    return '<script type="application/ld+json">' + corpo + '</script>'


# Arquivos que o .htaccess bloqueia de proposito.
BLOQUEIO_ESPERADO = {".htaccess", ".gitignore", ".cpanel.yml", "config.php"}


def confere_htaccess() -> None:
    """Nenhum arquivo que o site serve pode cair numa regra de bloqueio.

    Isto ja aconteceu: o .htaccess herdado bloqueava `*.dc.html`, e os
    componentes de /_dc/ — que o NAVEGADOR busca em tempo de execucao — voltavam
    403. O cabecalho e o rodape apareciam vazios e as paginas internas ficavam
    sem corpo. O checar.mjs nao pega isso, porque serve os arquivos por Node, sem
    Apache. Entao a conferencia e aqui, lendo as regras e testando nome por nome.
    """
    arquivo = PUB / ".htaccess"
    if not arquivo.exists():
        print("  aviso: public/.htaccess nao existe; nada a conferir")
        return
    texto = arquivo.read_text(encoding="utf-8")

    # Regras dentro de <IfModule !algo> so valem quando o modulo falta: ignorar.
    texto = re.sub(r"<IfModule\s+![^>]*>.*?</IfModule>", "", texto, flags=re.S | re.I)

    padroes = []
    for tag, literal in (("FilesMatch", False), ("Files", True)):
        for m in re.finditer(rf'<{tag}\s+"([^"]+)"\s*>(.*?)</{tag}>', texto, re.S | re.I):
            if "Require all denied" not in m.group(2) and "Deny from all" not in m.group(2):
                continue
            padroes.append("^" + re.escape(m.group(1)) + "$" if literal else m.group(1))

    bloqueados = []
    for f in sorted(PUB.rglob("*")):
        if not f.is_file() or f.name in BLOQUEIO_ESPERADO:
            continue
        for padrao in padroes:
            if re.search(padrao, f.name):
                bloqueados.append((f.relative_to(PUB).as_posix(), padrao))
                break

    if bloqueados:
        linhas = "\n".join(f"       {caminho}  <- regra {padrao}" for caminho, padrao in bloqueados[:12])
        raise SystemExit(
            "erro: o .htaccess bloqueia arquivo que o site precisa servir:\n" + linhas +
            "\n       Ajuste a regra em public/.htaccess antes de publicar.")

    print(f"  .htaccess: {len(padroes)} regra(s) de bloqueio, nenhum arquivo publicado atingido")
    total = sum(n for _, n in RECADOS_TIRADOS)
    if total:
        onde = ", ".join(f"{o} ({n})" for o, n in RECADOS_TIRADOS if n)
        print(f"  recados internos retirados do HTML publicado: {total} — {onde}")


def confere_indexacao(ambiente: Ambiente, rotas) -> None:
    """Trava final: o ambiente que saiu tem que ser o ambiente que foi pedido.

    O erro que isto existe para impedir e publicar producao com o noindex de
    homologacao esquecido no HTML — o site inteiro sai do indice e ninguem
    percebe por semanas. O contrario tambem e erro: homologacao sem noindex
    coloca o subdominio para competir com o dominio principal.
    """
    problemas = []
    paginas = [PUB / r[1] for r in rotas]
    com_noindex = []
    for pagina in paginas:
        if not pagina.exists():
            continue
        texto = pagina.read_text(encoding="utf-8")
        tem = re.search(r'<meta[^>]+name=["\']robots["\'][^>]+content=["\'][^"\']*noindex', texto, re.I)
        if tem:
            com_noindex.append(pagina.relative_to(PUB).as_posix())

    # a pagina de erro e noindex nos dois ambientes, de proposito
    com_noindex = [c for c in com_noindex if c != "404.html"]
    esperadas = [r[1] for r in rotas if r[1] != "404.html"]

    if ambiente.indexavel and com_noindex:
        problemas.append("producao com noindex em: " + ", ".join(com_noindex[:6]))
    if not ambiente.indexavel:
        faltando = [e for e in esperadas if e not in com_noindex]
        if faltando:
            problemas.append("homologacao SEM noindex em: " + ", ".join(faltando[:6]))

    for r in rotas:
        destino = r[1]
        pagina = PUB / destino
        if not pagina.exists():
            continue
        texto = pagina.read_text(encoding="utf-8")
        achados = re.findall(r'<link[^>]+rel=["\']canonical["\'][^>]+href=["\']([^"\']+)["\']', texto, re.I)
        achados = list(dict.fromkeys(achados))   # as duas camadas repetem o mesmo
        if destino == "404.html":
            if achados:
                problemas.append("a pagina de erro nao deve ter canonical")
            continue
        caminho = "" if destino == "index.html" else destino[: -len("index.html")]
        esperado = f"{ambiente.base}/{caminho}"
        if not achados:
            problemas.append(f"{destino}: sem canonical")
        elif len(achados) > 1:
            problemas.append(f"{destino}: {len(achados)} canonicals diferentes ({', '.join(achados[:3])})")
        elif achados[0] != esperado:
            problemas.append(f"{destino}: canonical {achados[0]} em vez de {esperado}")

    robots = (PUB / "robots.txt").read_text(encoding="utf-8") if (PUB / "robots.txt").exists() else ""
    if re.search(r"^\s*Disallow:\s*/\s*$", robots, re.M):
        problemas.append("robots.txt com 'Disallow: /' — impede o robo de LER o noindex")
    if ambiente.indexavel and f"Sitemap: {ambiente.base}/sitemap.xml" not in robots:
        problemas.append("robots.txt de producao sem a linha Sitemap do dominio final")

    htaccess = (PUB / ".htaccess").read_text(encoding="utf-8") if (PUB / ".htaccess").exists() else ""
    if ambiente.indexavel and HTACCESS_INICIO in htaccess:
        problemas.append("producao com o bloco X-Robots-Tag de homologacao no .htaccess")
    if not ambiente.indexavel and HTACCESS_INICIO not in htaccess:
        problemas.append("homologacao sem o bloco X-Robots-Tag no .htaccess")

    sitemap = PUB / "sitemap.xml"
    if ambiente.indexavel:
        if not sitemap.exists():
            problemas.append("producao sem sitemap.xml")
        else:
            texto = sitemap.read_text(encoding="utf-8")
            locs = re.findall(r"<loc>([^<]+)</loc>", texto)
            fora = [l for l in locs if not l.startswith(ambiente.base + "/")]
            if fora:
                problemas.append("sitemap com URL de outro dominio: " + ", ".join(fora[:3]))
            for loc in locs:
                caminho = loc[len(ambiente.base):].strip("/")
                alvo = PUB / (caminho + "/index.html" if caminho else "index.html")
                if not alvo.exists():
                    problemas.append(f"sitemap aponta para {loc}, que nao existe em disco")
    elif sitemap.exists():
        problemas.append("homologacao publicando sitemap.xml (nao deve existir)")

    if problemas:
        raise SystemExit("erro de indexacao — o build parou antes de publicar errado:\n"
                         + "\n".join(f"       - {p}" for p in problemas))
    marca = "noindex em todas as rotas" if not ambiente.indexavel else "indexavel, sem noindex"
    print(f"  indexacao conferida: {ambiente.nome} — {marca}")


def main() -> int:
    homologacao = "--homologacao" in sys.argv
    avaliacoes = "--avaliacoes-google" in sys.argv
    so_rota = None
    if "--so-rota" in sys.argv:
        so_rota = sys.argv[sys.argv.index("--so-rota") + 1]

    rotas = ROTAS
    if so_rota:
        alvo = so_rota.strip("/")
        rotas = [r for r in ROTAS if r[1].rsplit("/index.html", 1)[0].strip("/") == alvo or r[1] == so_rota]
        if not rotas:
            raise SystemExit(f"erro: rota desconhecida: {so_rota}")

    ambiente = Ambiente(homologacao)
    print(f"ambiente: {ambiente.nome.upper()} — base {ambiente.base}"
          + ("  (noindex em tudo)" if not ambiente.indexavel else ""))
    print(f"avaliacoes do Google: {'LIGADAS' if avaliacoes else 'desligadas (depoimentos como no design)'}")
    print(f"rotas: {len(rotas)}")

    with tempfile.TemporaryDirectory() as tmp:
        palco = pathlib.Path(tmp) / "palco"
        palco.mkdir()
        monta_palco(palco, ambiente, avaliacoes)

        plano = [{"arquivo": r[0], "saida": r[1], "minTexto": r[2] if len(r) > 2 else 1200}
                 for r in rotas]
        mapa = pathlib.Path(tmp) / "rotas.json"
        mapa.write_text(json.dumps(plano, ensure_ascii=False), encoding="utf-8")

        r = subprocess.run(
            ["node", str(FONTE / "prerender.mjs"), str(palco), str(PUB), str(mapa)],
            cwd=RAIZ)
        if r.returncode != 0:
            raise SystemExit(
                "erro: alguma rota nao passou na conferencia. Os HTMLs gerados ficaram no\n"
                "       disco para inspecao, mas os estaticos (img/, _dc/, js) nao foram\n"
                "       republicados — conserte a rota e rode o build de novo.")

        publica_estaticos(palco, ambiente, avaliacoes, ROTAS)

    confere_htaccess()
    if not so_rota:
        confere_indexacao(ambiente, ROTAS)
    print("estaticos publicados: img/ assets/ _dc/ fonts/ vendor/ + js do site + robots/sitemap")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
