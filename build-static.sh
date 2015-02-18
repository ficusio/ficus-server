#!/usr/bin/env bash

set -e # immediately fail on any error

build-static () {
  echo "building ${1} static files..."
  cd "../${1}" && npm install && ./node_modules/.bin/bower install && rm -rf public && ./node_modules/.bin/brunch build --production
}

build-static presenter
build-static listener
cd ../server

echo "copying static files to server..."

rm -rf public && mkdir public && cp -Rf ../presenter/public/. ../listener/public/. public/

echo "done!"
