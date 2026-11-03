#!/bin/bash
# Copy the namaz site (repo root) into www/ so it is bundled inside the APK — the app needs no website/domain.
set -e
APP="$(cd "$(dirname "$0")" && pwd)"
SRC="${NAMAZ_SRC:-$APP/..}"
rm -rf "$APP/www" && mkdir "$APP/www"
cd "$SRC"
for f in index.html styles.css app.js districts.js install.js offline.js quran.js native.js sw.js manifest.json; do cp "$f" "$APP/www/"; done
cp -r icons data "$APP/www/"
