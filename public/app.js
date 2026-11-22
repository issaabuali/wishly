(() => {
'use strict';
const $app = document.getElementById('app');
let lang = (navigator.language || '').startsWith('ar') ? 'ar' : 'en';
try { lang = localStorage.getItem('lang') || lang; } catch {}
const t = () => I18N[lang];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => (lang === 'ar' ? `${n} د.إ` : `AED ${n}`);
const fmt = (d) => new Date(d).toLocaleString(lang === 'ar' ? 'ar-AE' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });

async function api(method, url, body, headers) {
  const r = await fetch(url + (url.includes('?') ? '&' : '?') + 'lang=' + lang, {
    method, headers: { 'Content-Type': 'application/json', ...(headers || {}) }, body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || 'generic'); e.status = r.status; throw e; }
  return j;
}
const errText = (e) => t().errors[e.message] || t().errors.generic;

function applyLang() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.getElementById('lang').textContent = lang === 'ar' ? 'English' : 'العربية';
  document.getElementById('foot').textContent = t().foot;
}
document.getElementById('lang').onclick = () => { lang = lang === 'ar' ? 'en' : 'ar'; try { localStorage.setItem('lang', lang); } catch {} applyLang(); render(); };

const set = (html) => { $app.innerHTML = html; window.scrollTo(0, 0); };
const on = (sel, ev, fn) => { const el = $app.querySelector(sel); if (el) el.addEventListener(ev, fn); return el; };
const showErr = (e) => { const el = $app.querySelector('#err'); if (el) el.textContent = errText(e); };
const steps = (n, total = 4) => `<div class="steps">${Array.from({ length: total }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div>`;

let catalogCache;
const catalog = async () => (catalogCache ||= await api('GET', '/api/catalog'));

// ---------------- Home ----------------
function home() {
  set(`<section class="hero"><small>${esc(t().tag)}</small><h1>wishly.</h1><p>${esc(t().hero)}</p>
    <a class="btn" href="#/send">${esc(t().start)}</a></section>
    <div class="row" style="gap:8px" aria-label="journey">${t().how.map((h, i) => `<span class="pill">${i + 1} · ${esc(h)}</span>`).join('')}</div>
    <div class="card cream"><p>${esc(t().idea)}</p></div>`);
}

// ---------------- Sender wizard ----------------
const draft = { packageId: null, area: 'abu-dhabi', senderName: '', recipient: { name: '', contact: '' }, message: '', surpriseMode: 'reveal' };
function sendStep(step = 1) {
  catalog().then((c) => {
    if (step === 1) {
      set(`${steps(1)}<h1>${esc(t().welcome)}</h1><p>${esc(t().budget)}</p>
        <div class="grid">${c.packages.map((p) => `<button class="pkg" data-id="${p.id}" aria-pressed="${draft.packageId === p.id}">
          <span><b>${esc(p.name[lang])}</b><br><span class="mute">${esc(p.desc[lang])}</span></span><span class="price">${money(p.price)}</span></button>`).join('')}</div>
        <p id="err" class="err" role="alert"></p><button id="next" class="btn block" ${draft.packageId ? '' : 'disabled'}>${esc(t().next)}</button>`);
      $app.querySelectorAll('.pkg').forEach((b) => b.onclick = () => { draft.packageId = b.dataset.id; sendStep(1); });
      on('#next', 'click', () => sendStep(2));
    } else if (step === 2) {
      set(`${steps(2)}<h1>${esc(t().recipient)}</h1>
        <label for="sn">${esc(t().yourName)}</label><input id="sn" autocomplete="name" value="${esc(draft.senderName)}">
        <label for="rn">${esc(t().theirName)}</label><input id="rn" value="${esc(draft.recipient.name)}">
        <label for="rc">${esc(t().theirContact)}</label><input id="rc" inputmode="email" value="${esc(draft.recipient.contact)}">
        <label for="ar">${esc(t().area)}</label><select id="ar">${c.areas.map((a) => `<option value="${a}" ${draft.area === a ? 'selected' : ''}>${esc(t().areas[a])}</option>`).join('')}</select>
        <p id="err" class="err" role="alert"></p>
        <div class="row"><button id="back" class="btn ghost">${esc(t().back)}</button><button id="next" class="btn">${esc(t().next)}</button></div>`);
      const grab = () => { draft.senderName = $app.querySelector('#sn').value; draft.recipient = { name: $app.querySelector('#rn').value, contact: $app.querySelector('#rc').value }; draft.area = $app.querySelector('#ar').value; };
      on('#back', 'click', () => { grab(); sendStep(1); });
      on('#next', 'click', () => {
        grab();
        if (!draft.senderName.trim()) return showErr({ message: 'sender_name_required' });
        if (!draft.recipient.name.trim()) return showErr({ message: 'recipient_name_required' });
        sendStep(3);
      });
    } else if (step === 3) {
      set(`${steps(3)}<h1>${esc(t().note)}</h1>
        <label for="msg">${esc(t().noteLabel)}</label><textarea id="msg" maxlength="600">${esc(draft.message)}</textarea>
        <label>${esc(t().surprise)}</label>
        <label class="check"><input type="radio" name="sm" value="reveal" ${draft.surpriseMode === 'reveal' ? 'checked' : ''}>${esc(t().reveal)}</label>
        <label class="check"><input type="radio" name="sm" value="discovery" ${draft.surpriseMode === 'discovery' ? 'checked' : ''}>${esc(t().discovery)}</label>
        <div class="row" style="margin-top:16px"><button id="back" class="btn ghost">${esc(t().back)}</button><button id="next" class="btn">${esc(t().next)}</button></div>`);
      const grab = () => { draft.message = $app.querySelector('#msg').value; draft.surpriseMode = $app.querySelector('input[name=sm]:checked').value; };
      on('#back', 'click', () => { grab(); sendStep(2); });
      on('#next', 'click', () => { grab(); sendStep(4); });
    } else {
      const p = c.packages.find((x) => x.id === draft.packageId);
      set(`${steps(4)}<h1>${esc(t().checkout)}</h1>
        <div class="card"><div class="row" style="justify-content:space-between"><span><b>${esc(p.name[lang])}</b><br><span class="mute">${esc(t().for)} ${esc(draft.recipient.name)}</span></span><span class="big">${money(p.price)}</span></div></div>
        <div class="note">${esc(t().sandbox)}</div><p id="err" class="err" role="alert"></p>
        <div class="row"><button id="back" class="btn ghost">${esc(t().back)}</button><button id="pay" class="btn">${esc(t().pay)} ${money(p.price)}</button></div>`);
      on('#back', 'click', () => sendStep(3));
      on('#pay', 'click', async (ev) => {
        ev.target.disabled = true;
        try { const o = await api('POST', '/api/orders', draft); done(o); } catch (e) { showErr(e); ev.target.disabled = false; }
      });
    }
  });
}
function done(o) {
  Object.assign(draft, { packageId: null, message: '', recipient: { name: '', contact: '' } });
  const abs = (l) => location.origin + l;
  set(`<h1>${esc(t().share)}</h1>
    <div class="card"><div class="copy"><input readonly id="lk" value="${esc(abs(o.recipientLink))}" aria-label="gift link"><button id="cp" class="btn">${esc(t().copy)}</button></div></div>
    <div class="note">${esc(t().shareNote)}</div>
    <div class="row"><a class="btn" href="${esc(o.recipientLink.replace(/^\//, ''))}">${esc(t().openGift)}</a><a class="btn green" href="${esc(o.trackLink.replace(/^\//, ''))}">${esc(t().trackGift)}</a></div>`);
  on('#cp', 'click', async (e) => { try { await navigator.clipboard.writeText($app.querySelector('#lk').value); } catch { $app.querySelector('#lk').select(); } e.target.textContent = t().copied; });
}

// ---------------- Sender tracking ----------------
function track(tok) {
  api('GET', '/api/track/' + tok).then((o) => {
    set(`<h1>${esc(t().trackTitle)} · ${esc(o.recipientName)}</h1>
      <div class="card"><div class="row" style="justify-content:space-between"><span><b>${esc(o.package.name)}</b></span><span>${money(o.package.price)} · ${esc(o.payment.status === 'refunded' ? t().refunded : t().paid)}</span></div></div>
      <ul class="tl">${o.timeline.slice().reverse().map((e) => `<li><time>${esc(fmt(e.at))}</time>${esc(e.text)}</li>`).join('')}</ul>
      ${o.thankYou ? `<div class="card cream"><b>${esc(t().thankYou)}</b><p>${esc(o.thankYou)}</p></div>` : ''}
      ${o.sharedStory ? `<div class="card cream"><p>${esc(o.sharedStory.text)}</p></div>` : ''}
      <div class="note">${esc(t().privNote)}</div>`);
  }).catch((e) => set(`<p class="err">${esc(errText(e))}</p>`));
}

// ---------------- Recipient ----------------
function gift(tok) {
  const load = (v) => v ? view(v) : api('GET', '/api/gift/' + tok).then(view).catch((e) => set(`<p class="err">${esc(errText(e))}</p>`));
  const act = (m, p, b) => api(m, '/api/gift/' + tok + p, b).then(view);
  let pref = 'any';

  function view(g) {
    if (g.selected) return chosen(g);
    if (g.options.length) return options(g);
    return story(g);
  }
  function story(g, err) {
    set(`<div class="card cream"><span class="mute">${esc(g.senderName)}</span><p class="big">${esc(t().r1)}</p>${g.message ? `<p>“${esc(g.message)}”</p>` : ''}</div>
      <div class="note">${esc(t().r2)}</div>
      <label for="st">${esc(t().r3)}</label><textarea id="st" maxlength="2000"></textarea>
      <label for="a1">${esc(t().r4)} <span class="mute">(${esc(t().optional)})</span></label><input id="a1" maxlength="500">
      <label for="pf">${esc(t().pref)}</label><select id="pf"><option value="any">${esc(t().any)}</option><option value="physical">${esc(t().physical)}</option><option value="experience">${esc(t().experience)}</option></select>
      <label class="check" style="margin-top:14px"><input type="checkbox" id="cs">${esc(t().consent)}</label>
      <p class="mute" style="font-size:13px">${esc(t().privacy)}</p><p id="err" class="err" role="alert">${esc(err || '')}</p>
      <button id="go" class="btn block">${esc(t().seeGifts)}</button>
      <p class="center"><button id="skip" class="pill">${esc(t().skip)}</button></p>`);
    const prefv = () => $app.querySelector('#pf').value;
    on('#go', 'click', (ev) => {
      ev.target.disabled = true;
      const a = $app.querySelector('#a1').value.trim();
      act('POST', '/story', { text: $app.querySelector('#st').value, answers: a ? [a] : [], consent: $app.querySelector('#cs').checked, preference: pref = prefv() })
        .catch((e) => { showErr(e); ev.target.disabled = false; });
    });
    on('#skip', 'click', () => act('POST', '/skip', { preference: pref = prefv() }).catch(showErr));
  }
  function options(g) {
    set(`<h1>${esc(t().r5)}</h1><p>${esc(t().r6)}</p>
      ${g.options.map((o, i) => `<div class="opt"><span class="tag">${esc(o.type === 'experience' ? t().experience : t().physical)}</span>
        <h3>${esc(o.title)}</h3><p>${esc(o.desc)}</p><p class="why">${esc(o.reason)}</p>
        <button class="btn choose" data-i="${i}">${esc(t().choose)}</button></div>`).join('')}
      <p id="err" class="err" role="alert"></p>
      <p class="center mute">${esc(t().r7)}<br><button id="more" class="pill" style="margin-top:8px" ${g.rounds >= 5 ? 'disabled' : ''}>${esc(t().again)}</button></p>
      ${g.hasStory ? `<p class="center"><button id="del" class="pill">${esc(t().delStory)}</button></p>` : ''}`);
    $app.querySelectorAll('.choose').forEach((b) => b.onclick = () => pick(g, g.options[+b.dataset.i]));
    on('#more', 'click', () => act('POST', '/alternatives', { preference: pref }).catch(showErr));
    on('#del', 'click', () => api('DELETE', '/api/gift/' + tok + '/story').then(() => load()));
  }
  function pick(g, o) {
    if (o.type === 'experience') return act('POST', '/choose', { itemId: o.id }).catch(showErr);
    set(`<h1>${esc(o.title)}</h1><label for="ad">${esc(t().addr)}</label><textarea id="ad" maxlength="200"></textarea>
      <label for="ph">${esc(t().phone)}</label><input id="ph" inputmode="tel" maxlength="30">
      <p id="err" class="err" role="alert"></p><div class="row"><button id="back" class="btn ghost">${esc(t().back)}</button><button id="ok" class="btn">${esc(t().choose)}</button></div>`);
    on('#back', 'click', () => options(g));
    on('#ok', 'click', () => act('POST', '/choose', { itemId: o.id, address: { line: $app.querySelector('#ad').value, phone: $app.querySelector('#ph').value } }).catch(showErr));
  }
  function chosen(g) {
    const exp = g.selected.type === 'experience';
    const needDate = exp && !g.bookingDate;
    set(`<h1>${esc(t().r8)}</h1>
      <div class="opt"><span class="tag">${esc(t().yourGift)}</span><h3>${esc(g.selected.title)}</h3><p>${esc(g.selected.details || g.selected.desc)}</p></div>
      ${needDate ? `<label for="dt">${esc(t().pickDate)}</label><input id="dt" type="date" min="${new Date().toISOString().slice(0, 10)}"><p id="err" class="err" role="alert"></p><button id="rd" class="btn">${esc(t().reqDate)}</button>` : ''}
      <ul class="tl">${g.timeline.slice().reverse().map((e) => `<li><time>${esc(fmt(e.at))}</time>${esc(e.text)}</li>`).join('')}</ul>
      <div class="card cream"><b>${esc(t().r9)}</b>${g.thanked ? '' : `<textarea id="th" placeholder="${esc(t().thanksPh)}" maxlength="500"></textarea><button id="sth" class="btn" style="margin-top:8px">${esc(t().sendThanks)}</button>`}</div>
      ${g.hasStory ? `<p class="center"><button id="shr" class="pill">${esc(t().shareStory)}</button> <button id="del" class="pill">${esc(t().delStory)}</button></p>` : ''}`);
    on('#rd', 'click', () => act('POST', '/date', { date: $app.querySelector('#dt').value }).catch(showErr));
    on('#sth', 'click', () => act('POST', '/thanks', { text: $app.querySelector('#th').value }));
    on('#shr', 'click', () => act('POST', '/share-story', { share: true }));
    on('#del', 'click', () => act('DELETE', '/story'));
  }
  load();
}

// ---------------- Admin ----------------
function admin() {
  let tok = ''; try { tok = sessionStorage.getItem('adm') || ''; } catch {}
  const H = () => ({ Authorization: 'Bearer ' + tok });
  const login = (err) => {
    set(`<h1>${esc(t().admin)}</h1><label for="tk">${esc(t().token)}</label><input id="tk" type="password" autocomplete="off"><p id="err" class="err">${esc(err || '')}</p><button id="in" class="btn">${esc(t().login)}</button>`);
    on('#in', 'click', () => { tok = $app.querySelector('#tk').value; try { sessionStorage.setItem('adm', tok); } catch {} load(); });
  };
  const load = async () => {
    try {
      const [orders, cat, audit] = await Promise.all([api('GET', '/api/admin/orders', null, H()), api('GET', '/api/admin/catalog', null, H()), api('GET', '/api/admin/audit', null, H())]);
      set(`<h1>${esc(t().admin)}</h1><h2>${esc(t().orders)} (${orders.length})</h2><div style="overflow-x:auto"><table><tr><th>ID</th><th>${esc(t().status)}</th><th>${esc(t().package)}</th><th>${esc(t().for)}</th><th>Item</th><th></th></tr>
        ${orders.map((o) => `<tr><td>${o.id}<br><span class="mute">${esc(o.sender)}</span></td><td>${o.status}${o.refunded ? ' · ' + esc(t().refunded) : ''}</td><td>${o.package}<br>${o.amount}</td>
        <td>${esc(o.recipient)}<br><span class="mute">${esc(o.area)}</span>${o.address ? `<br>${esc(o.address.line)} ${esc(o.address.phone)}` : ''}${o.bookingDate ? `<br>📅 ${esc(o.bookingDate)}` : ''}</td>
        <td>${o.item ? esc(o.item.title) + '<br>' + o.item.type : '—'}</td>
        <td>${o.nextStatuses.length ? `<select data-s="${o.id}"><option value="">${esc(t().setStatus)}</option>${o.nextStatuses.map((s) => `<option>${s}</option>`).join('')}</select>` : ''}${o.refunded ? '' : `<br><button class="pill" data-r="${o.id}">${esc(t().refund)}</button>`}</td></tr>`).join('')}</table></div>
        <h2>${esc(t().catalog)}</h2><table><tr><th>Item</th><th>Type</th><th>Min AED</th><th>Stock</th></tr>${cat.items.map((i) => `<tr><td>${esc(i.title.en)}</td><td>${i.type}</td><td>${i.minPrice}</td><td><input data-k="${i.id}" type="number" min="0" value="${i.stock}" style="width:80px;padding:4px"></td></tr>`).join('')}</table>
        <h2>${esc(t().audit)}</h2><table>${audit.slice(0, 30).map((a) => `<tr><td>${esc(fmt(a.at))}</td><td>${esc(a.actor)}</td><td>${esc(a.action)}</td><td>${esc(a.orderId || '')}</td></tr>`).join('')}</table>`);
      $app.querySelectorAll('[data-s]').forEach((s) => s.onchange = async () => { if (s.value) { await api('POST', `/api/admin/orders/${s.dataset.s}/status`, { status: s.value }, H()); load(); } });
      $app.querySelectorAll('[data-r]').forEach((b) => b.onclick = async () => { await api('POST', `/api/admin/orders/${b.dataset.r}/refund`, {}, H()); load(); });
      $app.querySelectorAll('[data-k]').forEach((i) => i.onchange = () => api('POST', `/api/admin/catalog/${i.dataset.k}/stock`, { stock: i.value }, H()));
    } catch (e) { login(errText(e)); }
  };
  tok ? load() : login();
}

// ---------------- Router ----------------
function render() {
  const h = location.hash.replace(/^#/, '') || '/';
  let m;
  if (h === '/') home();
  else if (h === '/send') sendStep(1);
  else if ((m = h.match(/^\/gift\/([\w-]+)$/))) gift(m[1]);
  else if ((m = h.match(/^\/track\/([\w-]+)$/))) track(m[1]);
  else if (h === '/admin') admin();
  else home();
}
window.addEventListener('hashchange', render);
applyLang();
render();
})();
