import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { KestrelMap } from "./KestrelMap.js";
export class DistrictMap extends KestrelMap {
  box(x, y, z, w, h, d, color, solid = true) {
    super.box(x, y, z, w, h, d, color, solid);
    if (this.collisionOnly) return;
    const geometry = this.batches.get(color).pop();
    this.batches.delete(color);
    const key = `${color}|${Math.floor(x / 20)},${Math.floor(z / 20)}`;
    if (!this.batches.has(key)) this.batches.set(key, []);
    this.batches.get(key).push(geometry);
  }
  build() {
    this.name = "District";
    this.id = "district";
    this.bounds = { width: 104, depth: 112 };
    this.ramp = null;
    this.ramps = [
      { minX: 28, maxX: 33, minZ: -12, maxZ: 4, height: 3 },
      { minX: 28, maxX: 33, minZ: -34, maxZ: -18, height: 3, reverse: true },
    ];
    // A loop of neighborhoods surrounds an open plaza; cross streets provide multiple approaches.
    this.box(0, -0.3, 0, 104, 0.3, 112, "#bbb49a", false);
    this.box(0, 0.003, 0, 16, 0.012, 108, "#777e77", false);
    this.box(0, 0.004, 0, 100, 0.012, 14, "#777e77", false);
    for (const x of [-51, 51]) this.box(x, 0, 0, 2, 7, 112, "#b9ac91");
    for (const z of [-55, 55]) this.box(0, 0, z, 104, 7, 2, "#b9ac91");
    // Perimeter façades create a city skyline without inaccessible interior geometry.
    for (let x = -44; x <= 44; x += 11)
      for (const z of [-51, 51]) {
        this.box(x, 0, z, 8, 7 + (Math.abs(x) % 3), 5, "#d9c9a8");
        this.box(x, 7, z, 8.4, 0.25, 5.4, "#a97558", false);
        for (const dx of [-2, 2])
          this.box(
            x + dx,
            3,
            z + (z < 0 ? 2.51 : -2.51),
            1.2,
            1.6,
            0.03,
            "#526e71",
            false,
          );
      }
    // Market: staggered open stalls and canvas canopies, traversable from four sides.
    for (const [x, z] of [
      [-34, 15],
      [-22, 19],
      [-34, 29],
      [-19, 34],
    ]) {
      this.box(x, 0, z, 4, 1.1, 2, "#92795a");
      this.box(x, 2.5, z, 5, 0.18, 3, "#b77754", false);
      for (const dx of [-2, 2])
        this.box(x + dx, 0, z, 0.12, 2.5, 0.12, "#5b6961", false);
    }
    // Warehouse: wide entrances at both ends plus a side door and offset cover.
    this.box(-31, 0, -31, 22, 5, 0.6, "#899b94");
    this.box(-42, 0, -21, 0.6, 5, 20, "#899b94");
    for (const x of [-38, -24]) this.box(x, 0, -11, 8, 5, 0.6, "#899b94");
    for (const z of [-28, -14]) this.box(-20, 0, z, 0.6, 5, 6, "#899b94");
    this.box(-31, 4.9, -21, 22, 0.2, 20, "#899b94");
    this.crate(-35, -23, 2.5);
    this.crate(-25, -17, 2);
    this.crate(-35, -13, 1.5);
    // Old street and courtyard: offset buildings and low garden walls divide sightlines.
    for (const [x, z, w, d] of [
      [-14, -42, 10, 7],
      [8, -35, 8, 12],
      [-12, 35, 7, 9],
      [-42, 1, 7, 9],
      [41, 22, 9, 13],
    ]) {
      this.box(x, 0, z, w, 5.5, d, "#d4ba91");
      this.box(x, 5.5, z, w + 0.4, 0.25, d + 0.4, "#ad7858", false);
    }
    this.box(19, 0, 32, 10, 1.05, 1, "#cdc2a1");
    this.box(24, 0, 38, 1, 1.05, 10, "#cdc2a1");
    this.box(17, 0, 40, 5, 0.8, 3, "#718a67");
    // Central plaza: fountain, benches and short walls; no dominant end-to-end lane.
    this.box(0, 0, 0, 5, 0.75, 5, "#cfc7af");
    this.box(0, 0.75, 0, 3, 0.08, 3, "#72a5a4", false);
    for (const [x, z] of [
      [-9, 9],
      [10, -10],
      [-10, -9],
      [10, 10],
    ])
      this.box(x, 0, z, 3, 1.1, 1.3, "#a8ab91");
    // Garage / underpass: roof is reachable from two ramps, passage has three exits.
    this.box(30, 2.75, -15, 18, 0.25, 6, "#a7aca2");
    for (const x of [22, 38]) this.box(x, 0, -15, 1, 2.75, 6, "#c4b596");
    this.box(36, 0, -24, 3, 1.1, 5, "#5b8588");
    this.box(22, 0, -24, 3, 1.1, 5, "#a46d51");
    this.container(38, 8, "#879f8f", true);
    // Construction: columns, pallets and incomplete walls, all with flanking routes.
    for (const [x, z] of [
      [18, -43],
      [30, -43],
      [42, -43],
    ])
      this.box(x, 0, z, 0.65, 6, 0.65, "#b9b2a1");
    this.box(30, 5.7, -43, 25, 0.5, 0.7, "#c79455");
    this.crate(20, -37, 2);
    this.crate(40, -37, 2.5);
    for (const [x, z] of [
      [-8, 20],
      [9, -22],
      [-29, 42],
      [42, 40],
    ])
      this.box(x, 0, z, 3, 1.3, 2, "#a49d82");
    const labels = [
      ["PLAZA", 0, -7],
      ["MARKET", -30, 10],
      ["WAREHOUSE", -31, -10],
      ["OLD STREET", -29, -39],
      ["CONSTRUCTION", 30, -47],
      ["UNDERPASS", 30, -11],
      ["COURTYARD", 25, 30],
      ["GARAGE", 38, -29],
    ];
    for (const [name, x, z] of labels)
      this.sign(name, x, 2.4, z, 4, 1, "#f2e5c6", "#385358");
    // 24 spawn candidates are scored by the mode using occupancy, visibility and recent combat.
    this.spawns = [
      [-45, -42],
      [-32, -38],
      [-6, -45],
      [17, -49],
      [45, -30],
      [45, -5],
      [46, 35],
      [32, 46],
      [8, 45],
      [-7, 47],
      [-30, 46],
      [-46, 35],
      [-45, 12],
      [-46, -8],
      [-29, -27],
      [-24, -22],
      [-13, -16],
      [-16, 9],
      [-27, 25],
      [15, 24],
      [35, 29],
      [17, 13],
      [17, -18],
      [6, -14],
    ].map(([x, z]) => ({ x, y: 0, z }));
    if (this.collisionOnly) return;
    for (const r of this.ramps) {
      const low = r.reverse ? r.height : 0,
        high = r.reverse ? 0 : r.height,
        g = new THREE.BufferGeometry();
      g.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          [
            r.minX,
            low,
            r.maxZ,
            r.maxX,
            low,
            r.maxZ,
            r.maxX,
            high,
            r.minZ,
            r.minX,
            low,
            r.maxZ,
            r.maxX,
            high,
            r.minZ,
            r.minX,
            high,
            r.minZ,
          ],
          3,
        ),
      );
      g.computeVertexNormals();
      const mesh = new THREE.Mesh(g, this.material("#b6b5a4"));
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.surfaces.push(mesh);
    }
    for (const [key, geometries] of this.batches) {
      const mesh = new THREE.Mesh(
        mergeGeometries(geometries),
        this.material(key.split("|")[0]),
      );
      mesh.castShadow = mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.surfaces.push(mesh);
      geometries.forEach((g) => g.dispose());
    }
    this.batches.clear();
  }
}
