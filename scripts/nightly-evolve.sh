#!/usr/bin/env bash
# Nightly evolution (Evolved AI P4). Continues from the newest run's archive, then ships the new champions only if they
# beat the currently exported ones on the held-out seed block. Nothing under evolution/ is ever committed.
#
# Usage: scripts/nightly-evolve.sh [extra evolve.ts flags]
# Env:   COMMIT=1  commit js/ai/evolved-profiles.js when the run improved (no push)
#        GENS, POP, GAMES, VGAMES  override the defaults below (sized for 2 cores, about 45 minutes)
set -euo pipefail
cd "$(dirname "$0")/.."

GENS=${GENS:-6} POP=${POP:-10} GAMES=${GAMES:-6} VGAMES=${VGAMES:-8}
mkdir -p evolution

prev=$(ls -d evolution/run-* 2>/dev/null | sort | tail -1 || true)
from=()
[ -n "$prev" ] && from=(--from="$prev")
seed=$(date +%Y%m%d)

before=$(ls -d evolution/run-* 2>/dev/null | sort | tail -1 || true)
deno run --allow-all js/evolve.ts --gens="$GENS" --pop="$POP" --games="$GAMES" --vgames="$VGAMES" --seed="$seed" "${from[@]}" "$@"
run=$(ls -d evolution/run-* | sort | tail -1)
if [ "$run" = "$before" ]; then
	echo "no new run directory produced" >&2
	exit 1
fi

deno run --allow-all js/balance-feed.ts --games=60 --out="$run/balance.json"

if node scripts/nightly-compare.js "$run"; then
	node scripts/export-champions.js "$run"
	if [ "${COMMIT:-0}" = "1" ]; then
		git add js/ai/evolved-profiles.js
		git commit -m "chore(ai): nightly evolution champions from $(basename "$run")" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
	fi
else
	status=$?
	[ "$status" -eq 3 ] || exit "$status"
	echo "no improvement; shipped champions unchanged"
fi
