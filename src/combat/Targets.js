import * as THREE from "three";

export class Targets {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.hitMeshes = [];
    this.material = new THREE.MeshStandardMaterial({
      color: "#c86e48",
      roughness: 0.8,
    });
    this.dark = new THREE.MeshStandardMaterial({
      color: "#393f3c",
      roughness: 0.85,
    });
    this.plate = new THREE.MeshStandardMaterial({
      color: "#e3be7d",
      roughness: 0.7,
    });
    [
      [-3, 5],
      [6, 0],
      [0, -13],
      [-19, -19],
      [21, -21],
      [18, 12],
    ].forEach(([x, z], i) => this.add(x, z, i));
  }
  add(x, z, id) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const target = {
      id,
      name: `DRONE ${String(id + 1).padStart(2, "0")}`,
      group,
      health: 100,
      alive: true,
      respawn: 0,
      flash: 0,
      meshes: [],
    };
    const part = (w, h, d, px, py, region, material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      mesh.position.set(px, py, 0);
      mesh.castShadow = true;
      mesh.userData = { target, region };
      group.add(mesh);
      this.hitMeshes.push(mesh);
      target.meshes.push(mesh);
    };
    part(0.37, 0.39, 0.36, 0, 1.83, "head", this.material);
    part(0.66, 0.65, 0.38, 0, 1.29, "body", this.material);
    part(0.24, 0.65, 0.26, -0.47, 1.25, "arms", this.dark);
    part(0.24, 0.65, 0.26, 0.47, 1.25, "arms", this.dark);
    part(0.24, 0.77, 0.27, -0.19, 0.56, "legs", this.dark);
    part(0.24, 0.77, 0.27, 0.19, 0.56, "legs", this.dark);
    const eye = new THREE.Mesh(
      new THREE.BoxGeometry(0.27, 0.065, 0.02),
      this.plate,
    );
    eye.position.set(0, 1.86, 0.19);
    group.add(eye);
    const bullseye = new THREE.Mesh(
      new THREE.RingGeometry(0.1, 0.14, 12),
      this.plate,
    );
    bullseye.position.set(0, 1.35, 0.198);
    group.add(bullseye);
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.64, 0.12, 8),
      this.dark,
    );
    base.position.set(x, 0.06, z);
    target.base = base;
    this.scene.add(base);
    this.scene.add(group);
    this.list.push(target);
    return target;
  }
  damage(target, region, baseDamage, distance, falloff = 0.003) {
    if (!target.alive) return null;
    const multiplier = { head: 3.5, body: 1, arms: 0.85, legs: 0.65 }[region];
    const damage = Math.round(
      baseDamage * multiplier * Math.max(0.65, 1 - distance * falloff),
    );
    target.health = Math.max(0, target.health - damage);
    target.flash = 0.1;
    if (!target.health) {
      target.alive = false;
      target.group.visible = false;
      target.respawn = 3;
    }
    return {
      damage,
      killed: !target.alive,
      headshot: region === "head",
      target,
    };
  }
  update(dt) {
    for (const target of this.list) {
      if (!target.alive) {
        target.respawn -= dt;
        if (target.respawn <= 0) this.resetTarget(target);
      }
      target.flash = Math.max(0, target.flash - dt);
      target.group.scale.setScalar(target.flash > 0 ? 1.035 : 1);
    }
  }
  resetTarget(target) {
    target.alive = true;
    target.health = 100;
    target.group.visible = true;
    target.flash = 0;
    target.group.scale.setScalar(1);
  }
  reset() {
    this.list.forEach((target) => this.resetTarget(target));
  }
  setVisible(visible) {
    for (const target of this.list) {
      target.group.visible = visible && target.alive;
      target.base.visible = visible;
    }
  }
}
