/**
 * Imprime, em JSON, os dados do site-config.js.
 *
 *   node fonte/scripts/dump-config.mjs
 *
 * O site-config.js e a fonte unica dos dados do site (unidades, servicos,
 * planos, contato). O build precisa deles em Python para montar os dados
 * estruturados (JSON-LD) das paginas — e reescrever a mesma lista de unidades
 * num segundo lugar seria garantir que os dois vao divergir.
 *
 * O arquivo e escrito para o navegador: roda como IIFE e termina em
 * `window.MORENOS = C`. Aqui ele e executado com um window de mentira, o
 * minimo que ele toca. Nada de rede, nada de DOM.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const js = fs.readFileSync(path.join(RAIZ, 'fonte/prototipo/site-config.js'), 'utf8');

const janela = {
  // o stage e fixado pelo build; aqui so precisa nao quebrar
  location: { hostname: 'salaomorenos.com.br', href: 'https://salaomorenos.com.br/' },
  localStorage: { getItem: () => null, setItem: () => {} },
  sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  document: { createElement: () => ({ setAttribute() {} }), head: { appendChild() {} } },
  dataLayer: null,
};
janela.window = janela;

vm.createContext(janela);
vm.runInContext(js, janela, { filename: 'site-config.js' });

const C = janela.MORENOS || (janela.window && janela.window.MORENOS);
if (!C) {
  console.error('erro: o site-config.js nao definiu window.MORENOS');
  process.exit(1);
}

// funcoes nao atravessam JSON: so os dados interessam ao build
console.log(JSON.stringify(C, (k, v) => (typeof v === 'function' ? undefined : v), 1));
