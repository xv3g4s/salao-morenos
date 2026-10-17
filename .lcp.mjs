import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
const RAIZ=path.resolve('public');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);let f=path.join(RAIZ,p);if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');if(!fs.existsSync(f)){r.writeHead(404);return r.end('404');}const tipo=MIME[path.extname(f)]||'application/octet-stream';
  // o Apache da hospedagem comprime HTML/CSS/JS (mod_deflate). Sem isso aqui, a
  // medida castiga o HTML em ~6x e nao representa o que o visitante baixa.
  const comprime=/text\/|javascript|json|xml|svg/.test(tipo) && /gzip/.test(q.headers['accept-encoding']||'');
  const buf=fs.readFileSync(f);
  if(comprime){const g=zlib.gzipSync(buf);r.writeHead(200,{'Content-Type':tipo,'Content-Encoding':'gzip','Content-Length':g.length});r.end(g);}
  else {r.writeHead(200,{'Content-Type':tipo,'Content-Length':buf.length});r.end(buf);}});
await new Promise(r=>srv.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${srv.address().port}`;
const b=await chromium.launch();
for (const rota of ['/','/unidades/cidade-continental/']) {
  const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
  const p=await ctx.newPage();
  const cdp=await ctx.newCDPSession(p);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1.6*1024*1024/8,uploadThroughput:750*1024/8});
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await p.addInitScript(()=>{ window.__lcp=[]; try{ new PerformanceObserver(l=>{for(const e of l.getEntries()) window.__lcp.push({t:Math.round(e.startTime), el:(e.element&&(e.element.tagName+'.'+(e.element.className||'').toString().slice(0,18)))||'?', url:(e.url||'').split('/').pop()});}).observe({type:'largest-contentful-paint',buffered:true}); }catch{} });
  await p.goto(base+rota,{waitUntil:'load',timeout:60000});
  await p.waitForTimeout(6000);
  console.log(rota, JSON.stringify(await p.evaluate(()=>window.__lcp)));
  await ctx.close();
}
await b.close(); srv.close();
