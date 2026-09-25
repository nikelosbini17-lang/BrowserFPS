import * as THREE from "three";
import { createHeavyModel } from "./HeavyModels.js";
export class ViewModel {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(65, 1, 0.01, 10);
    this.scene.add(new THREE.HemisphereLight("#fff3d8", "#57646b", 2.4));
    const light = new THREE.DirectionalLight("#ffffff", 2);
    light.position.set(-3, 5, 2);
    this.scene.add(light);
    this.gun = new THREE.Group();
    this.scene.add(this.gun);
    const metal = new THREE.MeshStandardMaterial({
      color: "#354447",
      roughness: 0.56,
      metalness: 0.4,
    });
    const dark = new THREE.MeshStandardMaterial({
      color: "#172428",
      roughness: 0.8,
    });
    const tan = new THREE.MeshStandardMaterial({
      color: "#aaa38a",
      roughness: 0.85,
    });
    const accent = new THREE.MeshStandardMaterial({
      color: "#d29456",
      roughness: 0.6,
    });
    const piece = (x, y, z, w, h, d, material) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      m.position.set(x, y, z);
      this.gun.add(m);
      return m;
    };
    piece(0, 0, 0, 0.12, 0.14, 0.42, metal);
    piece(0, -0.025, 0.29, 0.1, 0.12, 0.24, tan);
    piece(0, -0.075, -0.31, 0.115, 0.12, 0.26, tan);
    piece(0, 0.007, -0.47, 0.045, 0.045, 0.22, dark);
    piece(0, 0.016, -0.6, 0.065, 0.065, 0.07, metal);
    piece(0, 0.086, -0.04, 0.04, 0.025, 0.36, dark);
    piece(0, 0.113, 0.085, 0.055, 0.052, 0.035, metal);
    piece(0, 0.111, -0.28, 0.022, 0.057, 0.035, dark);
    // Tapered curved magazine with an original swept profile.
    const profile = new THREE.Shape();
    profile.moveTo(-0.045, 0);
    profile.lineTo(0.05, 0);
    profile.quadraticCurveTo(0.035, -0.18, -0.06, -0.28);
    profile.lineTo(-0.13, -0.25);
    profile.quadraticCurveTo(-0.05, -0.12, -0.045, 0);
    const magazine = new THREE.Mesh(
      new THREE.ExtrudeGeometry(profile, {
        depth: 0.067,
        bevelEnabled: true,
        bevelSegments: 1,
        steps: 1,
        bevelSize: 0.008,
        bevelThickness: 0.006,
      }),
      dark,
    );
    magazine.rotation.y = Math.PI / 2;
    magazine.position.set(-0.033, -0.07, -0.04);
    this.gun.add(magazine);
    for (let i = 0; i < 3; i++)
      piece(0.064, 0.055, -0.12 + i * 0.085, 0.012, 0.025, 0.055, metal);
    piece(0, -0.155, 0.14, 0.07, 0.19, 0.065, tan).rotation.x = -0.2;
    piece(0.062, 0.02, 0.04, 0.006, 0.035, 0.08, accent);
    for (let i = 0; i < 5; i++)
      piece(0, -0.008, -0.23 - i * 0.035, 0.122, 0.024, 0.014, dark);
    // Gloved hands and sleeves, all original primitive geometry.
    piece(-0.02, -0.14, -0.28, 0.15, 0.115, 0.14, dark).userData.noSkin = true;
    piece(0.02, -0.31, -0.15, 0.13, 0.32, 0.13, tan).rotation.x = -0.48;
    piece(0.02, -0.18, 0.16, 0.115, 0.12, 0.14, dark).userData.noSkin = true;
    piece(0.04, -0.35, 0.25, 0.14, 0.3, 0.15, tan).rotation.x = -0.3;
    this.gun.traverse((o) => {
      if (o.isMesh && o.position.y < -0.3) o.userData.noSkin = true;
    });
    this.flash = new THREE.Mesh(
      new THREE.ConeGeometry(0.06, 0.19, 5),
      new THREE.MeshBasicMaterial({ color: "#ffe9a0" }),
    );
    this.flash.rotation.x = -Math.PI / 2;
    this.flash.position.set(0, 0.015, -0.7);
    this.flash.visible = false;
    this.gun.add(this.flash);
    this.models = {
      ar4: { group: this.gun, flash: this.flash, offsetZ: -0.74 },
    };
    for (const kind of ["r45", "titan"]) {
      const model = createHeavyModel(kind, { metal, dark, tan, accent });
      this.models[kind] = model;
      model.group.visible = false;
      this.scene.add(model.group);
    }
  }
  update(time, rifle, player, settings) {
    const model = this.models[rifle.config.id];
    const transform = rifle.config.viewmodel;
    for (const [id, rig] of Object.entries(this.models))
      rig.group.visible = id === rifle.config.id;
    this.gun = model.group;
    this.flash = model.flash;
    const motion =
      settings.viewmodelMotion === "off"
        ? 0
        : settings.viewmodelMotion === "normal"
          ? 1
          : 0.45;
    const bob = settings.bob
      ? Math.sin(player.bobTime) *
        Math.min((player.speed || 0) / 5.5, 1) *
        0.012 *
        motion
      : 0;
    const reload =
      rifle.reloadRemaining > 0
        ? Math.sin(
            (1 - rifle.reloadRemaining / rifle.config.reloadTime) * Math.PI,
          )
        : 0;
    this.gun.position.set(
      transform.positionX + bob,
      transform.positionY -
        reload * 0.22 +
        bob * 0.5 -
        (player.landing || 0) * motion -
        rifle.drawRemaining * 0.35,
      transform.positionZ + rifle.kick,
    );
    this.gun.rotation.set(
      transform.rotationX + rifle.kick * 0.65 - reload * 0.45,
      transform.rotationY,
      transform.rotationZ -
        reload * 0.45 +
        (player.grounded ? 0 : -0.025) * motion,
    );
    this.gun.scale.setScalar(transform.scale);
    this.flash.visible = rifle.idle < 0.045;
    this.flash.rotation.z = time * 31;
    if (model.moving)
      model.moving.position.z =
        rifle.config.id === "r45"
          ? rifle.kick * 0.65
          : rifle.boltRemaining > 0
            ? Math.sin(
                (1 - rifle.boltRemaining / rifle.config.boltTime) * Math.PI,
              ) * 0.11
            : 0;
  }
}
