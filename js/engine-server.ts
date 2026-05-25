/**
 * Hex Dice Server-Side Engine
 * 
 * Reuses client-side logic in a Deno environment for authoritative computation.
 */

export interface GameEngine {
	createGame: () => any;
	Autochess: any;
	CampaignManager: any;
}

export async function loadEngine(playerCount: number = 2, version: number = 2): Promise<GameEngine> {
	const locationStub = {
		search: `?mode=headless&players=${playerCount}&version=${version}&autochess=true`,
		href: `https://hexdice.local/`,
		toString: () => `https://hexdice.local/`
	};
	
	const documentStub = {
		getElementById: () => null,
		querySelector: () => ({ content: 'headless' }),
	};

	const gameCode = await Deno.readTextFile("./js/game.js");
	const autochessCode = await Deno.readTextFile("./js/autochess.js");
	const aiCoreCode = await Deno.readTextFile("./js/ai/ai.js");
	const aiHeuristicCode = await Deno.readTextFile("./js/ai/ai-heuristic.js");
	const aiHeuristicProfiles = await Deno.readTextFile("./js/ai/heuristic-profiles.js");
	const campaignManagerCode = await Deno.readTextFile("./js/campaign/campaign-manager.js");
	const constantsCode = await Deno.readTextFile("./js/constants.js");

	// Combine all code
	const fullCode = `
		const window = globalThis;
		const self = globalThis;
		
		// Browser stubs
		window.location = location;
		window.document = document;
		window.alert = (msg) => console.log('ALERT:', msg);
		window.localStorage = {
			getItem: () => null,
			setItem: () => null,
			removeItem: () => null
		};
		window.navigator = { serviceWorker: { register: () => Promise.resolve() } };
		window.AudioContext = class {};
		window.google = { accounts: { id: { initialize: () => {}, renderButton: () => {}, prompt: () => {} } } };
		window.Alpine = { $data: () => ({}), initTree: () => {} };

		${constantsCode}
		${campaignManagerCode}
		${autochessCode}
		${gameCode}
		${aiCoreCode}
		${aiHeuristicProfiles}
		${aiHeuristicCode}

		return {
			createGame: alpineHexDiceTacticGame,
			Autochess: Autochess,
			CampaignManager: CampaignManager
		};
	`;

	const createModule = new Function('location', 'document', fullCode);
	return createModule(locationStub, documentStub);
}
