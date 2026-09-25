# LINEBREAK — 0.3.0-alpha

An original browser FPS with local Practice, a Tactical combat sandbox, and public free-for-all Deathmatch. This update extends the existing project; Kestrel, the original weapons, controls, and practice targets remain available.

## Run

Use Node.js 22.12+ (tested on 24) and a desktop WebGL 2 / Pointer Lock browser.

```sh
npm install
npm run dev
# In a second terminal:
npm run server
```

Open http://127.0.0.1:5173. Choose **Play → Deathmatch → Quick Play → Enter Room**. The server joins an available public District instance or creates one. No code is needed. The final click captures the mouse.

**Online / Private Rooms** creates or joins a private Kestrel combat sandbox using an optional code. **Practice Range** works without a server. Tactical rounds, objectives, teams, and economy are not implemented; the menu labels this as a sandbox.

Public matching is implemented on the running backend. Production builds connect to the Render backend at `wss://browserfps-server.onrender.com/game-socket`. Local development uses the Vite proxy to the local server on port 3001. For friends on a LAN, expose the frontend using `npm run dev -- --host 0.0.0.0`, add its exact LAN origin to `ALLOWED_ORIGINS`, and visit that PC's LAN address. The Vite proxy can keep the backend on loopback.

## Controls

| Input          | Action                                           |
| -------------- | ------------------------------------------------ |
| WASD / mouse   | Move / look                                      |
| Space or wheel | Timed jump; configurable wheel directions        |
| Shift / Ctrl   | Walk / crouch                                    |
| Left click     | Fire; hold AR-4, tap R45/Titan                   |
| Right click    | Cycle Titan scope                                |
| 1 / 2          | Deathmatch primary / secondary                   |
| 1 / 2 / 3      | Practice and sandbox: AR-4 / R45 / Titan         |
| Q / R          | Previous weapon / reload                         |
| Tab            | Scores: kills, deaths, ping                      |
| Escape         | Release mouse; online matches continue           |
| F2             | Local practice tools                             |
| F3 / F4 / F5   | Development: movement HUD / colliders / hitboxes |

## Deathmatch and District

- Free for all, 10 minutes, one point per kill, final leaderboard.
- Two-second respawn; health and all starting ammo reset.
- 1.5-second spawn protection, canceled by an accepted shot. Protected players have a gold ground ring; your HUD announces protection.
- Primary: AR-4 or Titan. Secondary: R45. No melee has been implemented.
- Change the primary in **Loadout** (also available from the online pause menu); it applies at the next spawn.
- Twenty-player default capacity, tunable from 2–32. District is designed for roughly 8–20; only three simultaneous rendered browser clients have been regression-tested.
- District is a new 104×112 m Mediterranean/industrial layout: plaza, market, warehouse, streets, courtyard, construction, garage, an underpass and roof access from two ramps.
- All 24 spawn candidates connect through walkable routes. Spawns are scored for distance, visibility, occupancy and recent combat.
- Join-in-progress preserves the server's match timer. Public matching excludes private, full and finished rooms. Empty rooms are removed.

## Movement and weapons

Shared movement lives in `src/player/Movement.js`, with tuning in `src/config/MovementConfig.js`. The rounded player collider uses contact normals and tangential sliding, depenetration, ceiling checks and a last-safe-position fallback. An 8 m grid limits nearby collision checks.

Ground speed is 5.5 m/s and total bhop speed is capped at 8.8 m/s before weapon modifiers. A/D gets full air acceleration; forward-only air input gets 28%. Turning while strafing redirects momentum. Buffered landing jumps preserve momentum before friction; holding Space does not auto-hop or generate speed.

| Weapon | Magazine / reserve | Base damage | Behavior                                     |
| ------ | ------------------ | ----------- | -------------------------------------------- |
| AR-4   | 30 / 90            | 34          | Automatic rifle; original curved magazine    |
| R45    | 7 / 35             | 59          | Heavy pistol; strong tap accuracy and recoil |
| Titan  | 5 / 20             | 142         | Heavy bolt-action sniper; 35° / 17° scope    |

Head, torso, arms and legs use separate hit volumes and damage multipliers. Movement, airborne state, landing, recoil and distance affect shots. Practice targets respawn after three seconds. Practice supports infinite reserve; online ammunition is finite and server-owned.

Each first-person weapon has configurable position, rotation and scale in `WeaponConfig.js`. Remote players use separate lightweight world models attached to an aim rig, with yaw/pitch, crouch, stride, fire and reload states.

## Cosmetics

**Loadout → Preview Weapon → Finish → Equip** offers Default, Midnight, Arctic, Sunset, Neon Grid, Carbon and Retro. Procedural materials are original and cosmetic only; no weapon statistics change. Selection is saved locally and transmitted to other players. No purchases, loot boxes or paid rolls.

## Networking and stability

- Node `ws` server; browser input batching at 30 Hz, authoritative simulation at 120 Hz, compact snapshots at 20 Hz.
- Local prediction and acknowledgment replay; remote snapshot interpolation at 100 ms.
- Server validates shot order, active/owned weapon, ammo, reload/draw/bolt timing and fire rate. It computes spread, obstruction, hit region, damage, deaths and scores. Client-reported damage is rejected.
- Hitmarkers only follow server combat messages. Lag compensation interpolates a bounded 500 ms pose history, with rewind capped at 250 ms using measured RTT and interpolation time. Respawn life IDs prevent hitting an old life.
- Versioned input/state schemas, sanitized names, rate limits, 4 KB inbound packet cap, origin checks, heartbeat cleanup and slow-socket limits.
- Saved settings are type-checked and clamped. Malformed server packets fail the connection cleanly. Old socket callbacks cannot alter a newer connection.
- Fatal errors and graphics loss stop simulation, disconnect and show **GAME ERROR / RELOAD GAME**. Development diagnostics include mode, map, weapon, health, position, velocity and connection state.
- One app/game loop and one input manager are reused across modes. Map meshes, materials, textures and debug geometry are disposed; remote entities, socket timers/callbacks and temporary effects are cleared. Cosmetic textures are a bounded reusable seven-finish cache.

## Configuration and deployment

Copy `.env.example` to `.env` for overrides.

| Variable               | Purpose                                                        |
| ---------------------- | -------------------------------------------------------------- |
| `VITE_GAME_SERVER_URL` | Backend WebSocket URL; `.env.production` sets Render for production builds. Bare addresses use `/game-socket`; empty uses the same-origin Vite proxy during development. |
| `VITE_DEV_MODE`        | Optional debug visuals; false for public builds                |
| `HOST`, `PORT`         | Backend defaults: 0.0.0.0:3001; hosting may supply `PORT`      |
| `ALLOWED_ORIGINS`      | Exact frontend origins allowed to connect                      |
| `MAX_PLAYERS`          | Deathmatch capacity 2–32, default 20; Tactical caps at 10      |
| `MAX_ROOMS`            | Room count 1–128, default 32                                   |
| `DEV_COMBAT_LOGS`      | Local SHOT / SERVER HIT / KILL diagnostics; default false      |

`npm run build` produces `dist/`. Public hosting requires static frontend hosting and a WebSocket-capable HTTPS/WSS reverse proxy to the Node backend. HTTPS pages reject insecure sockets. `VITE_` values are public build-time values. The backend ignores forwarded IP headers; configure trusted proxy rate limiting for a deployment. The current per-IP concurrent socket limit is 12.

The committed `.env.production` sets `VITE_GAME_SERVER_URL=wss://browserfps-server.onrender.com`. You can override it in the frontend host's build environment, then rebuild and redeploy `dist/`. On the Render backend service, set `ALLOWED_ORIGINS=https://browserfps.onrender.com` (without a trailing slash). If you already allow other frontend origins, append this origin to the comma-separated list. Include local development origins if you also want to test the public backend locally. The backend rejects unlisted origins. All multiplayer modes and reconnect attempts use the same configured socket endpoint.

## Validation

```sh
npm test
npm run test:browser
npm run test:online
npm run test:production
```

Tests use installed Microsoft Edge via Playwright. The online suite includes actual browser-to-server damage at simulated 0/50/100/150 ms RTT, moving-target hits, and a three-browser Deathmatch lifecycle. It uses test-owned ephemeral servers for combat fixtures; controlled positions are set on the server, never through a public teleport API. The existing room/reconnect test uses the normal Vite proxy.

On this Windows host, headless raw pointer lock can receive physical desktop mouse motion. Fixed-aim tests isolate look input; the mouse-look test explicitly exercises real motion. The latency bridge delays both directions; it does not simulate packet loss, jitter or internet congestion.

Screenshots go to `test-results/` and are replaced by later Playwright runs. Full update inventory and limitations: `docs/UPDATE-0.3.md`. Earlier milestone notes remain in `docs/UPDATE-0.2.md`.

## Limits

This is a playable prototype, not a production competitive service. Long-duration real internet soak tests, 20 simultaneous browser clients, weak integrated-GPU hardware and non-Chromium browsers are not verified. Map balance and movement feel need human playtesting. No accounts, persistence of scores, bots, regional routing, ranking, team rounds, objectives, economy or additional weapon classes have been added.
