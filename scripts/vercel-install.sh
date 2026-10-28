#!/usr/bin/env bash
# Vercel's install step. The seositetuneup engine is a private GitHub dependency, so every way npm
# might reach github.com is rewritten to use the read-only token in GH_ENGINE_TOKEN first. Lives
# here because vercel.json's installCommand is capped at 256 characters. The token is never printed.
set -euo pipefail
if [ -n "${GH_ENGINE_TOKEN:-}" ]; then
  with_token="https://x-access-token:${GH_ENGINE_TOKEN}@github.com/"
  git config --global url."$with_token".insteadOf "https://github.com/"
  git config --global --add url."$with_token".insteadOf "ssh://git@github.com/"
  git config --global --add url."$with_token".insteadOf "git@github.com:"
else
  echo "GH_ENGINE_TOKEN is not set; installing without it (the private engine will fail to fetch)" >&2
fi
npm ci
