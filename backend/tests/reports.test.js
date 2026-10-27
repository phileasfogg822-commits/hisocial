// Phase 25: weekly report tests.
// node:test only, no new dependency. Builder and CSV
// are pure; wiring checks are static, in the Phase
// 4–24 style. A live report is an owner step (needs
// a running instance with snapshot history), not
// something CI proves.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { buildWeeklyReport, csvEscape, reportToCsv, periodFor } = require('../src/utils/reports');

describe('weekly report builder', () => {
  it('covers a 7-day period ending on the given date', () => {
    assert.deepEqual(periodFor('2026-10-28'), { start: '2026-10-22', end: '2026-10-28' });
  });

  it('rolls snapshots up per platform and into totals without double-counting', () => {
    const report = buildWeeklyReport({
      endDate: '2026-10-28',
      snapshots: [
        { platform: 'facebook', published_count: 2, failed_count: 1, posts_created: 3 },
        { platform: 'facebook', published_count: 1, failed_count: 0, posts_created: 1 },
        { platform: 'instagram', published_count: 4, failed_count: 0, posts_created: 4 },
      ],
      monetizationEntries: [
        { kind: 'revenue', category: 'sponsorship', amount: 100, currency: 'PKR', platform: 'instagram' },
        { kind: 'cost', category: 'ai_cost', amount: 30, currency: 'PKR', platform: null },
      ],
      openAlerts: [{ type: 'failure_spike', severity: 'warning', message: 'x' }],
    });
    assert.equal(report.totals.published, 7);
    assert.equal(report.totals.failed, 1);
    assert.equal(report.totals.created, 8);
    assert.equal(report.byPlatform.find((r) => r.platform === 'facebook').published, 3);
    assert.equal(report.monetization.netByCurrency.PKR, 70);
    assert.equal(report.openAlertCount, 1);
  });
});

describe('CSV export', () => {
  it('escapes commas, quotes, and newlines', () => {
    assert.equal(csvEscape('plain'), 'plain');
    assert.equal(csvEscape('a,b'), '"a,b"');
    assert.equal(csvEscape('say "hi"'), '"say ""hi"""');
    assert.equal(csvEscape('line1\nline2'), '"line1\nline2"');
  });

  it('renders period, platform, and currency sections', () => {
    const report = buildWeeklyReport({
      endDate: '2026-10-28',
      snapshots: [{ platform: 'facebook', published_count: 1, failed_count: 0, posts_created: 1 }],
      monetizationEntries: [{ kind: 'revenue', category: 'sponsorship', amount: 50, currency: 'PKR', platform: null }],
      openAlerts: [],
    });
    const csv = reportToCsv(report);
    assert.match(csv, /2026-10-22,2026-10-28,1,0,1,0/);
    assert.match(csv, /facebook,1,0,1/);
    assert.match(csv, /PKR,50/);
  });
});

describe('report wiring (static)', () => {
  const reportsJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'reports.js'), 'utf8');
  const indexJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');
  const frontendJs = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'App.js'), 'utf8');

  it('report endpoints and mount exist', () => {
    assert.match(reportsJs, /\/weekly/);
    assert.match(reportsJs, /weekly\.csv/);
    assert.match(indexJs, /api\/reports/);
  });

  it('reports view is reachable from the nav', () => {
    assert.match(frontendJs, /api\/reports\/weekly/);
    assert.match(frontendJs, /ReportsView/);
    assert.match(frontendJs, /Download CSV/);
  });
});
