'use strict';
const fs = require('fs');
const path = require('path');

// Minimal JSON-file store (MVP / local). Swap for Postgres behind the same API.
const FILE = process.env.WISHLY_DB || path.join(__dirname, '..', 'data', 'db.json');
let db = { orders: [], audit: [] };
try { db = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch {}

function save() {
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, FILE);
}

module.exports = {
  get db() { return db; },
  save,
  audit(actor, action, orderId, meta) {
    db.audit.push({ at: new Date().toISOString(), actor, action, orderId, meta: meta || null });
  },
};
