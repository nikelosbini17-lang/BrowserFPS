import * as THREE from "three";
// Small shared-geometry world models; never reuse camera viewmodels on remote players.
export function createWorldWeapons(geometry, metal, dark) {
  return ["ar4", "r45", "titan"].map((id) => {
    const group = new THREE.Group();
    const part = (x, y, z, w, h, d, mat = metal) => {
      const m = new THREE.Mesh(geometry, mat);
      m.position.set(x, y, z);
      m.scale.set(w, h, d);
      group.add(m);
      return m;
    };
    if (id === "r45") {
      part(0, 0, -0.12, 0.1, 0.12, 0.3);
      part(0, -0.13, 0, 0.08, 0.2, 0.11, dark).rotation.x = -0.2;
    } else {
      const sniper = id === "titan";
      part(0, 0, -0.22, 0.12, 0.14, sniper ? 0.57 : 0.46);
      part(0, -0.02, 0.12, 0.1, 0.14, 0.25, dark);
      part(
        0,
        0.015,
        sniper ? -0.72 : -0.56,
        0.045,
        0.045,
        sniper ? 0.65 : 0.35,
        dark,
      );
      part(0, -0.16, -0.16, 0.075, 0.24, 0.12, dark).rotation.x = -0.22;
      part(0, -0.13, 0.03, 0.07, 0.18, 0.08, dark);
      if (sniper) {
        part(0, 0.15, -0.25, 0.1, 0.1, 0.38);
        part(0, 0.1, -0.1, 0.07, 0.13, 0.06, dark);
      } else part(0, 0.095, -0.64, 0.025, 0.09, 0.03, dark);
    }
    group.userData.weapon = id;
    return group;
  });
}
