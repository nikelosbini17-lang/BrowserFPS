import { worldDistance } from "../combat/Hitboxes.js";
export class GameMode {
  constructor(id, map) {
    this.id = id;
    this.map = map;
    this.duration = 0;
    this.respawnDelay = 0;
    this.protection = 0;
  }
  spawn(room, player) {
    return {
      x: (player.seat % 2 ? -1 : 1) * Math.ceil(player.seat / 2) * 2,
      y: 0,
      z: player.team === 0 ? 23 : -28,
    };
  }
}
export class PracticeMode extends GameMode {
  constructor() {
    super("practice", "kestrel");
  }
}
export class TacticalMode extends GameMode {
  constructor() {
    super("tactical", "kestrel");
  }
}
export class DeathmatchMode extends GameMode {
  constructor() {
    super("deathmatch", "district");
    this.duration = 600000;
    this.respawnDelay = 2000;
    this.protection = 1500;
  }
  spawn(room, player, now = performance.now()) {
    let best = null,
      bestScore = -Infinity;
    for (const point of room.world.spawns) {
      if (room.world.collides(point, 0.32, 1.8)) continue;
      let nearest = 100,
        exposed = 0;
      for (const enemy of room.players.values()) {
        if (enemy === player || enemy.health <= 0) continue;
        const q = enemy.state.position,
          dx = q.x - point.x,
          dy = q.y - point.y,
          dz = q.z - point.z,
          distance = Math.hypot(dx, dy, dz);
        nearest = Math.min(nearest, distance);
        if (
          distance > 0 &&
          worldDistance(
            room.world,
            { x: point.x, y: point.y + 1.4, z: point.z },
            { x: dx / distance, y: dy / distance, z: dz / distance },
            distance,
          ) >=
            distance - 0.1
        )
          exposed++;
      }
      const combat = room.lastCombat,
        combatPenalty =
          combat && now - combat.at < 5000
            ? Math.max(
                0,
                20 - Math.hypot(combat.x - point.x, combat.z - point.z),
              ) * 2
            : 0;
      const score =
        nearest - exposed * 22 - combatPenalty - (nearest < 3 ? 1000 : 0);
      if (score > bestScore) {
        best = point;
        bestScore = score;
      }
    }
    return { ...(best || room.world.spawns[0]) };
  }
}
export const createMode = (id) =>
  id === "deathmatch"
    ? new DeathmatchMode()
    : id === "practice"
      ? new PracticeMode()
      : new TacticalMode();
