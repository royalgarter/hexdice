/**
 * StoryEngine - Loads and serves narrative content for the Journey of the Six campaign.
 * Provides per-level intros, quest text, region flavor, arc progression, and boss encounters.
 */
const StoryEngine = {
	db: null,
	_seen: {},

	async init() {
		const res = await fetch('/js/campaign/ro_quest_db.json');
		this.db = await res.json();
		this.db.regions.forEach(r => {
			r._questIdx = 0;
		});
	},

	_seededRandom(levelNum, max) {
		const x = Math.sin(levelNum * 12.9898) * 43758.5453;
		return Math.floor((x - Math.floor(x)) * max);
	},

	getRegionForLevel(levelNum) {
		if (!this.db) return null;
		return this.db.regions.find(r => levelNum >= r.levelRange[0] && levelNum <= r.levelRange[1]) || null;
	},

	getArcForLevel(levelNum) {
		if (!this.db) return null;
		return this.db.arcs.find(a => levelNum >= a.levels[0] && levelNum <= a.levels[1]) || null;
	},

	getLevelData(levelNum) {
		if (!this.db) return null;
		return this.db.levels[levelNum] || null;
	},

	getBossForLevel(levelNum) {
		if (!this.db) return null;
		return this.db.bosses[levelNum] || null;
	},

	getLevelInfo(levelNum) {
		const region = this.getRegionForLevel(levelNum);
		const arc = this.getArcForLevel(levelNum);
		const level = this.getLevelData(levelNum);
		const boss = this.getBossForLevel(levelNum);
		return { region, arc, level, boss };
	},

	getIntro(levelNum) {
		const info = this.getLevelInfo(levelNum);
		if (info.boss) return info.boss.intro;
		if (info.level && info.level.intro) return info.level.intro;

		const region = info.region;
		if (!region) return 'The journey continues.';

		const idx = this._seededRandom(levelNum, region.quests.length);
		return `${region.intro}\n\n${region.quests[idx]}`;
	},

	getOutro(levelNum) {
		const info = this.getLevelInfo(levelNum);
		if (info.boss) return info.boss.outro;
		if (info.level && info.level.outro) return info.level.outro;

		const region = info.region;
		if (!region) return 'Victory is yours.';

		const idx = this._seededRandom(levelNum + 100, region.outros.length);
		return region.outros[idx];
	},

	getQuest(levelNum) {
		const info = this.getLevelInfo(levelNum);
		if (info.level && info.level.quest) return info.level.quest;
		const region = info.region;
		if (!region) return 'Defeat all enemies.';
		const idx = this._seededRandom(levelNum, region.quests.length);
		return region.quests[idx];
	},

	getTitle(levelNum) {
		const info = this.getLevelInfo(levelNum);
		if (info.level && info.level.title) return info.level.title;
		return `Level ${levelNum}`;
	},

	getNPC(levelNum) {
		const info = this.getLevelInfo(levelNum);
		if (info.level && info.level.npc) return info.level.npc;
		if (info.region) return info.region.npc;
		return 'Mysterious Figure';
	},

	getEnemyFlavor(levelNum) {
		const region = this.getRegionForLevel(levelNum);
		return region ? region.enemyFlavor : 'mysterious foes';
	},

	getRegionName(levelNum) {
		const region = this.getRegionForLevel(levelNum);
		return region ? region.name : 'Unknown Territory';
	},

	getArcName(levelNum) {
		const arc = this.getArcForLevel(levelNum);
		return arc ? arc.name : 'Beyond the Known';
	},

	getArcSummary(levelNum) {
		const arc = this.getArcForLevel(levelNum);
		if (!arc) return '';
		const [start, end] = arc.levels;
		const progress = Math.min(100, Math.round(((levelNum - start) / (end - start)) * 100));
		return { name: arc.name, summary: arc.summary, progress, start, end };
	},

	isBossLevel(levelNum) {
		return !!this.getBossForLevel(levelNum);
	},

	getDialogue(levelNum, type) {
		if (!this.db || !this.db.dialogue) return null;
		return this.db.dialogue.find(d => d.level === levelNum && d.type === type) || null;
	},

	markSeen(levelNum) {
		this._seen[levelNum] = true;
	},

	hasSeen(levelNum) {
		return !!this._seen[levelNum];
	}
};
