import { MathUtils } from "three";

// Ammo, reload, recoil, scope and action timing are reusable; rendering stays separate.
export class Weapon {
  constructor(audio, config) {
    this.audio = audio;
    this.config = config;
    this.reset();
  }
  reset() {
    const c = this.config;
    this.ammo = c.magazine;
    this.reserve = c.reserve;
    this.cooldown = 0;
    this.reloadRemaining = 0;
    this.drawRemaining = 0;
    this.boltRemaining = 0;
    this.recoil = 0;
    this.shotIndex = 0;
    this.idle = 10;
    this.kick = 0;
    this.inaccuracy = c.standingAccuracy;
    this.infiniteReserve = true;
    this.zoom = 0;
  }
  get scoped() {
    return this.zoom > 0;
  }
  get scopeFov() {
    return this.config.scopeFovs?.[this.zoom - 1];
  }
  cycleScope() {
    if (
      !this.config.scopeFovs ||
      this.reloadRemaining > 0 ||
      this.boltRemaining > 0 ||
      this.drawRemaining > 0
    )
      return false;
    this.zoom = (this.zoom + 1) % (this.config.scopeFovs.length + 1);
    this.audio.play("scope");
    return true;
  }
  holster() {
    this.reloadRemaining = 0;
    this.zoom = 0;
  }
  draw() {
    this.drawRemaining = this.config.drawTime;
    this.audio.play("ready", 0.5);
  }
  reload() {
    const c = this.config;
    if (
      this.reloadRemaining ||
      this.ammo === c.magazine ||
      this.drawRemaining > 0 ||
      this.boltRemaining > 0 ||
      (!this.reserve && !this.infiniteReserve)
    )
      return false;
    this.reloadRemaining = c.reloadTime;
    this.zoom = 0;
    this.audio.play("reload");
    return true;
  }
  update(dt, player, active = true) {
    const c = this.config;
    this.cooldown = Math.max(0, this.cooldown - dt);
    const wasCycling = this.boltRemaining > 0;
    this.boltRemaining = Math.max(0, this.boltRemaining - dt);
    if (wasCycling && this.boltRemaining === 0 && active)
      this.audio.play("bolt");
    this.drawRemaining = Math.max(0, this.drawRemaining - dt);
    this.idle += dt;
    if (this.idle > c.recoveryDelay) {
      this.recoil = MathUtils.damp(this.recoil, 0, c.recoveryRate, dt);
      this.shotIndex = 0;
    }
    this.kick = MathUtils.damp(this.kick, 0, 15, dt);
    const stance = player.crouched ? c.crouchingAccuracy : c.standingAccuracy;
    const landing =
      Math.max(0, 1 - (player.landingAge ?? 1) / 0.25) * c.landingAccuracy;
    const desired = !player.grounded
      ? c.airAccuracy
      : stance + ((player.speed || 0) / 5.5) * c.movementAccuracy + landing;
    this.inaccuracy = MathUtils.damp(
      this.inaccuracy,
      desired,
      desired > this.inaccuracy ? 15 : c.recoveryRate,
      dt,
    );
    if (this.reloadRemaining > 0 && active) {
      this.reloadRemaining -= dt;
      if (this.reloadRemaining <= 0) {
        const count = Math.min(
          c.magazine - this.ammo,
          this.infiniteReserve ? c.magazine : this.reserve,
        );
        this.ammo += count;
        if (!this.infiniteReserve) this.reserve -= count;
        this.reloadRemaining = 0;
        this.audio.play("ready");
      }
    }
  }
  fire() {
    if (
      this.cooldown > 0 ||
      this.reloadRemaining > 0 ||
      this.drawRemaining > 0 ||
      this.boltRemaining > 0
    )
      return false;
    if (this.ammo <= 0) {
      this.cooldown = 0.25;
      this.audio.play("empty");
      return false;
    }
    const c = this.config;
    this.ammo--;
    this.cooldown = c.interval;
    this.idle = 0;
    this.kick = c.kick;
    this.recoil = Math.min(c.maxRecoil, this.recoil + c.recoilPerShot);
    this.shotIndex++;
    this.boltRemaining = c.boltTime || 0;
    if (c.boltTime) this.zoom = 0;
    this.audio.play(c.sound);
    return true;
  }
  get spread() {
    return (
      this.inaccuracy +
      this.recoil +
      (this.config.hipAccuracy && !this.scoped ? this.config.hipAccuracy : 0)
    );
  }
}
