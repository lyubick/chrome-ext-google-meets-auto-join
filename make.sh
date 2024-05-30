#!/bin/bash
echo "Building deployment zip file... deployment.zip"
rm -rf deployment.zip

zip deployment.zip    \
    ./css/*.css       \
    ./images/icon.png \
    ./js/*.js         \
    main.html         \
    manifest.json
