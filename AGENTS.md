# Project Setup

Two separate projects sharing a repo:

```
lahacks2026/
├── frontend/   # React + Vite + TypeScript, runs on port 5173
└── backend/    # Node.js + Express, runs on port 3001
```

The frontend doubles as the World App mini app via `@worldcoin/minikit-js`
(see `frontend/src/lib/useIsInWorldApp.ts`). When loaded inside World App's
webview, `useIsInWorldApp()` returns `true` and components can branch on it.
Set `VITE_WORLD_APP_ID` to enable MiniKit features that need the app id.

## Commands

Run from each respective folder:

| Folder | Command | Description |
|---|---|---|
| `frontend/` | `npm run dev` | Start frontend |
| `backend/` | `npm run dev` | Start backend |
