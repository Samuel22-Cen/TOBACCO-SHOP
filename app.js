const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const $ = id => document.getElementById(id);
let L = 'en';
try { L = localStorage.getItem('lang') || ((navigator.language || '').toLowerCase().startsWith('sq') ? 'sq' : 'en'); } catch {}
if (!D[L]) L = 'en';
document.documentElement.lang = L;
const T = (k, v) => { let s = D[L][k] ?? D.en[k] ?? k; if (typeof s !== 'string') return s; for (const x in v || {}) s = s.replace('{' + x + '}', v[x]); return s; };
const tx = (s, k) => (L === 'sq' && s[k + '_sq']) || s[k] || '';
const post = (u, b) => fetch(u, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(b)})
  .then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'error'); return j; });
const toggleLang = () => { try { localStorage.setItem('lang', L === 'en' ? 'sq' : 'en'); } catch {} location.reload(); };
const stockN = it => (it.stock === '' || it.stock == null) ? null : Number(it.stock);
const estatus = it => { const n = stockN(it); return n !== null && n <= 0 ? 'soldout' : it.status; };   // stock 0 = sold out automatically
function priceEl(it) {
  const s = el('span', 'price');
  if (estatus(it) === 'soldout') { s.textContent = T('soldout'); return s; }
  if (it.oldPrice) { s.append(el('s', 'old', it.oldPrice), document.createTextNode(' ' + it.price)); } else s.textContent = it.price;
  return s;
}
function badges(it, h) {
  const st = estatus(it), n = stockN(it);
  if (st === 'new') h.append(el('span', 'badge', T('new')));
  if (it.oldPrice && st !== 'soldout') h.append(el('span', 'badge offer', T('offer')));
  if (n !== null && n > 0 && n <= 3) h.append(el('span', 'badge low', T('low', {n})));
}
function showProduct(it) {
  const o = el('div', 'modal'), b = el('div', 'mbox'), st = estatus(it);
  const x = el('button', 'mclose', '✕'); x.type = 'button'; x.setAttribute('aria-label', T('close'));
  const close = () => { o.remove(); document.removeEventListener('keydown', esc); };
  const esc = e => { if (e.key === 'Escape') close(); };
  x.onclick = close; o.onclick = e => { if (e.target === o) close(); }; document.addEventListener('keydown', esc);
  b.append(x);
  if (it.image) { const im = el('img'); im.src = it.image; im.alt = it.name; im.referrerPolicy = 'no-referrer'; im.onerror = () => im.remove(); b.append(im); }
  const h = el('h2', null, it.name); badges(it, h);
  b.append(h, priceEl(it), el('p', 'pre', it.details || it.desc));
  if (st !== 'soldout') { const a = el('a', 'btn', T('reserve_item')); a.href = 'reserve.html?item=' + encodeURIComponent(it.name); b.append(a); }
  o.append(b); document.body.append(o); x.focus();
}
function ageGate(shop) {
  if (!shop.minAge) return;
  try { if (Number(localStorage.getItem('ageOk')) > Date.now()) return; } catch {}
  const o = el('div', 'agegate'), b = el('div', 'agebox');
  const yes = el('button', 'btn', T('age_yes', {n: shop.minAge})), no = el('button', 'btn ghost', T('age_no')), lg = el('button', 'lang', L === 'en' ? 'SQ' : 'EN');
  yes.type = no.type = lg.type = 'button'; lg.onclick = toggleLang;
  yes.onclick = () => { try { localStorage.setItem('ageOk', Date.now() + 30 * 864e5); } catch {} o.remove(); document.body.classList.remove('locked'); };
  no.onclick = () => b.replaceChildren(el('h2', null, T('age_denied')));
  b.append(el('h2', null, T('age_title', {n: shop.minAge})), el('p', 'muted', T('age_text')), yes, no, lg);
  o.append(b); document.body.append(o); document.body.classList.add('locked'); yes.focus();
}
const star = n => '★'.repeat(n) + '☆'.repeat(5 - n);
const fav = h => { document.querySelectorAll('link[rel~=icon]').forEach(n => n.remove()); const l = document.createElement('link'); l.rel = 'icon'; l.href = h; document.head.append(l); };
const DEFAULT_FAV = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🍂</text></svg>');

// "Open now" / "Closed" using the shop's own time zone, weekly hours and special closed dates
function openStatus(shop) {
  const tz = shop.timezone || 'Europe/Tirane', now0 = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', {timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false}).formatToParts(now0);
  const g = t => parts.find(p => p.type === t).value;
  const wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(g('weekday'));
  const now = (+g('hour') % 24) * 60 + +g('minute');
  const mins = s => { const [h, m] = s.split(':'); return +h * 60 + +m; };
  const ymd = new Intl.DateTimeFormat('en-CA', {timeZone: tz}).format(now0);
  const dayYmd = k => { const [y, m, d] = ymd.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + k)).toISOString().slice(0, 10); };
  const closed = new Map((shop.closedDates || []).map(c => [c.date, c.note]));
  if (closed.has(ymd)) return {open: false, text: T('closed_today') + (closed.get(ymd) ? ' · ' + closed.get(ymd) : '')};
  const d = shop.schedule[wd];
  if (!d.closed && now >= mins(d.open) && now < mins(d.close)) return {open: true, text: T('open_now', {t: d.close})};
  for (let k = 0; k < 21; k++) {
    const i = (wd + k) % 7, e = shop.schedule[i];
    if (e.closed || closed.has(dayYmd(k)) || (k === 0 && now >= mins(e.open))) continue;
    const day = k === 0 ? T('today') : k === 1 ? T('tomorrow') : T('days')[i];
    return {open: false, text: T('opens', {d: day, t: e.open})};
  }
  return {open: false, text: T('closed_now')};
}
function upcomingClosures(shop) {
  const tz = shop.timezone || 'Europe/Tirane', today = new Intl.DateTimeFormat('en-CA', {timeZone: tz}).format(new Date());
  return (shop.closedDates || []).filter(c => c.date >= today).slice(0, 5).map(c =>
    new Date(c.date + 'T12:00:00Z').toLocaleDateString(L === 'sq' ? 'sq-AL' : 'en-GB', {day: 'numeric', month: 'short', timeZone: 'UTC'}) + (c.note ? ' (' + c.note + ')' : ''));
}

fetch('/api/content').then(r => r.json()).then(({shop, categories, gallery}) => {
  ageGate(shop);
  // ----- texts -----
  document.querySelectorAll('[data-i18n]').forEach(n => n.textContent = T(n.dataset.i18n, {n: shop.minAge}));
  document.querySelectorAll('[data-ph]').forEach(n => n.placeholder = T(n.dataset.ph));
  document.querySelectorAll('[data-shop]').forEach(n => n.textContent = tx(shop, n.dataset.shop));
  const t = document.body.dataset.title;
  document.title = (t ? T(t) + ' | ' : '') + shop.name;
  if ($('yr')) $('yr').textContent = new Date().getFullYear();

  // ----- header, banner, language, logo, favicon -----
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('nav a').forEach(a => { if (a.getAttribute('href') === page) a.classList.add('active'); });
  if ($('lang')) {
    $('lang').textContent = L === 'en' ? 'SQ' : 'EN';
    $('lang').onclick = toggleLang;
  }
  if (shop.announceOn && tx(shop, 'announce') && $('banner')) { $('banner').textContent = tx(shop, 'announce'); $('banner').hidden = false; }
  if (shop.logo && $('logoImg')) { $('logoImg').src = shop.logo; $('logoImg').hidden = false; fav(shop.logo); } else fav(DEFAULT_FAV);

  // ----- footer social links + WhatsApp button -----
  if ($('social')) Object.entries({instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok'}).forEach(([k, name]) => {
    if (!shop[k]) return;
    const a = el('a', null, name); a.href = shop[k]; a.target = '_blank'; a.rel = 'noopener'; $('social').append(a);
  });
  const wa = String(shop.whatsapp || '').replace(/\D/g, '');
  if (wa) {
    const a = el('a', 'wa', T('whatsapp'));
    a.href = `https://wa.me/${wa}?text=${encodeURIComponent(T('wa_text'))}`; a.target = '_blank'; a.rel = 'noopener';
    document.body.append(a);
  }

  // ----- open / closed badge -----
  const st = openStatus(shop);
  document.querySelectorAll('.open-badge').forEach(b => { b.textContent = st.text; b.classList.toggle('is-open', st.open); b.hidden = false; });

  // ----- home page -----
  if ($('hero') && shop.heroImage) {
    const im = new Image(); im.referrerPolicy = 'no-referrer';
    im.onload = () => { $('hero').style.setProperty('--hero-img', `url("${shop.heroImage}")`); $('hero').classList.add('has-img'); };
    im.src = shop.heroImage;
  }
  if ($('cats')) categories.forEach(c => { const d = el('div', 'card'); d.append(el('h3', null, c.name), el('p', null, c.blurb)); $('cats').append(d); });
  if ($('feat')) {
    categories.forEach(c => c.items.forEach(it => {
      if (!it.featured || estatus(it) === 'soldout') return;
      const d = el('a', 'card'); d.href = 'products.html';
      if (it.image) { const im = el('img'); im.src = it.image; im.alt = it.name; im.loading = 'lazy'; im.referrerPolicy = 'no-referrer'; im.onerror = () => im.remove(); d.append(im); }
      const fh = el('h3', null, it.name); badges(it, fh); const fp = el('p'); fp.append(priceEl(it)); d.append(fh, fp); $('feat').append(d);
    }));
    if ($('feat').children.length) $('featured').hidden = false;
  }
  if ($('hours')) shop.schedule.forEach((d, i) => {
    const tr = document.createElement('tr');
    tr.append(el('td', null, T('days')[i]), el('td', null, d.closed ? T('closed') : d.open + ' – ' + d.close));
    $('hours').append(tr);
  });
  if ($('closures')) { const cl = upcomingClosures(shop); if (cl.length) { $('closures').textContent = T('closed_on') + ': ' + cl.join(', '); $('closures').hidden = false; } }
  if ($('map')) {
    const {lat, lng} = shop, d = 0.006;
    $('map').src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d}%2C${lat - d / 2}%2C${lng + d}%2C${lat + d / 2}&layer=mapnik&marker=${lat}%2C${lng}`;
    $('dir').href = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }

  // ----- reviews (home page) -----
  if ($('rvlist')) {
    fetch('/api/reviews').then(r => r.json()).then(list => {
      if (!list.length) $('rvlist').append(el('p', 'muted', T('rv_none')));
      list.forEach(r => {
        const d = el('div', 'item'), b = el('div', 'grow');
        b.append(el('h3', null, r.name), el('p', null, r.text));
        d.append(b, el('span', 'price', star(r.rating))); $('rvlist').append(d);
      });
    });
    $('rvSend').onclick = async () => {
      try {
        await post('/api/reviews', {name: $('rvName').value, rating: $('rvRating').value, text: $('rvText').value, website: $('rvHp').value});
        $('rvMsg').textContent = T('rv_thanks'); $('rvName').value = $('rvText').value = '';
      } catch { $('rvMsg').textContent = T('err'); }
    };
  }

  // ----- products page: search + category filter -----
  if ($('sections')) {
    let cat = -1, q = '';
    const secs = [], chips = [];
    const chip = (label, i) => { const b = el('button', 'chip', label); b.type = 'button'; b.onclick = () => { cat = i; apply(); }; $('chips').append(b); chips.push(b); };
    chip(T('all'), -1);
    categories.forEach((c, i) => {
      chip(c.name, i);
      const s = el('section'); s.id = 'cat-' + i; s.append(el('h2', null, c.name));
      const l = el('div', 'list'), rows = [];
      c.items.forEach(it => {
        const r = el('div', 'item clickable' + (estatus(it) === 'soldout' ? ' sold' : '')), left = el('div', 'grow');
        r.tabIndex = 0; r.setAttribute('role', 'button'); r.onclick = () => showProduct(it);
        r.onkeydown = e => { if (e.key === 'Enter') showProduct(it); };
        if (it.image) { const im = el('img', 'pimg'); im.src = it.image; im.alt = it.name; im.loading = 'lazy'; im.referrerPolicy = 'no-referrer'; im.onerror = () => im.remove(); r.append(im); }
        const h = el('h3', null, it.name); badges(it, h);
        left.append(h, el('p', null, it.desc));
        r.append(left, priceEl(it));
        rows.push([r, (it.name + ' ' + it.desc + ' ' + (it.details || '')).toLowerCase()]); l.append(r);
      });
      s.append(l); $('sections').append(s); secs.push([s, rows]);
    });
    function apply() {
      let any = false;
      secs.forEach(([s, rows], i) => {
        let n = 0;
        rows.forEach(([r, txt]) => { const show = (cat < 0 || cat === i) && txt.includes(q); r.hidden = !show; if (show) n++; });
        s.hidden = !n; if (n) any = true;
      });
      $('none').hidden = any;
      chips.forEach((b, k) => b.classList.toggle('active', k === cat + 1));
    }
    $('q').oninput = () => { q = $('q').value.trim().toLowerCase(); apply(); };
    apply();
  }

  // ----- gallery page -----
  if ($('gal')) {
    if (!gallery.length) $('gal').append(el('p', 'muted', T('gallery_empty')));
    gallery.forEach(g => {
      const f = el('figure'), im = el('img');
      im.src = g.image; im.alt = g.caption || shop.name; im.loading = 'lazy'; im.referrerPolicy = 'no-referrer';
      im.onclick = () => { const o = el('div', 'lb'), i = el('img'); i.src = g.image; o.append(i); o.onclick = () => o.remove(); document.body.append(o); };
      f.append(im); if (g.caption) f.append(el('figcaption', null, g.caption)); $('gal').append(f);
    });
  }

  // ----- reserve page -----
  const pre = new URLSearchParams(location.search).get('item'); if (pre && $('rItems')) $('rItems').value = pre.slice(0, 150);
  if ($('rSend')) $('rSend').onclick = async () => {
    try {
      await post('/api/reserve', {name: $('rName').value, phone: $('rPhone').value, items: $('rItems').value, website: $('rHp').value});
      $('rMsg').textContent = T('sent'); $('rName').value = $('rPhone').value = $('rItems').value = '';
    } catch { $('rMsg').textContent = T('err'); }
  };
});