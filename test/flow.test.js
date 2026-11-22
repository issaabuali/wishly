'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
fs.rmSync(process.env.WISHLY_DB || '/tmp/wishly-test.json', { force: true });
const server = require('../server');
const { recommend } = require('../lib/recommend');
const catalog = require('../data/catalog.json');

let base;
test.before(() => new Promise((r) => server.listen(0, () => { base = 'http://localhost:' + server.address().port; r(); })));
test.after(() => server.close());
const call = async (m, p, b, h) => { const r = await fetch(base + p, { method: m, headers: { 'Content-Type': 'application/json', ...h }, body: b ? JSON.stringify(b) : undefined }); return { s: r.status, j: await r.json() }; };

test('Arabic + English story matching, within budget', () => {
  const rec = (statement, price) => recommend({ catalog, packagePrice: price, area: 'abu-dhabi', statement, locale: 'en' });
  const en = rec('I love nature and art. I always wanted to learn watercolor painting', 349).map((r) => r.itemId);
  assert.ok(en.includes('i01') || en.includes('i02'));
  const ar = rec('أحب الطبيعة والفن، وكنت أحلم بتعلم الرسم بالألوان المائية', 349).map((r) => r.itemId);
  assert.ok(ar.includes('i01') || ar.includes('i02'));
  for (const r of rec('anything', 199)) assert.ok(catalog.items.find((i) => i.id === r.itemId).minPrice <= 199);
  assert.strictEqual(rec('art', 349).length, 3);
});

test('full journey with privacy guarantees', async () => {
  const o = (await call('POST', '/api/orders', { packageId: 'thoughtful', area: 'abu-dhabi', senderName: 'Sara', recipient: { name: 'Lina' }, message: 'Happy birthday' })).j;
  const tok = o.recipientToken;
  assert.ok(tok.length >= 32);

  let s = (await call('GET', '/api/track/' + o.senderToken)).j;
  assert.strictEqual(s.status, 'invited');
  let g = (await call('GET', '/api/gift/' + tok)).j;
  assert.strictEqual(JSON.stringify(g).includes('349'), false, 'recipient must not see price');

  assert.strictEqual((await call('POST', `/api/gift/${tok}/story`, { text: 'I love art', consent: false })).s, 400);
  g = (await call('POST', `/api/gift/${tok}/story`, { text: 'I love nature and art and painting, quiet places', consent: true })).j;
  assert.strictEqual(g.options.length, 3);

  const alt = (await call('POST', `/api/gift/${tok}/alternatives`, {})).j;
  assert.strictEqual(alt.options.some((x) => g.options.some((y) => y.id === x.id)), false, 'alternatives are new');

  const exp = alt.options.find((x) => x.type === 'experience') || g.options.find((x) => x.type === 'experience');
  const phys = alt.options.find((x) => x.type === 'physical');
  assert.strictEqual((await call('POST', `/api/gift/${tok}/choose`, { itemId: phys.id })).s, 400, 'address required');
  const c = (await call('POST', `/api/gift/${tok}/choose`, { itemId: phys.id, address: { line: 'Corniche', phone: '0500000000' } })).j;
  assert.strictEqual(c.selected.id, phys.id);

  s = (await call('GET', '/api/track/' + o.senderToken)).j;
  assert.strictEqual(s.status, 'selected');
  const leak = JSON.stringify(s);
  assert.ok(!leak.includes('painting') && !leak.includes('Corniche') && s.sharedStory === null, 'sender never sees story/address');

  assert.strictEqual((await call('GET', '/api/admin/orders')).s, 401);
  const A = { Authorization: 'Bearer wishly-dev-admin' };
  await call('POST', `/api/admin/orders/${o.orderId}/status`, { status: 'delivered' }, A);
  s = (await call('GET', '/api/track/' + o.senderToken)).j;
  assert.strictEqual(s.status, 'delivered');
  assert.strictEqual((await call('GET', '/api/gift/nope')).s, 404);
});
