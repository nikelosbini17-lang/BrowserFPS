# Session report — 0.2.0-alpha

## Completed

- Inspected the existing project and ran the old unit, browser, and production checks before editing. All passed.
- Extended existing movement into configurable projection-based air acceleration, momentum preservation, counter-strafing, timed bunny hops, landing friction, and bounded speed.
- Added configurable Space/wheel jump bindings and a hidden-by-default development movement/network display.
- Generalized the existing rifle state without changing the AR-4 entry point; added R45 and Titan, distinct models/audio, per-weapon magazines, reload cancellation, previous-weapon switching, draw delay, and recoil recovery.
- Added Titan scope cycling, proportional sensitivity, hip/movement/air/landing accuracy penalties, and bolt action that cannot be bypassed by switching.
- Preserved Kestrel, target combat, the menu identity, settings, HUD, audio, collision, and offline practice.
- Added real Node/ws rooms, two-client movement synchronization, prediction/reconciliation, remote snapshot interpolation, balanced spawn groups, ping, disconnect cleanup, room-code rejoin, and connection-failure/retry handling.
- Added authoritative movement validation, bounded packet/command queues, connection and creation rate limits, origin validation, and rejection of forged damage messages. Online combat is explicitly disabled pending server-side combat implementation.
- Added production URL/origin configuration and HTTPS/WSS preparation. Built frontend output remains static.

## Files created

| Files                                                                     | Purpose                                                             |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `src/config/MovementConfig.js`, `WeaponConfig.js`, `GameConfig.js`        | Movement/weapon tuning, version and development mode                |
| `src/player/Movement.js`                                                  | Shared pure client/server physics                                   |
| `src/weapons/Weapon.js`, `WeaponManager.js`, `HeavyModels.js`             | Reusable weapon state, arsenal and new models                       |
| `src/network/Protocol.js`, `NetworkClient.js`, `RemotePlayers.js`         | Validated protocol, prediction, reconciliation and remote rendering |
| `server/GameServer.js`, `Room.js`, `RateLimiter.js`, `server.js`          | Real WebSocket server and room lifecycle                            |
| `.env.example`, `playwright.online.config.js`                             | Deployment configuration and two-client browser test setup          |
| `tests/movement.test.js`, `weapons.test.js`, `network.test.js`            | Physics, weapon and authoritative-server tests                      |
| `tests/browser/movement.spec.js`, `weapons.spec.js`, `connection.spec.js` | Keyboard/mouse, weapon and failure-path browser tests               |
| `tests/online/multiplayer.spec.js`                                        | Two independent browser clients with reconnect/cleanup checks       |
| `docs/UPDATE-0.2.md`                                                      | This inventory and scope report                                     |

## Files modified

- `src/player/Player.js`: delegates physics to the shared step while preserving camera/footstep/landing behavior.
- `src/utils/InputManager.js`, `Settings.js`: jump binding/input buffering, secondary fire and new settings.
- `src/weapons/Rifle.js`, `ViewModel.js`: original AR-4 wrapper and reusable viewmodel selection/animation.
- `src/combat/Shooting.js`, `Targets.js`: sample accuracy before scope interruption, weapon-specific recoil/falloff, and hide training targets in online mode.
- `src/audio/AudioManager.js`: original heavy-pistol/sniper/bolt/scope sounds.
- `src/game/Game.js`: arsenal and scoped rendering, practice/online lifecycle, network input integration and server-failure recovery.
- `src/maps/KestrelMap.js`: optional collision-only construction for the server; map geometry/layout preserved.
- `src/ui/UI.js`, `src/style.css`: arsenal cards, scope, weapon slots, debug display, lobby and connected player list.
- `package.json`, `package-lock.json`, `.gitignore`, `vite.config.js`: version, ws dependency, scripts, environment exclusions and development WebSocket proxy.
- `README.md`: actual run commands, limits, deployment configuration, controls and tests.
- `tests/browser/game.spec.js`: added test-only isolation of fixed-aim scenarios from unrelated desktop raw mouse input; the real mouse-look check remains enabled.

Also created `tests/helpers/look.js` for that test-only input isolation. The original test cases, HTML entry point, and branding assets are preserved.

## Not completed

New competitive map; remaining six weapons; autonomous bots; online shooting, damage, health, death and respawning; match teams, score, freeze time and rounds; plant/defuse; economy; lag-compensated shot rewind; chat/muting; support/donation UI; bug report UI/backend; expanded credits; public deployment.

The narrow current-session target was movement and two weapons, followed by an optional two-client network foundation. This is not a claim that the full major-update roadmap is finished.

## How to run

`npm install`, then `npm run dev`. Local practice works with only this command.

For the online lab, also run `npm run server` in a second terminal. Open two frontend windows, create a room in one, and join its code in the other. Full instructions and environment configuration are in the root README.

## Known limitations

- Network movement has been tested locally, not under real internet packet jitter or deployment-scale load. Reconciliation may visibly correct movement at high latency.
- Player-to-player body collision is not yet implemented; players can pass through each other in the movement lab.
- Only the local player's ping is shown. Remote ping and K/D/A will come with authoritative combat.
- Room codes are ephemeral and disappear when the last participant leaves.
- Prices are configuration metadata, not a working economy. Three weapon slots are a practice rack, not final competitive inventory rules.
- No low-end hardware performance guarantee is made from development-machine measurements.

## Recommended next milestone

Implement authoritative online shots, ammo, reload, damage, death, and respawns using the shared weapon configurations and collision world. Then add match teams/rounds and playtest the new original competitive map before objective/economy systems.
