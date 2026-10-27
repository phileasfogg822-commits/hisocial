// Phase 3: Google app-login configuration, kept pure so it is
// unit-testable without a database or a Google account.
//
// Google login is APP login (identity), not a social posting
// connection: it identifies the user to HiSocial, exactly like the
// local admin login. It does NOT log the user into Facebook,
// Instagram, LinkedIn, or TikTok, and it does NOT grant YouTube
// upload — that needs a separate Google OAuth scope in the
// YouTube phase, and must never be silently added here.
const GOOGLE_SCOPES = ['profile', 'email'];

function isGoogleConfigured(env = process.env) {
  const id = String(env.GOOGLE_CLIENT_ID || '').trim();
  const secret = String(env.GOOGLE_CLIENT_SECRET || '').trim();
  if (!id || !secret) return false;
  // Codebase placeholder convention (see other strategies): a value
  // starting with 'your_' is an unfilled example, not a credential.
  if (id.startsWith('your_') || secret.startsWith('your_')) return false;
  return true;
}

function googleCallbackUrl(env = process.env) {
  const configured = String(env.GOOGLE_CALLBACK_URL || '').trim();
  return configured || 'http://localhost:4000/auth/google/callback';
}

module.exports = {
  GOOGLE_SCOPES,
  isGoogleConfigured,
  googleCallbackUrl,
};
