#!/usr/bin/env node
// Scans blog/ for .md files and syncs BLOG_POSTS array in blog.html.
// Files already in BLOG_POSTS keep their title and order.
// New files are appended with a title derived from the filename.
// Orphaned entries (file deleted) are flagged but kept with a ⚠️ prefix.

const fs = require('fs');
const path = require('path');

const BLOG_HTML = path.join(__dirname, '..', 'blog.html');
const BLOG_DIR = path.join(__dirname, '..', 'blog');

function idFromFile(filename) {
	return filename.replace(/\.md$/, '');
}

function titleFromId(id) {
	return id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function firstHeading(filepath) {
	const content = fs.readFileSync(filepath, 'utf8');
	const match = content.match(/^#\s+(.+)$/m);
	return match ? match[1].trim() : null;
}

const html = fs.readFileSync(BLOG_HTML, 'utf8');

// Extract current BLOG_POSTS array
const arrayMatch = html.match(/const BLOG_POSTS\s*=\s*(\[[\s\S]*?\]);/);
if (!arrayMatch) {
	console.error('ERROR: Could not find BLOG_POSTS array in blog.html');
	process.exit(1);
}

// Parse existing entries preserving titles and order
const existingRaw = arrayMatch[1];
const existingEntries = [];
const entryRegex = /\{\s*id:\s*['"]([^'"]+)['"]\s*,\s*title:\s*['"]([^'"]+)['"]\s*\}/g;
let m;
while ((m = entryRegex.exec(existingRaw)) !== null) {
	existingEntries.push({ id: m[1], title: m[2] });
}

const existingIds = new Set(existingEntries.map(e => e.id));

// Scan blog/ for .md files
const mdFiles = fs.readdirSync(BLOG_DIR)
	.filter(f => f.endsWith('.md'))
	.map(idFromFile);

const fileSet = new Set(mdFiles);

// Flag orphans
let orphanCount = 0;
const merged = existingEntries.map(e => {
	if (!fileSet.has(e.id)) {
		orphanCount++;
		console.warn(`WARN: blog/${e.id}.md not found — marking orphan`);
		return { ...e, title: e.title.startsWith('⚠️') ? e.title : '⚠️ ' + e.title };
	}
	return e;
});

// Append new files not yet in the list
let newCount = 0;
for (const id of mdFiles) {
	if (!existingIds.has(id)) {
		const heading = firstHeading(path.join(BLOG_DIR, id + '.md'));
		const title = heading || titleFromId(id);
		merged.push({ id, title });
		newCount++;
		console.log(`NEW: ${id} → "${title}"`);
	}
}

if (newCount === 0 && orphanCount === 0) {
	console.log('blog.html already in sync — no changes needed.');
	process.exit(0);
}

// Render new array
const newArray = '[\n' + merged.map(e =>
	`\t\t\t\t{ id: '${e.id}', \ttitle: '${e.title}' }`
).join(',\n') + '\n\t\t\t]';

const newHtml = html.replace(
	/const BLOG_POSTS\s*=\s*\[[\s\S]*?\];/,
	`const BLOG_POSTS = ${newArray};`
);

fs.writeFileSync(BLOG_HTML, newHtml, 'utf8');
console.log(`Done. +${newCount} new, ${orphanCount} orphan(s). blog.html updated.`);
