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


def patch_pagina(html: str, avaliacoes: bool = False, config_js: str = "",
                 loader_js: str = "", poppins_css: str = "") -> str:
    """Prepara uma pagina do prototipo para virar pagina publicada."""
    falhas = []

    if html.count(VIEWPORT) != 1:
        falhas.append("a meta viewport")
    cabeca = FAVICONS + ("\n" + SCRIPT_AVALIACOES if avaliacoes else "")
    html = html.replace(VIEWPORT, VIEWPORT + "\n" + cabeca, 1)

    html = troca_links(RELATIVO_RE.sub(r'\1/\2', html))
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


def patch_config(js: str, homologacao: bool) -> str:
    """site-config.js: links internos para as URLs finais e caminhos absolutos."""
    js = troca_links(RELATIVO_RE.sub(r'\1/\2', js))

    agulha = "  C.locations = ["
    if js.count(agulha) != 1:
        raise SystemExit("erro: nao achei C.locations no site-config.js")
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

    estagio = "homologacao" if homologacao else "producao"
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
    setTimeout(function () { obs.disconnect(); r(); }, 6000);
  });
  var sinais = [domPronto, logoPronta, fontes, hero, carregou, montado];
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
      maximumVisibleTime: 6000,   // rede de segurança, não alvo"""

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
    var pausa = reduz ? 0 : (curto ? 120 : 380);   // modo curto quase nao pausa"""

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

# onde encaixar o markup: logo antes do bloco das avaliacoes
MAQUETE_ANCORA_MARKUP = '  <sc-if value="{{ s.isAvaliacoes }}">'
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

    for agulha, nome in ((MAQUETE_ANCORA_MARKUP, "o bloco das avaliacoes"),
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


def monta_palco(palco: pathlib.Path, homologacao: bool, avaliacoes: bool) -> None:
    """Monta a arvore que o Chromium vai enxergar — igual a publicada."""
    (palco / "_dc").mkdir(parents=True)
    for c in COMPONENTES:
        texto = (PROTO / f"{c}.dc.html").read_text(encoding="utf-8")
        if c == "PaginaMorenos":
            texto = patch_maquete(texto)
        (palco / "_dc" / f"{c}.dc.html").write_text(
            troca_links(RELATIVO_RE.sub(r'\1/\2', texto)), encoding="utf-8")

    config_js = patch_config((PROTO / "site-config.js").read_text(encoding="utf-8"), homologacao)
    loader_js = patch_loader((PROTO / "site-loader.js").read_text(encoding="utf-8"))
    poppins_css = (PUB / "fonts" / "poppins.css").read_text(encoding="utf-8")

    for arquivo, *_ in ROTAS:
        alvo = palco / arquivo
        alvo.write_text(
            patch_pagina((PROTO / arquivo).read_text(encoding="utf-8"), avaliacoes,
                         config_js, loader_js, poppins_css),
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

    for pasta in ASSETS_PROTO:
        shutil.copytree(PROTO / pasta, palco / pasta)

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


def publica_estaticos(palco: pathlib.Path, homologacao: bool, avaliacoes: bool) -> None:
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

    robots = "robots-homologacao.txt" if homologacao else "robots.txt"
    shutil.copy2(PROTO / "seo" / robots, PUB / "robots.txt")
    shutil.copy2(PROTO / "seo" / "sitemap.xml", PUB / "sitemap.xml")


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

    print(f"ambiente: {'HOMOLOGACAO (noindex)' if homologacao else 'producao'}")
    print(f"avaliacoes do Google: {'LIGADAS' if avaliacoes else 'desligadas (depoimentos como no design)'}")
    print(f"rotas: {len(rotas)}")

    with tempfile.TemporaryDirectory() as tmp:
        palco = pathlib.Path(tmp) / "palco"
        palco.mkdir()
        monta_palco(palco, homologacao, avaliacoes)

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

        publica_estaticos(palco, homologacao, avaliacoes)

    confere_htaccess()
    print("estaticos publicados: img/ assets/ _dc/ fonts/ vendor/ + js do site + robots/sitemap")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
