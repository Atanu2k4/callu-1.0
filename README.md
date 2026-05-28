# Callu Desktop

Callu is a private, invite-only community platform for professionals, creators, and visionaries. It delivers high-fidelity voice and video calls, collaborative rooms with real-time chat and a synchronized music player, and a curated member directory — all within an exclusive, manually-reviewed network.

This repository contains the Electron desktop app. The web + server repo lives at https://github.com/sanks011/callu.

## Repositories & sync

To keep both apps in sync, use a shared root folder:

```
Callu/
├── callu/          # Web + server (sanks011/callu)
└── callu-desktop/  # Electron app (this repo)
```

## Desktop app API URL

In the Electron app, set:

```
VITE_API_URL=https://callu.up.railway.app
```

For local development, run the server locally and point `VITE_API_URL` to your local URL (for example `http://localhost:3000`).

## Features

- Curated access — applications are reviewed manually to keep a high-trust community.
- OTP authentication — members log in with a one-time email code.
- 1-on-1 voice & video calls — peer-to-peer WebRTC (SimplePeer) with Socket.IO signaling.
- Community rooms — multi-participant voice/video rooms with:
  - screen sharing
  - real-time text chat with file attachments (stored via ImageKit, auto-expired)
  - synchronized music player (YouTube-sourced, queue-based, host-controlled)
- Live presence — see who is online in real time.
- Admin dashboard — manage applicants and members.
- Settings & wallet — member profile customization and wallet management.

## Tech stack (desktop)

- Electron + Vite
- React 19 + TypeScript
- Tailwind CSS v4, Framer Motion, Lenis
- Socket.IO client, SimplePeer (WebRTC)
- YouTube IFrame API via react-youtube

## Prerequisites

- Node.js ≥ 18
- npm ≥ 9
- A running Callu API (cloud or local)

## Local setup

Clone the repository:

```bash
git clone https://github.com/Sahnik0/callu.git
cd callu/callu-desktop
```

Install dependencies:

```bash
npm install
```

Create a `.env` file in `callu-desktop/`:

```bash
VITE_API_URL=https://callu.up.railway.app
```

Start the desktop app:

```bash
npm run electron:dev
```

If you only need the renderer in a browser, run:

```bash
npm run dev
```

## Available scripts

- `npm run dev` - start the Vite dev server
- `npm run build` - build the renderer and compile Electron TypeScript
- `npm run electron:dev` - run Vite + Electron together
- `npm run electron:build` - create a packaged desktop build
- `npm run electron:rebuild` - rebuild native modules

## Project structure

```
callu-desktop/
├── electron/       # Electron main process
├── public/         # Static assets
├── src/            # React renderer
├── index.html
└── vite.config.ts
```

## Contributing

Pull requests should follow the template in `.github/pull_request_template.md` and include a `Fixes #` reference.
