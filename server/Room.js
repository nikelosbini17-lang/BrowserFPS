import { randomUUID } from "node:crypto";
import { resetMovement, stepMovement } from "../src/player/Movement.js";
import {
  NETWORK,
  WEAPON_IDS,
  decodeCommand,
  packState,
} from "../src/network/Protocol.js";
import { WEAPONS } from "../src/config/WeaponConfig.js";
import { resetCombat, combatAction } from "./Combat.js";
import { createMode } from "../src/modes/GameMode.js";

export class Room {
  constructor(
    code,
    world,
    capacity = NETWORK.maxPlayers,
    mode = "tactical",
    isPublic = false,
  ) {
    this.code = code;
    this.world = world;
    this.capacity = capacity;
    this.players = new Map();
    this.history = [];
    this.events = [];
    this.debug = process.env.DEV_COMBAT_LOGS === "true";
    this.mode = createMode(mode);
    this.public = isPublic;
    this.startedAt = performance.now();
    this.endsAt = this.mode.duration ? this.startedAt + this.mode.duration : 0;
    this.ended = false;
  }
  add(socket, name) {
    if (this.players.size >= this.capacity) return null;
    const counts = [0, 0];
    for (const p of this.players.values()) counts[p.team]++;
    const team = counts[0] <= counts[1] ? 0 : 1;
    const used = new Set(
      [...this.players.values()]
        .filter((p) => p.team === team)
        .map((p) => p.seat),
    );
    let seat = 0;
    while (used.has(seat)) seat++;
    const state = {
      position: {
        x: (seat % 2 ? -1 : 1) * Math.ceil(seat / 2) * 2,
        y: 0,
        z: team === 0 ? 23 : -28,
      },
      velocity: { x: 0, y: 0, z: 0 },
    };
    resetMovement(state);
    const player = {
      id: randomUUID(),
      socket,
      name,
      team,
      seat,
      state,
      queue: [],
      ack: 0,
      lastSequence: 0,
      slot: 0,
      yaw: team === 0 ? 0 : Math.PI,
      pitch: 0,
      lastInput: performance.now(),
      lastCommand: null,
      actions: [],
    };
    resetCombat(player);
    player.loadout = { primary: 0, secondary: 1 };
    player.nextLoadout = { ...player.loadout };
    this.spawn(player);
    this.players.set(player.id, player);
    return player;
  }
  spawn(p, now = performance.now()) {
    const point = this.mode.spawn(this, p, now);
    Object.assign(p.state.position, point);
    p.state.velocity = { x: 0, y: 0, z: 0 };
    resetMovement(p.state);
    resetCombat(p);
    p.loadout = { ...p.nextLoadout };
    p.slot = this.mode.id === "deathmatch" ? p.loadout.primary : 0;
    p.weapons.switchTo(p.slot);
    p.weapons.current.drawRemaining = 0;
    p.protectedUntil = now + this.mode.protection;
    p.actions = [];
    p.queue = [];
    p.ack = p.lastSequence;
  }
  match() {
    return {
      mode: this.mode.id,
      map: this.mode.map,
      endsAt: this.endsAt,
      ended: this.ended,
      capacity: this.capacity,
      public: this.public,
    };
  }
  roster() {
    return [...this.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      team: p.team,
      kills: p.kills,
      deaths: p.deaths,
      ping: p.ping || 0,
    }));
  }
  snapshot() {
    return [...this.players.values()].map(packState);
  }
  step(now) {
    if (this.endsAt && now >= this.endsAt) this.ended = true;
    for (const p of this.players.values()) {
      if (!this.ended && p.health <= 0 && p.respawnAt && now >= p.respawnAt)
        this.spawn(p, now);
      const c = p.queue.shift();
      if (c) {
        p.lastCommand = c;
        p.ack = c[0];
        p.yaw = c[3];
        p.pitch = c[4];
        if (
          this.mode.id !== "deathmatch" ||
          [p.loadout.primary, p.loadout.secondary].includes(c[8])
        )
          p.slot = c[8];
        p.weapons.switchTo(p.slot);
      }
      const command = c
        ? decodeCommand(c, WEAPONS[WEAPON_IDS[p.slot]].speedMultiplier)
        : {
            x: 0,
            z: 0,
            yaw: p.yaw,
            speedMultiplier: WEAPONS[WEAPON_IDS[p.slot]].speedMultiplier,
          };
      // Missing commands never buy extra simulation time, and stale input cannot keep walking.
      if (p.health > 0 && !this.ended)
        stepMovement(p.state, command, this.world, 1 / NETWORK.simulationHz);
      p.weapons.update(1 / NETWORK.simulationHz, p.state);
      while (p.actions.length && p.actions[0].seq <= p.ack)
        combatAction(this, p, p.actions.shift(), now);
    }
  }
  record(now) {
    this.history.push({ time: now, players: this.snapshot() });
    while (this.history.length > 10) this.history.shift(); // Bounded 500 ms history for a future validated rewind.
  }
}
