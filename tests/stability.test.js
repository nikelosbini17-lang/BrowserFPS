import test from "node:test";
import assert from "node:assert/strict";
import { validateSettings, defaults } from "../src/utils/Settings.js";
import { validServerMessage } from "../src/network/Protocol.js";
import { contact, moveAndSlide } from "../src/player/Collision.js";
test("Corrupted persisted settings cannot make projection or render size invalid", () => {
  const s = validateSettings({
    fov: "broken",
    resolution: null,
    sensitivity: {},
    quality: "bad",
    volume: 1e99,
  });
  assert.equal(s.fov, defaults.fov);
  assert.equal(s.resolution, 1);
  assert.equal(s.sensitivity, 1);
  assert.equal(s.volume, 1);
});
test("Malformed server packets, duplicate IDs and nonfinite snapshots are rejected", () => {
  for (const m of [
    null,
    [],
    { t: "roster", players: null },
    { t: "snapshot", at: 1, players: [[null]] },
    { t: "welcome" },
  ])
    assert.equal(validServerMessage(m), false);
});
test("Round corners preserve diagonal clearance and wall tangential velocity", () => {
  const box = { minX: 0, maxX: 2, minZ: 0, maxZ: 2, bottom: 0, top: 3 };
  assert.equal(contact({ x: -0.25, y: 0, z: -0.25 }, 0.32, 1.8, box), null);
  const s = {
    position: { x: -0.33, y: 0, z: 0.5 },
    velocity: { x: 3, y: 0, z: 4 },
    grounded: true,
  };
  moveAndSlide(s, { colliders: [box] }, 0.1, 0.32, 1.8);
  assert.ok(s.position.x <= -0.319);
  assert.equal(s.velocity.z, 4);
  assert.equal(s.velocity.x, 0);
});
test("Overlapping wall seams depenetrate and allow walking out of an embedded corner", () => {
  const boxes = [
    { minX: 0, maxX: 2, minZ: 0, maxZ: 2, bottom: 0, top: 3 },
    { minX: 0, maxX: 2, minZ: 1.99, maxZ: 4, bottom: 0, top: 3 },
  ];
  const s = {
    position: { x: 0.05, y: 0, z: 2 },
    velocity: { x: -3, y: 0, z: 2 },
    grounded: true,
  };
  for (let i = 0; i < 30; i++)
    moveAndSlide(s, { colliders: boxes }, 1 / 120, 0.32, 1.8);
  assert.ok(s.position.x < -0.4);
  assert.ok(s.position.z > 2.4);
});
