import test from "node:test";
import assert from "node:assert/strict";
import { Weapon } from "../src/weapons/Weapon.js";
import { WeaponManager } from "../src/weapons/WeaponManager.js";
import { WEAPONS } from "../src/config/WeaponConfig.js";
import { PerspectiveCamera } from "three";
import { Player } from "../src/player/Player.js";

const audio = { play() {} };
const standing = { grounded: true, speed: 0, landingAge: 1 };
test("R45 has seven shots, high tap accuracy, accumulated spam spread and recovery", () => {
  const pistol = new Weapon(audio, WEAPONS.r45);
  const clean = pistol.spread;
  assert.equal(pistol.ammo, 7);
  assert.equal(pistol.fire(), true);
  assert.ok(pistol.spread > clean * 20);
  assert.equal(pistol.fire(), false);
  pistol.update(0.33, standing);
  assert.equal(pistol.fire(), true);
  assert.ok(pistol.spread > 0.05);
  for (let i = 0; i < 300; i++) pistol.update(1 / 120, standing);
  assert.ok(pistol.spread < 0.001);
  assert.equal(pistol.ammo, 5);
});
test("Titan scope cycles, action blocks shots and scopes, and recoil spread does not become hip fire during shot sampling", () => {
  const sniper = new Weapon(audio, WEAPONS.titan);
  const hip = sniper.spread;
  sniper.cycleScope();
  assert.equal(sniper.scopeFov, 35);
  assert.ok(sniper.spread < hip / 50);
  sniper.cycleScope();
  assert.equal(sniper.scopeFov, 17);
  sniper.cycleScope();
  assert.equal(sniper.scoped, false);
  sniper.cycleScope();
  sniper.fire();
  assert.equal(sniper.ammo, 4);
  assert.equal(sniper.scoped, false);
  assert.equal(sniper.cycleScope(), false);
  assert.equal(sniper.reload(), false);
  assert.equal(sniper.fire(), false);
  sniper.update(1.6, standing);
  assert.equal(sniper.cycleScope(), true);
  assert.equal(sniper.reload(), true);
  assert.equal(sniper.scoped, false);
  sniper.update(3.5, standing);
  assert.equal(sniper.ammo, 4);
  sniper.update(0.11, standing);
  assert.equal(sniper.ammo, 5);
});
test("Sniper penalizes movement, air time and landing, then recovers when stationary", () => {
  const sniper = new Weapon(audio, WEAPONS.titan);
  sniper.cycleScope();
  const clean = sniper.spread;
  sniper.update(0.1, { ...standing, speed: 4 });
  assert.ok(sniper.spread > 0.03);
  sniper.update(0.1, { ...standing, grounded: false });
  assert.ok(sniper.spread > 0.08);
  sniper.update(0.1, { ...standing, landingAge: 0 });
  assert.ok(sniper.spread > 0.05);
  sniper.update(2, standing);
  assert.ok(sniper.spread < 0.001);
  assert.ok(clean <= sniper.spread);
});
test("Switching cancels reload, retains separate ammo, clears scope and cannot bypass bolt timing", () => {
  const rack = new WeaponManager(audio);
  rack.current.fire();
  rack.current.reload();
  rack.switchTo(1);
  assert.equal(rack.weapons[0].reloadRemaining, 0);
  assert.equal(rack.current.ammo, 7);
  assert.equal(rack.current.fire(), false);
  rack.update(0.3, standing);
  rack.current.fire();
  rack.previous();
  assert.equal(rack.current.config.id, "ar4");
  assert.equal(rack.current.ammo, 29);
  rack.switchTo(2);
  rack.update(0.6, standing);
  rack.current.cycleScope();
  rack.current.fire();
  rack.switchTo(1);
  rack.switchTo(2);
  rack.update(0.6, standing);
  assert.equal(rack.current.scoped, false);
  assert.equal(rack.current.fire(), false);
  assert.equal(rack.current.ammo, 4);
});
test("Scope scales mouse sensitivity with FOV and Titan reduces running speed", () => {
  const world = { collides: () => false, floorHeight: () => 0 };
  const settings = { sensitivity: 1, fov: 100, invert: false, bob: false };
  const player = new Player(new PerspectiveCamera(), world, audio),
    sniper = new Weapon(audio, WEAPONS.titan);
  const input = {
    consumeLook: () => [100, 0],
    down: () => false,
    consumeJump: () => false,
  };
  player.update(0, input, settings, sniper);
  const ordinary = player.yaw;
  player.reset();
  sniper.cycleScope();
  player.update(0, input, settings, sniper);
  assert.ok(Math.abs(player.yaw - ordinary * 0.35) < 1e-9);
  const forward = {
    consumeLook: () => [0, 0],
    down: (code) => code === "KeyW",
    consumeJump: () => false,
  };
  for (let i = 0; i < 120; i++)
    player.update(1 / 120, forward, settings, sniper);
  assert.ok(
    Math.abs(player.speed - 5.5 * WEAPONS.titan.speedMultiplier) < 0.01,
  );
});
