// Phase 24: monetization ledger tests.
// node:test only, no new dependency. Validation and
// summarization are pure; wiring checks are static,
// in the Phase 4–23 style. A live ledger entry is an
// owner step (needs a running instance), not
// something CI proves.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { validateEntryInput, summarizeEntries } = require('../src/utils/monetization');

describe('entry validation', () => {
  it('accepts a valid entry and defaults currency to PKR', () => {
    const { errors, entry } = validateEntryInput({ kind: 'revenue', category: 'sponsorship', amount: 5000 });
    assert.equal(errors.length, 0);
    assert.equal(entry.currency, 'PKR');
    assert.equal(entry.amount, 5000);
  });

  it('rejects bad kind, bad category, non-positive amount, bad currency', () => {
    assert.ok(validateEntryInput({ kind: 'gift', category: 'sponsorship', amount: 1 }).errors.length > 0);
    assert.ok(validateEntryInput({ kind: 'revenue', category: 'lottery', amount: 1 }).errors.length > 0);
    assert.ok(validateEntryInput({ kind: 'revenue', category: 'sponsorship', amount: 0 }).errors.length > 0);
    assert.ok(validateEntryInput({ kind: 'revenue', category: 'sponsorship', amount: 1, currency: 'PK' }).errors.length > 0);
  });
});

describe('summaries', () => {
  it('nets per currency only, never across currencies', () => {
    const out = summarizeEntries([
      { kind: 'revenue', category: 'sponsorship', amount: 100, currency: 'PKR', platform: 'instagram' },
      { kind: 'cost', category: 'ai_cost', amount: 30, currency: 'PKR', platform: null },
      { kind: 'revenue', category: 'affiliate', amount: 10, currency: 'USD', platform: 'youtube' },
    ]);
    assert.equal(out.netByCurrency.PKR, 70);
    assert.equal(out.netByCurrency.USD, 10);
    assert.equal(out.byPlatform.instagram, 100);
    assert.equal(out.byCategory.sponsorship, 100);
  });
});

describe('monetization wiring (static)', () => {
  const monetizationJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'monetization.js'), 'utf8');
  const indexJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');
  const frontendJs = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'App.js'), 'utf8');

  it('ledger endpoints, table, and mount exist', () => {
    assert.match(monetizationJs, /\/summary/);
    assert.match(indexJs, /CREATE TABLE IF NOT EXISTS monetization_entries/);
    assert.match(indexJs, /api\/monetization/);
  });

  it('monetization view is reachable from the nav', () => {
    assert.match(frontendJs, /api\/monetization/);
    assert.match(frontendJs, /MonetizationView/);
    assert.match(frontendJs, /Record an entry/);
  });
});
