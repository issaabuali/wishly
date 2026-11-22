const server = require('../server.js'); // registers handler via http shim
window.fetch = async (url, opts = {}) => {
  const u = new URL(url, 'http://x');
  const body = opts.body || '';
  const req = { method: opts.method || 'GET', url: u.pathname + u.search, headers: Object.fromEntries(Object.entries(opts.headers || {}).map(([k, v]) => [k.toLowerCase(), v])),
    on(ev, fn) { if (ev === 'data' && body) fn(body); if (ev === 'end') setTimeout(fn, 0); }, destroy() {} };
  return new Promise((resolve) => {
    let code = 200;
    const res = { writeHead(c) { code = c; }, end(d) { resolve(new Response(d, { status: code, headers: { 'Content-Type': 'application/json' } })); } };
    globalThis.__handler(req, res);
  });
};
