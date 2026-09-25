import { DEV_MODE, GAME_VERSION } from "../config/GameConfig.js";
import { WEAPONS } from "../config/WeaponConfig.js";
import { sanitizeName } from "../network/Protocol.js";
import { MOVEMENT } from "../config/MovementConfig.js";
import { SKINS, applySkin } from "../weapons/Skins.js";
const icon =
  '<svg viewBox="0 0 36 36" fill="none" aria-hidden="true"><path d="M7 6v24h10v-6h-4V6M26 6L17 30h6l9-24" stroke="currentColor" stroke-width="2"/></svg>';
const arrow = '<span aria-hidden="true">↗</span>';
const mapDiagram = `<svg class="map-diagram" viewBox="0 0 260 190" aria-label="Kestrel map overview"><defs><pattern id="grid" width="15" height="15" patternUnits="userSpaceOnUse"><path d="M15 0H0V15" fill="none" stroke="#7a8d87" stroke-opacity=".13"/></pattern></defs><rect width="260" height="190" fill="url(#grid)"/><path d="M44 25H216V165H44Z" fill="#9baaa0" fill-opacity=".09" stroke="#869589"/><g fill="#6b7d72"><path d="M86 48h16v47H86zm0 71h16v26H86zm68-83h16v48h-16zm0 73h16v42h-16zM47 81h29v10H47zm133 22h34v10h-34z"/><rect x="59" y="121" width="25" height="12"/><rect x="174" y="51" width="12" height="29"/><rect x="117" y="84" width="19" height="9"/></g><path d="M129 151V109L130 52M127 133L64 111V56M132 137L197 135V39" stroke="#d29e64" stroke-width="1" stroke-dasharray="3 4" fill="none"/><g fill="#ecb679" font-family="monospace" font-size="15"><text x="59" y="54">A</text><text x="191" y="43">B</text></g><circle cx="130" cy="151" r="4" fill="#dba568"/><path d="M230 153v-20m-4 5 4-5 4 5" stroke="#8b9a90"/><text x="227" y="166" fill="#8b9a90" font-size="8">N</text></svg>`;

export class UI {
  constructor(game, settings) {
    this.game = game;
    this.settings = settings;
    this.feed = [];
    this.hitTime = 0;
    document.querySelector("#app").innerHTML = `
      <div id="menu" class="menu-screen">
        <header class="menu-header"><a class="wordmark" href="#" aria-label="LINEBREAK home">${icon} LINEBREAK<span class="version">/ 01</span></a><div class="top-status"><i></i> SYSTEMS ONLINE <span>LOCAL BUILD 0.1</span></div></header>
        <main class="menu-main"><section class="hero"><div class="eyebrow"><span class="short-line"></span> A BROWSER TACTICAL SHOOTER</div><h1>HOLD YOUR<br><span>GROUND.</span></h1><p class="hero-copy">Every angle matters. Every shot counts.<br>Find your footing at Kestrel.</p>
          <nav class="main-nav" aria-label="Main menu"><button class="play-button" data-action="play"><span><small>01 / DEPLOY</small>PLAY</span>${arrow}</button><button class="nav-button" data-action="practice"><span>02 <strong>PRACTICE RANGE</strong></span><span>→</span></button><button class="nav-button" data-action="settings"><span>03 <strong>SETTINGS</strong></span><span>+</span></button><button class="nav-button" data-action="help"><span>04 <strong>HOW TO PLAY</strong></span><span>+</span></button></nav>
          <div class="local-note"><span>◈</span> NO DOWNLOAD. NO ACCOUNT. JUST AIM.</div>
        </section>
        <aside class="location-card"><div class="card-heading"><span>TRAINING GROUND</span><span>01 / 01</span></div>${mapDiagram}<div class="location-title"><h2>KESTREL</h2><span>36° N / 24° E</span></div><p>Coastal logistics facility</p><div class="tags"><span>3 ROUTES</span><span>6 TARGETS</span><span>SOLO</span></div><div class="card-bottom"><i></i> RANGE OPEN <span>MEDITERRANEAN SECTOR</span></div></aside></main>
        <footer class="menu-footer"><span>PRECISION OVER EVERYTHING.</span><span><i></i> ORIGINAL WORLD · BUILT FOR THE BROWSER</span><span>PROTOTYPE / MILESTONE 01</span></footer>
        <div class="scene-caption"><span>KESTREL / EAST LOADING</span><span>LIVE ENVIRONMENT <i></i></span></div>
      </div>
      <div id="hud" class="hidden">
        <div class="hud-top-left"><div class="hud-brand">${icon}<span>KESTREL<small>PRACTICE RANGE</small></span></div><canvas id="radar" width="160" height="160" aria-label="Overhead radar"></canvas><div class="sector" id="sector">SOUTH APPROACH</div></div>
        <div class="session"><span>FREE TRAINING</span><strong id="timer">00:00</strong><small><i></i> RANGE ACTIVE</small></div>
        <div class="hud-top-right"><span id="fps">60 FPS</span><div id="feed"></div></div>
        <div id="scope" class="hidden"><div class="scope-glass"><div class="scope-dot"></div><div class="scope-ladder">┬<br>┬<br>┬</div><span class="scope-caption">TITAN / OPTICAL SYSTEM <b id="scope-level">01</b></span></div></div>
        <div id="crosshair"><i></i><i></i><i></i><i></i><b></b></div><div id="hitmarker">×</div><div id="hit-label"></div>
        <div id="reload-status"></div><div class="health-block"><span class="health-icon">+</span><strong id="health">100</strong><span class="health-label">HEALTH<small><span id="armor">0</span> ARMOR</small></span></div>
        <div class="hud-bottom-center"><span><kbd>W A S D</kbd> MOVE</span><span><kbd>R</kbd> RELOAD</span><span><kbd>ESC</kbd> MENU</span><div>STAND STILL FOR ACCURATE SHOTS</div></div>
        <div class="ammo-block"><div><span class="weapon-name">AR-4</span><span class="weapon-type">5.56 / AUTOMATIC</span></div><strong id="ammo">30</strong><span class="reserve">/ <span id="reserve">90</span></span><small id="ammo-note">∞ RESERVE AMMO</small></div>
        <div id="weapon-rack"><span data-slot="0"><kbd>1</kbd> AR-4</span><span data-slot="1"><kbd>2</kbd> R45</span><span data-slot="2"><kbd>3</kbd> TITAN</span></div>
        <div id="scoreboard" class="hidden"></div><pre id="movement-debug" class="hidden"></pre>
      </div>
      <div id="overlay" class="overlay hidden"></div><div id="toast" role="status"></div>`;
    this.menu = document.querySelector("#menu");
    this.hud = document.querySelector("#hud");
    this.overlay = document.querySelector("#overlay");
    this.radar = document.querySelector("#radar").getContext("2d");
    this.elements = Object.fromEntries(
      [
        "timer",
        "fps",
        "health",
        "armor",
        "ammo",
        "reserve",
        "ammo-note",
        "crosshair",
        "hitmarker",
        "hit-label",
        "reload-status",
        "sector",
        "feed",
        "scoreboard",
      ].map((id) => [id, document.getElementById(id)]),
    );
    document.querySelector("#app").addEventListener("click", (e) => {
      const button = e.target.closest("[data-action]");
      if (button) this.action(button.dataset.action);
    });
    document.querySelector(".wordmark").addEventListener("click", (e) => {
      e.preventDefault();
    });
    this.applyCrosshair();
    document.querySelector(".top-status > span").textContent = GAME_VERSION;
    const onlineButton = document.createElement("button");
    onlineButton.className = "nav-button";
    onlineButton.dataset.action = "online";
    onlineButton.innerHTML =
      "<span>05 <strong>ONLINE / PRIVATE ROOMS</strong></span><span>↗</span>";
    document.querySelector(".main-nav").append(onlineButton);
    const loadoutButton = document.createElement("button");
    loadoutButton.className = "nav-button";
    loadoutButton.dataset.action = "loadout";
    loadoutButton.innerHTML =
      "<span>06 <strong>LOADOUT</strong></span><span>↗</span>";
    document.querySelector(".main-nav").append(loadoutButton);
    document.querySelector(".menu-footer > span:last-child").textContent =
      "DEATHMATCH / ALPHA 03";
  }
  action(action) {
    if (action === "play") this.showDeploy();
    if (action === "online") this.showOnline();
    if (action === "deathmatch") this.showDeathmatch();
    if (action === "dm-quick") this.quickPlay();
    if (action === "loadout") this.showLoadout();
    if (action === "online-retry")
      this.connectOnline(this.lastOnlineMode || "create");
    if (["online-create", "online-join", "online-quick"].includes(action))
      this.connectOnline(action.slice(7));
    if (action === "practice" || action === "start") this.game.start();
    if (action === "settings") this.showSettings();
    if (action === "help") this.showHelp();
    if (action === "close") {
      if (!this.game.started && !this.game.network?.connected)
        this.game.network?.disconnect();
      this.game.started ? this.showPause() : this.closeOverlay();
    }
    if (action === "resume") this.game.resume();
    if (action === "restart") this.game.restart();
    if (action === "home") this.game.home();
    if (action === "reset-targets") {
      this.game.targets.reset();
      this.toast("All range targets restored");
    }
    if (action === "practice-panel") this.showPractice();
    if (action.startsWith("equip-")) {
      this.game.weapons.switchTo(Number(action.slice(6)));
      this.showPractice();
    }
  }
  modal(eyebrow, title, content, wide = false) {
    this.overlay.classList.remove("hidden");
    this.overlay.innerHTML = `<section class="dialog ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${title}"><button class="close-button" data-action="close" aria-label="Close">×</button><div class="eyebrow">${eyebrow}</div><h2>${title}</h2>${content}</section>`;
  }
  closeOverlay() {
    this.overlay.classList.add("hidden");
  }
  showDeploy() {
    this.modal(
      "PLAY / CHOOSE A MODE",
      "FIND YOUR FIGHT.",
      `<div class="mode-grid"><button class="mode-card" data-action="deathmatch"><small>01 / DISTRICT</small><h3>DEATHMATCH</h3><p>Free for all. Ten minutes. Instant action.</p><span>QUICK PLAY →</span></button><button class="mode-card" data-action="online"><small>02 / KESTREL</small><h3>TACTICAL</h3><p>Combat sandbox. Private rooms. No round objectives yet.</p><span>ROOMS →</span></button><button class="mode-card" data-action="practice"><small>03 / KESTREL</small><h3>PRACTICE</h3><p>Solo range. Three original weapons. Refine your aim.</p><span>ENTER KESTREL →</span></button></div>`,
      true,
    );
  }
  showRangeDeploy() {
    this.modal(
      "DEPLOY / LOCAL PLAY",
      "MAKE EVERY SHOT COUNT.",
      `<p class="dialog-copy">Master your momentum. Time your jumps, settle your aim, and make the next shot count.</p><div class="deploy-card">${mapDiagram}<div><span class="eyebrow">MOVEMENT + ARSENAL UPDATE</span><h3>THE PRACTICE RANGE</h3><p>Six reactive targets. Three original weapons.<br>Unlimited reserve ammunition.</p><div class="tags"><span>AR-4</span><span>R45</span><span>TITAN</span></div></div></div><button class="solid-button" data-action="start">ENTER KESTREL <span>→</span></button><p class="footnote">Use 1 / 2 / 3 to switch weapons. Right-click cycles the Titan's scope. This is a local training session; team rounds and objectives are planned.</p>`,
      true,
    );
  }
  showPause() {
    this.modal(
      "SESSION PAUSED",
      "TAKE A BREATHER.",
      `<p class="dialog-copy">Your range session is paused. Click resume to capture your mouse.</p><button class="solid-button" data-action="resume">RESUME <span>→</span></button><button class="plain-button" data-action="settings">SETTINGS <span>+</span></button><button class="plain-button" data-action="practice-panel">PRACTICE TOOLS <span>+</span></button><button class="plain-button" data-action="restart">RESTART SESSION <span>↻</span></button><button class="plain-button muted" data-action="home">MAIN MENU <span>←</span></button>`,
    );
    if (this.game.mode === "online") {
      this.overlay
        .querySelector('[data-action="resume"]')
        .insertAdjacentHTML(
          "afterend",
          '<button class="plain-button" data-action="loadout">LOADOUT / NEXT SPAWN →</button>',
        );
      this.overlay.querySelector(".eyebrow").textContent =
        `ONLINE ROOM / ${this.game.network.code}`;
      this.overlay.querySelector(".dialog-copy").textContent =
        "Mouse released. The online room continues running. Click resume to return.";
      this.overlay
        .querySelector('[data-action="restart"]')
        .classList.add("hidden");
      this.overlay
        .querySelector('[data-action="practice-panel"]')
        .classList.add("hidden");
    }
  }
  showOnline(error = "") {
    this.modal(
      "NETWORK TEST / REAL PLAYERS",
      "PRIVATE ROOMS.",
      `<p class="dialog-copy">Create a private Kestrel combat room or join a friend. Damage, weapons and movement are server authoritative. Tactical rounds and objectives are not implemented.</p><label class="text-field">PLAYER NAME<input id="player-name" maxlength="18" autocomplete="nickname" placeholder="Ranger"></label><label class="text-field">ROOM CODE<input id="room-code" maxlength="5" autocomplete="off" placeholder="ABCDE"></label><p id="connection-status" role="status"></p><button class="solid-button" data-action="online-create">CREATE ROOM <span>↗</span></button><div class="online-actions"><button class="plain-button" data-action="online-join">JOIN ROOM <span>→</span></button><button class="plain-button" data-action="online-quick">QUICK JOIN <span>→</span></button></div><p class="footnote">Up to 10 players. Practice always works without a server.</p>`,
    );
    let name = "Ranger";
    try {
      name = localStorage.getItem("linebreak-player-name") || name;
    } catch {}
    this.overlay.querySelector("#player-name").value = name;
    this.overlay.querySelector("#room-code").value = this.lastRoomCode || "";
    this.overlay.querySelector("#connection-status").textContent = error;
    if (error) {
      this.overlay.querySelector(".eyebrow").textContent = "CONNECTION FAILED";
      this.overlay
        .querySelector("#connection-status")
        .insertAdjacentHTML(
          "afterend",
          '<button class="plain-button" data-action="online-retry">RETRY CONNECTION <span>↻</span></button>',
        );
    }
  }
  connectOnline(mode) {
    this.lastOnlineMode = mode;
    const name = sanitizeName(this.overlay.querySelector("#player-name").value);
    const code = this.overlay
      .querySelector("#room-code")
      .value.trim()
      .toUpperCase();
    this.lastRoomCode = code;
    try {
      localStorage.setItem("linebreak-player-name", name);
    } catch {}
    const status = this.overlay.querySelector("#connection-status");
    if (mode === "join" && !/^[A-Z2-9]{5}$/.test(code)) {
      status.textContent = "Enter a valid five-character room code.";
      return;
    }
    status.textContent = "CONNECTING…";
    this.overlay
      .querySelectorAll('button[data-action^="online-"]')
      .forEach((button) => (button.disabled = true));
    this.game.joinOnline({ name, mode, code });
  }
  showDeathmatch() {
    this.modal(
      "PUBLIC QUICK PLAY / DISTRICT",
      "DEATHMATCH.",
      `<p class="dialog-copy">A city of angles. Free for all, 10-minute matches and two-second respawns. Join an active public instance automatically.</p><label class="text-field">PLAYER NAME<input id="dm-name" maxlength="18" value="Ranger"></label><label class="setting"><span>PRIMARY</span><select id="dm-primary"><option value="0">AR-4 / Rifle</option><option value="2">TITAN / Heavy sniper</option></select></label><label class="setting"><span>SECONDARY</span><select><option>R45 / Heavy pistol</option></select></label><p class="footnote">All players are enemies. Spawn protection lasts 1.5 seconds and ends when you fire.</p><button class="solid-button" data-action="dm-quick">QUICK PLAY →</button><button class="plain-button" data-action="loadout">LOADOUT & SKINS →</button>`,
    );
    try {
      this.overlay.querySelector("#dm-name").value =
        localStorage.getItem("linebreak-player-name") || "Ranger";
      this.overlay.querySelector("#dm-primary").value =
        localStorage.getItem("linebreak-primary") || "0";
    } catch {}
  }
  quickPlay() {
    const name = sanitizeName(this.overlay.querySelector("#dm-name").value),
      primary = Number(this.overlay.querySelector("#dm-primary").value);
    try {
      localStorage.setItem("linebreak-player-name", name);
      localStorage.setItem("linebreak-primary", String(primary));
    } catch {}
    this.modal(
      "QUICK PLAY",
      "FINDING SERVER…",
      '<p class="dialog-copy">Finding an open District instance.</p>',
    );
    this.game.joinOnline({
      name,
      primary,
      mode: "quick",
      gameMode: "deathmatch",
    });
  }
  showLoadout() {
    this.modal(
      "ARSENAL / COSMETICS",
      "YOUR LOADOUT.",
      `<label class="setting"><span>PRIMARY / NEXT SPAWN</span><select id="loadout-primary"><option value="0">AR-4</option><option value="2">TITAN</option></select></label><label class="setting"><span>SECONDARY</span><select><option>R45</option></select></label><label class="setting"><span>PREVIEW WEAPON</span><select id="skin-weapon"><option value="ar4">AR-4</option><option value="r45">R45</option><option value="titan">TITAN</option></select></label><canvas id="skin-preview" aria-label="Weapon cosmetic preview" style="width:100%;border:1px solid #62766a"></canvas><label class="setting"><span>FINISH</span><select id="skin-select">${SKINS.map((s) => `<option value="${s.id}">${s.name}</option>`).join("")}</select></label><p class="footnote">Every finish is freely selectable. Cosmetics never change weapon performance. Loadout changes apply on your next spawn.</p><button id="equip-skin" class="solid-button">EQUIP →</button>`,
      true,
    );
    const weapon = this.overlay.querySelector("#skin-weapon"),
      skin = this.overlay.querySelector("#skin-select"),
      primary = this.overlay.querySelector("#loadout-primary");
    try {
      primary.value = localStorage.getItem("linebreak-primary") || "0";
    } catch {}
    const preview = () => {
      const id = weapon.value;
      applySkin(this.game.viewModel.models[id].group, skin.value);
      this.game.previewWeapon(id, this.overlay.querySelector("#skin-preview"));
      this.game.applySkins();
    };
    weapon.onchange = () => {
      skin.value = this.game.skins[weapon.value];
      preview();
    };
    skin.onchange = preview;
    weapon.onchange();
    this.overlay.querySelector("#equip-skin").onclick = () => {
      this.game.skins[weapon.value] = skin.value;
      this.game.applySkins();
      try {
        localStorage.setItem(
          "linebreak-skins",
          JSON.stringify(this.game.skins),
        );
        localStorage.setItem("linebreak-primary", primary.value);
      } catch {}
      this.game.network.send({
        t: "loadout",
        primary: Number(primary.value),
        secondary: 1,
        skins: this.game.skins,
      });
      this.toast("Equipped. Loadout applies next spawn.");
      preview();
    };
  }
  updateMatch(game) {
    let banner = document.querySelector("#death-feedback");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "death-feedback";
      this.hud.append(banner);
    }
    const dead = game.mode === "online" && !game.player.alive,
      protectedNow =
        game.mode === "online" &&
        game.player.protectedUntil > game.network.serverTime;
    banner.classList.toggle("hidden", !dead && !protectedNow);
    if (dead) {
      const event = game.eliminatedBy,
        name =
          game.network.roster.find((p) => p.id === event?.attacker)?.name ||
          "Player";
      banner.textContent = `ELIMINATED BY ${name} · ${WEAPONS[event?.weapon]?.name || "Weapon"}${game.player.respawnAt ? " — RESPAWNING IN " + Math.max(0, Math.ceil((game.player.respawnAt - game.network.serverTime) / 1000)) : " — Leave and rejoin to spawn"}`;
    } else if (protectedNow)
      banner.textContent = "SPAWN PROTECTION · ENDS WHEN YOU FIRE";
    if (game.network.match?.ended && !this.matchOverShown) {
      this.matchOverShown = true;
      document.exitPointerLock();
      this.showMatchOver();
    }
    if (!game.network.match?.ended) this.matchOverShown = false;
    const brand = document.querySelector(".hud-brand > span");
    brand.firstChild.textContent = game.world.name.toUpperCase();
    document.querySelectorAll("[data-slot]").forEach((el) => {
      const slot = Number(el.dataset.slot),
        dm = game.gameMode.id === "deathmatch";
      el.style.display = dm && slot === 2 ? "none" : "";
      if (dm && slot === 0)
        el.innerHTML = `<kbd>1</kbd> ${WEAPONS[game.player.primary === 2 ? "titan" : "ar4"].name}`;
      if (!dm && slot === 0) el.innerHTML = "<kbd>1</kbd> AR-4";
      if (dm)
        el.classList.toggle(
          "active",
          game.weapons.index === (slot === 0 ? game.player.primary : 1),
        );
    });
  }
  showMatchOver() {
    this.updateOnlineScoreboard(this.game.network);
    this.modal(
      "DISTRICT / FINAL STANDINGS",
      "MATCH OVER",
      `${this.elements.scoreboard.querySelector("table")?.outerHTML || ""}<button class="solid-button" data-action="home">MAIN MENU →</button>`,
      true,
    );
  }
  showConnected(code) {
    this.lastRoomCode = code;
    this.modal(
      "CONNECTED / ONLINE COMBAT",
      "YOU’RE IN.",
      `<p class="dialog-copy">Share this code with another player. Both clients connect to the same authoritative movement server.</p><div class="room-code-display" id="connected-room-code"></div><p class="footnote">Server-authoritative combat · Press 1 / 2 to switch weapons<br>Press TAB for the connected player list. ESC releases the mouse; the server continues running.</p><button class="solid-button" data-action="resume">ENTER ROOM <span>→</span></button><button class="plain-button" data-action="home">LEAVE ROOM <span>←</span></button>`,
    );
    this.overlay.querySelector("#connected-room-code").textContent = code;
  }
  showHelp() {
    this.modal(
      "FIELD MANUAL / 01",
      "LEARN THE ANGLES.",
      `<div class="help-grid">${[
        ["W A S D", "Move"],
        ["MOUSE", "Look around"],
        ["LEFT CLICK", "Fire / tap pistols"],
        ["RIGHT CLICK", "Cycle Titan scope"],
        ["1 / 2 / 3", "AR-4 / R45 / Titan"],
        ["Q", "Previous weapon"],
        ["R", "Reload"],
        ["SPACE / WHEEL", "Jump (timed hops)"],
        ["SHIFT", "Walk quietly"],
        ["CTRL", "Crouch"],
        ["TAB", "Range statistics"],
        ["F2", "Arsenal / practice tools"],
        ["ESC", "Pause / release mouse"],
      ]
        .map(
          ([key, label]) => `<div><kbd>${key}</kbd><span>${label}</span></div>`,
        )
        .join(
          "",
        )}</div><div class="tip"><strong>ACCURACY IS EARNED.</strong><p>Stop moving before you shoot. Crouch for tighter shots. Fire short bursts and pull your mouse down to control recoil. Orange dummies have 100 HP; headshots deal extra damage.</p></div><button class="solid-button" data-action="practice">ENTER PRACTICE <span>→</span></button>`,
      true,
    );
  }
  showPractice() {
    this.modal(
      "LOCAL SESSION",
      "RANGE TOOLS.",
      `<p class="dialog-copy">Test the arsenal. Targets reset three seconds after elimination. Switch with 1 / 2 / 3 or Q while playing.</p><div class="arsenal-list">${Object.values(
        WEAPONS,
      )
        .map(
          (weapon, index) =>
            `<button class="arsenal-card ${index === this.game.weapons.index ? "selected" : ""}" data-action="equip-${index}"><span><kbd>${index + 1}</kbd><strong>${weapon.name}</strong><small>${weapon.magazine} ROUNDS · ${weapon.damage} DAMAGE · ${weapon.reloadTime}s RELOAD</small></span><p>${weapon.description}</p></button>`,
        )
        .join(
          "",
        )}</div><label class="setting"><span>Infinite reserve ammo (all weapons)</span><input id="infinite-ammo" type="checkbox" ${this.game.rifle.infiniteReserve ? "checked" : ""}></label><button class="plain-button" data-action="reset-targets">RESET ALL TARGETS <span>↻</span></button><button class="solid-button" data-action="resume">BACK TO RANGE <span>→</span></button>`,
    );
    document.querySelector("#infinite-ammo").addEventListener("change", (e) => {
      this.game.weapons.setInfiniteReserve(e.target.checked);
    });
  }
  showSettings() {
    const s = this.settings;
    const range = (label, key, min, max, step) =>
      `<label class="setting"><span>${label}<output for="${key}">${s[key]}</output></span><input id="${key}" data-setting="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${s[key]}"></label>`;
    const check = (label, key) =>
      `<label class="setting"><span>${label}</span><input data-setting="${key}" type="checkbox" ${s[key] ? "checked" : ""}></label>`;
    const select = (label, key, options) =>
      `<label class="setting"><span>${label}</span><select data-setting="${key}">${options.map(([value, text]) => `<option value="${value}" ${String(s[key]) === String(value) ? "selected" : ""}>${text}</option>`).join("")}</select></label>`;
    this.modal(
      "TUNE YOUR SETUP",
      "SETTINGS.",
      `<div class="settings-grid"><section><h3>VIDEO</h3>${select(
        "Quality",
        "quality",
        [
          ["low", "Low"],
          ["medium", "Medium"],
          ["high", "High"],
        ],
      )}${select("Resolution scale", "resolution", [
        [0.5, "50%"],
        [0.75, "75%"],
        [1, "100%"],
      ])}${select("Maximum FPS", "maxFps", [
        [60, "60"],
        [120, "120"],
        [144, "144"],
        [240, "240"],
        [0, "Unlimited"],
      ])}${check("Dynamic shadows", "shadows")}${check("Anti-aliasing¹", "antialias")}${check("FPS counter", "fps")}</section><section><h3>CONTROLS & AUDIO</h3>${range("Mouse sensitivity", "sensitivity", 0.1, 5, 0.1)}${range("Field of view", "fov", 70, 110, 1)}${check("Invert mouse", "invert")}${check("View bob", "bob")}${range("Master volume", "volume", 0, 1, 0.05)}${range("Effects volume", "effects", 0, 1, 0.05)}</section><section><h3>CROSSHAIR</h3>${range("Size", "crosshairSize", 2, 14, 1)}${range("Gap", "crosshairGap", 1, 12, 1)}${range("Thickness", "crosshairThickness", 1, 4, 1)}${range("Opacity", "crosshairOpacity", 0.2, 1, 0.1)}${check("Center dot", "crosshairDot")}${check("Dynamic spread", "dynamic")}<label class="setting"><span>Color</span><input data-setting="crosshairColor" type="color" value="${s.crosshairColor}"></label></section></div><p class="footnote">Saved automatically on this device. ¹ Anti-aliasing applies after refreshing the page. Low quality disables shadows and caps rendering resolution.</p><button class="solid-button" data-action="close">DONE <span>✓</span></button>`,
      true,
    );
    const controls = this.overlay.querySelector(
      ".settings-grid section:nth-child(2)",
    );
    controls.insertAdjacentHTML(
      "beforeend",
      `${check("Space to jump", "spaceJump")}${select(
        "Wheel jump",
        "wheelJump",
        [
          ["both", "Up + down"],
          ["up", "Up only"],
          ["down", "Down only"],
          ["off", "Off"],
        ],
      )}${select("Viewmodel motion", "viewmodelMotion", [
        ["off", "Off"],
        ["low", "Low"],
        ["normal", "Normal"],
      ])}${DEV_MODE ? check("Movement debug (F3)", "movementDebug") + check("Show colliders (F4)", "showColliders") + check("Show hitboxes (F5)", "showHitboxes") : ""}`,
    );
    this.overlay.querySelectorAll("[data-setting]").forEach((input) =>
      input.addEventListener("input", () => {
        const key = input.dataset.setting;
        s[key] =
          input.type === "checkbox"
            ? input.checked
            : [
                  "quality",
                  "crosshairColor",
                  "wheelJump",
                  "viewmodelMotion",
                ].includes(key)
              ? input.value
              : Number(input.value);
        const output = input.parentElement.querySelector("output");
        if (output) output.value = s[key];
        if (key === "showColliders" || key === "showHitboxes")
          this.game[key] = s[key];
        this.game.applySettings();
        this.applyCrosshair();
      }),
    );
  }
  applyCrosshair() {
    const s = this.settings,
      c = this.elements.crosshair;
    c.style.setProperty("--cross-color", s.crosshairColor);
    c.style.setProperty("--cross-size", s.crosshairSize + "px");
    c.style.setProperty("--cross-thickness", s.crosshairThickness + "px");
    c.style.opacity = s.crosshairOpacity;
    c.querySelector("b").style.display = s.crosshairDot ? "block" : "none";
  }
  hit(result) {
    this.hitTime = 0.22;
    this.elements.hitmarker.style.color = result.headshot
      ? "#f7b577"
      : "#ffffff";
    this.elements["hit-label"].textContent =
      `${result.headshot ? "HEADSHOT · " : ""}${result.damage} DAMAGE${result.killed ? " / ELIMINATED" : ""}`;
    this.labelTime = 1.1;
    if (result.killed) {
      this.feed.unshift({
        text: `YOU <span>${this.game.rifle.config.name} ${result.headshot ? "⌖" : ""}</span> ${result.target.name}`,
        time: 5,
      });
      this.feed = this.feed.slice(0, 4);
    }
  }
  toast(message) {
    const el = document.querySelector("#toast");
    el.textContent = message;
    el.classList.add("visible");
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => el.classList.remove("visible"), 4000);
  }
  killFeed(m) {
    const roster = this.game.network.roster;
    const name = (id) =>
      sanitizeName(roster.find((p) => p.id === id)?.name || "Player");
    this.feed.unshift({
      text: `${name(m.attacker)} <span>${WEAPONS[m.weapon].name} ${m.headshot ? "⌖" : ""}</span> ${name(m.victim)}`,
      time: 5,
    });
    this.feed = this.feed.slice(0, 4);
  }
  showGame() {
    this.menu.classList.add("hidden");
    this.hud.classList.remove("hidden");
    this.closeOverlay();
  }
  showMenu() {
    this.menu.classList.remove("hidden");
    this.hud.classList.add("hidden");
    this.closeOverlay();
  }
  update(dt, game) {
    this.updateMatch(game);
    const { player: p, rifle: r } = game,
      e = this.elements;
    const debug = document.querySelector("#movement-debug");
    debug.classList.toggle(
      "hidden",
      !(DEV_MODE && this.settings.movementDebug),
    );
    if (DEV_MODE && this.settings.movementDebug)
      debug.textContent = `MOVEMENT / F3\nVelocity: ${p.speed.toFixed(2)} m/s\nGrounded: ${p.grounded ? "YES" : "NO"}\nAir speed: ${p.grounded ? "—" : p.speed.toFixed(2)}\nFPS: ${game.fps}\nPosition: ${p.position.x.toFixed(1)}, ${p.position.y.toFixed(1)}, ${p.position.z.toFixed(1)}`;
    const secs =
      game.gameMode.id === "deathmatch"
        ? Math.max(
            0,
            Math.ceil(
              ((game.network.match?.endsAt || 0) -
                (game.network.serverTime || 0)) /
                1000,
            ),
          )
        : Math.floor(game.elapsed);
    if (DEV_MODE && this.settings.movementDebug)
      debug.textContent += `\nMAX: ${MOVEMENT.maxBhopSpeed}\nAIR ACCEL: ${MOVEMENT.airAcceleration}\nSTRAFE EFFICIENCY: ${(p.strafeEfficiency || 0).toFixed(0)}%\nF4 SHOW COLLIDERS: ${game.showColliders ? "ON" : "OFF"}\nF5 SHOW HITBOXES: ${game.showHitboxes ? "ON" : "OFF"}`;
    e.timer.textContent = `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
    e.fps.textContent = `${game.fps} FPS`;
    e.fps.style.display = this.settings.fps ? "" : "none";
    e.health.textContent = Math.ceil(p.health);
    e.armor.textContent = Math.ceil(p.armor);
    e.ammo.textContent = r.ammo;
    e.reserve.textContent = r.reserve;
    document.querySelector(".weapon-name").textContent = r.config.name;
    document.querySelector(".weapon-type").textContent = r.config.type;
    document.querySelector("#scope").classList.toggle("hidden", !r.scoped);
    document.querySelector("#scope-level").textContent =
      `0${r.zoom} / ${r.scopeFov || 0}°`;
    e.crosshair.classList.toggle("hidden", r.scoped);
    document
      .querySelectorAll("[data-slot]")
      .forEach((slot) =>
        slot.classList.toggle(
          "active",
          (game.gameMode.id === "deathmatch" && Number(slot.dataset.slot) === 0
            ? game.player.primary
            : Number(slot.dataset.slot)) === game.weapons.index,
        ),
      );
    e.ammo.style.color =
      r.ammo <= Math.ceil(r.config.magazine * 0.2) ? "#eea76c" : "";
    e["ammo-note"].textContent = r.infiniteReserve
      ? "∞ RESERVE AMMO"
      : "FINITE RESERVE AMMO";
    e["reload-status"].textContent =
      r.reloadRemaining > 0
        ? `RELOADING · ${r.reloadRemaining.toFixed(1)}s`
        : r.boltRemaining > 0
          ? `CYCLING BOLT · ${r.boltRemaining.toFixed(1)}s`
          : r.drawRemaining > 0
            ? "DRAWING WEAPON"
            : r.ammo === 0
              ? "MAGAZINE EMPTY · PRESS R"
              : "";
    e.crosshair.style.setProperty(
      "--cross-gap",
      this.settings.crosshairGap +
        (this.settings.dynamic ? r.spread * 300 : 0) +
        "px",
    );
    this.hitTime -= dt;
    this.labelTime -= dt;
    e.hitmarker.style.opacity = this.hitTime > 0 ? "1" : "0";
    e["hit-label"].style.opacity = this.labelTime > 0 ? "1" : "0";
    for (const entry of this.feed) entry.time -= dt;
    this.feed = this.feed.filter((entry) => entry.time > 0);
    const feedHTML = this.feed
      .map((entry) => `<div>${entry.text}</div>`)
      .join("");
    if (e.feed.innerHTML !== feedHTML) e.feed.innerHTML = feedHTML;
    e.sector.textContent =
      p.position.z > 15
        ? "SOUTH APPROACH"
        : p.position.x < -12
          ? "WEST TRANSFER / A"
          : p.position.x > 12
            ? "EAST LOADING / B"
            : "CENTRAL COURTYARD";
    if (game.world.id === "district")
      e.sector.textContent =
        p.position.z < -30
          ? "OLD STREET / CONSTRUCTION"
          : p.position.x < -16
            ? p.position.z < 0
              ? "WAREHOUSE"
              : "MARKET"
            : p.position.x > 16
              ? p.position.z < 0
                ? "GARAGE / UNDERPASS"
                : "COURTYARD"
              : "CENTRAL PLAZA";
    this.radarTime = (this.radarTime || 0) + dt;
    if (this.radarTime > 0.1) {
      this.radarTime = 0;
      this.drawRadar(game);
    }
    if (!e.scoreboard.classList.contains("hidden") && game.mode !== "online")
      e.scoreboard.innerHTML = `<span class="eyebrow">KESTREL / RANGE STATISTICS</span><h2>YOUR SESSION</h2><div class="stat-row"><span>ELIMINATIONS<strong>${p.kills}</strong></span><span>SHOTS FIRED<strong>${p.shots}</strong></span><span>ACCURACY<strong>${p.shots ? Math.round((p.hits / p.shots) * 100) : 0}%</strong></span></div><p>Targets respawn after 3 seconds. Release TAB to return.</p>`;
    document.querySelector(".session > span").textContent =
      game.gameMode.id === "deathmatch"
        ? "TIME LEFT"
        : game.mode === "online"
          ? `ROOM ${game.network.code}`
          : "FREE TRAINING";
    document.querySelector(".hud-brand small").textContent =
      game.mode === "online"
        ? game.gameMode.id.toUpperCase()
        : "PRACTICE RANGE";
    document.querySelector(".session > small").textContent =
      game.mode === "online"
        ? `${game.gameMode.id.toUpperCase()} · ${game.network.ping}ms`
        : "● RANGE ACTIVE";
    if (game.mode === "online") {
      e["ammo-note"].textContent = "SERVER CONFIRMED DAMAGE";
      if (!e.scoreboard.classList.contains("hidden"))
        this.updateOnlineScoreboard(game.network);
      if (DEV_MODE && this.settings.movementDebug)
        debug.textContent += `\nPING: ${game.network.ping}ms\nPACKETS IN / OUT: ${game.network.packetsIn} / ${game.network.packetsOut}\nSTATE UPDATES: ${game.network.snapshotHz} Hz\nSERVER PHYSICS: 120 Hz\nRX / TX: ${(game.network.bytesIn / 1024).toFixed(1)} / ${(game.network.bytesOut / 1024).toFixed(1)} KB`;
    }
  }
  updateOnlineScoreboard(network) {
    const signature =
      JSON.stringify(
        network.snapshots
          .at(-1)
          ?.players.map((p) => [p[0], p[16], p[17], p[31]]),
      ) +
      network.roster.map((p) => p.id + p.name).join("|") +
      network.ping;
    if (this.elements.scoreboard.dataset.roster === signature) return;
    this.elements.scoreboard.dataset.roster = signature;
    const el = this.elements.scoreboard;
    el.innerHTML =
      '<span class="eyebrow">ONLINE COMBAT</span><h2>LEADERBOARD</h2><table class="online-roster"><thead><tr><th>PLAYER</th><th>KILLS</th><th>DEATHS</th><th>PING</th></tr></thead><tbody></tbody></table><p>Release TAB to return.</p>';
    const body = el.querySelector("tbody");
    el.querySelector(".eyebrow").textContent =
      network.match?.mode === "deathmatch"
        ? "DEATHMATCH / DISTRICT"
        : "TACTICAL / COMBAT SANDBOX";
    const states = new Map(
      network.snapshots.at(-1)?.players.map((p) => [p[0], p]) || [],
    );
    for (const player of [...network.roster].sort(
      (a, b) => (states.get(b.id)?.[16] || 0) - (states.get(a.id)?.[16] || 0),
    )) {
      const row = document.createElement("tr");
      for (const value of [
        player.name + (player.id === network.id ? " (YOU)" : ""),
        states.get(player.id)?.[16] || 0,
        states.get(player.id)?.[17] || 0,
        player.id === network.id
          ? `${network.ping}ms`
          : `${states.get(player.id)?.[31] || 0}ms`,
      ]) {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.append(cell);
      }
      body.append(row);
    }
  }
  drawRadar(game) {
    const ctx = this.radar;
    ctx.clearRect(0, 0, 160, 160);
    ctx.fillStyle = "rgba(15,29,31,.8)";
    ctx.fillRect(0, 0, 160, 160);
    const { width, depth } = game.world.bounds;
    const tx = (x) => (x / width + 0.5) * 160,
      tz = (z) => (z / depth + 0.5) * 160;
    ctx.fillStyle = "#78877a";
    for (const b of game.world.colliders) {
      if (b.top > 0)
        ctx.fillRect(
          tx(b.minX),
          tz(b.minZ),
          ((b.maxX - b.minX) / width) * 160,
          ((b.maxZ - b.minZ) / depth) * 160,
        );
    }
    ctx.fillStyle = "#eda66d";
    for (const target of game.targets.list)
      if (target.alive && game.mode === "practice") {
        ctx.beginPath();
        ctx.arc(
          tx(target.group.position.x),
          tz(target.group.position.z),
          2.4,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    ctx.save();
    ctx.translate(tx(game.player.position.x), tz(game.player.position.z));
    ctx.rotate(-game.player.yaw);
    ctx.fillStyle = "#c4ffdf";
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(-3.5, 4);
    ctx.lineTo(3.5, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
