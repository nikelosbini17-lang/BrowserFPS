import * as THREE from "three";
export const SKINS = Object.freeze([
  {
    id: "default",
    name: "Default",
    base: "#354447",
    accent: "#d29456",
    pattern: "none",
  },
  {
    id: "midnight",
    name: "Midnight",
    base: "#17213e",
    accent: "#6b80b7",
    pattern: "stripe",
  },
  {
    id: "arctic",
    name: "Arctic",
    base: "#e4eded",
    accent: "#658ca4",
    pattern: "camo",
  },
  {
    id: "sunset",
    name: "Sunset",
    base: "#cf695d",
    accent: "#ffc774",
    pattern: "stripe",
  },
  {
    id: "neon",
    name: "Neon Grid",
    base: "#192b34",
    accent: "#62e8be",
    pattern: "grid",
  },
  {
    id: "carbon",
    name: "Carbon",
    base: "#242a2b",
    accent: "#556264",
    pattern: "weave",
  },
  {
    id: "retro",
    name: "Retro",
    base: "#bbaa81",
    accent: "#587f88",
    pattern: "stripe",
  },
]);
export function sanitizeSkins(value) {
  return Object.fromEntries(
    ["ar4", "r45", "titan"].map((id) => [
      id,
      SKINS.some((s) => s.id === value?.[id]) ? value[id] : "default",
    ]),
  );
}
export function loadSkins() {
  try {
    return sanitizeSkins(
      JSON.parse(localStorage.getItem("linebreak-skins") || "{}"),
    );
  } catch {
    return sanitizeSkins(null);
  }
}
const textures = new Map();
function texture(skin) {
  if (textures.has(skin.id)) return textures.get(skin.id);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = skin.base;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = ctx.strokeStyle = skin.accent;
  ctx.lineWidth = 2;
  if (skin.pattern === "grid")
    for (let i = 0; i <= 64; i += 16) {
      ctx.fillRect(i, 0, 1, 64);
      ctx.fillRect(0, i, 64, 1);
    }
  if (skin.pattern === "stripe")
    for (let i = -64; i < 128; i += 24) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 10, 0);
      ctx.lineTo(i + 74, 64);
      ctx.lineTo(i + 64, 64);
      ctx.fill();
    }
  if (skin.pattern === "camo")
    for (let i = 0; i < 14; i++) {
      ctx.globalAlpha = 0.4;
      ctx.fillRect((i * 19) % 64, (i * 31) % 64, 12, 8);
    }
  if (skin.pattern === "weave")
    for (let x = 0; x < 64; x += 8)
      for (let y = 0; y < 64; y += 8)
        ctx.fillRect(x, y, (x + y) % 16 ? 3 : 7, (x + y) % 16 ? 7 : 3);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.magFilter = THREE.NearestFilter;
  textures.set(skin.id, map);
  return map;
}
export function applySkin(group, id) {
  if (group.userData.skin === id) return;
  const skin = SKINS.find((s) => s.id === id) || SKINS[0];
  if (!group.userData.finishes) {
    const originals = new Map();
    group.userData.finishes = originals;
    group.traverse((o) => {
      if (!o.isMesh || o.userData.noSkin || !o.material.isMeshStandardMaterial)
        return;
      const original = o.material;
      if (!originals.has(original)) originals.set(original, original.clone());
      o.material = originals.get(original);
    });
  }
  for (const [original, material] of group.userData.finishes) {
    material.color.copy(original.color);
    material.map = original.map;
    if (skin.id !== "default") {
      material.color.set("#ffffff");
      material.map = texture(skin);
    }
    material.needsUpdate = true;
  }
  group.userData.skin = skin.id;
}
export function disposeSkins(group) {
  for (const material of group.userData.finishes?.values() || [])
    material.dispose();
  group.userData.finishes?.clear();
}
