import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { contacts, buildCollisionGrid } from "../player/Collision.js";

export class KestrelMap {
  constructor(scene, { collisionOnly = false } = {}) {
    this.root = collisionOnly ? null : new THREE.Group();
    scene?.add(this.root);
    this.scene = this.root;
    this.name = "Kestrel";
    this.id = "kestrel";
    this.bounds = { width: 56, depth: 64 };
    this.collisionOnly = collisionOnly;
    this.colliders = [];
    this.surfaces = [];
    this.batches = new Map();
    this.materials = new Map();
    this.ramp = { minX: -12, maxX: -8, minZ: 13, maxZ: 19, height: 1.2 };
    this.build();
    buildCollisionGrid(this);
  }
  material(color) {
    if (!this.materials.has(color))
      this.materials.set(
        color,
        new THREE.MeshStandardMaterial({ color, roughness: 0.92 }),
      );
    return this.materials.get(color);
  }
  box(x, y, z, w, h, d, color, solid = true) {
    if (!this.collisionOnly) {
      const geometry = new THREE.BoxGeometry(w, h, d);
      geometry.translate(x, y + h / 2, z);
      if (!this.batches.has(color)) this.batches.set(color, []);
      this.batches.get(color).push(geometry);
    }
    if (solid)
      this.colliders.push({
        minX: x - w / 2,
        maxX: x + w / 2,
        minZ: z - d / 2,
        maxZ: z + d / 2,
        bottom: y,
        top: y + h,
      });
  }
  sign(
    text,
    x,
    y,
    z,
    width,
    height,
    color = "#e9e2ce",
    background = "#29474c",
    rotation = 0,
  ) {
    if (this.collisionOnly) return;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.strokeRect(12, 12, 488, 232);
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lines = text.split("\n");
    lines.forEach((line, i) => {
      ctx.font = `bold ${i === 0 ? 76 : 28}px sans-serif`;
      ctx.fillText(line, 256, lines.length === 1 ? 128 : 100 + i * 76);
    });
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshStandardMaterial({ map: texture, roughness: 1 }),
    );
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotation;
    this.scene.add(mesh);
  }
  crate(x, z, size = 2, y = 0) {
    this.box(x, y, z, size, size, size, "#a58556");
    for (const side of [-1, 1]) {
      this.box(
        x + side * size * 0.38,
        y,
        z,
        0.13,
        size + 0.03,
        size + 0.04,
        "#c4a475",
        false,
      );
      this.box(
        x,
        y + size * 0.17,
        z,
        size + 0.04,
        0.12,
        size + 0.04,
        "#74644d",
        false,
      );
      this.box(
        x,
        y + size * 0.78,
        z,
        size + 0.04,
        0.12,
        size + 0.04,
        "#74644d",
        false,
      );
    }
  }
  container(x, z, color, rotated = false) {
    const w = rotated ? 3 : 7.5,
      d = rotated ? 7.5 : 3;
    this.box(x, 0, z, w, 2.7, d, color);
    this.box(x, 2.7, z, w + 0.12, 0.12, d + 0.12, "#d7d8c7", false);
    for (let i = -3; i <= 3; i++) {
      if (rotated)
        this.box(x, 0.1, z + i, w + 0.06, 2.55, 0.055, "#43666b", false);
      else this.box(x + i, 0.1, z, 0.055, 2.55, d + 0.06, "#43666b", false);
    }
  }
  build() {
    const sand = "#d8cbb0",
      chalk = "#e7dfc9",
      trim = "#b5a686";
    this.box(0, -0.3, 0, 56, 0.3, 64, "#b7b49e");
    this.box(-27, 0, 0, 2, 6, 64, sand);
    this.box(27, 0, 0, 2, 6, 64, sand);
    this.box(0, 0, -31, 56, 6, 2, sand);
    this.box(0, 0, 31, 56, 5, 2, sand);
    // Three distinct routes, with crossovers between the loading bays.
    this.box(-12, 0, -1, 2, 4.4, 16, chalk);
    this.box(12, 0, -4, 2, 4.4, 14, chalk);
    this.box(-12, 0, -22, 2, 4.4, 7, chalk);
    this.box(12, 0, -23, 2, 4.4, 6, chalk);
    this.box(-19, 0, -5, 12, 3.8, 1.2, sand);
    this.box(19, 0, 6, 12, 3.8, 1.2, sand);
    this.box(-19, 0, -14, 6, 0.7, 5, chalk);
    this.box(-10, 0, 11, 4, 1.2, 4, "#c9c1ab");
    this.box(3.8, 0, 8, 3.8, 1.25, 1.4, chalk);
    this.box(-3, 0, -5, 4, 1.1, 2, chalk);
    this.container(18, -12, "#557779", true);
    this.container(-20, 8, "#607d78");
    this.container(6.5, -22, "#526b6a");
    this.crate(-6, 8, 1.8);
    this.crate(-7.8, 8.8, 1.3);
    this.crate(8, -7, 2.1);
    this.crate(8, -7, 1.2, 2.1);
    this.crate(21, 20, 2.2);
    this.crate(-19, -23, 1.8);
    this.crate(1, -19, 1.6);
    // Background architecture gives the compact arena a coastal industrial skyline.
    for (const [x, z, w, h, d] of [
      [-34, -17, 13, 11, 22],
      [34, -18, 12, 9, 20],
      [-33, 17, 10, 8, 18],
      [8, -37, 26, 9, 10],
      [-15, -39, 14, 12, 14],
    ]) {
      this.box(x, 0, z, w, h, d, chalk, false);
      this.box(x, h, z, w + 0.5, 0.3, d + 0.5, trim, false);
      for (let ix = -1; ix <= 1; ix++)
        this.box(
          x + ix * 3.4,
          h - 3.3,
          z + d / 2 + 0.04,
          1.5,
          1.9,
          0.12,
          "#3d6268",
          false,
        );
    }
    // Doorway across the north courtyard.
    this.box(-5, 0, -26, 2.2, 5.4, 2, sand);
    this.box(5, 0, -26, 2.2, 5.4, 2, sand);
    this.box(0, 4.2, -26, 12, 1.2, 2, sand);
    this.box(0, 5.4, -26, 12.3, 0.2, 2.3, trim, false);
    this.sign("KESTREL\nCOASTAL LOGISTICS", 0, 4.8, -24.98, 5.5, 1.05);
    this.sign(
      "A\nWEST TRANSFER",
      -12,
      2.7,
      7.02,
      1.45,
      1.55,
      "#f4dcc0",
      "#bd6946",
    );
    this.sign("B\nEAST LOADING", 19.3, 2.5, 6.62, 2.6, 1.5);
    this.sign(
      "03\nTRAINING SECTOR",
      -19.5,
      4,
      29.97,
      4,
      2,
      "#264246",
      "#e3d9bd",
      Math.PI,
    );
    // Ground markings are geometry, not downloaded textures.
    for (const x of [-1.6, 1.6])
      this.box(x, 0.006, 20, 0.08, 0.012, 10, "#e7d6a9", false);
    for (let z = -22; z < 26; z += 3)
      this.box(0, 0.008, z, 0.12, 0.012, 1.1, "#d3c79f", false);
    for (const [x, z, color] of [
      [-19, -15, "#d38a56"],
      [19, -23, "#779b92"],
    ]) {
      for (const side of [-1, 1]) {
        this.box(x + side * 3.3, 0.013, z, 0.12, 0.02, 6.6, color, false);
        this.box(x, 0.013, z + side * 3.3, 6.6, 0.02, 0.12, color, false);
      }
    }
    for (let z = -27; z <= 26; z += 5) {
      this.box(-25.88, 0, z, 0.16, 1.1, 0.28, "#776e58", false);
      this.box(25.88, 0, z, 0.16, 1.1, 0.28, "#776e58", false);
    }
    if (this.collisionOnly) return;
    const vertices = new Float32Array([
      -12, 0, 19, -8, 0, 19, -8, 1.2, 13, -12, 0, 19, -8, 1.2, 13, -12, 1.2, 13,
    ]);
    const rampGeometry = new THREE.BufferGeometry();
    rampGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(vertices, 3),
    );
    rampGeometry.computeVertexNormals();
    const rampMesh = new THREE.Mesh(rampGeometry, this.material("#c9c1ab"));
    rampMesh.receiveShadow = true;
    this.scene.add(rampMesh);
    this.surfaces.push(rampMesh);
    for (const [color, geometries] of this.batches) {
      const merged = mergeGeometries(geometries);
      const mesh = new THREE.Mesh(merged, this.material(color));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.surfaces.push(mesh);
      geometries.forEach((g) => g.dispose());
    }
    this.batches.clear();
  }
  rampHeight(x, z) {
    let result = 0;
    for (const r of this.ramps || (this.ramp ? [this.ramp] : []))
      if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ)
        result = Math.max(
          result,
          ((r.reverse ? z - r.minZ : r.maxZ - z) / (r.maxZ - r.minZ)) *
            r.height,
        );
    return result;
  }
  collides(p, radius, height) {
    return contacts(this, p, radius, height).length > 0;
  }
  floorHeight(x, z, oldY) {
    let height = this.rampHeight(x, z);
    for (const b of this.queryColliders?.({ x, z }) || this.colliders) {
      if (
        x > b.minX &&
        x < b.maxX &&
        z > b.minZ &&
        z < b.maxZ &&
        b.top <= oldY + 0.33
      )
        height = Math.max(height, b.top);
    }
    return height;
  }
  dispose() {
    const geometries = new Set(),
      materials = new Set(this.materials.values()),
      textures = new Set();
    this.root?.traverse((o) => {
      if (o.geometry) geometries.add(o.geometry);
      if (o.material)
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          materials.add(m);
    });
    for (const m of materials) {
      if (m.map) textures.add(m.map);
      m.dispose();
    }
    for (const g of geometries) g.dispose();
    for (const t of textures) t.dispose();
    this.root?.removeFromParent();
    this.surfaces = [];
    this.colliders = [];
    this.materials.clear();
  }
}
