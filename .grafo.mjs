import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const RAIZ=path.resolve('public');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);let f=path.join(RAIZ,p);if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');if(!fs.existsSync(f)){r.writeHead(404);return r.end('404');}r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);});
await new Promise(r=>srv.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${srv.address().port}`;
const ROTAS=['/','/unidades/','/unidades/cidade-continental/','/unidades/novo-horizonte-av-brasil/','/unidades/novo-horizonte-av-industrial/','/servicos/','/servicos/corte-masculino/','/servicos/barboterapia/','/visagismo/','/dia-do-noivo/','/o-clube/','/cultura/','/corporativo/','/trabalhe-conosco/'];
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:1280,height:900}});
const p=await ctx.newPage();
const grafo={};
for (const rota of ROTAS){
  await p.goto(base+rota,{waitUntil:'load'});
  await p.waitForFunction(()=>document.documentElement.classList.contains('mo-vivo')&&!document.getElementById('mo-estatico'),null,{timeout:15000});
  await p.waitForTimeout(150);
  grafo[rota]=await p.evaluate(()=>{
    const main=document.querySelector('main');
    const dentro=(el)=>main&&main.contains(el);
    return [...document.querySelectorAll('a[href]')].map(a=>({
      href:new URL(a.getAttribute('href'),location.href).pathname,
      txt:(a.textContent||'').trim().replace(/\s+/g,' ').slice(0,42),
      corpo:dentro(a),
    })).filter(l=>l.href.startsWith('/')&&!l.href.includes('.html'));
  });
}
await b.close(); srv.close();
const resumo={};
for (const [r,ls] of Object.entries(grafo)) resumo[r]=[...new Set(ls.filter(l=>l.corpo).map(l=>l.href))].filter(h=>h!==r);
console.log(JSON.stringify(resumo,null,1));
console.log('\n--- quem linka para cada rota (so corpo):');
for (const alvo of ROTAS){
  const quem=Object.entries(resumo).filter(([,hs])=>hs.includes(alvo)).map(([r])=>r);
  console.log(`${alvo.padEnd(42)} <- ${quem.length} ${quem.join(' ')}`);
}
