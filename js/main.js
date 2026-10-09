(() => {
  'use strict';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Theme: dark by default, the choice is remembered */
  const themeBtns = document.querySelectorAll('[data-theme-toggle]');
  const paintTheme = () => {
    const light = document.documentElement.getAttribute('data-theme') === 'light';
    themeBtns.forEach(b => { b.setAttribute('aria-label', light ? 'Schakel naar de donkere modus' : 'Schakel naar de lichte modus'); b.setAttribute('aria-pressed', String(light)); });
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', light ? '#ffffff' : '#000000');
  };
  themeBtns.forEach(b => b.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('rx-theme', next); } catch (e) { /* storage blocked */ }
    paintTheme();
  }));
  paintTheme();

  /* Mobile navigation: slide-in drawer */
  const toggle = document.querySelector('.menu-toggle');
  const drawer = document.querySelector('#mobile-nav');
  const setDrawer = open => {
    if (!drawer) return;
    drawer.classList.toggle('is-open', open);
    drawer.toggleAttribute('inert', !open);
    drawer.setAttribute('aria-hidden', String(!open));
    toggle?.setAttribute('aria-expanded', String(open));
    document.documentElement.classList.toggle('drawer-open', open);
    if (open) drawer.querySelector('.drawer-panel')?.focus({ preventScroll: true });
    else if (document.activeElement && drawer.contains(document.activeElement)) toggle?.focus({ preventScroll: true });
  };
  toggle?.addEventListener('click', () => setDrawer(!drawer.classList.contains('is-open')));
  drawer?.addEventListener('click', e => { if (e.target.closest('[data-drawer-close]') || e.target.closest('a[href]')) setDrawer(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setDrawer(false); });
  window.matchMedia('(min-width: 961px)').addEventListener('change', e => { if (e.matches) setDrawer(false); });

  /* Header condenses into a floating bar after scrolling */
  const header = document.querySelector('.site-header');
  /* When you leave a page with the bar condensed, the next page starts condensed too (no jump between the two states)
     and eases open after a moment if you are at the top. */
  let hold = false;
  try { hold = sessionStorage.getItem('rx-hdr') === '1' && window.scrollY <= 40; sessionStorage.removeItem('rx-hdr'); } catch (e) { /* storage blocked */ }
  const syncHeader = () => { if (hold && window.scrollY <= 40) return; hold = false; header?.classList.toggle('is-scrolled', window.scrollY > 40); };
  if (hold) setTimeout(() => { hold = false; syncHeader(); }, 650); else syncHeader();
  window.addEventListener('scroll', syncHeader, { passive: true });
  window.addEventListener('pagehide', () => { try { sessionStorage.setItem('rx-hdr', header?.classList.contains('is-scrolled') ? '1' : '0'); } catch (e) { /* storage blocked */ } });

  /* Hero: the text drifts up and fades a little while you scroll away */
  const heroInner = document.querySelector('.hero-inner');
  if (heroInner && !reducedMotion) {
    let ticking = false;
    const drift = () => { ticking = false; const y = Math.min(window.scrollY, 900); heroInner.style.transform = `translate3d(0, ${(y * .14).toFixed(1)}px, 0)`; heroInner.style.opacity = String(Math.max(0, 1 - y / 640).toFixed(3)); };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(drift); } }, { passive: true });
  }

  /* Scroll motion: reveal on enter, stagger inside groups, star pop and a rating count-up */
  const groups = ['.reviews', '.product-grid', '.svc-list', '.steps', '.trust-list', '.type-grid', '.work-grid', '.mini-grid', '.pdp-detail', '.footer-main', '.faq-list', '.vlist', '.doc-nav nav', '.points', '.cat-grid', '.maat', '.pdp-info', '.vip-list', '.seo-copy-body', '.filters', '.checkout-form', '.co-items', '.ty-grid', '.cart-list'];
  const singles = ['.section-head', '.svc-head', '.vgallery', '.proof-rating', '.proof-cta', '.term', '.faq-group > h2', '.vip-banner', '.doc-help', '.doc-nav-title', '.cta-card > *', '.shop-bar', '.assure', '.split > *', '.footer-bottom', '.vip-promo', '.wheel-band', '.preview-note', '.pdp-media', '.checkout-summary', '.seo-copy > div:first-child', '.checkout-title', '.checkout-back', '.notfound > *', '.wheel-band-wrap .panel'];
  if (!reducedMotion && 'IntersectionObserver' in window) {
    const targets = new Map();
    const add = (el, i = 0, cls = 'reveal') => { if (el.closest('.hero') || targets.has(el)) return; el.style.setProperty('--i', Math.min(i, 7)); targets.set(el, cls); };
    groups.forEach(sel => document.querySelectorAll(sel).forEach(g => [...g.children].forEach((c, i) => add(c, i, g.matches('.doc-nav nav, .faq-list') ? 'reveal-line' : 'reveal'))));
    singles.forEach(sel => document.querySelectorAll(sel).forEach((el, i) => add(el, el.matches('.cta-card > *, .split > *') ? [...el.parentElement.children].indexOf(el) : 0)));
    const done = el => setTimeout(() => { el.classList.remove('reveal', 'reveal-line', 'in'); el.style.removeProperty('--i'); }, 1600);
    const io = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in'); io.unobserve(entry.target); done(entry.target);
    }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    targets.forEach((cls, el) => { el.classList.add(cls); io.observe(el); });

    const starIO = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('in'); starIO.unobserve(entry.target); }
    }), { threshold: 0.6 });
    document.querySelectorAll('.proof-rating .stars').forEach(el => { el.classList.add('stars-anim'); starIO.observe(el); });

    /* Review summary: the bars fill and the numbers count up once it scrolls into view */
    const rs = document.querySelector('.rstats');
    if (rs) {
      const nums = [...rs.querySelectorAll('[data-count]')];
      nums.forEach(n => { n.textContent = (0).toFixed(1); });
      const go = new IntersectionObserver(entries => entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        go.disconnect();
        rs.classList.add('go');
        const start = performance.now();
        const tick = now => {
          const k = Math.min((now - start) / 1600, 1);
          nums.forEach(n => { n.textContent = (parseFloat(n.dataset.count) * (1 - Math.pow(1 - k, 3))).toFixed(1); });
          if (k < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }), { threshold: 0.5 });
      go.observe(rs);
    }
  }

  /* Hero video: save battery when off screen (it also plays under reduced motion, see the inline script on the home page) */
  const heroVideo = document.querySelector('.hero-video');
  if (heroVideo) {
    if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => { if (en.isIntersecting) heroVideo.play().catch(() => {}); else heroVideo.pause(); }, { threshold: 0.05 }).observe(heroVideo);
  }

  /* Video galleries */
  document.querySelectorAll('[data-vgallery]').forEach(gallery => {
    const video = gallery.querySelector('video');
    const items = [...gallery.querySelectorAll('.vitem')];
    const caption = gallery.querySelector('.vcaption');
    items.forEach(item => item.addEventListener('click', () => {
      items.forEach(i => i.setAttribute('aria-pressed', String(i === item)));
      if (caption) caption.textContent = item.dataset.desc || '';
      const frame = video.parentElement;
      frame.classList.add('is-switching');
      setTimeout(() => { video.src = item.dataset.src; video.play().catch(() => {}); frame.classList.remove('is-switching'); }, 260);
    }));
  });
  document.addEventListener('play', e => {
    document.querySelectorAll('video:not(.hero-video)').forEach(v => { if (v !== e.target) v.pause(); });
  }, true);

  /* Accordions: opening one item closes the others */
  document.querySelectorAll('[data-accordion]').forEach(root => {
    root.addEventListener('toggle', e => {
      if (!e.target.open) return;
      root.querySelectorAll('details[open]').forEach(d => { if (d !== e.target) d.open = false; });
    }, true);
  });

  /* Services sub navigation: highlight current section */
  const subLinks = [...document.querySelectorAll('.subnav a, .doc-nav nav a')];
  if (subLinks.length && 'IntersectionObserver' in window) {
    const targets = subLinks.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
    const spy = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      subLinks.forEach(a => {
        const on = a.getAttribute('href') === '#' + entry.target.id;
        a.classList.toggle('is-active', on);
        const strip = a.parentElement;
        if (on && strip && strip.scrollWidth > strip.clientWidth) strip.scrollTo({ left: a.offsetLeft - 20, behavior: 'smooth' });
      });
    }), { rootMargin: '-35% 0px -55% 0px' });
    targets.forEach(t => spy.observe(t));
    if (document.querySelector('.doc-nav')) subLinks[0]?.classList.add('is-active');
  }

  /* Product catalog filters */
  const form = document.querySelector('#catalog-filters');
  if (!form || !window.RaytrixCatalog) return;
  let catalogData = [];
  try { catalogData = JSON.parse(document.querySelector('#catalog-data').textContent); } catch (e) { return; }
  const grid = document.querySelector('.catalog-grid');
  const cards = [...grid.querySelectorAll('.pcard')];
  const count = document.querySelector('#result-count');
  const empty = document.querySelector('#empty-catalog');
  const emptyTitle = document.querySelector('#empty-title');
  const emptyText = document.querySelector('#empty-description');
  const emptyCta = document.querySelector('#empty-cta');
  const categoryInputs = [...form.querySelectorAll('[name="category"]')];
  const queryInput = form.elements.query;
  const priceInput = form.elements.maxPrice;
  const priceOutput = document.querySelector('#price-output');
  const sortInput = document.querySelector('#sort-products');
  const maxPrice = Number(priceInput.max);

  const params = new URLSearchParams(window.location.search);
  const fromUrl = categoryInputs.find(i => i.value === params.get('categorie'));
  if (fromUrl) fromUrl.checked = true;
  queryInput.value = params.get('zoek') || '';
  if ([...sortInput.options].some(o => o.value === params.get('sortering'))) sortInput.value = params.get('sortering');
  if (params.has('prijs') && Number.isFinite(Number(params.get('prijs')))) priceInput.value = params.get('prijs');

  const apply = () => {
    const category = categoryInputs.find(i => i.checked).value;
    const selected = window.RaytrixCatalog.selectProducts(catalogData, { category, query: queryInput.value, maxPrice: Number(priceInput.value), sort: sortInput.value });
    const ids = new Set(selected.map(p => p.id));
    cards.forEach(card => { card.hidden = !ids.has(card.dataset.product); });
    selected.forEach(p => grid.append(cards.find(c => c.dataset.product === p.id)));
    count.textContent = `${selected.length} ${selected.length === 1 ? 'product' : 'producten'}`;
    priceOutput.textContent = `€${priceInput.value}`;
    const noScripts = false;
    empty.hidden = selected.length > 0;
    emptyCta.hidden = !(selected.length === 0 && !queryInput.value.trim() && category !== 'alle');
    emptyTitle.textContent = emptyCta.hidden ? 'Geen producten gevonden' : 'Hier staat nog niets in de shop';
    emptyText.textContent = emptyCta.hidden ? 'Pas je zoekopdracht of filters aan om andere producten te bekijken.' : 'Zoek je iets specifieks? Vertel ons je idee en we bouwen het voor je.';
    const next = new URLSearchParams();
    if (category !== 'alle') next.set('categorie', category);
    if (queryInput.value.trim()) next.set('zoek', queryInput.value.trim());
    if (sortInput.value !== 'featured') next.set('sortering', sortInput.value);
    if (Number(priceInput.value) < maxPrice) next.set('prijs', priceInput.value);
    const qs = next.toString();
    window.history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : ''));
  };
  let timer;
  const update = () => {
    if (reducedMotion) return apply();
    clearTimeout(timer);
    grid.classList.add('is-updating');
    timer = setTimeout(() => { apply(); requestAnimationFrame(() => grid.classList.remove('is-updating')); }, 170);
  };
  form.addEventListener('input', update);
  form.addEventListener('submit', e => e.preventDefault());
  sortInput.addEventListener('change', update);
  document.querySelectorAll('[data-reset-filters]').forEach(btn => btn.addEventListener('click', () => {
    form.reset(); sortInput.value = 'featured'; update();
  }));
  const filterToggle = document.querySelector('.filter-toggle');
  filterToggle?.addEventListener('click', () => {
    const open = filterToggle.getAttribute('aria-expanded') !== 'true';
    filterToggle.setAttribute('aria-expanded', String(open));
    form.classList.toggle('is-open', open);
  });
  apply();
})();
