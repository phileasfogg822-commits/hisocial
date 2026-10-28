// Phase 28: token encryption at rest.
//
// Secrets (social access/refresh tokens, custom
// platform API keys) are stored AES-256-GCM
// encrypted once ENCRYPTION_KEY is set. The key is
// any string; it is hashed with SHA-256 to 32 bytes,
// so rotation means re-encrypting, not reformatting.
// Format: `v1:<iv-b64>:<tag-b64>:<ciphertext-b64>`.
//
// Fail-closed, never fake:
// - encryptToken throws when ENCRYPTION_KEY is
//   unset. A token write without a key is an error
//   with a clear message, not silent plaintext.
// - decryptToken returns legacy plaintext as-is
//   (values stored before Phase 28 keep working
//   until they are rotated or reconnected).
// - decryptToken throws on a v1: value when the
//   key is unset or wrong — it cannot silently
//   hand back ciphertext as a token.
const crypto = require('crypto');

function encryptionEnabled() {
  return Boolean(process.env.ENCRYPTION_KEY);
}

function keyBytes() {
  return crypto.createHash('sha256').update(String(process.env.ENCRYPTION_KEY)).digest();
}

function encryptToken(plaintext) {
  if (!plaintext) return plaintext;
  if (!encryptionEnabled()) {
    throw new Error('Token encryption is not configured: set ENCRYPTION_KEY before storing secrets.');
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBytes(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

function decryptToken(stored) {
  if (!stored || typeof stored !== 'string' || !stored.startsWith('v1:')) {
    return stored; // legacy plaintext (pre-Phase 28) or empty
  }
  if (!encryptionEnabled()) {
    throw new Error('Token encryption is not configured: set ENCRYPTION_KEY to use encrypted secrets.');
  }
  const [, ivB64, tagB64, ctB64] = stored.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBytes(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8');
}

function isEncrypted(stored) {
  return typeof stored === 'string' && stored.startsWith('v1:');
}

module.exports = { encryptionEnabled, encryptToken, decryptToken, isEncrypted };
