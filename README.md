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
