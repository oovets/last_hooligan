#!/usr/bin/env bash
# Deploy THE LAST HOOLIGAN to app04 (served by nginx as https://hooligan.sthlm.fun).
#
#   scripts/deploy.sh            deploys the COMMITTED HEAD (index.html, src/, assets/) — uncommitted edits are not sent
#
# The game is static files (no build step): the release is unpacked next to the live one and swapped in with a rename,
# so players never load a half-copied version. nginx config: /etc/nginx/sites-available/hooligan.sthlm.fun on app04.
set -euo pipefail
HOST="${HOST:-ubuntu@app04}"
DEST="${DEST:-/var/www/hooligan}"
cd "$(dirname "$0")/.."
REV="$(git rev-parse --short HEAD)"
echo "deploying $REV to $HOST:$DEST"
git archive --format=tar HEAD index.html src assets | ssh "$HOST" "set -e
  sudo mkdir -p '$DEST.new' && sudo rm -rf '$DEST.new'/* && sudo tar -x -C '$DEST.new'
  echo '$REV' | sudo tee '$DEST.new/REVISION' >/dev/null
  sudo chown -R root:root '$DEST.new' && sudo chmod -R a+rX '$DEST.new'
  if [ -d '$DEST' ]; then sudo rm -rf '$DEST.old' && sudo mv '$DEST' '$DEST.old'; fi
  sudo mv '$DEST.new' '$DEST' && sudo rm -rf '$DEST.old'
  echo \"live: \$(cat '$DEST/REVISION') (\$(du -sh '$DEST' | cut -f1))\""
