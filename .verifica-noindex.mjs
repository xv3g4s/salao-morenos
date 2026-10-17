import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const RAIZ=path.resolve('public');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2','.xml':'application/xml','.txt':'text/plain'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);let f=path.join(RAIZ,p);if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');if(!fs.existsSync(f)){r.writeHead(404);return r.end('404');}r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);});
await new Promise(r=>srv.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${srv.address().port}`;
const b=await chromium.launch();
const p=await (await b.newContext({viewport:{width:1280,height:900}})).newPage();
for (const rota of ['/','/unidades/cidade-continental/','/o-clube/']) {
  await p.goto(base+rota,{waitUntil:'load'});
  await p.waitForFunction(()=>document.documentElement.classList.contains('mo-vivo')&&!document.getElementById('mo-estatico'),null,{timeout:15000});
  await p.waitForTimeout(200);
  console.log(rota, await p.evaluate(()=>({
    robots:[...document.querySelectorAll('meta[name="robots"]')].map(m=>m.content),
    canonical:[...document.querySelectorAll('link[rel="canonical"]')].map(l=>l.href),
    titulos:document.querySelectorAll('title').length,
  })));
}
await b.close(); srv.close();
