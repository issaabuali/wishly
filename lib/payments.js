'use strict';
// Payment provider adapter. MVP ships a sandbox provider only; a real provider
// (Stripe / Network International / Telr...) implements the same `charge` shape.
module.exports = {
  name: 'sandbox',
  async charge({ amount, currency }) {
    return { ok: true, ref: 'sbx_' + Math.random().toString(36).slice(2, 10), amount, currency };
  },
};
