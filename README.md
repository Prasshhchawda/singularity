# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Gemini chat

Set `GEMINI_API_KEY` in the root `.env.local` file (do not use a `VITE_` prefix);
the key is read only by the server-side `/api/chat` route. Start the app with
`npm run dev`, then open <http://localhost:5173/> to use the chat.

### Demo task agent on Render

The demo workspace sends tasks to the standalone Gemini service in
`agent-server.js`. Deploy it to Render as a **Web Service** with Node.js 22:

- **Build command:** `npm ci`
- **Start command:** `npm run server`
- **Environment variables:**
  - `GEMINI_API_KEY` — your Gemini key; keep it only in Render's backend
    environment, never in a `VITE_` variable.
  - `FRONTEND_ORIGIN` — the exact deployed frontend origin, such as
    `https://your-app.example.com` (no path). Multiple comma-separated origins
    are supported.

The service listens on Render's `PORT`, exposes `GET /health`, and accepts demo
tasks at `POST /api/agent`. The demo workspace defaults to
`https://singularity-1-pusr.onrender.com/api/agent`; set `VITE_AGENT_API_URL` in
the frontend hosting provider only if you use a different backend, then
rebuild/redeploy the frontend. Set `FRONTEND_ORIGIN` to the frontend's exact
origin; include local origins as comma-separated values when testing from a
local browser. Locally, `npm run dev:all` starts the Vite app and this service;
`GEMINI_API_KEY` can be placed in root `.env.local`.

## Desktop application

Run the Electron app against the Vite development server with `npm run desktop:dev`.
For a macOS DMG, run `npm run build:desktop:mac` on macOS. It builds arm64 and x64
installers under `dist-installer/`. Windows NSIS packaging remains available with
`npm run build:desktop:win`.

The Supabase `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` must be available
when building the app. For a packaged app, put `GEMINI_API_KEY` in `.env` under
Electron's user-data directory; it is deliberately not included in the installer.
Unsigned macOS builds may show Gatekeeper warnings; signing and notarization are
needed for a smoother public download.

### Build and download macOS installers with GitHub Actions

Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as repository Actions
secrets. These public client configuration values are embedded into the frontend
at build time. Do not add `GEMINI_API_KEY` as a workflow build secret; the build
explicitly clears it, and Gemini reads it only at runtime.

Run **Build macOS DMG** from the repository's Actions tab using **Run workflow**,
or push a matching change to `main`. The run creates separate
`Singularity-mac-arm64` and `Singularity-mac-x64` artifacts. Download the
matching artifact from the completed workflow run, extract the `.dmg`, open it,
and drag Singularity to Applications. Since these builds are unsigned, macOS may
block the first launch; use Control-click > **Open** to approve it.

To enable Gemini in the installed app, create
`~/Library/Application Support/Singularity/.env` containing `GEMINI_API_KEY=...`.
This key is read by the packaged server at runtime and is not included in the
DMG.

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

## Demo and meeting access

The KINETIK booking-to-timer flow currently runs in **local demo mode**: it
keeps the original seven-employee catalog, starts a browser-local timer, and
accepts any non-empty demo key without validating it. It does not create a real
discovery call, unlock a workspace, or connect to Supabase. Re-enable the
server-backed booking flow only after the Supabase project URL is reachable and
the migration below has been applied.

The SQL migration `supabase/migrations/20261124233000_admin_control_panel.sql`
contains shared marketplace and meeting tables used by the app. It has not been
applied to the Supabase project. Keep the migration and its shared backend code
if you want to enable the real marketplace or meeting flow later.

## Local operations preview

The mock operations console is available by entering `exdkid` in the demo key
field, or by pressing `Ctrl+Shift+K` (`Cmd+Shift+K` on macOS) and entering the
local passphrase. On `localhost`, the default passphrase is
`kinetik-dev-2026`; `VITE_ADMIN_SECRET_KEY` can override it. The hidden route is
`/sys-control-9x`.

This console contains mock data only and makes no Supabase requests. A
`VITE_` passphrase is included in client-side code and is not suitable for
protecting real data or production administrative actions.
