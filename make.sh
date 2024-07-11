#!/bin/bash
echo "Creating deployment..."

PRODUCTION_CLIENT_ID=$(cat manifest.production.client.id.txt)
TEST_CLIENT_ID=$(cat manifest.test.client.id.txt)

echo "Creating manifest for production environment... manifest.json"
sed "s/CLIENT_ID_PLACEHOLDER/$PRODUCTION_CLIENT_ID/g" < manifest.example.json > manifest.json

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
sed "s/CLIENT_ID_PLACEHOLDER/$TEST_CLIENT_ID/g" < manifest.example.json > manifest.json
