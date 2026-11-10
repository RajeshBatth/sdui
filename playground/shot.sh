#!/bin/sh
# usage: shot.sh <story-id|viewer> <out.png> [height] [width]
ID=$1; OUT=$2; H=${3:-1400}; W=${4:-320}
if [ "$ID" = "viewer" ]; then URL="http://localhost:5199/"; WIN=1280; else URL="http://localhost:5199/?bare=1&w=$W&story=$(printf %s "$ID" | sed 's#/#%2F#g')"; WIN=$((W + 40)); fi
CHROME=$(ls -d ~/Library/Caches/ms-playwright/chromium_headless_shell-*/chrome-*/chrome-headless-shell 2>/dev/null | head -1)
"$CHROME" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=2 --window-size=$WIN,$H --virtual-time-budget=6000 --screenshot="$OUT" "$URL" >/dev/null 2>&1
