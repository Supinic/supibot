#!/bin/bash
set -euo pipefail

SETUP_STATE_DIR="/var/lib/supibot"
SETUP_DTATE_FILE="$SETUP_STATE_DIR/auto-setup-version"

mkdir -p "$SETUP_STATE_DIR"

run_auto_setup() {
  echo "Running setup..."
  yarn run init-database
  yarn run auto-setup
  echo "${AUTO_SETUP_VERSION:-1}" > "$SETUP_VERSION_FILE"
}

if [[ -v AUTO_SETUP_MODE = "always" ]] then
  run_auto_setup()
else if [[ -v AUTO_SETUP_MODE = "never" ]] then
    echo "Skipping setup"
else if [[ -v AUTO_SETUP_MODE = "auto" ]] then
    CURRENT_VERSION="$(cat "$SETUP_STATE_FILE" 2>/dev/null || true)"



yarn run init-database
yarn run auto-setup

if [[ -v DEBUG_MODE ]]; then
  echo "Starting in debug mode"
  exec yarn debug
else
  echo "Starting in production mode"
  exec yarn start
fi
