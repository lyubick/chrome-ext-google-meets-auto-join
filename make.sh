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

# Stage the files so the working copy of backend.js is left untouched
STAGING=$(mktemp -d)
mkdir -p "$STAGING/css" "$STAGING/images" "$STAGING/js" "$STAGING/html"
cp ./css/*.css "$STAGING/css/"
cp ./images/icon.png "$STAGING/images/"
cp ./js/*.js "$STAGING/js/"
cp ./html/*.html "$STAGING/html/"
cp main.html manifest.json "$STAGING/"

echo "Forcing debug = false in backend.js"
sed -i.bak 's/^let debug = .*;/let debug = false;/' "$STAGING/js/backend.js"
rm "$STAGING/js/backend.js.bak"
if ! grep -q '^let debug = false;' "$STAGING/js/backend.js"; then
    echo "ERROR: failed to set debug = false in backend.js, aborting."
    rm -rf "$STAGING"
    exit 1
fi

(cd "$STAGING" && zip -r "$OLDPWD/deployment.zip" .)
rm -rf "$STAGING"

echo "Restoring testing manifest... manifest.json"
sed "s/CLIENT_ID_PLACEHOLDER/$TEST_CLIENT_ID/g" < manifest.example.json | sed "s/VERSION_PLACEHOLDER/$VERSION/g" > manifest.json

