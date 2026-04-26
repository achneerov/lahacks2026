# Project Setup

Two separate projects sharing a repo:

```
lahacks2026/
├── miniapp/   # Next.js 15 + TypeScript, runs on port 3000.
│              # Single app that serves either the desktop UI (ported from
│              # the old Vite frontend, in src/desktop) or the World mini-app
│              # UI (in src/miniapp). The choice is made at runtime by
│              # src/components/RootGate.tsx using MiniKit.isInstalled().
└── backend/   # Node.js + Express, runs on port 3001
```

## Commands

Run from each respective folder:

| Folder | Command | Description |
|---|---|---|
| `miniapp/` | `npm run dev` | Start the Next.js app (desktop + mini-app) |
| `backend/` | `npm run dev` | Start backend |

## Mini-app vs desktop

`miniapp/src/components/RootGate.tsx` is a client component that reads
`useMiniKit().isInstalled` from `@worldcoin/minikit-js/minikit-provider`:

- `true` (running inside the World App) → mounts `src/miniapp/MiniApp.tsx`
- `false` (any normal browser) → mounts `src/desktop/App.tsx`

Both UIs share the same backend (`NEXT_PUBLIC_API_URL`, default
`http://localhost:3001`) and the same JWT auth token, stored in
`localStorage` under `auth_token:<API_BASE>`. The mini-app obtains its
token by signing a SIWE message via `MiniKit.walletAuth()` and POSTing
the payload to `POST /api/auth/wallet-login` on the backend, which
upserts a wallet-bound user and returns the same JWT shape the desktop
flow uses.
