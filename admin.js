const $ = s => document.querySelector(s);
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const jf = async (m, u, b) => {
  const r = await fetch(u, {method: m, headers: {'Content-Type': 'application/json'}, body: b ? JSON.stringify(b) : undefined});
  let j = {}; try { j = await r.json(); } catch {}
  return {ok: r.ok, status: r.status, j};
};
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
let data, unsaved = false;
const dirty = () => { unsaved = true; $('#msg').textContent = 'Unsaved changes'; };
window.onbeforeunload = e => { if (unsaved) { e.preventDefault(); e.returnValue = ''; } };
const btn = (t, f, c = 'sm') => { const b = el('button', c, t); b.type = 'button'; b.onclick = f; return b; };
function move(arr, i, d) { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; dirty(); render(); }

// ----- photo upload (shrinks big photos first) -----
async function shrink(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Please choose a JPG, PNG or WEBP photo');
  const bmp = await createImageBitmap(file), k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
}
function uploadBtn(done) {
  const f = el('input'); f.type = 'file'; f.accept = 'image/jpeg,image/png,image/webp'; f.hidden = true;
  f.onchange = async () => {
    const file = f.files[0]; if (!file) return;
    try {
      $('#msg').textContent = 'Uploading…';
      const r = await fetch('/api/upload', {method: 'POST', headers: {'Content-Type': 'image/jpeg'}, body: await shrink(file)});
      const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Upload failed');
      done(j.url); $('#msg').textContent = 'Photo uploaded — now click Save changes';
    } catch (e) { $('#msg').textContent = e.message || 'Upload failed'; }
    f.value = '';
  };
  const w = el('span', 'up'); w.append(btn('Upload', () => f.click()), f); return w;
}

// ----- form helpers -----
function field(p, label, obj, key, o = {}) {
  const w = el('label', 'f'); w.append(el('span', null, label));
  const i = el(o.area ? 'textarea' : 'input'); if (!o.area) i.type = o.type || 'text'; if (o.type === 'number') i.step = 'any';
  i.value = obj[key] ?? ''; i.oninput = () => { obj[key] = o.type === 'number' ? Number(i.value) : i.value; dirty(); };
  w.append(i); p.append(w);
  if (o.upload) p.append(uploadBtn(u => { i.value = u; obj[key] = u; dirty(); }));
}
function check(p, label, obj, key, cls = 'chk') {
  const w = el('label', cls), i = el('input'); i.type = 'checkbox'; i.checked = !!obj[key];
  i.onchange = () => { obj[key] = i.checked; dirty(); };
  w.append(i, document.createTextNode(' ' + label)); p.append(w);
}
function rowFor(arr, i, fields) {
  const r = el('div', 'row'); let t;
  if (fields.some(f => f[0] === 'image')) {
    t = el('img', 'thumb'); t.alt = ''; t.referrerPolicy = 'no-referrer'; t.style.visibility = 'hidden';
    t.onload = () => t.style.visibility = 'visible'; t.onerror = () => t.style.visibility = 'hidden';
    if (arr[i].image) t.src = arr[i].image; r.append(t);
  }
  fields.forEach(([k, ph, w]) => {
    if (k === 'status') {
      const s = el('select'); [['', 'In stock'], ['new', 'New'], ['soldout', 'Sold out']].forEach(([v, l]) => { const o = el('option', null, l); o.value = v; s.append(o); });
      s.value = arr[i].status || ''; s.onchange = () => { arr[i].status = s.value; dirty(); }; r.append(s); return;
    }
    if (k === 'featured') { check(r, ph, arr[i], k); return; }
    const n = el('input'); n.placeholder = ph; n.value = arr[i][k] ?? ''; n.style.flex = w || 1;
    n.oninput = () => { arr[i][k] = n.value; if (k === 'image' && t) { t.style.visibility = 'hidden'; if (n.value.trim()) t.src = n.value.trim(); } dirty(); };
    r.append(n);
    if (k === 'image') r.append(uploadBtn(u => { n.value = u; arr[i].image = u; t.style.visibility = 'hidden'; t.src = u; dirty(); }));
  });
  r.append(btn('↑', () => move(arr, i, -1)), btn('↓', () => move(arr, i, 1)),
    btn('✕', () => { if (confirm('Delete this?')) { arr.splice(i, 1); dirty(); render(); } }));
  return r;
}

// ----- dashboard: one tab per section -----
const TABS = [['home', 'Dashboard'], ['res', 'Reservations'], ['rev', 'Reviews'], ['shop', 'Shop details'], ['brand', 'Logo & social'],
  ['banner', 'Banner'], ['hours', 'Opening hours'], ['prod', 'Products'], ['gal', 'Gallery'], ['notify', 'Alerts'], ['backup', 'Backup'], ['pw', 'Password']];
let tab = (location.hash || '').slice(1); if (!TABS.some(t => t[0] === tab)) tab = 'home';
const inboxData = {res: null, rev: null};
const tabsEl = el('div', 'tabs'), content = el('div');
const nNew = () => inboxData.res ? inboxData.res.filter(r => !r.done).length : null;
const nWait = () => inboxData.rev ? inboxData.rev.filter(r => !r.approved).length : null;
const sec = t => { const p = el('section', 'panel'); p.append(el('h2', null, t)); return p; };

function drawTabs() {
  tabsEl.replaceChildren();
  TABS.forEach(([k, l]) => {
    const b = el('button', 'tab' + (k === tab ? ' on' : ''), l); b.type = 'button';
    const n = k === 'res' ? nNew() : k === 'rev' ? nWait() : 0;
    if (n) b.append(el('span', 'count', n));
    b.onclick = () => showTab(k); tabsEl.append(b);
  });
}
function drawContent() {
  const panels = {home: homePanel, res: resPanel, rev: revPanel, shop: shopPanel, brand: brandPanel, banner: bannerPanel, hours: hoursPanel, prod: prodPanel, gal: galPanel, notify: notifyPanel, backup: backupPanel, pw: pwPanel};
  try { content.replaceChildren(panels[tab]()); }
  catch (e) { const p = sec('Something went wrong'); p.append(el('p', 'muted', 'This tab could not open: ' + e.message + '. Make sure server.js is the newest version and the server was restarted.')); content.replaceChildren(p); }
}
function render() { drawTabs(); drawContent(); }
function showTab(k) { tab = k; try { history.replaceState(null, '', '#' + k); } catch {} window.scrollTo(0, 0); render(); }

function homePanel() {
  const p = sec('Dashboard'), items = data.categories.flatMap(c => c.items);
  const gone = i => i.status === 'soldout' || (i.stock !== '' && i.stock != null && Number(i.stock) <= 0);
  const low = i => i.stock !== '' && i.stock != null && Number(i.stock) > 0 && Number(i.stock) <= 3;
  const stat = (n, label, key, hot) => {
    const b = el('button', 'stat' + (hot ? ' hot' : '')); b.type = 'button';
    b.append(el('strong', null, n == null ? '…' : String(n)), el('span', null, label)); b.onclick = () => showTab(key); return b;
  };
  const g = el('div', 'stats');
  g.append(stat(nNew(), 'New reservations', 'res', nNew() > 0), stat(nWait(), 'Reviews waiting', 'rev', nWait() > 0),
    stat(items.length, 'Products', 'prod'), stat(items.filter(gone).length, 'Sold out', 'prod'), stat(items.filter(low).length, 'Low stock (3 or less)', 'prod'), stat(items.filter(i => i.oldPrice).length, 'On offer', 'prod'),
    stat(items.filter(i => i.featured).length, 'Featured', 'prod'), stat(data.gallery.length, 'Gallery photos', 'gal'));
  const a = el('a', 'btn', 'View website'); a.href = 'index.html'; a.target = '_blank'; a.rel = 'noopener';
  p.append(g, a, el('p', 'muted', 'Changes in Shop details, Banner, Opening hours, Products and Gallery go live when you click “Save changes” at the bottom. Reservations and reviews update straight away.'));
  return p;
}

function resPanel() {
  const list = inboxData.res, p = sec(`Reservations${nNew() ? ` (${nNew()} new)` : ''}`);
  if (!list) { p.append(el('p', 'muted', 'Loading…')); return p; }
  if (!list.length) p.append(el('p', 'muted', 'No reservations yet.'));
  else { const dl = el('a', 'btn', 'Download as spreadsheet (CSV)'); dl.href = '/api/reservations.csv'; dl.download = 'reservations.csv'; dl.style.cssText = 'display:inline-block;margin-bottom:14px'; p.append(dl); }
  list.forEach(r => {
    const c = el('div', 'cat' + (r.done ? ' done' : '')), ph = el('a', null, ' · ' + r.phone);
    ph.href = 'tel:' + r.phone.replace(/[^\d+]/g, '');
    c.append(el('strong', null, r.name), ph, el('p', 'muted', new Date(r.date).toLocaleString()), el('p', 'pre', r.items),
      btn(r.done ? 'Mark as new' : 'Mark as done', async () => { await jf('POST', '/api/reservations/update', {id: r.id, action: r.done ? 'undo' : 'done'}); loadInbox(); }),
      btn('Delete', async () => { if (confirm('Delete this reservation?')) { await jf('POST', '/api/reservations/update', {id: r.id, action: 'delete'}); loadInbox(); } }));
    p.append(c);
  });
  return p;
}

function revPanel() {
  const list = inboxData.rev, p = sec(`Customer reviews${nWait() ? ` (${nWait()} waiting for approval)` : ''}`);
  if (!list) { p.append(el('p', 'muted', 'Loading…')); return p; }
  if (!list.length) p.append(el('p', 'muted', 'No reviews yet.'));
  list.forEach(r => {
    const c = el('div', 'cat');
    c.append(el('strong', null, r.name + '  ' + '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating)),
      el('p', 'muted', new Date(r.date).toLocaleString() + (r.approved ? ' · shown on the website' : ' · waiting for approval')), el('p', 'pre', r.text));
    if (!r.approved) c.append(btn('Approve', async () => { await jf('POST', '/api/admin/reviews', {id: r.id, action: 'approve'}); loadInbox(); }));
    else c.append(btn('Hide', async () => { await jf('POST', '/api/admin/reviews', {id: r.id, action: 'hide'}); loadInbox(); }));
    c.append(btn('Delete', async () => { if (confirm('Delete this review?')) { await jf('POST', '/api/admin/reviews', {id: r.id, action: 'delete'}); loadInbox(); } }));
    p.append(c);
  });
  return p;
}

function shopPanel() {
  const a = sec('Shop details'), s = data.shop;
  [['Shop name', 'name'], ['Headline', 'tagline', {area: 1}], ['Headline (Albanian, optional)', 'tagline_sq', {area: 1}],
   ['Intro text', 'intro', {area: 1}], ['Intro text (Albanian, optional)', 'intro_sq', {area: 1}],
   ['Home page photo (upload, or paste a link)', 'heroImage', {upload: 1}],
   ['About us', 'about', {area: 1}], ['About us (Albanian, optional)', 'about_sq', {area: 1}],
   ['Address', 'address', {area: 1}], ['Phone', 'phone'], ['WhatsApp number (country code, digits only, e.g. 355691234567)', 'whatsapp'],
   ['Email', 'email'], ['Minimum age', 'minAge', {type: 'number'}], ['Map latitude', 'lat', {type: 'number'}], ['Map longitude', 'lng', {type: 'number'}]]
    .forEach(([l, k, o]) => field(a, l, s, k, o));
  return a;
}
function brandPanel() {
  const a = sec('Logo & social media'), s = data.shop;
  field(a, 'Logo (upload, or paste a link). Also used as the browser tab icon.', s, 'logo', {upload: 1});
  field(a, 'Instagram link', s, 'instagram'); field(a, 'Facebook link', s, 'facebook'); field(a, 'TikTok link', s, 'tiktok');
  return a;
}
function bannerPanel() {
  const a = sec('Announcement banner'), s = data.shop;
  check(a, 'Show the banner at the top of every page', s, 'announceOn');
  field(a, 'Banner text', s, 'announce', {area: 1}); field(a, 'Banner text (Albanian, optional)', s, 'announce_sq', {area: 1});
  return a;
}
function hoursPanel() {
  const a = sec('Opening hours'), s = data.shop;
  field(a, 'Time zone (used for "Open now"), e.g. Europe/Tirane', s, 'timezone');
  s.schedule.forEach((d, i) => {
    const r = el('div', 'row'); r.append(el('strong', 'day', DAYS[i]));
    ['open', 'close'].forEach(k => { const n = el('input'); n.type = 'time'; n.value = d[k]; n.oninput = () => { d[k] = n.value; dirty(); }; r.append(n); });
    check(r, 'Closed', d, 'closed'); a.append(r);
  });
  a.append(el('h3', null, 'Closed on specific dates'), el('p', 'muted', 'Holidays or days off. “Open now” shows Closed on these dates, and visitors see the upcoming ones.'));
  s.closedDates.forEach((c, i) => {
    const r = el('div', 'row'), d = el('input'), n = el('input');
    d.type = 'date'; d.value = c.date; d.oninput = () => { c.date = d.value; dirty(); };
    n.placeholder = 'Note (optional), e.g. Holiday'; n.value = c.note || ''; n.oninput = () => { c.note = n.value; dirty(); };
    r.append(d, n, btn('✕', () => { s.closedDates.splice(i, 1); dirty(); render(); })); a.append(r);
  });
  a.append(btn('+ Add a closed date', () => { s.closedDates.push({date: '', note: ''}); dirty(); render(); }, 'btn sm'));
  return a;
}
function prodPanel() {
  const a = sec('Products');
  a.append(el('p', 'muted', 'Tip: fill “Old price” to show an offer (old price crossed out). When “Stock” reaches 0 the product shows as Sold out automatically; 1 to 3 shows “Only N left”.'));
  data.categories.forEach((c, ci) => {
    const box = el('div', 'cat');
    field(box, 'Category name', c, 'name'); field(box, 'Short description (shown on home page)', c, 'blurb');
    c.items.forEach((_, i) => box.append(rowFor(c.items, i, [['name', 'Product', 2], ['desc', 'Short description', 3], ['details', 'Full details (shown when clicked)', 3], ['price', 'Price'], ['oldPrice', 'Old price (for an offer)'], ['stock', 'Stock (empty = not counted)'], ['status', 'Status'], ['featured', 'Featured'], ['image', 'Photo link or upload', 2]])));
    const top = el('div', 'row');
    top.append(btn('↑', () => move(data.categories, ci, -1)), btn('↓', () => move(data.categories, ci, 1)),
      btn('Delete category', () => { if (confirm('Delete this category and all its products?')) { data.categories.splice(ci, 1); dirty(); render(); } }));
    box.append(btn('+ Add product', () => { c.items.push({name: '', desc: '', details: '', price: '', oldPrice: '', stock: '', image: '', status: '', featured: false}); dirty(); render(); }, 'btn sm'), top);
    a.append(box);
  });
  a.append(btn('+ Add category', () => { data.categories.push({name: 'New category', blurb: '', items: []}); dirty(); render(); }, 'btn sm'));
  return a;
}
function galPanel() {
  const a = sec('Gallery photos');
  data.gallery.forEach((_, i) => a.append(rowFor(data.gallery, i, [['image', 'Photo link or upload', 2], ['caption', 'Caption', 2]])));
  a.append(btn('+ Add photo', () => { data.gallery.push({image: '', caption: ''}); dirty(); render(); }, 'btn sm'));
  return a;
}
function pwPanel() {
  const a = sec('Change admin password');
  const pw = (label, ac) => { const w = el('label', 'f'), i = el('input'); i.type = 'password'; i.autocomplete = ac; w.append(el('span', null, label), i); a.append(w); return i; };
  const cur = pw('Current password', 'current-password'), n1 = pw('New password (10 or more characters)', 'new-password'), n2 = pw('New password again', 'new-password');
  const m = el('p', 'muted');
  a.append(btn('Change password', async () => {
    if (n1.value !== n2.value) { m.textContent = 'The new passwords do not match'; return; }
    const r = await jf('POST', '/api/password', {current: cur.value, next: n1.value});
    m.textContent = r.ok ? 'Password changed. Use it next time you log in.' : (r.j.error || 'Could not change the password');
    if (r.ok) cur.value = n1.value = n2.value = '';
  }, 'btn sm'), m);
  return a;
}

// ----- alerts (email / WhatsApp) -----
let notifyCfg = null;
function notifyPanel() {
  const p = sec('Alerts for new reservations');
  p.append(el('p', 'muted', 'Get a message when a customer sends a reservation or a review. These details are stored privately on the server and never shown on the website.'));
  if (!notifyCfg) {
    jf('GET', '/api/notify').then(r => { notifyCfg = r.j; if (tab === 'notify') drawContent(); });
    p.append(el('p', 'muted', 'Loading…')); return p;
  }
  const c = notifyCfg;
  const nf = (label, key, type = 'text', ph = '') => {
    const w = el('label', 'f'), i = el('input'); i.type = type; i.value = (type === 'password' ? '' : c[key]) ?? ''; i.placeholder = ph;
    i.oninput = () => { c[key] = i.value; }; w.append(el('span', null, label), i); p.append(w);
  };
  p.append(el('h3', null, 'Email'), el('p', 'muted', 'Gmail: host smtp.gmail.com, port 465, and use an App Password (Google account → Security → App passwords), not your normal password.'));
  nf('SMTP host', 'smtpHost', 'text', 'smtp.gmail.com'); nf('SMTP port', 'smtpPort', 'number', '465');
  nf('Email login (your email address)', 'smtpUser'); nf('Email password', 'smtpPass', 'password', c.hasPass ? 'Saved — leave empty to keep it' : '');
  nf('Send alerts to (email address)', 'emailTo');
  p.append(el('h3', null, 'WhatsApp (free, with CallMeBot)'), el('p', 'muted', 'Do the one-minute setup on callmebot.com (WhatsApp section) to get your key. It sends the alert to your own WhatsApp.'));
  nf('Your WhatsApp number (country code, digits only)', 'waPhone'); nf('CallMeBot key', 'waKey', 'password', c.hasKey ? 'Saved — leave empty to keep it' : '');
  const m = el('p', 'muted');
  p.append(btn('Save', async () => {
    const r = await jf('POST', '/api/notify', c); m.textContent = r.ok ? 'Saved. Now click “Send test alert”.' : (r.j.error || 'Could not save');
    if (r.ok) { c.hasPass = c.hasPass || !!c.smtpPass; c.hasKey = c.hasKey || !!c.waKey; }
  }, 'btn sm'), btn('Send test alert', async () => {
    m.textContent = 'Sending…'; const r = await jf('POST', '/api/notify/test');
    const l = (r.j.results || []).map(x => x.channel + ': ' + (x.ok ? 'sent ✓' : 'failed — ' + x.error));
    m.textContent = r.ok ? (l.length ? l.join('   ·   ') : 'Nothing is set up yet. Fill in email or WhatsApp and click Save first.') : (r.j.error || 'Test failed');
  }, 'btn sm'), m);
  return p;
}

// ----- backup & restore -----
function backupPanel() {
  const p = sec('Backup & restore');
  p.append(el('p', 'muted', 'Download one file with all your shop content, reservations and reviews. Uploaded photo files are not inside it, so also copy the “public/uploads” folder now and then.'));
  const a = el('a', 'btn', 'Download backup'); a.href = '/api/backup'; a.download = ''; p.append(a);
  p.append(el('h3', null, 'Restore from a backup file'), el('p', 'muted', 'This replaces your current content, reservations and reviews with the file’s. A safety copy of the current content is made first.'));
  const f = el('input'); f.type = 'file'; f.accept = '.json,application/json'; const m = el('p', 'muted');
  f.onchange = async () => {
    const file = f.files[0]; if (!file) return;
    if (!confirm('Replace everything with this backup?')) { f.value = ''; return; }
    try {
      const r = await jf('POST', '/api/restore', JSON.parse(await file.text()));
      if (!r.ok) throw new Error(r.j.error || 'Restore failed');
      unsaved = false; await load(); $('#msg').textContent = 'Backup restored ✓';
    } catch (e) { m.textContent = 'Could not restore: ' + e.message; }
    f.value = '';
  };
  p.append(f, m); return p;
}

// ----- reservations & reviews come from the server (they don't need "Save") -----
async function loadInbox(quiet) {
  const [rs, rv] = await Promise.all([jf('GET', '/api/reservations'), jf('GET', '/api/admin/reviews')]);
  if (rs.status === 401 || rv.status === 401) return show(false);
  inboxData.res = Array.isArray(rs.j) ? rs.j : []; inboxData.rev = Array.isArray(rv.j) ? rv.j : [];
  if (!quiet || ['home', 'res', 'rev'].includes(tab)) render(); else drawTabs();   // never redraw a form while you are typing
}
setInterval(() => { if (!$('#editor').hidden) loadInbox(true); }, 60000);   // checks for new reservations every minute

function show(on) { $('#login').hidden = on; $('#editor').hidden = !on; $('#bar').hidden = !on; $('#logout').hidden = !on; }
async function load() {
  const r = await jf('GET', '/api/content'); data = r.j; data.gallery = data.gallery || []; data.shop.closedDates = data.shop.closedDates || [];
  $('#editor').replaceChildren(tabsEl, content); show(true); render(); loadInbox();
}
$('#go').onclick = async () => {
  const r = await jf('POST', '/api/login', {password: $('#pw').value});
  if (r.ok) { $('#pw').value = ''; $('#err').textContent = ''; load(); } else $('#err').textContent = r.j.error || 'Wrong password';
};
$('#pw').onkeydown = e => { if (e.key === 'Enter') $('#go').click(); };
$('#logout').onclick = async () => { await jf('POST', '/api/logout'); show(false); };
$('#save').onclick = async () => {
  const r = await jf('PUT', '/api/content', data);
  if (r.ok) { unsaved = false; $('#msg').textContent = 'Saved ✓ — live on the website'; }
  else if (r.status === 401) show(false); else $('#msg').textContent = r.j.error || 'Could not save';
};
jf('GET', '/api/session').then(r => r.j.ok ? load() : show(false));