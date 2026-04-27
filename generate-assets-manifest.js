const fs = require('fs');
const path = require('path');

const dirs = ['assets', 'ai', 'rules'];
const rootFiles = ['index.html', 'rules.html', 'game.js'];

function getFiles(dir) {
	let files = [];
	if (!fs.existsSync(dir)) return files;
	
	const items = fs.readdirSync(dir, { withFileTypes: true });
	for (const item of items) {
		const fullPath = path.join(dir, item.name);
		if (item.isDirectory()) {
			files = [...files, ...getFiles(fullPath)];
		} else {
			// Ensure we use forward slashes for URLs
			files.push('/' + fullPath.replace(/\\/g, '/'));
		}
	}
	return files;
}

let allFiles = ['/', ...rootFiles.map(f => '/' + f)];

dirs.forEach(dir => {
	allFiles = [...allFiles, ...getFiles(dir)];
});

// Remove duplicates and exclude the manifest itself if it was already there
allFiles = [...new Set(allFiles)].filter(f => f !== '/assets/assets-manifest.json');

// Sort for consistency
allFiles.sort();

const manifestPath = path.join('assets', 'assets-manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(allFiles, null, 2));

console.log(`Manifest generated at ${manifestPath} with ${allFiles.length} files.`);
