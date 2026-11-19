#!/bin/sh
# Regenerates locales/locales.js (the file:// fallback) from locales/locales.json.
cd "$(dirname "$0")/.." && (printf 'window.GAME_LOCALES='; cat locales/locales.json; echo ';') > locales/locales.js && echo "locales/locales.js rebuilt"
