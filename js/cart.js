/* Winkelwagen en afrekenen. De keuze wordt in de browser bewaard, het zijpaneel toont de wagen en de pagina /afrekenen
   stuurt de bestelling naar de betaalpagina van Stripe. Prijzen worden op de server opnieuw uit de database gelezen,
   dus wat hier staat is alleen ter weergave. */
(() => {
  'use strict';
  const KEY = 'rx-cart', INFO_KEY = 'rx-checkout-info';
  const eur = n => '€' + Number(n || 0).toLocaleString('nl-NL', { minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2, maximumFractionDigits: 2 });
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const read = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } };
  const FALLBACK_IMG = '/assets/images/optimized/logo-128.webp';
  const safeImg = u => (/^(\/assets\/|https:\/\/)/.test(String(u || '')) ? u : FALLBACK_IMG);

  let recheck = () => {};
  let items = [];
  try { const raw = JSON.parse(read(KEY) || '[]'); if (Array.isArray(raw)) items = raw.filter(i => i && typeof i.id === 'string').slice(0, 12); } catch (e) { items = []; }
  const total = () => items.reduce((t, i) => t + Number(i.price || 0), 0);
  const save = () => { write(KEY, JSON.stringify(items)); paint(); };

  /* Na een geslaagde bestelling is de wagen weer leeg. */
  if (location.pathname === '/bedankt') { items = []; write(KEY, '[]'); try { localStorage.removeItem('rx-discount'); localStorage.removeItem('rx-spin-code'); } catch (e) { /* storage blocked */ } }

  /* ---------- Zijpaneel ---------- */
  let panel = null, lastFocus = null;
  function build() {
    if (panel) return panel;
    panel = document.createElement('div');
    panel.className = 'cart';
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML = `<div class="cart-scrim" data-cart-close></div>
      <aside class="cart-panel" role="dialog" aria-modal="true" aria-labelledby="cart-title" tabindex="-1">
        <span class="cart-grab" aria-hidden="true"></span>
        <header class="cart-head"><h2 id="cart-title">Winkelwagen <span class="cart-n" id="cart-n"></span></h2><button class="cart-x" type="button" data-cart-close aria-label="Sluit winkelwagen"><span></span><span></span></button></header>
        <div class="cart-body" id="cart-body"></div>
        <footer class="cart-foot" id="cart-foot">
          <dl class="cart-sum"><div><dt>Subtotaal</dt><dd id="cart-sub"></dd></div><div><dt>Levering</dt><dd>Direct per e-mail</dd></div></dl>
          <div class="cart-total"><span>Totaal</span><strong id="cart-total"></strong></div>
          <a class="btn btn-primary btn-lg btn-block" href="/afrekenen">Afrekenen</a>
          <p class="cart-note"><svg class="cart-lock-ic" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg><span>Veilig betalen via</span> <a class="stripe-link" href="https://stripe.com" target="_blank" rel="noopener noreferrer" aria-label="Stripe"><svg class="stripe-logo" viewBox="0 0 60 25" width="42" height="17" role="img" aria-label="Stripe" fill="currentColor"><path d="M59.64 14.28h-8.06c.19 1.93 1.6 2.55 3.2 2.55 1.64 0 2.96-.37 4.05-.95v3.32a8.33 8.33 0 0 1-4.56 1.1c-4.01 0-6.83-2.5-6.83-7.48 0-4.19 2.39-7.52 6.3-7.52 3.92 0 5.96 3.28 5.96 7.5 0 .4-.04 1.26-.06 1.48zm-5.92-5.62c-1.03 0-2.17.73-2.17 2.58h4.25c0-1.85-1.07-2.58-2.08-2.58zM40.95 20.3c-1.44 0-2.32-.6-2.9-1.04l-.02 4.63-4.12.87V5.57h3.76l.08 1.02a4.7 4.7 0 0 1 3.23-1.29c2.9 0 5.62 2.6 5.62 7.4 0 5.23-2.7 7.6-5.65 7.6zM40 8.95c-.95 0-1.54.34-1.97.81l.02 6.12c.4.44.98.78 1.95.78 1.52 0 2.54-1.65 2.54-3.87 0-2.15-1.04-3.84-2.54-3.84zM28.24 5.57h4.13v14.44h-4.13V5.57zm0-4.7L32.37 0v3.36l-4.13.88V.88zm-4.32 9.35v9.79H19.8V5.57h3.7l.12 1.22c1-1.77 3.07-1.41 3.62-1.22v3.79c-.52-.17-2.29-.43-3.32.86zm-8.55 4.72c0 2.43 2.6 1.68 3.12 1.46v3.36c-.55.3-1.54.54-2.89.54a4.15 4.15 0 0 1-4.27-4.24l.01-13.17 4.02-.86v3.54h3.14V9.1h-3.13v5.85zm-4.91.7c0 2.97-2.31 4.66-5.73 4.66a11.2 11.2 0 0 1-4.46-.93v-3.93c1.38.75 3.1 1.31 4.46 1.31.92 0 1.53-.24 1.53-1C6.26 13.77 0 14.51 0 9.95 0 7.04 2.28 5.3 5.62 5.3c1.36 0 2.72.2 4.09.75v3.88a9.23 9.23 0 0 0-4.1-1.06c-.86 0-1.44.25-1.44.9 0 1.85 6.29.97 6.29 5.88z" fill-rule="evenodd"/></svg></a></p>
        </footer>
      </aside>`;
    document.body.append(panel);
    panel.addEventListener('click', e => {
      if (e.target.closest('[data-cart-close]')) return close();
      const rm = e.target.closest('[data-remove]');
      if (rm) { items.splice(Number(rm.dataset.remove), 1); save(); }
    });
    return panel;
  }

  function paint() {
    document.querySelectorAll('[data-cart-count]').forEach(el => {
      const changed = el.textContent !== String(items.length) && !el.hidden;
      el.textContent = String(items.length); el.hidden = !items.length;
      if (changed || (items.length && el.dataset.seen !== '1')) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
      el.dataset.seen = items.length ? '1' : '';
    });
    if (panel) {
      panel.querySelector('#cart-n').textContent = items.length ? `(${items.length})` : '';
      panel.querySelector('#cart-foot').hidden = !items.length;
      panel.querySelector('#cart-body').innerHTML = items.length
        ? `<ul class="cart-list">${items.map((i, n) => `<li><img src="${esc(safeImg(i.img))}" alt="" width="72" height="72" loading="lazy"><div class="cart-info"><b>${esc(i.name)}</b>${i.variant ? `<span>Versie ${esc(i.variant)}</span>` : ''}<button class="cart-rm" type="button" data-remove="${n}">Verwijderen</button></div><strong>${eur(i.price)}</strong></li>`).join('')}</ul>`
        : '<div class="cart-empty"><span class="cart-empty-mark" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M3 4h2.2l2.1 10.2a1.6 1.6 0 0 0 1.6 1.3h8.1a1.6 1.6 0 0 0 1.6-1.2L20.5 8H6.1"/></svg></span><b>Je winkelwagen is leeg</b><span>Ontdek onze servers, scripts en meer.</span><a class="btn btn-primary btn-sm" href="/producten">Bekijk producten</a></div>';
      panel.querySelector('#cart-total').textContent = eur(total());
      panel.querySelector('#cart-sub').textContent = eur(total());
    }
    paintCheckout();
  }

  function open() {
    build(); paint();
    lastFocus = document.activeElement;
    panel.classList.add('is-open'); panel.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('cart-lock');
    requestAnimationFrame(() => panel.querySelector('.cart-panel').focus({ preventScroll: true }));
  }
  function close() {
    if (!panel) return;
    panel.classList.remove('is-open'); panel.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('cart-lock');
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  function add(btn) {
    const checked = document.querySelector('input[name=variant]:checked');
    const entry = { id: btn.dataset.add, name: btn.dataset.name, price: Number(checked ? checked.dataset.price : btn.dataset.price), variant: checked ? checked.value : '', img: btn.dataset.img || '' };
    const go = btn.dataset.go === 'checkout';
    const run = () => {
      if (!items.some(i => i.id === entry.id && i.variant === entry.variant)) items.push(entry);
      save();
      if (go) { location.href = '/afrekenen'; return; }
      open();
    };
    /* Ordering needs a Discord login: ask first and add the product right after the visitor is back. */
    const A = window.RxAuth;
    if (!A) return run();
    const decide = u => { if (u) run(); else A.require(location.pathname + location.search, { entry, go }); };
    if (A.user) run(); else A.ready.then(decide);
  }

  /* ---------- Pagina /afrekenen ---------- */
  let applied = null; /* answer of /api/discount for the codes on the order: { discounts: [{ code, label, source, discount }], discount, total } */
  const money = n => eur(n);
  function paintCheckout() {
    const root = document.getElementById('checkout');
    if (!root) return;
    const empty = !items.length;
    root.querySelector('#co-empty').hidden = !empty;
    const out = Boolean(window.RxAuth && !window.RxAuth.user);
    root.querySelector('#co-grid').hidden = empty || out;
    const gate = root.querySelector('#co-login'); if (gate) gate.hidden = empty || !out;
    const acc = root.querySelector('#co-account');
    if (acc && !out && window.RxAuth && window.RxAuth.user) { const u = window.RxAuth.user; acc.hidden = false; acc.innerHTML = `<img src="${esc(u.avatar)}" alt="" width="40" height="40" referrerpolicy="no-referrer"><div><b>${esc(u.name)}</b><span>@${esc(u.username)} · Ingelogd met Discord</span></div>`; const nm = root.querySelector('#co-name'); if (nm && !nm.value) nm.value = u.name; }
    root.querySelector('#co-items').innerHTML = items.map((i, n) => `<li><span class="co-thumb"><img src="${esc(safeImg(i.img))}" alt="" width="60" height="60"></span><div><b>${esc(i.name)}</b>${i.variant ? `<span>Versie ${esc(i.variant)}</span>` : ''}<button class="cart-rm" type="button" data-co-remove="${n}">Verwijderen</button></div><strong>${eur(i.price)}</strong></li>`).join('');
    const sub = total(), disc = applied ? Math.min(applied.discount, sub) : 0;
    const rows = applied ? applied.discounts.map(d => `<div class="co-disc"><span>Korting <em>${esc(d.code)}</em><button type="button" data-co-unapply="${esc(d.code)}">Verwijderen</button></span><b>&minus;${eur(d.discount)}</b></div>`).join('') : '';
    const t = eur(Math.max(0, sub - disc));
    const lines = root.querySelector('#co-lines');
    lines.hidden = !disc;
    lines.innerHTML = disc ? `<div><span>Subtotaal</span><b>${eur(sub)}</b></div>${rows}` : '';
    root.querySelector('#co-total').textContent = t;
    root.querySelector('#co-sum-total-top').textContent = t;
    root.querySelector('#co-pay').textContent = `Betalen ${t}`;
  }

  function initCheckout() {
    const root = document.getElementById('checkout');
    if (!root) return;
    const form = root.querySelector('#co-form'), err = root.querySelector('#co-error'), pay = root.querySelector('#co-pay');
    const sum = root.querySelector('#co-sum');
    sum.open = matchMedia('(min-width: 901px)').matches;
    try { const saved = JSON.parse(read(INFO_KEY) || '{}'); ['email', 'name'].forEach(k => { if (saved[k]) form.elements[k].value = saved[k]; }); } catch (e) { /* nothing saved */ }
    form.addEventListener('input', () => write(INFO_KEY, JSON.stringify({ email: form.email.value.trim(), name: form.name.value.trim() })));
    const codeInput = root.querySelector('#co-code'), codeMsg = root.querySelector('#co-code-msg'), applyBtn = root.querySelector('#co-apply');
    const say = (msg, kind) => { codeMsg.textContent = msg; codeMsg.hidden = !msg; codeMsg.className = 'co-code-msg' + (kind ? ' is-' + kind : ''); };
    let checking = 0;
    let codes = [];
    const unique = list => [...new Set(list.map(c => String(c || '').trim().toUpperCase()).filter(Boolean))];
    const remember = () => {
      if (!applied && codes.length) return;
      const spin = applied ? applied.discounts.filter(d => d.source === 'spin').map(d => d.code) : [];
      try {
        if (spin.length) localStorage.setItem('rx-spin-code', spin[0]); else localStorage.removeItem('rx-spin-code');
        localStorage.removeItem('rx-discount'); /* typed codes are never filled in automatically, only the Daily Wheel code */
      } catch (e) { /* storage blocked */ }
    };
    /* Checks every code on the order together: a Daily Wheel code and one more code can be combined. */
    const check = async (silent, justAdded) => {
      const run = ++checking;
      if (!codes.length || !items.length) { applied = null; remember(); paintCheckout(); return; }
      applyBtn.disabled = true; applyBtn.textContent = 'Controleren';
      try {
        const res = await fetch('/api/discount', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codes, items: items.map(i => ({ id: i.id, variant: i.variant })) }) });
        const out = await res.json().catch(() => ({}));
        if (run !== checking) return;
        if (out.ok) {
          applied = out; remember();
          if (justAdded) { codeInput.value = ''; const d = out.discounts.find(x => x.code === justAdded); say(d && d.source === 'spin' ? `Je Daily Wheel-korting is toegepast: ${d.label}.` : `Kortingscode toegepast: ${d ? d.label : ''}.`, 'ok'); }
          else say('');
        } else {
          /* the code that was refused is dropped, the others stay */
          codes = codes.filter(c => c !== out.code); applied = null;
          if (!silent) say(out.error || 'Deze kortingscode is niet geldig.', 'err'); else say('');
          if (codes.length && out.code) { applyBtn.disabled = false; return check(true); }
          remember();
        }
      } catch (ex) { if (run === checking) { applied = null; if (!silent) say('De kortingscode kon niet worden gecontroleerd. Probeer het opnieuw.', 'err'); } }
      if (run === checking) { applyBtn.disabled = false; applyBtn.textContent = 'Toepassen'; paintCheckout(); }
    };
    const addCode = raw => {
      const code = String(raw || '').trim().toUpperCase();
      if (!code) return;
      if (codes.includes(code)) { say('Deze kortingscode heb je al toegepast.', 'err'); return; }
      if (codes.length >= 2) { say('Je kunt maximaal twee kortingscodes combineren. Verwijder eerst een code.', 'err'); return; }
      codes.push(code); check(false, code);
    };
    recheck = () => { if (codes.length) check(true); };
    applyBtn.addEventListener('click', () => addCode(codeInput.value));
    codeInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addCode(codeInput.value); } });
    /* Someone who spun but never claimed has no code yet: it is made here from the signed spin result. */
    const spinCode = async () => {
      let st = null;
      try { st = JSON.parse(read('rx-wheel') || 'null'); } catch (e) { /* no spin */ }
      if (!st) { const m = document.cookie.match(/(?:^|; )rx_wheel=([^;]+)/); try { st = m && JSON.parse(decodeURIComponent(m[1])); } catch (e) { st = null; } }
      if (!st || !st.z || Date.now() - st.t > 24 * 3600 * 1000) return '';
      if (st.k) return st.k;
      try {
        const res = await fetch('/api/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: st.v, token: st.z }) });
        const out = await res.json().catch(() => ({}));
        if (!out.code) return '';
        st.c = 1; st.k = out.code; st.x = out.expires || null;
        const raw = JSON.stringify(st);
        write('rx-wheel', raw); document.cookie = `rx_wheel=${encodeURIComponent(raw)}; max-age=86400; path=/; SameSite=Lax`;
        return out.code;
      } catch (e) { return ''; }
    };
    /* Codes from earlier (a Daily Wheel code and a typed code) come back automatically. */
    (async () => {
      if (!items.length) return;
      let spin = read('rx-spin-code') || await spinCode();
      if (spin && spin === read('rx-spin-skip')) spin = '';
      codes = unique([spin]);
      if (codes.length) check(true);
    })();
    root.addEventListener('click', e => {
      const rm = e.target.closest('[data-co-remove]'); if (rm) { items.splice(Number(rm.dataset.coRemove), 1); save(); recheck(); }
      const un = e.target.closest('[data-co-unapply]');
      if (un) { if (applied && applied.discounts.some(d => d.code === un.dataset.coUnapply && d.source === 'spin')) write('rx-spin-skip', un.dataset.coUnapply); codes = codes.filter(c => c !== un.dataset.coUnapply); say(''); if (applied) applied.discounts = applied.discounts.filter(d => d.code !== un.dataset.coUnapply); if (codes.length) check(true); else { applied = null; remember(); paintCheckout(); } }
    });
    const show = (msg, field) => { err.textContent = msg; err.hidden = !msg; if (msg && field) field.focus(); };
    form.addEventListener('submit', async e => {
      e.preventDefault(); show('');
      const email = form.email.value.trim(), name = form.name.value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return show('Vul een geldig e-mailadres in.', form.email);
      if (name.length < 2) return show('Vul je naam in.', form.name);
      if (window.RxAuth && !window.RxAuth.user) { show('Log eerst in met Discord om te bestellen.'); return window.RxAuth && window.RxAuth.require('/afrekenen'); }
      if (!form.consent.checked) return show('Ga akkoord met de voorwaarden om verder te gaan.', form.consent);
      pay.disabled = true; pay.textContent = 'Even geduld';
      try {
        const res = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: items.map(i => ({ id: i.id, variant: i.variant })), email, name, consent: true, codes: applied ? applied.discounts.map(d => d.code) : [] }) });
        const json = await res.json().catch(() => ({}));
        if (res.status === 401 || json.login) { if (window.RxAuth) window.RxAuth.require('/afrekenen'); throw new Error('Log eerst in met Discord om te bestellen.'); }
        if (!res.ok || !json.url) throw new Error(json.error || 'Er ging iets mis. Probeer het opnieuw.');
        location.href = json.url;
      } catch (ex) { show(ex.message); pay.disabled = false; paintCheckout(); }
    });
    paintCheckout();
  }

  document.addEventListener('click', e => {
    const a = e.target.closest('[data-add]'); if (a) { e.preventDefault(); e.stopPropagation(); return add(a); }
    if (e.target.closest('[data-cart-open]')) {
      e.preventDefault();
      /* The cart is for logged-in customers: everyone else is asked to log in with Discord first. */
      const A = window.RxAuth;
      if (A && !A.user) A.ready.then(u => { if (u) open(); else A.require(location.pathname + location.search); }); else open();
    }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && panel && panel.classList.contains('is-open')) close(); });
  window.addEventListener('pageshow', e => { if (e.persisted) { const pay = document.getElementById('co-pay'); if (pay) { pay.disabled = false; paintCheckout(); } } });
  paint();
  initCheckout();
  if (window.RxAuth) {
    window.RxAuth.onChange(() => paintCheckout());
    window.RxAuth.ready.then(u => {
      paintCheckout();
      const pending = u && window.RxAuth.pending();
      if (pending && pending.entry && pending.entry.id) {
        if (!items.some(i => i.id === pending.entry.id && i.variant === pending.entry.variant)) items.push(pending.entry);
        save();
        if (pending.go) { location.href = '/afrekenen'; } else open();
      }
    });
  }
})();
