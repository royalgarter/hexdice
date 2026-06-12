#!/bin/bash
# Generate static PNG sprites from animated GIFs in assets/sprites/empires

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EMPIRES_DIR="$SCRIPT_DIR/assets/sprites/empires"

count=0
for gif in "$EMPIRES_DIR"/*/*.gif; do
    [ -f "$gif" ] || continue
    png="${gif%.gif}.png"
    echo magick "${gif}[0]" -coalesce "$png"
done

echo "Done. PNG(s) generated."
