export const HIT_REGIONS = Object.freeze([
  {
    region: "head",
    x: 0,
    y: 1.62,
    z: 0,
    w: 0.34,
    h: 0.36,
    d: 0.34,
    multiplier: 3.5,
  },
  {
    region: "body",
    x: 0,
    y: 1.12,
    z: 0,
    w: 0.62,
    h: 0.65,
    d: 0.34,
    multiplier: 1,
  },
  {
    region: "arms",
    x: -0.35,
    y: 1.15,
    z: -0.14,
    w: 0.21,
    h: 0.24,
    d: 0.46,
    multiplier: 0.85,
  },
  {
    region: "arms",
    x: 0.35,
    y: 1.15,
    z: -0.14,
    w: 0.21,
    h: 0.24,
    d: 0.46,
    multiplier: 0.85,
  },
  {
    region: "legs",
    x: -0.17,
    y: 0.4,
    z: 0,
    w: 0.23,
    h: 0.8,
    d: 0.25,
    multiplier: 0.65,
  },
  {
    region: "legs",
    x: 0.17,
    y: 0.4,
    z: 0,
    w: 0.23,
    h: 0.8,
    d: 0.25,
    multiplier: 0.65,
  },
]);
export function rayBox(o, d, b, max = 180) {
  let near = 0,
    far = max;
  for (const [axis, min, maxKey] of [
    ["x", "minX", "maxX"],
    ["y", "bottom", "top"],
    ["z", "minZ", "maxZ"],
  ]) {
    if (Math.abs(d[axis]) < 1e-9) {
      if (o[axis] < b[min] || o[axis] > b[maxKey]) return Infinity;
      continue;
    }
    const a = (b[min] - o[axis]) / d[axis],
      c = (b[maxKey] - o[axis]) / d[axis];
    near = Math.max(near, Math.min(a, c));
    far = Math.min(far, Math.max(a, c));
    if (near > far) return Infinity;
  }
  return near;
}
export function worldDistance(world, o, d, max = 180) {
  let distance = max;
  for (const box of world.colliders)
    distance = Math.min(distance, rayBox(o, d, box, max));
  // Analytic ramp plane with bounds; the solid back is also blocked by its platform.
  for (const r of world.ramps || (world.ramp ? [world.ramp] : [])) {
    const slope = (r.height / (r.maxZ - r.minZ)) * (r.reverse ? -1 : 1),
      denom = d.y + slope * d.z;
    if (Math.abs(denom) > 1e-9) {
      const t = (slope * ((r.reverse ? r.minZ : r.maxZ) - o.z) - o.y) / denom,
        x = o.x + d.x * t,
        z = o.z + d.z * t;
      if (t >= 0 && x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ)
        distance = Math.min(distance, t);
    }
  }
  return distance;
}
export function hitPlayer(origin, direction, snapshot, max) {
  const yaw = snapshot[7],
    c = Math.cos(yaw),
    s = Math.sin(yaw),
    dx = origin.x - snapshot[1],
    dz = origin.z - snapshot[3],
    scale = snapshot[10] ? 0.68 : 1;
  const o = {
    x: dx * c - dz * s,
    y: (origin.y - snapshot[2]) / scale,
    z: dx * s + dz * c,
  };
  const d = {
    x: direction.x * c - direction.z * s,
    y: direction.y / scale,
    z: direction.x * s + direction.z * c,
  };
  let hit = null;
  for (const r of HIT_REGIONS) {
    let ro = o,
      rd = d;
    if (r.region === "arms") {
      const angle =
          Math.max(-1.15, Math.min(1.15, snapshot[8])) -
          (snapshot[22] > 0 ? 0.45 : 0),
        cp = Math.cos(angle),
        sp = Math.sin(angle);
      ro = {
        x: o.x,
        y: (o.y - 1.28) * cp + o.z * sp + 1.28,
        z: -(o.y - 1.28) * sp + o.z * cp,
      };
      rd = { x: d.x, y: d.y * cp + d.z * sp, z: -d.y * sp + d.z * cp };
    }
    const t = rayBox(
      ro,
      rd,
      {
        minX: r.x - r.w / 2,
        maxX: r.x + r.w / 2,
        bottom: r.y - r.h / 2,
        top: r.y + r.h / 2,
        minZ: r.z - r.d / 2,
        maxZ: r.z + r.d / 2,
      },
      max,
    );
    if (t < max && (!hit || t < hit.distance)) hit = { ...r, distance: t };
  }
  return hit;
}
