const CACHE_NAME = 'hexdice-cache-v3';
const urlsToCache = [
	'/',
	'/index.html',
	'/rules.html',
	// Core JS files
	'/game.js',
	'/alpine.min.js',
	'/litewind.css',
	// Rules markdown files
	'/rules.md',
	'/rules/v1.0.md',
	'/rules/v1.0.1.md',
	'/rules/v1.1.md',
	'/rules/v1.2.md',
	'/rules/v1.3.md',
	'/rules/v1.4.md',
	// AI files
	'/ai/ai.js',
	'/ai/ai-heuristic.js',
	'/ai/ai-minimax.js',
	'/ai/ai-priority.js',
	'/ai/ai-random.js',
	'/ai/heuristic-profiles.js',
	// Root assets
	'/board.png',
	'/hex.png',
	// Icons
	'/assets/images/android-chrome-192x192.png',
	'/assets/images/android-chrome-512x512.png',
	'/assets/images/apple-touch-icon.png',
	'/assets/images/favicon-16x16.png',
	'/assets/images/favicon-32x32.png',
	'/assets/images/favicon.ico',
	'/assets/images/favicon.png',
	'/assets/images/site.webmanifest',
	// iOS icons
	'/assets/icons/ios/192.png',
	'/assets/icons/ios/512.png',
	// Sprite images for dice
	'/assets/sprites/multi_players/d1_black.gif',
	'/assets/sprites/multi_players/d1_blue.gif',
	'/assets/sprites/multi_players/d1_brown.gif',
	'/assets/sprites/multi_players/d1_fe8.webp',
	'/assets/sprites/multi_players/d1_gold.gif',
	'/assets/sprites/multi_players/d1_green.gif',
	'/assets/sprites/multi_players/d1_purple.gif',
	'/assets/sprites/multi_players/d1_red.gif',
	'/assets/sprites/multi_players/d1_white.gif',
	'/assets/sprites/multi_players/d1_yellow.gif',
	'/assets/sprites/multi_players/d2_black.gif',
	'/assets/sprites/multi_players/d2_blue.gif',
	'/assets/sprites/multi_players/d2_brown.gif',
	'/assets/sprites/multi_players/d2_fe8.webp',
	'/assets/sprites/multi_players/d2_gold.gif',
	'/assets/sprites/multi_players/d2_green.gif',
	'/assets/sprites/multi_players/d2_purple.gif',
	'/assets/sprites/multi_players/d2_red.gif',
	'/assets/sprites/multi_players/d2_white.gif',
	'/assets/sprites/multi_players/d2_yellow.gif',
	'/assets/sprites/multi_players/d3_black.gif',
	'/assets/sprites/multi_players/d3_blue.gif',
	'/assets/sprites/multi_players/d3_brown.gif',
	'/assets/sprites/multi_players/d3_fe8.webp',
	'/assets/sprites/multi_players/d3_gold.gif',
	'/assets/sprites/multi_players/d3_green.gif',
	'/assets/sprites/multi_players/d3_purple.gif',
	'/assets/sprites/multi_players/d3_red.gif',
	'/assets/sprites/multi_players/d3_white.gif',
	'/assets/sprites/multi_players/d3_yellow.gif',
	'/assets/sprites/multi_players/d4_black.gif',
	'/assets/sprites/multi_players/d4_blue.gif',
	'/assets/sprites/multi_players/d4_brown.gif',
	'/assets/sprites/multi_players/d4_fe8.webp',
	'/assets/sprites/multi_players/d4_gold.gif',
	'/assets/sprites/multi_players/d4_green.gif',
	'/assets/sprites/multi_players/d4_purple.gif',
	'/assets/sprites/multi_players/d4_red.gif',
	'/assets/sprites/multi_players/d4_white.gif',
	'/assets/sprites/multi_players/d4_yellow.gif',
	'/assets/sprites/multi_players/d5_black.gif',
	'/assets/sprites/multi_players/d5_blue.gif',
	'/assets/sprites/multi_players/d5_brown.gif',
	'/assets/sprites/multi_players/d5_fe8.webp',
	'/assets/sprites/multi_players/d5_gold.gif',
	'/assets/sprites/multi_players/d5_green.gif',
	'/assets/sprites/multi_players/d5_purple.gif',
	'/assets/sprites/multi_players/d5_red.gif',
	'/assets/sprites/multi_players/d5_white.gif',
	'/assets/sprites/multi_players/d5_yellow.gif',
	'/assets/sprites/multi_players/d6_black.gif',
	'/assets/sprites/multi_players/d6_blue.gif',
	'/assets/sprites/multi_players/d6_brown.gif',
	'/assets/sprites/multi_players/d6_fe8.webp',
	'/assets/sprites/multi_players/d6_gold.gif',
	'/assets/sprites/multi_players/d6_green.gif',
	'/assets/sprites/multi_players/d6_purple.gif',
	'/assets/sprites/multi_players/d6_red.gif',
	'/assets/sprites/multi_players/d6_white.gif',
	'/assets/sprites/multi_players/d6_yellow.gif',
];

self.addEventListener('install', (event) => {
	console.log('Service Worker installing...');
	event.waitUntil(
		caches.open(CACHE_NAME)
			.then((cache) => {
				console.log('Opened cache');
				return cache.addAll(urlsToCache);
			})
			.then(() => {
				console.log('Service Worker installed successfully');
				return self.skipWaiting();
			})
			.catch((error) => {
				console.error('Service Worker installation failed:', error);
			})
	);
});

function fetchEvent(event) {
	return fetch(event.request).then(
		(response) => {
			// Check if we received a valid response
			if (!response || response.status !== 200 || response.type !== 'basic') {
				return response;
			}

			// Clone the response to cache it
			const responseToCache = response.clone();

			caches.open(CACHE_NAME)
				.then((cache) => {
					cache.put(event.request, responseToCache);
				});

			return response;
		}
	).catch(() => {
		// If both cache and network fail, return offline fallback
		if (event.request.destination === 'document') {
			return caches.match('/');
		}
		return new Response('Offline - resource not cached', {
			headers: { 'Content-Type': 'text/plain' }
		});
	});
}

self.addEventListener('fetch', (event) => {
	// Skip cross-origin requests
	if (!event.request.url.startsWith(self.location.origin)) {
		return;
	}

	event.respondWith(
		caches.match(event.request)
			.then((response) => {
				// Cache hit, return response
				if (response) {
					fetchEvent(event);
					return response;
				}
				// Not in cache, fetch from network

				return fetchEvent(event);
			})
	);
});

self.addEventListener('activate', (event) => {
	const cacheWhitelist = [CACHE_NAME];
	event.waitUntil(
		caches.keys().then((cacheNames) => {
			return Promise.all(
				cacheNames.map((cacheName) => {
					if (cacheWhitelist.indexOf(cacheName) === -1) {
						console.log('Deleting old cache:', cacheName);
						return caches.delete(cacheName);
					}
				})
			);
		}).then(() => {
			console.log('Service Worker activated');
			return self.clients.claim();
		})
	);
});