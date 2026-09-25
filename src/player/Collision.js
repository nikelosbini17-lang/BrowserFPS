// Upright rounded cylinder against simplified level boxes. Shared by client and server.
export function contact(p, radius, height, b) {
  if (p.y + height <= b.bottom + 0.02 || p.y + 0.32 >= b.top) return null;
  const x = Math.max(b.minX, Math.min(b.maxX, p.x));
  const z = Math.max(b.minZ, Math.min(b.maxZ, p.z));
  const dx = p.x - x,
    dz = p.z - z,
    distance = Math.hypot(dx, dz);
  if (distance >= radius - 1e-6) return null;
  if (distance > 1e-8)
    return { x: dx / distance, z: dz / distance, depth: radius - distance };
  const faces = [
    { x: -1, z: 0, depth: p.x - b.minX + radius },
    { x: 1, z: 0, depth: b.maxX - p.x + radius },
    { x: 0, z: -1, depth: p.z - b.minZ + radius },
    { x: 0, z: 1, depth: b.maxZ - p.z + radius },
  ];
  return faces.sort((a, b) => a.depth - b.depth)[0];
}
export function contacts(world, p, radius, height) {
  const list = [];
  for (const b of world.queryColliders?.(p, radius) || world.colliders) {
    const hit = contact(p, radius, height, b);
    if (hit) list.push(hit);
  }
  for (const r of world.ramps || (world.ramp ? [world.ramp] : []))
    if (world.rampHeight(p.x, p.z) > p.y + 0.32) {
      const c = contact(p, radius, height, { ...r, bottom: 0, top: r.height });
      if (c) list.push(c);
    }
  return list;
}
export function buildCollisionGrid(world) {
  const cells = new Map(),
    size = 8;
  for (const b of world.colliders)
    for (let x = Math.floor(b.minX / size); x <= Math.floor(b.maxX / size); x++)
      for (
        let z = Math.floor(b.minZ / size);
        z <= Math.floor(b.maxZ / size);
        z++
      ) {
        const key = `${x},${z}`;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(b);
      }
  world.queryColliders = (p, r = 0) => {
    const x0 = Math.floor((p.x - r) / size),
      x1 = Math.floor((p.x + r) / size),
      z0 = Math.floor((p.z - r) / size),
      z1 = Math.floor((p.z + r) / size);
    if (x0 === x1 && z0 === z1) return cells.get(`${x0},${z0}`) || [];
    const result = new Set();
    for (let x = x0; x <= x1; x++)
      for (let z = z0; z <= z1; z++)
        for (const b of cells.get(`${x},${z}`) || []) result.add(b);
    return result;
  };
}
export function moveAndSlide(state, world, dt, radius, height) {
  const p = state.position,
    v = state.velocity;
  state.contacts = [];
  const steps = Math.max(1, Math.ceil((Math.hypot(v.x, v.z) * dt) / 0.1));
  for (let i = 0; i < steps; i++) {
    p.x += (v.x * dt) / steps;
    p.z += (v.z * dt) / steps;
    for (let iteration = 0; iteration < 8; iteration++) {
      const hits = contacts(world, p, radius, height);
      if (!hits.length) break;
      // Re-evaluate after each push; stale normals at overlapping seams cause oscillation.
      const hit = hits.sort((a, b) => b.depth - a.depth)[0];
      p.x += hit.x * (hit.depth + 1e-5);
      p.z += hit.z * (hit.depth + 1e-5);
      const inward = v.x * hit.x + v.z * hit.z;
      if (inward < 0) {
        v.x -= inward * hit.x;
        v.z -= inward * hit.z;
      }
      if (state.contacts.length < 8) state.contacts.push(hit);
    }
  }
  const invalid = contacts(world, p, radius, height).length > 0;
  state.stuckTime = invalid ? (state.stuckTime || 0) + dt : 0;
  if (state.stuckTime > 0.4 && state.lastSafe) {
    Object.assign(p, state.lastSafe);
    v.x = v.y = v.z = 0;
    state.stuckTime = 0;
    state.unstuckCount = (state.unstuckCount || 0) + 1;
  }
  if (!invalid && state.grounded) state.lastSafe = { x: p.x, y: p.y, z: p.z };
}
