import { parse } from "https://deno.land/std@0.208.0/flags/mod.ts";

const args = parse(Deno.args, { string: ["turn"] });

const replayFile = Deno.args[0];
const content = Deno.readTextFileSync(replayFile);
const data = JSON.parse(content);

const game = data.games[0];
const turnIdx = parseInt(args.turn || "10");
const move = game.moves[turnIdx];

// Parse state hash
const state = JSON.parse(atob(move.stateHash));
console.log("State at turn", turnIdx);
console.log("P1 Dice:", state.p1Dice);
console.log("P2 Dice:", state.p2Dice);
