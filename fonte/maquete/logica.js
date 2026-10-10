  cardRef = (el) => { this.cineCard = el; };
  sheenRef = (el) => { this.cineSheen = el; };
  phoneRef = (el) => { this.cinePhone = el; };

  cineRef = (el) => {
    if (!el || el.__cine) return;
    el.__cine = true;

    const reduz = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const anim = {
      card: 'cineCard 1.5s cubic-bezier(.16,1,.3,1) forwards',
      phone: 'cineRise 1.5s cubic-bezier(.16,1,.3,1) forwards',
      badge: 'cinePop 1s cubic-bezier(.2,1.2,.4,1) forwards',
      texto: 'cineSlide 1.1s cubic-bezier(.16,1,.3,1) forwards',
      palavra: 'cineWord 1.4s cubic-bezier(.16,1,.3,1) forwards',
      ring: 'cineRing 1.8s cubic-bezier(.16,1,.3,1) forwards',
    };
    const alvos = Array.from(el.querySelectorAll('[data-cine]'));
    if (reduz || typeof IntersectionObserver === 'undefined') {
      alvos.forEach(n => { n.style.opacity = '1'; if (n.dataset.cine === 'ring') n.setAttribute('stroke-dashoffset', '96'); });
    } else {
      const atrasos = { card: 0, texto: .35, phone: .5, palavra: .7, ring: 1.15, badge: 1.25 };
      let iBadge = 0;
      const obs = new IntersectionObserver((entradas) => {
        entradas.forEach(e => {
          if (!e.isIntersecting) return;
          alvos.forEach(n => {
            const k = n.dataset.cine;
            let d = atrasos[k] || 0;
            if (k === 'badge') { d += iBadge * 0.18; iBadge++; }
            n.style.animation = anim[k] + ' ' + d.toFixed(2) + 's';
          });
          obs.disconnect();
        });
      }, { threshold: 0.12 });
      obs.observe(el);
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const card = this.cineCard, sheen = this.cineSheen, phone = this.cinePhone;
        if (!card) return;
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        if (sheen) sheen.style.background = 'radial-gradient(700px circle at ' + (px * 100).toFixed(1) + '% ' + (py * 100).toFixed(1) + '%, rgba(183,154,106,.16) 0%, transparent 42%)';
        if (phone) phone.style.transform = 'rotateY(' + ((px - .5) * 18).toFixed(2) + 'deg) rotateX(' + ((.5 - py) * 14).toFixed(2) + 'deg)';
      });
    });
    el.addEventListener('pointerleave', () => {
      cancelAnimationFrame(raf);
      if (this.cinePhone) this.cinePhone.style.transform = 'rotateY(0deg) rotateX(0deg)';
      if (this.cineSheen) this.cineSheen.style.background = 'radial-gradient(700px circle at 50% 50%, rgba(183,154,106,.12) 0%, transparent 42%)';
    });
  };