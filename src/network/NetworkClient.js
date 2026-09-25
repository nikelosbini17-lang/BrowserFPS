import {
  NETWORK,
  WEAPON_IDS,
  decodeCommand,
  stateFromSnapshot,
  sanitizeName,
  validServerMessage,
} from "./Protocol.js";
import { WEAPONS } from "../config/WeaponConfig.js";
import { stepMovement } from "../player/Movement.js";

export function serverURL() {
  const configured = import.meta.env.VITE_GAME_SERVER_URL?.trim();
  const url = new URL(configured || "/game-socket", window.location.href);
  if (url.pathname === "/") url.pathname = "/game-socket";
  if (url.protocol === "http:") url.protocol = "ws:";
  if (url.protocol === "https:") url.protocol = "wss:";
  if (!["ws:", "wss:"].includes(url.protocol))
    throw new Error("Configure a ws:// or wss:// game server URL.");
  if (location.protocol === "https:" && url.protocol !== "wss:")
    throw new Error("HTTPS pages require a secure wss:// game server.");
  return url.href;
}
export class NetworkClient {
  constructor(game) {
    this.game = game;
    this.connected = false;
    this.roster = [];
    this.snapshots = [];
    this.pending = [];
    this.outbox = [];
    this.packetsIn = 0;
    this.packetsOut = 0;
    this.bytesIn = 0;
    this.bytesOut = 0;
    this.ping = 0;
    this.sequence = 0;
    this.shotSequence = 0;
  }
  connect(options) {
    this.disconnect();
    this.pending = [];
    this.outbox = [];
    this.snapshots = [];
    this.sequence = 0;
    this.shotSequence = 0;
    this.lastAck = 0;
    this.packetsIn = this.packetsOut = this.bytesIn = this.bytesOut = 0;
    this.sendTime = 0;
    return new Promise((resolve, reject) => {
      let settled = false;
      let ws;
      try {
        ws = new WebSocket(serverURL());
      } catch (error) {
        reject(error);
        return;
      }
      this.socket = ws;
      const fail = (message) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          reject(new Error(message));
        }
        ws.close();
      };
      const timeout = setTimeout(
        () =>
          fail("Connection timed out. Start the server or check its address."),
        7000,
      );
      this.cancelPending = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          const error = new Error("Connection canceled");
          error.name = "AbortError";
          reject(error);
        }
      };
      ws.onopen = () => {
        if (this.socket !== ws) return;
        this.send({
          t: "join",
          protocol: NETWORK.protocol,
          ...options,
          name: sanitizeName(options.name),
        });
      };
      ws.onerror = () =>
        fail(
          "Connection failed. Check that the game server is running, then retry.",
        );
      ws.onmessage = (event) => {
        if (this.socket !== ws) return;
        this.packetsIn++;
        this.bytesIn += event.data.length;
        let m;
        try {
          m = JSON.parse(event.data);
        } catch {
          fail("The server sent an invalid response.");
          return;
        }
        if (!validServerMessage(m)) {
          fail("The server sent an invalid response.");
          return;
        }
        if (m.t === "error") {
          fail(m.message || "Unable to join room.");
          return;
        }
        if (m.t === "welcome") {
          if (settled) return;
          if (m.protocol !== NETWORK.protocol) {
            fail("Client/server versions differ. Refresh after updating both.");
            return;
          }
          settled = true;
          this.cancelPending = null;
          clearTimeout(timeout);
          this.connected = true;
          this.id = m.id;
          this.code = m.code;
          this.roster = m.roster;
          this.state = m.state;
          this.match = m.match;
          this.snapshotHz = m.snapshotHz;
          this.pingTimer = setInterval(
            () => this.send({ t: "ping", at: performance.now() }),
            1500,
          );
          resolve(m);
        }
        if (m.t === "roster" && this.connected) {
          this.roster = m.players;
          this.game.remotePlayers.syncRoster(this.roster, this.id);
        }
        if (m.t === "snapshot" && this.connected) {
          this.serverTime = m.at;
          this.match = m.match;
          this.snapshots.push({
            at: performance.now(),
            serverAt: m.at,
            players: m.players,
          });
          if (this.snapshots.length > 12) this.snapshots.shift();
          const local = m.players.find((p) => p[0] === this.id);
          if (local) this.reconcile(local);
        }
        if (m.t === "pong")
          this.ping = Math.round(Math.max(0, performance.now() - m.at));
        if (m.t === "probe") this.send({ t: "probe", at: m.at });
        if (m.t === "combat" && this.connected) {
          this.lastCombat = m;
          if (m.attacker === this.id) {
            this.game.ui.hit({
              ...m,
              target: {
                name:
                  this.roster.find((p) => p.id === m.victim)?.name || "Player",
              },
              killed: false,
            });
            this.game.audio.play(m.killed ? "kill" : "hit");
          }
          if (m.victim === this.id) {
            this.game.player.health = m.health;
            this.game.player.alive = m.health > 0;
            this.game.eliminatedBy = m;
          }
          if (m.killed) this.game.ui.killFeed(m);
        }
      };
      ws.onclose = () => {
        if (this.socket !== ws) return;
        clearTimeout(timeout);
        clearInterval(this.pingTimer);
        if (!settled) {
          settled = true;
          reject(
            new Error(
              "Connection failed or the server rejected this connection.",
            ),
          );
        }
        const unexpected = this.connected;
        this.connected = false;
        if (unexpected) this.game.connectionLost();
      };
    });
  }
  send(message) {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    const text = JSON.stringify(message);
    this.socket.send(text);
    this.packetsOut++;
    this.bytesOut += text.length;
  }
  record(command, pitch, slot, dt) {
    if (!this.connected) return;
    const yaw = Math.atan2(Math.sin(command.yaw), Math.cos(command.yaw));
    const c = [
      ++this.sequence,
      command.x,
      command.z,
      yaw,
      pitch,
      Number(Boolean(command.jump)),
      Number(Boolean(command.crouch)),
      Number(Boolean(command.walk)),
      slot,
    ];
    this.pending.push(c);
    this.outbox.push(c);
    this.sendTime += dt;
    if (this.pending.length > 240) {
      this.socket.close();
      return;
    }
    if (this.sendTime >= 1 / NETWORK.sendHz) {
      this.sendTime %= 1 / NETWORK.sendHz;
      this.send({ t: "input", commands: this.outbox });
      this.outbox = [];
    }
  }
  action(action) {
    if (!this.connected) return;
    if (this.outbox.length) {
      this.send({ t: "input", commands: this.outbox });
      this.outbox = [];
    }
    const p = this.game.player;
    this.send({
      t: "action",
      action,
      seq: this.sequence,
      slot: this.game.weapons.index,
      shotId: action === "fire" ? ++this.shotSequence : 0,
      yaw: Math.atan2(Math.sin(p.yaw), Math.cos(p.yaw)),
      pitch: p.pitch,
    });
  }
  reconcile(snapshot) {
    if (snapshot[11] < this.lastAck) return;
    this.lastAck = snapshot[11];
    this.pending = this.pending.filter((command) => command[0] > this.lastAck);
    const state = stateFromSnapshot(snapshot);
    // Reapply only unacknowledged inputs using exactly the server's fixed physics step.
    for (const c of snapshot[15] > 0 ? this.pending : [])
      stepMovement(
        state,
        decodeCommand(c, WEAPONS[WEAPON_IDS[c[8]]].speedMultiplier),
        this.game.world,
        1 / NETWORK.simulationHz,
      );
    const player = this.game.player;
    player.position.set(state.position.x, state.position.y, state.position.z);
    player.velocity.set(state.velocity.x, state.velocity.y, state.velocity.z);
    player.grounded = state.grounded;
    player.jumpBuffer = state.jumpBuffer;
    player.landingAge = state.landingAge;
    player.speed = state.speed;
    player.health = snapshot[15];
    player.alive = player.health > 0;
    player.kills = snapshot[16];
    player.deaths = snapshot[17];
    player.respawnAt = snapshot[18];
    player.protectedUntil = snapshot[19];
    player.primary = snapshot[29];
    if (snapshot[25] !== this.life) {
      this.life = snapshot[25];
      this.game.weapons.reset();
      this.game.weapons.setInfiniteReserve(false);
      this.game.weapons.switchTo(snapshot[12]);
      this.game.input.clear();
      player.eyeHeight = snapshot[10] ? 1.05 : 1.65;
      this.game.eliminatedBy = null;
    }
    if (
      snapshot[28] >= this.shotSequence &&
      snapshot[12] === this.game.weapons.index
    ) {
      const w = this.game.rifle;
      w.ammo = snapshot[20];
      w.reserve = snapshot[21];
    }
  }
  disconnect() {
    this.match = null;
    this.serverTime = 0;
    this.lastCombat = null;
    this.cancelPending?.();
    this.cancelPending = null;
    this.connected = false;
    clearInterval(this.pingTimer);
    if (this.socket) {
      this.socket.onopen = null;
      this.socket.onclose = null;
      this.socket.onmessage = null;
      this.socket.onerror = null;
      this.socket.close();
      this.socket = null;
    }
    this.roster = [];
    this.snapshots = [];
    this.pending = [];
    this.outbox = [];
  }
}
