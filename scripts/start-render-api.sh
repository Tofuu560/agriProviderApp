#!/bin/sh
set -eu
# Startup fails if virus definitions cannot be obtained. Never accept unscanned production uploads.
freshclam --stdout
exec pnpm --filter @agri/api start
