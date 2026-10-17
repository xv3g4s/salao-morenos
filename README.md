# Salão Morenos — site

Site da barbearia Salão Morenos: três unidades em Serra, Espírito Santo.
17 rotas estáticas, publicadas na HostGator por **cPanel > Git Version Control**.

- Domínio: https://salaomorenos.com.br/
- Origem do design: projeto Claude Design (handoff em `fonte/HANDOFF.md`)

```bash
python3 fonte/build.py                     # produção: as 17 rotas em public/
python3 fonte/build.py --homologacao       # aprovação: o mesmo site, com noindex
node fonte/checar.mjs public               # 71 verificações sobre o site gerado
node fonte/testes/arquitetura.mjs public   # 222 verificações de arquitetura de conteúdo
node fonte/testes/seo.mjs public           # 370 verificações de SEO e dados estruturados
node fonte/testes/avaliacoes.mjs           # 53 verificações da integração com o Google (build --avaliacoes-google)
```

`node fonte/testes/arquitetura.mjs public --mapa` imprime o mapa de seções de
cada rota — é por onde começar para revisar conteúdo.

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
  scripts/           utilitários (descobrir Place IDs)
  testes/            arquitetura de conteúdo, SEO e avaliações
  HANDOFF.md  ARQUITETURA.md  AUDITORIA-SEO.md  DESEMPENHO.md
  MIGRACAO.md  MIGRATION-CHECKLIST.md  PERFIS-GOOGLE.md  PAUTA-CONTEUDO.md
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
  FAQ aparece aberto — sem JavaScript ninguém abriria o acordeão;
- **performance**: `site-config.js`, `site-loader.js` e a folha da Poppins vão
  embutidos no `<head>` (eram três requisições bloqueando a renderização),
  `smooth-scroll.js` ganha `defer`, o `<meta charset>` volta para a primeira
  linha do `<head>` e a logo da tela de abertura é reduzida de 720px para 400px
  com o RGB achatado — ela é máscara CSS, só o alfa aparece: 121 KB → 27 KB;
- a maquete do celular que existe na Home entra também em `/o-clube/`
  (recortes em `fonte/maquete/`, ver o LEIA-ME de lá);
- **a altura volta a ser livre**: o `support.js` prende `html,body` em
  `height:100%` nas páginas sem `$preview` — publicado, isso deixava as 16
  rotas montadas por componente sem rolagem nenhuma. O build desfaz;
- quem pede `prefers-reduced-motion` recebe a página sem animação em laço;
- recado interno (`<!-- TODO: confirmar com cliente ... -->`) não chega ao HTML
  publicado: fica no fonte e em `fonte/MIGRATION-CHECKLIST.md`.

`python3 fonte/build.py --homologacao` fixa `noindex` e usa o robots de
homologação.

## Dois ambientes, um comando de diferença

O site vive em dois endereços com regras **opostas** de indexação:

| | homologação | produção |
| --- | --- | --- |
| endereço | `novosite.salaomorenos.com.br` | `salaomorenos.com.br` |
| build | `python3 fonte/build.py --homologacao` | `python3 fonte/build.py` |
| indexação | `noindex, nofollow` no `<head>` **e** em `X-Robots-Tag` | sem noindex |
| canonical e og:url | apontam para o subdomínio | apontam para o domínio final |
| robots.txt | libera o rastreio, sem linha `Sitemap:` | libera o rastreio e declara o sitemap |
| sitemap.xml | **não é publicado** | gerado a partir das rotas reais |

Três decisões que parecem detalhe:

- **O noindex é escrito no HTML pelo build**, não injetado por JavaScript. O
  robô lê a resposta do servidor; ele não espera o script da página rodar.
- **A homologação libera o rastreio de propósito.** `Disallow: /` não tira
  nada do índice: impede o robô de abrir a página e, sem abrir, ele nunca lê o
  `noindex` — a URL pode continuar aparecendo na busca, só que sem título nem
  descrição. Para não aparecer, o robô precisa entrar e ler.
- **Em homologação não existe sitemap.xml.** Sitemap provisório é o que acaba
  enviado ao Search Console como se fosse o definitivo.

O build **recusa** publicar os ambientes misturados (`confere_indexacao` em
`fonte/build.py`): produção com noindex esquecido, homologação sem noindex,
`Disallow: /` junto do noindex, canonical apontando para o domínio errado,
sitemap com URL que não existe em disco — qualquer um desses para o build.

O `.htaccess` também muda por ambiente: o build liga e desliga um bloco
marcado, que entrega `X-Robots-Tag: noindex` na homologação.

## Dados estruturados

O JSON-LD de cada rota é **gerado no build** a partir do `site-config.js` — a
mesma fonte dos endereços que aparecem na tela. Antes era escrito à mão em cada
página, e o mesmo lugar real aparecia com `@id` diferente em páginas
diferentes. Hoje: uma `Organization`, um `WebSite`, um `HairSalon` por unidade
(sempre o mesmo `@id`, com `url` para a página da unidade), `BreadcrumbList`
nas internas e `Service` nas quatro páginas de serviço.

Fica de fora de propósito, porque ninguém confirmou: telefone por unidade
(o WhatsApp é central), horário por unidade, coordenada, foto de fachada não
identificada, preço, nota e avaliação. `fonte/testes/seo.mjs` falha se algum
deles aparecer.

## Arquitetura de conteúdo

Cada rota tem uma função e não repete o que a outra já diz. O que foi tirado,
o que mudou de lugar e as regras que o teste cobra estão em
**`fonte/ARQUITETURA.md`**.

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
Commit**. O `.cpanel.yml` sincroniza `public/` com `$HOME/public_html/` usando
`rsync --delete` — o que sai do repositório sai também do servidor, para não
deixar URL fantasma respondendo 200 depois de uma remoção.

> **O ambiente é decidido no build, não no deploy.** O que vai para o ar é o
> `public/` commitado. Para o subdomínio de aprovação, construa com
> `--homologacao` antes de commitar; para o domínio final, sem a flag.
>
> **Hoje o `public/` commitado é o de HOMOLOGAÇÃO** (`noindex` em todas as
> rotas), porque o site está em fase de aprovação no subdomínio. Um deploy
> acidental publica um site que não entra no índice — que é o erro barato.
> No dia da publicação definitiva: `python3 fonte/build.py`, conferir, commitar
> e só então publicar.

A migração do WordPress antigo para o domínio final está roteirizada em
**`fonte/MIGRACAO.md`**.

> Confirme antes o Document Root de `salaomorenos.com.br` em cPanel > Domínios.
> `public_html` só é o lugar certo se ele for o domínio principal da conta.

## Alterando o site

1. Edite o design no projeto do Claude Design.
2. Exporte e substitua os arquivos em `fonte/prototipo/`.
3. `python3 fonte/build.py && node fonte/checar.mjs public`.
4. Commit + push, e publique pelo cPanel.

O build precisa de `node` com **playwright** e de `python3`.
