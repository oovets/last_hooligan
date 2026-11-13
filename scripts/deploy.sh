#!/usr/bin/env bash
# Deploy THE LAST HOOLIGAN to app04 (served by nginx as https://hooligan.sthlm.fun, behind Cloudflare).
#
#   scripts/deploy.sh            deploys the COMMITTED HEAD (index.html, src/, assets/) — uncommitted edits are not sent
#
# The release is staged locally (scripts/release.mjs: modulepreload list for the whole module graph, sound on), then
# unpacked next to the live copy on app04 and swapped in with a rename, so players never load a half-copied version.
# nginx config: /etc/nginx/sites-available/hooligan.sthlm.fun on app04.
set -euo pipefail
HOST="${HOST:-ubuntu@app04}"
DEST="${DEST:-/var/www/hooligan}"
cd "$(dirname "$0")/.."
REV="$(git rev-parse --short HEAD)"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
git archive --format=tar HEAD index.html src assets | tar -x -C "$STAGE"
REV="$REV" node scripts/release.mjs "$STAGE"
echo "$REV" > "$STAGE/REVISION"
echo "deploying $REV to $HOST:$DEST"
COPYFILE_DISABLE=1 tar --no-xattrs -c -C "$STAGE" . | ssh "$HOST" "set -e
  sudo mkdir -p '$DEST.new' && sudo rm -rf '$DEST.new'/* && sudo tar -x -C '$DEST.new'
  sudo chown -R root:root '$DEST.new' && sudo chmod -R a+rX '$DEST.new'
  if [ -d '$DEST' ]; then sudo rm -rf '$DEST.old' && sudo mv '$DEST' '$DEST.old'; fi
  sudo mv '$DEST.new' '$DEST' && sudo rm -rf '$DEST.old'
  echo \"live: \$(cat '$DEST/REVISION') (\$(du -sh '$DEST' | cut -f1))\""
