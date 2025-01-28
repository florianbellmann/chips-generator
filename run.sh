#!/bin/bash


set -euo pipefail

# Check if bun is installed

if [ ! -f /usr/local/bin/bun ]; then
  echo "Bun is not installed. Installing bun..."
  curl -fsSL https://bun.sh/install | bash
fi

bun index.ts || bunx playwright install && bunx playwright install-deps && bun index

exit 0
