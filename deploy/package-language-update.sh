#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
mkdir -p .data/releases
# Synchronise the archive with the current dist; never include customer data.
zip -rqFS .data/releases/lendinghub-language-update.zip dist
printf 'Frontend update: .data/releases/lendinghub-language-update.zip\n'
