# Salão Morenos — site

Site da barbearia Salão Morenos: três unidades em Serra, Espírito Santo.
17 rotas estáticas, publicadas na HostGator por **cPanel > Git Version Control**.

- Domínio: https://salaomorenos.com.br/
- Origem do design: projeto Claude Design (handoff em `fonte/HANDOFF.md`)

```bash
python3 fonte/build.py             # gera as 17 rotas em public/
node fonte/checar.mjs public       # 71 verificações sobre o site gerado
node fonte/testes/avaliacoes.mjs   # 53 verificações da integração com o Google (build --avaliacoes-google)
```

---

## Estrutura

```
public/            TUDO que vai para o ar (o .cpanel.yml copia public/. para public_html)
  index.html         Home
  unidades/ servicos/ visagismo/ dia-do-noivo/ o-clube/ cultura/
  corporativo/ trabalhe-conosco/ politica-de-privacidade/ termos-de-uso/
  404.html
  _dc/               componentes do runtime (SiteHeader, SiteFooter, PaginaMorenos)
  img/ assets/ fonts/ vendor/
  support.js site-config.js site-loader.js smooth-scroll.js
  robots.txt sitemap.xml .htaccess

fonte/             nunca publicado
  prototipo/         o handoff do Claude Design (design de referência)
  build.py           gera as rotas
  prerender.mjs      captura estática
  checar.mjs         confere o site gerado
  avaliacoes/        integração opcional do Google (script + rota PHP)
  testes/            testes da integração de avaliações
  scripts/           utilitários (descobrir Place IDs)
  HANDOFF.md  MIGRATION-CHECKLIST.md  PENDENCIAS.md
```

Nada fora de `public/` chega ao servidor.

## Duas camadas na mesma página

O protótipo do Claude Design é um template: o `support.js` monta a página no
navegador a partir de marcadores `{{ }}`. O handoff pede pré-renderização para
o HTML publicado não chegar cru ao robô de busca.

Cada rota publicada leva:

1. **a cópia estática** da página montada, capturada no build em viewport de
   celular — primeiro quadro do visitante e o que o robô lê, sem depender de
   JavaScript;
2. **o template + o runtime**, com `defer`. Quando o React monta, a cópia
   estática sai e a página viva entra, com mega menu, modal de unidades,
   lightbox, abas, acordeões e formulários como foram desenhados.

Reescrever essas interações em JavaScript comum seria manter uma segunda
implementação do design, que divergiria na primeira reexportação. Se o
JavaScript falhar, a camada 1 continua na tela.

Nenhuma requisição a domínio de terceiro além do iframe do mapa, que é parte do
design: React vem de `vendor/` e a Poppins de `fonts/`.

## O que o build resolve

O `fonte/build.py` aplica ao protótipo, sempre conferindo se a agulha existe —
se o design mudar, o build para e avisa em vez de publicar errado:

- link interno de arquivo (`o-clube.dc.html`) vira URL final (`/o-clube/`);
- caminho relativo de imagem e script vira absoluto (as páginas moram em subpastas);
- componentes vão para `/_dc/` e o runtime aprende a buscá-los lá;
- Poppins local no lugar do Google Fonts; React local no lugar do unpkg;
- a tela de abertura ganha **dois tempos**: intro completa na primeira carga da
  sessão e modo curto (~0,7s) nas páginas seguintes, em vez de aparecer inteira
  toda vez ou sumir de vez na navegação interna. Ela **só sai com a página
  carregada** (`window.load`) e com a troca das duas camadas feita — senão o
  visitante veria a troca acontecer;
- na cópia estática, o que a animação de rolagem esconderia nasce visível e o
  FAQ aparece aberto — sem JavaScript ninguém abriria o acordeão.

`python3 fonte/build.py --homologacao` fixa `noindex` e usa o robots de
homologação.

## Avaliações do Google — opcional, desligada

A seção de depoimentos sai **como o design a desenhou**. Existe uma integração
pronta que troca aquele conteúdo pelas avaliações reais das três unidades
(Places API New, chave só no servidor), mas ela **não entra no build por
padrão**:

```bash
python3 fonte/build.py --avaliacoes-google   # publica o script + a rota /api/
```

Sem a flag, `fonte/avaliacoes/` nem chega a `public/`. Configuração, variáveis
de ambiente, limites e checklist do Google Cloud:
**`GOOGLE-REVIEWS-INTEGRATION.md`**.

## Publicação

cPanel > Git Version Control: **Update from Remote** e depois **Deploy HEAD
Commit**. O `.cpanel.yml` copia `public/.` para `$HOME/public_html/`.

> Confirme antes o Document Root de `salaomorenos.com.br` em cPanel > Domínios.
> `public_html` só é o lugar certo se ele for o domínio principal da conta.

## Alterando o site

1. Edite o design no projeto do Claude Design.
2. Exporte e substitua os arquivos em `fonte/prototipo/`.
3. `python3 fonte/build.py && node fonte/checar.mjs public`.
4. Commit + push, e publique pelo cPanel.

O build precisa de `node` com **playwright** e de `python3`.
