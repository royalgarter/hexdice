#!/bin/bash

# This script generates 216 empire-themed sprites across 6 colors.
# It uses ImageMagick to convert the base blue sprites into uniform tints.
# Output: assets/sprites/empires/emp_{empire}_{color}/{value}.gif
# Post-processing: makes white background transparent and crops 20% from each side.

EMPIRES=("aztecs" "britons" "mongols" "japanese" "romans" "egyptians")
COLORS=("blue" "red" "green" "yellow" "purple" "gray")

# EMPIRES=("aztecs")
# COLORS=("gray")

OUTDIR="assets/sprites/empires"

for emp in "${EMPIRES[@]}"; do
  echo "Processing Empire: $emp..."

  # Save originals (grayscale, pre-tint) to _origin subdirectory
  ORIGIN_DIR="$OUTDIR/_origin/$emp"
  mkdir -p "$ORIGIN_DIR"

  # Create a temporary directory for the original base sprites
  TEMP_DIR="/tmp/hexdice/emp_${emp}"
  mkdir -p "$TEMP_DIR"
  cp assets/sprites/empires/_origin/$emp/*.gif "$TEMP_DIR/"

  for color in "${COLORS[@]}"; do
    # Map friendly names to ImageMagick colors
    tc=$color
    tint="50"

    cl="-fill $tc -tint $tint"

    [ "$color" = "blue" ] && cl="-fill blue -tint 10"
    [ "$color" = "red" ] && cl="-fill red -tint 60"
    [ "$color" = "yellow" ] && cl="-fill yellow -tint 80"
    [ "$color" = "green" ] && cl="-fill green -tint 40"
    [ "$color" = "purple" ] && cl="-fill magenta -tint 40"
    [ "$color" = "gray" ] && cl="-colorspace gray"

    mkdir -p "$OUTDIR/emp_${emp}_${color}"

    for i in {1..6}; do
      src="$TEMP_DIR/$i.gif"
      dst="$OUTDIR/emp_${emp}_${color}/$i.gif"
      origin_dst="$ORIGIN_DIR/$i.gif"

      if [ -f "$src" ]; then
        echo "  - Unit $i -> $color"

        # Save an untinted grayscale copy as the _origin reference (first time only)
        if [ ! -f "$origin_dst" ]; then
          magick "$src" -coalesce -colorspace gray -normalize -layers optimize "$origin_dst"
        fi

        # Single pipeline: Grayscale → Normalize → Tint → Transparent bg → Center-crop → Optimize
        # magick "$src" \
        #   -coalesce \
        #   -gravity center \
        #   -crop 60%x60%+0+0 +repage \
        #   -fill "$tc" \
        #   -tint 20 \
        #   -transparent white \
        #   -dispose background \
        #   -layers optimize "$dst"

        magick "$src" \
          -coalesce -gravity center -crop 50%x60%+0+0 +repage \
          $cl \
          -layers optimize "$dst"

        # magick "${src}[0]" \
        #   -gravity center \
        #   -crop 60%x60%+0+0 +repage \
        #   -fill "$tc" \
        #   -tint 20 \
        #   -fuzz 20% \
        #   -transparent white \
        #   "$dst"
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
