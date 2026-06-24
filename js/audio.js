(function(){
	const AM = {
		debug: true, // enable for console traces
		audioCtx: null,
		buffers: {},
		noSFX: false,
		musicEl: null,
		gainNode: null,
		basePaths: [`${HEXDICE_CDN}/sounds`],

		isRemoteUrl(name) {
			return /^(https?:)?\/\//.test(name) && /\.(mp3|ogg|flac|wav|aac|m4a|webm)$/i.test(name);
		},

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

				if (this.isRemoteUrl(name)) {
					const a = new Audio(name);
					a.volume = typeof opts.volume === 'number' ? opts.volume : 0.6;
					a.playbackRate = typeof opts.playbackRate === 'number' ? opts.playbackRate : 1;
					a.play().catch((e)=>{ if (this.debug) console.debug('AudioManager: remote playSfx failed', name, e); });
					return;
				}

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

		battlePlaylist: BATTLE_PLAYLIST,
		campaignPlaylist: null,

		async loadCampaignPlaylist() {
			if (this.campaignPlaylist) return;
			try {
				const res = await fetch(`${HEXDICE_CDN}/sounds/ragnarok.json`);
				if (res.ok) {
					const data = await res.json();
					if (Array.isArray(data)) {
						this.campaignPlaylist = { tracks: data, zones: {} };
					} else {
						this.campaignPlaylist = data;
					}
					if (this.debug) console.debug('AudioManager: loaded campaign playlist');
				}
			} catch (e) {
				if (this.debug) console.warn('AudioManager: loadCampaignPlaylist failed', e);
			}
		},

		_resolveCampaignTrack(opts) {
			const playlist = this.campaignPlaylist;
			if (!playlist || !playlist.tracks || playlist.tracks.length === 0) return null;

			const mapName = opts?.mapName || '';
			if (mapName && playlist.zones) {
				const prefix = mapName.replace(/\d+$/, '').replace(/_0$/, '');
				const keys = Object.keys(playlist.zones).sort((a, b) => b.length - a.length);
				for (const key of keys) {
					if (prefix.startsWith(key)) {
						const indices = playlist.zones[key];
						const idx = indices[Math.floor(Math.random() * indices.length)];
						if (typeof idx === 'number' && playlist.tracks[idx]) {
							return playlist.tracks[idx];
						}
					}
				}
			}

			return playlist.tracks[Math.floor(Math.random() * playlist.tracks.length)];
		},

		async playMusic(name, opts = {}) {
			try {
				if (this.musicEl) this.stopMusic();

				if (name === 'campaign') {
					if (!this.campaignPlaylist) await this.loadCampaignPlaylist();
					const resolved = this._resolveCampaignTrack(opts);
					if (resolved) {
						name = resolved;
					} else {
						name = 'battle'; // Fallback
					}
				}

				if (name === 'battle') {
					const randomTrack = BATTLE_PLAYLIST[Math.floor(Math.random() * BATTLE_PLAYLIST.length)];
					name = `battles/${randomTrack}`;
				}

				if (name === 'queue') {
					const randomTrack = QUEUE_PLAYLIST[Math.floor(Math.random() * QUEUE_PLAYLIST.length)];
					name = `queue/${randomTrack}`;
				}

				const volume = typeof opts.volume === 'number' ? opts.volume : 0.5;

				// Handle full URL or remote URL
				if (this.isRemoteUrl(name) || name.startsWith('/')) {
					this._playMusicUrl(name, volume, opts);
					return;
				}

				for (const p of this.basePaths) {
					for (const ext of EXT_SOUNDS) {
						const url = `${p}/${name}${ext}`;
						try {
							if (this._playMusicUrl(url, volume, opts)) return;
						} catch (e) { if (this.debug) console.debug('AudioManager: music error', url, e); }
					}
				}
				if (this.debug) console.debug('AudioManager: no music found for', name);
			} catch (e) { if (this.debug) console.warn(e); }
		},

		_playMusicUrl(url, volume, opts = {}) {
			try {
				this.musicEl = new Audio(url);
				this.musicEl.loop = opts.loop !== false && !url.includes('battles/');
				this.musicEl.volume = volume;
				this.musicEl.play().catch((e)=>{ if (this.debug) console.debug('AudioManager: music play failed', url, e); });
				
				this.musicEl.onended = () => {
					if (url.includes('battles/')) {
						this.playMusic('battle', opts);
					} else if (this.campaignPlaylist?.tracks?.includes(url)) {
						this.playMusic('campaign', opts);
					}
				};

				if (this.debug) console.debug('AudioManager: music playing', url);
				return true;
			} catch (e) {
				if (this.debug) console.warn('AudioManager: _playMusicUrl failed', url, e);
				return false;
			}
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
