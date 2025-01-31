#!/bin/bash

set -euo pipefail

cd /home/flo/chips-generator

export $(cat .env)

# Check if bun is installed
if ! command -v bun 2>&1 >/dev/null
then
  echo "Bun is not installed. Installing bun..."
  curl -fsSL https://bun.sh/install | bash
fi

npx playwright install

/home/flo/.bun/bin/bun index.ts >> app.log 2>&1

exit 0
