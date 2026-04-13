#!/bin/bash
# gen-registry.sh — Generate web/src/apps/_bootstrap.ts for filtered builds.
# Usage: APPS=system,ai ./scripts/gen-registry.sh
#
# If APPS is not set, restores the full version (all app modules).

set -euo pipefail

BOOTSTRAP="web/src/apps/_bootstrap.ts"

# No APPS specified → restore full version
if [ -z "${APPS:-}" ]; then
  if ! git checkout -- "$BOOTSTRAP" 2>/dev/null; then
    # File not in git yet — write the full default
    cat > "$BOOTSTRAP" << 'FULL'
// App module side-effect imports.
// gen-registry.sh replaces this file for filtered builds (APPS=...).
import "./ai/module"
import "./license/module"
import "./node/module"
FULL
  fi
  echo "[gen-registry] restored full _bootstrap.ts"
  exit 0
fi

# Generate filtered bootstrap (only side-effect imports, no circular dep)
cat > "$BOOTSTRAP" << 'HEADER'
// Auto-generated — do not edit. Run without APPS to restore full version.
HEADER

for app in $(echo "$APPS" | tr ',' '\n'); do
  [ "$app" = "system" ] && continue  # system is kernel, no app module
  echo "import './${app}/module'" >> "$BOOTSTRAP"
done

echo "[gen-registry] generated _bootstrap.ts with APPS=$APPS"
