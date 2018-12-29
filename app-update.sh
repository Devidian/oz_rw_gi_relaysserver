#!/bin/bash

git reset --hard;
git pull --recurse-submodules;
git submodule init;
git submodule update;
git pull --recurse-submodules;
npm i;
tsc;
# This App has a self-reloading mechanism
# systemctl reload gui-backend-accounting;