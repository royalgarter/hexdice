empires=("aztecs" "britons" "mongols" "japanese" "romans" "egyptians")
colors=("blue" "red" "green" "yellow" "purple" "gray")
declare -A color_map=( ["blue"]="blue" ["red"]="red" ["green"]="green" ["yellow"]="yellow" ["purple"]="magenta" ["gray"]="gray" )

for emp in "${empires[@]}"; do
  for col in "${colors[@]}"; do
    mkdir -p "assets/sprites/sets/emp_${emp}_${col}"
    tc="${color_map[$col]}"
    for unit in {1..6}; do
      src="assets/sprites/sets/emp_${emp}_blue/${unit}.gif"
      dst="assets/sprites/sets/emp_${emp}_${col}/${unit}.gif"
      if [ -f "$src" ]; then
        # Use -fuzz 10% just in case black isnt pure
        convert "$src" -fuzz 10% -fill "$tc" -opaque black "$dst"
      fi
    done
  done
  echo "$emp done"
done
npm run gen
