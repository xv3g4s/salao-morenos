/* Salão Morenos — rolagem suave com inércia (estilo Lenis), sem dependências.
   Liga só com mouse/trackpad em desktop e desliga com prefers-reduced-motion.
   Toque, teclado e barra de rolagem continuam nativos. */
(function () {
  if (window.__morenosSmooth) return;
  window.__morenosSmooth = true;

  var reduz = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finoMouse = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  function scroller() {
    var doc = document.scrollingElement || document.documentElement;
    if (doc.scrollHeight > doc.clientHeight + 8) return doc;
    var n = document.body;
    while (n) {
      var oy = getComputedStyle(n).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight + 8) return n;
      n = n.firstElementChild;
    }
    return doc;
  }
  function max(el) { return Math.max(0, el.scrollHeight - el.clientHeight); }
  function set(el, y) {
    if (el === document.scrollingElement || el === document.documentElement) window.scrollTo({ top: y, behavior: 'instant' });
    else el.scrollTop = y;
  }

  var alvo = 0, atual = 0, rodando = false, el = null, ease = 0.095, ultimoSet = -1;

  function loop() {
    var d = alvo - atual;
    if (Math.abs(d) < 0.4) { atual = alvo; set(el, atual); ultimoSet = Math.round(atual); rodando = false; return; }
    atual += d * ease;
    set(el, atual);
    ultimoSet = Math.round(atual);
    requestAnimationFrame(loop);
  }
  function irPara(y, suavidade) {
    el = el || scroller();
    if (!rodando) { atual = el.scrollTop; }
    alvo = Math.max(0, Math.min(y, max(el)));
    ease = suavidade || 0.095;
    if (!rodando) { rodando = true; requestAnimationFrame(loop); }
  }
  window.morenosScrollTo = function (y) { irPara(y, 0.075); };

  function rolavel(n) {
    while (n && n !== document.body && n !== document.documentElement) {
      if (n.getAttribute && (n.getAttribute('role') === 'dialog' || n.tagName === 'IFRAME' || n.tagName === 'TEXTAREA')) return true;
      var s = getComputedStyle(n);
      if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && n.scrollHeight > n.clientHeight + 2) return true;
      n = n.parentElement;
    }
    return false;
  }

  if (!reduz && finoMouse) {
    window.addEventListener('wheel', function (e) {
      if (e.ctrlKey || e.defaultPrevented || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (rolavel(e.target)) return;
      el = scroller();
      if (el !== document.scrollingElement && el !== document.documentElement && !el.contains(e.target)) return;
      e.preventDefault();
      var dy = e.deltaY * (e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? el.clientHeight : 1);
      var base = rodando ? alvo : el.scrollTop;
      irPara(base + dy);
    }, { passive: false });

    // teclado, barra de rolagem e scroll programático de terceiros: ressincroniza
    window.addEventListener('scroll', function () {
      if (!el) return;
      var y = el.scrollTop;
      if (rodando && Math.abs(y - ultimoSet) <= 2) return;
      if (rodando && Math.abs(y - ultimoSet) > 2) rodando = false;
      alvo = atual = y;
    }, { passive: true, capture: true });
  }

  // âncoras na mesma página, descontando o header fixo
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    var a = e.target.closest && e.target.closest('a[href*="#"]');
    if (!a) return;
    var href = a.getAttribute('href');
    var i = href.indexOf('#');
    var arquivo = href.slice(0, i);
    var aqui = location.pathname.split('/').pop();
    if (arquivo && arquivo !== aqui) return;
    var id = decodeURIComponent(href.slice(i + 1));
    var destino = id && document.getElementById(id);
    if (!destino) return;
    e.preventDefault();
    var head = document.querySelector('header');
    var off = (head ? head.getBoundingClientRect().height : 90) + 12;
    el = scroller();
    var y = destino.getBoundingClientRect().top + el.scrollTop - off;
    if (reduz) set(el, y); else irPara(y, 0.075);
    if (history.replaceState) history.replaceState(null, '', '#' + id);
  });
})();
