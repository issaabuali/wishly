'use strict';
// Recommendation engine. Deterministic, catalog-constrained (proposal §04, §08):
// the model never invents items, prices, stock or ETAs. An LLM provider can be
// plugged in via `rerank` later; its output is validated against the catalog ids.

const STOP = new Set(['i', 'a', 'an', 'the', 'and', 'or', 'to', 'of', 'in', 'my', 'me', 'but', 'never', 'always', 'have', 'had', 'love', 'make', 'makes', 'me', 'quiet', 'places', 'time', 'happy', 'wanted', 'want']);

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '') // tashkeel + tatweel
    .replace(/[إأآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ');
}

function tokens(text) {
  return normalize(text).split(/\s+/).filter(Boolean);
}

// Arabic prefixes (و ب ل ك ف ال) are stripped for loose matching.
function stemAr(w) {
  return w.replace(/^(وال|بال|كال|فال|لل|ال|و|ب|ل|ف)/, '');
}

function matchTags(item, toks) {
  const set = new Set(toks);
  const stems = new Set(toks.map(stemAr));
  const hits = [];
  for (const t of item.tags.en) if (set.has(normalize(t))) hits.push(t);
  for (const t of item.tags.ar) {
    const n = normalize(t);
    if (set.has(n) || stems.has(stemAr(n))) hits.push(t);
  }
  return hits;
}

/**
 * @param {object} o {catalog, packagePrice, area, statement, answers, preference, exclude, locale, count}
 */
function recommend(o) {
  const count = o.count || 3;
  const toks = tokens([o.statement, ...(o.answers || [])].join(' '));
  const exclude = new Set(o.exclude || []);
  const eligible = o.catalog.items.filter(
    (it) =>
      it.minPrice <= o.packagePrice && // cost ceiling
      it.areas.includes(o.area) && // delivery area
      it.stock > 0 && // availability
      !exclude.has(it.id) &&
      (!o.preference || o.preference === 'any' || it.type === o.preference)
  );

  const scored = eligible
    .map((it) => {
      const hits = matchTags(it, toks);
      // prefer items that use the package well (closer to ceiling) as tie-break
      const fit = it.minPrice / o.packagePrice;
      return { it, hits, score: hits.length * 10 + fit };
    })
    .sort((a, b) => b.score - a.score);

  // Diversity: three genuinely different options -> mix physical/experience when possible.
  const picked = [];
  for (const s of scored) {
    if (picked.length >= count) break;
    if (picked.some((p) => p.it.id === s.it.id)) continue;
    if (picked.length === count - 1 && picked.every((p) => p.it.type === s.it.type) && o.preference !== s.it.type) {
      const other = scored.find((x) => x.it.type !== s.it.type && !picked.some((p) => p.it.id === x.it.id));
      if (other) { picked.push(other); continue; }
    }
    picked.push(s);
  }

  return picked.map((p) => ({
    itemId: p.it.id,
    matched: p.hits,
    reason: reason(p, o.locale),
  }));
}

function reason(p, locale) {
  const ar = locale === 'ar';
  if (p.hits.length) {
    // only claim what the recipient explicitly said (no psychological inference)
    const words = [...new Set(p.hits.filter((h) => (ar ? /[؀-ۿ]/.test(h) : !/[؀-ۿ]/.test(h))))].slice(0, 2);
    if (words.length) return ar ? `لأنك ذكرتَ: ${words.join('، ')}` : `Because you mentioned: ${words.join(', ')}`;
  }
  return ar ? 'فكرة جديدة قد تعجبك' : 'A fresh idea you might enjoy';
}

module.exports = { recommend, normalize, tokens };
