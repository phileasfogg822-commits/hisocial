#!/usr/bin/env bash
# validate-instance.sh — check one HiSocial instance folder.
# Usage: validate-instance.sh <instance-dir>
# Exit 0 only if every check passes. Prints FAIL lines otherwise.
# This script never prints secret values.
set -uo pipefail

DIR="${1:-}"
[ -n "$DIR" ] || { echo "Usage: validate-instance.sh <instance-dir>" >&2; exit 2; }
[ -d "$DIR" ] || { echo "FAIL: not a directory: $DIR"; exit 1; }

FAIL=0
fail() { echo "FAIL: $*"; FAIL=1; }
ok() { echo "ok: $*"; }

[ -f "$DIR/.env" ] || fail "missing .env"
[ -f "$DIR/docker-compose.yml" ] || fail "missing docker-compose.yml"

if [ -f "$DIR/.env" ]; then
  # shellcheck disable=SC1091
  set -a; . "$DIR/.env" 2>/dev/null || fail "could not parse .env"; set +a
  for var in INSTANCE_SLUG INSTANCE_DOMAIN COMPOSE_PROJECT_NAME BACKEND_PORT \
    FRONTEND_PORT POSTGRES_HOST_PORT REDIS_HOST_PORT JWT_SECRET \
    SESSION_SECRET POSTGRES_PASSWORD MUSE_BRIDGE_TOKEN APP_LOGIN_PASSWORD; do
    val="${!var:-}"
    [ -n "$val" ] || fail ".env missing $var"
    case "$val" in
      change_me*) fail ".env still contains placeholder for $var" ;;
    esac
  done
  # Secrets must be at least 32 characters (openssl rand -hex 32 = 64).
  for var in JWT_SECRET SESSION_SECRET POSTGRES_PASSWORD MUSE_BRIDGE_TOKEN; do
    val="${!var:-}"
    [ "${#val}" -ge 32 ] || fail ".env secret too short for $var"
  done
  ok ".env present, complete, no placeholders, secrets long enough"
fi

if [ -f "$DIR/docker-compose.yml" ]; then
  if grep -v "^[[:space:]]*#" "$DIR/docker-compose.yml" | grep -q "trycloudflare\|tunnel --url"; then
    fail "compose still contains an ephemeral tunnel command (forbidden in this template)"
  else
    ok "no ephemeral tunnel command in compose"
  fi
  python3 -c "import yaml,sys; yaml.safe_load(open(sys.argv[1]))" "$DIR/docker-compose.yml" \
    && ok "compose YAML parses" || fail "compose YAML does not parse"
fi

# Tunnel config is required only when the operator intends to use the tunnel
# profile; warn (do not fail) if it is only the template.
if [ -f "$DIR/cloudflared/config.yml" ]; then
  grep -q "credentials-file" "$DIR/cloudflared/config.yml" \
    && ok "cloudflared config present" || fail "cloudflared config missing credentials-file"
else
  echo "warn: no cloudflared/config.yml yet (required before --profile tunnel)"
fi

exit "$FAIL"
