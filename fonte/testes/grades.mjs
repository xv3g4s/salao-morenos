/**
 * Grades que fecham: nenhuma linha termina com célula vazia.
 *
 *   node fonte/testes/grades.mjs public [--mapa]
 *
 * Abre cada rota em várias larguras de tela, acha todo elemento com
 * display:grid e confere, linha a linha, se a soma das larguras dos itens
 * mais os vãos dá a largura do contêiner. Sobra = buraco no fim da linha;
 * falta = item estourando para fora. Em grade centrada de propósito
 * (justify-content: center, cartão com largura máxima) a comparação é com a
 * fileira mais larga da própria grade, e não com o contêiner. Também cobra que nenhum item tenha
 * largura zero: com repeat(auto-fit, ...) um item em span 2 numa tela
 * estreita caía numa coluna implícita de 0px e simplesmente sumia.
 *
 * --mapa imprime todas as grades encontradas, com colunas e itens por linha.
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

// celular estreito, celular, tablet em pe, tablet deitado, notebook,
// notebook grande, desktop, desktop largo.
const LARGURAS = [360, 390, 600, 768, 900, 1024, 1280, 1440, 1920];

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.webm': 'video/webm',
  '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
  '.xml': 'application/xml', '.txt': 'text/plain',
};

const srv = http.createServer((q, r) => {
  const p = decodeURIComponent(q.url.split('?')[0]);
  let f = path.join(RAIZ, p);
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { r.writeHead(404); return r.end('nao encontrado'); }
  r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${srv.address().port}`;

let ok = 0;
const falhas = [];
const checa = (cond, msg) => (cond ? (ok++, true) : (falhas.push(msg), false));

const navegador = await chromium.launch();
const mapa = [];

for (const largura of LARGURAS) {
  const ctx = await navegador.newContext({ viewport: { width: largura, height: 900 } });
  const pagina = await ctx.newPage();
  for (const rota of ROTAS) {
    await pagina.goto(base + rota, { waitUntil: 'load' });
    await pagina.waitForFunction(() => document.documentElement.classList.contains('mo-vivo')
      && !document.getElementById('mo-estatico'), null, { timeout: 20000 });
    await pagina.waitForTimeout(200);

    const grades = await pagina.evaluate(() => {
      const nome = (el) => {
        const s = el.closest('section');
        if (!s) return el.tagName.toLowerCase();
        const h = s.querySelector('h1,h2');
        return s.getAttribute('aria-label') || (h && h.textContent.trim().slice(0, 44))
          || s.id || s.tagName.toLowerCase();
      };
      const saida = [];
      for (const el of document.querySelectorAll('body *')) {
        const cs = getComputedStyle(el);
        if (cs.display !== 'grid') continue;
        const noFluxo = [...el.children].filter((c) => {
          const s = getComputedStyle(c);
          return s.position !== 'absolute' && s.position !== 'fixed' && s.display !== 'none';
        });
        const sumidos = noFluxo.filter((c) => c.getBoundingClientRect().width < 1).length;
        const itens = noFluxo.filter((c) => {
          const r = c.getBoundingClientRect();
          return r.width > 0.5 && r.height > 0.5;
        });
        if (itens.length < 2 && !sumidos) continue;
        const caixa = el.clientWidth
          - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0);
        if (caixa < 10) continue;
        const vao = parseFloat(cs.columnGap) || 0;
        const linhas = new Map();
        for (const c of itens) {
          const r = c.getBoundingClientRect();
          const chave = Math.round(r.top / 4) * 4;
          if (!linhas.has(chave)) linhas.set(chave, []);
          linhas.get(chave).push(r.width);
        }
        const usados = [...linhas.values()].map(
          (l) => l.reduce((a, b) => a + b, 0) + vao * (l.length - 1));
        // Numa grade centrada de proposito (justify-content: center), a fileira
        // nao ocupa a largura toda: o cartao tem largura maxima e o conjunto
        // fica no meio. Ali a regra e outra — todas as fileiras tem que ter a
        // mesma largura, senao a ultima e que esta faltando item.
        const centrada = !['normal', 'stretch', 'start', 'flex-start'].includes(cs.justifyContent);
        const alvo = centrada ? Math.max(...usados) : caixa;
        const tortas = [];
        [...linhas.values()].forEach((larguras, i) => {
          const sobra = alvo - usados[i];
          // folga para o arredondamento de subpixel do navegador
          if (Math.abs(sobra) > Math.max(4, vao / 2)) {
            tortas.push({ itens: larguras.length, sobra: Math.round(sobra) });
          }
        });
        saida.push({
          secao: nome(el), itens: itens.length, sumidos, tortas,
          porLinha: [...linhas.values()].map((l) => l.length).join('+'),
          colunas: cs.gridTemplateColumns.split(' ').length,
        });
      }
      return saida;
    });

    for (const g of grades) {
      const onde = `${rota} w=${largura} "${g.secao}" (${g.itens} itens, ${g.porLinha})`;
      checa(g.sumidos === 0, `${onde}: ${g.sumidos} item(ns) com largura zero`);
      checa(g.tortas.length === 0, g.tortas.length
        ? `${onde}: linha nao fecha — ${g.tortas.map((t) => `${t.itens} itens, ${t.sobra > 0 ? 'sobra' : 'falta'} ${Math.abs(t.sobra)}px`).join('; ')}`
        : '');
      if (MAPA) mapa.push(`${String(largura).padStart(4)}  ${rota.padEnd(38)} ${g.porLinha.padEnd(9)} ${g.secao}`);
    }
  }
  await ctx.close();
}

await navegador.close();
srv.close();

if (MAPA) {
  console.log('\nlargura  rota                                   linhas    secao');
  [...new Set(mapa)].forEach((l) => console.log('  ' + l));
  console.log('');
}

falhas.forEach((f) => console.log(`  FALHA  ${f}`));
console.log(`\n${ok} ok, ${falhas.length} falha(s)`);
process.exit(falhas.length ? 1 : 0);
