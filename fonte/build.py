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
JS_SITE = ("site-config.js", "site-loader.js", "smooth-scroll.js", "support.js")

FONTES_GOOGLE_RE = re.compile(
    r'<link rel="preconnect" href="https://fonts\.googleapis\.com">\s*'
    r'<link rel="preconnect" href="https://fonts\.gstatic\.com" crossorigin="">\s*'
    r'<link href="https://fonts\.googleapis\.com/css2\?family=Poppins[^"]*" rel="stylesheet">')
FONTES_LOCAIS = '<link rel="stylesheet" href="/fonts/poppins.css">'

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

VIEWPORT = '<meta name="viewport" content="width=device-width, initial-scale=1">'


def patch_pagina(html: str) -> str:
    """Prepara uma pagina do prototipo para virar pagina publicada."""
    falhas = []

    if html.count(VIEWPORT) != 1:
        falhas.append("a meta viewport")
    html = html.replace(VIEWPORT, VIEWPORT + "\n" + FAVICONS, 1)

    html = troca_links(RELATIVO_RE.sub(r'\1/\2', html))
    for js in JS_SITE:
        html = html.replace(f'src="{js}"', f'src="/{js}"').replace(f'src="./{js}"', f'src="/{js}"')

    if not FONTES_GOOGLE_RE.search(html):
        falhas.append("links da Poppins do Google")
    html = FONTES_GOOGLE_RE.sub(FONTES_LOCAIS, html, count=1)

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

    estagio = "homologacao" if homologacao else "producao"
    js, n = re.subn(r"stage: /novosite\\\./\.test\(location\.hostname\) \? 'homologacao' : 'producao',",
                    f"stage: '{estagio}',  // fixado no build", js, count=1)
    if not n:
        js, n = re.subn(r"stage: [^,]+,", f"stage: '{estagio}',  // fixado no build", js, count=1)
    if not n:
        raise SystemExit("erro: nao achei C.env.stage no site-config.js")
    return js


def monta_palco(palco: pathlib.Path, homologacao: bool) -> None:
    """Monta a arvore que o Chromium vai enxergar — igual a publicada."""
    (palco / "_dc").mkdir(parents=True)
    for c in COMPONENTES:
        texto = (PROTO / f"{c}.dc.html").read_text(encoding="utf-8")
        (palco / "_dc" / f"{c}.dc.html").write_text(
            troca_links(RELATIVO_RE.sub(r'\1/\2', texto)), encoding="utf-8")

    for arquivo, *_ in ROTAS:
        alvo = palco / arquivo
        alvo.write_text(patch_pagina((PROTO / arquivo).read_text(encoding="utf-8")), encoding="utf-8")

    (palco / "site-config.js").write_text(
        patch_config((PROTO / "site-config.js").read_text(encoding="utf-8"), homologacao),
        encoding="utf-8")
    for js in ("site-loader.js", "smooth-scroll.js", "support.js"):
        shutil.copy2(PROTO / js, palco / js)

    for pasta in ASSETS_PROTO:
        shutil.copytree(PROTO / pasta, palco / pasta)
    shutil.copytree(PUB / "fonts", palco / "fonts")
    shutil.copytree(PUB / "vendor", palco / "vendor")


def publica_estaticos(palco: pathlib.Path, homologacao: bool) -> None:
    """Copia para a raiz do repositorio tudo que nao e pagina."""
    for pasta in (*ASSETS_PROTO, "_dc"):
        destino = PUB / pasta
        if destino.exists():
            shutil.rmtree(destino)
        shutil.copytree(palco / pasta, destino)
    for js in JS_SITE:
        shutil.copy2(palco / js, PUB / js)

    robots = "robots-homologacao.txt" if homologacao else "robots.txt"
    shutil.copy2(PROTO / "seo" / robots, PUB / "robots.txt")
    shutil.copy2(PROTO / "seo" / "sitemap.xml", PUB / "sitemap.xml")


def main() -> int:
    homologacao = "--homologacao" in sys.argv
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
    print(f"rotas: {len(rotas)}")

    with tempfile.TemporaryDirectory() as tmp:
        palco = pathlib.Path(tmp) / "palco"
        palco.mkdir()
        monta_palco(palco, homologacao)

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

        publica_estaticos(palco, homologacao)

    print("estaticos publicados: img/ assets/ _dc/ fonts/ vendor/ + js do site + robots/sitemap")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
