import test from "node:test";
import assert from "node:assert/strict";
import { stepMovement, resetMovement } from "../src/player/Movement.js";
import { MOVEMENT } from "../src/config/MovementConfig.js";

const flat = { collides: () => false, floorHeight: () => 0 };
const idle = { x: 0, z: 0, yaw: 0 };
function state() {
  const s = { position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } };
  resetMovement(s);
  return s;
}
function run(s, command, seconds, hz = 120) {
  for (let i = 0; i < Math.round(seconds * hz); i++)
    stepMovement(s, command, flat, 1 / hz);
}

test("Running is capped; diagonal input is normalized; counter-strafing brakes sooner", () => {
  const straight = state(),
    diagonal = state();
  run(straight, { ...idle, z: -1 }, 1);
  run(diagonal, { ...idle, x: 1, z: -1 }, 1);
  assert.ok(Math.abs(straight.speed - MOVEMENT.maxGroundSpeed) < 0.01);
  assert.ok(Math.abs(straight.speed - diagonal.speed) < 0.001);
  const coast = structuredClone(straight),
    counter = structuredClone(straight);
  run(coast, idle, 0.05);
  run(counter, { ...idle, z: 1 }, 0.05);
  assert.ok(counter.speed < coast.speed);
});
test("Airborne release preserves velocity; correctly directed air strafe gains capped momentum", () => {
  const s = state();
  s.position.y = 20;
  s.grounded = false;
  s.velocity.z = -5.5;
  run(s, idle, 0.1);
  assert.equal(s.speed, 5.5);
  run(s, { ...idle, x: 1 }, 0.15);
  assert.ok(s.speed > 5.5);
  assert.ok(s.speed <= MOVEMENT.bhopSpeedCap);
  for (let i = 0; i < 1200; i++) {
    s.position.y = 20;
    s.grounded = false;
    const perpendicularYaw = Math.atan2(-s.velocity.z, s.velocity.x);
    stepMovement(s, { ...idle, x: 1, yaw: perpendicularYaw }, flat, 1 / 120);
    assert.ok(s.speed <= MOVEMENT.bhopSpeedCap + 1e-9);
  }
});
test("Timed landing jump preserves momentum; missed timing pays landing friction", () => {
  const timed = state();
  timed.position.y = 0.02;
  timed.velocity = { x: 7, y: -5, z: 0 };
  timed.grounded = false;
  const late = structuredClone(timed);
  const result = stepMovement(timed, { ...idle, jump: true }, flat, 1 / 120);
  stepMovement(late, idle, flat, 1 / 120);
  assert.equal(result.jumped, true);
  assert.equal(timed.grounded, false);
  assert.equal(timed.speed, 7);
  run(late, idle, 0.06);
  stepMovement(late, { ...idle, jump: true }, flat, 1 / 120);
  assert.ok(late.speed < timed.speed * 0.7);
});
test("Early airborne presses expire; jumping cannot manufacture speed", () => {
  const s = state();
  stepMovement(s, { ...idle, jump: true }, flat, 1 / 120);
  run(s, idle, 0.1);
  stepMovement(s, { ...idle, jump: true }, flat, 1 / 120);
  run(s, idle, 1);
  assert.equal(s.grounded, true);
  assert.equal(s.speed, 0);
});
test("Acceleration and friction remain close at 60 and 120 Hz", () => {
  const a = state(),
    b = state();
  run(a, { ...idle, z: -1 }, 2, 60);
  run(b, { ...idle, z: -1 }, 2, 120);
  assert.ok(Math.abs(a.position.z - b.position.z) < 0.08);
  assert.ok(Math.abs(a.speed - b.speed) < 0.01);
});
