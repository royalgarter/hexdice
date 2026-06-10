#!/bin/bash

# This script generates 216 empire-themed sprites across 6 colors.
# It uses ImageMagick to convert the base blue sprites into uniform tints.

EMPIRES=("aztecs" "britons" "mongols" "japanese" "romans" "egyptians")
COLORS=("blue" "red" "green" "yellow" "purple" "gray")

for emp in "${EMPIRES[@]}"; do
  echo "Processing Empire: $emp..."
  
  # Create a temporary directory for the original base sprites
  TEMP_DIR="assets/sprites/sets/tmp_${emp}"
  mkdir -p "$TEMP_DIR"
  cp assets/sprites/sets/aoe2_standard/*.gif "$TEMP_DIR/"
  
  # Apply empire-specific unit overrides to the temporary base
  case $emp in
    "aztecs")   cp assets/sprites/aoe2/g_eagle_warrior.gif "$TEMP_DIR/1.gif" ;;
    "britons")  cp assets/sprites/aoe2/g_longbowman.gif "$TEMP_DIR/2.gif" ;;
    "mongols")  cp assets/sprites/aoe2/g_mangudai.gif "$TEMP_DIR/3.gif" ;;
    "japanese") cp assets/sprites/aoe2/g_samurai.gif "$TEMP_DIR/4.gif" ;;
    "romans")   cp assets/sprites/aoe2/g_legionary.gif "$TEMP_DIR/5.gif" ;;
    "egyptians") cp assets/sprites/aoe2/g_warrior_priest.gif "$TEMP_DIR/6.gif" ;;
  esac

  for color in "${COLORS[@]}"; do
    # Map friendly names to ImageMagick colors
    tc=$color
    [ "$color" = "purple" ] && tc="magenta"
    [ "$color" = "gray" ] && tc="gray50"
    
    mkdir -p "assets/sprites/sets/emp_${emp}_${color}"
    
    for i in {1..6}; do
      src="$TEMP_DIR/$i.gif"
      dst="assets/sprites/sets/emp_${emp}_${color}/$i.gif"
      
      if [ -f "$src" ]; then
        echo "  - Unit $i -> $color"
        # Transform: Coalesce -> Grayscale -> Normalize -> Tint -> Optimize
        if [ "$color" = "gray" ]; then
          convert "$src" -coalesce -colorspace gray -normalize -layers optimize "$dst"
        else
          convert "$src" -coalesce -colorspace gray -normalize -fill "$tc" -tint 100 -layers optimize "$dst"
        fi
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
