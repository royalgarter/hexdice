#!/bin/bash

# This script generates 216 empire-themed sprites across 6 colors.
# It uses ImageMagick to convert the base blue sprites into uniform tints.

EMPIRES=("aztecs" "britons" "mongols" "japanese" "romans" "egyptians")
COLORS=("blue" "red" "green" "yellow" "purple" "gray")

for emp in "${EMPIRES[@]}"; do
  echo "Processing Empire: $emp..."
  for color in "${COLORS[@]}"; do
    # Map friendly names to ImageMagick colors
    tc=$color
    [ "$color" = "purple" ] && tc="magenta"
    [ "$color" = "gray" ] && tc="gray50"
    
    mkdir -p "assets/sprites/sets/emp_${emp}_${color}"
    
    for i in {1..6}; do
      src="assets/sprites/sets/emp_${emp}_blue/$i.gif"
      dst="assets/sprites/sets/emp_${emp}_${color}/$i.gif"
      
      if [ -f "$src" ]; then
        # Transform: Grayscale -> Map intensity to [Black, TargetColor]
        convert "$src" -colorspace gray +level-colors "black,$tc" "$dst"
      else
        echo "Warning: Source $src not found."
      fi
    done
  done
done

# Update the game's asset manifests
if [ -f "package.json" ]; then
  npm run gen
else
  echo "Warning: package.json not found, skipping manifest update."
fi

echo "Transformation complete."
