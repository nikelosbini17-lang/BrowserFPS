import { MOVEMENT } from "../config/MovementConfig.js";
import { moveAndSlide } from "./Collision.js";

export function resetMovement(state) {
  state.jumpBuffer = 0;
  state.landingAge = 1;
  state.speed = 0;
  state.crouched = false;
  state.walking = false;
  state.grounded = true;
  state.lastSafe = { ...state.position };
  state.stuckTime = 0;
}

function accelerate(velocity, x, z, desiredSpeed, amount) {
  const projected = velocity.x * x + velocity.z * z;
  const add = Math.min(desiredSpeed - projected, amount);
  if (add > 0) {
    velocity.x += x * add;
    velocity.z += z * add;
  }
}

// Pure simulation: no browser, renderer, audio, or client-provided positions.
export function stepMovement(state, command, world, dt, config = MOVEMENT) {
  const p = state.position,
    v = state.velocity;
  const events = { jumped: false, landed: false, impact: 0 };
  state.jumpBuffer = command.jump
    ? config.jumpBufferTime
    : Math.max(0, (state.jumpBuffer || 0) - dt);
  state.landingAge = (state.landingAge ?? 1) + dt;
  state.crouched = Boolean(command.crouch);
  state.walking = Boolean(command.walk);
  let x = command.x || 0,
    z = command.z || 0;
  const magnitude = Math.hypot(x, z);
  if (magnitude > 0) {
    x /= magnitude;
    z /= magnitude;
  }
  const c = Math.cos(command.yaw),
    s = Math.sin(command.yaw);
  const wishX = x * c + z * s,
    wishZ = -x * s + z * c;
  const weaponSpeed = command.speedMultiplier ?? 1;
  const stance = state.crouched
    ? config.crouchMultiplier
    : state.walking
      ? config.walkMultiplier
      : 1;
  const groundSpeed = config.maxGroundSpeed * stance * weaponSpeed;

  // A queued landing jump happens BEFORE ground friction. Holding Space is not auto-hop.
  if (state.grounded && state.jumpBuffer > 0) {
    v.y = config.jumpVelocity;
    state.grounded = false;
    state.jumpBuffer = 0;
    events.jumped = true;
  }
  if (state.grounded) {
    const speed = Math.hypot(v.x, v.z);
    if (speed > 0) {
      const friction =
        config.groundFriction +
        (state.landingAge < config.landingFrictionTime
          ? config.landingFriction
          : 0);
      const nextSpeed = Math.max(
        0,
        speed - Math.max(speed, config.stopSpeed) * friction * dt,
      );
      v.x *= nextSpeed / speed;
      v.z *= nextSpeed / speed;
    }
    if (magnitude) {
      const opposing = v.x * wishX + v.z * wishZ < 0;
      accelerate(
        v,
        wishX,
        wishZ,
        groundSpeed,
        config.groundAcceleration *
          groundSpeed *
          dt *
          (opposing ? config.counterStrafeMultiplier : 1),
      );
    }
  } else if (magnitude) {
    const beforeSpeed = Math.hypot(v.x, v.z);
    const strafeWeight = Math.abs(x);
    const efficiency =
      config.forwardAirMultiplier +
      (1 - config.forwardAirMultiplier) * strafeWeight;
    // Projection-limited air acceleration rewards turning + strafing; no bonus per jump.
    accelerate(
      v,
      wishX,
      wishZ,
      (config.airSpeedCap ?? config.maxAirSpeed) * stance * weaponSpeed,
      config.airAcceleration * groundSpeed * dt * efficiency,
    );
    const speed = Math.hypot(v.x, v.z);
    const alignment = speed > 0 ? (v.x * wishX + v.z * wishZ) / speed : 0;
    if (alignment > 0 && speed > 0) {
      const turn = config.airControl * alignment * alignment * dt * efficiency;
      const nx = v.x + wishX * speed * turn,
        nz = v.z + wishZ * speed * turn;
      const length = Math.hypot(nx, nz);
      v.x = (nx / length) * speed;
      v.z = (nz / length) * speed;
    }
    state.strafeEfficiency = Math.min(
      100,
      Math.max(
        0,
        ((Math.hypot(v.x, v.z) - beforeSpeed) /
          (config.airAcceleration * groundSpeed * dt)) *
          100,
      ),
    );
  }
  const horizontalSpeed = Math.hypot(v.x, v.z);
  const speedCap = (config.maxBhopSpeed ?? config.bhopSpeedCap) * weaponSpeed;
  if (horizontalSpeed > speedCap) {
    v.x *= speedCap / horizontalSpeed;
    v.z *= speedCap / horizontalSpeed;
  }
  v.y -= config.gravity * dt;
  const height = state.crouched
    ? config.crouchingHeight
    : config.standingHeight;
  if (world.colliders)
    moveAndSlide(state, world, dt, config.playerRadius, height);
  else
    for (let i = 0; i < 1; i++) {
      for (const axis of ["x", "z"]) {
        const before = p[axis];
        p[axis] += v[axis] * dt;
        if (world.collides(p, config.playerRadius, height)) {
          p[axis] = before;
          v[axis] = 0;
        }
      }
    }
  const oldY = p.y;
  p.y += v.y * dt;
  if (v.y > 0 && world.colliders)
    for (const b of world.colliders) {
      if (
        oldY + height <= b.bottom + 0.02 &&
        p.y + height > b.bottom &&
        p.x + config.playerRadius > b.minX &&
        p.x - config.playerRadius < b.maxX &&
        p.z + config.playerRadius > b.minZ &&
        p.z - config.playerRadius < b.maxZ
      ) {
        p.y = b.bottom - height;
        v.y = 0;
      }
    }
  const floor = world.floorHeight(p.x, p.z, oldY);
  if (p.y <= floor && v.y <= 0) {
    if (!state.grounded) {
      events.landed = true;
      events.impact = -v.y;
      state.landingAge = 0;
    }
    p.y = floor;
    v.y = 0;
    state.grounded = true;
    // A buffered input just before impact preserves the same velocity as a next-tick jump.
    if (state.jumpBuffer > 0) {
      v.y = config.jumpVelocity;
      state.grounded = false;
      state.jumpBuffer = 0;
      events.jumped = true;
    }
  } else state.grounded = false;
  state.speed = Math.hypot(v.x, v.z);
  return events;
}
