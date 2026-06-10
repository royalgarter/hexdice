AlpineJS component guide (general)

Overview

This guide explains a practical pattern for composing small, fetchable HTML fragments ("components") with Alpine.js. It covers a lightweight loader, prop passing, lifecycle/teardown, and recommended communication patterns.

Why use this pattern

- Keeps the main HTML minimal and defers mounting heavy DOM until needed.
- Lets teams maintain small, focused fragments (e.g., /components/*.html or /fragments/*.html) that include their own x-data and UI.
- Combines a single global Alpine root for shared state with isolated local scopes for components.

Core pattern

- Root: <body x-data="alpineAppRoot()"> — global app state and helpers.
- Inject points: empty containers with x-init that call a loader: <div x-init="loadComponent($el, 'my-widget')"></div>
- Use <template x-if> to mount heavy components only when necessary; use x-show to toggle visibility while keeping state.
- Bind global events on the root when needed (e.g., @mousemove.window).

What a component fragment looks like

- Self-contained markup and behaviour, for example:

```html
<div x-data="() => ({ open: false })" class="p-2">
  <button x-on:click="open = !open">Toggle</button>
  <div x-show="open" x-cloak class="mt-2">Hello from fragment</div>
</div>
```

Lightweight loader

- Purpose: fetch fragment HTML, inject into a container, initialize Alpine for that subtree, and optionally pass props and handle teardown.

Minimal implementation sketch:

```js
async function loadComponent(el, name, props = {}) {
  const res = await fetch(`/components/${name}.html`);
  if (!res.ok) { el.innerHTML = `<div class="text-red-600">Failed to load ${name}</div>`; return; }
  const html = await res.text();
  el.dataset.props = JSON.stringify(props || {});
  el.innerHTML = html;
  if (window.Alpine && typeof Alpine.initTree === 'function') Alpine.initTree(el);
}
```

Recommended hardened loader

- Features to add: response.ok checks, optional caching, race-safety (ignore stale responses), teardown invocation, and lifecycle events.
- See the example implementation later in this file for a robust, production-ready loader.

Passing props to fragments

- Use el.dataset.props = JSON.stringify(props). Inside the fragment's x-data, read JSON.parse($el.dataset.props || '{}') to initialize state.

Example in fragment:

```html
<div x-data="() => ({ props: JSON.parse($el.dataset.props || '{}'), open: false })">
  <button @click="open = !open">{{ props.label || 'Toggle' }}</button>
</div>
```

Communication and scope boundaries

- Use $dispatch from local components to emit events upward. Parent or global listeners can use @eventname or @eventname.window.
- Prefer event-driven interfaces between components and the global root to avoid tight coupling.

x-if vs x-show

- x-if mounts/unmounts DOM and Alpine scope — use for heavy components that should be created only when needed.
- x-show toggles visibility but preserves state — use when you want to keep internal state across visibility toggles.

Refs, direct DOM access, and canvases

- Use x-ref inside the fragment and access via this.$refs.myRef in x-data methods.
- Because fragments are initialized after injection, $refs will be available in the component's scope.

Lifecycle & cleanup

- If a fragment opens timers, websockets, or global listeners, expose a teardown on the container (el._teardown) or listen for a parent-provided event to clean up.

Fragment teardown snippet (append to injected HTML):

```html
<script>
;(function(){
  const container = document.currentScript.parentElement;
  const id = setInterval(()=>{/*...*/}, 1000);
  container._teardown = () => { clearInterval(id); };
})();
</script>
```

Or parent-side:

```js
if (el._teardown) el._teardown();
```

Performance tips

- Defer non-essential components with x-init + lazy load.
- Use x-cloak to prevent flash-of-unstyled-content.
- Keep fragments focused and small to reduce network and parsing cost.

Debugging tips

- If injected markup is inert, ensure Alpine.initTree(el) was called after setting innerHTML.
- Check for fetch errors (404/500) and verify fragments include x-data.

Robust loadComponent implementation (example)

```js
async function loadComponent(el, name, props = {}, options = { cache: true }) {
  if (el._teardown) { try { el._teardown(); } catch(e){ console.warn(e); } delete el._teardown; }
  const token = Symbol(name); el._lastLoadToken = token;
  this._componentCache = this._componentCache || new Map();
  const cacheKey = name;
  try {
    let html;
    if (options.cache && this._componentCache.has(cacheKey)) html = this._componentCache.get(cacheKey);
    else {
      const res = await fetch(`/components/${name}.html`);
      if (!res.ok) { el.innerHTML = `<div class='text-red-600'>Failed to load ${name}: ${res.status}</div>`; return; }
      html = await res.text();
      if (options.cache) this._componentCache.set(cacheKey, html);
    }
    if (el._lastLoadToken !== token) return; // stale
    el.dataset.props = JSON.stringify(props || {});
    el.innerHTML = html;
    if (window.Alpine && typeof Alpine.initTree === 'function') Alpine.initTree(el);
    el.dispatchEvent(new CustomEvent('component-mounted', { detail: { name, el } }));
  } catch (e) {
    console.error(`Failed to load component ${name}:`, e);
    el.innerHTML = `<div class='text-red-600'>Error loading ${name}</div>`;
  }
}
```

When to use this approach vs a bundler

- Use this fragment + loader approach for server-rendered pages, micro-frontends, or when you want editable HTML fragments without a build step.
- For large SPA apps, consider bundling components and using frameworks or compiled templates for better performance and type-checking.

Quick end-to-end example

1) index.html snippet:

```html
<body x-data="alpineAppRoot()">
  <div x-init="loadComponent($el, 'toggle', { label: 'Hi' })"></div>
</body>
```

2) /components/toggle.html:

```html
<div x-data="() => ({ props: JSON.parse($el.dataset.props || '{}'), open:false })">
  <button @click="open = !open">Toggle {{ props.label }}</button>
  <div x-show="open" x-cloak>Fragment content</div>
</div>
```

Closing notes

- This pattern scales well for many projects: it encourages small, focused fragments, explicit prop passing, clean teardown, and event-driven communication.
- Adapt the loader to your needs (cache policies, CSP, authentication) and keep fragments self-contained.

--
Generated by Copilot CLI guidance
