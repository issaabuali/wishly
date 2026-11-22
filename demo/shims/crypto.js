const { Buffer } = require('buffer');
module.exports = {
  randomBytes: (n) => {
    const b = Buffer.from(crypto.getRandomValues(new Uint8Array(n)));
    const ts = b.toString.bind(b);
    b.toString = (enc) => enc === 'base64url' ? ts('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : ts(enc);
    return b;
  },
  timingSafeEqual: (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]; return d === 0; },
};
