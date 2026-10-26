// Phase 2: real unit tests for the deduplication service.
// node:test only, no new dependency. All functions are pure, so
// these run without a database, Redis, or network.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeText,
  tokenize,
  jaccardSimilarity,
  extractContact,
  buildFingerprint,
  isDuplicateAgainstExisting,
} = require('../src/services/deduplicationService');

describe('deduplicationService', () => {
  it('normalizeText lowercases, strips URLs and punctuation, collapses spaces', () => {
    assert.equal(
      normalizeText('  Hello, WORLD! See https://example.com/x  '),
      'hello world see',
    );
  });

  it('tokenize drops tokens of length 2 or less', () => {
    assert.deepEqual(tokenize('a an the cat dog'), ['the', 'cat', 'dog']);
  });

  it('jaccardSimilarity is 1 for identical text and 0 for disjoint text', () => {
    assert.equal(jaccardSimilarity('alpha beta gamma', 'alpha beta gamma'), 1);
    assert.equal(jaccardSimilarity('alpha beta', 'gamma delta'), 0);
    assert.equal(jaccardSimilarity('', 'alpha beta'), 0);
  });

  it('jaccardSimilarity is a fraction for partial overlap', () => {
    // tokens: a={alpha,beta,gamma}, b={alpha,beta,delta} -> 2/4 = 0.5
    assert.equal(jaccardSimilarity('alpha beta gamma', 'alpha beta delta'), 0.5);
  });

  it('extractContact prefers email over URL and lowercases', () => {
    assert.equal(extractContact('Reach me at John@Example.com or https://example.com'), 'john@example.com');
    assert.equal(extractContact('Visit https://Example.com/Page'), 'https://example.com/page');
    assert.equal(extractContact('no contact here'), '');
  });

  it('buildFingerprint is stable and sensitive to each field', () => {
    const base = { content: 'hello', company: 'acme', jobTitle: 'cto', url: 'https://acme.test' };
    const again = buildFingerprint(base);
    assert.equal(buildFingerprint(base), again);
    assert.match(again, /^[0-9a-f]{64}$/);
    assert.notEqual(buildFingerprint({ ...base, content: 'different' }), again);
    assert.notEqual(buildFingerprint({ ...base, company: 'other' }), again);
  });

  it('isDuplicateAgainstExisting flags high text similarity', () => {
    const candidate = { content: 'alpha beta gamma delta epsilon', company: 'acme', jobTitle: 'cto' };
    const existing = [{ id: 'row-1', content: 'alpha beta gamma delta epsilon zeta' }];
    // 5 shared / 6 union = 0.833 >= 0.8
    const result = isDuplicateAgainstExisting(candidate, existing);
    assert.equal(result.duplicate, true);
    assert.equal(result.reason, 'text_similarity');
    assert.equal(result.similarToId, 'row-1');
  });

  it('isDuplicateAgainstExisting flags same company and role', () => {
    const candidate = { content: 'unrelated words here', company: 'Acme', jobTitle: 'CTO' };
    const existing = [{ id: 'row-2', content: 'totally different', company: 'acme', job_title: 'cto' }];
    const result = isDuplicateAgainstExisting(candidate, existing);
    assert.equal(result.duplicate, true);
    assert.equal(result.reason, 'company_role');
  });

  it('isDuplicateAgainstExisting flags a shared external contact', () => {
    const candidate = { content: 'unrelated words here', company: 'acme', jobTitle: 'cto', externalContact: 'Sam@Example.com' };
    const existing = [{ id: 'row-3', content: 'totally different', company: 'other', job_title: 'ceo', external_contact: 'sam@example.com' }];
    const result = isDuplicateAgainstExisting(candidate, existing);
    assert.equal(result.duplicate, true);
    assert.equal(result.reason, 'external_contact');
  });

  it('isDuplicateAgainstExisting returns not-duplicate for unrelated rows', () => {
    const candidate = { content: 'alpha beta gamma', company: 'acme', jobTitle: 'cto' };
    const existing = [{ id: 'row-4', content: 'one two three', company: 'other', job_title: 'ceo', url: 'https://other.test' }];
    assert.deepEqual(isDuplicateAgainstExisting(candidate, existing), { duplicate: false });
    assert.deepEqual(isDuplicateAgainstExisting(candidate, []), { duplicate: false });
  });
});
