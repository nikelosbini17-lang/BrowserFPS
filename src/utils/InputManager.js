export class InputManager {
  constructor(canvas, onLockChange, onAction, settings) {
    this.canvas = canvas;
    this.settings = settings;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.fire = false;
    this.locked = false;
    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === canvas;
      this.clear();
      onLockChange(this.locked);
    });
    document.addEventListener("pointerlockerror", () => onAction("lockError"));
    window.addEventListener("blur", () => {
      this.clear();
      if (this.locked) document.exitPointerLock();
    });
    document.addEventListener("keydown", (e) => {
      if (!this.locked) return;
      if (
        [
          "Space",
          "Tab",
          "F2",
          "F3",
          "F4",
          "F5",
          "ControlLeft",
          "ControlRight",
          "KeyW",
          "KeyA",
          "KeyS",
          "KeyD",
        ].includes(e.code)
      )
        e.preventDefault();
      this.keys.add(e.code);
      if (!e.repeat && e.code === "Space" && this.settings.spaceJump !== false)
        this.jumpPressed = true;
      if (!e.repeat) this.pressed.add(e.code);
      if (!e.repeat) onAction(e.code);
    });
    document.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
      if (e.code === "Tab") onAction("scoreboardOff");
    });
    document.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      this.mouseX += e.movementX;
      this.mouseY += e.movementY;
    });
    canvas.addEventListener("mousedown", (e) => {
      if (this.locked && e.button === 2) onAction("scope");
      if (this.locked && e.button === 0) {
        this.fire = true;
        this.firePressed = true;
      }
    });
    document.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.fire = false;
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener(
      "wheel",
      (e) => {
        if (!this.locked) return;
        e.preventDefault();
        const binding = this.settings.wheelJump;
        if (
          binding === "both" ||
          (binding === "up" && e.deltaY < 0) ||
          (binding === "down" && e.deltaY > 0)
        )
          this.jumpPressed = true;
      },
      { passive: false },
    );
  }
  async lock() {
    try {
      await this.canvas.requestPointerLock({ unadjustedMovement: true });
    } catch {
      await this.canvas.requestPointerLock();
    }
  }
  clear() {
    this.keys.clear();
    this.pressed.clear();
    this.fire = false;
    this.firePressed = false;
    this.jumpPressed = false;
    this.mouseX = this.mouseY = 0;
  }
  consumeFire() {
    const pressed = this.firePressed;
    this.firePressed = false;
    return pressed;
  }
  consumeJump() {
    const pressed = this.jumpPressed;
    this.jumpPressed = false;
    return pressed;
  }
  consumePressed(code) {
    const pressed = this.pressed.has(code);
    this.pressed.delete(code);
    return pressed;
  }
  down(...codes) {
    return codes.some((code) => this.keys.has(code));
  }
  consumeLook() {
    const result = [this.mouseX, this.mouseY];
    this.mouseX = this.mouseY = 0;
    return result;
  }
}
