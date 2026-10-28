// Phase 27: APK client tests.
// node:test only, no new dependency. The handshake
// builder is pure; Android project checks are static,
// in the Phase 4–26 style. A real APK build is an
// owner step (needs Android Studio + SDK), not
// something CI proves.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { buildClientInfo } = require('../src/utils/clientInfo');

describe('client handshake', () => {
  it('reports identity, version, and features without user data', () => {
    const info = buildClientInfo({ backendVersion: '1.0.0' });
    assert.equal(info.app, 'HiSocial');
    assert.equal(info.backendVersion, '1.0.0');
    assert.equal(info.api, 'v1');
    assert.ok(info.features.includes('compose'));
    assert.ok(!('user' in info) && !('token' in info));
  });
});

describe('APK project wiring (static)', () => {
  const manifest = fs.readFileSync(path.join(__dirname, '..', '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml'), 'utf8');
  const mainActivity = fs.readFileSync(path.join(__dirname, '..', '..', 'android', 'app', 'src', 'main', 'java', 'com', 'hisocial', 'app', 'MainActivity.kt'), 'utf8');
  const appGradle = fs.readFileSync(path.join(__dirname, '..', '..', 'android', 'app', 'build.gradle'), 'utf8');
  const indexJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');
  const clientJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'client.js'), 'utf8');

  it('manifest, WebView, and Gradle config are coherent', () => {
    assert.match(manifest, /android\.permission\.INTERNET/);
    assert.match(manifest, /\.MainActivity/);
    assert.match(mainActivity, /javaScriptEnabled = true/);
    assert.match(mainActivity, /domStorageEnabled = true/);
    assert.match(mainActivity, /onShowFileChooser/);
    assert.match(mainActivity, /HISOCIAL_BASE_URL/);
    assert.match(appGradle, /com\.hisocial\.app/);
    assert.match(appGradle, /HISOCIAL_BASE_URL/);
  });

  it('client info endpoint is mounted and unauthenticated', () => {
    assert.match(indexJs, /api\/client/);
    assert.match(clientJs, /\/info/);
    assert.doesNotMatch(clientJs, /requireAuth/);
  });
});
