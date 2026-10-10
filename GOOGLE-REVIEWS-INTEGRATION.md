# Avaliações do Google na seção de depoimentos

Integração das avaliações públicas das três unidades do Salão Morenos, pela
**Google Places API (New)**. Sem scraping, sem Puppeteer, sem copiar página de
resultado do Google: só a API oficial, chamada **pelo servidor**.

- Provider atual: `google-places`
- Provider futuro: `google-business-profile` (ver o fim deste arquivo)

---

## Por que PHP e não uma API Route

O site é HTML estático pré-renderizado (o design vem do Claude Design e o
`fonte/build.py` gera as 17 rotas). A hospedagem é **HostGator compartilhada,
publicada por cPanel > Git Version Control**: não há Node, Next.js, Edge
Functions nem serverless no plano. O que roda no servidor ali é **PHP**, e é
isso que o endpoint usa. O requisito que importa está cumprido: **a chave vive
só no servidor** e o navegador nunca fala com `places.googleapis.com`.

```
navegador ──GET /api/google-reviews──► Apache/PHP ──Places API (New)──► Google
   (sem chave)                        (chave aqui)
```

## Arquivos

| arquivo | papel |
| --- | --- |
| `public/api/google-reviews.php` | a rota interna: consulta as três unidades e normaliza |
| `public/api/config.php` | lê as variáveis de ambiente e lista as unidades |
| `public/avaliacoes-google.js` | o front-end: assume a seção e pinta as avaliações |
| `fonte/scripts/find-google-place-ids.mjs` | descobre os Place IDs (Text Search New) |
| `fonte/testes/avaliacoes.mjs` | 53 verificações, endpoint + componente |
| `.env.example` | nomes das variáveis, sem valores |

A seção de depoimentos continua sendo a desenhada (`Quem senta na cadeira,
conta.`): o script só troca o conteúdo do bloco de cards, mantendo título,
fundo claro `#F6F4EF`, cards brancos de raio 20px, Poppins e os tokens do
handoff.

## Variáveis de ambiente

```
GOOGLE_MAPS_API_KEY=
GOOGLE_PLACE_ID_CIDADE_CONTINENTAL=
GOOGLE_PLACE_ID_NOVO_HORIZONTE_AV_BRASIL=
GOOGLE_PLACE_ID_NOVO_HORIZONTE_AV_INDUSTRIAL=
```

O endpoint lê nesta ordem: `getenv()` → `$_SERVER` → `~/.morenos-env.php`.

**Na HostGator, use o arquivo fora do `public_html`** — é a forma mais segura,
porque nem um erro de configuração do Apache o expõe e ele não passa pelo Git:

```php
<?php // ~/.morenos-env.php   (fora do public_html, permissão 600)
return [
  'GOOGLE_MAPS_API_KEY' => 'AIza...',
  'GOOGLE_PLACE_ID_CIDADE_CONTINENTAL' => 'ChIJ...',
  'GOOGLE_PLACE_ID_NOVO_HORIZONTE_AV_BRASIL' => 'ChIJ...',
  'GOOGLE_PLACE_ID_NOVO_HORIZONTE_AV_INDUSTRIAL' => 'ChIJ...',
];
```

Se o arquivo estiver quebrado, a rota **degrada** para "não configurado" em vez
de derrubar a página.

## Campos pedidos à Places API

`GET https://places.googleapis.com/v1/places/{PLACE_ID}?languageCode=pt-BR&regionCode=BR`

```
X-Goog-Api-Key:   <GOOGLE_MAPS_API_KEY>
X-Goog-FieldMask: id,displayName,rating,userRatingCount,reviews,googleMapsUri,googleMapsLinks
```

Nunca `*`. De cada review são usados `name`, `rating`, `text`, `originalText`,
`relativePublishTimeDescription`, `publishTime`, `googleMapsUri`,
`flagContentUri` e `authorAttribution` (nome, uri, foto).

As três unidades são consultadas **em paralelo** (`curl_multi`), com **6 s de
timeout por unidade**. Uma unidade com erro não derruba as outras: a rota
responde **200** com as que carregaram e **503** só quando nenhuma carrega.
Detalhe técnico vai para o log do servidor; para o visitante vai só
"No momento não foi possível carregar as avaliações."

## Nada é guardado

Sem banco, sem arquivo, sem JSON no build, sem `localStorage`, sem
`sessionStorage`, sem ISR. A rota responde `Cache-Control: no-store, max-age=0`
e os dados ficam só na memória da página enquanto o visitante estiver nela.

A busca começa quando a seção está a ~500px de entrar na tela
(`IntersectionObserver`) — ela fica longe da primeira dobra, e assim a Home não
gasta chamada à toa. Trocar de filtro **não** refaz a requisição.

## O que a tela mostra

Por avaliação: foto do autor (ou avatar com a inicial, quando o Google não
manda foto — nunca foto inventada), nome (link quando há perfil), estrelas com
`aria-label`, texto **como veio** (sem corrigir, resumir, traduzir de novo ou
esconder crítica), tempo relativo, unidade avaliada, "Ver no Google Maps" e,
quando o Google oferece, "Reportar avaliação no Google". Texto longo recolhe em
5 linhas com "Ler mais"/"Mostrar menos" (botão real, `aria-expanded`, funciona
por teclado). Quando `text.languageCode` difere de `originalText.languageCode`,
aparece "Traduzido pelo Google" com "Ver original".

Por unidade: nota, quantidade de avaliações, "Ver todas as avaliações" e
"Avaliar esta unidade" — sempre os links que a própria API devolve
(`googleMapsLinks`). **Não existe nota geral das três unidades**: média entre
unidades seria número inventado.

No filtro "Todas", as avaliações são intercaladas em round-robin preservando a
ordem de relevância de cada unidade, com o aviso "Avaliações do Google Maps,
exibidas por relevância em cada unidade." Nunca "últimas avaliações": a API não
garante ordem cronológica.

As duas unidades de Novo Horizonte aparecem sempre separadas (Av. Brasil e
Av. Industrial), nunca como um "Novo Horizonte" só.

## Atribuição

A seção mostra **Google Maps** em texto, com `translate="no"`, dentro do mesmo
container visual, visível em qualquer largura — não escondido, não só no hover,
não com opacidade baixa. Se o ativo oficial de marca for adotado depois, trocar
sem alterar nome, proporção, cores ou capitalização.

## Fotos de perfil e privacidade

As fotos vêm de `lh3.googleusercontent.com`, carregadas pelo navegador do
visitante com `loading="lazy"`, `decoding="async"`, dimensões fixas e
`referrerPolicy`. Se a imagem falhar, cai no avatar com a inicial, mantendo
nome e link do autor.

**Antes do lançamento:** a Política de Privacidade (`/politica-de-privacidade/`)
e os Termos de Uso (`/termos-de-uso/`) já existem no site e já citam Google
Maps entre os terceiros, mas **precisam de uma linha sobre as avaliações**:
que a seção carrega conteúdo público do Google Maps (texto, nome e foto de
perfil dos autores) e que a requisição sai do servidor. Isso entra junto com a
revisão jurídica que o próprio handoff já exige (razão social, CNPJ, encarregado).
Está registrado em `fonte/MIGRATION-CHECKLIST.md`.

## Sem Review/AggregateRating no JSON-LD

Os dados estruturados do site continuam só com dado próprio confirmado
(`HairSalon` por unidade, `BreadcrumbList`). **Nada de `Review`,
`AggregateRating`, `ratingValue` ou `reviewCount`** — avaliação de terceiro não
vira estrela de rich snippet do próprio negócio.

## Eventos de analytics

Via `dataLayer`, só se ele existir (sem GTM/GA4 configurado, nada quebra):

| evento | parâmetros |
| --- | --- |
| `google_reviews_loaded` | `available_units`, `total_loaded_reviews` |
| `google_review_open` | `unit_id`, `review_id` |
| `google_reviews_filter` | `unit_id` |
| `google_write_review_click` | `unit_id` |

## Como testar

```bash
npm run test:avaliacoes    # 53 verificações: endpoint PHP + componente no navegador
```

Cobre chave ausente, Place ID ausente, arquivo de ambiente quebrado, unidade
com erro, método errado, `config.php` acessado direto, review sem texto, sem
foto, sem link de autor, texto longo, review traduzido, nota decimal, filtro,
teclado, `aria-label` das estrelas, atribuição, estado de erro, e — o mais
importante — que o navegador **não** chama `places.googleapis.com` e que
nenhuma chave aparece nos arquivos publicados.

Localmente, com chave de verdade:

```bash
GOOGLE_MAPS_API_KEY=AIza... \
GOOGLE_PLACE_ID_CIDADE_CONTINENTAL=ChIJ... \
php -S 127.0.0.1:8080 -t public
# abra http://127.0.0.1:8080/ e role ate a secao
```

Para conferir que a chave não vazou: procure `AIza` em `public/` (o teste já
faz isso) e, no DevTools > Network, confirme que só existe a chamada a
`/api/google-reviews`.

## Checklist do Google Cloud (execução manual)

- [ ] Criar ou selecionar o projeto no Google Cloud
- [ ] Ativar faturamento
- [ ] Ativar **Places API (New)**
- [ ] Criar uma API Key exclusiva para o servidor
- [ ] Restringir a chave **somente** à Places API (New)
- [ ] Aplicar restrição por IP do servidor (a HostGator informa o IP da conta)
- [ ] Configurar `GOOGLE_MAPS_API_KEY` na hospedagem (`~/.morenos-env.php`)
- [ ] Rodar `npm run find:google-places`
- [ ] Validar o **endereço** de cada resultado antes de aceitar o Place ID
- [ ] Configurar os três Place IDs
- [ ] Testar `https://salaomorenos.com.br/api/google-reviews`
- [ ] Conferir a atribuição "Google Maps" na seção
- [ ] Revisar a Política de Privacidade
- [ ] Revisar os Termos de Uso
- [ ] Acompanhar consumo e faturamento no Google Cloud

## Limitação conhecida e migração futura

A Google Places API devolve **apenas uma seleção limitada de avaliações** por
estabelecimento (até cinco, por relevância) e não permite paginar, ordenar por
data ou responder. Para ter todas as avaliações das unidades, migrar depois
para a **Google Business Profile API**, com OAuth e autorização do proprietário
dos perfis.

O endpoint está isolado atrás de uma fronteira só (`public/api/`): trocar o
provider significa reescrever a consulta e a normalização ali dentro,
mantendo o mesmo contrato JSON que o `public/avaliacoes-google.js` consome.
Não misturar as duas APIs na mesma implementação.

A Business Profile API permitirá: listar todas as avaliações, paginar, ordenar
por data e por nota, acessar várias unidades e responder avaliações quando
autorizado. **Não implementar antes de ter credenciais e autorização do dono
dos perfis.**
