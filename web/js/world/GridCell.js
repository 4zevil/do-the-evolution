// ====================================================
//  GRIDCELL.JS — Modelo de Grade e Solo (POO)
// ====================================================

export class GridCell {
  constructor(r, c, size = 26, biome = 'fertile') {
    this.r = r;
    this.c = c;
    this.size = size;
    this.x = (c + 0.5) * size;
    this.y = (r + 0.5) * size;
    this.biome = biome;
    this.elevation = 0.5;
    this.moisture = 0.5;
    this.maxSoilNitrogen = 100;
    this.soilNitrogen = 30;
    this.organicBiomass = 0.0;
    this.plant = null;
    this.carcass = null;
    this.cachedColor = null;
  }

  regenerate(curSeason) {
    if (this.biome !== 'water') {
      this.moisture = Math.min(1.0, Math.max(0.12, this.moisture + 0.02 * curSeason.rain - 0.005));
      if (this.organicBiomass > 0.05) {
        const minRate = this.organicBiomass * 0.04 * this.moisture;
        this.organicBiomass -= minRate;
        this.soilNitrogen = Math.min(this.maxSoilNitrogen, this.soilNitrogen + minRate * 0.9);
      } else if (this.soilNitrogen < this.maxSoilNitrogen) {
        this.soilNitrogen = Math.min(this.maxSoilNitrogen, this.soilNitrogen + 0.12 * curSeason.rain);
      }
    }
  }

  consumeNitrogen(amount) {
    this.soilNitrogen = Math.max(0, this.soilNitrogen - amount);
  }

  addOrganicBiomass(amount) {
    this.organicBiomass = Math.min(80.0, this.organicBiomass + amount);
  }

  // Métodos de comportamento adicionados (semântica idêntica)
  isHabitable() { return this.biome !== 'water'; }
  applyNitrogenDecay(amount) { this.soilNitrogen = Math.max(0, this.soilNitrogen - amount); }
  replenishNitrogen(amount) { this.soilNitrogen = Math.min(100, this.soilNitrogen + amount); }
  applyMoistureDecay(amount) { this.moisture = Math.max(0, this.moisture - amount); }
  replenishMoisture(amount) { this.moisture = Math.min(1.0, this.moisture + amount); }
  applyInfection(probability) {
    if (Math.random() < probability) this.infected = true;
  }
}
