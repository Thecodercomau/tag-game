# TAG

A fast, top-down multiplayer chase game for the browser. Six modes, five original maps, private rooms, room codes, LAN play, and offline practice against bots.

Built with Phaser 3, Socket.IO, Express, Vite, and plain JavaScript. No account is required: profiles, settings, stats, and achievements stay on the device.

## Quick start

```bash
npm install
npm run dev
```

- Game client: `http://localhost:5173`
- Game server: `http://localhost:3000`
- Health check: `http://localhost:3000/api/health`

The Vite development server proxies `/api` and `/socket.io` to port `3000`.

## Production build

```bash
npm run build
npm start
```

Open `http://localhost:3000`. Express serves the built client and Socket.IO from one process.

The server prints local and LAN URLs at startup:

```text
TAG server listening on http://localhost:3000
LAN addresses:
  http://192.168.x.x:3000  (en0)
```

## Free public deployment

The repository includes a multi-stage Dockerfile, Caddy reverse proxy, Docker Compose stack, and a one-command installer for an always-on Oracle Cloud Always Free VM with automatic HTTPS.

See [deploy/oracle-cloud.md](deploy/oracle-cloud.md) for VM creation, firewall, deployment, updates, and troubleshooting.

## Controls

| Action | Default keys |
| --- | --- |
| Move | `WASD` or arrow keys |
| Sprint | `Shift` |
| Tag | `Space` |
| Revive / interact | `E` |
| Scoreboard | `Tab` |
| Pause | `Escape` |

Touch controls appear automatically on mobile. Every binding can be changed in **Settings → Controls**.

## Modes

- **Classic Tag:** one runner is IT; tag someone else before time runs out.
- **Infection:** the infected team spreads by tagging runners.
- **Freeze:** tagged runners freeze until a teammate thaws them.
- **Team Tag:** coral versus azure, with team scoring.
- **Last Runner:** eliminations reduce the field to one survivor.
- **Reverse Tag:** the IT player is the evader; runners chase them down.

## Features

- Server-authoritative movement, tag validation, mode rules, results, and reconnect grace.
- Quick match, public/private/LAN rooms, host controls, room codes, and chat.
- Practice with 1–11 bots and easy, normal, or hard behavior.
- Procedural characters, maps, trails, particles, and sound effects; no external game art required.
- Local guest profile, persistent settings, match history, stats, and eight achievements.
- Responsive desktop/mobile UI, reduced-motion mode, color-blind markers, and rebindable controls.
- Session resume after a dropped Socket.IO connection.

## Configuration

Copy `.env.example` to `.env` when you need to override defaults.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP and Socket.IO port |
| `HOST` | `0.0.0.0` | Bind address; keep this for LAN access |
| `ALLOWED_ORIGINS` | `*` | Comma-separated CORS origins |
| `LAN_ONLY` | `false` | Restrict rooms to LAN visibility |
| `MAX_LOBBIES` | `100` | Concurrent lobby limit |
| `PUBLIC_URL` | empty | Public URL reported by `/api/server-info` |
| `VITE_SERVER_URL` | empty | Separate Socket.IO server URL for split deployments |

For a split deployment, build the client with `VITE_SERVER_URL=https://your-server.example.com` and set `ALLOWED_ORIGINS` on the server to the client origin.

### LAN play

1. Build and start the server on the host machine.
2. Connect both devices to the same network.
3. Open one of the printed LAN URLs on the other device.
4. Create a room and share its five-character code, or join a LAN room.

If another device cannot connect, allow Node through the host firewall and confirm both devices are on the same subnet.

To verify the full LAN path without a second device, run the server and then:

```bash
npm run test:lan
```

This opens two isolated browser sessions over the machine's non-loopback LAN address, creates and joins a room, starts a match, checks that results arrive, and confirms the room is cleaned up. Set `LAN_URL` to test a specific address or `PORT` if the server is not on `3000`.

## Tests

```bash
npm test          # Vitest unit and server integration tests
npm run build     # Production bundle
npm run validate  # Both of the above
npm run test:e2e  # Playwright browser flows
npm run test:lan  # Two-player smoke test over the LAN address
```

End-to-end browser tests require the Chromium browser:

```bash
npx playwright install chromium
npm run test:e2e
```

Playwright builds the app and starts a production server automatically. It reuses an existing server on port `3000` when one is available.

## Project layout

```text
client/             Phaser scenes, UI, networking, audio, procedural art, CSS
client/public/audio Generated WAV assets
server/             Express/Socket.IO server, lobbies, matches, validation
shared/             Match engine, mode rules, maps, schemas, constants
scripts/            Audio and LAN smoke tests
deploy/             Oracle Cloud deployment guide and Caddy config
tests/              Unit, integration, and Playwright tests
```

The server is the authority for movement, tags, revives, timers, and results. Offline practice runs the same shared `MatchEngine` locally with AI-controlled runners.

## Persistence and operations

- Match and lobby state is held in memory and cleared on restart.
- Guest sessions are retained for up to 30 minutes to support reconnects.
- `npm run generate:audio` regenerates the bundled WAV sounds without external tools.
- Static production assets are cached for one hour by Express.
