#!/bin/sh
export DEFAULT_PACKAGEMANAGER=yarn
yarn run init-database
yarn run auto-setup
yarn start
