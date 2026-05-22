(function(){
	const AM = {
		debug: true, // enable for console traces
		audioCtx: null,
		buffers: {},
		musicEl: null,
		gainNode: null,
		basePaths: ['/assets/sounds'],
		init() {
			try {
				if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
				if (!this.gainNode) this.gainNode = this.audioCtx.createGain();
				this.gainNode.connect(this.audioCtx.destination);
				if (this.debug) console.debug('AudioManager: init AudioContext');
			} catch (e) {
				if (this.debug) console.warn('AudioManager: init failed', e);
			}
		},
		resume() {
			try { if (this.audioCtx && this.audioCtx.state === 'suspended') this.audioCtx.resume(); } catch(e) { if (this.debug) console.warn(e); }
		},
		async loadSfx(name) {
			if (!this.audioCtx) this.init();
			const exts = ['.wav','.ogg','.mp3']; // prefer local .wav copies
			for (const p of this.basePaths) {
				for (const ext of exts) {
					const url = `${p}/${name}${ext}`;
					try {
						const res = await fetch(url);
						if (!res.ok) { if (this.debug) console.debug('AudioManager: not found', url); continue; }
						const ab = await res.arrayBuffer();
						const buf = await this.audioCtx.decodeAudioData(ab.slice(0));
						this.buffers[name] = buf;
						if (this.debug) console.debug('AudioManager: loaded buffer', name, url);
						return;
					} catch (e) {
						if (this.debug) console.debug('AudioManager: load failed', url, e);
						// ignore and try next
					}
				}
			}
			if (this.debug) console.debug('AudioManager: no file found for', name);
		},
		async loadDefaults() {
			this.init();
			const names = 'attack,death,deflect,fumble,hit,merge,shield,skirmish,spell,swap,transmute,victory,levelup,move,battle'.split(',');
			for (const n of names) {
				this.loadSfx(n).catch((e)=>{ if (this.debug) console.debug('loadDefaults error', n, e); });
			}
		},
		playSfx(name, opts = {}) {
			try {
				console.log('playSfx', name);
				if (!this.audioCtx) this.init();
				this.resume();
				const buf = this.buffers[name];
				const volume = typeof opts.volume === 'number' ? opts.volume : 1;
				const playbackRate = typeof opts.playbackRate === 'number' ? opts.playbackRate : 1;
				if (buf && this.audioCtx) {
					const src = this.audioCtx.createBufferSource();
					src.buffer = buf;
					src.playbackRate.value = playbackRate;
					const g = this.audioCtx.createGain();
					g.gain.value = volume;
					src.connect(g);
					g.connect(this.gainNode || this.audioCtx.destination);
					src.start(0);
					if (this.debug) console.debug('AudioManager: played buffer', name);
					return;
				}
				// Fallback to HTMLAudioElement, check basePaths and preferred extensions
				const exts = ['.wav','.ogg','.mp3'];
				for (const p of this.basePaths) {
					for (const ext of exts) {
						const url = `${p}/${name}${ext}`;
						try {
							const a = new Audio(url);
							a.volume = volume;
							a.playbackRate = playbackRate;
							a.play().catch((e)=>{ if (this.debug) console.debug('AudioManager: fallback play failed', url, e); });
							if (this.debug) console.debug('AudioManager: played via HTMLAudio', url);
							return;
						} catch (e) { if (this.debug) console.debug('AudioManager: HTMLAudio error', url, e); }
					}
				}
				if (this.debug) console.debug('AudioManager: no audio found to play for', name);
			} catch (e) {
				if (this.debug) console.warn('AudioManager: playSfx error', e);
				// ignore
			}
		},
		battlePlaylist: ["Astos","Battle_of_Another_Side","BlackDragon","DR_GS2_FelixBattle","DR_GS_BossBattle_V1_5","FE-TogetherWeRide","FEKnight","FETSS-PF","FETSS-TDH","FF1_-_Battle_Scene","FF1_-_Inside_a_Boss_Battle","FF2Final","FF2_-_Battle_Scene_1","FF5_Battle","FFIV-Creepy_Doll_Battle","Final_Fantasy_Tactics_Advance-Snow_Battle","GS2Jenna","GSLA_agatio_battle","GS_Battle","GS_MoapaBattle","GS_VICTORY","GoldenSun2_BoatBattles_GMv250","GoldenSun2_BossBattle","GoldenSun2_ThemeArg1","GoldenSunRises","GoldenSun_SaturosBattleGMv102","Golden_Sun_-_Victory_fanfare","Golden_Sun_3","Golden_sun_theme","Human1gm","Human2gm","Human3gm","Human4gm","KHCOM-AnsemBattle","KHCOM-MarluxiaBattle","KHCOM-RikuBattle","Marluxia2","Orc1gm","Orc2gm","Orc3gm","Orc4gm","Sacred_Strength","Saturos","Twilight_Town_Battle","com_XIII_boss","emblem_fin","fe6_final","fe7-arenabattle","golden_sun_-_battle_theme","gs-batt","gs-colosso-battle","vgKHCOMprebattle"],
		playMusic(name, opts = {}) {
			try {
				if (this.musicEl) this.stopMusic();
				if (name === 'battle') {
					const randomTrack = this.battlePlaylist[Math.floor(Math.random() * this.battlePlaylist.length)];
					name = `battles/${randomTrack}`;
				}
				const volume = typeof opts.volume === 'number' ? opts.volume : 0.6;
				const exts = ['.mid','.wav','.ogg','.mp3'];
				for (const p of this.basePaths) {
					for (const ext of exts) {
						const url = `${p}/${name}${ext}`;
						try {
							this.musicEl = new Audio(url);
							this.musicEl.loop = opts.loop !== false && !name.includes('battles/');
							this.musicEl.volume = volume;
							this.musicEl.play().catch((e)=>{ if (this.debug) console.debug('AudioManager: music play failed', url, e); });
							if (name.includes('battles/')) {
								this.musicEl.onended = () => this.playMusic('battle', opts);
							}
							if (this.debug) console.debug('AudioManager: music playing', url);
							return;
						} catch (e) { if (this.debug) console.debug('AudioManager: music error', url, e); }
					}
				}
				if (this.debug) console.debug('AudioManager: no music found for', name);
			} catch (e) { if (this.debug) console.warn(e); }
		},
		stopMusic() {
			try {
				if (this.musicEl) {
					this.musicEl.pause();
					this.musicEl.src = '';
					this.musicEl = null;
					if (this.debug) console.debug('AudioManager: music stopped');
				}
			} catch (e) { if (this.debug) console.warn(e); }
		},
		// Debug helpers
		listBuffers() { return Object.keys(this.buffers); },
		testAll(delay = 300) {
			const names = ['attack','hit','deflect','merge','spell','fumble'];
			names.forEach((n,i)=> setTimeout(()=>{ try{ this.playSfx(n); if (this.debug) console.debug('test play', n); }catch(e){ if (this.debug) console.debug(e); } }, i*delay));
		},
		unitSounds: {
			'1': ["Hdempis4","Hdempis5","Hdempis6","Hdempis7","Hhelp1","Hhelp2","Hpissed1","Hpissed2","Hpissed3","Hpissed4","Hpissed5","Hpissed6","Hpissed7","Hready","Hwhat1","Hwhat2","Hwhat3","Hwhat4","Hwhat5","Hwhat6","Hwrkdone","Hyessir1","Hyessir2","Hyessir3","Hyessir4"],
			'2': ["Epissed1","Epissed2","Epissed3","Eready","Ewhat1","Ewhat2","Ewhat3","Ewhat4","Eyessir1","Eyessir2","Eyessir3","Eyessir4"],
			'3': ["Griffon1","Griffon2","Grwhat"],
			'4': ["Knpissd1","Knpissd2","Knpissd3","Knready","Knwhat1","Knwhat2","Knwhat3","Knwhat4","Knyessr1","Knyessr2","Knyessr3","Knyessr4"],
			'5': ["Pkatak1","Pkpissd1","Pkpissd2","Pkpissd3","Pkready","Pkwhat1","Pkwhat2","Pkwhat3","Pkwhat4","Pkyessr1","Pkyessr2","Pkyessr3","Pkyessr4"],
			'6': ["Wzpissd1","Wzpissd2","Wzpissd3","Wzready","Wzwhat1","Wzwhat2","Wzwhat3","Wzyessr1","Wzyessr2","Wzyessr3"]
		},
		playUnitSound(unitValue) {
			if (this.debug) console.debug('AudioManager: playUnitSound', unitValue);
			const sounds = this.unitSounds[unitValue];
			if (sounds && sounds.length > 0) {
				const sound = sounds[Math.floor(Math.random() * sounds.length)];
				// The files are in assets/sounds/<unitValue>/<filename>.wav
				// We can try to play it using a modified path
				this.playSfx(`${unitValue}/${sound}`);
			}
		}
	};
	window.AudioManager = AM;
})();
