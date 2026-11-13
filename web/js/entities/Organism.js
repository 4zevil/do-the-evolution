// ====================================================
//  ORGANISM.JS — Organismo vivo com genoma, energia e ciclo de vida
// ====================================================

import { Entity } from './Entity.js';
import { Genome } from '../core/Genome.js';

/**
 * Organismo vivo provido de genoma, energia, taxa metabólica e ciclo de vida.
 */
export class Organism extends Entity {
  constructor(id, name, speciesName, x, y, initialEnergy, maxEnergy, genes = {}, customImages = {}) {
    super(id, x, y);
    this.name = name || 'Organismo';
    this.speciesName = speciesName || this.name;
    this.genes = genes instanceof Genome ? genes : new Genome(genes);
    this.energy = initialEnergy;
    this.maxEnergy = maxEnergy;
    this.age = 0;
    this.customImages = { ...(customImages || {}) };
  }

  consumeEnergy(amount) {
    this.energy = Math.max(0, this.energy - amount);
    if (this.energy <= 0) {
      this.alive = false;
    }
  }

  gainEnergy(amount) {
    this.energy = Math.min(this.maxEnergy, this.energy + amount);
  }

  ageOneTick() {
    this.age++;
  }

  isDead() {
    return !this.alive || this.energy <= 0;
  }
}
