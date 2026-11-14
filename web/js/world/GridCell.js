// ====================================================
//  GRIDCELL.JS — Modelo de Grade, Bioma e Solo (POO)
// ====================================================

export const BIOME_PROFILES = {
  tundra: {
    biomeType: 'tundra',
    localTempOffset: -0.55,
    waterRetention: 0.48,
    fertilityCap: 55,
    biomeColor: '#486b84',
    baseMoisture: 0.45
  },
  temperate: {
    biomeType: 'temperate',
    localTempOffset: 0.0,
    waterRetention: 0.78,
    fertilityCap: 120,
    biomeColor: '#2d6a3f',
    baseMoisture: 0.68
  },
  savanna: {
    biomeType: 'savanna',
    localTempOffset: 0.35,
    waterRetention: 0.42,
    fertilityCap: 75,
    biomeColor: '#787d32',
    baseMoisture: 0.38
  },
  desert: {
    biomeType: 'desert',
    localTempOffset: 0.60,
    waterRetention: 0.20,
    fertilityCap: 38,
    biomeColor: '#b58d4c',
    baseMoisture: 0.20
  },
  wetland: {
    biomeType: 'wetland',
    localTempOffset: 0.05,
    waterRetention: 0.94,
    fertilityCap: 105,
    biomeColor: '#256054',
    baseMoisture: 0.88
  },
  water: {
    biomeType: 'water',
    localTempOffset: -0.05,
    waterRetention: 1.0,
    fertilityCap: 0,
    biomeColor: '#1a4a7a',
    baseMoisture: 1.0
  },
  rocky: {
    biomeType: 'rocky',
    localTempOffset: -0.15,
    waterRetention: 0.22,
    fertilityCap: 25,
    biomeColor: '#52565a',
    baseMoisture: 0.22
  }
};

const BIOME_ALIASES = {
  fertile: 'temperate',
  temperate_forest: 'temperate',
  arid: 'desert',
  dry: 'desert',
  frozen: 'tundra',
  random: 'temperate',
  islands: 'temperate'
};

export class GridCell {
  constructor(r, c, size = 26, biome = 'temperate', config = {}) {
    this.r = r;
    this.c = c;
    this.size = size;
    this.x = (c + 0.5) * size;
    this.y = (r + 0.5) * size;

    const profile = GridCell.resolveBiomeProfile(biome);

    this.biome = config.biome ?? biome;
    this.biomeType = config.biomeType ?? profile.biomeType;
    this.localTempOffset = config.localTempOffset ?? profile.localTempOffset;
    this.waterRetention = config.waterRetention ?? profile.waterRetention;
    this.fertilityCap = config.fertilityCap ?? profile.fertilityCap;
    this.biomeColor = config.biomeColor ?? profile.biomeColor;

    this.elevation = config.elevation ?? 0.5;
    this.moisture = config.moisture ?? profile.baseMoisture;
    this.maxSoilNitrogen = config.maxSoilNitrogen ?? this.fertilityCap;
    this.soilNitrogen = config.soilNitrogen ?? (this.isHabitable() ? this.fertilityCap * 0.5 : 0);
    this.organicBiomass = config.organicBiomass ?? 0.0;
    this.plant = null;
    this.carcass = null;
    this.cachedColor = config.cachedColor ?? this.biomeColor;

    // Rastreia último bioma aplicado para detectar mutações diretas em cell.biome
    this._appliedBiome = this.biome;
  }

  static resolveBiomeProfile(biome) {
    if (!biome) return BIOME_PROFILES.temperate;
    const key = BIOME_ALIASES[biome] || biome;
    return BIOME_PROFILES[key] || BIOME_PROFILES.temperate;
  }

  applyBiome(biome, options = {}) {
    const profile = GridCell.resolveBiomeProfile(biome);
    const { preservePhysicalState = false, overrides = {} } = options;

    this.biome = overrides.biome ?? biome;
    this.biomeType = overrides.biomeType ?? profile.biomeType;
    this.localTempOffset = overrides.localTempOffset ?? profile.localTempOffset;
    this.waterRetention = overrides.waterRetention ?? profile.waterRetention;
    this.fertilityCap = overrides.fertilityCap ?? profile.fertilityCap;
    this.maxSoilNitrogen = overrides.maxSoilNitrogen ?? this.fertilityCap;
    this.biomeColor = overrides.biomeColor ?? profile.biomeColor;
    this.cachedColor = overrides.cachedColor ?? this.biomeColor;

    if (!preservePhysicalState) {
      this.moisture = overrides.moisture ?? profile.baseMoisture;
      this.soilNitrogen = overrides.soilNitrogen ?? (this.isHabitable() ? this.fertilityCap * 0.5 : 0);
    } else {
      this.soilNitrogen = Math.min(this.fertilityCap, this.soilNitrogen);
    }

    this._appliedBiome = this.biome;
    return this;
  }

  regenerate(curSeason) {
    if (this.biome && this.biome !== this._appliedBiome) {
      this.applyBiome(this.biome, { preservePhysicalState: true });
    }

    if (this.isHabitable()) {
      const retention = this.waterRetention ?? 0.5;
      const rainGain = 0.02 * curSeason.rain * retention;
      const evaporation = 0.005 * (1.2 - retention * 0.7);
      const minMoisture = Math.max(0.08, retention * 0.35);
      const maxMoisture = Math.min(1.0, Math.max(0.20, retention + 0.15));

      this.moisture = Math.min(
        maxMoisture,
        Math.max(minMoisture, this.moisture + rainGain - evaporation)
      );

      const nitrogenCap = this.fertilityCap ?? this.maxSoilNitrogen;
      this.maxSoilNitrogen = nitrogenCap;

      if (this.organicBiomass > 0.05) {
        const minRate = this.organicBiomass * 0.04 * this.moisture;
        this.organicBiomass -= minRate;
        this.soilNitrogen = Math.min(nitrogenCap, this.soilNitrogen + minRate * 0.9);
      } else if (this.soilNitrogen < nitrogenCap) {
        this.soilNitrogen = Math.min(nitrogenCap, this.soilNitrogen + 0.12 * curSeason.rain);
      }
    }
  }

  consumeNitrogen(amount) {
    this.soilNitrogen = Math.max(0, this.soilNitrogen - amount);
  }

  addOrganicBiomass(amount) {
    this.organicBiomass = Math.min(80.0, this.organicBiomass + amount);
  }

  isHabitable() {
    return this.biome !== 'water' && this.biomeType !== 'water';
  }

  applyNitrogenDecay(amount) {
    this.soilNitrogen = Math.max(0, this.soilNitrogen - amount);
  }

  replenishNitrogen(amount) {
    const cap = this.fertilityCap ?? this.maxSoilNitrogen ?? 100;
    this.soilNitrogen = Math.min(cap, this.soilNitrogen + amount);
  }

  applyMoistureDecay(amount) {
    this.moisture = Math.max(0, this.moisture - amount);
  }

  replenishMoisture(amount) {
    this.moisture = Math.min(1.0, this.moisture + amount);
  }

  applyInfection(probability) {
    if (Math.random() < probability) this.infected = true;
  }
}
