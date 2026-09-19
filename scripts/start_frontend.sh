#!/usr/bin/env bash
# Start the Next.js operational frontend in development mode.
# The system-wide Node.js is too old (v10) for this project; this
# script prepends the project-local Node 20 runtime to PATH.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="$HOME/.local/opt/node-current/bin:$PATH"

cd "$ROOT_DIR/frontend"
npm run dev
