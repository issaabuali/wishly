module.exports = { createServer(h) { globalThis.__handler = h; return { listen() {}, address() { return {}; }, close() {} }; } };
