import { WeaponManager } from "../src/weapons/WeaponManager.js";
import { packState } from "../src/network/Protocol.js";
import { hitPlayer, worldDistance } from "../src/combat/Hitboxes.js";
const silent = { play() {} };
export function resetCombat(p) {
  p.weapons ||= new WeaponManager(silent);
  p.weapons.reset();
  p.weapons.setInfiniteReserve(false);
  p.health = 100;
  p.kills ??= 0;
  p.deaths ??= 0;
  p.life = (p.life || 0) + 1;
  p.shotAck = p.lastShotId || 0;
  p.respawnAt = 0;
  p.protectedUntil = 0;
}
export function validAction(m) {
  return (
    ["fire", "reload", "scope"].includes(m.action) &&
    Number.isSafeInteger(m.seq) &&
    m.seq >= 0 &&
    m.seq < 1e10 &&
    [0, 1, 2].includes(m.slot) &&
    (m.action !== "fire" ||
      (Number.isSafeInteger(m.shotId) &&
        m.shotId > 0 &&
        m.shotId < 1e10 &&
        Number.isFinite(m.yaw) &&
        Math.abs(m.yaw) <= Math.PI * 2 &&
        Number.isFinite(m.pitch) &&
        Math.abs(m.pitch) <= 1.48))
  );
}
export function combatAction(room, p, m, now) {
  if (m.action === "fire") p.shotAck = Math.max(p.shotAck, m.shotId);
  if (p.health <= 0 || m.slot !== p.slot || room.ended) return;
  const weapon = p.weapons.current;
  if (m.action === "reload") {
    weapon.reload();
    return;
  }
  if (m.action === "scope") {
    weapon.cycleScope();
    return;
  }
  const spread = weapon.spread;
  if (!weapon.fire()) return;
  p.protectedUntil = 0;
  const cp = Math.cos(m.pitch),
    d = {
      x: -Math.sin(m.yaw) * cp,
      y: Math.sin(m.pitch),
      z: -Math.cos(m.yaw) * cp,
    };
  for (const axis of ["x", "y", "z"]) d[axis] += (Math.random() - 0.5) * spread;
  const len = Math.hypot(d.x, d.y, d.z);
  for (const axis of ["x", "y", "z"]) d[axis] /= len;
  const o = { ...p.state.position };
  o.y += p.state.crouched ? 1.05 : 1.65;
  let nearest = worldDistance(room.world, o, d, weapon.config.range),
    result = null;
  // Snapshot travel + shot travel + client interpolation. Never accept a client timestamp.
  const rewind = now - Math.min(250, (p.ping || 0) + 100);
  let before = room.history[0],
    after = before;
  for (const frame of room.history) {
    if (frame.time <= rewind) before = frame;
    after = frame;
    if (frame.time >= rewind) break;
  }
  for (const target of room.players.values()) {
    if (target === p || target.health <= 0 || target.protectedUntil > now)
      continue;
    let past = before?.players.find(
      (s) => s[0] === target.id && s[25] === target.life,
    );
    const next = after?.players.find(
      (s) => s[0] === target.id && s[25] === target.life,
    );
    if (past && next && after.time > before.time) {
      const t = Math.max(
        0,
        Math.min(1, (rewind - before.time) / (after.time - before.time)),
      );
      past = [...past];
      for (const i of [1, 2, 3]) past[i] += (next[i] - past[i]) * t;
      past[7] +=
        Math.atan2(Math.sin(next[7] - past[7]), Math.cos(next[7] - past[7])) *
        t;
    }
    const hit = hitPlayer(o, d, past || packState(target), nearest);
    if (hit) {
      nearest = hit.distance;
      result = { target, hit };
    }
  }
  if (room.debug) console.log("SHOT", p.name, weapon.config.id, m.shotId);
  if (!result) return;
  const { target, hit } = result,
    damage = Math.round(
      weapon.config.damage *
        hit.multiplier *
        Math.max(0.65, 1 - hit.distance * weapon.config.falloff),
    );
  target.health = Math.max(0, target.health - damage);
  const killed = target.health === 0;
  if (killed) {
    p.kills++;
    target.deaths++;
    target.state.velocity = { x: 0, y: 0, z: 0 };
    target.respawnAt = room.mode?.respawnDelay
      ? now + room.mode.respawnDelay
      : 0;
  }
  room.events.push({
    t: "combat",
    attacker: p.id,
    victim: target.id,
    shotId: m.shotId,
    weapon: weapon.config.id,
    damage,
    health: target.health,
    killed,
    headshot: hit.region === "head",
  });
  if (room.debug)
    console.log(
      killed ? "KILL" : "SERVER HIT",
      p.name,
      target.name,
      damage,
      target.health,
    );
  room.lastCombat = { ...target.state.position, at: now };
}
