# AlpineJS Component Guide

## TL;DR

Fetch lightweight HTML fragments, inject them into containers, and initialize Alpine on each. Pass props via `dataset`, use events for communication.

**Quick example:**

```html
<!-- index.html -->
<body x-data="alpineAppRoot()">
  <div x-init="loadComponent($el, 'toggle', { label: 'Click me' })"></div>
</body>
```

```html
<!-- /components/toggle.html -->
<div x-data="() => ({ props: JSON.parse($el.dataset.props || '{}'), open: false })">
  <button @click="open = !open">{{ props.label }}</button>
  <div x-show="open" x-cloak>Content</div>
</div>
```

```js
async function loadComponent(el, name, props = {}) {
  const res = await fetch(`/components/${name}.html`);
  if (!res.ok) return;
  el.innerHTML = await res.text();
  el.dataset.props = JSON.stringify(props);
  Alpine.initTree(el);
}
```

---

## Pattern Overview

- **Root:** `<body x-data="alpineAppRoot()">` holds global state
- **Inject points:** `<div x-init="loadComponent($el, 'name', props)"></div>`
- **Fragments:** Self-contained HTML with local `x-data`
- **Communication:** Events via `$dispatch` for upward flow

## Why This Approach?

- Defers heavy DOM mounting until needed
- Teams own small, focused HTML fragments independently
- Combines global state with isolated component scopes
- No build step required for HTML fragments

## Loader Implementation

```js
async function loadComponent(el, name, props = {}, options = { cache: true }) {
  // Cleanup previous
  if (el._teardown) { try { el._teardown(); } catch(e){} delete el._teardown; }
  
  const token = Symbol(name);
  el._lastLoadToken = token;
  this._componentCache = this._componentCache || new Map();
  
  try {
    let html;
    if (options.cache && this._componentCache.has(name)) {
      html = this._componentCache.get(name);
    } else {
      const res = await fetch(`/components/${name}.html`);
      if (!res.ok) throw new Error(`${res.status}`);
      html = await res.text();
      if (options.cache) this._componentCache.set(name, html);
    }
    
    if (el._lastLoadToken !== token) return; // race safety
    
    el.innerHTML = html;
    el.dataset.props = JSON.stringify(props || {});
    Alpine.initTree(el);
    el.dispatchEvent(new CustomEvent('component-mounted', { detail: { name } }));
  } catch (e) {
    el.innerHTML = `<div class="error">Failed to load ${name}</div>`;
  }
}
```

## Key Patterns

### Passing Props
```html
<div x-data="() => ({ props: JSON.parse($el.dataset.props || '{}') })">
  <p>{{ props.title }}</p>
</div>
```

### Communication Between Components
Use `$dispatch` to emit events upward; parent or global listeners catch with `@event` or `@event.window`.

### x-if vs x-show
- `x-if`: mounts/unmounts DOM — use for heavy components
- `x-show`: toggles visibility — preserves internal state

### Refs & Direct DOM Access
```html
<div x-data="component()" x-ref="container">
  <canvas x-ref="canvas"></canvas>
</div>
```

### Cleanup/Teardown
```html
<script>
(function(){
  const el = document.currentScript.parentElement;
  const timerId = setInterval(update, 1000);
  el._teardown = () => clearInterval(timerId);
})();
</script>
```

## Performance & Debug Tips

- **Defer loading** with `x-init` for non-critical components
- **Use `x-cloak`** to prevent flash-of-unstyled-content (FOUC)
- **Keep fragments small** to reduce network and parse cost
- **Ensure `Alpine.initTree(el)`** is called after `innerHTML` update
- **Check `el.dataset.props`** to verify props are set

## When to Use

- ✅ Server-rendered pages with dynamic fragments
- ✅ Micro-frontends with independent deployments
- ✅ When you want editable HTML without a build step

For large SPAs, consider bundled components and frameworks instead.
