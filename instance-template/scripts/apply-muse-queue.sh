#!/usr/bin/env bash
# apply-muse-queue.sh — install the Muse bridge queue into a HiSocial checkout.
# Usage: apply-muse-queue.sh <repo-checkout-dir>
# - Copies backend/museQueue.js -> <repo>/backend/src/routes/museQueue.js
# - Copies backend/museQueueLogic.js -> <repo>/backend/src/routes/museQueueLogic.js
# - Inserts the mount line into <repo>/backend/src/index.js after the
#   autopilot mount, if not already present (idempotent).
# - Does NOT run the migration and does NOT start anything. Run
#   backend/muse_queue_migration.sql against the instance database once,
#   or add its CREATE TABLE to runMigrations() in index.js.
# - Refuses to run if the checkout does not look like HiSocial.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_DIR="$(dirname "$SCRIPT_DIR")"
REPO="${1:-}"

[ -n "$REPO" ] || { echo "Usage: apply-muse-queue.sh <repo-checkout-dir>" >&2; exit 2; }
[ -f "$REPO/backend/src/index.js" ] || { echo "Not a HiSocial checkout: $REPO/backend/src/index.js missing" >&2; exit 1; }
[ -f "$REPO/backend/src/routes/autopilot.js" ] || { echo "Not a HiSocial checkout: autopilot route missing" >&2; exit 1; }

cp "$TEMPLATE_DIR/backend/museQueue.js" "$REPO/backend/src/routes/museQueue.js"
cp "$TEMPLATE_DIR/backend/museQueueLogic.js" "$REPO/backend/src/routes/museQueueLogic.js"

MOUNT="app.use('/api/muse-queue', require('./routes/museQueue'));"
if grep -Fq "museQueue" "$REPO/backend/src/index.js"; then
  echo "Mount already present in index.js, leaving it unchanged."
else
  # Insert after the autopilot mount line.
  python3 - "$REPO/backend/src/index.js" "$MOUNT" << 'PY'
import sys
path, mount = sys.argv[1], sys.argv[2]
text = open(path).read()
anchor = "app.use('/api/autopilot', require('./routes/autopilot'));"
assert anchor in text, "autopilot mount line not found in index.js"
text = text.replace(anchor, anchor + "\n" + mount, 1)
open(path, 'w').write(text)
PY
  echo "Inserted mount line into backend/src/index.js."
fi

node --check "$REPO/backend/src/routes/museQueue.js"
node --check "$REPO/backend/src/routes/museQueueLogic.js"
echo "Muse queue installed. Next: run backend/muse_queue_migration.sql once per instance database."
