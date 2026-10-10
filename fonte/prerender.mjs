/**
 * Pre-renderiza as rotas do site do Salao Morenos.
 *
 * O prototipo do Claude Design e um template: o support.js monta a pagina no
 * navegador a partir de marcadores {{ }}. O HANDOFF.md pede pre-renderizacao
 * justamente para o HTML publicado nao chegar cru ao robo de busca.
 *
 * A pagina publicada leva duas camadas:
 *
 *   1. Uma copia ESTATICA da pagina montada, capturada aqui, no build, em
 *      viewport de celular. E o que o visitante ve no primeiro quadro e o que o
 *      robo le: texto, imagens e links prontos, sem depender de JavaScript.
 *   2. O template + o runtime, carregados com `defer`. Quando o React monta, a
 *      copia estatica sai e a pagina viva entra no lugar, com mega menu, modal
 *      de unidades, lightbox, abas, acordeoes e formularios como foram
 *      desenhados.
 *
 * Reescrever essas interacoes em JavaScript comum seria manter uma segunda
 * implementacao do design, que divergiria na primeira reexportacao. Se o
 * JavaScript falhar ou for bloqueado, a camada 1 continua na tela.
 *
 * A captura roda em 390x844 porque a largura decide o que o design monta
 * (`isDesktop` / mega menu x menu de celular), e celular e como o Google
 * indexa.
 *
 * Uso: node fonte/prerender.mjs <palco> <dir-de-saida> <rotas.json>
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PALCO = path.resolve(process.argv[2]);
const SAIDA = path.resolve(process.argv[3]);
const ROTAS = JSON.parse(fs.readFileSync(process.argv[4], 'utf8'));

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/Home.dc.html';
  const f = path.join(PALCO, p);
  if (!f.startsWith(PALCO) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404); return res.end('nao encontrado');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const contexto = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2, isMobile: true, hasTouch: true,
});

// A tela de abertura (site-loader.js) espera no minimo 1,2s em cada carga. No
// build ela so atrasaria a captura: o `?intro=0` nao existe, entao a desligamos
// pela mesma chave de sessao que ela usa.
await contexto.addInitScript(() => {
  try { sessionStorage.setItem('morenos_intro_seen', '1'); } catch (e) { /* ignora */ }
});

const TROCA = `<style id="mo-troca">
  x-dc { display: none !important; }
  #dc-root { display: none; }
  html.mo-vivo #dc-root { display: block; }
  html.mo-vivo #mo-estatico { display: none; }
</style>`;

const COLA = `<script>
/* Troca a copia estatica pela pagina viva assim que o runtime monta.
   Enquanto #dc-root esta escondido por CSS, o navegador nunca pinta as duas
   camadas ao mesmo tempo: a troca acontece em um unico quadro, e a altura e a
   mesma nas duas, entao a rolagem fica onde estava.
   Depois tira do <head> o que ficou em duplicata — o runtime reaplica o
   <helmet> (title, meta, canonical, JSON-LD) que a copia estatica ja trazia.
   Se o runtime nunca montar, nada disso roda e a copia estatica continua. */
(function () {
  var raiz = document.documentElement;
  function limpaCabeca() {
    var vistos = {};
    function chave(el) {
      if (el.tagName === 'TITLE') return 'title';
      if (el.tagName === 'META') {
        var k = el.getAttribute('name') || el.getAttribute('property') ||
                el.getAttribute('http-equiv') || (el.hasAttribute('charset') ? 'charset' : '');
        return k ? 'meta:' + k : '';
      }
      if (el.tagName === 'LINK' && (el.getAttribute('rel') || '') === 'canonical') return 'canonical';
      if (el.tagName === 'SCRIPT' && el.type === 'application/ld+json') return 'ld:' + el.textContent;
      return '';
    }
    var filhos = [].slice.call(document.head.children);
    for (var i = 0; i < filhos.length; i++) {
      var k = chave(filhos[i]);
      if (!k) continue;
      if (vistos[k]) filhos[i].parentNode.removeChild(filhos[i]);
      else vistos[k] = true;
    }
  }
  function troca() {
    var vivo = document.getElementById('dc-root');
    if (!vivo || !vivo.firstElementChild) return false;
    var y = window.pageYOffset || raiz.scrollTop || 0;
    raiz.classList.add('mo-vivo');
    var estatico = document.getElementById('mo-estatico');
    if (estatico && estatico.parentNode) estatico.parentNode.removeChild(estatico);
    if (y) window.scrollTo(0, y);
    limpaCabeca();
    return true;
  }
  if (troca()) return;
  var obs = new MutationObserver(function () { if (troca()) obs.disconnect(); });
  obs.observe(document.body, { childList: true, subtree: true });
  setTimeout(function () { obs.disconnect(); troca(); }, 15000);
})();
</script>`;

const recorta = (fonte, inicio, fim, oque, arquivo) => {
  const a = fonte.indexOf(inicio);
  const b = fonte.indexOf(fim, a);
  if (a < 0 || b < 0) {
    console.error(`ERRO: nao achei ${oque} em ${arquivo}.`);
    process.exit(1);
  }
  return fonte.slice(a, b + fim.length);
};

let falhou = false;
const resumo = [];

for (const { arquivo, saida, minTexto = 1200 } of ROTAS) {
  const page = await contexto.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e.message)));
  page.on('requestfailed', (r) => {
    const u = r.url();
    if (u.startsWith(base)) erros.push('404/falha: ' + u.slice(base.length));
  });

  await page.goto(`${base}/${arquivo}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#dc-root > *', { timeout: 30000 });
  await page.waitForTimeout(2200);

  const capturado = await page.evaluate(() => {
    // 1) O runtime cria as regras de :hover via CSSOM (insertRule), que nao
    //    aparecem no outerHTML. Sem isto os hovers somem na copia estatica.
    const perdidas = [];
    for (const folha of document.styleSheets) {
      const dono = folha.ownerNode;
      if (dono && dono.tagName === 'STYLE' && dono.textContent.trim()) continue;
      if (folha.href) continue;
      try { for (const regra of folha.cssRules) perdidas.push(regra.cssText); } catch (e) { /* outra origem */ }
    }
    if (perdidas.length) {
      const s = document.createElement('style');
      s.setAttribute('data-runtime-css', '');
      s.textContent = '/* regras que o runtime cria via CSSOM */\n' + perdidas.join('\n');
      document.head.appendChild(s);
    }

    // 2) A revelacao ao rolar (data-rv / data-reveal) zera a opacidade do que
    //    esta abaixo da dobra. Sem JavaScript isso seria conteudo invisivel.
    document.querySelectorAll('[data-rv], [data-reveal], [data-cine]').forEach((el) => {
      el.style.opacity = '';
      el.style.transform = '';
      el.style.animation = '';
      el.removeAttribute('data-rv-on');
    });

    // 2-bis) O acordeao do FAQ e desenhado com todas as respostas no DOM e
    //    opacidade zero nas fechadas. Sem JavaScript ninguem consegue abrir,
    //    entao na copia estatica o texto nasce visivel — melhor um FAQ todo
    //    aberto do que respostas invisiveis. Enfeite decorativo que acende no
    //    hover (aria-hidden, sem texto, posicionado por cima) continua como
    //    esta.
    document.querySelectorAll('#dc-root [style*="opacity"]').forEach((el) => {
      if (getComputedStyle(el).opacity !== '0') return;
      if (el.getAttribute('aria-hidden') === 'true') return;
      if (!(el.innerText || '').trim()) return;
      if (getComputedStyle(el).position === 'absolute') return;
      el.style.opacity = '';
      el.style.maxHeight = '';
      el.style.visibility = '';
    });

    // 3) A primeira imagem (LCP) nao pode esperar; o resto pode.
    const imgs = [...document.querySelectorAll('#dc-root img')];
    imgs.forEach((img, i) => {
      if (i === 0) { img.removeAttribute('loading'); img.setAttribute('fetchpriority', 'high'); }
      else if (!img.getAttribute('loading')) img.setAttribute('loading', 'lazy');
      if (!img.getAttribute('decoding')) img.setAttribute('decoding', 'async');
    });

    // 4) Na copia estatica nada abre: um botao nao pode anunciar estado aberto.
    document.querySelectorAll('#dc-root [aria-expanded="true"]').forEach((el) => {
      el.setAttribute('aria-expanded', 'false');
    });

    // 5) A tela de abertura e injetada por JavaScript e se remove sozinha;
    //    se sobrar alguma coisa dela, nao vai para o HTML publicado.
    document.querySelectorAll('[data-morenos-loader], #morenos-intro').forEach((el) => el.remove());

    const cabeca = [...document.head.children]
      .filter((el) => {
        if (el.tagName !== 'SCRIPT') return true;
        const src = el.getAttribute('src') || '';
        if (/\/support\.js|vendor\/react/.test(src)) return false;      // runtime
        if (!src && /__resources/.test(el.textContent || '')) return false; // shim
        return true;
      })
      .map((el) => el.outerHTML).join('\n');

    const raiz = document.getElementById('dc-root');
    return {
      cabeca,
      corpo: raiz ? raiz.innerHTML : '',
      titulo: document.title,
      h1: document.querySelectorAll('#dc-root h1').length,
      imagens: imgs.length,
      texto: (raiz ? raiz.innerText : '').trim().length,
      cru: /\{\{|\}\}/.test(raiz ? raiz.innerHTML : ''),
    };
  });

  await page.close();

  const problemas = [];
  if (!capturado.corpo) problemas.push('nao montou');
  if (capturado.texto < minTexto) problemas.push(`so ${capturado.texto} caracteres de texto`);
  if (capturado.h1 !== 1) problemas.push(`${capturado.h1} <h1> (esperado 1)`);
  if (capturado.cru) problemas.push('sobrou marcador {{ }} no HTML');
  if (erros.length) problemas.push('JS: ' + erros.slice(0, 2).join(' | '));

  const fonte = fs.readFileSync(path.join(PALCO, arquivo), 'utf8');
  const template = recorta(fonte, '<x-dc>', '</x-dc>', 'o bloco <x-dc>', arquivo);
  const logica = recorta(fonte, '<script type="text/x-dc"', '</script>', 'o script do componente', arquivo);
  const shim = recorta(fonte, '<script>\n/* O runtime busca React',
    '<script src="/support.js" defer></script>', 'o shim do runtime', arquivo);

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
${capturado.cabeca}
${TROCA}
</head>
<body>
<div id="mo-estatico">
${capturado.corpo}
</div>
${template}
${logica}
${shim}
${COLA}
</body>
</html>
`;

  const destino = path.join(SAIDA, saida);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, html);

  const kb = (fs.statSync(destino).size / 1024).toFixed(0);
  resumo.push({ saida, kb, texto: capturado.texto, imagens: capturado.imagens, problemas });
  if (problemas.length) falhou = true;
  console.log(`${problemas.length ? 'FALHA' : '  ok '}  ${saida.padEnd(46)} ${String(kb).padStart(4)} KB  ` +
    `${String(capturado.texto).padStart(6)} car.  ${String(capturado.imagens).padStart(3)} img` +
    (problemas.length ? `\n        ${problemas.join('; ')}` : ''));
}

await browser.close();
server.close();

console.log(`\n${resumo.length} rota(s), ${resumo.filter((r) => r.problemas.length).length} com problema`);
if (falhou) process.exit(1);
