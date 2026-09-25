import { Weapon } from "./Weapon.js";
import { Rifle } from "./Rifle.js";
import { WEAPONS } from "../config/WeaponConfig.js";

export class WeaponManager {
  constructor(audio) {
    this.weapons = [
      new Rifle(audio),
      new Weapon(audio, WEAPONS.r45),
      new Weapon(audio, WEAPONS.titan),
    ];
    this.index = 0;
    this.previousIndex = 0;
  }
  get current() {
    return this.weapons[this.index];
  }
  reset() {
    this.weapons.forEach((weapon) => weapon.reset());
    this.index = this.previousIndex = 0;
  }
  switchTo(index) {
    if (
      !Number.isInteger(index) ||
      !this.weapons[index] ||
      index === this.index
    )
      return false;
    this.current.holster();
    this.previousIndex = this.index;
    this.index = index;
    this.current.draw();
    return true;
  }
  previous() {
    return this.switchTo(this.previousIndex);
  }
  update(dt, player) {
    this.weapons.forEach((weapon, index) =>
      weapon.update(dt, player, index === this.index),
    );
  }
  setInfiniteReserve(value) {
    this.weapons.forEach((weapon) => {
      weapon.infiniteReserve = value;
    });
  }
}
