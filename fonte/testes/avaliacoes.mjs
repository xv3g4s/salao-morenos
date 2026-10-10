/**
 * Testes da integracao de avaliacoes do Google.
 *
 *   node fonte/testes/avaliacoes.mjs
 *
 * Duas metades:
 *
 * A) O endpoint PHP, rodado de verdade com `php -S`, com a Places API
 *    simulada: sem chave, sem Place ID, uma unidade com erro, todas com erro.
 *    (A chamada real ao Google nao entra em teste: depende de chave, de
 *    faturamento e da rede.)
 *
 * B) O componente no navegador, com /api/google-reviews servido por uma
 *    fixture que cobre os casos chatos: review sem texto, sem foto, sem link
 *    de autor, texto longo, review traduzido, nota decimal, unidade
 *    indisponivel. Confere o que a tela precisa mostrar, o teclado, o
 *    aria-label das estrelas, a atribuicao do Google Maps, o filtro por
 *    unidade — e, principalmente, que o navegador NAO fala com
 *    places.googleapis.com e que a chave nao aparece em lugar nenhum.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PUB = path.join(RAIZ, 'public');
const CHAVE_FALSA = 'AIzaSyFAKE-chave-de-teste-nunca-real';

// A integracao nasce desligada: por padrao a secao de depoimentos fica como o
// design a desenhou. Estes testes so fazem sentido num build que a ligou.
if (!fs.existsSync(path.join(PUB, 'avaliacoes-google.js'))) {
  console.log('\nPULADO: a integracao de avaliacoes do Google nao esta neste build.');
  console.log('Para testar:  python3 fonte/build.py --avaliacoes-google && node fonte/testes/avaliacoes.mjs\n');
  process.exit(0);
}

const ok = [], falhas = [];
const checa = (cond, msg) => (cond ? ok : falhas).push(msg);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// ============================================================ A) endpoint ===
async function comServidorPhp(env, fn) {
  const porta = 9000 + Math.floor(Math.random() * 500);
  const php = spawn('php', ['-S', `127.0.0.1:${porta}`, '-t', PUB], {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  const erros = [];
  php.stderr.on('data', (d) => erros.push(String(d)));
  await espera(900);
  try {
    return await fn(`http://127.0.0.1:${porta}`, erros);
  } finally {
    php.kill();
  }
}

const pegar = async (url) => {
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  let corpo = null;
  try { corpo = await r.json(); } catch (e) { /* resposta nao-JSON */ }
  return { status: r.status, corpo, cabecalhos: r.headers };
};

// 1) sem chave configurada
await comServidorPhp({ GOOGLE_MAPS_API_KEY: '', MORENOS_ENV_FILE: '/tmp/morenos-env-que-nao-existe.php' }, async (base, erros) => {
  const r = await pegar(base + '/api/google-reviews.php');
  checa(r.status === 500, `sem chave: HTTP 500 (veio ${r.status})`);
  checa(r.corpo && r.corpo.error === 'not_configured', 'sem chave: erro "not_configured"');
  checa(!JSON.stringify(r.corpo).includes('GOOGLE_MAPS_API_KEY'),
    'sem chave: a resposta nao diz o nome da variavel ao visitante');
  await espera(200);
  checa(erros.join('').includes('GOOGLE_MAPS_API_KEY ausente'),
    'sem chave: o motivo aparece no log do servidor');
});

// 2) chave presente, Place IDs ausentes (a rede ao Google nem e tentada)
await comServidorPhp({
  GOOGLE_MAPS_API_KEY: CHAVE_FALSA, MORENOS_ENV_FILE: '/tmp/morenos-env-que-nao-existe.php',
  GOOGLE_PLACE_ID_CIDADE_CONTINENTAL: '',
  GOOGLE_PLACE_ID_NOVO_HORIZONTE_AV_BRASIL: '',
  GOOGLE_PLACE_ID_NOVO_HORIZONTE_AV_INDUSTRIAL: '',
}, async (base, erros) => {
  const r = await pegar(base + '/api/google-reviews.php');
  checa(r.status === 503, `sem Place ID: HTTP 503 (veio ${r.status})`);
  checa(r.corpo && r.corpo.error === 'unavailable', 'sem Place ID: erro "unavailable"');
  checa(!JSON.stringify(r.corpo).includes(CHAVE_FALSA), 'sem Place ID: a chave nao vaza na resposta');
  await espera(200);
  const log = erros.join('');
  checa(log.includes('Place ID nao configurado para Cidade Continental'),
    'sem Place ID: o log do servidor nomeia a unidade');
  checa(!log.includes(CHAVE_FALSA), 'sem Place ID: a chave nao vaza no log');
});

// 3) um Place ID configurado e dois ausentes: a rota nao pode quebrar por isso
await comServidorPhp({
  GOOGLE_MAPS_API_KEY: CHAVE_FALSA, MORENOS_ENV_FILE: '/tmp/morenos-env-que-nao-existe.php',
  GOOGLE_PLACE_ID_CIDADE_CONTINENTAL: 'ChIJ-id-inexistente-para-teste',
  GOOGLE_PLACE_ID_NOVO_HORIZONTE_AV_BRASIL: '',
  GOOGLE_PLACE_ID_NOVO_HORIZONTE_AV_INDUSTRIAL: '',
}, async (base) => {
  const r = await pegar(base + '/api/google-reviews.php');
  // Sem acesso ao Google neste ambiente, a unidade falha e a resposta e 503.
  // O que importa e que a rota responde JSON, com status previsto, sem vazar.
  checa([200, 503].includes(r.status), `unidade com erro: status previsto (veio ${r.status})`);
  checa(r.corpo !== null, 'unidade com erro: resposta continua sendo JSON');
  checa(!JSON.stringify(r.corpo).includes(CHAVE_FALSA), 'unidade com erro: a chave nao vaza');
  checa(!JSON.stringify(r.corpo).toLowerCase().includes('stack'),
    'unidade com erro: sem stack trace na resposta');
});

// 3-bis) arquivo de ambiente quebrado: degrada, nao derruba
await comServidorPhp({
  GOOGLE_MAPS_API_KEY: '', MORENOS_ENV_FILE: '/dev/null',
}, async (base) => {
  const r = await pegar(base + '/api/google-reviews.php');
  checa(r.status === 500 && r.corpo && r.corpo.error === 'not_configured',
    `env quebrado: degrada para "not_configured" (veio ${r.status})`);
  checa(r.corpo !== null, 'env quebrado: resposta continua JSON, sem fatal do PHP');
});

// 4) metodo errado
await comServidorPhp({ GOOGLE_MAPS_API_KEY: CHAVE_FALSA }, async (base) => {
  const r = await fetch(base + '/api/google-reviews.php', { method: 'POST' });
  checa(r.status === 405, `POST: HTTP 405 (veio ${r.status})`);
});

// 5) config.php nunca responde sozinho
await comServidorPhp({ GOOGLE_MAPS_API_KEY: CHAVE_FALSA }, async (base) => {
  const r = await fetch(base + '/api/config.php');
  checa(r.status === 404, `config.php direto: HTTP 404 (veio ${r.status})`);
  const t = await r.text();
  checa(!t.includes('MORENOS_UNIDADES'), 'config.php direto: nao devolve o conteudo');
});

// ========================================================== B) componente ===
const FIXTURE = {
  attribution: 'Google Maps',
  generatedAt: new Date().toISOString(),
  units: [
    {
      id: 'cidade-continental', name: 'Cidade Continental',
      displayName: 'Salão Morenos — Cidade Continental',
      placeId: 'ChIJ-cc', rating: 4.8, userRatingCount: 125,
      placeUrl: 'https://maps.google.com/?cid=1',
      reviewsUrl: 'https://maps.google.com/?cid=1&reviews=1',
      writeReviewUrl: 'https://maps.google.com/?cid=1&write=1',
      available: true,
      reviews: [
        {
          id: 'places/cc/reviews/1', unitId: 'cidade-continental', unitName: 'Cidade Continental',
          placeId: 'ChIJ-cc', authorName: 'Luander Anacleto',
          authorProfileUrl: 'https://www.google.com/maps/contrib/1',
          authorPhotoUrl: 'https://lh3.googleusercontent.com/a/foto-que-nao-carrega',
          rating: 5, text: 'Já sou cliente há mais de um ano e meio. '.repeat(14),
          textLanguage: 'pt', originalText: null, originalLanguage: null,
          relativePublishTime: 'há 2 meses', publishTime: '2026-08-01T12:00:00Z',
          googleMapsUrl: 'https://maps.google.com/?cid=1&review=1',
          flagContentUrl: 'https://maps.google.com/flag?review=1',
        },
        {
          id: 'places/cc/reviews/2', unitId: 'cidade-continental', unitName: 'Cidade Continental',
          placeId: 'ChIJ-cc', authorName: 'Tiago Jesus',
          authorProfileUrl: null, authorPhotoUrl: null,
          rating: 4, text: 'Great barber, very professional.',
          textLanguage: 'pt', originalText: 'Great barber, very professional.',
          originalLanguage: 'en', relativePublishTime: 'há uma semana',
          publishTime: '2026-10-01T12:00:00Z',
          googleMapsUrl: 'https://maps.google.com/?cid=1&review=2', flagContentUrl: null,
        },
      ],
    },
    {
      id: 'novo-horizonte-av-brasil', name: 'Novo Horizonte — Av. Brasil',
      displayName: 'Salão Morenos — Novo Horizonte, Avenida Brasil',
      placeId: 'ChIJ-nb', rating: 4.5, userRatingCount: 42,
      placeUrl: 'https://maps.google.com/?cid=2', reviewsUrl: null,
      writeReviewUrl: 'https://maps.google.com/?cid=2&write=1', available: true,
      reviews: [
        {
          id: 'places/nb/reviews/1', unitId: 'novo-horizonte-av-brasil',
          unitName: 'Novo Horizonte — Av. Brasil', placeId: 'ChIJ-nb',
          authorName: 'Guilherme D. de Souza', authorProfileUrl: null, authorPhotoUrl: null,
          rating: 5, text: 'Brabeza, só mano mil grau no corte.',
          textLanguage: 'pt', originalText: null, originalLanguage: null,
          relativePublishTime: 'há 3 semanas', publishTime: '2026-09-18T12:00:00Z',
          googleMapsUrl: 'https://maps.google.com/?cid=2&review=1', flagContentUrl: null,
        },
      ],
    },
    {
      // unidade indisponivel: nao configurada ou com erro no servidor
      id: 'novo-horizonte-av-industrial', name: 'Novo Horizonte — Av. Industrial',
      displayName: 'Salão Morenos — Novo Horizonte, Avenida Industrial',
      placeId: null, rating: null, userRatingCount: null, placeUrl: null,
      reviewsUrl: null, writeReviewUrl: null, reviews: [], available: false,
    },
  ],
};

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2',
  '.xml': 'application/xml', '.txt': 'text/plain',
};

let modoApi = 'ok';   // ok | erro
const srv = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/api/google-reviews') {
    if (modoApi === 'erro') {
      res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify({ error: 'unavailable' }));
    }
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(FIXTURE));
  }
  let f = path.join(PUB, decodeURIComponent(url));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!f.startsWith(PUB) || !fs.existsSync(f)) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${srv.address().port}`;

const browser = await chromium.launch();

async function abrirHome(perfil = { viewport: { width: 1280, height: 900 } }) {
  const ctx = await browser.newContext(perfil);
  const page = await ctx.newPage();
  const pedidos = [];
  page.on('request', (r) => pedidos.push(r.url()));
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.waitForSelector('html.mo-vivo', { timeout: 25000 }).catch(() => {});
  // a secao fica longe da dobra: rola ate ela para disparar o IntersectionObserver
  await page.evaluate(() => {
    const h2 = [...document.querySelectorAll('h2')]
      .find((h) => (h.textContent || '').trim() === 'Quem senta na cadeira, conta.');
    if (h2) h2.scrollIntoView();
  });
  await page.waitForTimeout(2500);
  return { ctx, page, pedidos };
}

{
  const { ctx, page, pedidos } = await abrirHome();
  const bloco = page.locator('[data-avaliacoes-google]');
  checa(await bloco.count() > 0, 'componente: o bloco das avaliacoes assume a secao');

  const cards = page.locator('[data-avaliacoes-google] blockquote');
  const n = await cards.count();
  checa(n === 3, `componente: 3 avaliacoes com texto renderizadas (veio ${n})`);

  checa(await page.getByText('Luander Anacleto').count() > 0, 'componente: nome do autor aparece');
  checa(await page.getByRole('link', { name: 'Luander Anacleto' }).count() > 0,
    'componente: autor com perfil vira link');
  checa(await page.getByRole('img', { name: /Avaliação de 5 de 5 estrelas/ }).count() > 0,
    'componente: estrelas com rotulo acessivel');
  checa(await page.getByRole('link', { name: 'Ver no Google Maps' }).count() === 3,
    'componente: cada avaliacao tem link para o Google Maps');
  checa(await page.getByText('há 2 meses').count() > 0, 'componente: tempo relativo aparece');
  checa(await page.getByText('Cidade Continental', { exact: false }).count() > 0,
    'componente: unidade identificada no card');
  checa(await page.getByText('125 avaliações no Google').count() > 0,
    'componente: quantidade de avaliacoes da unidade');
  checa(await page.getByText('4,8').count() > 0, 'componente: nota decimal em formato pt-BR');
  checa(await page.getByRole('link', { name: 'Avaliar esta unidade' }).count() > 0,
    'componente: link para escrever avaliacao');
  checa(await page.getByRole('link', { name: 'Reportar avaliação no Google' }).count() > 0,
    'componente: link de reportar quando o Google oferece');

  // atribuicao visivel, sem translate
  const atrib = page.locator('[data-avaliacoes-google] [translate="no"]');
  checa(await atrib.count() > 0 && (await atrib.first().textContent()).trim() === 'Google Maps',
    'componente: atribuicao "Google Maps" presente e nao traduzivel');
  checa(await atrib.first().isVisible(), 'componente: a atribuicao esta visivel');

  // nenhuma nota global inventada
  const texto = await bloco.first().innerText();
  checa(!/m[eé]dia geral|nota geral/i.test(texto), 'componente: nao inventa nota geral das unidades');
  checa(!/[úu]ltimas avalia/i.test(texto), 'componente: nao promete ordem cronologica');
  checa(/relevância/i.test(texto), 'componente: avisa que a ordem e por relevancia');

  // texto longo: "Ler mais" com teclado
  const lerMais = page.getByRole('button', { name: 'Ler mais' }).first();
  checa(await lerMais.count() > 0, 'componente: texto longo ganha "Ler mais"');
  await lerMais.focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  checa(await page.getByRole('button', { name: 'Mostrar menos' }).count() > 0,
    'componente: "Ler mais" funciona pelo teclado');

  // traducao
  checa(await page.getByText('Traduzido pelo Google').count() > 0,
    'componente: marca o que o Google traduziu');
  const verOriginal = page.getByRole('button', { name: 'Ver original' }).first();
  checa(await verOriginal.count() > 0, 'componente: oferece "Ver original"');

  // avaliacao sem foto cai no avatar de iniciais, sem foto inventada
  const fotos = await page.locator('[data-avaliacoes-google] img').count();
  checa(fotos <= 1, `componente: so usa foto quando o Google manda (${fotos} imagem)`);

  // filtro por unidade
  const chip = page.getByRole('tab', { name: 'Novo Horizonte — Av. Brasil' });
  checa(await chip.count() > 0, 'componente: filtro por unidade com as duas de Novo Horizonte separadas');
  await chip.click();
  await page.waitForTimeout(400);
  const depois = await page.locator('[data-avaliacoes-google] blockquote').count();
  checa(depois === 1, `filtro: mostra so a unidade escolhida (${depois} card)`);
  checa(await page.getByText('Luander Anacleto').count() === 0, 'filtro: esconde as outras unidades');
  checa(await page.locator('#av-anuncio').count() > 0, 'filtro: tem regiao aria-live para leitor de tela');

  // a unidade indisponivel nao vira filtro nem card vazio
  checa(await page.getByRole('tab', { name: 'Novo Horizonte — Av. Industrial' }).count() === 0,
    'componente: unidade indisponivel nao aparece como filtro');

  // seguranca
  const chamouGoogle = pedidos.some((u) => u.includes('places.googleapis.com'));
  checa(!chamouGoogle, 'seguranca: o navegador nao chama places.googleapis.com');
  checa(pedidos.some((u) => u.includes('/api/google-reviews')),
    'seguranca: o navegador chama so a rota interna');
  const html = await page.content();
  checa(!/AIza[0-9A-Za-z_-]{10}/.test(html), 'seguranca: nenhuma chave no HTML da pagina');

  await ctx.close();
}

// estado de erro
{
  modoApi = 'erro';
  const { ctx, page } = await abrirHome();
  const texto = await page.locator('[data-avaliacoes-google]').first().innerText();
  checa(/No momento não foi possível carregar as avaliações\./.test(texto),
    'erro: mensagem simples ao visitante');
  checa(!/50\d|http|fetch|stack/i.test(texto), 'erro: sem detalhe tecnico na tela');
  checa(await page.getByRole('link', { name: 'Ver avaliações no Google Maps' }).count() > 0,
    'erro: oferece o caminho para o Google Maps');
  checa(await page.locator('[data-avaliacoes-google] blockquote').count() === 0,
    'erro: nenhum card vazio ou inventado');
  await ctx.close();
  modoApi = 'ok';
}

// a chave nunca esta nos arquivos publicados
{
  const suspeitos = [];
  const varrer = (dir) => {
    for (const nome of fs.readdirSync(dir)) {
      const f = path.join(dir, nome);
      const st = fs.statSync(f);
      if (st.isDirectory()) { varrer(f); continue; }
      if (!/\.(html|js|json|css|txt|xml)$/.test(nome)) continue;
      const t = fs.readFileSync(f, 'utf8');
      if (/AIza[0-9A-Za-z_-]{20}/.test(t)) suspeitos.push(f);
    }
  };
  varrer(PUB);
  checa(suspeitos.length === 0,
    suspeitos.length ? `seguranca: CHAVE EM ARQUIVO PUBLICADO -> ${suspeitos[0]}`
                     : 'seguranca: nenhuma chave nos arquivos publicados');
}

await browser.close();
srv.close();

ok.forEach((m) => console.log('  ok   ' + m));
falhas.forEach((m) => console.log('  FALHA ' + m));
console.log(`\n${ok.length} ok, ${falhas.length} falha(s)`);
process.exit(falhas.length ? 1 : 0);
