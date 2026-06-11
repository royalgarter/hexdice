#!/bin/bash

# This script generates 216 empire-themed sprites across 6 colors.
# It uses ImageMagick to convert the base blue sprites into uniform tints.
# Output: assets/sprites/empires/emp_{empire}_{color}/{value}.gif
# Post-processing: makes white background transparent and crops 20% from each side.

EMPIRES=("d1persian" "d2celtic" "d3greek" "d4babylon" "d5roman" "d6egyptian")
COLORS=("blue" "red" "green" "yellow" "purple" "gray")

# EMPIRES=("aztecs")
# COLORS=("gray")

OUTDIR="assets/sprites/empires"


for emp in "${EMPIRES[@]}"; do
  echo "Processing Empire: $emp..."

  # Save originals (grayscale, pre-tint) to _online subdirectory
  ORIGIN_DIR="$OUTDIR/_online/$emp"
  mkdir -p "$ORIGIN_DIR"

  # Create a temporary directory for the original base sprites
  TEMP_DIR="/tmp/hexdice/emp_${emp}"
  mkdir -p "$TEMP_DIR"
  cp assets/sprites/empires/_online/$emp/*.png "$TEMP_DIR/"

  for color in "${COLORS[@]}"; do
    # Map friendly names to ImageMagick colors
    tc=$color
    tint="50"

    cl="-fill $tc -tint $tint"

    [ "$color" = "blue" ] && cl="-fuzz 40% -fill blue -opaque blue"
    [ "$color" = "red" ] && cl="-fuzz 40% -fill red -opaque blue"
    [ "$color" = "yellow" ] && cl="-fuzz 40% -fill yellow -opaque blue"
    [ "$color" = "green" ] && cl="-fuzz 40% -fill green -opaque blue"
    [ "$color" = "purple" ] && cl="-fuzz 40% -fill magenta -opaque blue"
    [ "$color" = "gray" ] && cl="-colorspace gray"

    mkdir -p "$OUTDIR/emp_${emp}_${color}"

    for i in {1..6}; do
      src="$TEMP_DIR/$i.png"
      dst="$OUTDIR/emp_${emp}_${color}/$i.png"
      origin_dst="$ORIGIN_DIR/$i.png"

      if [ -f "$src" ]; then
        echo "  - Unit $i -> $color"

        magick "$src" $cl $dst
      else
        echo "Warning: Source $src not found."
      fi
    done
  done
  # Clean up temp directory
  rm -rf "$TEMP_DIR"
done

# Update the game's asset manifests
if [ -f "package.json" ]; then
  npm run gen
else
  echo "Warning: package.json not found, skipping manifest update."
fi

echo "Transformation complete."
