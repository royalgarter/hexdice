// Markdown renderer for rules pages
async function renderMarkdown() {
	// Load marked library dynamically if not already loaded
	if (typeof marked === 'undefined') {
		await loadScript('https://esm.sh/marked@12.0.0');
	}

	// Get the markdown content from the page
	const markdownContent = document.getElementById('markdown-content');
	const markdownViewer = document.getElementById('markdown-viewer');
	
	if (!markdownContent || !markdownViewer) return;

	const markdownText = markdownContent.textContent;
	
	// Render markdown to HTML
	const htmlContent = marked.parse(markdownText);
	markdownViewer.innerHTML = htmlContent;
	
	// Make links open in new tab
	markdownViewer.querySelectorAll('a').forEach(link => {
		link.target = '_blank';
	});
}

// Helper function to load scripts dynamically
function loadScript(src) {
	return new Promise((resolve, reject) => {
		const script = document.createElement('script');
		script.src = src;
		script.onload = resolve;
		script.onerror = reject;
		document.head.appendChild(script);
	});
}

// Auto-render when page loads
document.addEventListener('DOMContentLoaded', renderMarkdown);
