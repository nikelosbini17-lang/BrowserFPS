import test from "node:test";
import assert from "node:assert/strict";
import { DistrictMap } from "../src/maps/DistrictMap.js";
import { Room } from "../server/Room.js";
import { combatAction } from "../server/Combat.js";
import { hitPlayer, worldDistance } from "../src/combat/Hitboxes.js";
import { packState } from "../src/network/Protocol.js";
import { stepMovement, resetMovement } from "../src/player/Movement.js";
const world = new DistrictMap(null, { collisionOnly: true });
test("District spawns are collision-free and roof ramps connect from both approaches", () => {
  assert.equal(world.spawns.length, 24);
  for (const p of world.spawns)
    assert.equal(world.collides(p, 0.32, 1.8), false, JSON.stringify(p));
  for (const reverse of [false, true]) {
    const state = {
      position: { x: 30, y: 0, z: reverse ? -35 : 5 },
      velocity: { x: 0, y: 0, z: 0 },
    };
    resetMovement(state);
    for (let i = 0; i < 500; i++)
      stepMovement(
        state,
        { x: 0, z: reverse ? 1 : -1, yaw: 0 },
        world,
        1 / 120,
      );
    assert.ok(state.position.y >= 2.9, JSON.stringify(state.position));
  }
});
test("FFA scoring, damage validation, protection, respawn loadout and match ending", () => {
  const room = new Room("ABCDE", world, 20, "deathmatch", true),
    a = room.add({}, "A"),
    b = room.add({}, "B");
  Object.assign(a.state.position, { x: 0, y: 0, z: 30 });
  Object.assign(b.state.position, { x: 0, y: 0, z: 26 });
  room.history = [];
  const shot = {
    action: "fire",
    slot: 0,
    shotId: 1,
    yaw: 0,
    pitch: Math.atan2(1.12 - 1.65, 4),
  };
  a.protectedUntil = b.protectedUntil = 10000;
  combatAction(room, a, shot, 1000);
  assert.equal(b.health, 100);
  assert.equal(a.protectedUntil, 0);
  a.weapons.current.cooldown = 0;
  b.protectedUntil = 0;
  combatAction(room, a, { ...shot, shotId: 2 }, 2000);
  assert.ok(b.health < 100);
  const hp = b.health;
  combatAction(room, a, { ...shot, shotId: 3 }, 2001);
  assert.equal(b.health, hp, "fire rate enforced");
  a.weapons.current.cooldown = 0;
  a.weapons.current.ammo = 0;
  combatAction(room, a, { ...shot, shotId: 4 }, 2100);
  assert.equal(b.health, hp, "ammo enforced");
  a.weapons.current.ammo = 30;
  a.weapons.current.cooldown = 0;
  a.weapons.current.reloadRemaining = 1;
  combatAction(room, a, { ...shot, shotId: 5 }, 2200);
  assert.equal(b.health, hp, "reload enforced");
  a.weapons.current.reloadRemaining = 0;
  for (let i = 0; i < 5 && b.health > 0; i++) {
    a.weapons.current.cooldown = 0;
    combatAction(room, a, { ...shot, shotId: 6 + i }, 3000);
  }
  assert.equal(b.health, 0);
  assert.equal(a.kills, 1);
  assert.equal(b.deaths, 1);
  assert.equal(b.respawnAt, 5000);
  b.nextLoadout.primary = 2;
  room.step(4999);
  assert.equal(b.health, 0);
  room.step(5001);
  assert.equal(b.health, 100);
  assert.equal(b.slot, 2);
  assert.equal(b.weapons.current.ammo, 5);
  assert.equal(b.weapons.weapons[1].ammo, 7);
  assert.equal(b.protectedUntil, 6501);
  assert.equal(b.deaths, 1);
  room.step(room.endsAt + 1);
  assert.equal(room.ended, true);
});
test("Head, torso, arms and legs hitboxes follow crouch and body yaw; walls occlude rays", () => {
  const room = new Room("ABCDE", world),
    p = room.add({}, "A");
  Object.assign(p.state.position, { x: 0, y: 0, z: 0 });
  p.yaw = 0;
  for (const [region, x, y] of [
    ["head", 0, 1.62],
    ["body", 0, 1.12],
    ["arms", 0.35, 1.15],
    ["legs", 0.17, 0.4],
  ]) {
    const hit = hitPlayer(
      { x, y, z: 5 },
      { x: 0, y: 0, z: -1 },
      packState(p),
      10,
    );
    assert.equal(hit.region, region);
  }
  p.state.crouched = true;
  assert.equal(
    hitPlayer(
      { x: 0, y: 1.62 * 0.68, z: 5 },
      { x: 0, y: 0, z: -1 },
      packState(p),
      10,
    ).region,
    "head",
  );
  assert.ok(
    worldDistance(world, { x: 0, y: 1, z: 50 }, { x: 0, y: 0, z: 1 }, 100) < 10,
  );
});
test("Spawn scoring rejects exposed occupied positions", () => {
  const room = new Room("ABCDE", world, 20, "deathmatch"),
    a = room.add({}, "A"),
    b = room.add({}, "B");
  const distance = Math.hypot(
    a.state.position.x - b.state.position.x,
    a.state.position.z - b.state.position.z,
  );
  assert.ok(distance > 30);
});
test("Every District ground spawn connects through walkable streets and alleys", () => {
  const start = world.spawns[0],
    queue = [[start.x, start.z]],
    seen = new Set([`${start.x},${start.z}`]);
  for (let head = 0; head < queue.length; head++)
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const [x, z] = [queue[head][0] + dx, queue[head][1] + dz],
        key = `${x},${z}`;
      if (
        Math.abs(x) > 50 ||
        Math.abs(z) > 54 ||
        seen.has(key) ||
        world.collides({ x, y: 0, z }, 0.32, 1.8)
      )
        continue;
      seen.add(key);
      queue.push([x, z]);
    }
  for (const p of world.spawns)
    assert.ok(seen.has(`${p.x},${p.z}`), `Unreachable spawn ${p.x},${p.z}`);
});
test("Pure strafe gets more air acceleration than W and left/right remain symmetric", () => {
  const flat = { collides: () => false, floorHeight: () => 0 };
  const sim = (x, z) => {
    const s = {
      position: { x: 0, y: 10, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
    };
    resetMovement(s);
    s.grounded = false;
    stepMovement(s, { x, z, yaw: 0 }, flat, 1 / 120);
    return s;
  };
  assert.ok(sim(1, 0).speed > sim(0, -1).speed * 3);
  assert.equal(sim(-1, 0).speed, sim(1, 0).speed);
});
