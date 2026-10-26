#!/usr/bin/env bash
# new-instance.sh — generate one HiSocial instance folder from the template.
# Usage:
#   new-instance.sh --slug manager --domain manager.example.com --index 0 \
#     --target ~/hisocial-instances/manager [--force]
#
# Safety rules (Phase 0, locked):
# - Slug must be lowercase letters, digits and hyphens only.
# - Never overwrites an existing .env or docker-compose.yml without --force.
# - Never reuses a port set already recorded in instances.registry.
# - Secrets are generated fresh with openssl rand; nothing is copied from
#   another instance and nothing valid is printed to stdout except the
#   instance summary (no secret values are echoed).
# - The script does NOT start Docker, create a tunnel, or create developer
#   apps. Those are manual owner steps (see README.md).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_DIR="$(dirname "$SCRIPT_DIR")"
REGISTRY_FILE="${SCRIPT_DIR}/instances.registry"

SLUG=""
DOMAIN=""
INDEX="0"
TARGET=""
FORCE=0

while [ $# -gt 0 ]; do
  case "$1" in
    --slug) SLUG="$2"; shift 2 ;;
    --domain) DOMAIN="$2"; shift 2 ;;
    --index) INDEX="$2"; shift 2 ;;
    --target) TARGET="$2"; shift 2 ;;
    --force) FORCE=1; shift ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

[ -n "$SLUG" ] || { echo "--slug is required" >&2; exit 2; }
[ -n "$DOMAIN" ] || { echo "--domain is required" >&2; exit 2; }
[ -n "$TARGET" ] || { echo "--target is required" >&2; exit 2; }

if ! printf '%s' "$SLUG" | grep -Eq '^[a-z0-9][a-z0-9-]*$'; then
  echo "Slug must be lowercase letters, digits and hyphens only: $SLUG" >&2
  exit 2
fi
if ! printf '%s' "$INDEX" | grep -Eq '^[0-9]+$'; then
  echo "Index must be a non-negative integer: $INDEX" >&2
  exit 2
fi
if ! printf '%s' "$DOMAIN" | grep -Eq '^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'; then
  echo "Domain does not look like a domain: $DOMAIN" >&2
  exit 2
fi

BACKEND_PORT=$((4000 + INDEX * 10))
FRONTEND_PORT=$((4001 + INDEX * 10))
POSTGRES_PORT=$((5433 + INDEX * 10))
REDIS_PORT=$((6380 + INDEX * 10))
PROJECT="hisocial-${SLUG}"

# Collision check against the registry (ports and slugs), unless forced.
if [ -f "$REGISTRY_FILE" ] && [ "$FORCE" -eq 0 ]; then
  if grep -q "^${SLUG} " "$REGISTRY_FILE"; then
    echo "Slug already registered: $SLUG (use --force to overwrite, or a new slug)" >&2
    exit 1
  fi
  if grep -q " ${BACKEND_PORT} " "$REGISTRY_FILE"; then
    echo "Backend port already registered: $BACKEND_PORT" >&2
    exit 1
  fi
fi

mkdir -p "$TARGET" "$TARGET/cloudflared" "$TARGET/scripts"

if [ -e "$TARGET/.env" ] && [ "$FORCE" -eq 0 ]; then
  echo "Refusing to overwrite existing $TARGET/.env (use --force)" >&2
  exit 1
fi
if [ -e "$TARGET/docker-compose.yml" ] && [ "$FORCE" -eq 0 ]; then
  echo "Refusing to overwrite existing $TARGET/docker-compose.yml (use --force)" >&2
  exit 1
fi

gen_secret() { openssl rand -hex 32; }

cp "$TEMPLATE_DIR/docker-compose.yml" "$TARGET/docker-compose.yml"
cp "$SCRIPT_DIR/validate-instance.sh" "$TARGET/scripts/validate-instance.sh" 2>/dev/null || true
cp "$TEMPLATE_DIR/cloudflared/config.yml.template" "$TARGET/cloudflared/config.yml.template"

# Render .env from the example, replacing only the instance fields.
sed \
  -e "s|^INSTANCE_SLUG=.*|INSTANCE_SLUG=${SLUG}|" \
  -e "s|^INSTANCE_DOMAIN=.*|INSTANCE_DOMAIN=${DOMAIN}|" \
  -e "s|^COMPOSE_PROJECT_NAME=.*|COMPOSE_PROJECT_NAME=${PROJECT}|" \
  -e "s|^BACKEND_PORT=.*|BACKEND_PORT=${BACKEND_PORT}|" \
  -e "s|^FRONTEND_PORT=.*|FRONTEND_PORT=${FRONTEND_PORT}|" \
  -e "s|^POSTGRES_HOST_PORT=.*|POSTGRES_HOST_PORT=${POSTGRES_PORT}|" \
  -e "s|^REDIS_HOST_PORT=.*|REDIS_HOST_PORT=${REDIS_PORT}|" \
  -e "s|^FRONTEND_URL=.*|FRONTEND_URL=https://${DOMAIN}|" \
  -e "s|^PUBLIC_BACKEND_URL=.*|PUBLIC_BACKEND_URL=https://api.${DOMAIN}|" \
  -e "s|^REACT_APP_API_URL=.*|REACT_APP_API_URL=https://api.${DOMAIN}|" \
  -e "s|^CLOUDFLARED_TUNNEL_NAME=.*|CLOUDFLARED_TUNNEL_NAME=${PROJECT}|" \
  -e "s|api\.change_me\.example\.com|api.${DOMAIN}|g" \
  -e "s|change_me\.example\.com|${DOMAIN}|g" \
  "$TEMPLATE_DIR/.env.example" > "$TARGET/.env.tmp"

# Replace secret placeholders with fresh generated values.
JWT_SECRET="$(gen_secret)"
SESSION_SECRET="$(gen_secret)"
POSTGRES_PASSWORD="$(gen_secret)"
MUSE_BRIDGE_TOKEN="$(gen_secret)"
APP_PASSWORD="$(gen_secret)"
sed \
  -e "s|^JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|" \
  -e "s|^SESSION_SECRET=.*|SESSION_SECRET=${SESSION_SECRET}|" \
  -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${POSTGRES_PASSWORD}|" \
  -e "s|^MUSE_BRIDGE_TOKEN=.*|MUSE_BRIDGE_TOKEN=${MUSE_BRIDGE_TOKEN}|" \
  -e "s|^APP_LOGIN_PASSWORD=.*|APP_LOGIN_PASSWORD=${APP_PASSWORD}|" \
  "$TARGET/.env.tmp" > "$TARGET/.env"
rm -f "$TARGET/.env.tmp"
chmod 600 "$TARGET/.env"

# Record the instance (no secrets) for collision detection on this machine.
grep -v "^${SLUG} " "$REGISTRY_FILE" 2>/dev/null > "${REGISTRY_FILE}.tmp" || true
printf '%s %s %s %s %s %s\n' "$SLUG" "$DOMAIN" "$BACKEND_PORT" "$FRONTEND_PORT" "$POSTGRES_PORT" "$REDIS_PORT" >> "${REGISTRY_FILE}.tmp"
mv "${REGISTRY_FILE}.tmp" "$REGISTRY_FILE"

cat <<EOF
Instance created (secrets are in the .env file only, not shown here):
  slug:            $SLUG
  domain:          $DOMAIN
  target:          $TARGET
  compose project: $PROJECT
  backend port:    $BACKEND_PORT
  frontend port:   $FRONTEND_PORT
  postgres port:   $POSTGRES_PORT
  redis port:      $REDIS_PORT
  app URL:         https://$DOMAIN
  api URL:         https://api.$DOMAIN
Next (owner steps): validate, create the named Cloudflare tunnel, fill
cloudflared/config.yml from config.yml.template, add developer app
credentials to .env, pair this instance's Muse worker, then start Docker.
EOF
