/* Daily Wheel: one spin per 24 hours, weighted so that most wins are 5-15%.
   The server is the authority (see api/spin.js); localStorage and a cookie only remember the result for display. */
(() => {
  'use strict';
  const dialog = document.querySelector('#wheel');
  if (!dialog) return;

  const DAY = 24 * 60 * 60 * 1000;
  const KEY = 'rx-wheel';
  const SEEN = 'rx-wheel-seen';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* 12 slices; the odds below decide the result, not the slice size, so high values are rare. */
  const SLICES = [5, 10, 7, 25, 5, 12, 10, 50, 7, 15, 5, 20];
  const ODDS = { 5: 23, 7: 18, 10: 19, 12: 13, 15: 11, 20: 8, 25: 6, 50: 2 };
  const STEP = 360 / SLICES.length;

  const rnd = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
  const pad = n => String(n).padStart(2, '0');
  const fmt = ms => { const t = Math.max(0, Math.ceil(ms / 1000)); return `${pad(Math.floor(t / 3600))}:${pad(Math.floor(t % 3600 / 60))}:${pad(t % 60)}`; };
  const stamp = t => new Date(t).toLocaleString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  /* Storage: localStorage plus a 24h cookie, so clearing only one of them does not reset the timer. */
  const read = () => {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { /* storage blocked */ }
    if (!raw) { const m = document.cookie.match(/(?:^|; )rx_wheel=([^;]+)/); raw = m && decodeURIComponent(m[1]); }
    try { const v = raw ? JSON.parse(raw) : null; return v && typeof v.t === 'number' && ODDS[v.v] ? v : null; } catch (e) { return null; }
  };
  const write = state => {
    const raw = JSON.stringify(state);
    try { localStorage.setItem(KEY, raw); } catch (e) { /* storage blocked */ }
    document.cookie = `rx_wheel=${encodeURIComponent(raw)}; max-age=${DAY / 1000}; path=/; SameSite=Lax`;
  };
  const locked = () => { const s = read(); return s && Date.now() - s.t < DAY ? s : null; };

  /* ---- Wheel drawing (SVG, rotated as one element so the spin stays smooth) ---- */
  const rotor = dialog.querySelector('[data-rotor]');
  const point = (r, deg) => { const a = deg * Math.PI / 180; return [200 + r * Math.sin(a), 200 - r * Math.cos(a)]; };
  const buildWheel = () => {
    const R = 178;
    let slices = '', labels = '', ticks = '';
    SLICES.forEach((v, i) => {
      const a0 = i * STEP, a1 = (i + 1) * STEP, mid = a0 + STEP / 2;
      const [x0, y0] = point(R, a0), [x1, y1] = point(R, a1);
      const rare = v >= 20;
      const fill = rare ? 'url(#wg-hot)' : (i % 2 ? 'url(#wg-b)' : 'url(#wg-a)');
      slices += `<path d="M200 200L${x0.toFixed(2)} ${y0.toFixed(2)}A${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}Z" fill="${fill}" stroke="#06142e" stroke-width="2" stroke-linejoin="round"/>`;
      labels += `<g transform="rotate(${mid} 200 200)"><text x="200" y="84" text-anchor="middle" font-family="Geist, system-ui, sans-serif" font-weight="700" font-size="36" fill="${rare ? '#03111f' : '#ffffff'}">${v}<tspan font-size="20" dx="1">%</tspan></text></g>`;
      const [tx, ty] = point(189, a0);
      ticks += `<circle cx="${tx.toFixed(2)}" cy="${ty.toFixed(2)}" r="2.6" fill="#cfeaff"/>`;
    });
    rotor.innerHTML = `<svg viewBox="0 0 400 400" width="100%" height="100%" role="img" aria-label="Rad met kortingen van 5% tot 50%">
      <defs>
        <radialGradient id="wg-a" cx="50%" cy="50%" r="50%"><stop offset="0.2" stop-color="#0a2552"/><stop offset="1" stop-color="#12408a"/></radialGradient>
        <radialGradient id="wg-b" cx="50%" cy="50%" r="50%"><stop offset="0.2" stop-color="#0d2f66"/><stop offset="1" stop-color="#1a5cb8"/></radialGradient>
        <radialGradient id="wg-hot" cx="50%" cy="50%" r="50%"><stop offset="0.2" stop-color="#7fcdfb"/><stop offset="1" stop-color="#4db4ff"/></radialGradient>
      </defs>
      <circle cx="200" cy="200" r="197" fill="#06142e" stroke="#8fd5ff" stroke-width="2"/>
      <circle cx="200" cy="200" r="184" fill="none" stroke="rgba(143, 213, 255, .35)" stroke-width="1"/>
      ${slices}${labels}${ticks}
    </svg>`;
  };
  buildWheel();

  /* ---- State handling ---- */
  let rotation = 0;
  let spinning = false;
  let pending = false;
  const $ = sel => dialog.querySelector(sel);
  const setState = s => { dialog.dataset.state = s; };
  const chip = document.querySelector('.wheel-chip');
  const promoText = document.querySelector('[data-wheel-promo]');
  const promoDefault = promoText ? promoText.textContent : '';
  const promoBtns = document.querySelectorAll('[data-wheel-label]');
  const countdown = $('[data-countdown]');
  const resultEl = $('[data-result]');

  const sent = $('[data-claim-sent]');
  const codeEl = $('[data-claim-code]');
  const codeInfo = $('[data-claim-code-info]');
  /* state.k = code ready, otherwise "creating" until autoClaim has finished (failed = true shows the fallback). */
  const showClaim = (state, failed) => {
    sent.hidden = false;
    const has = Boolean(state.k);
    const wait = $('[data-claim-wait]'); if (wait) wait.hidden = has || Boolean(failed);
    $('[data-claim-code-box]').hidden = !has;
    $('[data-claim-fallback]').hidden = has || !failed;
    if (has) {
      codeEl.textContent = state.k;
      if (codeInfo) codeInfo.textContent = state.x ? `Eenmalig te gebruiken en geldig tot ${new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(state.x))}.` : 'Eenmalig te gebruiken.';
    }
  };

  /* The discount code is made automatically once the wheel has landed; no details are needed. */
  const autoClaim = async state => {
    if (state.k) { showClaim(state); return; }
    if (!state.z) { showClaim(state, true); return; }
    try {
      const res = await fetch('/api/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: state.v, token: state.z }) });
      const out = await res.json().catch(() => ({}));
      if (out && out.code) {
        state.c = 1; state.k = out.code; state.x = out.expires || null;
        try { localStorage.setItem('rx-spin-code', out.code); } catch (e) { /* storage blocked */ }
        write(state);
      }
    } catch (err) { /* checkout tries again */ }
    showClaim(state, true);
  };

  const showWon = (state, animate) => {
    showClaim(state);
    $('[data-result-date]').textContent = 'Gewonnen op ' + stamp(state.t);
    if (!animate || reduce) { resultEl.textContent = state.v; return; }
    const start = performance.now();
    const tick = now => {
      const k = Math.min((now - start) / 900, 1);
      resultEl.textContent = Math.round(state.v * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const restAt = idx => {
    const center = idx * STEP + STEP / 2;
    rotation = -center;
    rotor.style.transition = 'none';
    rotor.style.transform = `rotate(${rotation}deg)`;
  };

  const burst = value => {
    if (reduce) return;
    const box = $('[data-burst]');
    const n = value >= 25 ? 44 : 26;
    box.replaceChildren();
    for (let i = 0; i < n; i++) {
      const el = document.createElement('i');
      const ang = rnd() * Math.PI * 2, dist = 120 + rnd() * (value >= 25 ? 230 : 170);
      el.style.setProperty('--dx', (Math.cos(ang) * dist).toFixed(0) + 'px');
      el.style.setProperty('--dy', (Math.sin(ang) * dist).toFixed(0) + 'px');
      el.style.setProperty('--r', (rnd() * 360).toFixed(0) + 'deg');
      el.style.animationDelay = (rnd() * 0.12).toFixed(2) + 's';
      el.className = i % 3 === 0 ? 'w' : '';
      box.appendChild(el);
    }
    setTimeout(() => { box.replaceChildren(); }, 1800);
  };

  /* The server draws the result (so nobody can pick a prize), signs it, and allows one spin per Discord account and
     network per 24 hours, so clearing the browser or switching browser or device does not help. */
  const serverDraw = async () => {
    try {
      const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 8000);
      const res = await fetch('/api/spin', { method: 'POST', credentials: 'same-origin', signal: ctl.signal }); clearTimeout(timer);
      const out = await res.json();
      return out && out.ok && ODDS[out.value] ? out : (out || {});
    } catch (e) { return {}; }
  };
  const note = $('[data-wheel-note]');
  const say = msg => { if (note) { note.textContent = msg; note.hidden = false; } };
  const spin = async () => {
    if (spinning || locked()) return;
    if (note) note.hidden = true;
    spinning = true; pending = true; setState('spinning');
    const drawn = await serverDraw();
    if (!drawn.ok) {
      spinning = false; pending = false; setState('ready');
      if (drawn.login) {
        const go = $('[data-wheel-login]');
        if (go) go.href = '/api/auth/login?return=' + encodeURIComponent(location.pathname + location.search);
        setState('login');
      }
      else if (drawn.young) say('Je Discord account is nog te nieuw. Accounts van minstens 7 dagen oud kunnen draaien.');
      else say('Het rad is nu even niet beschikbaar. Probeer het zo opnieuw.');
      return;
    }
    const value = drawn.value;
    const choices = SLICES.map((v, i) => v === value ? i : -1).filter(i => i >= 0);
    const idx = choices[Math.floor(rnd() * choices.length)];
    const state = { t: drawn.t || Date.now(), v: value, i: idx, z: drawn.token };
    write(state);                       /* stored before the animation, so a refresh cannot re-roll */
    if (drawn.again) {                  /* this account or network already spun in the last 24 hours: show that result, no new spin */
      spinning = false; pending = false; restAt(idx); setState('won'); showWon(state, false); refresh(); autoClaim(state);
      return;
    }
    const center = idx * STEP + STEP / 2 + (rnd() - 0.5) * STEP * 0.6;
    const base = ((rotation % 360) + 360) % 360;
    let delta = ((360 - center) - base) % 360;
    if (delta < 0) delta += 360;
    rotation += 360 * (reduce ? 1 : 6) + delta;
    const ms = reduce ? 900 : 6200;
    rotor.style.transition = `transform ${ms}ms cubic-bezier(.1,.78,.13,1)`;
    requestAnimationFrame(() => { rotor.style.transform = `rotate(${rotation}deg)`; });
    let done = false;
    const finish = () => {
      if (done) return;
      done = true; spinning = false; pending = false;
      setState('won'); showWon(state, true); burst(value); refresh(); autoClaim(state);
      dialog.querySelector('.wheel-pointer').classList.add('is-hit');
    };
    rotor.addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, ms + 300);
  };

  /* ---- Open / close ---- */
  const open = () => {
    if (!dialog.open) dialog.showModal();
    try { sessionStorage.setItem(SEEN, '1'); } catch (e) { /* ignore */ }
    const s = locked();
    if (s && !spinning) { restAt(s.i); setState('won'); showWon(s, false); if (!s.k) autoClaim(s); }
    else if (!spinning) { setState('ready'); }
  };
  const close = () => dialog.close();
  document.querySelectorAll('[data-wheel-open]').forEach(b => b.addEventListener('click', open));
  const copyBtn = $('[data-claim-copy]');
  if (copyBtn) copyBtn.addEventListener('click', async () => { try { await navigator.clipboard.writeText(codeEl.textContent); copyBtn.textContent = 'Gekopieerd'; setTimeout(() => { copyBtn.textContent = 'Kopieer'; }, 1800); } catch (e) { /* clipboard blocked */ } });
  dialog.addEventListener('click', e => {
    if (e.target === dialog || e.target.closest('[data-wheel-close]')) close();
    else if (e.target.closest('[data-wheel-spin]')) spin();
  });
  dialog.addEventListener('close', () => dialog.querySelector('.wheel-pointer').classList.remove('is-hit'));

  /* ---- Chip, promo bar and countdown (updated every second) ---- */
  function refresh() {
    const s = locked();
    const shown = s && !pending ? s : null;   /* the prize only shows once the wheel has landed */
    const left = s ? s.t + DAY - Date.now() : 0;
    if (chip) {
      chip.hidden = false;
      chip.dataset.available = s ? 'false' : 'true';
      chip.querySelector('[data-chip-title]').textContent = shown ? `Jouw korting: ${shown.v}%` : 'Daily Wheel';
      chip.querySelector('[data-chip-sub]').textContent = s ? (shown ? `Volgende spin over ${fmt(left)}` : 'Het rad draait…') : 'Draai nu, win tot 50%';
    }
    if (promoText) promoText.textContent = s ? (shown ? `Je wint ${shown.v}% korting. Volgende spin over ${fmt(left)}` : 'Het rad draait…') : promoDefault;
    promoBtns.forEach(b => { b.textContent = shown ? 'Bekijk' : 'Draai nu'; });
    if (countdown) countdown.textContent = fmt(left);
    if (!s && dialog.open && dialog.dataset.state === 'won' && !spinning) setState('ready');
  }
  refresh();
  setInterval(refresh, 1000);

  /* ---- Show the wheel automatically on the first page of a visit ---- */
  let seen = false;
  try { seen = sessionStorage.getItem(SEEN) === '1'; } catch (e) { /* ignore */ }
  const busy = () => document.querySelector('#checkout, .ty-head');
  if (!seen && !locked() && !busy()) setTimeout(() => { if (!document.querySelector('dialog[open]')) open(); }, 7000);
})();
