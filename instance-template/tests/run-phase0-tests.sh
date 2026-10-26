#!/usr/bin/env bash
# run-phase0-tests.sh — the Phase 0 test run. No Docker, no Postgres, no
# network, no secrets needed. Exit 0 only if every check passes.
# Usage: run-phase0-tests.sh [template-dir]
set -euo pipefail

TEMPLATE="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "== syntax =="
bash -n "$TEMPLATE/scripts/new-instance.sh"
bash -n "$TEMPLATE/scripts/validate-instance.sh"
bash -n "$TEMPLATE/scripts/apply-muse-queue.sh"
node --check "$TEMPLATE/backend/museQueue.js"
node --check "$TEMPLATE/backend/museQueueLogic.js"
echo "ok: shell and JS syntax"

echo "== unit tests =="
node --test "$TEMPLATE/tests/museQueueLogic.test.js"

echo "== generate two instances =="
# new-instance.sh records collisions in instances.registry next to itself,
# so the test run uses a throwaway copy of the scripts folder.
cp -r "$TEMPLATE/scripts" "$WORK/scripts"
cp "$TEMPLATE/docker-compose.yml" "$WORK/docker-compose.yml"
cp "$TEMPLATE/.env.example" "$WORK/.env.example"
cp -r "$TEMPLATE/cloudflared" "$WORK/cloudflared"
# Point the test copy's template dir at the work dir by using a symlink
# layout: scripts expect ../docker-compose.yml, ../.env.example, ../cloudflared.
# The copy above already satisfies that (scripts live in $WORK/scripts).
"$WORK/scripts/new-instance.sh" --slug manager --domain manager.example.com \
  --index 0 --target "$WORK/manager"
"$WORK/scripts/new-instance.sh" --slug person2 --domain person2.example.com \
  --index 1 --target "$WORK/person2"

echo "== validate generated instances =="
"$WORK/scripts/validate-instance.sh" "$WORK/manager"
"$WORK/scripts/validate-instance.sh" "$WORK/person2"

echo "== isolation checks =="
python3 - "$WORK/manager" "$WORK/person2" << 'PY'
import sys, yaml
def load_env(path):
    out = {}
    for line in open(path):
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            out[k] = v
    return out
a = load_env(sys.argv[1] + '/.env')
b = load_env(sys.argv[2] + '/.env')
for key in ('JWT_SECRET', 'SESSION_SECRET', 'POSTGRES_PASSWORD',
            'MUSE_BRIDGE_TOKEN', 'APP_LOGIN_PASSWORD'):
    assert a[key] != b[key], f'secret shared between instances: {key}'
    assert len(a[key]) >= 32 and len(b[key]) >= 32, f'secret too short: {key}'
assert a['BACKEND_PORT'] != b['BACKEND_PORT']
assert a['COMPOSE_PROJECT_NAME'] != b['COMPOSE_PROJECT_NAME']
assert a['INSTANCE_DOMAIN'] != b['INSTANCE_DOMAIN']
for d in (sys.argv[1], sys.argv[2]):
    compose = yaml.safe_load(open(d + '/docker-compose.yml'))
    assert 'cloudflared' in compose['services']
    text = open(d + '/docker-compose.yml').read()
    assert 'trycloudflare' not in text, 'quick tunnel found'
    assert 'tunnel --url' not in text, 'quick tunnel command found'
print('ok: secrets, ports, projects and domains all differ; no quick tunnel')
PY

echo "== apply muse queue to a throwaway checkout copy =="
cp -r "$HOME/workspace/hisocial-inspect" "$WORK/checkout" 2>/dev/null || {
  echo "skip: hisocial-inspect checkout not found in this environment"
  echo "PHASE 0 TESTS PASSED (without checkout apply step)"
  exit 0
}
"$TEMPLATE/scripts/apply-muse-queue.sh" "$WORK/checkout"
grep -Fq "muse-queue" "$WORK/checkout/backend/src/index.js"
echo "ok: muse queue mount inserted into checkout copy"

echo "PHASE 0 TESTS PASSED"
