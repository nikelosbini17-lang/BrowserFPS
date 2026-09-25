import * as THREE from "three";
export class Shooting {
  constructor(scene, world, targets, audio, onHit) {
    this.world = world;
    this.targets = targets;
    this.audio = audio;
    this.onHit = onHit;
    this.raycaster = new THREE.Raycaster();
    this.direction = new THREE.Vector3();
    this.origin = new THREE.Vector3();
    this.effects = [];
    const geometry = new THREE.IcosahedronGeometry(0.035, 0);
    const material = new THREE.MeshBasicMaterial({ color: "#ffe4af" });
    for (let i = 0; i < 24; i++) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = false;
      scene.add(mesh);
      this.effects.push({ mesh, life: 0 });
    }
    this.nextEffect = 0;
  }
  fire(camera, player, rifle) {
    // Sample BEFORE adding recoil and cycling the sniper out of its scope.
    const spread = rifle.spread;
    if (!rifle.fire()) return false;
    player.shots++;
    camera.updateMatrixWorld();
    camera.getWorldDirection(this.direction);
    this.direction.x += (Math.random() - 0.5) * spread;
    this.direction.y += (Math.random() - 0.5) * spread;
    this.direction.z += (Math.random() - 0.5) * spread;
    this.direction.normalize();
    camera.getWorldPosition(this.origin);
    this.raycaster.set(this.origin, this.direction);
    this.raycaster.far = rifle.config.range;
    const candidates = [
      ...this.world.surfaces,
      ...this.targets.hitMeshes.filter((m) => m.userData.target.alive),
    ];
    const hit = this.raycaster.intersectObjects(candidates, false)[0];
    if (hit) {
      const effect = this.effects[this.nextEffect++ % this.effects.length];
      effect.mesh.position
        .copy(hit.point)
        .addScaledVector(this.direction, -0.04);
      effect.life = 0.18;
      effect.mesh.visible = true;
      if (hit.object.userData.target) {
        const { target, region } = hit.object.userData;
        const result = this.targets.damage(
          target,
          region,
          rifle.config.damage,
          hit.distance,
          rifle.config.falloff,
        );
        if (result) {
          player.hits++;
          if (result.killed) player.kills++;
          this.audio.play(result.killed ? "kill" : "hit");
          this.onHit(result);
        }
      }
    }
    // Original pattern: rising first shots, then alternating horizontal drift.
    player.pitch = Math.min(
      1.48,
      player.pitch +
        rifle.config.cameraKick +
        (rifle.config.automatic ? Math.min(rifle.shotIndex, 12) * 0.0005 : 0),
    );
    player.yaw +=
      Math.sin(rifle.shotIndex * 0.88) * rifle.config.horizontalKick;
    return true;
  }
  update(dt) {
    for (const effect of this.effects) {
      effect.life -= dt;
      effect.mesh.visible = effect.life > 0;
      if (effect.life > 0) effect.mesh.scale.setScalar(1 + effect.life * 4);
    }
  }
}
