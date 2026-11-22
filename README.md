# wishly. — bilingual (AR/EN) gifting MVP

Implements the V1 must-haves from the proposal (§07): bilingual mobile-first storefront, packages + (sandbox) payment,
unguessable expiring recipient links, sender message, open-text recipient story with consent, 3-choice recommendations
from an approved catalog, recipient choice + alternatives, status tracking with separate sender/recipient timelines,
basic admin (orders, status, refunds, stock, audit log).

    npm start        # http://localhost:3000  (admin: /#/admin, ADMIN_TOKEN env, dev default "wishly-dev-admin")
    npm test

Zero dependencies (Node >= 20). Data in `data/db.json`; catalog in `data/catalog.json` (illustrative items/prices).

Swap points: `lib/payments.js` (real PSP), `lib/store.js` (Postgres), `lib/recommend.js` (add LLM rerank; output must be
validated against catalog ids), notifications outbox (`order.notifications`) -> email/WhatsApp (consent-gated).
