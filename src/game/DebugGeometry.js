import * as THREE from "three";
import { HIT_REGIONS } from "../combat/Hitboxes.js";
export class DebugGeometry {
  constructor(scene, world) {
    this.root = new THREE.Group();
    scene.add(this.root);
    this.root.visible = false;
    this.boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.material = new THREE.MeshBasicMaterial({
      color: 0x70efbb,
      wireframe: true,
      depthTest: false,
      transparent: true,
      opacity: 0.45,
    });
    for (const b of world.colliders) {
      const mesh = new THREE.Mesh(this.boxGeometry, this.material);
      mesh.position.set(
        (b.minX + b.maxX) / 2,
        (b.bottom + b.top) / 2,
        (b.minZ + b.maxZ) / 2,
      );
      mesh.scale.set(b.maxX - b.minX, b.top - b.bottom, b.maxZ - b.minZ);
      this.root.add(mesh);
    }
    this.player = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.32, 1.16, 3, 8),
      this.material,
    );
    this.root.add(this.player);
    this.velocity = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(),
      1,
      0xffdd77,
    );
    this.root.add(this.velocity);
    this.ground = new THREE.ArrowHelper(
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(),
      0.4,
      0xffffff,
    );
    this.root.add(this.ground);
    this.normals = Array.from({ length: 8 }, () => {
      const a = new THREE.ArrowHelper(
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(),
        0.8,
        0xff6688,
      );
      this.root.add(a);
      return a;
    });
    this.hitRoot = new THREE.Group();
    scene.add(this.hitRoot);
    this.hitPool = [];
    this.hitMaterials = [0xffaa55, 0x66cfff, 0xbb88ff, 0x88ff99].map(
      (color) =>
        new THREE.MeshBasicMaterial({
          color,
          wireframe: true,
          depthTest: false,
        }),
    );
  }
  update(player, remotes, colliders, hitboxes) {
    this.root.visible = Boolean(colliders);
    this.hitRoot.visible = Boolean(hitboxes);
    if (colliders) {
      this.player.position.copy(player.position);
      this.player.position.y += (player.crouched ? 1.2 : 1.8) / 2;
      this.player.scale.y = player.crouched ? 2 / 3 : 1;
      this.velocity.position.copy(player.position).y += 0.2;
      const v = player.velocity.clone();
      this.velocity.setDirection(
        v.length() > 0 ? v.normalize() : new THREE.Vector3(0, 0, -1),
      );
      this.velocity.setLength(Math.max(0.01, player.velocity.length() * 0.3));
      this.ground.position.copy(player.position).y += 0.3;
      this.normals.forEach((a, i) => {
        const n = player.contacts?.[i];
        a.visible = !!n;
        if (n) {
          a.position.copy(player.position).y += 0.7;
          a.setDirection(new THREE.Vector3(n.x, 0, n.z));
        }
      });
    }
    this.hitPool.forEach((m) => (m.visible = false));
    if (hitboxes) {
      let i = 0;
      for (const e of remotes.entities.values())
        for (const r of HIT_REGIONS) {
          let mesh = this.hitPool[i];
          if (!mesh) {
            mesh = new THREE.Mesh(
              this.boxGeometry,
              this.hitMaterials[
                ["head", "body", "arms", "legs"].indexOf(r.region)
              ],
            );
            this.hitPool.push(mesh);
            this.hitRoot.add(mesh);
          }
          mesh.visible = e.group.visible;
          mesh.position.set(r.x, r.y, r.z);
          if (r.region === "arms") {
            mesh.position.y -= 1.28;
            mesh.position.applyAxisAngle(
              new THREE.Vector3(1, 0, 0),
              e.aim.rotation.x,
            );
            mesh.position.y += 1.28;
          }
          e.group.localToWorld(mesh.position);
          mesh.rotation.set(
            r.region === "arms" ? e.aim.rotation.x : 0,
            e.group.rotation.y,
            0,
            "YXZ",
          );
          mesh.scale.set(r.w, r.h * e.group.scale.y, r.d);
          i++;
        }
    }
  }
  dispose() {
    this.root.removeFromParent();
    this.hitRoot.removeFromParent();
    this.player.geometry.dispose();
    this.boxGeometry.dispose();
    this.material.dispose();
    this.hitMaterials.forEach((m) => m.dispose());
    for (const a of [this.velocity, this.ground, ...this.normals]) {
      a.line.geometry.dispose();
      a.line.material.dispose();
      a.cone.geometry.dispose();
      a.cone.material.dispose();
    }
  }
}
