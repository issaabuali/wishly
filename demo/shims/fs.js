const mem = {};
const K = (p) => 'wishly:' + p;
const get = (p) => { try { const v = localStorage.getItem(K(p)); if (v != null) return v; } catch {} return mem[p] ?? null; };
const put = (p, v) => { try { localStorage.setItem(K(p), v); } catch {} mem[p] = v; };
module.exports = {
  readFileSync(p) { const v = get(p); if (v == null) throw new Error('ENOENT'); return v; },
  writeFileSync(p, d) { put(p, d); },
  renameSync(a, b) { put(b, get(a)); },
  existsSync: () => false, statSync: () => ({ isDirectory: () => false }), createReadStream() {},
};
