# UI development — side-by-side workflow

## Fix: CORS / `localhost:5173` / “unknown error fetching script”

That happens when the extension tries to load scripts from the **Vite dev server** (`pnpm dev:hmr`) and Chrome blocks it.

**Use the default dev command instead:**

```bash
# Stop the old terminal (Ctrl+C), then:
pnpm build
pnpm dev
```

`pnpm dev` now runs **`vite build --watch`** — it rebuilds `dist/` on every save **without** localhost. No CORS issues.

Then in `chrome://extensions` → **Reload** your extension once.

Only use `pnpm dev:hmr` if you explicitly want HMR (advanced; CORS must work).

---

## One-time setup

1. `pnpm install`
2. `pnpm run icons` (if needed)
3. `pnpm build`
4. Chrome → `chrome://extensions` → **Load unpacked** → **`dist`**
5. Leave the extension loaded

## Daily UI workflow

### Terminal (keep running)

```bash
pnpm dev
```

Waits for file changes and rebuilds `dist/`. No dev server on port 5173.

### After you save a file

| What you changed | What to do in Chrome |
|------------------|----------------------|
| CSS / HTML (popup or options) | **Reload extension**, then reopen popup or refresh Settings tab |
| `popup.ts`, `options.ts` | Same |
| `service-worker.ts`, `sync.ts`, etc. | **Reload extension** |

Reload: `chrome://extensions` → ↻ on **Merge Requests Tracker (MR)**

### Best for side-by-side: **Settings (options)**

1. Open **Settings** (from popup footer or right-click extension → Options)
2. Editor \| Chrome tab side by side
3. Edit `src/popup/popup.css`, `src/options/options.css`, `src/styles/*`
4. Save → **Reload extension** → refresh the Settings tab (F5)

### Popup

1. Save CSS/HTML
2. Reload extension
3. Click extension icon again

## Side-by-side layout (Windows)

1. Win + Left: editor  
2. Win + Right: Chrome on Settings tab  
3. Terminal: `pnpm dev` running

## Production build

```bash
pnpm build
```

Reload extension once.
