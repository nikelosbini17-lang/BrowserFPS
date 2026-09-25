import { Vector3, MathUtils } from "three";
import { resetMovement, stepMovement } from "./Movement.js";

export class Player {
  constructor(camera, world, audio) {
    this.camera = camera;
    this.world = world;
    this.audio = audio;
    this.position = new Vector3();
    this.velocity = new Vector3();
    this.reset();
  }
  reset() {
    this.position.set(0, 0, 23);
    this.velocity.set(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.grounded = true;
    this.eyeHeight = 1.65;
    this.health = 100;
    this.armor = 0;
    this.alive = true;
    this.kills = 0;
    this.shots = 0;
    this.hits = 0;
    this.stepDistance = 0;
    this.bobTime = 0;
    this.landing = 0;
    this.jumpHeld = false;
    resetMovement(this);
  }
  damage(amount) {
    if (!this.alive) return;
    const absorbed = Math.min(this.armor, amount * 0.45);
    this.armor -= absorbed;
    this.health = Math.max(0, this.health - (amount - absorbed));
    this.alive = this.health > 0;
  }
  update(dt, input, settings, weapon = null) {
    const [mx, my] = input.consumeLook();
    const sensitivity =
      settings.sensitivity *
      (weapon?.scoped ? weapon.scopeFov / settings.fov : 1);
    this.yaw -= mx * sensitivity * 0.0018;
    this.pitch = MathUtils.clamp(
      this.pitch - my * sensitivity * 0.0018 * (settings.invert ? -1 : 1),
      -1.48,
      1.48,
    );
    const jumpPressed = input.consumeJump
      ? input.consumeJump()
      : input.consumePressed?.("Space") ||
        (input.down("Space") && !this.jumpHeld);
    this.jumpHeld = input.down("Space");
    this.lastCommand = {
      x: Number(input.down("KeyD")) - Number(input.down("KeyA")),
      z: Number(input.down("KeyS")) - Number(input.down("KeyW")),
      yaw: this.yaw,
      jump: Boolean(jumpPressed),
      crouch: input.down("ControlLeft", "ControlRight"),
      walk: input.down("ShiftLeft", "ShiftRight"),
      speedMultiplier: weapon?.config.speedMultiplier ?? 1,
    };
    const events = stepMovement(this, this.lastCommand, this.world, dt);
    if (events.jumped) this.audio.play("jump");
    if (events.landed && events.impact > 2) {
      this.landing = Math.min(0.1, events.impact * 0.008);
      this.audio.play("land");
    }
    const targetEye = this.crouched ? 1.05 : 1.65;
    this.eyeHeight = MathUtils.damp(this.eyeHeight, targetEye, 16, dt);
    this.bobTime += this.speed * dt * 1.9;
    this.stepDistance += this.grounded ? this.speed * dt : 0;
    if (this.stepDistance > 2.4) {
      this.stepDistance = 0;
      this.audio.play("step", this.walking || this.crouched ? 0.2 : 0.65);
    }
    this.landing = MathUtils.damp(this.landing, 0, 10, dt);
    this.camera.position.copy(this.position);
    this.camera.position.y +=
      this.eyeHeight -
      this.landing +
      (settings.bob && this.grounded
        ? Math.sin(this.bobTime * 2) * Math.min(this.speed / 5.5, 1) * 0.018
        : 0);
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
  }
}
