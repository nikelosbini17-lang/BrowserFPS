# Update 0.3 — gameplay, stability and Deathmatch

## Crashes found

Two concrete failures were reproduced before fixing them:

1. Corrupted saved settings (`fov: "broken"`, `resolution: null`, invalid sensitivity) reached the renderer unchecked. The drawing buffer became zero pixels wide and the camera projection contained non-finite values: a black-screen failure without a useful exception.
2. A valid JSON `null` WebSocket payload caused `Cannot read properties of null (reading 't')`. Roster and snapshot shapes were also unchecked after parsing.

Additional inspection found stale socket handlers, an unbounded response to a fatal render error (the next frame was already scheduled), and a graphics-loss handler that did not stop rendering. These were corrected as defensive lifecycle fixes. The precise cause of every previously observed intermittent crash is not established; GPU/driver-specific failures have not been reproduced.

## Crashes fixed

- Saved settings now use a whitelist, type checks and numeric bounds.
- Incoming packets validate message, roster, match and snapshot schemas; malformed responses fail the connection cleanly.
- Socket callbacks verify that they still belong to the active connection; disconnect clears callbacks, timers and prediction buffers.
- Fatal client errors, unhandled rejections and WebGL loss stop the loop, release controls, disconnect and show GAME ERROR / RELOAD GAME. Development logs contain a bounded game-state diagnostic.
- Non-finite local simulation state is detected explicitly.
- Repeated mode/map transitions reuse the app loop/input handlers, dispose map/debug GPU resources and remove remote players. Audio filter connections are released on completion; menu/disconnect suspends audio.
- A new debug-visibility regression was found during screenshot review and fixed: `undefined` visibility was treated as visible by Three.js. Debug geometry now uses explicit booleans.

## Collision fixes

Rounded horizontal contact volumes replace sharp player AABB checks. Contact resolution removes only inward velocity and preserves wall-parallel motion. Iterative depenetration handles embedded corners and overlapping wall seams. Small movement substeps, ramp traversal, ceiling checks and a delayed last-safe-position fallback share the same implementation on client and server. Nearby colliders come from an 8 m spatial grid.

F4 / Show Colliders displays level wireframes, the player capsule, ground direction, velocity and contact normals. F5 / Show Hitboxes displays remote hit regions. Both are development options and default off.

## Multiplayer damage — VERIFIED

The tests run two real browser clients connected through a latency bridge to a real test-owned WebSocket server. The initial shot damages the second client; subsequent shots at its strafing, interpolated model kill it. Tests verify server ammo consumption, victim HP/alive state, attacker hit confirmation, kill/death counters and the scoreboard at 0, 50, 100 and 150 ms simulated RTT.

The server validates owned/equipped weapons, ammo, shot sequence, fire rate, reload, bolt/draw timing and alive state. It computes random spread and ray obstruction, hits head/body/arms/legs, applies damage and emits confirmation. It rejects direct client damage messages. Arm volumes follow the aim rig. Bounded, life-aware rewind interpolates past target poses; the client never provides damage or an authoritative rewind timestamp.

This verifies controlled browser scenarios. Real internet packet loss/jitter and competitive anti-cheat guarantees are NOT VERIFIED.

## Movement

Forward-only air input receives 28% of full air acceleration. A/D plus mouse turning receives full acceleration and redirects momentum, subject to projection and total speed caps. Timed landing jumps preserve momentum before friction; holding jump does not grant automatic acceleration. The development HUD includes speed, cap, air acceleration and strafe efficiency.

## Deathmatch

Implemented through shared GameMode / PracticeMode / TacticalMode / DeathmatchMode rules:

- Ten-minute FFA matches; kills are points; final leaderboard.
- Two-second respawns restore 100 HP and full starting ammo.
- 1.5-second protection ends on an accepted shot; local HUD and remote gold ring indicate it.
- AR-4 or Titan primary, R45 secondary. Primary changes apply next spawn. No unimplemented weapon classes or melee are advertised as available.
- Death message, killer/weapon, countdown, server kill feed and Tab kills/deaths/ping.
- District is a new 104×112 m map with 24 scored spawn candidates, connected ground routes, mixed sightlines, two roof ramps and an underpass.

Tactical remains a Kestrel combat sandbox; objective rounds, teams and economy are not implemented.

## Public servers

Quick Play finds or creates a public instance of the requested mode. It excludes private, full and finished rooms. Drop-in joins preserve match time. Private room codes remain optional. Disconnect removes the entity and roster entry; empty rooms are deleted. Deathmatch defaults to 20 players, configurable from 2–32; Tactical caps at 10.

The backend is running locally. Internet deployment, TLS and regional hosting are NOT provisioned.

## Weapon visuals

- Per-weapon configurable translation, rotation and scale; lower-right first-person placement.
- Original swept curved rifle magazine, stock, barrel/front sight and receiver details.
- Chunkier pistol muzzle, hammer and trigger guard; sniper scope bells, tubular barrel and folded support details.
- Lightweight hand/arm sway, recoil, draw, reload and bolt motion.
- Separate remote world models attach to an aim rig, switch by server slot and follow body yaw/aim pitch, crouch, movement, fire and reload. Death hides the model.

## Skins

Default, Midnight, Arctic, Sunset, Neon Grid, Carbon and Retro are original procedural materials. Loadout provides a rendered preview and Equip action, with localStorage persistence and remote appearance synchronization. Cosmetic application does not change weapon configuration, ammo rules, damage, recoil or hitboxes. There are no purchases or random rolls.

## Performance

District static geometry is merged by material and spatial cell, allowing frustum culling. Models/materials are reused, impact effects are pooled, network histories are bounded, and collision searches are spatially restricted. Preview rendering reuses the existing WebGL renderer instead of opening another graphics context.

A synthetic 20-player server simulation ran 2,400 steps on this machine: mean 0.038 ms and p95 0.094 ms per step, maximum 1.084 ms, ~3.1 KB player snapshot, ten history frames retained. This is a CPU simulation benchmark, not a 20-browser or WAN capacity guarantee.

Six District → Kestrel round trips are tested for stable renderer geometry/texture counts and scene child count. Weak integrated-GPU hardware, long-running heap soak tests and 20 simultaneous rendered clients are NOT VERIFIED.

## Files modified

- `.env.example`, `package.json`, `package-lock.json`, `README.md`
- `src/main.js`, `src/style.css`, `src/audio/AudioManager.js`
- `src/config/GameConfig.js`, `src/config/MovementConfig.js`, `src/config/WeaponConfig.js`
- `src/game/Game.js`, `src/maps/KestrelMap.js`, `src/player/Movement.js`
- `src/network/NetworkClient.js`, `src/network/Protocol.js`, `src/network/RemotePlayers.js`
- `src/ui/UI.js`, `src/utils/InputManager.js`, `src/utils/Settings.js`
- `src/weapons/HeavyModels.js`, `src/weapons/ViewModel.js`
- `server/GameServer.js`, `server/Room.js`, `server/server.js`
- `tests/network.test.js`

## Files created

- `src/combat/Hitboxes.js`, `src/player/Collision.js`
- `src/game/DebugGeometry.js`, `src/utils/ErrorReporter.js`
- `src/maps/DistrictMap.js`, `src/modes/GameMode.js`
- `src/weapons/WorldModels.js`, `src/weapons/Skins.js`
- `server/Combat.js`
- `tests/deathmatch.test.js`, `tests/stability.test.js`
- `tests/browser/stability.spec.js`, `tests/browser/skins.spec.js`
- `tests/online/combat.spec.js`, `tests/online/deathmatch.spec.js`
- `docs/UPDATE-0.3.md`

Build output and test screenshots are generated under ignored `dist/` and `test-results/`.

## Tests performed

Final run on 2026-09-25: **30 unit/integration + 8 offline browser + 6 online browser tests passed**, plus production build/smoke. Six map round trips each reported **117 GPU geometries, 6 textures, 41 scene children** after warm-up. Production JS: **658.40 KB / 175.21 KB gzip**; CSS: **18.11 KB / 4.87 KB gzip**.

- Baseline before feature changes: 19 unit/integration tests and the existing two-browser movement/reconnect test passed.
- Crash reproduction scripts: corrupt settings and null server response reproduced both failures.
- Unit/integration: movement/bhop timing, air acceleration, weapon locks/reload, hit regions, spawn protection, damage validation, respawn/loadout reset, match ending, round collision/seams, both roof ramps, all District spawn-route connectivity, invalid packets and public/private/full room filtering.
- Offline browser: real controls, pause, wheel bindings, wall cover, ramp traversal, scopes/bolt/reload, practice hits, settings, unavailable server, corrupt settings, graphics-loss fallback, skin persistence and unchanged stats.
- Online browser: two clients at four latencies including moving-target hits; three-client public Deathmatch, join-in-progress, death/respawn, weapon/skin synchronization, disconnect, match end and repeated map cleanup; existing real-proxy reconnect/tamper correction test.
- Production smoke: built static assets, real pointer lock/firing/reload, no exposed development hook and no browser runtime/console errors.
- Visual inspection: first-person District gameplay and cosmetic preview screenshots; fixed the preview color-space and default debug-visibility issues they revealed.

The accelerated match-end test changes the test-owned server deadline; it does not wait ten real minutes. The latency bridge does not simulate loss, jitter or congestion. Controlled aim ignores unrelated physical mouse input leaking into headless Windows pointer lock.

## Known bugs and limitations

No known failing automated regression remains at delivery. This does not establish that every reported intermittent GPU crash is fixed. Very crowded spawn situations can only choose the least exposed candidate; they cannot guarantee an unseen spawn. Tactical sandbox deaths require leaving/rejoining; automatic respawn is a Deathmatch rule. Hitboxes and animations are deliberately simple low-poly volumes, not skeletal/motion-captured models. Public hosting, accounts, score persistence, additional weapon classes, bots and competitive round systems remain outside this implemented update.

## Next steps

Run an 8–20-human map/weapon balance session, a long-duration browser/GPU soak, WAN loss/jitter tests, and weak-PC profiling. Deploy an HTTPS/WSS backend when an internet host is selected. Develop Tactical round rules/objectives separately from the working Deathmatch mode.
