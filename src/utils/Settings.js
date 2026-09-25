export const defaults = {
  quality: "medium",
  resolution: 1,
  shadows: true,
  antialias: true,
  fps: true,
  maxFps: 120,
  fov: 85,
  sensitivity: 1,
  invert: false,
  bob: true,
  spaceJump: true,
  wheelJump: "both",
  movementDebug: false,
  viewmodelMotion: "low",
  volume: 0.55,
  effects: 0.8,
  crosshairColor: "#b9f5df",
  crosshairSize: 6,
  crosshairGap: 4,
  crosshairThickness: 2,
  crosshairOpacity: 1,
  crosshairDot: false,
  dynamic: true,
};
export function loadSettings() {
  try {
    return validateSettings(
      JSON.parse(localStorage.getItem("linebreak-settings") || "{}"),
    );
  } catch {
    return { ...defaults };
  }
}
export function validateSettings(value) {
  const result = { ...defaults };
  const ranges = {
    resolution: [0.5, 1],
    maxFps: [0, 240],
    fov: [70, 110],
    sensitivity: [0.1, 5],
    volume: [0, 1],
    effects: [0, 1],
    crosshairSize: [2, 14],
    crosshairGap: [1, 12],
    crosshairThickness: [1, 4],
    crosshairOpacity: [0.2, 1],
  };
  const choices = {
    quality: ["low", "medium", "high"],
    wheelJump: ["off", "up", "down", "both"],
    viewmodelMotion: ["off", "low", "normal"],
  };
  for (const key of Object.keys(defaults)) {
    const v = value?.[key];
    if (ranges[key] && Number.isFinite(v))
      result[key] = Math.min(ranges[key][1], Math.max(ranges[key][0], v));
    else if (choices[key]?.includes(v)) result[key] = v;
    else if (typeof defaults[key] === "boolean" && typeof v === "boolean")
      result[key] = v;
    else if (key === "crosshairColor" && /^#[0-9a-f]{6}$/i.test(v))
      result[key] = v;
  }
  return result;
}
export function saveSettings(settings) {
  try {
    localStorage.setItem("linebreak-settings", JSON.stringify(settings));
  } catch {
    /* Private browsers may block storage. */
  }
}
