import test from "node:test";
import assert from "node:assert/strict";
import { Vector3, PerspectiveCamera } from "three";
import { Rifle, RIFLE } from "../src/weapons/Rifle.js";
import { KestrelMap } from "../src/maps/KestrelMap.js";
import { Targets } from "../src/combat/Targets.js";
import { Player } from "../src/player/Player.js";

const audio = { play() {} };
test("Rifle enforces rate limits, ammunition and timed reload", () => {
  const gun = new Rifle(audio);
  gun.infiniteReserve = false;
  const player = { grounded: true, speed: 0 };
  assert.equal(gun.fire(), true);
  assert.equal(gun.ammo, 29);
  assert.equal(gun.fire(), false);
  assert.equal(gun.reload(), true);
  assert.equal(gun.fire(), false);
  gun.update(RIFLE.reloadTime - 0.1, player);
  assert.equal(gun.ammo, 29);
  gun.update(0.11, player);
  assert.equal(gun.ammo, 30);
  assert.equal(gun.reserve, 89);
  gun.ammo = 0;
  gun.reserve = 0;
  assert.equal(gun.fire(), false);
  assert.equal(gun.reload(), false);
});
test("Finite reload transfers only remaining reserve; unlimited reserve is preserved", () => {
  const gun = new Rifle(audio);
  gun.ammo = 4;
  gun.reserve = 3;
  gun.infiniteReserve = false;
  gun.reload();
  gun.update(3, { grounded: true, speed: 0 });
  assert.equal(gun.ammo, 7);
  assert.equal(gun.reserve, 0);
  gun.infiniteReserve = true;
  gun.reload();
  gun.update(3, { grounded: true, speed: 0 });
  assert.equal(gun.ammo, 30);
  assert.equal(gun.reserve, 0);
});
test("Headshots multiply damage and dead targets reject further hits", () => {
  const targets = Object.create(Targets.prototype);
  const target = { health: 100, alive: true, group: { visible: true } };
  const hit = targets.damage(target, "head", 34, 5);
  assert.equal(hit.killed, true);
  assert.equal(target.group.visible, false);
  assert.equal(target.respawn, 3);
  assert.equal(targets.damage(target, "body", 34, 5), null);
  const leg = { health: 100, alive: true };
  targets.damage(leg, "legs", 34, 5);
  assert.ok(leg.health > 75);
});
test("Collision blocks walls and supports platform tops and gradual ramps", () => {
  const world = Object.create(KestrelMap.prototype);
  world.ramp = { minX: -12, maxX: -8, minZ: 13, maxZ: 19, height: 1.2 };
  world.colliders = [{ minX: 2, maxX: 4, minZ: 2, maxZ: 4, bottom: 0, top: 2 }];
  assert.equal(world.collides(new Vector3(1.8, 0, 3), 0.32, 1.8), true);
  assert.equal(world.collides(new Vector3(3, 2, 3), 0.32, 1.8), false);
  assert.equal(world.floorHeight(3, 3, 2.1), 2);
  assert.equal(world.floorHeight(-10, 16, 0.6), 0.6);
});
test("Fixed-step movement stays grounded, jumps, lands and decelerates", () => {
  const player = new Player(
    new PerspectiveCamera(),
    { collides: () => false, floorHeight: () => 0 },
    audio,
  );
  const keys = new Set(["KeyW"]);
  const input = {
    consumeLook: () => [0, 0],
    down: (...codes) => codes.some((c) => keys.has(c)),
  };
  const settings = { sensitivity: 1, invert: false, bob: false };
  for (let i = 0; i < 120; i++) player.update(1 / 120, input, settings);
  assert.ok(player.position.z < 19);
  assert.equal(player.position.y, 0);
  keys.add("Space");
  player.update(1 / 120, input, settings);
  assert.ok(player.position.y > 0);
  assert.equal(player.grounded, false);
  keys.clear();
  for (let i = 0; i < 180; i++) player.update(1 / 120, input, settings);
  assert.equal(player.position.y, 0);
  assert.equal(player.grounded, true);
  assert.ok(player.speed < 0.01);
});
test("Player damage consumes armor and transitions alive state", () => {
  const player = new Player(new PerspectiveCamera(), {}, audio);
  player.armor = 20;
  player.damage(40);
  assert.equal(player.health, 78);
  assert.equal(player.armor, 2);
  player.damage(200);
  assert.equal(player.health, 0);
  assert.equal(player.alive, false);
});
