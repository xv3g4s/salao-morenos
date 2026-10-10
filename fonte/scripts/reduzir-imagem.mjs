/**
 * Reduz uma imagem para a largura pedida, reencodando em WebP.
 *
 *   node fonte/scripts/reduzir-imagem.mjs <entrada> <saida> <largura> [qualidade]
 *
 * Usa o Chromium que o build ja tem (canvas + toDataURL): sem ImageMagick, sem
 * cwebp, sem dependencia nova. Pensado para o caso em que o arquivo original e
 * muito maior do que o espaco onde ele aparece — a logo da tela de abertura,
 * por exemplo, vem com 720px de largura e nunca passa de 200px na tela.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
// --mascara: a imagem so e usada como mascara CSS, entao o canal de cor nunca
// aparece. Pintando o RGB de branco, a parte com perdas do WebP fica quase sem
// informacao e so o alfa pesa: na logo da tela de abertura isso derruba 78%.
const mascara = args.includes('--mascara');
const [entrada, saida, larguraArg, qualidadeArg] = args.filter((a) => a !== '--mascara');
if (!entrada || !saida || !larguraArg) {
  console.error('uso: node fonte/scripts/reduzir-imagem.mjs <entrada> <saida> <largura> [qualidade]');
  process.exit(1);
}
const largura = Number(larguraArg);
const qualidade = Number(qualidadeArg || 0.86);

const bytes = fs.readFileSync(entrada);
const tipo = path.extname(entrada).toLowerCase() === '.png' ? 'image/png' : 'image/webp';
const dataUrl = `data:${tipo};base64,${bytes.toString('base64')}`;

const browser = await chromium.launch();
const page = await browser.newPage();
const resultado = await page.evaluate(async ({ dataUrl, largura, qualidade, mascara }) => {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const escala = Math.min(1, largura / img.naturalWidth);
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * escala);
  c.height = Math.round(img.naturalHeight * escala);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, c.width, c.height);
  if (mascara) {
    const d = ctx.getImageData(0, 0, c.width, c.height);
    for (let i = 0; i < d.data.length; i += 4) { d.data[i] = 255; d.data[i + 1] = 255; d.data[i + 2] = 255; }
    ctx.putImageData(d, 0, 0);
  }
  return { url: c.toDataURL('image/webp', qualidade), w: c.width, h: c.height,
           origW: img.naturalWidth, origH: img.naturalHeight };
}, { dataUrl, largura, qualidade, mascara });
await browser.close();

const novo = Buffer.from(resultado.url.split(',')[1], 'base64');
fs.mkdirSync(path.dirname(saida), { recursive: true });
fs.writeFileSync(saida, novo);

const kb = (n) => (n / 1024).toFixed(0) + ' KB';
console.log(`${path.basename(entrada)}  ${resultado.origW}x${resultado.origH} ${kb(bytes.length)}` +
  `  ->  ${resultado.w}x${resultado.h} ${kb(novo.length)}` +
  `  (-${Math.round((1 - novo.length / bytes.length) * 100)}%)` + (mascara ? '  [mascara]' : ''));
