(function(){
	const AM = {
		debug: true, // enable for console traces
		audioCtx: null,
		buffers: {},
		noSFX: false,
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
			for (const p of this.basePaths) {
				for (const ext of EXT_SOUNDS) {
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
			for (const n of SFX_NAMES) {
				this.loadSfx(n).catch((e)=>{ if (this.debug) console.debug('loadDefaults error', n, e); });
			}
		},

		playSfx(name, opts = {}) {
			try {
				if (this.noSFX) return;

				// console.log('playSfx', name);

				switch (name) {
					case 'bow': name = 'bow'+[1,2].random(); break;
					case 'hit': name = 'hit'+[1,2,3,4,5,6].random(); break;
					case 'sword': name = 'sword'+[1,2,3].random(); break;
				}
				
				if (!this.audioCtx) this.init();
				this.resume();

				const buf = this.buffers[name];
				const volume = typeof opts.volume === 'number' ? opts.volume : 0.6;
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
				for (const p of this.basePaths) {
					for (const ext of EXT_SOUNDS) {
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

		playMusic(name, opts = {}) {
			try {
				if (this.musicEl) this.stopMusic();

				if (name === 'battle') {
					const randomTrack = BATTLE_PLAYLIST[Math.floor(Math.random() * BATTLE_PLAYLIST.length)];
					name = `battles/${randomTrack}`;
				}

				if (name === 'queue') {
					const randomTrack = QUEUE_PLAYLIST[Math.floor(Math.random() * QUEUE_PLAYLIST.length)];
					name = `queue/${randomTrack}`;
				}

				const volume = typeof opts.volume === 'number' ? opts.volume : 0.5;
				for (const p of this.basePaths) {
					for (const ext of EXT_SOUNDS) {
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
			SFX_NAMES.forEach((n,i)=> setTimeout(()=>{ try{ this.playSfx(n); if (this.debug) console.debug('test play', n); }catch(e){ if (this.debug) console.debug(e); } }, i*delay));
		},

		unitSounds: UNIT_SOUNDS,

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
