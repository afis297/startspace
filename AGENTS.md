# Startspace — agent notes

Chromium/Firefox new-tab extension. Vanilla JS ES-modules, no bundler, no deps. State in `src/app/store.js`, persisted via `chrome.storage.local` (fallback `localStorage`).

## Commands

```powershell
npm test          # core smokes, always run after a change
npm run test:all  # + contract smokes, run before finishing
.\validate-project.ps1; .\audit-project.ps1
.\build-extension.ps1 -Target chrome  # dist/ output, gitignored
```

`*-live-smoke` and `browser-smoke` need Deno + real browser; never run in CI.

## Contracts

- Widget = `create` once + `update` on every event (`src/widgets/registry.js`). Never write to storage from a widget; use `patchConfig`.
- `style` is decoration, `config` is data. No per-widget radius: only the global radius applies.
- After editing: Reload the extension at `chrome://extensions`, then reload the tab. Overlay panel needs the host page reloaded too.
- Firefox has no `system.*` APIs: `system-metrics` must degrade to an unavailable state, never throw.

## Map

| Branch | Reach for |
|---|---|
| Widget behaviour, store, lifecycle | `docs/widget-function-map-2026-08-16.md` |
| Theme, CSS cascade, density, type | `docs/design-guide-2026-08-16.md` |
| User-visible wording or settings flow | `docs/user-guide.md` |
| Rest audio licensing | `docs/rest-widget-audio-notes.md` |
| YouTube/media embed limits (err. 153) | `docs/youtube-embed-notes.md` |
| Layer model, state shape | `docs/project-notes/ARCHITECTURE.md` |
| Dated snapshots, past decisions | `docs/archive/` — context only, code wins on conflict |
