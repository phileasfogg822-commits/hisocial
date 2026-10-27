// Phase 25: weekly report builder + CSV export (pure).
//
// A weekly report rolls up one 7-day period from
// data the app already has: daily snapshots
// (Phase 21), the monetization ledger (Phase 24),
// and open alerts (Phase 23). It adds no new
// numbers — every figure traces to a row in one of
// those tables. The period is [end - 6 days, end];
// end defaults to today and must be YYYY-MM-DD.
//
// CSV export covers the same report: one section
// per platform (from snapshots) and one per
// currency (from monetization). Fields are escaped
// per RFC 4180 (quote when containing a comma,
// quote, or newline; double embedded quotes).
const { summarizeEntries } = require('./monetization');

function parseEndDate(value) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Date().toISOString().slice(0, 10);
}

function periodFor(endDate) {
  const end = new Date(`${endDate}T00:00:00Z`);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  return { start: start.toISOString().slice(0, 10), end: endDate };
}

function buildWeeklyReport({ endDate, snapshots = [], monetizationEntries = [], openAlerts = [] } = {}) {
  const period = periodFor(parseEndDate(endDate));
  const byPlatform = {};
  let published = 0;
  let failed = 0;
  let created = 0;
  for (const row of snapshots) {
    const platform = row.platform || 'unknown';
    const target = byPlatform[platform] || (byPlatform[platform] = { platform, published: 0, failed: 0, created: 0 });
    target.published += Number(row.published_count) || 0;
    target.failed += Number(row.failed_count) || 0;
    target.created += Number(row.posts_created) || 0;
    published += Number(row.published_count) || 0;
    failed += Number(row.failed_count) || 0;
    created += Number(row.posts_created) || 0;
  }
  const monetization = summarizeEntries(monetizationEntries);
  return {
    period,
    totals: { published, failed, created },
    byPlatform: Object.values(byPlatform).sort((a, b) => a.platform.localeCompare(b.platform)),
    monetization,
    openAlerts: openAlerts.map((a) => ({ type: a.type, severity: a.severity, message: a.message })),
    openAlertCount: openAlerts.length,
  };
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function reportToCsv(report) {
  const lines = [];
  lines.push(`period_start,period_end,total_published,total_failed,total_created,open_alerts`);
  lines.push([
    report.period.start, report.period.end,
    report.totals.published, report.totals.failed, report.totals.created,
    report.openAlertCount,
  ].map(csvEscape).join(','));
  lines.push('');
  lines.push('platform,published,failed,created');
  for (const row of report.byPlatform) {
    lines.push([row.platform, row.published, row.failed, row.created].map(csvEscape).join(','));
  }
  lines.push('');
  lines.push('currency,net');
  for (const [currency, net] of Object.entries(report.monetization.netByCurrency || {})) {
    lines.push([currency, net].map(csvEscape).join(','));
  }
  return lines.join('\n') + '\n';
}

module.exports = { parseEndDate, periodFor, buildWeeklyReport, csvEscape, reportToCsv };
