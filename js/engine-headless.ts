/**
 * Headless engine loader shared by simulate.ts and the puzzle tools.
 * Evaluates the browser game code under Node/Deno-style stubs (no DOM, no network).
 */

// Stub browser APIs for headless execution
export function stubBrowserAPIs(playerCount: number = 2, version: number = 1, autochess: boolean = false) {
	const search = `?mode=headless&players=${playerCount}&version=${version}${autochess ? '&autochess=true' : ''}`;
	// Stub location
	const locationStub = {
		search,
		href: `https://hexdice.local/${search}`,
		toString: () => `https://hexdice.local/${search}`,
		assign: () => null,
		replace: () => null,
		reload: () => null,
		host: 'hexdice.local',
		hostname: 'hexdice.local',
		origin: 'https://hexdice.local',
		pathname: '/',
		protocol: 'https:',
	};

	// Stub document
	const documentStub = {
		getElementById: () => null,
		querySelector: () => ({ content: '', innerHTML: '' }),
		querySelectorAll: () => [],
		addEventListener: () => null,
		removeEventListener: () => null,
		createElement: () => ({ style: {}, appendChild: () => null }),
		body: { appendChild: () => null },
		head: { appendChild: () => null },
	};

	// Stub localStorage
	(globalThis as any).localStorage = {
		getItem: () => null,
		setItem: () => null,
		removeItem: () => null,
		clear: () => null,
	};

	if (typeof (globalThis as any).window === 'undefined') {
		(globalThis as any).window = globalThis;
	}
	(globalThis as any).window.location = locationStub;
	(globalThis as any).window.history = { replaceState: () => null, pushState: () => null };
	(globalThis as any).alert = () => null;
	if (typeof (globalThis as any).requestAnimationFrame === 'undefined') {
		(globalThis as any).requestAnimationFrame = (fn: any) => setTimeout(fn, 0);
		(globalThis as any).cancelAnimationFrame = (id: any) => clearTimeout(id);
	}
	if (typeof (globalThis as any).Alpine === 'undefined') {
		(globalThis as any).Alpine = { initTree: () => null, store: () => null, data: () => null, magic: () => null, $data: () => ({}) };
	}

	// Stub $nextTick (Vue.js) - use synchronous execution for simulation
	(globalThis as any).$nextTick = (fn: any) => {
		try { fn(); } catch(e) { /* ignore */ }
	};

	// Stub fetch for assets
	(globalThis as any).fetch = (url: string) => {
		if (url.includes('sets.json')) {
			return Promise.resolve({
				json: () => Promise.resolve([])
			});
		}
		return Promise.resolve({
			json: () => Promise.resolve({})
		});
	};

	return { location: locationStub, document: documentStub };
}


export async function loadGameEngine(playerCount: number = 2, version: number = 1, autochess: boolean = false): Promise<any> {
    const { location: locationStub, document: documentStub } = stubBrowserAPIs(playerCount, version, autochess);

    const constantsCode = await Deno.readTextFile("./js/constants.js");
    const autochessCode = await Deno.readTextFile("./js/autochess.js");
    const gameCode = await Deno.readTextFile("./js/game.js");
    const aiCoreCode = await Deno.readTextFile("./js/ai/ai.js");
    const aiHeuristicCode = await Deno.readTextFile("./js/ai/ai-heuristic.js");
    const aiHeuristicProfiles = await Deno.readTextFile("./js/ai/heuristic-profiles.js");
    const campaignManagerCode = await Deno.readTextFile("./js/campaign/campaign-manager.js");

    // Combine all code (game.js has its own seeded random + setSeed)
    const fullCode = `
        ${constantsCode}
        ${autochessCode}
        var StoryEngine = { init: () => null, getDialogue: () => null, getRegion: () => null, getArc: () => null, getBoss: () => null, getRewardHint: () => null, getNpcDialogue: () => null };
        ${gameCode}
        ${campaignManagerCode}
        ${aiHeuristicProfiles}
        ${aiCoreCode}
        ${aiHeuristicCode}

        // Seed for reproducibility
        if (typeof setSeed === 'function') {
            setSeed(${Date.now()});
        }

        // Return exports object
        return {
            createGame: alpineHexDiceTacticGame,
            setRandomSeed: typeof setSeed === 'function' ? setSeed : null,
            random: typeof random === 'function' ? () => random() : () => Math.random(),
            AUTOCHESS_CONFIG: typeof AUTOCHESS_CONFIG !== 'undefined' ? AUTOCHESS_CONFIG : null,
            heuristicProfiles: typeof heuristicProfiles !== 'undefined' ? heuristicProfiles : {},
            performAIByHeuristic: typeof performAIByHeuristic !== 'undefined' ? performAIByHeuristic : null,
            generateAllPossibleMoves: typeof generateAllPossibleMoves !== 'undefined' ? generateAllPossibleMoves : null,
            applyMove: typeof applyMove !== 'undefined' ? applyMove : null,
            saveSnapshot: typeof _saveHeuristicSnapshot !== 'undefined' ? _saveHeuristicSnapshot : null,
            restoreSnapshot: typeof _restoreHeuristicSnapshot !== 'undefined' ? _restoreHeuristicSnapshot : null,
            boardEvaluation: typeof boardEvaluation !== 'undefined' ? boardEvaluation : function() { return 0; },
        };
    `;
	// Evaluate and get exports using Function constructor
	const createModule = new Function('location', 'document', fullCode);

	return createModule(locationStub, documentStub);
}

