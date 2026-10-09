/* Discord login for the webshop. The server keeps the session in a signed cookie; this script only shows who is logged in
   (navbar and mobile menu) and asks visitors to log in before they can order. The logged-in user is cached in localStorage
   so the navbar does not flicker, and is always checked again with /api/auth/me. */
(() => {
  'use strict';
  const CACHE = 'rx-user', PENDING = 'rx-pending-add';
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const set = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } };
  const here = () => location.pathname + location.search;
  const loginUrl = back => '/api/auth/login?return=' + encodeURIComponent(back || here());
  const ICON = n => `<svg class="icon" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const DISCORD = '<svg class="icon icon-fill" aria-hidden="true"><use href="#i-discord"/></svg>';

  let user = null;
  try { user = JSON.parse(get(CACHE) || 'null'); } catch (e) { user = null; }
  const listeners = [];
  const api = { get user() { return user; }, loginUrl, require: null, ready: null };

  const OUT = '<svg class="out" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 8l-4 4 4 4M6 12h10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const accountHtml = u => `<button class="header-account" type="button" aria-haspopup="menu" aria-expanded="false" title="${esc(u.name)}"><img src="${esc(u.avatar)}" alt="" width="26" height="26" referrerpolicy="no-referrer"><span>${esc(u.name)}</span><svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    <div class="account-menu" role="menu" hidden><div class="account-head"><img src="${esc(u.avatar)}" alt="" width="40" height="40" referrerpolicy="no-referrer"><div><b>${esc(u.name)}</b><span>@${esc(u.username)}</span></div></div><a class="account-item" href="/account" role="menuitem">${ICON('user')}<span>Mijn account</span></a><a class="account-item" href="/account#bestellingen" role="menuitem">${ICON('receipt')}<span>Mijn bestellingen</span></a><button class="account-item account-out" type="button" role="menuitem" data-logout>${ICON('logout')}<span>Uitloggen</span></button></div>`;

  function paint() {
    document.querySelectorAll('[data-auth]').forEach(box => {
      if (user) {
        box.innerHTML = accountHtml(user);
        const btn = box.querySelector('.header-account'), menu = box.querySelector('.account-menu');
        btn.addEventListener('click', e => { e.stopPropagation(); const open = menu.hidden; menu.hidden = !open; btn.setAttribute('aria-expanded', String(open)); });
      } else {
        box.innerHTML = `<a class="header-login" href="${loginUrl()}" data-login>${DISCORD}<span>Inloggen</span></a>`;
      }
    });
    document.querySelectorAll('[data-auth-drawer]').forEach(box => {
      box.innerHTML = user
        ? `<a class="drawer-user" href="/account"><img src="${esc(user.avatar)}" alt="" width="40" height="40" referrerpolicy="no-referrer"><div><b>${esc(user.name)}</b><span>Mijn account en bestellingen</span></div></a><button class="drawer-out" type="button" data-logout>${OUT}<span>Uitloggen</span></button>`
        : `<a class="drawer-user" href="${loginUrl()}" data-login>${DISCORD}<div><b>Inloggen met Discord</b><span>Nodig om te bestellen</span></div></a>`;
    });
    document.querySelectorAll('a[data-login]').forEach(a => { a.href = loginUrl(); });
    document.documentElement.classList.toggle('is-user', Boolean(user));
  }

  async function logout() {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch (e) { /* the cookie expires anyway */ }
    user = null; set(CACHE, null); paint(); listeners.forEach(f => f(null));
  }

  document.addEventListener('click', e => {
    if (e.target.closest('[data-logout]')) { e.preventDefault(); logout(); return; }
    document.querySelectorAll('.account-menu:not([hidden])').forEach(m => { if (!m.contains(e.target)) { m.hidden = true; const b = m.parentNode.querySelector('.header-account'); if (b) b.setAttribute('aria-expanded', 'false'); } });
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.account-menu').forEach(m => { m.hidden = true; }); });

  /* Dialog that asks the visitor to log in first. */
  let dialog = null;
  api.require = (back, pending) => {
    if (pending) { try { sessionStorage.setItem(PENDING, JSON.stringify(pending)); } catch (e) { /* storage blocked */ } }
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.className = 'login-dialog';
      dialog.innerHTML = `<div class="login-card"><button class="login-close" type="button" data-login-close aria-label="Sluiten"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
        <span class="login-mark">${DISCORD}</span><h2>Log in met Discord</h2>
        <p>Om te bestellen log je eerst in met je Discord account. Zo weten we wie je bent en krijg je na je aankoop automatisch de Klant-rol in onze Discord server.</p>
        <a class="btn btn-primary btn-lg btn-block" data-login-go href="#">${DISCORD} Inloggen met Discord</a></div>`;
      document.body.append(dialog);
      dialog.addEventListener('click', e => { if (e.target === dialog || e.target.closest('[data-login-close]')) dialog.close(); });
    }
    dialog.querySelector('[data-login-go]').href = loginUrl(back || here());
    if (!dialog.open) dialog.showModal();
  };

  api.ready = (async () => {
    paint();
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store', credentials: 'same-origin' });
      const out = await res.json();
      user = out && out.user ? out.user : null;
      set(CACHE, user ? JSON.stringify(user) : null);
    } catch (e) { /* offline: keep what we know */ }
    paint(); listeners.forEach(f => f(user));
    return user;
  })();
  api.onChange = f => listeners.push(f);
  api.pending = () => { try { const p = JSON.parse(sessionStorage.getItem(PENDING) || 'null'); sessionStorage.removeItem(PENDING); return p; } catch (e) { return null; } };
  window.RxAuth = api;

  const q = new URLSearchParams(location.search);
  if (q.get('inloggen') && !user) {
    const msg = { mislukt: 'Inloggen met Discord is niet gelukt. Probeer het opnieuw.', geannuleerd: 'Je hebt het inloggen geannuleerd.', 'niet-beschikbaar': 'Inloggen is nog niet beschikbaar.' }[q.get('inloggen')];
    if (msg) { const t = document.createElement('div'); t.className = 'login-toast'; t.setAttribute('role', 'alert'); t.textContent = msg; document.body.append(t); setTimeout(() => t.remove(), 6000); }
  }
})();
