import * as THREE from "three";
import { KestrelMap } from "../maps/KestrelMap.js";
import { Player } from "../player/Player.js";
import { InputManager } from "../utils/InputManager.js";
import { loadSettings, saveSettings } from "../utils/Settings.js";
import { AudioManager } from "../audio/AudioManager.js";
import { Targets } from "../combat/Targets.js";
import { Shooting } from "../combat/Shooting.js";
import { WeaponManager } from "../weapons/WeaponManager.js";
import { ViewModel } from "../weapons/ViewModel.js";
import { UI } from "../ui/UI.js";
import { DEV_MODE } from "../config/GameConfig.js";
import { NetworkClient } from "../network/NetworkClient.js";
import { RemotePlayers } from "../network/RemotePlayers.js";
import { stateFromSnapshot } from "../network/Protocol.js";
import { DebugGeometry } from "./DebugGeometry.js";
import { DistrictMap } from "../maps/DistrictMap.js";
import { createMode } from "../modes/GameMode.js";
import { loadSkins, applySkin } from "../weapons/Skins.js";

export class Game {
  constructor(canvas) {
    this.settings = loadSettings();
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: this.settings.antialias,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor("#b8ced0");
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.22;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.autoClear = false;
    this.renderer.info.autoReset = false;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#b8ced0");
    this.scene.fog = new THREE.Fog("#b8ced0", 55, 125);
    this.camera = new THREE.PerspectiveCamera(this.settings.fov, 1, 0.08, 180);
    this.scene.add(new THREE.HemisphereLight("#e6f0f0", "#848369", 2.4));
    this.sun = new THREE.DirectionalLight("#fff0c9", 3.1);
    this.sun.position.set(-25, 42, 20);
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -40;
    this.sun.shadow.camera.right = 40;
    this.sun.shadow.camera.top = 40;
    this.sun.shadow.camera.bottom = -40;
    this.sun.shadow.camera.far = 110;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun);
    this.world = new KestrelMap(this.scene);
    document.querySelector("#loading progress").value = 55;
    this.audio = new AudioManager(this.settings);
    this.player = new Player(this.camera, this.world, this.audio);
    this.targets = new Targets(this.scene);
    this.weapons = new WeaponManager(this.audio);
    this.viewModel = new ViewModel();
    this.skins = loadSkins();
    this.applySkins();
    this.input = new InputManager(
      canvas,
      (locked) => this.lockChanged(locked),
      (action) => this.action(action),
      this.settings,
    );
    this.ui = new UI(this, this.settings);
    this.remotePlayers = new RemotePlayers(this.scene);
    if (DEV_MODE)
      this.debugGeometry = new DebugGeometry(this.scene, this.world);
    this.network = new NetworkClient(this);
    this.mode = "practice";
    this.gameMode = createMode("practice");
    this.shooting = new Shooting(
      this.scene,
      this.world,
      this.targets,
      this.audio,
      (result) => this.ui.hit(result),
    );
    this.started = false;
    this.paused = true;
    this.elapsed = 0;
    this.fps = 0;
    this.lastTime = 0;
    this.lastRender = 0;
    this.accumulator = 0;
    this.fpsFrames = 0;
    this.fpsTime = 0;
    this.applySettings();
    window.addEventListener("resize", () => this.resize());
    canvas.addEventListener("click", () => {
      if (this.started && !this.input.locked) this.resume();
    });
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      this.reportFatal?.(new Error("WebGL context lost"));
    });
    this.scene.updateMatrixWorld(true);
    this.menuCamera(0);
    this.renderer.compile(this.scene, this.camera);
    document.querySelector("#loading progress").value = 100;
    this.render(0);
    document.querySelector("#loading").remove();
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }
  applySettings() {
    saveSettings(this.settings);
    this.camera.fov = this.rifle.scoped
      ? this.rifle.scopeFov
      : this.settings.fov;
    this.camera.updateProjectionMatrix();
    const shadows = this.settings.shadows && this.settings.quality !== "low";
    this.renderer.shadowMap.enabled = shadows;
    this.sun.castShadow = shadows;
    this.renderer.shadowMap.needsUpdate = true;
    this.resize();
  }
  resize() {
    const w = window.innerWidth,
      h = window.innerHeight;
    const cap =
      this.settings.quality === "low"
        ? 1
        : this.settings.quality === "high"
          ? 1.5
          : 1.25;
    this.renderer.setPixelRatio(
      Math.min(devicePixelRatio, cap) * this.settings.resolution,
    );
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.viewModel.camera.aspect = w / h;
    this.viewModel.camera.updateProjectionMatrix();
  }
  start() {
    clearTimeout(this.practiceTimer);
    this.network.disconnect();
    this.remotePlayers.clear();
    this.mode = "practice";
    this.gameMode = createMode("practice");
    this.setMap("kestrel");
    this.started = true;
    this.elapsed = 0;
    this.player.reset();
    this.weapons.reset();
    this.targets.reset();
    this.targets.setVisible(true);
    this.ui.feed = [];
    this.player.update(0, this.input, this.settings);
    this.ui.showGame();
    this.resume();
  }
  resume() {
    // Pointer lock is requested directly from the user's click before asynchronous work.
    this.input
      .lock()
      .catch(() =>
        this.ui.toast(
          "Mouse capture was blocked. Click RESUME again, or open the game in a desktop browser tab.",
        ),
      );
    this.audio
      .unlock()
      .catch(() =>
        this.ui.toast("Audio unavailable. You can continue playing silently."),
      );
  }
  lockChanged(locked) {
    if (this.fatal) return;
    this.paused = !locked;
    this.accumulator = 0;
    if (!this.started) return;
    if (this.network.match?.ended) {
      this.ui.showMatchOver();
      return;
    }
    if (locked) {
      this.ui.showGame();
      this.input.clear();
    } else {
      this.ui.elements.scoreboard.classList.add("hidden");
      this.ui.showPause();
    }
  }
  restart() {
    if (this.mode === "online") {
      this.ui.toast("Leave and rejoin to reset your online spawn.");
      return;
    }
    this.start();
  }
  home() {
    this.audio.suspend();
    clearTimeout(this.practiceTimer);
    this.network.disconnect();
    this.remotePlayers.clear();
    this.mode = "practice";
    this.gameMode = createMode("practice");
    this.setMap("kestrel");
    this.targets.setVisible(true);
    this.started = false;
    this.paused = true;
    document.exitPointerLock();
    this.input.clear();
    this.ui.showMenu();
  }
  action(action) {
    if (action === "lockError") {
      this.ui.toast(
        "Click RESUME to capture your mouse. If embedded, open this page in its own browser tab.",
      );
      return;
    }
    if (action === "scoreboardOff") {
      this.ui.elements.scoreboard.classList.add("hidden");
      return;
    }
    if (!this.started || this.paused) return;
    if (["Digit1", "Digit2", "Digit3"].includes(action)) {
      const index = Number(action.slice(-1)) - 1;
      if (this.gameMode.id !== "deathmatch") this.weapons.switchTo(index);
      else if (index < 2)
        this.weapons.switchTo(index === 0 ? this.player.primary : 1);
    }
    if (action === "KeyQ") {
      if (this.gameMode.id === "deathmatch")
        this.weapons.switchTo(
          this.weapons.index === 1 ? this.player.primary : 1,
        );
      else this.weapons.previous();
    }
    if (action === "scope") {
      this.rifle.cycleScope();
      if (this.network.connected) this.network.action("scope");
    }
    if (action === "F3" && DEV_MODE) {
      this.settings.movementDebug = !this.settings.movementDebug;
      saveSettings(this.settings);
    }
    if (action === "F4" && DEV_MODE) this.showColliders = !this.showColliders;
    if (action === "F5" && DEV_MODE) this.showHitboxes = !this.showHitboxes;
    if (action === "KeyR") {
      this.rifle.reload();
      if (this.network.connected) this.network.action("reload");
    }
    if (action === "Tab")
      this.ui.elements.scoreboard.classList.remove("hidden");
    if (action === "F2") {
      if (this.mode === "online") {
        this.ui.toast("Range tools are available in local practice.");
        return;
      }
      document.exitPointerLock();
      this.practiceTimer = setTimeout(() => {
        if (this.started && this.mode === "practice") this.ui.showPractice();
      }, 50);
    }
  }
  update(dt) {
    this.elapsed += dt;
    if (this.player.alive && !this.network.match?.ended)
      this.player.update(dt, this.input, this.settings, this.rifle);
    else this.input.clear();
    this.weapons.update(dt, this.player);
    if (this.mode === "practice") this.targets.update(dt);
    this.scene.updateMatrixWorld(true);
    const firePressed = this.input.consumeFire();
    if (
      this.mode === "practice" &&
      (firePressed || (this.rifle.config.automatic && this.input.fire)) &&
      this.player.alive
    )
      this.shooting.fire(this.camera, this.player, this.rifle);
    if (this.mode === "online") {
      this.network.record(
        this.player.alive
          ? this.player.lastCommand
          : { x: 0, z: 0, yaw: this.player.yaw },
        this.player.pitch,
        this.weapons.index,
        dt,
      );
      if (
        this.player.alive &&
        !this.network.match?.ended &&
        (firePressed || (this.rifle.config.automatic && this.input.fire)) &&
        this.rifle.fire()
      ) {
        this.player.shots++;
        this.network.action("fire");
        this.player.pitch = Math.min(
          1.48,
          this.player.pitch + this.rifle.config.cameraKick,
        );
      }
    }
    this.shooting.update(dt);
    if (
      ![
        this.player.position.x,
        this.player.position.y,
        this.player.position.z,
        this.player.velocity.x,
        this.player.velocity.y,
        this.player.velocity.z,
        this.player.yaw,
        this.player.pitch,
      ].every(Number.isFinite)
    )
      throw new Error("Non-finite player simulation state");
  }
  menuCamera(time) {
    this.camera.position.set(22 + Math.sin(time * 0.025) * 1.4, 12, 27);
    this.camera.lookAt(-7, 1, -9);
  }
  render(time) {
    this.debugGeometry?.update(
      this.player,
      this.remotePlayers,
      this.showColliders,
      this.showHitboxes,
    );
    if (this.network.connected)
      this.remotePlayers.update(this.network.snapshots, performance.now());
    if (!this.started) this.menuCamera(time);
    const fov =
      this.started && this.rifle.scoped
        ? this.rifle.scopeFov
        : this.settings.fov;
    if (this.camera.fov !== fov) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    this.renderer.info.reset();
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    if (this.started && this.player.alive) {
      this.viewModel.update(time, this.rifle, this.player, this.settings);
      if (!this.rifle.scoped) {
        this.renderer.clearDepth();
        this.renderer.render(this.viewModel.scene, this.viewModel.camera);
      }
    }
  }
  // Existing HUD and test integrations continue to refer to the equipped weapon as rifle.
  get rifle() {
    return this.weapons.current;
  }
  frame(ms) {
    if (this.fatal) return;
    this.raf = requestAnimationFrame(this.frame);
    const delta = Math.min((ms - this.lastTime) / 1000, 0.1);
    this.lastTime = ms;
    if (this.started && (!this.paused || this.network.connected)) {
      this.accumulator += delta;
      // Simulation has a fixed timestep; rendering can run at a different frame rate.
      while (this.accumulator >= 1 / 120) {
        this.update(1 / 120);
        this.accumulator -= 1 / 120;
      }
    }
    const limit = this.settings.maxFps || 1000;
    if (ms - this.lastRender < 1000 / limit - 0.5) return;
    const renderDt = Math.min((ms - this.lastRender) / 1000, 0.1);
    this.lastRender = ms;
    this.render(ms / 1000);
    this.fpsFrames++;
    this.fpsTime += renderDt;
    if (this.fpsTime >= 0.5) {
      this.fps = Math.round(this.fpsFrames / this.fpsTime);
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }
    if (this.started)
      this.ui.update(
        this.paused && !this.network.connected ? 0 : renderDt,
        this,
      );
  }
  async joinOnline(options) {
    try {
      const welcome = await this.network.connect({
        ...options,
        skins: this.skins,
      });
      this.gameMode = createMode(welcome.match.mode);
      this.setMap(welcome.match.map);
      this.player.reset();
      this.weapons.reset();
      this.weapons.setInfiniteReserve(false);
      this.network.life = welcome.state[25];
      this.player.primary = welcome.state[29];
      this.weapons.switchTo(welcome.state[12]);
      this.mode = "online";
      this.started = true;
      this.paused = true;
      this.elapsed = 0;
      const state = stateFromSnapshot(welcome.state);
      this.player.position.set(
        state.position.x,
        state.position.y,
        state.position.z,
      );
      this.player.yaw = welcome.state[7];
      this.targets.setVisible(false);
      this.ui.feed = [];
      this.remotePlayers.syncRoster(welcome.roster, welcome.id);
      this.ui.showGame();
      this.ui.showConnected(welcome.code);
    } catch (error) {
      if (error.name !== "AbortError") this.ui.showOnline(error.message);
    }
  }
  connectionLost() {
    this.audio.suspend();
    this.remotePlayers.clear();
    this.started = false;
    this.paused = true;
    this.mode = "practice";
    this.gameMode = createMode("practice");
    this.setMap("kestrel");
    this.targets.setVisible(true);
    document.exitPointerLock();
    this.input.clear();
    this.ui.showMenu();
    this.ui.showOnline(
      "Disconnected. The server stopped or the connection was interrupted. Rejoin with the room code.",
    );
  }
  setMap(id) {
    if (this.world.id === id) return;
    this.debugGeometry?.dispose();
    this.world.dispose();
    this.world =
      id === "district"
        ? new DistrictMap(this.scene)
        : new KestrelMap(this.scene);
    this.player.world = this.world;
    this.shooting.world = this.world;
    for (const effect of this.shooting.effects) {
      effect.life = 0;
      effect.mesh.visible = false;
    }
    if (DEV_MODE)
      this.debugGeometry = new DebugGeometry(this.scene, this.world);
    this.scene.updateMatrixWorld(true);
  }
  applySkins() {
    for (const [id, model] of Object.entries(this.viewModel.models))
      applySkin(model.group, this.skins[id]);
  }
  previewWeapon(id, canvas) {
    const width = 640,
      height = 300,
      target = new THREE.WebGLRenderTarget(width, height),
      camera = new THREE.OrthographicCamera(-1, 1, 0.47, -0.47, 0.01, 10);
    target.texture.colorSpace = THREE.SRGBColorSpace;
    camera.position.set(0, 0, 2);
    for (const [key, model] of Object.entries(this.viewModel.models))
      model.group.visible = key === id;
    const group = this.viewModel.models[id].group;
    group.position.set(0.08, 0.02, 0);
    group.rotation.set(0.08, -1.3, 0);
    group.scale.setScalar(1);
    group.traverse((o) => {
      if (o.userData.noSkin) o.visible = false;
    });
    this.viewModel.models[id].flash.visible = false;
    this.renderer.setRenderTarget(target);
    this.renderer.setClearColor("#203333");
    this.renderer.clear();
    this.renderer.render(this.viewModel.scene, camera);
    const pixels = new Uint8Array(width * height * 4);
    this.renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d"),
      data = ctx.createImageData(width, height);
    for (let y = 0; y < height; y++)
      data.data.set(
        pixels.subarray((height - y - 1) * width * 4, (height - y) * width * 4),
        y * width * 4,
      );
    ctx.putImageData(data, 0, 0);
    this.renderer.setRenderTarget(null);
    this.renderer.setClearColor("#b8ced0");
    target.dispose();
    group.traverse((o) => {
      if (o.userData.noSkin) o.visible = true;
    });
  }
}
