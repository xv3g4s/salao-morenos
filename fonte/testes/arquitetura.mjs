/**
 * Arquitetura de conteudo: confere o que o visitante realmente ve.
 *
 *   node fonte/testes/arquitetura.mjs public [--mapa]
 *
 * Abre cada rota com JavaScript ligado, espera a troca das duas camadas
 * (a copia estatica sai, a pagina viva entra) e le as secoes do DOM
 * renderizado — titulo, id e tamanho. Depois cobra as regras que a revisao
 * de arquitetura fixou:
 *
 *   1. nenhuma secao (mesmo h2) repetida em mais de 3 rotas;
 *   2. nenhuma rota com dois blocos de lista de unidades;
 *   3. encerramento sem repetir os cartoes das tres unidades;
 *   4. nenhum recado interno no HTML publicado;
 *   5. cada rota com h1 proprio e titulo proprio;
 *   6. toda rota termina com um proximo passo (link ou botao de acao).
 *
 * --mapa imprime o mapa de secoes por rota (para revisar conteudo a mao).
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(process.argv[2] || 'public');
const MAPA = process.argv.includes('--mapa');

const ROTAS = [
  '/', '/unidades/', '/unidades/cidade-continental/', '/unidades/novo-horizonte-av-brasil/',
  '/unidades/novo-horizonte-av-industrial/', '/servicos/', '/servicos/corte-masculino/',
  '/servicos/barboterapia/', '/visagismo/', '/dia-do-noivo/', '/o-clube/', '/cultura/',
  '/corporativo/', '/trabalhe-conosco/', '/politica-de-privacidade/', '/termos-de-uso/',
];

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain',
};

function servidor() {
  return http.createServer((q, r) => {
    let p = decodeURIComponent(q.url.split('?')[0]);
    let f = path.join(RAIZ, p);
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!fs.existsSync(f)) { r.writeHead(404); return r.end('nao encontrado'); }
    r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(r);
  });
}

// "Todos os serviços" nao e recado: TODO so conta com os dois-pontos.
const RECADOS = /TODO:|FIXME|HACK:/;
const RECADOS_I = /confirmar com o? ?cliente|pendente de coleta|espaço reservado para|lorem ipsum|a importar/i;

let ok = 0;
const falhas = [];
const checa = (cond, msg) => (cond ? (ok++, true) : (falhas.push(msg), false));

const srv = servidor();
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${srv.address().port}`;
const navegador = await chromium.launch();
const ctx = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
const pagina = await ctx.newPage();

const mapa = {};

for (const rota of ROTAS) {
  await pagina.goto(base + rota, { waitUntil: 'load' });
  await pagina.waitForFunction(() => document.documentElement.classList.contains('mo-vivo')
    && !document.getElementById('mo-estatico'), null, { timeout: 15000 });
  await pagina.waitForTimeout(250);

  const dados = await pagina.evaluate(() => {
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
    };
    const secoes = [...document.querySelectorAll('main section, main > div[aria-hidden="true"]')]
      .filter(vis)
      .map((el) => ({
        id: el.id || '',
        h2: (el.querySelector('h2')?.textContent || '').trim().replace(/\s+/g, ' '),
        rotulo: (el.getAttribute('aria-label') || '').trim(),
        palavras: (el.textContent || '').trim().split(/\s+/).filter(Boolean).length,
        cartoesUnidade: el.querySelectorAll('[id^="novo-horizonte"], [id="cidade-continental"]').length,
        listaUnidades: /Avenida Terceiro Mundo/.test(el.textContent || '')
          && /Avenida Brasil/.test(el.textContent || '')
          && /Avenida Industrial/.test(el.textContent || ''),
        decorativa: el.getAttribute('aria-hidden') === 'true',
      }));
    const ultima = secoes[secoes.length - 1];
    const el = [...document.querySelectorAll('main section')].pop();
    return {
      titulo: document.title,
      h1: [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()),
      secoes,
      texto: document.body.innerText,
      fechaComAcao: !!el && !!el.querySelector('a[href], button'),
      ultimaSecao: ultima ? (ultima.h2 || ultima.rotulo) : '',
    };
  });

  // O runtime do Claude Design prende html/body em height:100% quando a pagina
  // nao tem $preview (FULL_PAGE_CSS no support.js). Publicado, isso deixa a
  // rota inteira sem rolagem: o visitante ve o hero e mais nada. O build
  // devolve a altura (ALTURA_LIVRE); aqui a gente cobra o resultado.
  const rolagem = await pagina.evaluate(async () => {
    const antes = window.scrollY;
    window.scrollTo(0, 1e6);
    const desceu = window.scrollY > antes;
    // rolar carrega as imagens adiadas e a pagina cresce: desce de novo
    await new Promise((r) => setTimeout(r, 600));
    window.scrollTo(0, 1e6);
    await new Promise((r) => setTimeout(r, 300));
    const fim = [...document.querySelectorAll('footer')].pop();
    const r = fim ? fim.getBoundingClientRect() : null;
    const visivel = !!r && r.top < window.innerHeight && r.bottom > 0;
    window.scrollTo(0, 0);
    return { alt: document.documentElement.scrollHeight, janela: window.innerHeight, desceu, visivel };
  });
  checa(rolagem.alt > rolagem.janela + 50,
    `${rota}: o documento tem ${rolagem.alt}px para uma janela de ${rolagem.janela}px — a pagina nao rola`);
  checa(rolagem.desceu, `${rota}: rolar a pagina nao mexeu em nada`);
  checa(rolagem.visivel, `${rota}: o rodape nao e alcancado ao rolar ate o fim`);

  mapa[rota] = dados;
  checa(dados.h1.length === 1, `${rota}: ${dados.h1.length} <h1>`);
  checa(!RECADOS.test(dados.texto) && !RECADOS_I.test(dados.texto),
    `${rota}: recado interno visivel na pagina`);
  const juridica = /politica-de-privacidade|termos-de-uso/.test(rota);
  if (!juridica) checa(dados.fechaComAcao, `${rota}: a ultima secao nao oferece proximo passo`);

  // a primeira secao e o hero: a tira de enderecos ali e atalho de navegacao
  const listas = dados.secoes.slice(1).filter((s) => s.listaUnidades && !s.decorativa);
  checa(listas.length <= 1,
    `${rota}: ${listas.length} blocos com a lista das tres unidades (${listas.map((s) => s.h2 || s.rotulo).join(' | ')})`);

  const fim = dados.secoes[dados.secoes.length - 1];
  checa(!fim || fim.cartoesUnidade === 0,
    `${rota}: o encerramento repete os cartoes das unidades`);
}

// 1) secao repetida entre rotas
const porH2 = {};
for (const [rota, d] of Object.entries(mapa)) {
  for (const s of d.secoes) {
    if (!s.h2) continue;
    (porH2[s.h2] = porH2[s.h2] || []).push(rota);
  }
}
for (const [h2, rotas] of Object.entries(porH2)) {
  checa(rotas.length <= 3, `secao "${h2}" aparece em ${rotas.length} rotas: ${rotas.join(', ')}`);
}

// 5) titulo proprio por rota
const titulos = Object.entries(mapa).map(([r, d]) => [r, d.titulo]);
const repetidos = titulos.filter(([, t], i) => titulos.findIndex(([, o]) => o === t) !== i);
checa(repetidos.length === 0, `titulos repetidos: ${repetidos.map(([r]) => r).join(', ')}`);

// quem pede menos movimento tem que receber a pagina inteira, parada e sem
// ficar preso na tela de abertura
const ctxParado = await navegador.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
const pParado = await ctxParado.newPage();
await pParado.goto(base + '/', { waitUntil: 'load' });
await pParado.waitForFunction(() => document.documentElement.classList.contains('mo-vivo')
  && !document.getElementById('mo-estatico'), null, { timeout: 15000 });
await pParado.waitForTimeout(1200);
const parado = await pParado.evaluate(() => {
  const l = document.getElementById('morenos-loader') || document.querySelector('[data-loader]');
  const infinitas = [...document.querySelectorAll('*')].filter((el) => {
    const cs = getComputedStyle(el);
    return cs.animationName !== 'none' && cs.animationIterationCount === 'infinite';
  }).length;
  return { loaderFora: !l || getComputedStyle(l).display === 'none' || l.offsetParent === null,
           infinitas, palavras: document.body.innerText.trim().split(/\s+/).length };
});
checa(parado.loaderFora, 'reduced-motion: a tela de abertura nao saiu');
checa(parado.infinitas === 0, `reduced-motion: ${parado.infinitas} animacoes continuam em loop`);
checa(parado.palavras > 200, `reduced-motion: a Home ficou com ${parado.palavras} palavras`);

await navegador.close();
srv.close();

if (MAPA) {
  for (const [rota, d] of Object.entries(mapa)) {
    console.log(`\n${rota}  — ${d.titulo}`);
    console.log(`  h1: ${d.h1.join(' / ')}`);
    d.secoes.forEach((s, i) => console.log(
      `  ${String(i + 1).padStart(2)}. ${(s.h2 || s.rotulo || '(sem titulo)').slice(0, 58).padEnd(58)} ${String(s.palavras).padStart(4)} pal.${s.decorativa ? '  [decorativa]' : ''}`));
  }
  console.log('');
}

falhas.forEach((f) => console.log(`  FALHA  ${f}`));
console.log(`\n${ok} ok, ${falhas.length} falha(s)`);
process.exit(falhas.length ? 1 : 0);
