/**
 * Verificações de SEO sobre o site gerado.
 *
 *   node fonte/testes/seo.mjs public
 *
 * O que o build já garante (ambiente, noindex, canonical, sitemap em disco)
 * está em fonte/build.py, em confere_indexacao: é lá que ele para antes de
 * publicar errado. Aqui vai o que só dá para conferir lendo o site inteiro
 * junto — e, no caso dos dados estruturados, o que só faz sentido olhando o
 * grafo das 16 rotas como uma coisa só.
 */
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(process.argv[2] || 'public');

const ROTAS = [
  'index.html', 'unidades/index.html', 'unidades/cidade-continental/index.html',
  'unidades/novo-horizonte-av-brasil/index.html', 'unidades/novo-horizonte-av-industrial/index.html',
  'servicos/index.html', 'servicos/corte-masculino/index.html', 'servicos/barboterapia/index.html',
  'visagismo/index.html', 'dia-do-noivo/index.html', 'o-clube/index.html', 'cultura/index.html',
  'corporativo/index.html', 'trabalhe-conosco/index.html',
  'politica-de-privacidade/index.html', 'termos-de-uso/index.html',
];

let ok = 0;
const falhas = [];
const checa = (cond, msg) => (cond ? (ok++, true) : (falhas.push(msg), false));

const ler = (r) => fs.readFileSync(path.join(RAIZ, r), 'utf8');
const urlDe = (r) => '/' + (r === 'index.html' ? '' : r.replace(/index\.html$/, ''));

// ---------------------------------------------------------------- metadados
const titulos = new Map();
const descricoes = new Map();

for (const rota of ROTAS) {
  const html = ler(rota);
  const titulo = (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1]?.trim() || '';
  const desc = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) || [])[1]?.trim() || '';

  checa(titulo.length > 0, `${rota}: sem <title>`);
  checa(titulo.length <= 70, `${rota}: title com ${titulo.length} caracteres — "${titulo}"`);
  checa(desc.length > 0, `${rota}: sem meta description`);
  checa(desc.length >= 70 && desc.length <= 170,
    `${rota}: description com ${desc.length} caracteres (alvo 70–170) — "${desc.slice(0, 60)}…"`);
  // description tem que ser frase, nao lista de palavra-chave
  checa(!/^[^.!?]*(,[^.!?]*){4,}$/.test(desc), `${rota}: description parece lista de palavra-chave`);

  if (titulo) {
    if (titulos.has(titulo)) falhas.push(`title repetido entre ${titulos.get(titulo)} e ${rota}: "${titulo}"`);
    else { titulos.set(titulo, rota); ok++; }
  }
  if (desc) {
    if (descricoes.has(desc)) falhas.push(`description repetida entre ${descricoes.get(desc)} e ${rota}`);
    else { descricoes.set(desc, rota); ok++; }
  }

  // og:url tem que bater com o canonical da propria rota
  const canonical = (html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) || [])[1];
  const og = (html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i) || [])[1];
  checa(!og || og === canonical, `${rota}: og:url (${og}) diferente do canonical (${canonical})`);
}

// -------------------------------------------------------- dados estruturados
const defs = new Map();      // @id -> {tipo, rota}
const refs = [];             // {id, rota}
const porTipo = {};

for (const rota of ROTAS) {
  const html = ler(rota);
  const blocos = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((m) => m[1]);
  const distintos = [...new Set(blocos)];
  checa(distintos.length === 1, `${rota}: ${distintos.length} blocos JSON-LD distintos (esperado 1)`);
  if (!distintos.length) continue;

  let dados;
  try { dados = JSON.parse(distintos[0]); ok++; }
  catch (e) { falhas.push(`${rota}: JSON-LD inválido — ${e.message}`); continue; }

  const grafo = dados['@graph'] || [dados];
  checa(dados['@context'] === 'https://schema.org', `${rota}: @context ausente ou errado`);

  const vistosNaRota = new Set();
  const anda = (no, dentroDeRef) => {
    if (Array.isArray(no)) return no.forEach((n) => anda(n, dentroDeRef));
    if (!no || typeof no !== 'object') return;
    const chaves = Object.keys(no);
    const soRef = chaves.length === 1 && chaves[0] === '@id';
    if (no['@id']) {
      if (soRef) refs.push({ id: no['@id'], rota });
      else {
        if (vistosNaRota.has(no['@id'])) falhas.push(`${rota}: @id repetido no mesmo grafo — ${no['@id']}`);
        vistosNaRota.add(no['@id']);
        const antes = defs.get(no['@id']);
        if (antes && antes.tipo !== no['@type']) {
          falhas.push(`@id ${no['@id']} é ${antes.tipo} em ${antes.rota} e ${no['@type']} em ${rota}`);
        } else if (!antes) {
          defs.set(no['@id'], { tipo: no['@type'], rota, no });
        } else ok++;
      }
    }
    for (const k of chaves) if (k !== '@id') anda(no[k], dentroDeRef);
  };
  anda(grafo, false);

  for (const no of grafo) porTipo[no['@type']] = (porTipo[no['@type']] || 0) + 1;

  // toda rota declara a marca e o site
  checa(grafo.some((n) => n['@type'] === 'Organization'), `${rota}: grafo sem Organization`);
  checa(grafo.some((n) => n['@type'] === 'WebSite'), `${rota}: grafo sem WebSite`);
  if (rota !== 'index.html') {
    checa(grafo.some((n) => n['@type'] === 'BreadcrumbList'), `${rota}: página interna sem BreadcrumbList`);
  }
}

// referência que aponta para entidade que ninguém define é grafo quebrado
for (const r of refs) {
  checa(defs.has(r.id), `${r.rota}: referência {"@id": "${r.id}"} sem entidade correspondente em nenhuma rota`);
}

// a mesma unidade tem que ter UM @id no site inteiro
const unidades = [...defs.entries()].filter(([, v]) => v.tipo === 'HairSalon');
checa(unidades.length === 3, `${unidades.length} HairSalon distintos no site (esperado 3)`);
for (const [id, v] of unidades) {
  const url = v.no.url || '';
  checa(url.includes('/unidades/'), `HairSalon ${id}: url "${url}" não aponta para a página da unidade`);
  checa(!!v.no.parentOrganization?.['@id'], `HairSalon ${id}: sem parentOrganization por @id`);
  checa(!v.no.aggregateRating && !v.no.review, `HairSalon ${id}: tem avaliação no grafo`);
  checa(!v.no.geo, `HairSalon ${id}: tem coordenada (ninguém mediu)`);
  checa(!v.no.telephone, `HairSalon ${id}: telefone por unidade (o contato é central)`);
  checa(!v.no.openingHoursSpecification, `HairSalon ${id}: horário por unidade sem confirmação do cliente`);
}

const orgs = [...defs.entries()].filter(([, v]) => v.tipo === 'Organization');
checa(orgs.length === 1, `${orgs.length} Organization distintas (esperado 1)`);

// -------------------------------------------------------------- sitemap
const sitemapPath = path.join(RAIZ, 'sitemap.xml');
if (fs.existsSync(sitemapPath)) {
  const xml = fs.readFileSync(sitemapPath, 'utf8');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  checa(locs.length === ROTAS.length, `sitemap com ${locs.length} URLs, site com ${ROTAS.length} rotas indexáveis`);
  for (const rota of ROTAS) {
    const esperado = urlDe(rota);
    checa(locs.some((l) => new URL(l).pathname === esperado), `sitemap sem ${esperado}`);
  }
  checa(!locs.some((l) => l.includes('404')), 'sitemap com a página de erro');
  const comData = [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);
  checa(comData.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)), 'lastmod fora do formato AAAA-MM-DD');
} else {
  console.log('  (sem sitemap.xml: build de homologação)');
}

// -------------------------------------------------------------- robots.txt
const robots = fs.readFileSync(path.join(RAIZ, 'robots.txt'), 'utf8');
checa(!/^\s*Disallow:\s*\/\s*$/m.test(robots), 'robots.txt com "Disallow: /"');
checa(/User-agent:\s*\*/i.test(robots), 'robots.txt sem User-agent: *');

// ------------------------------------------------------------------ saída
console.log(`\ntipos no grafo: ${Object.entries(porTipo).map(([t, n]) => `${t} ${n}`).join(', ')}`);
console.log(`entidades distintas: ${defs.size} | referências por @id: ${refs.length}`);
falhas.forEach((f) => console.log(`  FALHA  ${f}`));
console.log(`\n${ok} ok, ${falhas.length} falha(s)`);
process.exit(falhas.length ? 1 : 0);
