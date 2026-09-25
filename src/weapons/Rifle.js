import { Weapon } from "./Weapon.js";
import { WEAPONS } from "../config/WeaponConfig.js";

// Preserve the original rifle entry point while sharing its behavior with new weapons.
export const RIFLE = WEAPONS.ar4;
export class Rifle extends Weapon {
  constructor(audio) {
    super(audio, RIFLE);
  }
}
