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

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS
