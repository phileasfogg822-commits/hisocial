const crypto = require('crypto');

function normalizeText(input = '') {
  return String(input)
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9\s@._-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(input = '') {
  return normalizeText(input)
    .split(' ')
    .filter(Boolean)
    .filter((token) => token.length > 2);
}

function jaccardSimilarity(aText = '', bText = '') {
  const aSet = new Set(tokenize(aText));
  const bSet = new Set(tokenize(bText));
  if (aSet.size === 0 || bSet.size === 0) return 0;

  let intersection = 0;
  for (const token of aSet) {
    if (bSet.has(token)) intersection += 1;
  }
  const union = aSet.size + bSet.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function extractContact(text = '') {
  const normalized = String(text);
  const emailMatch = normalized.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  if (emailMatch?.[0]) return emailMatch[0].toLowerCase();

  const urlMatch = normalized.match(/https?:\/\/[^\s]+/i);
  if (urlMatch?.[0]) return urlMatch[0].toLowerCase();

  return '';
}

function buildFingerprint({ content = '', company = '', jobTitle = '', url = '', externalContact = '' }) {
  const cleanText = normalizeText(content);
  const cleanCompany = normalizeText(company);
  const cleanRole = normalizeText(jobTitle);
  const cleanLink = normalizeText(url || externalContact);

  const raw = `${cleanText}||${cleanCompany}||${cleanRole}||${cleanLink}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function isDuplicateAgainstExisting(candidate, existingRows = []) {
  const candidateContact = normalizeText(candidate.externalContact || candidate.url || '');
  const candidateCompany = normalizeText(candidate.company || '');
  const candidateRole = normalizeText(candidate.jobTitle || '');

  for (const row of existingRows) {
    const contentSimilarity = jaccardSimilarity(candidate.content, row.content);
    if (contentSimilarity >= 0.8) {
      return { duplicate: true, reason: 'text_similarity', similarToId: row.id, similarity: contentSimilarity };
    }

    const sameCompany = candidateCompany && normalizeText(row.company) === candidateCompany;
    const sameRole = candidateRole && normalizeText(row.job_title || row.jobTitle || '') === candidateRole;
    if (sameCompany && sameRole) {
      return { duplicate: true, reason: 'company_role', similarToId: row.id, similarity: contentSimilarity };
    }

    const rowContact = normalizeText(row.external_contact || row.url || '');
    if (candidateContact && rowContact && candidateContact === rowContact) {
      return { duplicate: true, reason: 'external_contact', similarToId: row.id, similarity: contentSimilarity };
    }
  }

  return { duplicate: false };
}

module.exports = {
  normalizeText,
  tokenize,
  jaccardSimilarity,
  extractContact,
  buildFingerprint,
  isDuplicateAgainstExisting,
};
