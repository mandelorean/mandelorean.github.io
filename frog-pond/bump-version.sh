#!/bin/sh
# Stamp a new version into version.json, app.js and sw.js before deploying, so installed
# copies of Frog Pond notice the update and reload. Saved progress is never affected.
set -e
cd "$(dirname "$0")"
V="${1:-$(date +%Y-%m-%d.%H%M)}"
sed -i.bak "s/\"version\": \"[^\"]*\"/\"version\": \"$V\"/" version.json
sed -i.bak "s/const APP_VERSION = '[^']*'/const APP_VERSION = '$V'/" app.js
sed -i.bak "s/const VERSION = '[^']*'/const VERSION = '$V'/" sw.js
rm -f version.json.bak app.js.bak sw.js.bak
echo "Frog Pond version is now $V"
