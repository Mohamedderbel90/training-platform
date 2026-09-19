#!/usr/bin/env bash
# Lint the training_management addon's Python code.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/.venv/bin/activate"
cd "$ROOT_DIR"
flake8 --config=custom_addons/.flake8 custom_addons/training_management
