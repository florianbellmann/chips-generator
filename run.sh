#!/bin/bash

set -euo pipefail

# Check if bun is installed
#

export $(cat ".env")

if [ ! -f /usr/local/bin/bun ]; then
  echo "Bun is not installed. Installing bun..."
  curl -fsSL https://bun.sh/install | bash
fi

bun index.ts >> app.log 2>&1 || bunx playwright install && bunx playwright install-deps && bun index.ts >> app.log 2>&1

exit 0
