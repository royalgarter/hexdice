#!/bin/bash
empires=("aztecs" "britons" "mongols" "japanese" "romans" "egyptians")
colors=("blue" "red" "green" "yellow" "purple" "gray")

declare -A color_map
color_map["blue"]="blue"
color_map["red"]="red"
color_map["green"]="green"
color_map["yellow"]="yellow"
color_map["purple"]="magenta"
color_map["gray"]="white"

for empire in "${empires[@]}"; do
  source_dir="assets/sprites/sets/emp_${empire}_blue"
  for color in "${colors[@]}"; do
    target_dir="assets/sprites/sets/emp_${empire}_${color}"
    mkdir -p "$target_dir"
    target_color=${color_map[$color]}
    
    for unit in {1..6}; do
      source_file="${source_dir}/${unit}.gif"
      target_file="${target_dir}/${unit}.gif"
      
      if [ -f "$source_file" ]; then
        echo "Processing ${empire} ${color} unit ${unit}..."
        convert "$source_file" -alpha on -channel RGB -colorspace gray +level-colors "black,${target_color}" +channel "$target_file"
      else
        echo "Warning: ${source_file} not found."
      fi
    done
  done
done
