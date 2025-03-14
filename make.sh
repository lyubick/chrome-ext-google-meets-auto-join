#!/bin/bash
echo "Creating deployment..."

PRODUCTION_CLIENT_ID=$(cat manifest.production.client.id.txt)
TEST_CLIENT_ID=$(cat manifest.test.client.id.txt)
VERSION=$(head -2 versioning/versions.yaml | tail -1 | sed 's/- version: //')

echo "Creating manifest for production environment... manifest.json. (v$VERSION)"
sed "s/CLIENT_ID_PLACEHOLDER/$PRODUCTION_CLIENT_ID/g" < manifest.example.json | sed "s/VERSION_PLACEHOLDER/$VERSION/g" > manifest.json

echo "Building change list... update.html"
cd versioning && python build-update.py && cd ..

echo "Building deployment zip file... deployment.zip"
rm -rf deployment.zip

zip deployment.zip    \
    ./css/*.css       \
    ./images/icon.png \
    ./js/*.js         \
    ./html/*.html     \
    main.html         \
    manifest.json

echo "Restoring testing manifest... manifest.json"
sed "s/CLIENT_ID_PLACEHOLDER/$TEST_CLIENT_ID/g" < manifest.example.json | sed "s/VERSION_PLACEHOLDER/$VERSION/g" > manifest.json

