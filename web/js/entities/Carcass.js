// ====================================================
//  CARCASS.JS — Carcaça física de animal morto
// ====================================================

import { Entity } from './Entity.js';

/**
 * Carcaça física de animal morto em decomposição e mineralização.
 */
export class Carcass extends Entity {
  constructor(id, speciesName, x, y, r, c, remainingEnergy = 35.0, genes = null) {
    super(id, x, y);
    this.speciesName = speciesName || 'Carcaça';
    this.r = r;
    this.c = c;
    this.remainingEnergy = remainingEnergy;
    this.decayTimer = 0;
    this.maxDecayTimer = 250;
    this.genes = genes;
  }

  tick(cell) {
    this.decayTimer++;
    const decayLoss = 0.20;
    this.remainingEnergy -= decayLoss;

    if (cell) {
      cell.organicBiomass = Math.min(80.0, cell.organicBiomass + decayLoss * 0.85);
    }

    if (this.remainingEnergy <= 0 || this.decayTimer > this.maxDecayTimer) {
      this.alive = false;
      if (cell && cell.carcass === this) {
        cell.carcass = null;
      }
    }
  }

  consumeBite(amount) {
    const bite = Math.min(this.remainingEnergy, amount);
    this.remainingEnergy -= bite;
    if (this.remainingEnergy <= 0) {
      this.alive = false;
    }
    return bite;
  }
}
