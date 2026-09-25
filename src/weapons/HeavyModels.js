import * as THREE from "three";

// Original primitive silhouettes. Models are built once, then reused when switching.
export function createHeavyModel(kind, materials) {
  const { metal, dark, tan, accent } = materials;
  const group = new THREE.Group();
  const part = (x, y, z, w, h, d, material, parent = group) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const moving = new THREE.Group();
  group.add(moving);
  const tube = (radius, length, x, y, z, material) => {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, length, 10),
      material,
    );
    m.rotation.x = Math.PI / 2;
    m.position.set(x, y, z);
    group.add(m);
    return m;
  };
  if (kind === "r45") {
    part(0, -0.04, 0, 0.1, 0.11, 0.29, dark);
    part(0, 0.035, -0.03, 0.12, 0.12, 0.35, metal, moving);
    part(0, -0.19, 0.095, 0.085, 0.25, 0.12, tan).rotation.x = -0.22;
    part(0, -0.26, 0.13, 0.1, 0.035, 0.13, dark);
    part(0, 0.02, -0.225, 0.066, 0.058, 0.09, dark);
    part(0, 0.103, 0.1, 0.066, 0.024, 0.02, accent, moving);
    part(0, 0.103, -0.17, 0.014, 0.026, 0.02, accent, moving);
    part(0.061, 0.034, 0.035, 0.005, 0.04, 0.07, accent, moving);
    for (let i = 0; i < 4; i++)
      part(0, 0.038, 0.05 + i * 0.022, 0.125, 0.056, 0.007, dark, moving);
    part(0, -0.13, 0.04, 0.045, 0.055, 0.035, dark);
    tube(0.035, 0.14, 0, 0.02, -0.23, metal);
    part(0, -0.155, -0.03, 0.045, 0.025, 0.12, dark);
    part(0, -0.12, -0.09, 0.045, 0.07, 0.025, dark);
    part(0, 0.11, 0.13, 0.04, 0.035, 0.045, dark).rotation.x = -0.3;
    part(0.015, -0.19, 0.1, 0.13, 0.13, 0.16, dark);
    part(-0.06, -0.16, 0.03, 0.11, 0.11, 0.17, dark);
    part(0.05, -0.36, 0.24, 0.14, 0.34, 0.14, tan).rotation.x = -0.5;
  } else {
    part(0, -0.015, 0, 0.15, 0.15, 0.52, metal);
    part(0, -0.085, 0.35, 0.11, 0.16, 0.29, tan);
    part(0, 0.035, 0.36, 0.12, 0.055, 0.22, dark);
    part(0, -0.075, -0.35, 0.135, 0.13, 0.28, tan);
    part(0, 0, -0.67, 0.047, 0.047, 0.5, metal);
    part(0, 0, -0.94, 0.083, 0.08, 0.11, dark);
    part(0, -0.18, -0.015, 0.085, 0.19, 0.13, dark);
    part(0, -0.175, 0.14, 0.085, 0.2, 0.09, tan).rotation.x = -0.2;
    for (const z of [-0.13, 0.12]) part(0, 0.12, z, 0.065, 0.12, 0.055, dark);
    const scope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.067, 0.067, 0.46, 10),
      metal,
    );
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.19, -0.02);
    group.add(scope);
    tube(0.09, 0.12, 0, 0.19, -0.28, dark);
    tube(0.082, 0.06, 0, 0.19, 0.22, dark);
    tube(0.032, 0.54, 0, 0, -0.65, metal);
    for (const side of [-1, 1])
      part(side * 0.085, -0.15, -0.42, 0.024, 0.3, 0.025, dark).rotation.z =
        side * 0.3;
    const lens = new THREE.Mesh(
      new THREE.CircleGeometry(0.052, 10),
      new THREE.MeshBasicMaterial({ color: "#82aea8" }),
    );
    lens.position.set(0, 0.19, 0.212);
    group.add(lens);
    part(0.11, 0.03, 0.06, 0.14, 0.028, 0.032, metal, moving);
    part(0.17, 0, 0.06, 0.043, 0.09, 0.048, dark, moving);
    part(0.077, 0.015, -0.05, 0.008, 0.05, 0.13, accent);
    part(-0.02, -0.16, -0.31, 0.15, 0.11, 0.15, dark);
    part(0, -0.34, -0.13, 0.14, 0.35, 0.15, tan).rotation.x = -0.5;
    part(0.02, -0.21, 0.15, 0.13, 0.13, 0.15, dark);
    part(0.04, -0.36, 0.28, 0.15, 0.31, 0.16, tan).rotation.x = -0.35;
  }
  group.traverse((o) => {
    if (o.isMesh && o.position.y < -0.3) o.userData.noSkin = true;
  });
  const flash = new THREE.Mesh(
    new THREE.ConeGeometry(kind === "titan" ? 0.09 : 0.06, 0.24, 5),
    new THREE.MeshBasicMaterial({ color: "#ffe1a0" }),
  );
  flash.rotation.x = -Math.PI / 2;
  flash.position.set(0, 0, kind === "titan" ? -1.1 : -0.35);
  flash.visible = false;
  group.add(flash);
  return { group, moving, flash, offsetZ: kind === "titan" ? -0.92 : -0.56 };
}
