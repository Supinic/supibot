#!/bin/sh
export DEFAULT_PACKAGEMANAGER=yarn
yarn run init-database
yarn run auto-setup

if [[ -z "${DEBUG_MODE}" ]]; then
  yarn debug
else
  yarn start
fi
