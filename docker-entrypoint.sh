#!/bin/bash
export DEFAULT_PACKAGEMANAGER=yarn
yarn run init-database
yarn run auto-setup

if [[ -v DEBUG_MODE ]]; then
  echo "Starting in debug mode"
  yarn debug
else
  echo "Starting in production mode"
  yarn start
fi

