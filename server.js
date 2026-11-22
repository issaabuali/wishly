'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const catalog = require('./data/catalog.json');
const store = require('./lib/store');
const payments = require('./lib/payments');
const { recommend } = require('./lib/recommend');
const { STATUS, FLOW } = require('./lib/messages');

const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'wishly-dev-admin';
const LINK_TTL_DAYS = 30;
const PUBLIC = path.join(__dirname, 'public');

const token = () => crypto.randomBytes(24).toString('base64url'); // 192 bits, unguessable
const now = () => new Date().toISOString();
const pkgById = (id) => catalog.packages.find((p) => p.id === id);
const itemById = (id) => catalog.items.find((i) => i.id === id);
const L = (o, lang) => (o && (o[lang] || o.en)) || '';

class HttpError extends Error { constructor(code, msg) { super(msg); this.code = code; } }

// ---- domain helpers --------------------------------------------------------
function setStatus(order, status, actor) {
  order.status = status;
  order.events.push({ at: now(), status });
  // Notification outbox: in-app timeline first; email only as a stub (WhatsApp only with consent).
  order.notifications.push({ at: now(), status, channel: 'in-app' });
  store.audit(actor, 'status:' + status, order.id);
}

function getBy(field, tok) {
  const o = store.db.orders.find((x) => x[field] === tok);
  if (!o) throw new HttpError(404, 'not_found');
  return o;
}
function getRecipientOrder(tok) {
  const o = getBy('recipientToken', tok);
  if (new Date(o.expiresAt) < new Date()) throw new HttpError(410, 'link_expired');
  return o;
}

function timeline(order, who, lang) {
  return order.events.map((e) => ({ at: e.at, status: e.status, text: L(STATUS[e.status]?.[who], lang) }));
}

function itemView(item, lang, discovery, revealed) {
  const v = { id: item.id, type: item.type, title: L(item.title, lang), desc: L(item.desc, lang) };
  // Discovery mode: show theme/description first, reveal exact details after selection.
  if (discovery && !revealed) v.desc = L(item.desc, lang).split(/[+،,]/)[0];
  if (revealed) v.details = L(item.hidden, lang);
  return v;
}

function recommendFor(order, lang, preference) {
  const shown = order.recommendations.flatMap((r) => r.itemIds);
  const recs = recommend({
    catalog,
    packagePrice: pkgById(order.packageId).price,
    area: order.area,
    statement: order.story?.text || '',
    answers: order.story?.answers || [],
    preference,
    exclude: shown,
    locale: lang,
  });
  return recs;
}

// Recipient view: never contains price, payer details or invoice.
function recipientView(order, lang) {
  const discovery = order.surpriseMode === 'discovery';
  const selected = order.selectedItemId;
  const cur = order.recommendations[order.recommendations.length - 1];
  return {
    status: order.status,
    senderName: order.senderName,
    recipientName: order.recipient.name,
    message: order.message,
    hasStory: !!order.story,
    consented: !!order.consent,
    type: selected ? itemById(selected).type : null,
    options: cur ? cur.items.map((r) => ({ ...itemView(itemById(r.itemId), lang, discovery, false), reason: r.reason[lang] || r.reason.en })) : [],
    rounds: order.recommendations.length,
    selected: selected ? itemView(itemById(selected), lang, false, true) : null,
    timeline: timeline(order, 'recipient', lang),
    bookingDate: order.bookingDate || null,
    thanked: !!order.thanks,
    senderNameForThanks: order.senderName,
  };
}

// Sender view: payment, order status and delivery confirmation only. Never the story/answers.
function senderView(order, lang) {
  const pkg = pkgById(order.packageId);
  return {
    id: order.id,
    package: { id: pkg.id, name: L(pkg.name, lang), price: pkg.price },
    payment: { status: order.payment.status, amount: order.payment.amount, currency: 'AED' },
    recipientName: order.recipient.name,
    status: order.status,
    flow: FLOW[order.selectedItemId ? itemById(order.selectedItemId).type : 'physical'],
    timeline: timeline(order, 'sender', lang),
    thankYou: order.thanks?.shared ? order.thanks.text : null,
    storyShared: !!order.storyShared,
    sharedStory: order.storyShared ? order.story : null,
    recipientLink: `/#/gift/${order.recipientToken}`,
    expiresAt: order.expiresAt,
  };
}

// ---- routes ----------------------------------------------------------------
const routes = [];
const route = (method, pattern, fn) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn });

route('GET', '/api/catalog', () => ({
  packages: catalog.packages,
  areas: catalog.areas,
}));

route('POST', '/api/orders', async ({ body }) => {
  const pkg = pkgById(body.packageId);
  if (!pkg) throw new HttpError(400, 'invalid_package');
  if (!catalog.areas.includes(body.area)) throw new HttpError(400, 'invalid_area');
  const rec = body.recipient || {};
  if (!rec.name || !String(rec.name).trim()) throw new HttpError(400, 'recipient_name_required');
  if (!body.senderName || !String(body.senderName).trim()) throw new HttpError(400, 'sender_name_required');
  const charge = await payments.charge({ amount: pkg.price, currency: 'AED' });
  if (!charge.ok) throw new HttpError(402, 'payment_failed');
  const order = {
    id: 'W-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
    createdAt: now(),
    expiresAt: new Date(Date.now() + LINK_TTL_DAYS * 864e5).toISOString(),
    recipientToken: token(),
    senderToken: token(),
    senderName: String(body.senderName).trim().slice(0, 60),
    recipient: { name: String(rec.name).trim().slice(0, 60), contact: String(rec.contact || '').slice(0, 120) },
    area: body.area,
    packageId: pkg.id,
    message: String(body.message || '').slice(0, 600),
    surpriseMode: body.surpriseMode === 'discovery' ? 'discovery' : 'reveal',
    payment: { provider: payments.name, ref: charge.ref, amount: pkg.price, status: 'paid' },
    status: null, events: [], notifications: [],
    story: null, consent: null, recommendations: [], selectedItemId: null, thanks: null,
    deliveryAddress: null,
  };
  setStatus(order, 'invited', 'sender');
  store.db.orders.push(order);
  store.audit('sender', 'order_created', order.id);
  store.save();
  return { orderId: order.id, recipientLink: `/#/gift/${order.recipientToken}`, trackLink: `/#/track/${order.senderToken}`, senderToken: order.senderToken, recipientToken: order.recipientToken };
});

route('GET', '/api/track/:tok', ({ params, lang }) => senderView(getBy('senderToken', params.tok), lang));

route('GET', '/api/gift/:tok', ({ params, lang }) => {
  const o = getRecipientOrder(params.tok);
  if (o.status === 'invited') { setStatus(o, 'started', 'recipient'); store.save(); }
  return recipientView(o, lang);
});

// Story: requires explicit consent, optional answers, editable (re-POST), skippable.
route('POST', '/api/gift/:tok/story', ({ params, body, lang }) => {
  const o = getRecipientOrder(params.tok);
  if (o.selectedItemId) throw new HttpError(409, 'already_selected');
  if (!body.consent) throw new HttpError(400, 'consent_required');
  const text = String(body.text || '').slice(0, 2000);
  const answers = (Array.isArray(body.answers) ? body.answers : []).map((a) => String(a).slice(0, 500)).filter(Boolean);
  o.story = { text, answers, lang, at: now() };
  o.consent = { at: now(), processing: true, whatsapp: !!body.whatsapp };
  o.storyShared = false; // private by default
  store.audit('recipient', 'consent_given', o.id, { whatsapp: !!body.whatsapp });
  return generate(o, lang, body.preference);
});

route('POST', '/api/gift/:tok/skip', ({ params, lang, body }) => {
  const o = getRecipientOrder(params.tok);
  if (o.selectedItemId) throw new HttpError(409, 'already_selected');
  o.consent = o.consent || { at: now(), processing: false };
  return generate(o, lang, body.preference);
});

// "Not quite you? Try again" / "show other options" / physical vs experience preference.
route('POST', '/api/gift/:tok/alternatives', ({ params, body, lang }) => {
  const o = getRecipientOrder(params.tok);
  if (o.selectedItemId) throw new HttpError(409, 'already_selected');
  if (o.recommendations.length >= 5) throw new HttpError(429, 'too_many_rounds');
  return generate(o, lang, body.preference);
});

function generate(order, lang, preference) {
  let recs = recommendFor(order, lang, preference);
  if (recs.length === 0 && preference && preference !== 'any') recs = recommendFor(order, lang, 'any');
  if (recs.length === 0) {
    // Nothing available -> human review (proposal §08)
    store.audit('system', 'needs_human_review', order.id);
    store.save();
    throw new HttpError(409, 'no_options_human_review');
  }
  // Store reasons in both locales so the UI can switch language.
  const other = lang === 'ar' ? 'en' : 'ar';
  const otherRecs = recommend({
    catalog, packagePrice: pkgById(order.packageId).price, area: order.area,
    statement: order.story?.text || '', answers: order.story?.answers || [],
    preference, exclude: order.recommendations.flatMap((r) => r.itemIds), locale: other,
  });
  const items = recs.map((r, i) => ({ itemId: r.itemId, reason: { [lang]: r.reason, [other]: otherRecs[i]?.itemId === r.itemId ? otherRecs[i].reason : r.reason } }));
  order.recommendations.push({ at: now(), itemIds: items.map((i) => i.itemId), items });
  store.audit('system', 'recommendations', order.id, { ids: items.map((i) => i.itemId) });
  store.save();
  return recipientView(order, lang);
}

route('POST', '/api/gift/:tok/choose', ({ params, body, lang }) => {
  const o = getRecipientOrder(params.tok);
  if (o.selectedItemId) throw new HttpError(409, 'already_selected');
  const cur = o.recommendations[o.recommendations.length - 1];
  if (!cur || !cur.itemIds.includes(body.itemId)) throw new HttpError(400, 'invalid_choice');
  const item = itemById(body.itemId);
  // Re-check availability at the moment of choice.
  if (item.stock <= 0) throw new HttpError(409, 'out_of_stock');
  if (item.type === 'physical') {
    const a = body.address || {};
    if (!a.line || !a.phone) throw new HttpError(400, 'address_required');
    o.deliveryAddress = { line: String(a.line).slice(0, 200), phone: String(a.phone).slice(0, 30), emirate: o.area };
  }
  item.stock -= 1; // MVP: in-memory only; persisted via admin catalog in v2
  o.selectedItemId = item.id;
  setStatus(o, 'selected', 'recipient');
  store.save();
  return recipientView(o, lang);
});

route('POST', '/api/gift/:tok/date', ({ params, body, lang }) => {
  const o = getRecipientOrder(params.tok);
  if (!o.selectedItemId || itemById(o.selectedItemId).type !== 'experience') throw new HttpError(400, 'not_an_experience');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date || '') || new Date(body.date) < new Date(new Date().toDateString())) throw new HttpError(400, 'invalid_date');
  o.bookingDate = body.date; // sender never sees the date, only high-level status
  setStatus(o, 'date_requested', 'recipient');
  store.save();
  return recipientView(o, lang);
});

route('POST', '/api/gift/:tok/thanks', ({ params, body, lang }) => {
  const o = getRecipientOrder(params.tok);
  o.thanks = { text: String(body.text || '').slice(0, 500), shared: !!body.text, at: now() };
  store.audit('recipient', 'thank_you', o.id);
  store.save();
  return recipientView(o, lang);
});

// Recipient explicitly chooses to share their story with the sender.
route('POST', '/api/gift/:tok/share-story', ({ params, body, lang }) => {
  const o = getRecipientOrder(params.tok);
  o.storyShared = !!body.share;
  store.audit('recipient', o.storyShared ? 'story_shared' : 'story_unshared', o.id);
  store.save();
  return recipientView(o, lang);
});

// Right to edit/delete: wipes the story and recommendations' inputs.
route('DELETE', '/api/gift/:tok/story', ({ params, lang }) => {
  const o = getRecipientOrder(params.tok);
  o.story = null; o.storyShared = false;
  store.audit('recipient', 'story_deleted', o.id);
  store.save();
  return recipientView(o, lang);
});

// ---- admin -------------------------------------------------------------------
function requireAdmin(req) {
  const t = (req.headers.authorization || '').replace(/^Bearer /, '');
  const a = Buffer.from(t), b = Buffer.from(ADMIN_TOKEN);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new HttpError(401, 'unauthorized');
}

route('GET', '/api/admin/orders', ({ req }) => {
  requireAdmin(req);
  return store.db.orders.map((o) => ({
    id: o.id, createdAt: o.createdAt, status: o.status, package: o.packageId, amount: o.payment.amount,
    sender: o.senderName, recipient: o.recipient.name, area: o.area,
    item: o.selectedItemId ? { id: o.selectedItemId, title: itemById(o.selectedItemId).title.en, type: itemById(o.selectedItemId).type } : null,
    address: o.deliveryAddress, bookingDate: o.bookingDate || null,
    consent: o.consent, hasStory: !!o.story, refunded: o.payment.status === 'refunded',
    nextStatuses: o.selectedItemId ? FLOW[itemById(o.selectedItemId).type].slice(FLOW[itemById(o.selectedItemId).type].indexOf(o.status) + 1) : [],
  })).reverse();
});

route('POST', '/api/admin/orders/:id/status', ({ req, params, body }) => {
  requireAdmin(req);
  const o = store.db.orders.find((x) => x.id === params.id);
  if (!o) throw new HttpError(404, 'not_found');
  if (!STATUS[body.status]) throw new HttpError(400, 'invalid_status');
  setStatus(o, body.status, 'admin');
  store.save();
  return { ok: true, status: o.status };
});

route('POST', '/api/admin/orders/:id/refund', ({ req, params }) => {
  requireAdmin(req);
  const o = store.db.orders.find((x) => x.id === params.id);
  if (!o) throw new HttpError(404, 'not_found');
  o.payment.status = 'refunded';
  store.audit('admin', 'refund', o.id);
  store.save();
  return { ok: true };
});

route('GET', '/api/admin/catalog', ({ req }) => { requireAdmin(req); return catalog; });
route('POST', '/api/admin/catalog/:id/stock', ({ req, params, body }) => {
  requireAdmin(req);
  const it = itemById(params.id);
  if (!it) throw new HttpError(404, 'not_found');
  it.stock = Math.max(0, parseInt(body.stock, 10) || 0);
  store.audit('admin', 'stock_override', null, { item: it.id, stock: it.stock });
  return { ok: true, stock: it.stock };
});
route('GET', '/api/admin/audit', ({ req }) => { requireAdmin(req); return store.db.audit.slice(-200).reverse(); });

// ---- server ------------------------------------------------------------------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };

function readBody(req) {
  return new Promise((res, rej) => {
    let d = '';
    req.on('data', (c) => { d += c; if (d.length > 1e5) { rej(new HttpError(413, 'too_large')); req.destroy(); } });
    req.on('end', () => { try { res(d ? JSON.parse(d) : {}); } catch { rej(new HttpError(400, 'bad_json')); } });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const headers = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' };
  try {
    if (url.pathname.startsWith('/api/')) {
      const r = routes.find((x) => x.method === req.method && x.re.test(url.pathname));
      if (!r) throw new HttpError(404, 'not_found');
      const params = url.pathname.match(r.re).groups || {};
      const lang = url.searchParams.get('lang') === 'ar' ? 'ar' : 'en';
      const body = ['POST', 'PUT', 'DELETE'].includes(req.method) ? await readBody(req) : {};
      const out = await r.fn({ req, params, body, lang });
      res.writeHead(200, { ...headers, 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(out));
    }
    let f = path.normalize(path.join(PUBLIC, url.pathname === '/' ? 'index.html' : url.pathname));
    if (!f.startsWith(PUBLIC) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(PUBLIC, 'index.html');
    res.writeHead(200, { ...headers, 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  } catch (e) {
    const code = e.code && Number.isInteger(e.code) ? e.code : 500;
    if (code === 500) console.error(e);
    res.writeHead(code, { ...headers, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: code === 500 ? 'server_error' : e.message }));
  }
});

if (require.main === module) server.listen(PORT, () => console.log(`Wishly running on http://localhost:${PORT}  (admin token: ${ADMIN_TOKEN === 'wishly-dev-admin' ? 'wishly-dev-admin [dev default]' : 'set'})`));
module.exports = server;
