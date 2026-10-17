import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
const RAIZ=path.resolve('public');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2','.xml':'application/xml','.txt':'text/plain'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);let f=path.join(RAIZ,p);if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');if(!fs.existsSync(f)){r.writeHead(404);return r.end('404');}const tipo=MIME[path.extname(f)]||'application/octet-stream';
  // o Apache da hospedagem comprime HTML/CSS/JS (mod_deflate). Sem isso aqui, a
  // medida castiga o HTML em ~6x e nao representa o que o visitante baixa.
  const comprime=/text\/|javascript|json|xml|svg/.test(tipo) && /gzip/.test(q.headers['accept-encoding']||'');
  const buf=fs.readFileSync(f);
  if(comprime){const g=zlib.gzipSync(buf);r.writeHead(200,{'Content-Type':tipo,'Content-Encoding':'gzip','Content-Length':g.length});r.end(g);}
  else {r.writeHead(200,{'Content-Type':tipo,'Content-Length':buf.length});r.end(buf);}});
await new Promise(r=>srv.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${srv.address().port}`;
const ROTAS=['/','/unidades/cidade-continental/','/servicos/corte-masculino/','/o-clube/'];
const b=await chromium.launch();
console.log('rota                                 LCP     peso    JS      img     reqs  loader');
for (const rota of ROTAS){
  const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,userAgent:'Mozilla/5.0 (Linux; Android 12; Pixel 5) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36'});
  const p=await ctx.newPage();
  const cdp=await ctx.newCDPSession(p);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1.6*1024*1024/8,uploadThroughput:750*1024/8});
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  let bytes=0,js=0,img=0,reqs=0;
  p.on('response',async r=>{ reqs++; try{ const b=(await r.body()).length; bytes+=b;
    const t=r.headers()['content-type']||''; if(t.includes('javascript'))js+=b; if(t.startsWith('image/'))img+=b; }catch{} });
  const t0=Date.now();
  await p.goto(base+rota,{waitUntil:'load',timeout:60000});
  await p.waitForFunction(()=>!document.querySelector('.site-loader'),null,{timeout:30000}).catch(()=>{});
  const semLoader=Date.now()-t0;
  await p.waitForTimeout(1500);
  const lcp=await p.evaluate(()=>new Promise(res=>{
    let v=0; try{ new PerformanceObserver(l=>{for(const e of l.getEntries()) v=e.startTime;}).observe({type:'largest-contentful-paint',buffered:true}); }catch{}
    setTimeout(()=>res(Math.round(v)),300);
  }));
  const hero=await p.evaluate(()=>{const i=document.querySelector('img[fetchpriority="high"]');return i?i.currentSrc.split('/').pop():'-';});
  console.log(`${rota.padEnd(36)} ${String(lcp).padStart(5)}ms ${String(Math.round(bytes/1024)).padStart(5)}K ${String(Math.round(js/1024)).padStart(5)}K ${String(Math.round(img/1024)).padStart(5)}K ${String(reqs).padStart(5)} ${String(semLoader).padStart(5)}ms  ${hero}`);
  await ctx.close();
}
await b.close(); srv.close();
