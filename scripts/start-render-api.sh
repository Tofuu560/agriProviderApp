#!/bin/sh
set -eu
if command -v freshclam >/dev/null 2>&1; then
  echo "Checking virus scanner definitions..."
  freshclam --stdout || echo "Warning: freshclam update skipped or failed; continuing startup"
fi
exec pnpm --filter @agri/api start
