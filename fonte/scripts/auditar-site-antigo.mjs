/**
 * Audita o site ANTIGO (WordPress em salaomorenos.com.br) antes da migracao.
 *
 *   node fonte/scripts/auditar-site-antigo.mjs https://salaomorenos.com.br
 *   node fonte/scripts/auditar-site-antigo.mjs https://salaomorenos.com.br --saida inventario.csv
 *
 * Esta sessao de desenvolvimento NAO alcanca o dominio do cliente (DNS bloqueado
 * no ambiente), entao este script existe para ser rodado de uma maquina que
 * alcance. Ele nao muda nada: so le e escreve um CSV.
 *
 * O que faz:
 *   1. le /robots.txt e descobre os sitemaps declarados;
 *   2. abre /sitemap.xml (e, se for indice, cada sitemap filho: posts, paginas,
 *      categorias, ElementsKit, anexos...);
 *   3. para CADA URL encontrada, faz uma requisicao e anota status, destino do
 *      redirecionamento, title, meta description, canonical e meta robots;
 *   4. cruza com as rotas do site novo e sugere o destino de cada URL antiga:
 *      MANTEM (rota equivalente existe), REDIRECIONA (para onde) ou DECIDIR.
 *
 * O "DECIDIR" e de proposito: post de blog e categoria antiga nao tem equivalente
 * obvio, e jogar tudo na home e o erro classico de migracao. Olhe o CSV e decida
 * caso a caso — o conteudo util pode valer uma pagina nova.
 */
import fs from 'node:fs';

const base = (process.argv[2] || '').replace(/\/+$/, '');
if (!base) {
  console.error('uso: node auditar-site-antigo.mjs https://salaomorenos.com.br [--saida arquivo.csv]');
  process.exit(1);
}
const iSaida = process.argv.indexOf('--saida');
const saida = iSaida > -1 ? process.argv[iSaida + 1] : 'site-antigo.csv';

// As rotas do site novo. Se uma URL antiga bater com uma destas, ela e PRESERVADA.
const ROTAS_NOVAS = [
  '/', '/unidades/', '/unidades/cidade-continental/', '/unidades/novo-horizonte-av-brasil/',
  '/unidades/novo-horizonte-av-industrial/', '/servicos/', '/servicos/corte-masculino/',
  '/servicos/barboterapia/', '/visagismo/', '/dia-do-noivo/', '/o-clube/', '/cultura/',
  '/corporativo/', '/trabalhe-conosco/', '/politica-de-privacidade/', '/termos-de-uso/',
];

// Destinos sugeridos para padroes conhecidos do site antigo. Sugestao, nao regra:
// quem decide e quem olha o CSV.
const SUGESTOES = [
  [/^\/(sobre|sobre-nos|quem-somos)\/?$/i, '/cultura/'],
  [/^\/(servicos|nossos-servicos)\/?$/i, '/servicos/'],
  [/^\/(unidades|nossas-unidades|onde-estamos|contato)\/?$/i, '/unidades/'],
  [/^\/(clube|assinatura|planos)\/?$/i, '/o-clube/'],
  [/^\/(barba|barboterapia)\/?$/i, '/servicos/barboterapia/'],
  [/^\/(corte|corte-masculino|cabelo)\/?$/i, '/servicos/corte-masculino/'],
  [/^\/(visagismo|consultoria)\/?$/i, '/visagismo/'],
  [/^\/(noivo|dia-do-noivo|casamento)\/?$/i, '/dia-do-noivo/'],
  [/^\/(empresas|corporativo|b2b)\/?$/i, '/corporativo/'],
  [/^\/(trabalhe-conosco|vagas|carreira)\/?$/i, '/trabalhe-conosco/'],
  [/^\/(politica-de-privacidade|privacidade)\/?$/i, '/politica-de-privacidade/'],
  [/^\/(termos|termos-de-uso)\/?$/i, '/termos-de-uso/'],
];

const campo = (html, re) => { const m = html.match(re); return m ? m[1].trim().replace(/\s+/g, ' ') : ''; };

async function pega(url, metodo = 'GET') {
  try {
    const r = await fetch(url, { method: metodo, redirect: 'manual', headers: { 'User-Agent': 'auditoria-migracao/1.0' } });
    return { status: r.status, destino: r.headers.get('location') || '', tipo: r.headers.get('content-type') || '', corpo: metodo === 'GET' && r.status < 300 ? await r.text() : '' };
  } catch (e) {
    return { status: 0, destino: '', tipo: '', corpo: '', erro: e.message };
  }
}

async function sitemapsDeclarados() {
  const r = await pega(base + '/robots.txt');
  const achados = [...(r.corpo || '').matchAll(/^\s*Sitemap:\s*(\S+)/gim)].map((m) => m[1]);
  console.log(`robots.txt: HTTP ${r.status}${achados.length ? `, ${achados.length} sitemap(s) declarado(s)` : ', nenhum Sitemap: declarado'}`);
  if (r.corpo) console.log('--- robots.txt ---\n' + r.corpo.trim() + '\n------------------');
  return achados.length ? achados : [base + '/sitemap.xml', base + '/sitemap_index.xml', base + '/wp-sitemap.xml'];
}

async function urlsDoSitemap(url, vistos = new Set()) {
  if (vistos.has(url)) return [];
  vistos.add(url);
  const r = await pega(url);
  if (r.status !== 200 || !r.corpo) { console.log(`  ${url} -> HTTP ${r.status}`); return []; }
  const locs = [...r.corpo.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((m) => m[1]);
  const indice = /<sitemapindex/i.test(r.corpo);
  console.log(`  ${url} -> ${locs.length} ${indice ? 'sitemap(s) filho' : 'URL(s)'}`);
  if (!indice) return locs.map((l) => ({ loc: l, sitemap: url }));
  const filhos = [];
  for (const f of locs) filhos.push(...await urlsDoSitemap(f, vistos));
  return filhos;
}

function sugere(caminho) {
  const limpo = caminho.replace(/\/+$/, '/') || '/';
  if (ROTAS_NOVAS.includes(limpo)) return { acao: 'MANTEM', destino: limpo };
  for (const [re, dest] of SUGESTOES) if (re.test(limpo)) return { acao: 'REDIRECIONA', destino: dest };
  if (/^\/(wp-content|wp-includes|feed|author|tag|category|\d{4})\//i.test(limpo)) return { acao: 'DECIDIR', destino: '' };
  return { acao: 'DECIDIR', destino: '' };
}

console.log(`\nAuditoria do site antigo: ${base}\n`);
const sitemaps = await sitemapsDeclarados();
console.log('\nSitemaps:');
const entradas = [];
for (const s of sitemaps) entradas.push(...await urlsDoSitemap(s));

const unicas = [...new Map(entradas.map((e) => [e.loc, e])).values()];
console.log(`\n${unicas.length} URL(s) unica(s). Conferindo uma a uma...\n`);

const linhas = [['url', 'sitemap_de_origem', 'status', 'redireciona_para', 'title', 'description', 'canonical', 'meta_robots', 'acao_sugerida', 'destino_sugerido']];
let i = 0;
for (const e of unicas) {
  i++;
  const r = await pega(e.loc);
  let caminho = '/';
  try { caminho = new URL(e.loc).pathname; } catch {}
  const s = sugere(caminho);
  linhas.push([
    e.loc, e.sitemap, String(r.status), r.destino,
    campo(r.corpo, /<title[^>]*>([^<]*)<\/title>/i),
    campo(r.corpo, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i),
    campo(r.corpo, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i),
    campo(r.corpo, /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["']/i),
    s.acao, s.destino,
  ]);
  if (i % 10 === 0 || i === unicas.length) console.log(`  ${i}/${unicas.length}`);
}

const csv = linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
fs.writeFileSync(saida, '﻿' + csv, 'utf8');

const conta = (a) => linhas.slice(1).filter((l) => l[8] === a).length;
console.log(`\nEscrito: ${saida}`);
console.log(`  MANTEM ${conta('MANTEM')}   REDIRECIONA ${conta('REDIRECIONA')}   DECIDIR ${conta('DECIDIR')}`);
console.log(`\nAbra o CSV e decida cada linha DECIDIR. Nao mande tudo para a home:`);
console.log(`redirecionamento em massa para a raiz e tratado como pagina nao encontrada.\n`);
