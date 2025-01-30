#!/bin/bash

set -euo pipefail

export $(cat .env)

# Check if bun is installed
if ! command -v bun 2>&1 >/dev/null
then
  echo "Bun is not installed. Installing bun..."
  curl -fsSL https://bun.sh/install | bash
fi

bun index.ts >> app.log 2>&1 || bunx playwright install && bunx playwright install-deps && bun index.ts >> app.log 2>&1

exit 0
