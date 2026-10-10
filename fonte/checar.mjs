/**
 * Confere o site publicado, servindo a raiz do repositorio como um host faria
 * (index.html por pasta, 404.html em pagina inexistente).
 *
 *   node fonte/checar.mjs [dir] [dir-de-capturas]
 *
 * Verifica:
 *   1. todas as rotas existem e nenhuma tem marcador {{ }} cru;
 *   2. link interno nao aponta mais para arquivo do prototipo (.dc.html) e
 *      resolve para uma pagina que existe;
 *   3. sem JavaScript: a copia estatica aparece, com texto, imagens e links;
 *   4. com JavaScript: o runtime monta, a copia estatica sai, nao sobra titulo
 *      nem JSON-LD duplicado, e as interacoes respondem (modal de unidades,
 *      menu, FAQ);
 *   5. nenhuma requisicao externa fora do mapa do Google (iframe do design);
 *   6. sem erro de JavaScript, sem rolagem horizontal, viewport na largura da
 *      tela no celular.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(process.argv[2] || '.');
const CAPTURAS = process.argv[3] ? path.resolve(process.argv[3]) : null;
if (CAPTURAS) fs.mkdirSync(CAPTURAS, { recursive: true });

const ROTAS = [
  '/', '/unidades/', '/unidades/cidade-continental/',
  '/unidades/novo-horizonte-av-brasil/', '/unidades/novo-horizonte-av-industrial/',
  '/servicos/', '/servicos/corte-masculino/', '/servicos/barboterapia/',
  '/visagismo/', '/dia-do-noivo/', '/o-clube/', '/cultura/', '/corporativo/',
  '/trabalhe-conosco/', '/politica-de-privacidade/', '/termos-de-uso/',
];

// O design embute o mapa do Google por iframe; o resto tem que ser local.
const EXTERNO_PERMITIDO = /^https:\/\/(www\.)?google\.com\/maps|^https:\/\/maps\.(google|gstatic)\.com|^https:\/\/www\.gstatic\.com/;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8', '.json': 'application/json',
};

// O servidor de teste aplica as regras de bloqueio do .htaccess. Sem isto ele
// seria mais permissivo que a HostGator e esconderia o tipo de erro que ja
// aconteceu em producao: uma regra bloqueando *.dc.html derrubou o cabecalho,
// o rodape e o corpo das paginas internas, e o teste local passava.
const REGRAS_NEGADAS = (() => {
  const f = path.join(RAIZ, '.htaccess');
  if (!fs.existsSync(f)) return [];
  let txt = fs.readFileSync(f, 'utf8')
    .replace(/<IfModule\s+![^>]*>[\s\S]*?<\/IfModule>/gi, '');  // so valem sem o modulo
  const regras = [];
  for (const [tag, literal] of [['FilesMatch', false], ['Files', true]]) {
    const re = new RegExp(`<${tag}\\s+"([^"]+)"\\s*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
    for (const m of txt.matchAll(re)) {
      if (!/Require all denied|Deny from all/i.test(m[2])) continue;
      regras.push(new RegExp(literal ? `^${m[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$` : m[1]));
    }
  }
  return regras;
})();

const negado = (f) => REGRAS_NEGADAS.some((re) => re.test(path.basename(f)));

const arquivoDe = (url) => {
  let p = decodeURIComponent(url.split('?')[0].split('#')[0]);
  let f = path.join(RAIZ, p);
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  else if (!fs.existsSync(f) && fs.existsSync(f + '/index.html')) f = f + '/index.html';
  return f;
};

const server = http.createServer((req, res) => {
  const f = arquivoDe(req.url);
  if (negado(f)) { res.writeHead(403); return res.end('bloqueado pelo .htaccess'); }
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    const e404 = path.join(RAIZ, '404.html');
    if (fs.existsSync(e404)) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return fs.createReadStream(e404).pipe(res);
    }
    res.writeHead(404); return res.end('nao encontrado');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const falhas = [];
const ok = [];
const checa = (cond, msg) => (cond ? ok : falhas).push(msg);

// ------------------------------------------------- 1 e 2) HTML no disco -----
{
  let cru = 0, faltando = 0, protot = 0, quebrados = [];
  const existe = (href) => {
    const f = arquivoDe(href);
    return fs.existsSync(f) && !fs.statSync(f).isDirectory();
  };
  for (const rota of [...ROTAS, '/404.html']) {
    const f = arquivoDe(rota);
    if (!fs.existsSync(f)) { faltando++; continue; }
    const html = fs.readFileSync(f, 'utf8');
    // o marcador cru so pode existir dentro do template <x-dc>, nunca na copia
    const estatico = html.split('<div id="mo-estatico">')[1]?.split('<x-dc>')[0] || '';
    if (/\{\{|\}\}/.test(estatico)) cru++;
    if (/href="[^"]*\.dc\.html/.test(estatico)) protot++;
    for (const m of estatico.matchAll(/href="(\/[^"#?]*)"/g)) {
      if (!existe(m[1]) && !quebrados.includes(m[1])) quebrados.push(m[1]);
    }
  }
  checa(faltando === 0, `${ROTAS.length + 1} rotas no disco (${faltando} faltando)`);
  checa(cru === 0, `nenhuma copia estatica com marcador {{ }} (${cru} com)`);
  checa(protot === 0, `nenhum link para arquivo do prototipo .dc.html (${protot} com)`);
  checa(quebrados.length === 0,
    quebrados.length ? `LINK INTERNO QUEBRADO: ${quebrados.slice(0, 5).join(', ')}`
                     : 'todo link interno resolve para uma pagina que existe');
}

// os componentes precisam ser servidos: o navegador os busca em tempo de execucao
{
  const comps = ['SiteHeader', 'SiteFooter', 'PaginaMorenos']
    .map((c) => path.join(RAIZ, '_dc', `${c}.dc.html`));
  const faltando = comps.filter((f) => !fs.existsSync(f));
  const barrados = comps.filter((f) => negado(f));
  checa(faltando.length === 0, `componentes em /_dc/ publicados (${comps.length - faltando.length}/3)`);
  checa(barrados.length === 0,
    barrados.length ? `COMPONENTE BLOQUEADO PELO .htaccess: ${barrados.map((f) => path.basename(f)).join(', ')}`
                    : 'nenhum componente de /_dc/ bloqueado pelo .htaccess');
}

const browser = await chromium.launch();
const CELULAR = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const MESA = { viewport: { width: 1440, height: 900 } };

// ---------------------------------------------------- 3) sem JavaScript -----
for (const rota of ['/', '/unidades/cidade-continental/', '/o-clube/']) {
  const ctx = await browser.newContext({ ...CELULAR, javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(base + rota, { waitUntil: 'load' });
  await page.waitForTimeout(900);
  const r = await page.evaluate(() => ({
    texto: document.body.innerText.trim().length,
    imagens: [...document.images].filter((i) => i.complete && i.naturalWidth > 0).length,
    h1: document.querySelectorAll('#mo-estatico h1').length,
    templateVisivel: [...document.querySelectorAll('x-dc')]
      .some((el) => getComputedStyle(el).display !== 'none'),
    // Conteudo invisivel sem JavaScript. Enfeite decorativo que nasce
    // transparente e aparece no hover (aria-hidden, sem texto) nao conta.
    invisivel: [...document.querySelectorAll('#mo-estatico *')]
      .filter((el) => getComputedStyle(el).opacity === '0')
      .filter((el) => el.tagName === 'IMG' || (el.innerText || '').trim().length > 0)
      .filter((el) => el.getAttribute('aria-hidden') !== 'true')
      // legenda que so aparece no hover e imagem de crossfade sao sempre
      // posicionadas por cima: nao sao conteudo perdido
      .filter((el) => getComputedStyle(el).position !== 'absolute').length,
  }));
  checa(r.texto > 1500, `sem JS ${rota}: ${r.texto} caracteres na tela`);
  checa(r.imagens > 1, `sem JS ${rota}: ${r.imagens} imagens carregadas`);
  checa(r.h1 === 1, `sem JS ${rota}: ${r.h1} <h1>`);
  checa(!r.templateVisivel, `sem JS ${rota}: template <x-dc> escondido`);
  checa(r.invisivel === 0, `sem JS ${rota}: nenhum conteudo invisivel (${r.invisivel})`);
  if (CAPTURAS && rota === '/') await page.screenshot({ path: path.join(CAPTURAS, 'sem-js-home.png') });
  await ctx.close();
}

// ---------------------------------------------------- 4,5,6) com JS ---------
for (const [nome, perfil, rotas] of [
  ['celular', CELULAR, ['/', '/unidades/', '/o-clube/']],
  ['desktop', MESA, ['/', '/servicos/corte-masculino/']],
]) {
  for (const rota of rotas) {
    const ctx = await browser.newContext(perfil);
    const page = await ctx.newPage();
    const externas = [], errosJs = [];
    page.on('request', (req) => {
      const u = req.url();
      if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) return;
      if (EXTERNO_PERMITIDO.test(u)) return;
      externas.push(u);
    });
    page.on('pageerror', (e) => errosJs.push(String(e.message)));
    page.on('console', (m) => { if (m.type() === 'error') errosJs.push(m.text()); });

    await page.goto(base + rota, { waitUntil: 'networkidle' });
    await page.waitForSelector('html.mo-vivo', { timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(1800);

    const r = await page.evaluate(() => ({
      trocou: document.documentElement.classList.contains('mo-vivo'),
      estaticoFora: !document.getElementById('mo-estatico'),
      titulos: document.querySelectorAll('title').length,
      canonicos: document.querySelectorAll('link[rel="canonical"]').length,
      ld: document.querySelectorAll('script[type="application/ld+json"]').length,
      h1: document.querySelectorAll('h1').length,
      janela: window.innerWidth,
      documento: document.documentElement.clientWidth,
    }));
    const etq = `${nome} ${rota}`;
    checa(r.trocou && r.estaticoFora, `${etq}: runtime montou e a copia estatica saiu`);
    checa(r.titulos === 1 && r.canonicos === 1, `${etq}: 1 <title> e 1 canonical depois da troca`);
    checa(r.h1 === 1, `${etq}: ${r.h1} <h1> depois da troca`);
    checa(r.janela === r.documento, `${etq}: viewport na largura da tela (${r.janela}/${r.documento})`);
    checa(externas.length === 0,
      externas.length ? `${etq}: REQUISICAO EXTERNA -> ${externas.slice(0, 2).join(', ')}`
                      : `${etq}: nenhuma requisicao a dominio de terceiro`);
    checa(errosJs.length === 0,
      errosJs.length ? `${etq}: ERRO DE JS -> ${errosJs.slice(0, 2).join(' | ')}`
                     : `${etq}: nenhum erro de JavaScript`);

    const andou = await page.evaluate(() => {
      window.scrollTo(600, window.pageYOffset); const x = window.pageXOffset;
      window.scrollTo(0, window.pageYOffset); return x;
    });
    checa(andou === 0, `${etq}: a pagina nao anda para o lado`);

    // modal de unidades: o CTA principal de todas as paginas
    const agendar = page.getByRole('button', { name: /^Agendar$/i }).first();
    if (await agendar.count()) {
      await agendar.click();
      await page.waitForTimeout(700);
      const abriu = await page.getByRole('dialog').first().isVisible().catch(() => false);
      checa(abriu, `${etq}: o modal de unidades abre no "Agendar"`);
      if (CAPTURAS && abriu && rota === '/') {
        await page.screenshot({ path: path.join(CAPTURAS, `modal-${nome}.png`) });
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      const fechou = !(await page.getByRole('dialog').first().isVisible().catch(() => false));
      checa(fechou, `${etq}: Escape fecha o modal`);
    }

    if (CAPTURAS && rota === '/') await page.screenshot({ path: path.join(CAPTURAS, `com-js-${nome}.png`) });
    await ctx.close();
  }
}

// menu (mega menu no desktop, acordeao no celular)
{
  const ctx = await browser.newContext(MESA);
  const page = await ctx.newPage();
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.waitForSelector('html.mo-vivo', { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const botao = page.getByRole('button', { name: 'Unidades' }).first();
  if (await botao.count()) {
    await botao.hover();
    await page.waitForTimeout(700);
    const itens = await page.getByRole('link', { name: /Cidade Continental/ }).count();
    checa(itens > 0, 'desktop: o mega menu de Unidades abre');
    if (CAPTURAS) await page.screenshot({ path: path.join(CAPTURAS, 'megamenu.png') });
  } else {
    checa(false, 'desktop: nao achei o botao Unidades no cabecalho');
  }
  await ctx.close();
}

await browser.close();
server.close();

ok.forEach((m) => console.log('  ok   ' + m));
falhas.forEach((m) => console.log('  FALHA ' + m));
console.log(`\n${ok.length} ok, ${falhas.length} falha(s)`);
process.exit(falhas.length ? 1 : 0);
