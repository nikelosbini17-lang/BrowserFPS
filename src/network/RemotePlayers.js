import * as THREE from "three";
import { NETWORK } from "./Protocol.js";
import { createWorldWeapons } from "../weapons/WorldModels.js";
import { SKINS, applySkin, disposeSkins } from "../weapons/Skins.js";

export class RemotePlayers {
  constructor(scene) {
    this.scene = scene;
    this.entities = new Map();
    this.geometry = new THREE.BoxGeometry(1, 1, 1);
    this.protectionGeometry = new THREE.TorusGeometry(0.65, 0.025, 4, 20);
    this.protectionMaterial = new THREE.MeshBasicMaterial({ color: 0xffd986 });
    this.teamMaterials = [
      new THREE.MeshStandardMaterial({ color: "#bf794d", roughness: 0.85 }),
      new THREE.MeshStandardMaterial({ color: "#497f87", roughness: 0.85 }),
    ];
    this.dark = new THREE.MeshStandardMaterial({
      color: "#293b3f",
      roughness: 0.9,
    });
  }
  syncRoster(roster, ownId) {
    const ids = new Set(roster.filter((p) => p.id !== ownId).map((p) => p.id));
    for (const [id, entity] of this.entities)
      if (!ids.has(id)) {
        this.scene.remove(entity.group);
        entity.weapons.forEach(disposeSkins);
        this.entities.delete(id);
      }
    for (const player of roster) {
      if (player.id === ownId || this.entities.has(player.id)) continue;
      const group = new THREE.Group(),
        material = this.teamMaterials[player.team];
      const part = (x, y, z, w, h, d, mat) => {
        const mesh = new THREE.Mesh(this.geometry, mat);
        mesh.position.set(x, y, z);
        mesh.scale.set(w, h, d);
        mesh.castShadow = true;
        group.add(mesh);
        return mesh;
      };
      part(0, 1.62, 0, 0.34, 0.36, 0.34, material);
      part(0, 1.12, 0, 0.62, 0.65, 0.34, material);
      const arms = [
        part(-0.36, 1.15, -0.14, 0.19, 0.24, 0.46, this.dark),
        part(0.35, 1.15, -0.14, 0.19, 0.24, 0.46, this.dark),
      ];
      const legs = [
        part(-0.17, 0.4, 0, 0.23, 0.8, 0.25, this.dark),
        part(0.17, 0.4, 0, 0.23, 0.8, 0.25, this.dark),
      ];
      const aim = new THREE.Group();
      aim.position.set(0, 1.28, 0);
      group.add(aim);
      const protection = new THREE.Mesh(
        this.protectionGeometry,
        this.protectionMaterial,
      );
      protection.rotation.x = Math.PI / 2;
      protection.position.y = 0.07;
      group.add(protection);
      for (const arm of arms) {
        group.remove(arm);
        arm.position.y -= 1.28;
        aim.add(arm);
      }
      const weapons = createWorldWeapons(this.geometry, material, this.dark);
      for (const gun of weapons) {
        gun.position.set(0.18, -0.1, -0.3);
        aim.add(gun);
      }
      const flash = part(0.18, 1.18, -1, 0.09, 0.09, 0.18, this.dark);
      group.remove(flash);
      flash.position.set(0.18, -0.1, -1);
      aim.add(flash);
      this.scene.add(group);
      group.visible = false;
      this.entities.set(player.id, {
        group,
        legs,
        aim,
        weapons,
        flash,
        protection,
        name: player.name,
        team: player.team,
      });
    }
  }
  update(snapshots, now) {
    if (!snapshots.length) return;
    const renderTime = now - NETWORK.interpolationMs;
    let a = snapshots[0],
      b = snapshots[0];
    for (const frame of snapshots) {
      if (frame.at <= renderTime) a = frame;
      b = frame;
      if (frame.at >= renderTime) break;
    }
    const t =
      a === b
        ? 0
        : THREE.MathUtils.clamp((renderTime - a.at) / (b.at - a.at), 0, 1);
    for (const [id, entity] of this.entities) {
      const from = a.players.find((p) => p[0] === id),
        to = b.players.find((p) => p[0] === id) || from;
      if (!from || !to) continue;
      entity.group.visible = to[15] !== 0;
      entity.protection.visible = to[19] > (b.serverAt || 0);
      entity.group.position.set(
        THREE.MathUtils.lerp(from[1], to[1], t),
        THREE.MathUtils.lerp(from[2], to[2], t),
        THREE.MathUtils.lerp(from[3], to[3], t),
      );
      const angle = Math.atan2(
        Math.sin(to[7] - from[7]),
        Math.cos(to[7] - from[7]),
      );
      entity.group.rotation.y = from[7] + angle * t;
      entity.group.scale.y = to[10] ? 0.68 : 1;
      entity.aim.rotation.x =
        THREE.MathUtils.clamp(
          THREE.MathUtils.lerp(from[8], to[8], t),
          -1.15,
          1.15,
        ) - (to[22] > 0 ? 0.45 : 0);
      entity.weapons.forEach((w, i) => {
        w.visible = i === to[12];
        w.position.z = -0.3 + (to[24] < 0.1 ? 0.04 : 0);
      });
      applySkin(entity.weapons[to[12]], SKINS[to[30]]?.id || "default");
      entity.flash.visible = to[24] < 0.055;
      entity.flash.position.z = to[12] === 1 ? -0.72 : to[12] === 2 ? -1.3 : -1;
      entity.state =
        to[15] === 0
          ? "DEAD"
          : to[22] > 0
            ? "RELOAD"
            : to[24] < 0.1
              ? "FIRE"
              : !to[9]
                ? "AIRBORNE"
                : to[10]
                  ? "CROUCH"
                  : Math.hypot(to[4], to[6]) > 0.5
                    ? "RUN"
                    : "IDLE";
      const stride = !to[9]
        ? 0.2
        : Math.hypot(to[4], to[6]) > 0.5
          ? Math.sin(now * 0.012) * 0.3
          : 0;
      entity.legs[0].rotation.x = stride;
      entity.legs[1].rotation.x = -stride;
    }
  }
  clear() {
    for (const entity of this.entities.values()) {
      this.scene.remove(entity.group);
      entity.weapons.forEach(disposeSkins);
    }
    this.entities.clear();
  }
}
