// ------------------------------------------------------------------------------------------------
// NEW AI STRATEGY: PRIORITY-BASED AI (v1.3 Fog of War Compatible)
// ------------------------------------------------------------------------------------------------

function performAIByPriority(GAME) {
    if (GAME.phase !== 'PLAYER_TURN' || !GAME.players[GAME.currentPlayerIndex].isAI) return;

    // console.log("AI (Priority Bot) thinking...");
    const state = GAME.cloneState();
    const currentPlayer = state.players[state.currentPlayerIndex];
    const aiPlayerIndex = state.currentPlayerIndex;

    // 1. Calculate AI Visibility (Fog of War)
    const visibleHexes = new Set(GAME.hexes.map(x => x.id)) /*Disable Fog of War for testing*/ || calculateVisibility(GAME, state, aiPlayerIndex);

    // 2. Identify AI Units that can act
    const availableUnits = currentPlayer.dice.filter(d => d.isDeployed && !d.isDeath && !d.hasMovedOrAttackedThisTurn);

    if (availableUnits.length === 0) {
        console.log("AI has no units to act. Ending turn.");
        applyMove(GAME, { actionType: 'END_TURN' });
        return;
    }

    // 3. Evaluation Loop: Find the Best Move according to Priority List
    // We iterate through all units and find the highest priority action across the entire army.
    let bestMove = null;
    let bestPriority = Infinity; // Lower is better (1 is highest)

    for (const unit of availableUnits) {
        // --- Priority 1: Threat Elimination (Attack) ---
        // Condition: Visible enemy, in range, winnable combat.
        
        // Check for basic Melee Attacks (via Move)
        const validMoves = GAME.calcValidMoves(unit.hexId, false, state);
        for (const targetHexId of validMoves) {
            const targetUnit = GAME.getUnitOnHex(targetHexId, state);
            // Must be an enemy AND visible
            if (targetUnit && targetUnit.playerId !== aiPlayerIndex && visibleHexes.has(targetHexId)) {
                const defenderArmor = GAME.calcDefenderEffectiveArmor(targetHexId, state);
                const attackerAttack = unit.attack; // Dice + 1 usually
                
                if (attackerAttack >= defenderArmor) {
                    // Guaranteed Kill (Winnable)
                    // Evaluate Target Value (Dice 5/6 > Weakest)
                    const priorityScore = 1 - (targetUnit.value / 100); // 1.0 (Low val) to 0.94 (High val). Lower is better.
                    if (priorityScore < bestPriority) {
                        bestPriority = priorityScore;
                        bestMove = { actionType: 'MOVE', unitHexId: unit.hexId, targetHexId: targetHexId };
                    }
                }
            }
        }

        // Check for Ranged Attacks (Dice 5)
        if (unit.value === 2) {
			const validRanged = GAME.calcValidRangedTargets(unit.hexId, state);
			for (const targetHexId of validRanged) {
				// Must be visible
				if (visibleHexes.has(targetHexId)) {
					const targetUnit = GAME.getUnitOnHex(targetHexId, state);
					const defenderArmor = GAME.calcDefenderEffectiveArmor(targetHexId, state);
					// Dice 2 attack is now 2.
					if (2 >= defenderArmor) {
						const priorityScore = 1 - (targetUnit.value / 100);
						if (priorityScore < bestPriority) {
							bestPriority = priorityScore;
							bestMove = { actionType: 'RANGED_ATTACK', unitHexId: unit.hexId, targetHexId: targetHexId };
						}
					}
				}
			}
		}

        // Check for Oracle Spells (Dice 6)
        if (unit.value === 6) {
             const validSpellTargets = GAME.calcValidSpecialAttackTargets(unit.hexId, state);
             for (const targetHexId of validSpellTargets) {
                if (visibleHexes.has(targetHexId)) {
                    const targetUnit = GAME.getUnitOnHex(targetHexId, state);
                    
                    // Oracle only targets friendly units
                    if (targetUnit && targetUnit.playerId === aiPlayerIndex) {
                        // Priority 1.5: Emergency Swap - Save Oracle from death
                        const oracleHex = GAME.getHex(unit.hexId, state);
                        const oracleNeighbors = GAME.getNeighbors(oracleHex, state);
                        let oracleInImmediateDanger = false;
                        
                        for (const neighbor of oracleNeighbors) {
                            const neighborUnit = GAME.getUnitOnHex(neighbor.id, state);
                            if (neighborUnit && neighborUnit.playerId !== aiPlayerIndex) {
                                const defenderArmor = GAME.calcDefenderEffectiveArmor(unit.hexId, state);
                                if (neighborUnit.attack >= defenderArmor) {
                                    oracleInImmediateDanger = true;
                                    break;
                                }
                            }
                        }
                        
                        if (oracleInImmediateDanger && targetHexId !== unit.hexId) {
                            // Swap to save Oracle (highest priority after kills)
                            bestMove = { actionType: 'SPELLCAST_SWAP', unitHexId: unit.hexId, targetHexId: targetHexId };
                            bestPriority = 0.5; // Very high priority
                            continue;
                        }
                        
                        // Priority 2.5: Shield - Save high-value threatened unit
                        if (targetUnit.value >= 4 && !bestMove) {
                            const targetHex = GAME.getHex(targetHexId, state);
                            const targetNeighbors = GAME.getNeighbors(targetHex, state);
                            let targetThreatened = false;
                            
                            for (const neighbor of targetNeighbors) {
                                const neighborUnit = GAME.getUnitOnHex(neighbor.id, state);
                                if (neighborUnit && neighborUnit.playerId !== aiPlayerIndex) {
                                    targetThreatened = true;
                                    break;
                                }
                            }
                            
                            if (targetThreatened) {
                                bestMove = { actionType: 'SPELLCAST_SHIELD', unitHexId: unit.hexId, targetHexId: targetHexId };
                                bestPriority = 2.5;
                            }
                        }
                        
                        // Priority 3.5: Mend - Repair heavily damaged unit
                        if (targetUnit.armorReduction > 0 && !bestMove) {
                            const armorRatio = targetUnit.armorReduction / targetUnit.currentArmor;
                            if (armorRatio >= 0.5 && targetUnit.value >= 3) {
                                bestMove = { actionType: 'SPELLCAST_MEND', unitHexId: unit.hexId, targetHexId: targetHexId };
                                bestPriority = 3.5;
                            }
                        }
                    }
                }
             }
        }
    }

    // Only proceed to lower priorities if no Priority 1 move was found
    if (!bestMove) {
        // --- Priority 2: Objective Advance ---
        // Move towards Enemy Base (if known) or Center.
        // We select the "Best" unit to advance (e.g. strongest available).
        
        let bestUnitToAdvance = null;
        let bestAdvanceScore = -Infinity;
        let bestAdvanceTarget = null;

        const opponentIndex = (aiPlayerIndex + 1) % state.players.length;
        const opponentBaseId = state.players[opponentIndex].baseHexId;
        // If we know opponent base location (it's always fixed in v1.0/v1.3 usually, or revealed), target it.
        // In FoW, strictly we might not know it, but for "Casual" AI, let's assume it knows the *direction* or the corner.
        // Let's assume it targets the Center (0,0) if it doesn't have a better idea.
        const centerHex = GAME.getHexByQR(0,0, state);
        const targetObjHex = opponentBaseId ? GAME.getHex(opponentBaseId, state) : centerHex; 

        for (const unit of availableUnits) {
             const validMoves = GAME.calcValidMoves(unit.hexId, false, state);
             // Filter moves that go into empty hexes (not attacks, since attacks failed above)
             const moveCandidates = validMoves.filter(hid => !GAME.getUnitOnHex(hid, state));
             
             for (const moveHexId of moveCandidates) {
                 const moveHex = GAME.getHex(moveHexId, state);
                 const currentDist = GAME.axialDistance(moveHex.q, moveHex.r, targetObjHex.q, targetObjHex.r);
                 
                 // Score: Closer is better. Stronger unit is better.
                 const score = (100 - currentDist) + unit.value; 
                 if (score > bestAdvanceScore) {
                     bestAdvanceScore = score;
                     bestUnitToAdvance = unit;
                     bestAdvanceTarget = moveHexId;
                 }
             }
        }
        
        if (bestUnitToAdvance && bestAdvanceTarget) {
            bestMove = { actionType: 'MOVE', unitHexId: bestUnitToAdvance.hexId, targetHexId: bestAdvanceTarget };
        }
    }

    if (!bestMove) {
        // --- Priority 3: Exploration ---
        // Move to hexes that are currently NOT visible (or adjacent to them) to expand vision.
        // Simplified: Move to a hex that has neighbors NOT in visibleHexes.
        
        for (const unit of availableUnits) {
             const validMoves = GAME.calcValidMoves(unit.hexId, false, state);
             const moveCandidates = validMoves.filter(hid => !GAME.getUnitOnHex(hid, state));

             for (const moveHexId of moveCandidates) {
                 const moveHex = GAME.getHex(moveHexId, state);
                 const neighbors = GAME.getNeighbors(moveHex, state);
                 // Count how many neighbors are currently unknown/fogged
                 const fogNeighbors = neighbors.filter(n => !visibleHexes.has(n.id)).length;
                 
                 if (fogNeighbors > 0) {
                     bestMove = { actionType: 'MOVE', unitHexId: unit.hexId, targetHexId: moveHexId };
                     break; // Found one, take it.
                 }
             }
             if (bestMove) break;
        }
    }

    if (!bestMove) {
         // --- Priority 4: Merging ---
         // Check adjacent friendly units.
         for (const unit of availableUnits) {
             const validMerges = GAME.calcValidMoves(unit.hexId, true, state);
             for (const targetHexId of validMerges) {
                  const targetUnit = GAME.getUnitOnHex(targetHexId, state);
                  if (targetUnit) {
                       const sum = unit.value + targetUnit.value;
                       // Prioritize Sum > 6
                       if (sum > 6) {
                            bestMove = { actionType: 'MERGE', unitHexId: unit.hexId, targetHexId: targetHexId };
                            break;
                       }
                  }
             }
             if (bestMove) break;
         }
    }

    if (!bestMove) {
        // --- Priority 5: Guard ---
        // If unit threatened. Since we calculated threats in Minimax, we can reuse simplified logic here.
        // Or just Guard if ANY enemy is visible nearby.
        for (const unit of availableUnits) {
             // Check if any visible enemy can attack this unit
             let threatened = false;
             // Slow check: iterate all visible enemies
             // Optimization: Just check if unit is High Value (>3).
             if (unit.value > 3 && !unit.isGuarding) {
                  bestMove = { actionType: 'GUARD', unitHexId: unit.hexId };
                  break;
             }
        }
    }

    if (!bestMove) {
        // --- Priority 6: Reroll ---
        // Safe and Low Value.
        for (const unit of availableUnits) {
            if (unit.value <= 2) {
                 bestMove = { actionType: 'REROLL', unitHexId: unit.hexId };
                 break;
            }
        }
    }

    if (!bestMove) {
         // Fallback: End Turn
         bestMove = { actionType: 'END_TURN' };
    }

    console.log("AI Priority Bot selected:", bestMove);
    applyMove(GAME, bestMove);
}

function calculateVisibility(GAME, state, playerIndex) {
    const visibleHexes = new Set();
    const player = state.players[playerIndex];
    const units = player.dice.filter(d => d.isDeployed && !d.isDeath);

    units.forEach(unit => {
        const unitHex = GAME.getHex(unit.hexId, state);
        if (!unitHex) return;

        // Base Vision Range
        let visionRange = (unit.value === 2) ? 3 : 2;
        
        // Terrain Modifiers
        // Assuming hex objects have terrain property (Forest, Mountain, etc.)
        // This relies on GAME map structure.
        if (unitHex.terrain === 'forest') visionRange -= 1;
        if (unitHex.terrain === 'mountain') visionRange += 1;

        // BFS or simple Range loop to find hexes
        // Since max range is small (3), we can iterate hexes in range.
        // We need a helper to get hexes in range (ignoring obstacles for the list, then checking LoS).
        // Since GAME might not have `getHexesInRange`, we can rely on `getNeighbors` recursively or specific math.
        // For simplicity, let's assume a hypothetical simple range calculation:
        
        const candidates = getHexesInRadialRange(GAME, unitHex, visionRange, state);
        
        candidates.forEach(targetHex => {
            if (hasLineOfSight(GAME, unitHex, targetHex, state)) {
                visibleHexes.add(targetHex.id);
            }
        });
    });
    
    // Base/Deployment areas are always visible
    // Add logic here if needed.

    return visibleHexes;
}

function getHexesInRadialRange(GAME, centerHex, N, state) {
    // Basic axial coordinate range check
    const results = [];
    const { q, r, s } = centerHex;
    
    // Iterate -N to +N
    for (let dq = -N; dq <= N; dq++) {
        for (let dr = -N; dr <= N; dr++) {
            const ds = -dq - dr;
            if (Math.abs(ds) <= N) {
                const targetQ = q + dq;
                const targetR = r + dr;
                const targetHex = GAME.getHexByQR(targetQ, targetR, state);
                if (targetHex) results.push(targetHex);
            }
        }
    }
    return results;
}

function hasLineOfSight(GAME, startHex, endHex, state) {
    const dist = GAME.axialDistance(startHex.q, startHex.r, endHex.q, endHex.r);
    if (dist <= 1) return true; // Adjacent always visible

    // Lerp to check intervening hexes
    // N steps = distance
    for (let i = 1; i < dist; i++) {
        const t = i / dist;
        const q = startHex.q + (endHex.q - startHex.q) * t;
        const r = startHex.r + (endHex.r - startHex.r) * t;
        
        // Round to nearest hex
        const hex = GAME.getHexByQR(Math.round(q), Math.round(r), state); // Simplistic rounding, might need `axialRound`
        
        if (hex) {
             // Check blocking terrain
             if (hex.terrain === 'forest' || hex.terrain === 'mountain' || hex.terrain === 'tower') {
                 return false; 
             }
        }
    }
    return true;
}
