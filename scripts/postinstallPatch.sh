#!/bin/bash
echo "PostInstallPatch script:"
rm -rf node_modules/sharp
cp -R ~/code/a-mises/node_modules/sharp node_modules/sharp

rm -rf node_modules/semver
cp -R ~/code/a-mises/node_modules/semver node_modules/semver

rm -rf node_modules/pbkdf2/lib/default-encoding.js
cp -R ~/code/a-mises/node_modules/default-encoding.js node_modules/pbkdf2/lib/default-encoding.js