/* Salão Morenos — tela de abertura (primeira visita da sessão).
   Injetada só por JavaScript: sem JS, o site aparece normalmente.
   Configuração: window.MORENOS.loader (site-config.js).
   z-index 2147483000: acima de header (60), modais (90/95) e qualquer widget. */
(function () {
  if (window.__morenosLoader) return; window.__morenosLoader = true;
  var M = window.MORENOS || {};
  var C = M.loader || { showOncePerSession: true, minimumVisibleTime: 1200, maximumVisibleTime: 4500, exitDuration: 560,
    sessionKey: 'morenos_intro_seen', logo: 'assets/morenos-loader-outline-white.webp', logoW: 720, logoH: 673 };
  var html = document.documentElement;

  function lerVisto() { try { return sessionStorage.getItem(C.sessionKey); } catch (e) { return null; } }
  function marcarVisto() { try { sessionStorage.setItem(C.sessionKey, '1'); } catch (e) {} }
  try { if (/[?&]intro\b/.test(location.search)) sessionStorage.removeItem(C.sessionKey); } catch (e) {}

  var reduz = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // MODO CURTO (aplicado no build, ver fonte/build.py).
  // Primeira carga da sessão: intro completa. Da segunda em diante — navegação
  // interna, voltar, abrir outra página do site — a MESMA tela aparece, só que
  // a logo entra na hora e a tela sai assim que a página fica pronta, sem
  // espera mínima. Mantém a marca em toda navegação sem cobrar 1,2s por clique.
  var curto = !!lerVisto();
  if (curto) {
    C = {
      showOncePerSession: C.showOncePerSession, sessionKey: C.sessionKey,
      logo: C.logo, logoW: C.logoW, logoH: C.logoH,
      minimumVisibleTime: 0,      // sem espera artificial: sai quando ficar pronta
      maximumVisibleTime: 6000,   // rede de segurança, não alvo
      exitDuration: 260,
    };
  }

  var mask = 'url("' + C.logo + '") center/contain no-repeat';
  var css = [
    ':root{--loader-bg:radial-gradient(120% 90% at 50% 45%,#111211 0%,#0A0B0A 55%,#060706 100%);--loader-logo-size:clamp(140px,12vw,200px);--loader-exit-duration:' + C.exitDuration + 'ms}',
    '@media (max-width:599px){:root{--loader-logo-size:clamp(120px,38vw,160px)}}',
    'html.is-loading,html.is-loading body{overscroll-behavior:none}',
    'html,body{background:#080908}',
    '.site-loader{position:fixed;inset:0;z-index:2147483000;width:100vw;height:100vh;height:100dvh;display:flex;align-items:center;justify-content:center;background:#080908;background:var(--loader-bg);padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);pointer-events:none;opacity:1;transition:opacity var(--loader-exit-duration) cubic-bezier(.4,0,.2,1) .1s;will-change:opacity;contain:strict;transform:translateZ(0)}',
    '.site-loader__ambient{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,.45) 100%)}',
    '.site-loader__logo-wrap{position:relative;width:var(--loader-logo-size);max-width:calc(100vw - 48px);aspect-ratio:' + C.logoW + '/' + C.logoH + ';will-change:transform,opacity;backface-visibility:hidden;animation:' + (curto ? 'slLogoIn .42s cubic-bezier(.22,.61,.36,1) both' : 'slLogoIn .95s cubic-bezier(.22,.61,.36,1) both,slGrow 3.2s cubic-bezier(.33,0,.2,1) .95s forwards') + '}',
    '.site-loader__layer{position:absolute;inset:0;-webkit-mask:' + mask + ';mask:' + mask + '}',
    '.site-loader__base{background:rgba(246,244,239,.24)}',
    '.site-loader__shine{background:linear-gradient(45deg,transparent 36%,#FFFFFF 46%,#B79A6A 54%,transparent 64%);background-size:300% 300%;animation:slShine 2.2s linear ' + (curto ? '0s' : '.35s') + ' infinite}',
    '.site-loader__fill{background:#FFFFFF;opacity:0;transition:opacity .45s ease}',
    '.site-loader--ready .site-loader__fill{opacity:1}',
    '.site-loader--ready .site-loader__shine{animation-play-state:paused;opacity:0;transition:opacity .3s ease}',
    '.site-loader__sr-text{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}',
    '.site-loader--exiting{opacity:0}',
    '.site-loader--exiting .site-loader__logo-wrap{animation:slLogoOut .42s cubic-bezier(.55,0,.25,1) forwards}',
    '@keyframes slShine{0%{background-position:100% 0%}100%{background-position:0% 100%}}',
    '@keyframes slLogoIn{0%{opacity:0;transform:scale(.86) translateY(14px);filter:blur(6px)}100%{opacity:1;transform:scale(1) translateY(0);filter:blur(0)}}',
    '@keyframes slGrow{from{transform:scale(1)}to{transform:scale(1.08)}}',
    '@keyframes slLogoOut{0%{opacity:1;transform:scale(var(--sl-escala,1.08))}100%{opacity:0;transform:scale(.82)}}',
    
    '@media (prefers-reduced-motion:reduce){.site-loader__logo-wrap,.site-loader__shine,.site-loader__ambient{animation:none!important}.site-loader__shine{display:none}.site-loader__base{background:#FFFFFF}.site-loader{transition:opacity .25s ease}}',
  ].join('\n');
  var st = document.createElement('style'); st.id = 'site-loader-css'; st.textContent = css;
  document.head.appendChild(st);

  var el = document.createElement('div');
  el.className = 'site-loader';
  el.setAttribute('role', 'status');
  el.innerHTML = '<div class="site-loader__ambient"></div>' +
    '<div class="site-loader__logo-wrap"><div class="site-loader__layer site-loader__base"></div><div class="site-loader__layer site-loader__shine"></div><div class="site-loader__layer site-loader__fill"></div></div>' +
    '<span class="site-loader__sr-text">Carregando o site do Salão Morenos</span>';
  (document.body || html).appendChild(el);

  // trava a rolagem sem pular a página (compensa a largura da barra)
  html.classList.add('is-loading');
  var trava = function (e) { if (html.classList.contains('is-loading')) e.preventDefault(); };
  var travaTecla = function (e) { if (html.classList.contains('is-loading') && [' ', 'PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'Home', 'End'].indexOf(e.key) > -1) e.preventDefault(); };
  window.addEventListener('wheel', trava, { passive: false, capture: true });
  window.addEventListener('touchmove', trava, { passive: false, capture: true });
  window.addEventListener('keydown', travaTecla, { capture: true });

  function main() { return document.getElementById('conteudo') || document.querySelector('main'); }
  function setBusy(v) { var m = main(); if (m) m.setAttribute('aria-busy', v); }
  setBusy('true');

  var t0 = performance.now();
  var espera = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var domPronto = document.readyState !== 'loading' ? Promise.resolve() : new Promise(function (r) { document.addEventListener('DOMContentLoaded', r, { once: true }); });
  // a máscara usa o mesmo arquivo: pré-carrega para a logo aparecer inteira
  var logo = new Image(); logo.decoding = 'async'; logo.src = C.logo;
  var logoPronta = new Promise(function (r) { if (logo.complete) return r(); logo.onload = logo.onerror = r; });
  var fontes = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  // imagem principal do hero: o componente pode montar depois deste script
  var carregou = document.readyState === 'complete' ? Promise.resolve() : new Promise(function (r) { window.addEventListener('load', r, { once: true }); });
  var hero = new Promise(function (resolve) {
    var tentativas = 0;
    (function procura() {
      var img = document.querySelector('main img[fetchpriority="high"]');
      if (img) {
        if (img.complete && img.naturalWidth) return resolve(img.decode ? img.decode().catch(function () {}) : null);
        img.addEventListener('load', function () { resolve(img.decode ? img.decode().catch(function () {}) : null); }, { once: true });
        img.addEventListener('error', resolve, { once: true });
        return;
      }
      if (++tentativas > 40) return resolve();
      setTimeout(procura, 50);
    })();
  });
  // A tela só sai com a PÁGINA PRONTA (ajuste do build). Três sinais além do
  // que o protótipo já esperava:
  //
  //   carregou  window.load — folhas de estilo, scripts e as imagens que a
  //             página realmente busca. Imagem lazy, fora da dobra, não entra
  //             (o navegador só a busca na rolagem), então isto não vira espera
  //             eterna.
  //   montado   a troca das duas camadas. A página publicada nasce como cópia
  //             estática e o runtime do Claude Design monta a versão viva por
  //             cima; `html.mo-vivo` é o sinal de que a troca aconteceu. Sem
  //             esperar por ele, o visitante via a troca depois da tela sumir.
  //
  // Os dois têm rede de segurança própria, e o teto de tempo (maximumVisibleTime)
  // continua valendo: a tela nunca prende o site.
  var montado = new Promise(function (r) {
    var raiz = document.documentElement;
    if (raiz.classList.contains('mo-vivo')) return r();
    var obs = new MutationObserver(function () {
      if (raiz.classList.contains('mo-vivo')) { obs.disconnect(); r(); }
    });
    obs.observe(raiz, { attributes: true, attributeFilter: ['class'] });
    // sem runtime (JS bloqueado, erro de rede) a cópia estática é a página:
    // não faz sentido segurar a tela esperando uma troca que não vem
    setTimeout(function () { obs.disconnect(); r(); }, 6000);
  });
  var sinais = [domPronto, logoPronta, fontes, hero, carregou, montado];
  var tudo = Promise.allSettled ? Promise.allSettled(sinais)
    : Promise.all(sinais.map(function (p) { return Promise.resolve(p).catch(function () {}); }));
  var minimo = reduz ? 0 : C.minimumVisibleTime;

  var saiu = false;
  function sair() {
    if (saiu) return; saiu = true;
    marcarVisto();
    var dur = reduz ? 250 : C.exitDuration;
    var pausa = reduz ? 0 : (curto ? 120 : 380);   // modo curto quase nao pausa
    el.classList.add('site-loader--ready');
    setTimeout(function () {
      var w = el.querySelector('.site-loader__logo-wrap');
      if (w && !reduz) { var m = getComputedStyle(w).transform; var k = 1; if (m && m !== 'none') { var v = m.match(/matrix\(([^,]+),([^,]+)/); if (v) k = Math.hypot(parseFloat(v[1]), parseFloat(v[2])); } w.style.setProperty('--sl-escala', k.toFixed(4)); }
      requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('site-loader--exiting'); entradaHero(); }); });
    }, pausa);
    setTimeout(function () {
      // o <style> fica: removê-lo forçaria recálculo de estilo da página inteira
      el.remove();
      html.classList.remove('is-loading');
      window.removeEventListener('wheel', trava, { capture: true });
      window.removeEventListener('touchmove', trava, { capture: true });
      window.removeEventListener('keydown', travaTecla, { capture: true });
      setBusy('false');
      window.dispatchEvent(new CustomEvent('morenos:intro-end'));
    }, dur + 140 + pausa);
  }
  function entradaHero() {
    if (reduz) return;
    var sec = document.querySelector('main section');
    if (!sec || !sec.animate) return;
    var img = sec.querySelector('img');
    var txt = sec.querySelector('h1');
    var bloco = txt && txt.parentElement;
    if (bloco) bloco.animate([{ transform: 'translateY(8px)' }, { transform: 'translateY(0)' }], { duration: 500, easing: 'cubic-bezier(.22,1,.36,1)' });
  }

  Promise.race([tudo.then(function () { var resto = minimo - (performance.now() - t0); return resto > 0 ? espera(resto) : null; }), espera(C.maximumVisibleTime)])
    .then(sair, sair);
  // rede de segurança extra: nunca prender a tela
  setTimeout(sair, C.maximumVisibleTime + 800);
})();
