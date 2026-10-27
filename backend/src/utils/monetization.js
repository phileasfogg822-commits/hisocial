// Phase 24: monetization ledger (pure).
//
// HiSocial has no payment processing and no platform
// revenue API wired in — this is a manual ledger,
// not an automated payout report. The user records
// what actually came in or went out: sponsorships,
// affiliate payouts, ad revenue, subscriptions, AI
// costs. Totals never mix currencies: every summary
// is grouped by currency, and net is computed only
// within one currency.
//
// An entry: kind 'revenue' | 'cost'; category from
// the fixed list; amount a positive number (stored
// as entered, in the entry's currency); platform
// optional (a cost like an AI subscription may have
// none); post_id optional (links revenue to a post).
const KINDS = ['revenue', 'cost'];
const CATEGORIES = ['sponsorship', 'affiliate', 'ad_revenue', 'subscription', 'ai_cost', 'other'];

function validateEntryInput(body = {}) {
  const errors = [];
  if (!KINDS.includes(body.kind)) errors.push("kind must be 'revenue' or 'cost'");
  if (!CATEGORIES.includes(body.category)) errors.push(`category must be one of: ${CATEGORIES.join(', ')}`);
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) errors.push('amount must be a positive number');
  const currency = String(body.currency || 'PKR').toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) errors.push('currency must be a 3-letter code');
  if (body.entry_date && !/^\d{4}-\d{2}-\d{2}$/.test(body.entry_date)) errors.push('entry_date must be YYYY-MM-DD');
  return { errors, entry: { kind: body.kind, category: body.category, amount, currency, platform: body.platform || null, post_id: body.post_id || null, note: body.note || null, entry_date: body.entry_date || null } };
}

// Summaries: totals per (currency, kind), per
// platform, per category, and net per currency
// (revenue minus cost, same currency only).
function summarizeEntries(entries = []) {
  const byCurrencyKind = {};
  const byPlatform = {};
  const byCategory = {};
  for (const e of entries) {
    const amount = Number(e.amount) || 0;
    const ck = `${e.currency}:${e.kind}`;
    byCurrencyKind[ck] = (byCurrencyKind[ck] || 0) + amount;
    const platform = e.platform || 'none';
    byPlatform[platform] = (byPlatform[platform] || 0) + (e.kind === 'revenue' ? amount : -amount);
    byCategory[e.category] = (byCategory[e.category] || 0) + (e.kind === 'revenue' ? amount : -amount);
  }
  const netByCurrency = {};
  for (const [ck, total] of Object.entries(byCurrencyKind)) {
    const [currency, kind] = ck.split(':');
    netByCurrency[currency] = (netByCurrency[currency] || 0) + (kind === 'revenue' ? total : -total);
  }
  return { byCurrencyKind, byPlatform, byCategory, netByCurrency };
}

module.exports = { KINDS, CATEGORIES, validateEntryInput, summarizeEntries };
