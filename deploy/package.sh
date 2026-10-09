#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
mkdir -p .data/releases
tar -czf .data/releases/lendinghub-shared-hosting.tar.gz \
  package.json package-lock.json app.cjs server dist .env.example \
  README.md docs
printf 'Package created: .data/releases/lendinghub-shared-hosting.tar.gz\n'
