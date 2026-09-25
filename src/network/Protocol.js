import { SKINS } from "../weapons/Skins.js";
export const NETWORK = Object.freeze({
  protocol: 2,
  simulationHz: 120,
  snapshotHz: 20,
  sendHz: 30,
  interpolationMs: 100,
  maxPlayers: 20,
  maxPacketBytes: 4096,
});
export const WEAPON_IDS = Object.freeze(["ar4", "r45", "titan"]);
export function sanitizeName(value) {
  return typeof value === "string"
    ? value
        .normalize("NFKC")
        .replace(/[^\p{L}\p{N} _.-]/gu, "")
        .trim()
        .slice(0, 18) || "Ranger"
    : "Ranger";
}
// Input tuple: sequence, strafe, forward, yaw, pitch, jump, crouch, walk, owned slot.
export function validCommand(c) {
  return (
    Array.isArray(c) &&
    c.length === 9 &&
    c.every(Number.isFinite) &&
    Number.isSafeInteger(c[0]) &&
    c[0] > 0 &&
    c[0] < 1e10 &&
    [-1, 0, 1].includes(c[1]) &&
    [-1, 0, 1].includes(c[2]) &&
    Math.abs(c[3]) <= Math.PI * 2 &&
    Math.abs(c[4]) <= 1.48 &&
    c.slice(5, 8).every((v) => v === 0 || v === 1) &&
    Number.isInteger(c[8]) &&
    c[8] >= 0 &&
    c[8] < WEAPON_IDS.length
  );
}
export function decodeCommand(c, speedMultiplier = 1) {
  return {
    x: c[1],
    z: c[2],
    yaw: c[3],
    jump: Boolean(c[5]),
    crouch: Boolean(c[6]),
    walk: Boolean(c[7]),
    speedMultiplier,
  };
}
// Snapshot tuple: id, position(3), velocity(3), angles(2), grounded, crouch, ack, slot, jump buffer, landing age.
export function packState(player) {
  const s = player.state,
    p = s.position,
    v = s.velocity;
  const q = (value) => Math.round(value * 10000) / 10000;
  return [
    player.id,
    q(p.x),
    q(p.y),
    q(p.z),
    q(v.x),
    q(v.y),
    q(v.z),
    q(player.yaw),
    q(player.pitch),
    Number(s.grounded),
    Number(s.crouched),
    player.ack,
    player.slot,
    q(s.jumpBuffer),
    q(s.landingAge),
    player.health ?? 100,
    player.kills || 0,
    player.deaths || 0,
    player.respawnAt || 0,
    player.protectedUntil || 0,
    player.weapons?.current.ammo ?? 30,
    player.weapons?.current.reserve ?? 90,
    q(player.weapons?.current.reloadRemaining || 0),
    q(player.weapons?.current.boltRemaining || 0),
    q(player.weapons?.current.idle || 0),
    player.life || 1,
    q(player.weapons?.current.drawRemaining || 0),
    player.weapons?.current.zoom || 0,
    player.shotAck || 0,
    player.loadout?.primary || 0,
    Math.max(
      0,
      SKINS.findIndex((s) => s.id === player.skins?.[WEAPON_IDS[player.slot]]),
    ),
    player.ping || 0,
  ];
}
export function stateFromSnapshot(s) {
  return {
    position: { x: s[1], y: s[2], z: s[3] },
    velocity: { x: s[4], y: s[5], z: s[6] },
    grounded: Boolean(s[9]),
    crouched: Boolean(s[10]),
    jumpBuffer: s[13],
    landingAge: s[14],
    speed: Math.hypot(s[4], s[6]),
  };
}
export function validSnapshot(s) {
  return (
    Array.isArray(s) &&
    s.length === 32 &&
    typeof s[0] === "string" &&
    s[0].length <= 40 &&
    s.slice(1).every(Number.isFinite) &&
    s.slice(1, 7).every((n) => Math.abs(n) < 10000) &&
    Math.abs(s[7]) <= 7 &&
    Math.abs(s[8]) <= 1.5 &&
    [0, 1].includes(s[9]) &&
    [0, 1].includes(s[10]) &&
    Number.isSafeInteger(s[11]) &&
    s[11] >= 0 &&
    [0, 1, 2].includes(s[12]) &&
    s[15] >= 0 &&
    s[15] <= 100 &&
    [0, 2].includes(s[29]) &&
    Number.isInteger(s[30]) &&
    s[30] >= 0 &&
    s[30] < SKINS.length
  );
}
export function validRoster(players) {
  return (
    Array.isArray(players) &&
    players.length <= 32 &&
    new Set(players.map((p) => p?.id)).size === players.length &&
    players.every(
      (p) =>
        p &&
        typeof p.id === "string" &&
        typeof p.name === "string" &&
        p.name.length <= 18 &&
        [0, 1].includes(p.team),
    )
  );
}
export function validServerMessage(m) {
  if (!m || typeof m !== "object") return false;
  if (m.t === "error") return typeof m.message === "string";
  if (m.t === "pong" || m.t === "probe") return Number.isFinite(m.at);
  if (m.t === "combat")
    return (
      typeof m.attacker === "string" &&
      typeof m.victim === "string" &&
      WEAPON_IDS.includes(m.weapon) &&
      Number.isFinite(m.damage) &&
      Number.isFinite(m.health) &&
      typeof m.killed === "boolean"
    );
  if (m.t === "welcome")
    return (
      validMatch(m.match) &&
      typeof m.id === "string" &&
      /^[A-Z2-9]{5}$/.test(m.code) &&
      validRoster(m.roster) &&
      validSnapshot(m.state) &&
      m.state[0] === m.id
    );
  if (m.t === "roster") return validRoster(m.players);
  if (m.t === "snapshot")
    return (
      validMatch(m.match) &&
      Number.isFinite(m.at) &&
      Array.isArray(m.players) &&
      m.players.length <= 32 &&
      new Set(m.players.map((p) => p?.[0])).size === m.players.length &&
      m.players.every(validSnapshot)
    );
  return false;
}
function validMatch(m) {
  return (
    !!m &&
    ["deathmatch", "tactical"].includes(m.mode) &&
    ["district", "kestrel"].includes(m.map) &&
    Number.isFinite(m.endsAt) &&
    typeof m.ended === "boolean" &&
    Number.isInteger(m.capacity) &&
    m.capacity >= 2 &&
    m.capacity <= 32
  );
}
