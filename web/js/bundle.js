// ====================================================
// BUNDLE POO (Compativel com file:/// e http://)
// ====================================================

// --- core/constants.js ---
// ====================================================
//  CONSTANTS.JS — Constantes globais da simulação
// ====================================================

const SEASONS = [
  { name: 'Primavera', icon: '🌸', temp: 0.0, rain: 1.5, sunlight: 1.4, thermalCost: 1.0 },
  { name: 'Verão',     icon: '☀️', temp: 0.8, rain: 0.6, sunlight: 1.7, thermalCost: 1.2 },
  { name: 'Outono',    icon: '🍂', temp: -0.2, rain: 1.1, sunlight: 0.9, thermalCost: 1.0 },
  { name: 'Inverno',   icon: '❄️', temp: -0.7, rain: 0.5, sunlight: 0.6, thermalCost: 1.35 }
];

const HARD_CRASH_FAILSAFE = 600;

const SPECIES_PALETTE = [
  '#58a6ff', '#3fb950', '#ffa657', '#d2a8ff', '#f78166',
  '#79c0ff', '#56d364', '#e3b341', '#f0883e', '#db61a2',
  '#2ea043', '#388bfd', '#bc8cff', '#ff7b72', '#238636'
];


// --- core/Vector2D.js ---
// ====================================================
//  VECTOR2D.JS — Value Object para coordenadas e vetores bidimensionais
// ====================================================

/**
 * Value Object para coordenadas e vetores bidimensionais.
 */
class Vector2D {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  set(x, y) { this.x = x; this.y = y; return this; }
  add(v) { this.x += v.x; this.y += v.y; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; return this; }
  mult(n) { this.x *= n; this.y *= n; return this; }
  div(n) { if (n !== 0) { this.x /= n; this.y /= n; } return this; }
  mag() { return Math.hypot(this.x, this.y); }
  dist(v) { return Math.hypot(this.x - v.x, this.y - v.y); }
  heading() { return Math.atan2(this.y, this.x); }
  normalize() {
    const m = this.mag();
    if (m > 0) this.div(m);
    return this;
  }
  clone() { return new Vector2D(this.x, this.y); }
}


// --- core/Genome.js ---
// ====================================================
//  GENOME.JS — Genoma quantitativo de organismos vivos
// ====================================================

/**
 * Genoma quantitativo de organismos vivos.
 * Encapsula cálculo de distância genética, mutação e especiação.
 */
class Genome {
  constructor(genes = {}) {
    // Genes animais
    this.size = genes.size ?? 0.5;
    this.speed = genes.speed ?? 0.5;
    this.perception = genes.perception ?? 0.5;
    this.gestation = genes.gestation ?? 0.4;
    this.offspringCount = genes.offspringCount ?? 0.4;
    this.aggression = genes.aggression ?? 0.3;
    this.health = genes.health ?? 0.5;
    this.thermal = genes.thermal ?? 0.0;
    this.aquatic = genes.aquatic ?? 0.15;
    this.colorHue = genes.colorHue ?? 120;

    // Genes vegetais
    this.height = genes.height ?? 0.5;
    this.defense = genes.defense ?? 0.3;
    this.rootEfficiency = genes.rootEfficiency ?? 0.5;
    this.growthSpeed = genes.growthSpeed ?? 0.5;
    this.fruitAttraction = genes.fruitAttraction ?? 0.4;
    this.parasiteResistance = genes.parasiteResistance ?? 0.4;

    // Dieta trófica
    if (genes.diet) {
      this.diet = {
        meat: genes.diet.meat ?? 0.05,
        plant: genes.diet.plant ?? 0.85,
        carcass: genes.diet.carcass ?? 0.10
      };
    } else {
      this.diet = { meat: 0.05, plant: 0.85, carcass: 0.10 };
    }
  }

  static getGeneticDistance(genesA, genesB) {
    const keys = ['size', 'speed', 'perception', 'gestation', 'offspringCount', 'aggression', 'health'];
    let sumSq = 0;
    keys.forEach(k => {
      const diff = (genesA[k] || 0.5) - (genesB[k] || 0.5);
      sumSq += diff * diff;
    });

    const dietDiffMeat = Math.abs((genesA.diet?.meat || 0) - (genesB.diet?.meat || 0));
    const dietDiffPlant = Math.abs((genesA.diet?.plant || 0) - (genesB.diet?.plant || 0));
    const dietDiffCarcass = Math.abs((genesA.diet?.carcass || 0) - (genesB.diet?.carcass || 0));
    sumSq += (dietDiffMeat * dietDiffMeat + dietDiffPlant * dietDiffPlant + dietDiffCarcass * dietDiffCarcass);

    return Math.sqrt(sumSq / (keys.length + 3));
  }

  static evaluateAnimalSpeciation(childGenes, founderGenes) {
    const traits = [
      { key: 'size', name: 'Porte', threshold: 0.28 },
      { key: 'speed', name: 'Velocidade', threshold: 0.28 },
      { key: 'perception', name: 'Visão', threshold: 0.30 },
      { key: 'thermal', name: 'Clima', threshold: 0.35 }
    ];

    const dietMeatDiff = Math.abs((childGenes.diet?.meat || 0) - (founderGenes.diet?.meat || 0));
    if (dietMeatDiff >= 0.28) {
      const desc = childGenes.diet.meat > founderGenes.diet.meat ? 'Predador' : 'Herbívoro';
      return { diverged: true, traitName: 'Dieta', desc: desc };
    }

    for (let t of traits) {
      const diff = Math.abs((childGenes[t.key] || 0) - (founderGenes[t.key] || 0));
      if (diff >= t.threshold) {
        let desc = childGenes[t.key] > founderGenes[t.key] ? 'Superior' : 'Reduzido';
        if (t.key === 'size') desc = childGenes[t.key] > founderGenes[t.key] ? 'Gigante' : 'Pigmeu';
        if (t.key === 'thermal') desc = childGenes[t.key] > founderGenes[t.key] ? 'Tropical' : 'Polar';
        if (t.key === 'speed') desc = childGenes[t.key] > founderGenes[t.key] ? 'Veloz' : 'Robusto';
        return { diverged: true, traitName: t.name, desc: desc };
      }
    }

    const dist = Genome.getGeneticDistance(childGenes, founderGenes);
    if (dist >= 0.28) {
      const desc = (childGenes.diet?.meat || 0) > 0.5 ? 'Predador' : 'Herbívoro';
      return { diverged: true, traitName: 'Genoma Geral', desc: desc };
    }

    return { diverged: false };
  }

  static evaluatePlantSpeciation(childGenes, founderGenes) {
    const traits = [
      { key: 'defense', name: 'Defesa', threshold: 0.28, high: 'Espinhosa', low: 'Indefesa' },
      { key: 'height', name: 'Porte', threshold: 0.28, high: 'Gigante', low: 'Rasteira' },
      { key: 'rootEfficiency', name: 'Raiz', threshold: 0.30, high: 'Árida', low: 'Aquática' },
      { key: 'growthSpeed', name: 'Ciclo', threshold: 0.28, high: 'Pioneira', low: 'Tardia' },
      { key: 'thermal', name: 'Clima', threshold: 0.32, high: 'Tropical', low: 'Boreal' }
    ];

    for (let t of traits) {
      const diff = (childGenes[t.key] || 0) - (founderGenes[t.key] || 0);
      if (Math.abs(diff) >= t.threshold) {
        const desc = diff > 0 ? t.high : t.low;
        return { diverged: true, traitName: t.name, desc: desc };
      }
    }
    return { diverged: false };
  }

  static mutateAndNormalizeDiet(parentDiet) {
    const newDiet = {
      meat: Math.max(0.01, (parentDiet.meat ?? 0.33) + (Math.random() * 0.14 - 0.07)),
      plant: Math.max(0.01, (parentDiet.plant ?? 0.33) + (Math.random() * 0.14 - 0.07)),
      carcass: Math.max(0.01, (parentDiet.carcass ?? 0.33) + (Math.random() * 0.14 - 0.07))
    };

    const total = newDiet.meat + newDiet.plant + newDiet.carcass;
    return {
      meat: parseFloat((newDiet.meat / total).toFixed(2)),
      plant: parseFloat((newDiet.plant / total).toFixed(2)),
      carcass: parseFloat((newDiet.carcass / total).toFixed(2))
    };
  }

  clone() {
    return new Genome(JSON.parse(JSON.stringify(this)));
  }
}


// --- world/GridCell.js ---
// ====================================================
//  GRIDCELL.JS — Modelo de Grade e Solo (POO)
// ====================================================

class GridCell {
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


// --- entities/Entity.js ---
// ====================================================
//  ENTITY.JS — Entidade base no plano 2D (POO)
// ====================================================

/**
 * Entidade base no plano 2D.
 */
class Entity {
  constructor(id, x, y) {
    this.id = id || ('ent_' + Math.random().toString(36).substr(2, 9));
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.alive = true;
  }

  distanceTo(other) {
    return Math.hypot(this.x - other.x, this.y - other.y);
  }

  clampToBounds(margin, maxX, maxY) {
    if (this.x < margin) { this.x = margin; this.vx *= -1; }
    if (this.x > maxX)   { this.x = maxX;   this.vx *= -1; }
    if (this.y < margin) { this.y = margin; this.vy *= -1; }
    if (this.y > maxY)   { this.y = maxY;   this.vy *= -1; }
  }
}


// --- entities/Carcass.js ---
// ====================================================
//  CARCASS.JS — Carcaça física de animal morto
// ====================================================



/**
 * Carcaça física de animal morto em decomposição e mineralização.
 */
class Carcass extends Entity {
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


// --- entities/Organism.js ---
// ====================================================
//  ORGANISM.JS — Organismo vivo com genoma, energia e ciclo de vida
// ====================================================




/**
 * Organismo vivo provido de genoma, energia, taxa metabólica e ciclo de vida.
 */
class Organism extends Entity {
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


// --- entities/Plant.js ---
// ====================================================
//  PLANT.JS — Entidade Vegetal (Lei de Liebig + partição de biomassa)
// ====================================================




/**
 * Entidade Vegetal fundamentada na Lei de Liebig e partição de biomassa.
 */
class Plant extends Organism {
  constructor(id, name, r, c, cellSize, genes = {}, customImages = {}) {
    const px = (c + 0.5) * cellSize;
    const py = (r + 0.5) * cellSize;
    super(id, name, name, px, py, 40.0, 45.0, genes, customImages);
    this.r = r;
    this.c = c;
    this.growth = 0.35;
    this.hasFruit = false;
    this.fruitCount = 0;
  }

  getMaintenanceCost() {
    const g = this.genes;
    return 0.02 + ((g.height || 0.5) * 0.02) + ((g.defense || 0.3) * 0.015);
  }

  tick(curSeason, cell, plantMetrics, engine) {
    this.ageOneTick();
    if (!cell) {
      this.alive = false;
      return;
    }

    const g = this.genes;
    const maintenanceCost = this.getMaintenanceCost();

    const tempDiff = Math.abs((g.thermal || 0.0) - curSeason.temp);
    const thermalPlantFactor = tempDiff > 0.4 ? 1.0 + (tempDiff - 0.4) * 0.6 : 1.0;

    const sunlightMod = engine?.equilibriumSettings?.sunlightMultiplier ?? 1.0;
    const effectiveSunlight = curSeason.sunlight * sunlightMod;
    const lightFactor = effectiveSunlight / (0.4 + effectiveSunlight);
    const nitrogenFactor = cell.soilNitrogen / (10.0 + cell.soilNitrogen);
    const waterFactor = Math.min(1.0, cell.moisture * (0.7 + (g.rootEfficiency || 0.5) * 0.6));
    const liebig = Math.min(lightFactor, nitrogenFactor, waterFactor) / thermalPlantFactor;

    // Longevidade genética
    const baseLifespan = 320 + ((g.height || 0.5) * 320) + ((g.defense || 0.3) * 180) - ((g.growthSpeed || 0.5) * 140);
    const plantMaxAge = Math.max(180, Math.round(baseLifespan));

    if (cell.soilNitrogen >= maintenanceCost) {
      if (plantMetrics) plantMetrics.growthUpdates++;
      cell.soilNitrogen -= maintenanceCost;
      const leafAreaFactor = Math.max(0.20, this.growth);
      const growthDelta = 0.016 * leafAreaFactor * (0.5 + (g.growthSpeed || 0.5) * 0.8) * liebig;
      this.growth = Math.min(1.0, this.growth + growthDelta);

      if (liebig > 0.35 && this.energy < 45.0) {
        this.gainEnergy(0.12 * liebig);
      }

      if (this.growth >= 0.68) {
        this.hasFruit = true;
        this.fruitCount = Math.round(1 + (g.fruitAttraction || 0.4) * 4);
      }
    } else {
      if (plantMetrics) plantMetrics.growthBlocked++;
      this.consumeEnergy(0.32 * (1.0 + (g.height || 0.5) * 0.4));
    }

    if (liebig < 0.20) {
      this.consumeEnergy(0.14);
    }

    if (this.age > plantMaxAge * 0.85) {
      this.consumeEnergy(0.18);
    }

    // Mortalidade por senescência ou inanição de nutrientes
    if (this.age >= plantMaxAge || this.energy <= 0) {
      if (plantMetrics) {
        if (this.energy <= 0) plantMetrics.nutrientDeaths++;
        else plantMetrics.ageDeaths++;
      }
      cell.addOrganicBiomass(this.growth * 12.0);
      cell.soilNitrogen = Math.min(60.0, cell.soilNitrogen + 2.0);
      if (cell.plant === this) cell.plant = null;
      this.alive = false;
      return;
    }

    // Dispersão e reprodução sexuada por polinização cruzada
    const reproThreshold = 0.015 * (g.growthSpeed || 0.5);
    if (this.hasFruit && Math.random() < reproThreshold && engine && engine.plants.length < engine.gridCols * engine.gridRows * 0.70) {
      this.disperseSeed(engine, curSeason);
    }
  }

  disperseSeed(engine, curSeason) {
    const g = this.genes;
    const windReach = Math.max(1, Math.round(1 + (g.height || 0.5) * 4));
    const dr = Math.floor(Math.random() * (windReach * 2 + 1)) - windReach;
    const dc = Math.floor(Math.random() * (windReach * 2 + 1)) - windReach;
    const nr = this.r + dr, nc = this.c + dc;

    if (engine.grid[nr]?.[nc] && engine.grid[nr][nc].biome !== 'water' && !engine.grid[nr][nc].plant) {
      let partnerGenes = g;
      const searchRadius = 3;
      for (let pr = Math.max(0, this.r - searchRadius); pr <= Math.min(engine.gridRows - 1, this.r + searchRadius); pr++) {
        for (let pc = Math.max(0, this.c - searchRadius); pc <= Math.min(engine.gridCols - 1, this.c + searchRadius); pc++) {
          const other = engine.grid[pr]?.[pc]?.plant;
          if (other && other !== this && other.hasFruit) {
            partnerGenes = other.genes || g;
            break;
          }
        }
        if (partnerGenes !== g) break;
      }

      const mutMul = engine.equilibriumSettings?.mutationRateMultiplier ?? 1.0;
      const childGenes = {};
      const allGeneKeys = ['height', 'rootEfficiency', 'growthSpeed', 'defense', 'fruitAttraction', 'parasiteResistance', 'thermal', 'colorHue'];

      allGeneKeys.forEach(k => {
        const geneA = g[k] ?? (k === 'colorHue' ? 110 : (k === 'thermal' ? 0.0 : 0.5));
        const geneB = partnerGenes[k] ?? geneA;
        const avg = (geneA + geneB) / 2;

        if (k === 'colorHue') {
          const hueMut = (Math.random() * 26 - 13) * mutMul;
          childGenes[k] = Math.round((avg + hueMut + 360) % 360);
        } else if (k === 'thermal') {
          const tMut = (Math.random() * 0.12 - 0.06) * mutMul;
          childGenes[k] = parseFloat(Math.max(-1.0, Math.min(1.0, avg + tMut)).toFixed(2));
        } else {
          const gMut = (Math.random() * 0.12 - 0.06) * mutMul;
          childGenes[k] = parseFloat(Math.max(0.05, Math.min(1.0, avg + gMut)).toFixed(2));
        }
      });

      const baseName = this.name;
      const speciesData = engine.speciesRegistry[baseName] || {};
      const founderGenes = speciesData.founderGenes || g;
      const rootName = speciesData.rootName || baseName.replace(/\s*(Espinhosa|Indefesa|Gigante|Rasteira|Árida|Aquática|Pioneira|Tardia|Tropical|Boreal)/g, '').trim();

      const speciation = Genome.evaluatePlantSpeciation(childGenes, founderGenes);
      let childSpeciesName = baseName;

      if (speciation.diverged) {
        childSpeciesName = rootName + ' ' + speciation.desc;
        const isNew = engine.registerSpecies(
          childSpeciesName,
          'plant',
          childGenes,
          baseName,
          rootName,
          speciation.traitName + ' ' + speciation.desc
        );
        if (isNew && typeof toast === 'function') {
          toast('🌿 Nova Linhagem Vegetal: "' + childSpeciesName + '" emergiu por seleção de ' + speciation.traitName + '!');
        }
      }

      const clonePlant = new Plant(
        'plant_' + Math.random().toString(36).substr(2, 9),
        childSpeciesName,
        nr, nc,
        engine.cellSize,
        childGenes,
        this.customImages
      );
      clonePlant.growth = 0.14;
      clonePlant.energy = 28.0;

      engine.grid[nr][nc].plant = clonePlant;
      engine.plants.push(clonePlant);
      if (engine.plantMetrics) engine.plantMetrics.reproduced++;
    }
  }

  beEaten(biteAmount) {
    const actualBite = Math.min(this.growth, biteAmount);
    this.growth = Math.max(0, this.growth - actualBite);
    this.energy -= actualBite * 16.0;
    this.hasFruit = false;
    return actualBite;
  }
}


// --- entities/Animal.js ---
// ====================================================
//  ANIMAL.JS — Organismo Animal (Lei de Kleiber, termorregulação e IA)
// ====================================================





/**
 * Organismo Animal regido pela Lei de Kleiber, termorregulação e IA de caça/fuga.
 */
class Animal extends Organism {
  constructor(id, name, speciesName, x, y, genes = {}, customImages = {}) {
    const genome = genes instanceof Genome ? genes : new Genome(genes);
    const meatRatio = genome.diet?.meat || 0.0;
    const initialEnergy = 90.0 + Math.random() * 10;
    const maxEnergy = 100.0 + meatRatio * 80.0;

    super(id, name, speciesName, x, y, initialEnergy, maxEnergy, genome, customImages);

    this.vx = (Math.random() - 0.5) * 1.5;
    this.vy = (Math.random() - 0.5) * 1.5;

    this.state = 'wandering';
    this.stateLabel = 'Forrageando';
    this.mateCooldown = 30;
    this.isSeekingMate = false;
    this.attackCooldown = 0;
    this.isDiseased = false;
    this.diseaseTimer = 0;
    this.isPregnant = false;
    this.gestationTicks = 0;
    this.pregnantGenes = null;
    this.pregnantSpeciesName = null;
    this.pregnantClutchSize = 1;
    this.carriedSeed = null;
    this.fleeTicks = 0;
    this.carcassEnergy = null;
    const baseLifespan = meatRatio > 0.45 ? (950 + (genome.size || 0.5) * 300) : (700 + (genome.size || 0.5) * 150);
    this.maxLifespan = Math.round(baseLifespan * (0.82 + Math.random() * 0.36));
  }

  calculateMetabolicCost(curSeason, inWater) {
    const g = this.genes;
    const curSpeed = Math.hypot(this.vx || 0, this.vy || 0);
    const massKg = 5.0 + (g.size || 0.5) * 70.0;
    const basalMetabolism = 0.06 * Math.pow(massKg / 40.0, 0.75);
    const locomotionCost = 0.04 * Math.pow(curSpeed / 2.0, 1.5);

    const meatRatio = g.diet?.meat || 0.0;
    this.maxEnergy = 100.0 + meatRatio * 80.0;
    const fastingEfficiency = 1.0 - meatRatio * 0.45;

    const tempDiff = Math.abs((g.thermal || 0.0) - curSeason.temp);
    const thermalFactor = 1.0 + (tempDiff > 0.4 ? 0.3 : 0.0) * curSeason.thermalCost;

    let totalCost = (basalMetabolism * fastingEfficiency + locomotionCost) * thermalFactor;

    const aquatic = g.aquatic ?? 0.15;
    if (inWater) {
      if (aquatic < 0.35) {
        totalCost += (0.35 - aquatic) * 0.30;
        this.vx *= 0.65;
        this.vy *= 0.65;
        this.stateLabel = 'Nadando com Esforço!';
      } else {
        totalCost *= 0.80;
      }
    } else {
      if (aquatic > 0.70) {
        totalCost += (aquatic - 0.70) * 0.25;
        this.vx *= 0.75;
        this.vy *= 0.75;
        this.stateLabel = 'Rastejando em Terra!';
      }
    }

    if (this.isDiseased) {
      this.diseaseTimer--;
      totalCost += 0.12;
      if (this.diseaseTimer <= 0) this.isDiseased = false;
    }

    if (this.isPregnant) {
      this.gestationTicks--;
      totalCost += 0.08;
    }

    if (meatRatio > 0.45 && this.energy < 28.0 && this.state !== 'hunting') {
      totalCost *= 0.65;
    }

    if (meatRatio > 0.45 && this.state !== 'hunting' && this.state !== 'fleeing') {
      totalCost *= 0.72;
    }

    return totalCost;
  }

  tick(curSeason, engine, newOffspring, deadAnimals) {
    this.ageOneTick();
    if (this.mateCooldown > 0) this.mateCooldown--;
    if (this.attackCooldown > 0) this.attackCooldown--;

    const curR = Math.max(0, Math.min(engine.gridRows - 1, Math.floor(this.y / engine.cellSize)));
    const curC = Math.max(0, Math.min(engine.gridCols - 1, Math.floor(this.x / engine.cellSize)));
    const inWater = engine.grid[curR]?.[curC]?.biome === 'water';

    const cost = this.calculateMetabolicCost(curSeason, inWater);

    // Gestação, abortos e partos
    if (this.isPregnant) {
      if (this.energy < 22.0) {
        this.isPregnant = false;
        this.pregnantGenes = null;
        this.stateLabel = '⚠️ Aborto por Inanição';
        if (typeof toast === 'function' && Math.random() < 0.18) {
          toast(`⚠️ ${this.name} sofreu aborto espontâneo por falta de comida!`);
        }
      } else if (this.gestationTicks <= 0) {
        this.isPregnant = false;
        const clutch = this.pregnantClutchSize || 1;
        const babyGenes = this.pregnantGenes || this.genes;
        const babySpeed = (0.5 + (babyGenes.speed || 0.5) * 1.5);

        for (let b = 0; b < clutch; b++) {
          const baby = new Animal(
            'anim_' + Math.random().toString(36).substr(2, 9),
            this.pregnantSpeciesName || this.speciesName,
            this.pregnantSpeciesName || this.speciesName,
            Math.max(10, Math.min((engine.gridCols * engine.cellSize) - 10, this.x + (Math.random() * 14 - 7))),
            Math.max(10, Math.min((engine.gridRows * engine.cellSize) - 10, this.y + (Math.random() * 14 - 7))),
            babyGenes,
            this.customImages
          );
          baby.vx = (Math.random() - 0.5) * babySpeed;
          baby.vy = (Math.random() - 0.5) * babySpeed;
          baby.energy = (babyGenes.diet?.meat || 0) > 0.45 ? 58.0 : 38.0;
          baby.stateLabel = 'Recém-nascido (Frágil)';
          baby.mateCooldown = 60;
          newOffspring.push(baby);
        }
        this.pregnantGenes = null;
        this.stateLabel = 'Deu à luz!';
      }
    }

    this.consumeEnergy(cost);

    const g = this.genes;
    const maxLifespan = this.maxLifespan || ((g.diet?.meat || 0) > 0.45 ? (950 + (g.size || 0.5) * 300) : (700 + (g.size || 0.5) * 150));

    if (this.energy <= 0 || this.age > maxLifespan) {
      if (engine.animalMetrics) {
        if (this.energy <= 0) engine.animalMetrics.energyDeaths++;
        else engine.animalMetrics.ageDeaths++;

        if (this.age < 50) engine.animalMetrics.juvenileDeaths++;
        else engine.animalMetrics.adultDeaths++;

        if (this.isDiseased) engine.animalMetrics.sickDeaths++;
        else engine.animalMetrics.healthyDeaths++;
      }

      this.alive = false;
      deadAnimals.push(this);
      return;
    }

    // Execução da IA e tomada de decisão
    this.updateAI(engine, newOffspring);

    this.x += this.vx;
    this.y += this.vy;

    // Dispersão zoocórica de sementes ingeridas
    if (this.carriedSeed) {
      this.carriedSeed.dropTimer--;
      if (this.carriedSeed.dropTimer <= 0) {
        const ar = Math.floor(this.y / engine.cellSize);
        const ac = Math.floor(this.x / engine.cellSize);
        const targetCell = engine.grid[ar]?.[ac];

        if (targetCell && targetCell.biome !== 'water' && !targetCell.plant && engine.plants.length < engine.gridCols * engine.gridRows * 0.70) {
          const baseName = this.carriedSeed.speciesName;
          const speciesData = engine.speciesRegistry[baseName] || {};
          const founderGenes = speciesData.founderGenes || this.carriedSeed.genes;
          const rootName = speciesData.rootName || baseName.replace(/\s*(Espinhosa|Indefesa|Gigante|Rasteira|Árida|Aquática|Pioneira|Tardia|Tropical|Boreal)/g, '').trim();

          const speciation = Genome.evaluatePlantSpeciation(this.carriedSeed.genes, founderGenes);
          let childSpeciesName = baseName;

          if (speciation.diverged) {
            childSpeciesName = rootName + ' ' + speciation.desc;
            const isNew = engine.registerSpecies(
              childSpeciesName,
              'plant',
              this.carriedSeed.genes,
              baseName,
              rootName,
              speciation.traitName + ' ' + speciation.desc
            );
            if (isNew && typeof toast === 'function') {
              toast('🌿 Nova Linhagem Vegetal (Zoocoria): "' + childSpeciesName + '" germinou após dispersão animal!');
            }
          }

          const seedPlant = new Plant(
            'plant_' + Math.random().toString(36).substr(2, 9),
            childSpeciesName,
            ar, ac,
            engine.cellSize,
            this.carriedSeed.genes || {},
            this.carriedSeed.customImages || {}
          );
          seedPlant.growth = 0.22;
          seedPlant.energy = 40.0;
          targetCell.plant = seedPlant;
          targetCell.addOrganicBiomass(5.0);
          engine.plants.push(seedPlant);
          if (engine.plantMetrics) engine.plantMetrics.reproduced++;
        }
        this.carriedSeed = null;
      }
    }

    const margin = 12;
    const maxX = engine.gridCols * engine.cellSize - margin;
    const maxY = engine.gridRows * engine.cellSize - margin;
    this.clampToBounds(margin, maxX, maxY);
  }

  updateAI(engine, newOffspring) {
    const g = this.genes;
    const isCarnivore = (g.diet?.meat || 0) > 0.45;

    const hungerRatio = Math.max(0, 1.0 - (this.energy / this.maxEnergy));
    const hungerVisionBonus = isCarnivore ? (1.0 + hungerRatio * 0.5) : 1.0;
    const viewDist = (45 + g.perception * 130) * (isCarnivore ? 1.4 : 1.0) * hungerVisionBonus;

    const speedPenalty = this.isDiseased ? 0.65 : (this.isPregnant ? 0.82 : 1.0);
    const curR = Math.max(0, Math.min(engine.gridRows - 1, Math.floor(this.y / engine.cellSize)));
    const curC = Math.max(0, Math.min(engine.gridCols - 1, Math.floor(this.x / engine.cellSize)));
    const inWater = engine.grid[curR]?.[curC]?.biome === 'water';
    const aquatic = g.aquatic ?? 0.15;

    const terrainSpeedFactor = inWater
      ? (0.30 + aquatic * 0.90)
      : (1.10 - aquatic * 0.55);

    const maxSpeed = (0.7 + g.speed * 2.2) * speedPenalty * terrainSpeedFactor;

    let targetX = null, targetY = null;
    let desiredSpeed = maxSpeed * 0.45;
    this.stateLabel = this.isDiseased
      ? `☣️ Infectado (${this.diseaseTimer}t)`
      : (this.isPregnant ? `🤰 Gestante (${this.gestationTicks}t)` : 'Forrageando');

    // 1. Fuga de Predadores
    if (!isCarnivore) {
      const fleePerceptionBonus = (g.perception ?? 0.5) * 60.0 * (engine.equilibriumSettings?.fleePerceptionFactor ?? 1.0);
      const maxFleeDist = Math.min(viewDist, 32.0 + fleePerceptionBonus);
      let threat = null, minTDist = maxFleeDist;
      engine.animals.forEach(other => {
        if (other !== this && (other.genes.diet?.meat || 0) > 0.45 && other.genes.size > g.size * 1.1) {
          const d = Math.hypot(other.x - this.x, other.y - this.y);
          if (d < minTDist) { minTDist = d; threat = other; }
        }
      });

      if (threat) {
        if (engine.aiMetrics) engine.aiMetrics.fleeEvents++;
        this.state = 'fleeing';
        this.isSeekingMate = false;
        this.stateLabel = 'Fugindo de Predador!';
        this.fleeTicks = (this.fleeTicks || 0) + 1;
        const burst = this.fleeTicks < 25 ? 1.22 : 1.0;
        const fatigue = this.fleeTicks > 45 ? Math.max(0.72, 1.0 - (this.fleeTicks - 45) * 0.012) : 1.0;
        desiredSpeed = maxSpeed * burst * fatigue;

        const angle = Math.atan2(this.y - threat.y, this.x - threat.x);
        this.vx = this.vx * 0.50 + Math.cos(angle) * desiredSpeed * 0.50;
        this.vy = this.vy * 0.50 + Math.sin(angle) * desiredSpeed * 0.50;
        return;
      } else if (this.fleeTicks > 0) {
        this.fleeTicks = Math.max(0, this.fleeTicks - 2);
      }
    }

    // 2. Busca por Alimento
    const hungerThreshold = isCarnivore ? (this.maxEnergy * (engine.equilibriumSettings?.predatorSatietyThreshold ?? 0.75)) : 85.0;
    if (this.energy < hungerThreshold) {
      // A. Necrofagia
      const carcassHungerThreshold = isCarnivore ? 85.0 : 20.0;
      if ((g.diet?.carcass || 0) > 0.08 && this.energy < carcassHungerThreshold) {
        let bestCarcass = null, minCDist = Math.min(viewDist, 17.99);
        engine.carcasses.forEach(c => {
          if (!c || c.remainingEnergy <= 0) return;
          const isConspecificCarcass = (c.speciesName === this.speciesName);
          if (isConspecificCarcass && (!isCarnivore || this.energy >= 25.0)) return;

          const d = Math.hypot(c.x - this.x, c.y - this.y);
          if (d < minCDist) { minCDist = d; bestCarcass = c; }
        });

        if (bestCarcass) {
          if (engine.aiMetrics) {
            engine.aiMetrics.carcassTargets++;
            engine.aiMetrics.carcassDistanceTotal += minCDist;
            if (minCDist >= 18) engine.aiMetrics.carcassFarTargets++;
            engine.aiMetrics.carcassMaxDistance = Math.max(engine.aiMetrics.carcassMaxDistance, minCDist);
          }
          targetX = bestCarcass.x;
          targetY = bestCarcass.y;
          desiredSpeed = maxSpeed * 0.7;
          this.stateLabel = 'Comendo Carcaça';

          if (minCDist < 18) {
            if (engine.aiMetrics) {
              engine.aiMetrics.carcassMeals++;
              if (isCarnivore) engine.aiMetrics.carnivoreCarcassMeals++;
              else engine.aiMetrics.herbivoreCarcassMeals++;
            }
            this.vx *= 0.1; this.vy *= 0.1;
            const bite = bestCarcass.consumeBite(4.0);

            if (bestCarcass.speciesName === this.speciesName && Math.random() < 0.40) {
              if (engine.aiMetrics) engine.aiMetrics.prionInfections++;
              this.isDiseased = true;
              this.diseaseTimer = Math.min(200, (this.diseaseTimer || 0) + 120);
              this.stateLabel = '☣️ Canibalismo (Infectado por Príon!)';
              if (typeof toast === 'function' && Math.random() < 0.25) {
                toast(`☣️ ${this.name} contraiu Príon por necro-canibalismo!`);
              }
            }

            this.gainEnergy(bite * 0.80);
            return;
          }
        }
      }

      // B. Predação
      const satietyThreshold = this.maxEnergy * (engine.equilibriumSettings?.predatorSatietyThreshold ?? 0.52);
      const isCarnivoreAgent = (g.diet?.meat || 0) > 0.45;
      const isHungryCarnivore = isCarnivoreAgent && !targetX && this.energy < satietyThreshold;

      if (isHungryCarnivore) {
        const sizeAdvantage = 1.15 + (g.aggression || 0.3) * 0.6;
        let bestPrey = null, minPDist = viewDist;

        engine.animals.forEach(other => {
          if (other === this || !other.alive) return;
          const isSameSpecies = (other.speciesName === this.speciesName);
          const isOtherCarnivore = (other.genes.diet?.meat || 0) > 0.45;
          if (isSameSpecies && this.energy >= 20.0) return;

          const mySize = g.size || 0.5;
          const preySize = other.genes.size || 0.5;
          const isTargetVulnerable = (mySize * sizeAdvantage) > preySize;

          if (isTargetVulnerable || this.energy < 25.0) {
            const d = Math.hypot(other.x - this.x, other.y - this.y);
            if (d < minPDist) {
              minPDist = d;
              bestPrey = other;
            }
          }
        });

        if (bestPrey) {
          targetX = bestPrey.x;
          targetY = bestPrey.y;
          this.state = 'hunting';
          this.stateLabel = 'Caçando Presa!';
          desiredSpeed = maxSpeed * 1.05;

          if (minPDist < 22 && this.attackCooldown === 0) {
            this.attackCooldown = 15;
            this.vx *= 0.2; this.vy *= 0.2;

            const predAggro = (g.aggression || 0.3);
            const preyHealth = (bestPrey.genes.health || 0.5);
            const mySize = (g.size || 0.5);
            const preySize = (bestPrey.genes.size || 0.5);

            const damage = (28.0 + predAggro * 35.0) * (mySize / Math.max(0.2, preySize));
            bestPrey.energy -= damage;

            if (bestPrey.energy <= 0) {
              bestPrey.alive = false;
              if (engine.aiMetrics) {
                if (bestPrey.speciesName === this.speciesName) engine.aiMetrics.cannibalAttacks++;
                else engine.aiMetrics.otherSpeciesKills++;
                if ((bestPrey.genes.diet?.meat || 0) > 0.45) engine.aiMetrics.carnivorePreyKills++;
                else engine.aiMetrics.nonCarnivorePreyKills++;
              }

              const meatGain = (35.0 + preySize * 45.0) * 0.65;
              this.gainEnergy(meatGain);
              bestPrey.carcassEnergy = (35.0 + preySize * 45.0) * 0.35;
              this.stateLabel = 'Abateu Presa!';
              return;
            } else {
              this.stateLabel = 'Atacando Presa!';
              bestPrey.vx += (this.vx * 1.5);
              bestPrey.vy += (this.vy * 1.5);
            }
          }
        }
      }

      // C. Herbivoria
      if (!targetX && (g.diet?.plant || 0) > 0.15 && engine.plants.length > 0) {
        let bestPlant = null, minPlDist = viewDist;
        engine.plants.forEach(p => {
          if (!p || p.growth < 0.15) return;
          const d = Math.hypot(p.x - this.x, p.y - this.y);
          if (d < minPlDist) { minPlDist = d; bestPlant = p; }
        });

        if (bestPlant) {
          if (engine.aiMetrics) engine.aiMetrics.plantTargets = (engine.aiMetrics.plantTargets || 0) + 1;
          targetX = bestPlant.x;
          targetY = bestPlant.y;
          desiredSpeed = maxSpeed * 0.65;
          this.stateLabel = 'Pastando';

          if (minPlDist < 16) {
            if (engine.aiMetrics) {
              engine.aiMetrics.plantApproaches++;
              engine.aiMetrics.herbivoreMeals++;
            }
            this.vx *= 0.1; this.vy *= 0.1;

            const plantDef = bestPlant.genes?.defense || 0;
            const defenseFactor = Math.max(0.18, 1.0 - plantDef * 0.75);
            const biteAmount = Math.min(bestPlant.growth * 0.65, 0.30) * defenseFactor;

            if (plantDef > 0.40) {
              const thornDamage = (plantDef - 0.40) * 14.0;
              this.energy = Math.max(1.0, this.energy - thornDamage);
              this.stateLabel = 'Repelido por Espinhos/Toxina!';
            }

            const calories = (Math.max(0.06, biteAmount) / 0.20) * (bestPlant.hasFruit ? 26.0 : 18.0);
            this.gainEnergy(calories * 0.85);

            bestPlant.energy -= biteAmount * 16.0;

            if (bestPlant.hasFruit && Math.random() < (bestPlant.genes?.fruitAttraction || 0.4)) {
              const mutMul = engine.equilibriumSettings?.mutationRateMultiplier ?? 1.0;
              const seedGenes = {};
              const bg = bestPlant.genes || {};
              const allGeneKeys = ['height', 'rootEfficiency', 'growthSpeed', 'defense', 'fruitAttraction', 'parasiteResistance', 'thermal', 'colorHue'];

              allGeneKeys.forEach(k => {
                const val = bg[k] ?? (k === 'colorHue' ? 110 : (k === 'thermal' ? 0.0 : 0.5));
                if (k === 'colorHue') {
                  seedGenes[k] = Math.round((val + (Math.random() * 26 - 13) * mutMul + 360) % 360);
                } else if (k === 'thermal') {
                  seedGenes[k] = parseFloat(Math.max(-1.0, Math.min(1.0, val + (Math.random() * 0.12 - 0.06) * mutMul)).toFixed(2));
                } else {
                  seedGenes[k] = parseFloat(Math.max(0.05, Math.min(1.0, val + (Math.random() * 0.12 - 0.06) * mutMul)).toFixed(2));
                }
              });

              this.carriedSeed = {
                speciesName: bestPlant.name,
                genes: seedGenes,
                customImages: bestPlant.customImages,
                dropTimer: Math.round(20 + Math.random() * 35)
              };
            }

            const remainingGrowth = bestPlant.growth - biteAmount;
            if (remainingGrowth < 0.08 || bestPlant.energy <= 4.0) {
              const cell = engine.grid[bestPlant.r]?.[bestPlant.c];
              if (cell && cell.plant === bestPlant) cell.plant = null;
              if (engine.plantMetrics) engine.plantMetrics.grazingDeaths++;
              if (cell) {
                cell.addOrganicBiomass(Math.max(0, remainingGrowth) * 8.0);
              }
              const pIdx = engine.plants.indexOf(bestPlant);
              if (pIdx !== -1) engine.plants.splice(pIdx, 1);
              this.stateLabel = 'Arrancou raiz (Overgrazing)!';
            } else {
              bestPlant.growth = Math.max(0.06, remainingGrowth);
              bestPlant.hasFruit = false;
            }
            return;
          }
        }
      }
    }

    // 3. REPRODUÇÃO SEXUADA COM INÍCIO DE GESTAÇÃO
    let totalCarnivores = 0;
    let totalHerbivores = 0;
    for (let i = 0; i < engine.animals.length; i++) {
      if ((engine.animals[i].genes?.diet?.meat || 0) > 0.45) totalCarnivores++;
      else totalHerbivores++;
    }

    const preyPerPredator = totalCarnivores > 0 ? (totalHerbivores / totalCarnivores) : 20.0;
    let reproductionFactor;
    if (isCarnivore) {
      if (totalCarnivores <= 3) {
        // Resgate reprodutivo para evitar extinção do topo da cadeia
        reproductionFactor = totalHerbivores >= 5 ? 0.85 : 0.25;
      } else if (totalCarnivores >= 15 || totalCarnivores > totalHerbivores * 0.18 || preyPerPredator < 3.0) {
        // Teto de capacidade de suporte de predadores (evita superpopulação)
        reproductionFactor = 0.0;
      } else if (preyPerPredator < 5.0 || totalCarnivores >= 10) {
        reproductionFactor = 0.18;
      } else if (preyPerPredator >= 8.0) {
        reproductionFactor = 0.60;
      } else {
        reproductionFactor = 0.35;
      }
    } else {
      reproductionFactor = totalHerbivores < 35
        ? 1.60
        : totalHerbivores < 70
          ? 1.15
          : totalHerbivores < 120
            ? 0.65
            : totalHerbivores < 160
              ? 0.20
              : 0.01;
    }

    if (reproductionFactor === 0.0) {
      this.isSeekingMate = false;
    } else if (this.isSeekingMate && (this.energy < 55.0 || this.mateCooldown > 0)) {
      this.isSeekingMate = false;
    }

    const canStartReproduction = reproductionFactor > 0 && (this.isSeekingMate || Math.random() < reproductionFactor);
    const reproEnergyThreshold = isCarnivore ? 78.0 : 62.0;

    if (
      canStartReproduction &&
      this.energy > reproEnergyThreshold &&
      this.age > 40 &&
      this.mateCooldown === 0 &&
      !this.isDiseased &&
      !this.isPregnant
    ) {
      const mateSearchRadius = isCarnivore
        ? Math.max(viewDist * 4.0, 750)
        : (viewDist * 1.2);
      let bestMate = null, minMDist = mateSearchRadius;

      engine.animals.forEach(other => {
        const otherIsCarnivore = (other.genes.diet?.meat || 0) > 0.45;
        const otherReproThreshold = otherIsCarnivore
          ? (totalCarnivores < 20 ? 70.0 : 85.0)
          : 65.0;
        if (other === this || other.energy <= otherReproThreshold * 0.85 || other.mateCooldown > 0 || other.isDiseased || other.isPregnant) return;

        const genDist = Genome.getGeneticDistance(this.genes, other.genes);
        let isCompatible = false;
        if (other.speciesName === this.speciesName || genDist < 0.14) {
          isCompatible = true;
        }
        if (genDist >= 0.28) {
          isCompatible = false;
        }

        if (isCompatible) {
          const d = Math.hypot(other.x - this.x, other.y - this.y);
          if (d < minMDist) { minMDist = d; bestMate = other; }
        }
      });

      if (bestMate) {
        targetX = bestMate.x;
        targetY = bestMate.y;
        desiredSpeed = maxSpeed * 0.85;
        this.isSeekingMate = true;
        this.stateLabel = 'Buscando Parceiro';

        if (minMDist < 16) {
          this.vx *= 0.1; this.vy *= 0.1;
          const mateCost = isCarnivore ? 24.0 : 16.0;
          this.energy -= mateCost;
          bestMate.energy -= mateCost;

          this.isSeekingMate = false;
          bestMate.isSeekingMate = false;
          this.mateCooldown = 110;
          bestMate.mateCooldown = 110;

          const baseSpecies = this.speciesName;
          const speciesData = engine.speciesRegistry[baseSpecies] || {};
          const founderGenes = speciesData.founderGenes || g;
          const rootName = speciesData.rootName || baseSpecies.replace(/\s*(Gigante|Pigmeu|Tropical|Polar|Veloz|Robusto|Predador|Herbívoro)/g, '').trim();

          const childGenes = {};
          const allGeneKeys = new Set([
            ...Object.keys(g),
            ...Object.keys(bestMate.genes)
          ]);

          allGeneKeys.forEach(k => {
            if (k === 'diet') {
              const dietA = g.diet || {};
              const dietB = bestMate.genes.diet || {};
              const avgDiet = {
                meat: ((dietA.meat ?? 0.05) + (dietB.meat ?? 0.05)) / 2,
                plant: ((dietA.plant ?? 0.85) + (dietB.plant ?? 0.85)) / 2,
                carcass: ((dietA.carcass ?? 0.10) + (dietB.carcass ?? 0.10)) / 2,
              };
              childGenes.diet = Genome.mutateAndNormalizeDiet(avgDiet);
            } else {
              const geneA = g[k] ?? bestMate.genes[k] ?? 0.5;
              const geneB = bestMate.genes[k] ?? g[k] ?? 0.5;
              const avg = (geneA + geneB) / 2;

              const mutMul = engine.equilibriumSettings?.mutationRateMultiplier ?? 1.0;
              if (k === 'colorHue') {
                childGenes[k] = Math.round((avg + (Math.random() * 20 - 10) * mutMul + 360) % 360);
              } else if (k === 'thermal') {
                childGenes[k] = parseFloat(
                  Math.max(-1.0, Math.min(1.0, avg + (Math.random() * 0.1 - 0.05) * mutMul)).toFixed(2)
                );
              } else {
                childGenes[k] = parseFloat(
                  Math.max(0.05, Math.min(1.0, avg + (Math.random() * 0.12 - 0.06) * mutMul)).toFixed(2)
                );
              }
            }
          });

          const speciationCheck = Genome.evaluateAnimalSpeciation(childGenes, founderGenes);
          let finalSpeciesName = baseSpecies;

          if (speciationCheck.diverged) {
            finalSpeciesName = `${rootName} ${speciationCheck.desc}`;
            const isNew = engine.registerSpecies(
              finalSpeciesName,
              'animal',
              childGenes,
              baseSpecies,
              rootName,
              speciationCheck.traitName + ' ' + speciationCheck.desc
            );

            if (isNew && typeof toast === 'function') {
              toast(`🧬 Nova Espécie: "${finalSpeciesName}" surgiu por adaptação de ${speciationCheck.traitName}!`);
            }
          }

          const gestA = g.gestation ?? 0.45;
          const gestB = bestMate.genes?.gestation ?? 0.45;
          const offA = g.offspringCount ?? 0.45;
          const offB = bestMate.genes?.offspringCount ?? 0.45;

          let clutchSize;
          if (isCarnivore) {
            clutchSize = (preyPerPredator >= 12 && totalCarnivores < 6) ? 2 : 1;
          } else {
            clutchSize = (totalHerbivores < 60 && Math.random() < 0.6) ? 2 : 1;
          }
          if (speciationCheck.diverged && clutchSize < 2) clutchSize = 2;

          this.isPregnant = true;
          const gestFactor = isCarnivore ? 1.25 : (totalHerbivores < 60 ? 0.80 : 1.0);
          this.gestationTicks = Math.max(15, Math.round((28 + ((gestA + gestB) / 2) * 35) * gestFactor));
          this.pregnantGenes = childGenes;
          this.pregnantSpeciesName = finalSpeciesName;
          this.pregnantClutchSize = clutchSize;
          this.stateLabel = 'Iniciou Gestação';

          const mateCooldownVal = isCarnivore ? 160 : (totalHerbivores < 60 ? 60 : 85);
          this.mateCooldown = mateCooldownVal;
          bestMate.mateCooldown = mateCooldownVal;
          return;
        }
      }
    }

    if (targetX !== null && targetY !== null) {
      const angle = Math.atan2(targetY - this.y, targetX - this.x);
      this.vx = this.vx * 0.55 + Math.cos(angle) * desiredSpeed * 0.45;
      this.vy = this.vy * 0.55 + Math.sin(angle) * desiredSpeed * 0.45;
    } else {
      if (Math.random() < 0.07) {
        const randAngle = Math.random() * Math.PI * 2;
        this.vx = Math.cos(randAngle) * desiredSpeed;
        this.vy = Math.sin(randAngle) * desiredSpeed;
      }
    }
  }
}


// --- systems/Renderer.js ---
// ====================================================
//  RENDERER.JS — Sistema de renderização da simulação
// ====================================================



class Renderer {
  constructor(engine) {
    this.engine = engine;
  }

  render() {
    const engine = this.engine;
    if (!engine.ctx || !engine.canvas) return;
    const ctx = engine.ctx;
    const W = engine.canvas.width, H = engine.canvas.height;
    ctx.clearRect(0, 0, W, H);

    if (engine.terrainCanvas && engine.terrainCanvas.width === W && engine.terrainCanvas.height === H) {
      ctx.drawImage(engine.terrainCanvas, 0, 0);
    } else {
      engine.createTerrainCache();
      if (engine.terrainCanvas) ctx.drawImage(engine.terrainCanvas, 0, 0);
    }

    // Carcaças
    engine.carcasses.forEach(c => {
      if (!c || c.remainingEnergy <= 0) return;
      ctx.save();
      if (engine.highlightedSpecies) {
        ctx.globalAlpha = 0.25;
      }
      ctx.translate(c.x, c.y);
      ctx.fillStyle = '#8b263e';
      ctx.beginPath();
      ctx.ellipse(0, 0, 6, 4, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e6edf3';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-3, 0); ctx.lineTo(3, 0);
      ctx.stroke();
      ctx.restore();
    });

    // Vegetais
    if (engine.simplifiedSprites) {
      engine.plants.forEach(plant => {
        try {
          const isTargetSpecies = !engine.highlightedSpecies || (plant.name === engine.highlightedSpecies);
          const pScale = 0.35 + (plant.growth || 0.5) * 0.35;
          const r = Math.max(2.5, (3 + (plant.genes?.height || 0.5) * 5) * pScale);
          const hue = plant.genes?.colorHue ?? 110;
          ctx.fillStyle = `hsl(${hue}, 70%, 42%)`;
          ctx.beginPath();
          ctx.arc(plant.x, plant.y, r, 0, Math.PI * 2);
          ctx.fill();

          if (plant.hasFruit) {
            ctx.fillStyle = '#ff4d4f';
            ctx.beginPath();
            ctx.arc(plant.x, plant.y - r * 0.5, 2, 0, Math.PI * 2);
            ctx.fill();
          }

          if (engine.highlightedSpecies && isTargetSpecies) {
            ctx.strokeStyle = '#56d364';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        } catch (err) {}
      });
    } else {
      engine.plants.forEach(plant => {
        try {
          const isTargetSpecies = !engine.highlightedSpecies || (plant.name === engine.highlightedSpecies);
          ctx.save();
          if (engine.highlightedSpecies && !isTargetSpecies) {
            ctx.globalAlpha = 0.20;
          }
          const pScale = 0.35 + (plant.growth || 0.5) * 0.35;
          drawPlant(ctx, plant.genes, plant.x, plant.y + 4, pScale, plant.customImages || {});
          ctx.restore();

          if (engine.highlightedSpecies && isTargetSpecies) {
            ctx.save();
            const pulse = (Math.sin(Date.now() * 0.007) + 1) * 0.5;
            const spData = engine.speciesCatalog.find(s => s.name === plant.name);
            const glowColor = spData ? spData.color : '#3fb950';

            ctx.strokeStyle = glowColor;
            ctx.lineWidth = 2.5;
            ctx.shadowColor = glowColor;
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(plant.x, plant.y, 16 + pulse * 4, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
        } catch (err) {
          ctx.restore();
        }
      });
    }

    // Animais
    if (engine.simplifiedSprites) {
      engine.animals.forEach(anim => {
        try {
          const isCarn = (anim.genes?.diet?.meat || 0) > 0.45;
          const animSize = anim.genes?.size ?? 0.5;
          const r = Math.max(3.5, 4 + animSize * 7);

          if (isCarn) {
            ctx.fillStyle = '#f85149';
          } else {
            const hue = anim.genes?.colorHue ?? 120;
            ctx.fillStyle = `hsl(${hue}, 70%, 48%)`;
          }

          ctx.beginPath();
          ctx.arc(anim.x, anim.y, r, 0, Math.PI * 2);
          ctx.fill();

          const heading = Math.atan2(anim.vy || 0, anim.vx || 0);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(anim.x, anim.y);
          ctx.lineTo(anim.x + Math.cos(heading) * (r + 3.5), anim.y + Math.sin(heading) * (r + 3.5));
          ctx.stroke();

          if (anim.isDiseased) {
            ctx.strokeStyle = '#d2a8ff';
            ctx.lineWidth = 2;
            ctx.stroke();
          } else if (anim.isPregnant) {
            ctx.strokeStyle = '#ffa657';
            ctx.lineWidth = 2;
            ctx.stroke();
          }

          const barW = 12, barH = 2;
          const maxE = anim.maxEnergy || 100.0;
          const energyPct = Math.max(0, Math.min(1, anim.energy / maxE));
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.fillRect(anim.x - barW/2, anim.y - r - 4, barW, barH);
          ctx.fillStyle = energyPct > 0.5 ? '#3fb950' : (energyPct > 0.25 ? '#e3b341' : '#f78166');
          ctx.fillRect(anim.x - barW/2, anim.y - r - 4, barW * energyPct, barH);
        } catch (err) {}
      });
    } else {
      engine.animals.forEach(anim => {
        try {
          const animSpecies = anim.speciesName || anim.name;
          const isTargetSpecies = !engine.highlightedSpecies || (animSpecies === engine.highlightedSpecies);

          ctx.save();
          if (engine.highlightedSpecies && !isTargetSpecies) {
            ctx.globalAlpha = 0.20;
          }

          const animSize = anim.genes?.size ?? 0.5;
          const aScale = 0.35 + animSize * 0.35;
          drawCreature(ctx, anim.genes || {}, anim.x, anim.y, aScale, anim.customImages || {});

          if (anim.isDiseased) {
            ctx.strokeStyle = '#d2a8ff';
            ctx.lineWidth = 1.8;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.arc(anim.x, anim.y, 14 + animSize * 10, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
          }

          if (anim.isPregnant) {
            ctx.strokeStyle = '#ffa657';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(anim.x, anim.y, 12 + animSize * 8, 0, Math.PI * 2);
            ctx.stroke();
          }

          const barW = 18, barH = 3;
          const maxE = anim.maxEnergy || 100.0;
          const energyPct = Math.max(0, anim.energy / maxE);
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillRect(anim.x - barW/2, anim.y - 18, barW, barH);
          ctx.fillStyle = anim.isDiseased
            ? '#d2a8ff'
            : (anim.isPregnant ? '#ffa657' : (energyPct > 0.5 ? '#3fb950' : (energyPct > 0.25 ? '#e3b341' : '#f78166')));
          ctx.fillRect(anim.x - barW/2, anim.y - 18, barW * energyPct, barH);
          ctx.restore();
        } catch (err) {
          ctx.restore();
        }
      });
    }

    if (engine.selectedEntity) {
      const isAlive = engine.selectedEntity.type === 'animal'
        ? engine.animals.includes(engine.selectedEntity.data)
        : engine.plants.includes(engine.selectedEntity.data);

      if (!isAlive) {
        engine.selectedEntity = null;
        this.updateInspectorUI();
      } else {
        const e = engine.selectedEntity.data;
        ctx.save();
        ctx.strokeStyle = '#3fb950';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(e.x, e.y, 22, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    const effectiveTemp = SEASONS[engine.seasonIndex].temp + (engine.climateTrend || 0);
    if (Math.abs(effectiveTemp) > 0.12) {
      ctx.save();
      if (effectiveTemp < 0) {
        const coldAlpha = Math.min(0.24, Math.abs(effectiveTemp) * 0.20);
        ctx.fillStyle = `rgba(80, 160, 255, ${coldAlpha})`;
      } else {
        const heatAlpha = Math.min(0.22, effectiveTemp * 0.18);
        ctx.fillStyle = `rgba(255, 170, 40, ${heatAlpha})`;
      }
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // Catástrofes e meteoros
    if (engine.disasterEffects && engine.disasterEffects.length > 0) {
      for (let i = engine.disasterEffects.length - 1; i >= 0; i--) {
        const eff = engine.disasterEffects[i];
        if (eff.type === 'meteor') {
          if (eff.phase === 'falling') {
            eff.progress += eff.fallSpeed;
            const curX = eff.startX + (eff.targetX - eff.startX) * eff.progress;
            const curY = eff.startY + (eff.targetY - eff.startY) * eff.progress;

            ctx.save();
            ctx.strokeStyle = '#ff6f00';
            ctx.lineWidth = 6;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(eff.startX, eff.startY);
            ctx.lineTo(curX, curY);
            ctx.stroke();

            ctx.strokeStyle = '#fff9c4';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(curX - (eff.targetX - eff.startX) * 0.35, curY - (eff.targetY - eff.startY) * 0.35);
            ctx.lineTo(curX, curY);
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(curX, curY, 6, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = 'rgba(255, 87, 34, 0.6)';
            ctx.beginPath();
            ctx.arc(curX, curY, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            if (eff.progress >= 1.0) {
              eff.phase = 'exploding';
              if (!eff.executedImpact) {
                eff.executedImpact = true;
                engine.applyMeteorPhysicalImpact(eff);
              }
            }
          } else if (eff.phase === 'exploding') {
            eff.explosionAge++;
            const t = eff.explosionAge / eff.maxExplosionAge;

            ctx.save();
            if (eff.explosionAge <= 3) {
              ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
              ctx.fillRect(0, 0, W, H);
            }

            eff.shockwaveRadius = t * eff.maxShockwaveRadius;
            const shockAlpha = Math.max(0, 1.0 - t);
            ctx.strokeStyle = `rgba(255, 140, 0, ${shockAlpha})`;
            ctx.lineWidth = Math.max(1, 4.5 * (1.0 - t));
            ctx.beginPath();
            ctx.arc(eff.targetX, eff.targetY, eff.shockwaveRadius, 0, Math.PI * 2);
            ctx.stroke();

            if (t > 0.15) {
              const t2 = (t - 0.15) / 0.85;
              ctx.strokeStyle = `rgba(255, 215, 0, ${Math.max(0, 0.8 - t2)})`;
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(eff.targetX, eff.targetY, t2 * eff.maxShockwaveRadius * 0.75, 0, Math.PI * 2);
              ctx.stroke();
            }

            ctx.fillStyle = `rgba(255, 69, 0, ${Math.max(0, 0.75 - t * 0.75)})`;
            ctx.beginPath();
            ctx.arc(eff.targetX, eff.targetY, eff.craterRadiusPx * (0.8 + t * 0.2), 0, Math.PI * 2);
            ctx.fill();

            eff.particles.forEach(p => {
              p.x += p.vx;
              p.y += p.vy;
              p.life -= p.decay;
              if (p.life > 0) {
                ctx.fillStyle = p.color;
                ctx.globalAlpha = Math.max(0, p.life);
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
                ctx.fill();
              }
            });
            ctx.restore();

            if (eff.explosionAge >= eff.maxExplosionAge) {
              engine.disasterEffects.splice(i, 1);
            }
          }
        }
      }
    }

    if (engine.impactWinterTicks > 0) {
      ctx.save();
      const intensity = Math.min(1.0, engine.impactWinterTicks / 50.0);
      ctx.fillStyle = `rgba(45, 35, 30, ${0.30 * intensity})`;
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = 'rgba(200, 190, 180, 0.45)';
      const ashSeed = (engine.tickCount * 2) % 100;
      for (let s = 0; s < 22; s++) {
        const ax = ((s * 47 + ashSeed * 7) % W);
        const ay = ((s * 31 + engine.tickCount * 3) % H);
        ctx.fillRect(ax, ay, 2, 2);
      }
      ctx.restore();
    }
  }

  updateStatsUI() {
    const engine = this.engine;
    const elSeason = document.getElementById('sim-season-badge');
    const elGen = document.getElementById('sim-gen-badge');
    const elAnimals = document.getElementById('stat-animals-count');
    const elPlants = document.getElementById('stat-plants-count');
    const elCarcasses = document.getElementById('stat-carcasses-count');

    const curSeason = SEASONS[engine.seasonIndex];
    const effTemp = curSeason.temp + (engine.climateTrend || 0);
    const tempDeg = Math.round(18 + effTemp * 16);
    const climOff = engine.climateOffset || 0;
    const climSuffix = Math.abs(climOff) > 0.05
      ? ` <span style="color:${climOff > 0 ? '#f78166' : '#79c0ff'};font-size:10px;">${climOff > 0 ? '🔥' : '🧊'}${climOff > 0 ? '+' : ''}${Math.round(climOff * 16)}°</span>`
      : '';
    if (engine.impactWinterTicks > 0) {
      if (elSeason) elSeason.innerHTML = `☄️ Inverno Nuclear (${tempDeg - 10}°C) [${engine.impactWinterTicks}t]`;
    } else {
      if (elSeason) elSeason.innerHTML = `${curSeason.icon} ${curSeason.name} (${tempDeg}°C)${climSuffix}`;
    }
    if (elGen) elGen.textContent = `Geração ${engine.generation}`;
    if (elAnimals) elAnimals.textContent = engine.animals.length;
    if (elPlants) elPlants.textContent = engine.plants.length;
    if (elCarcasses) elCarcasses.textContent = engine.carcasses.length;

    this.updateCensusUI();

    if (engine.selectedEntity) {
      this.updateInspectorUI();
    }

    if (typeof window !== 'undefined' && window.systemConsole) {
      if (typeof window.systemConsole.updateConsoleHeader === 'function') window.systemConsole.updateConsoleHeader();
    }
  }

  updateCensusUI() {
    const engine = this.engine;
    const censusBox = document.getElementById('sim-species-census');
    if (!censusBox) return;

    if (engine.speciesCatalog.length === 0) {
      censusBox.innerHTML = '<span style="color:var(--text-dim);font-size:11px;">Nenhuma espécie cadastrada.</span>';
      return;
    }

    const animalCounts = {};
    engine.animals.forEach(a => {
      const sp = a.speciesName || a.name;
      animalCounts[sp] = (animalCounts[sp] || 0) + 1;
    });

    const plantCounts = {};
    engine.plants.forEach(p => {
      const sp = p.name;
      plantCounts[sp] = (plantCounts[sp] || 0) + 1;
    });

    const totalAnimals = engine.animals.length || 1;
    const totalPlants = engine.plants.length || 1;

    const animalSpecies = engine.speciesCatalog.filter(s => s.type === 'animal');
    const plantSpecies = engine.speciesCatalog.filter(s => s.type === 'plant');

    let html = '';

    if (animalSpecies.length > 0) {
      html += '<div style="font-weight:700;color:var(--text-dim);font-size:10px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;display:flex;justify-content:space-between;">' +
              '<span>🦊 População Animal (' + engine.animals.length + ')</span>' +
              '<span style="font-size:9px;text-transform:none;opacity:0.8;">(Clique para focar)</span></div>';

      animalSpecies.forEach(sp => {
        const count = animalCounts[sp.name] || 0;
        const pct = Math.min(100, Math.round((count / totalAnimals) * 100));
        const isExtinct = (count === 0);
        const isHighlighted = (engine.highlightedSpecies === sp.name);

        html += `
          <div class="census-row ${isHighlighted ? 'active-focus' : ''}"
               onclick="engine.toggleHighlightSpecies('${sp.name.replace(/'/g, "\\'")}')"
               title="Clique para destacar todos os exemplares de ${sp.name}"
               style="cursor:pointer; padding:4px 6px; border-radius:6px; margin-bottom:3px; transition:all .15s; ${isHighlighted ? `background:rgba(255,255,255,0.12); box-shadow:0 0 0 1.5px ${sp.color};` : ''} ${isExtinct ? 'opacity:0.35;filter:grayscale(1);' : ''}">
            <span class="census-name" title="${sp.name}" style="display:flex;align-items:center;gap:4px;">
              ${isHighlighted ? '👁️ ' : ''}${sp.name}
            </span>
            <div class="census-bar-wrap">
              <div class="census-bar" style="width:${pct}%;background:${sp.color};"></div>
            </div>
            <span class="census-val" style="color:${isExtinct ? 'var(--text-dim)' : sp.color};">${isExtinct ? '0 (Extinta)' : count}</span>
          </div>
        `;
      });
    }

    if (plantSpecies.length > 0) {
      html += '<div style="font-weight:700;color:var(--text-dim);font-size:10px;text-transform:uppercase;letter-spacing:.5px;margin-top:12px;margin-bottom:6px;display:flex;justify-content:space-between;">' +
              '<span>🌿 População Vegetal (' + engine.plants.length + ')</span>' +
              '<span style="font-size:9px;text-transform:none;opacity:0.8;">(Clique para focar)</span></div>';

      plantSpecies.forEach(sp => {
        const count = plantCounts[sp.name] || 0;
        const pct = Math.min(100, Math.round((count / totalPlants) * 100));
        const isExtinct = (count === 0);
        const isHighlighted = (engine.highlightedSpecies === sp.name);

        html += `
          <div class="census-row ${isHighlighted ? 'active-focus' : ''}"
               onclick="engine.toggleHighlightSpecies('${sp.name.replace(/'/g, "\\'")}')"
               title="Clique para destacar os vegetais de ${sp.name}"
               style="cursor:pointer; padding:4px 6px; border-radius:6px; margin-bottom:3px; transition:all .15s; ${isHighlighted ? `background:rgba(255,255,255,0.12); box-shadow:0 0 0 1.5px ${sp.color};` : ''} ${isExtinct ? 'opacity:0.35;filter:grayscale(1);' : ''}">
            <span class="census-name" title="${sp.name}" style="display:flex;align-items:center;gap:4px;">
              ${isHighlighted ? '👁️ ' : ''}${sp.name}
            </span>
            <div class="census-bar-wrap">
              <div class="census-bar" style="width:${pct}%;background:${sp.color};"></div>
            </div>
            <span class="census-val" style="color:${isExtinct ? 'var(--text-dim)' : sp.color};">${isExtinct ? '0' : count}</span>
          </div>
        `;
      });
    }

    censusBox.innerHTML = html;
  }

  updateInspectorUI() {
    const engine = this.engine;
    const panel = document.getElementById('sim-inspector');
    if (!panel) return;

    if (!engine.selectedEntity) {
      panel.innerHTML = '<span style="color:var(--text-dim);font-size:12px;">Clique em um animal ou vegetal na grade para inspecionar parâmetros fisiológicos, patologias e genótipo.</span>';
      return;
    }

    const { type, data } = engine.selectedEntity;
    if (type === 'animal') {
      const g = data.genes;
      const mass = (5.0 + g.size * 70.0).toFixed(1);
      const diet = g.diet || { meat: 0, plant: 1, carcass: 0 };
      const kleiber = (0.06 * Math.pow(mass / 40.0, 0.75)).toFixed(3);
      
      let healthStatus = '<span style="color:#3fb950;">Saudável</span>';
      if (data.isDiseased) {
        healthStatus = `<span style="color:#d2a8ff;font-weight:700;">☣️ Príon (${data.diseaseTimer}t)</span>`;
      } else if (data.isPregnant) {
        healthStatus = `<span style="color:#ffa657;font-weight:700;">🤰 Gestação (${data.gestationTicks}t)</span>`;
      }

      panel.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <span style="font-size:18px;">🦊</span>
          <div>
            <strong style="color:var(--text-main);font-size:13px;">${data.name}</strong>
            <div style="font-size:11px;color:var(--accent);">${data.stateLabel}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px;color:var(--text-muted);">
          <div>⚡ Energia: <strong style="color:var(--text-main);">${Math.round(data.energy)}%</strong></div>
          <div>⚖️ Massa: <strong style="color:var(--text-main);">${mass} kg</strong></div>
          <div>🔬 Kleiber: ${kleiber} cal/t</div>
          <div>🩺 Estado: ${healthStatus}</div>
          <div>⏳ Idade: ${data.age} ticks</div>
          <div>🐟 Aquático: <strong style="color:var(--text-main);">${Math.round((g.aquatic || 0.15) * 100)}%</strong></div>
          <div>🥩 Carne: ${Math.round(diet.meat * 100)}%</div>
          <div>🌿 Planta: ${Math.round(diet.plant * 100)}%</div>
          <div>🦴 Carcaça: ${Math.round(diet.carcass * 100)}%</div>
        </div>
      `;
    } else {
      const g = data.genes;
      panel.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <span style="font-size:18px;">🌿</span>
          <div>
            <strong style="color:var(--text-main);font-size:13px;">${data.name}</strong>
            <div style="font-size:11px;color:var(--accent);">${data.hasFruit ? 'Fruto Maduro (Dispersão)' : 'Em Crescimento'}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px;color:var(--text-muted);">
          <div>🌱 Biomassa: <strong style="color:var(--text-main);">${Math.round(data.growth * 100)}%</strong></div>
          <div>⏳ Idade: ${data.age} ticks</div>
          <div>🌾 Efic. Raiz: ${Math.round(g.rootEfficiency * 100)}%</div>
          <div>🛡️ Defesa/Lignina: ${Math.round(g.defense * 100)}%</div>
        </div>
      `;
    }
  }
}


// --- systems/MeteorSystem.js ---
// ====================================================
//  METEORSYSTEM.JS — Sistema de impacto de meteoros
// ====================================================



class MeteorSystem {
  constructor(engine) {
    this.engine = engine;
  }

  triggerMeteor(targetX = null, targetY = null) {
    const engine = this.engine;
    if (targetX === null || targetY === null) {
      if (engine.animals.length > 0 && Math.random() < 0.75) {
        const targetAnim = engine.animals[Math.floor(Math.random() * engine.animals.length)];
        targetX = targetAnim.x + (Math.random() * 40 - 20);
        targetY = targetAnim.y + (Math.random() * 40 - 20);
      } else {
        targetX = (0.2 + Math.random() * 0.6) * (engine.gridCols * engine.cellSize);
        targetY = (0.2 + Math.random() * 0.6) * (engine.gridRows * engine.cellSize);
      }
    }

    targetX = Math.max(25, Math.min(engine.gridCols * engine.cellSize - 25, targetX));
    targetY = Math.max(25, Math.min(engine.gridRows * engine.cellSize - 25, targetY));

    engine.disasterEffects ??= [];
    const meteorEffect = {
      type: 'meteor',
      phase: 'falling',
      startX: targetX - 260,
      startY: targetY - 360,
      targetX: targetX,
      targetY: targetY,
      progress: 0,
      fallSpeed: 0.065,
      explosionAge: 0,
      maxExplosionAge: 55,
      particles: [],
      shockwaveRadius: 0,
      maxShockwaveRadius: 220,
      craterRadiusPx: 90,
      executedImpact: false
    };

    for (let i = 0; i < 120; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3.0 + Math.random() * 11.0;
      meteorEffect.particles.push({
        x: targetX,
        y: targetY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2.5 + Math.random() * 5.5,
        color: Math.random() < 0.4 ? '#ff5722' : (Math.random() < 0.5 ? '#ffeb3b' : (Math.random() < 0.5 ? '#ffffff' : '#ff9800')),
        life: 1.0,
        decay: 0.012 + Math.random() * 0.025
      });
    }

    engine.disasterEffects.push(meteorEffect);

    if (typeof toast === 'function') {
      toast('☄️ CATÁSTROFE: Meteoro penetrou na atmosfera em direção ao quadrante!');
    }
  }

  applyMeteorPhysicalImpact(effect) {
    const engine = this.engine;
    const targetX = effect.targetX;
    const targetY = effect.targetY;
    const craterCellRadius = 4.5;
    const shockRadiusPx = effect.maxShockwaveRadius || 220;

    let destroyedPlants = 0;
    let vaporizedAnimals = 0;
    let damagedAnimals = 0;

    for (let r = 0; r < engine.gridRows; r++) {
      for (let c = 0; c < engine.gridCols; c++) {
        const cell = engine.grid[r]?.[c];
        if (!cell) continue;

        const cellCenterX = (c + 0.5) * engine.cellSize;
        const cellCenterY = (r + 0.5) * engine.cellSize;
        const dist = Math.hypot(cellCenterX - targetX, cellCenterY - targetY);
        const distInCells = dist / engine.cellSize;

        if (distInCells <= craterCellRadius) {
          // Cratera: vira rocky, perde todo nutriente
          cell.biome = 'rocky';
          cell.soilNitrogen = 0;
          cell.moisture = 0;
          cell.organicBiomass = 0;
          cell.addOrganicBiomass(5.0);

          if (cell.plant) {
            const pIdx = engine.plants.indexOf(cell.plant);
            if (pIdx !== -1) engine.plants.splice(pIdx, 1);
            cell.plant = null;
            engine.plantMetrics.nutrientDeaths++;
            destroyedPlants++;
          }
        } else if (dist <= shockRadiusPx * 0.45) {
          // Zona de incêndio próxima: solo danificado severamente
          cell.moisture = Math.max(0, cell.moisture * 0.1);
          cell.soilNitrogen = Math.max(0, cell.soilNitrogen * 0.15);
          if (cell.plant) {
            const pIdx = engine.plants.indexOf(cell.plant);
            if (pIdx !== -1) engine.plants.splice(pIdx, 1);
            cell.plant = null;
            engine.plantMetrics.nutrientDeaths++;
            destroyedPlants++;
          }
        } else if (dist <= shockRadiusPx) {
          // Zona de onda de choque: dano parcial
          const factor = 1.0 - (dist / shockRadiusPx);
          cell.moisture = Math.max(0.05, cell.moisture * (1.0 - factor * 0.7));
          cell.soilNitrogen = Math.max(2, cell.soilNitrogen * (1.0 - factor * 0.5));
          if (cell.plant && Math.random() < 0.55 + factor * 0.4) {
            const pIdx = engine.plants.indexOf(cell.plant);
            if (pIdx !== -1) engine.plants.splice(pIdx, 1);
            cell.plant = null;
            engine.plantMetrics.nutrientDeaths++;
            destroyedPlants++;
          }
        }
      }
    }

    for (let i = engine.animals.length - 1; i >= 0; i--) {
      const a = engine.animals[i];
      const dist = Math.hypot(a.x - targetX, a.y - targetY);

      if (dist <= effect.craterRadiusPx) {
        // Cratera: morte instantânea garantida
        const ar = Math.floor(a.y / engine.cellSize);
        const ac = Math.floor(a.x / engine.cellSize);
        const cell = engine.grid[ar]?.[ac];
        if (cell && !cell.carcass) {
          const carcass = new Carcass(
            'carcass_' + Math.random().toString(36).substr(2, 9),
            a.speciesName || a.name,
            a.x, a.y,
            ar, ac,
            20.0,
            a.genes
          );
          cell.carcass = carcass;
          engine.carcasses.push(carcass);
        }
        engine.animals.splice(i, 1);
        vaporizedAnimals++;
      } else if (dist <= shockRadiusPx * 0.45) {
        // Zona próxima: dano altíssimo, quase letal
        const factor = 1.0 - (dist / (shockRadiusPx * 0.45));
        const damage = 60.0 + factor * 110.0;
        a.energy -= damage;
        const angle = Math.atan2(a.y - targetY, a.x - targetX);
        a.vx += Math.cos(angle) * (factor * 18.0);
        a.vy += Math.sin(angle) * (factor * 18.0);
        a.stateLabel = '🔥 Vaporizado pela Explosão!';
        if (a.energy <= 0) {
          engine.animals.splice(i, 1);
          vaporizedAnimals++;
        } else {
          a.isDiseased = true;
          a.diseaseTimer = (a.diseaseTimer || 0) + 180;
          damagedAnimals++;
        }
      } else if (dist <= shockRadiusPx) {
        // Zona de onda de choque: dano moderado + arremesso
        const factor = 1.0 - (dist / shockRadiusPx);
        const damage = factor * 90.0;
        a.energy -= damage;
        const angle = Math.atan2(a.y - targetY, a.x - targetX);
        const impulse = factor * 14.0;
        a.vx += Math.cos(angle) * impulse;
        a.vy += Math.sin(angle) * impulse;
        a.stateLabel = '💥 Queimado por Onda de Choque!';
        if (a.energy <= 0) {
          engine.animals.splice(i, 1);
          vaporizedAnimals++;
        } else {
          damagedAnimals++;
        }
      }
    }

    engine.createTerrainCache();
    engine.impactWinterTicks = 280;

    const msg = `💥 CATÁSTROFE! ${vaporizedAnimals} animais e ${destroyedPlants} plantas eliminados! Inverno Nuclear ativo por 280 ticks!`;
    if (typeof toast === 'function') toast(msg, 5500);
    console.log('[CATÁSTROFE]', msg);
  }
}


// --- systems/ClimateSystem.js ---
// ====================================================
//  CLIMATESYSTEM.JS — Sistema de mudança climática global
// ====================================================

class ClimateSystem {
  constructor() {
    this.climateOffset = 0.0;
  }

  /**
   * Desloca o offset permanente de temperatura para simular mudanças climáticas.
   * @param {number} delta — valor entre -0.5 e +0.5 (cada unidade ≈ 8°C)
   */
  shift(delta) {
    this.climateOffset = Math.max(-1.5, Math.min(1.5, (this.climateOffset || 0) + delta));
    const offsetC = Math.round(this.climateOffset * 16);
    const sign = offsetC >= 0 ? '+' : '';
    const icon = this.climateOffset > 0.3 ? '🔥' : (this.climateOffset < -0.3 ? '🧊' : '🌡️');
    if (typeof toast === 'function') {
      toast(`${icon} Mudança Climática: temperatura base ${sign}${offsetC}°C (offset acumulado)`);
    }
  }

  reset() {
    this.climateOffset = 0.0;
  }

  /**
   * Computa a tendência climática atual baseada em geração e tick.
   * @param {number} tick — tickCount atual do motor
   * @param {number} generation — geração atual
   * @returns {number} climateTrend
   */
  computeTrend(tick, generation) {
    return (this.climateOffset || 0) + (-0.00015 * generation + Math.sin(tick * 0.0012) * 0.25);
  }
}


// --- systems/EcologyManager.js ---
// ====================================================
//  ECOLOGYMANAGER.JS — Gerenciamento de equilíbrio ecológico
// ====================================================

class EcologyManager {
  constructor(engine) {
    this.engine = engine;
  }

  initEquilibriumSettings() {
    this.engine.equilibriumSettings = {
      autoHomeostasis: true,
      seedBankRate: 0.14,
      grazingResilience: 0.85,
      predatorSatietyThreshold: 0.65,
      fleePerceptionFactor: 1.0,
      mutationRateMultiplier: 1.0,
      vegetativeSpreading: true
    };
  }

  performEmergencyEcologicalRescue() {
    const engine = this.engine;
    for (let r = 0; r < engine.gridRows; r++) {
      for (let c = 0; c < engine.gridCols; c++) {
        const cell = engine.grid[r][c];
        if (cell.biome !== 'water') {
          cell.soilNitrogen = Math.min(100, cell.soilNitrogen + 25.0);
          cell.moisture = Math.max(0.40, cell.moisture);
        }
      }
    }

    const neededPlants = Math.max(0, 45 - engine.plants.length);
    if (neededPlants > 0) {
      for (let i = 0; i < neededPlants; i++) {
        const r = Math.floor(Math.random() * engine.gridRows);
        const c = Math.floor(Math.random() * engine.gridCols);
        engine.spawnSinglePlant('Grama Pioneira', { growthSpeed: 0.7, rootEfficiency: 0.7, height: 0.35, defense: 0.2 }, {}, r, c);
      }
    }

    if (typeof toast === 'function') {
      toast('🚑 Intervenção de Emergência executada: solo nutrido e plantas pioneiras semeadas!');
    }
  }

  handleExtinction() {
    const engine = this.engine;
    engine.pause();
    const modal = document.getElementById('extinction-modal');
    if (modal) {
      document.getElementById('extinction-gen').textContent = engine.generation;
      document.getElementById('extinction-ticks').textContent = engine.tickCount;
      modal.style.display = 'flex';
    }
  }

  reinjectPioneers(count = 18) {
    const engine = this.engine;
    if (!Number.isFinite(count) || count <= 0) return;
    const speciesList = engine.worldConfig?.speciesCounts?.animals;

    if (speciesList && speciesList.length > 0) {
      const availableSpecies = speciesList.filter(sp => sp && sp.name && sp.genes);
      if (availableSpecies.length === 0) return;
      const baseCount = Math.floor(count / availableSpecies.length);
      const remainder = count % availableSpecies.length;

      availableSpecies.forEach((sp, index) => {
        const amount = baseCount + (index < remainder ? 1 : 0);
        engine.spawnSpeciesInClusters(sp.name, sp.genes, sp.customImages || {}, amount);
      });
      return;
    }

    const savedAnimals = JSON.parse(localStorage.getItem('evo_animals') || '[]');
    if (savedAnimals.length > 0) {
      const baseCount = Math.floor(count / savedAnimals.length);
      const remainder = count % savedAnimals.length;
      savedAnimals.forEach((sp, index) => {
        const amount = baseCount + (index < remainder ? 1 : 0);
        engine.spawnSpeciesInClusters(sp.name, sp.genes, sp.customImages || {}, amount);
      });
      return;
    }

    const predCount = Math.max(1, Math.round(count * 0.15));
    const herbCount = count - predCount;
    const herbGenes = {
      size: 0.35, diet: { meat: 0.0, plant: 0.90, carcass: 0.10 },
      speed: 0.60, perception: 0.65, gestation: 0.30, offspringCount: 0.70,
      aggression: 0.10, health: 0.60, thermal: 0.0, colorHue: 125
    };
    const predGenes = {
      size: 0.65, diet: { meat: 0.85, plant: 0.05, carcass: 0.10 },
      speed: 0.70, perception: 0.80, gestation: 0.50, offspringCount: 0.35,
      aggression: 0.75, health: 0.60, thermal: 0.0, colorHue: 15
    };

    engine.spawnSpeciesInClusters('Herbívoro Campestre', herbGenes, {}, herbCount);
    engine.spawnSpeciesInClusters('Predador Alfa', predGenes, {}, predCount);
  }
}


// --- world/WorldGenerator.js ---
// ====================================================
//  WORLDGENERATOR.JS — Geração de terreno e população inicial
// ====================================================





class WorldGenerator {
  constructor(engine) {
    this.engine = engine; // referência ao SimulationEngine para grid/animals/plants arrays
  }

  buildGrid(biomeType) {
    const engine = this.engine;
    engine.grid = [];
    const baseColors = {
      fertile: '#2d6a3f',
      arid: '#7a5c2e',
      tundra: '#3d5a72',
      wetland: '#2a6655',
      water: '#1a4a7a',
      rocky: '#4a4a4a'
    };

    for (let r = 0; r < engine.gridRows; r++) {
      const row = [];
      for (let c = 0; c < engine.gridCols; c++) {
        let b = biomeType;
        if (Math.random() < 0.08) b = 'water';
        else if (Math.random() < 0.06) b = 'rocky';

        const cell = new GridCell(r, c, engine.cellSize, b);
        cell.elevation = Math.random();
        cell.moisture = b === 'water' ? 1.0 : (b === 'wetland' ? 0.85 : (b === 'arid' ? 0.2 : 0.6));
        cell.maxSoilNitrogen = b === 'fertile' ? 120 : (b === 'arid' ? 45 : (b === 'tundra' ? 55 : (b === 'wetland' ? 90 : 20)));
        cell.soilNitrogen = cell.maxSoilNitrogen * (0.5 + Math.random() * 0.4);
        cell.organicBiomass = Math.random() * 5.0;

        const base = baseColors[b] || '#2d6a3f';
        const lum = Math.floor((Math.random() - 0.5) * 18);
        cell.cachedColor = this.adjustColor(base, lum);

        row.push(cell);
      }
      engine.grid.push(row);
    }
  }

  adjustColor(hex, amt) {
    let num = parseInt(hex.slice(1), 16);
    let r = Math.min(255, Math.max(0, (num >> 16) + amt));
    let g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amt));
    let b = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }

  createTerrainCache() {
    const engine = this.engine;
    if (!engine.canvas) return;
    if (!engine.terrainCanvas) {
      engine.terrainCanvas = document.createElement('canvas');
    }
    engine.terrainCanvas.width = engine.canvas.width;
    engine.terrainCanvas.height = engine.canvas.height;
    const tctx = engine.terrainCanvas.getContext('2d');
    if (!tctx) return;

    const baseColors = {
      fertile: '#2d6a3f',
      arid: '#7a5c2e',
      tundra: '#3d5a72',
      wetland: '#2a6655',
      water: '#1a4a7a',
      rocky: '#4a4a4a'
    };

    for (let r = 0; r < engine.gridRows; r++) {
      for (let c = 0; c < engine.gridCols; c++) {
        const cell = engine.grid[r][c];
        tctx.fillStyle = cell.cachedColor || baseColors[cell.biome] || '#2d6a3f';
        tctx.fillRect(c * engine.cellSize, r * engine.cellSize, engine.cellSize, engine.cellSize);

        if (engine.showGridLines) {
          tctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
          tctx.lineWidth = 1;
          tctx.strokeRect(c * engine.cellSize, r * engine.cellSize, engine.cellSize, engine.cellSize);
        }
      }
    }
  }

  spawnInitialPlants(count) {
    const engine = this.engine;
    engine.plants = [];
    const speciesList = engine.worldConfig?.speciesCounts?.plants;

    if (speciesList && speciesList.length > 0) {
      speciesList.forEach(sp => {
        const n = sp.count || 10;
        for (let i = 0; i < n; i++) {
          const r = Math.floor(Math.random() * engine.gridRows);
          const c = Math.floor(Math.random() * engine.gridCols);
          this.spawnSinglePlant(sp.name, sp.genes, sp.customImages || {}, r, c);
        }
      });
      return;
    }

    const targetCount = count || 40;
    for (let i = 0; i < targetCount; i++) {
      const r = Math.floor(Math.random() * engine.gridRows);
      const c = Math.floor(Math.random() * engine.gridCols);
      this.spawnSinglePlant('Grama Comum', { growthSpeed: 0.6, height: 0.4, defense: 0.25, rootEfficiency: 0.6 }, {}, r, c);
    }
  }

  spawnSinglePlant(name, genes, customImages, targetR, targetC) {
    const engine = this.engine;
    const r = (targetR !== undefined) ? targetR : Math.floor(Math.random() * engine.gridRows);
    const c = (targetC !== undefined) ? targetC : Math.floor(Math.random() * engine.gridCols);
    const cell = engine.grid[r]?.[c];
    if (!cell || cell.biome === 'water' || cell.plant) return null;

    engine.registerSpecies(name, 'plant', genes);
    const plant = new Plant(
      'plant_' + Math.random().toString(36).substr(2, 9),
      name || 'Vegetal',
      r, c,
      engine.cellSize,
      genes,
      customImages
    );
    if (engine.tickCount === 0) {
      plant.age = Math.floor(Math.random() * 120);
      plant.growth = 0.25 + Math.random() * 0.45;
    }
    cell.plant = plant;
    engine.plants.push(plant);
    return plant;
  }

  spawnSpeciesInClusters(name, genes, customImages, count, clusterCount = 3) {
    const engine = this.engine;
    const validCells = [];
    for (let r = 0; r < engine.gridRows; r++) {
      for (let c = 0; c < engine.gridCols; c++) {
        if (engine.grid[r][c].biome !== 'water') {
          validCells.push({
            x: (c + 0.5) * engine.cellSize,
            y: (r + 0.5) * engine.cellSize
          });
        }
      }
    }

    if (validCells.length === 0) return;

    engine.spawnGroupCenters ??= [];
    const minCenterDist = Math.max(120, Math.min(engine.canvas.width, engine.canvas.height) * 0.28);
    const centers = [];
    const actualClusters = Math.min(clusterCount, Math.max(1, Math.floor(count / 2)));

    for (let k = 0; k < actualClusters; k++) {
      let chosen = null, maxDistToOthers = -1;
      for (let attempt = 0; attempt < 30; attempt++) {
        const candidate = validCells[Math.floor(Math.random() * validCells.length)];
        let minDist = Infinity;
        const allExisting = [...engine.spawnGroupCenters, ...centers];
        allExisting.forEach(existing => {
          const d = Math.hypot(candidate.x - existing.x, candidate.y - existing.y);
          if (d < minDist) minDist = d;
        });

        if (minDist >= minCenterDist) { chosen = candidate; break; }
        if (minDist > maxDistToOthers) { maxDistToOthers = minDist; chosen = candidate; }
      }
      const finalCenter = chosen || validCells[Math.floor(Math.random() * validCells.length)];
      centers.push(finalCenter);
      engine.spawnGroupCenters.push(finalCenter);
    }

    const basePerCluster = Math.floor(count / centers.length);
    let remainder = count % centers.length;

    centers.forEach((center, idx) => {
      const clusterSize = basePerCluster + (idx < remainder ? 1 : 0);
      for (let i = 0; i < clusterSize; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 45;
        const targetX = Math.max(15, Math.min((engine.gridCols * engine.cellSize) - 15, center.x + Math.cos(angle) * radius));
        const targetY = Math.max(15, Math.min((engine.gridRows * engine.cellSize) - 15, center.y + Math.sin(angle) * radius));
        this.spawnAnimal(name, genes, customImages, targetX, targetY);
      }
    });
  }

  spawnInitialAnimals(count) {
    const engine = this.engine;
    engine.animals = [];
    engine.carcasses = [];
    engine.spawnGroupCenters = [];
    const speciesList = engine.worldConfig?.speciesCounts?.animals;

    if (speciesList && speciesList.length > 0) {
      speciesList.forEach(sp => {
        const n = sp.count || 6;
        const isCarnivore = (sp.genes?.diet?.meat || 0) > 0.45;
        const clusters = isCarnivore ? Math.max(1, Math.round(n / 3)) : Math.max(2, Math.round(n / 6));
        this.spawnSpeciesInClusters(sp.name, sp.genes, sp.customImages || {}, n, clusters);
      });
      return;
    }

    const defaultGenesHerb = {
      size: 0.4, diet: { meat: 0.05, plant: 0.85, carcass: 0.10 },
      speed: 0.6, perception: 0.6, health: 0.6, thermal: 0.0, colorHue: 120
    };
    const defaultGenesCarn = {
      size: 0.65, diet: { meat: 0.80, plant: 0.05, carcass: 0.15 },
      speed: 0.7, perception: 0.8, aggression: 0.7, health: 0.6, thermal: 0.0, colorHue: 15
    };

    const predCount = Math.max(1, Math.round((count || 20) * 0.15));
    const herbCount = Math.max(4, (count || 20) - predCount);

    this.spawnSpeciesInClusters('Lebre Saltadora', defaultGenesHerb, {}, herbCount, 3);
    this.spawnSpeciesInClusters('Lobo Caçador', defaultGenesCarn, {}, predCount, 2);
  }

  findLandCenter() {
    const engine = this.engine;
    let sumX = 0, sumY = 0, count = 0;
    for (let r = 0; r < engine.gridRows; r++) {
      for (let c = 0; c < engine.gridCols; c++) {
        if (engine.grid[r][c].biome !== 'water') {
          sumX += (c + 0.5) * engine.cellSize;
          sumY += (r + 0.5) * engine.cellSize;
          count++;
        }
      }
    }
    if (count > 0) return { x: sumX / count, y: sumY / count };
    return { x: (engine.gridCols * engine.cellSize) / 2, y: (engine.gridRows * engine.cellSize) / 2 };
  }

  spawnAnimal(name, genes, customImages, targetX = null, targetY = null) {
    const engine = this.engine;
    let rx, ry;
    if (targetX !== null && targetY !== null) {
      rx = targetX;
      ry = targetY;
      const cr = Math.floor(ry / engine.cellSize);
      const cc = Math.floor(rx / engine.cellSize);
      if (engine.grid[cr]?.[cc]?.biome === 'water') {
        const { x: centerX, y: centerY } = this.findLandCenter();
        rx = centerX;
        ry = centerY;
      }
    } else {
      const land = this.findLandCenter();
      rx = land.x;
      ry = land.y;
    }

    const animalGenes = {
      ...genes,
      diet: genes.diet ? { ...genes.diet } : { meat: 0.05, plant: 0.85, carcass: 0.10 }
    };

    engine.registerSpecies(name, 'animal', genes);

    const animal = new Animal(
      'anim_' + Math.random().toString(36).substr(2, 9),
      name || 'Criatura',
      name || 'Criatura',
      rx, ry,
      animalGenes,
      customImages
    );

    if (engine.tickCount === 0) {
      animal.age = Math.floor(Math.random() * 260);
    }
    engine.animals.push(animal);
    return animal;
  }
}


// --- SimulationEngine.js ---
// ====================================================
//  SIMULATIONENGINE.JS — Motor principal da simulação ecológica
//  Motor enxuto: apenas loop/tick/estado/coordenação
// ====================================================











class SimulationEngine {
  constructor() {
    this.showGridLines = true;
    this.climateTrend = 0.0;
    this.hydrologyTimer = 0;

    this.gridCols = 32;
    this.gridRows = 22;
    this.cellSize = 26;
    this.grid = [];
    this.animals = [];
    this.plants = [];
    this.carcasses = [];

    this.tickCount = 0;
    this.seasonIndex = 0;
    this.seasonLength = 120;
    this.generation = 1;

    this.isRunning = false;
    this.speed = 1;
    this.animFrameId = null;

    this.selectedEntity = null;
    this.highlightedSpecies = null;
    this.canvas = null;
    this.ctx = null;
    this.worldConfig = null;

    this.speciesCatalog = [];
    this.speciesRegistry = {};

    this.history = [];
    this.disasterEffects = [];
    this.impactWinterTicks = 0;

    this.plantMetrics = {
      reproduced: 0,
      nutrientDeaths: 0,
      ageDeaths: 0,
      floodDeaths: 0,
      grazingDeaths: 0,
      growthUpdates: 0,
      growthBlocked: 0
    };

    this.animalMetrics = {
      energyDeaths: 0,
      ageDeaths: 0,
      sickDeaths: 0,
      healthyDeaths: 0,
      juvenileDeaths: 0,
      adultDeaths: 0
    };

    this.historyInterval = 10;
    this.latestDiagnostics = null;
    this.spawnGroupCenters = [];

    // Subsistemas
    this.worldGen = new WorldGenerator(this);
    this._renderer = new Renderer(this);
    this.meteor = new MeteorSystem(this);
    this.climate = new ClimateSystem();
    this.ecology = new EcologyManager(this);

    // Inicializa climateOffset a partir do sistema de clima
    this.ecology.initEquilibriumSettings();
  }

  // ── Propriedade de ponte: climateOffset ──────────────────
  get climateOffset() { return this.climate.climateOffset; }
  set climateOffset(v) { this.climate.climateOffset = v; }

  // ── Delegações para subsistemas ──────────────────────────
  buildGrid(b) { return this.worldGen.buildGrid(b); }
  createTerrainCache() { return this.worldGen.createTerrainCache(); }
  adjustColor(hex, amt) { return this.worldGen.adjustColor(hex, amt); }
  spawnInitialPlants(count) { return this.worldGen.spawnInitialPlants(count); }
  spawnSinglePlant(name, genes, customImages, r, c) { return this.worldGen.spawnSinglePlant(name, genes, customImages, r, c); }
  spawnSpeciesInClusters(name, genes, customImages, count, clusters) { return this.worldGen.spawnSpeciesInClusters(name, genes, customImages, count, clusters); }
  spawnInitialAnimals(count) { return this.worldGen.spawnInitialAnimals(count); }
  findLandCenter() { return this.worldGen.findLandCenter(); }
  spawnAnimal(name, genes, customImages, x, y) { return this.worldGen.spawnAnimal(name, genes, customImages, x, y); }

  render() { return this._renderer.render(); }
  updateStatsUI() { return this._renderer.updateStatsUI(); }
  updateCensusUI() { return this._renderer.updateCensusUI(); }
  updateInspectorUI() { return this._renderer.updateInspectorUI(); }

  triggerMeteor(x, y) { return this.meteor.triggerMeteor(x, y); }
  applyMeteorPhysicalImpact(effect) { return this.meteor.applyMeteorPhysicalImpact(effect); }

  /**
   * Desloca o offset permanente de temperatura para simular mudanças climáticas.
   * @param {number} delta — valor entre -0.5 e +0.5 (cada unidade ≈ 8°C)
   */
  shiftClimate(d) { return this.climate.shift(d); }

  initEquilibriumSettings() { return this.ecology.initEquilibriumSettings(); }
  performEmergencyEcologicalRescue() { return this.ecology.performEmergencyEcologicalRescue(); }
  handleExtinction() { return this.ecology.handleExtinction(); }
  reinjectPioneers(count) { return this.ecology.reinjectPioneers(count); }

  // ── Lógica principal do motor ────────────────────────────

  init(canvas, worldConfig) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.worldConfig = worldConfig || {};

    const sz = worldConfig.size || 'medium';
    if (sz === 'small') { this.gridCols = 24; this.gridRows = 16; }
    else if (sz === 'large') { this.gridCols = 40; this.gridRows = 28; }
    else { this.gridCols = 32; this.gridRows = 22; }

    this.canvas.width = this.gridCols * this.cellSize;
    this.canvas.height = this.gridRows * this.cellSize;

    this.tickCount = 0;
    this.generation = 1;
    this.seasonIndex = 0;
    this.selectedEntity = null;
    this.history = [];
    this.speciesCatalog = [];
    this.speciesRegistry = {};
    this.spawnGroupCenters = [];

    this.buildGrid(worldConfig.biome || 'fertile');
    const biomeStats = {};
    for (const row of this.grid) {
      for (const cell of row) {
        if (!biomeStats[cell.biome]) {
          biomeStats[cell.biome] = 0;
        }
        biomeStats[cell.biome]++;
      }
    }

    const animalConfig = worldConfig.speciesCounts?.animals || [];
    const plantConfig = worldConfig.speciesCounts?.plants || [];

    const totalInitAnimals = animalConfig.reduce((acc, s) => acc + (s.count || 0), 0) || 20;
    const totalInitPlants = plantConfig.reduce((acc, s) => acc + (s.count || 0), 0) || 50;

    this.spawnInitialPlants(totalInitPlants);
    this.spawnInitialAnimals(totalInitAnimals);

    this.terrainCanvas = null;
    this.createTerrainCache();

    this.updateStatsUI();
    this.updateCensusUI();
    this.render();
  }

  toggleHighlightSpecies(speciesName) {
    if (this.highlightedSpecies === speciesName) {
      this.highlightedSpecies = null;
      if (typeof toast === 'function') {
        toast('Foco cancelado: exibindo todas as espécies normalmente.');
      }
    } else {
      this.highlightedSpecies = speciesName;
      if (typeof toast === 'function') {
        toast(`Foco ativo: destacando "${speciesName}" (outras esmaecidas).`);
      }
    }
    this.render();
    this.updateCensusUI();
  }

  toggleGridLines() {
    this.showGridLines = !this.showGridLines;
    this.terrainCanvas = null;
    this.createTerrainCache();
    this.render();
  }

  registerSpecies(name, type, genes, ancestor = null, rootName = null, divergentTrait = null) {
    if (!this.speciesRegistry[name]) {
      const color = SPECIES_PALETTE[this.speciesCatalog.length % SPECIES_PALETTE.length];
      const entry = {
        name: name,
        type: type,
        color: color,
        originGeneration: this.generation,
        originTick: this.tickCount,
        ancestor: ancestor,
        rootName: rootName || name,
        divergentTrait: divergentTrait,
        founderGenes: JSON.parse(JSON.stringify(genes || {}))
      };
      this.speciesRegistry[name] = entry;
      this.speciesCatalog.push(entry);
      return true;
    }
    return false;
  }

  recordHistorySnapshot() {
    const snap = {
      tick: this.tickCount,
      generation: this.generation,
      animals: this.animals.length,
      plants: this.plants.length,
      carcasses: this.carcasses.length,
      animalSpecies: {},
      plantSpecies: {},
      speciesGeneAverages: {}
    };

    const geneSums = {};
    const geneCounts = {};

    this.animals.forEach(a => {
      const sp = a.speciesName || a.name;
      snap.animalSpecies[sp] = (snap.animalSpecies[sp] || 0) + 1;

      if (!geneSums[sp]) {
        geneSums[sp] = { size: 0, speed: 0, perception: 0, aggression: 0, count: 0 };
        geneCounts[sp] = 0;
      }
      const g = a.genes || {};
      geneSums[sp].size += (g.size ?? 0.5);
      geneSums[sp].speed += (g.speed ?? 0.5);
      geneSums[sp].perception += (g.perception ?? 0.5);
      geneSums[sp].aggression += (g.aggression ?? 0.3);
      geneCounts[sp]++;
    });

    Object.keys(geneSums).forEach(sp => {
      const n = geneCounts[sp] || 1;
      snap.speciesGeneAverages[sp] = {
        size: parseFloat((geneSums[sp].size / n).toFixed(3)),
        speed: parseFloat((geneSums[sp].speed / n).toFixed(3)),
        perception: parseFloat((geneSums[sp].perception / n).toFixed(3)),
        aggression: parseFloat((geneSums[sp].aggression / n).toFixed(3))
      };
    });

    const plantSums = {};
    const plantCounts = {};
    this.plants.forEach(p => {
      const sp = p.name;
      snap.plantSpecies[sp] = (snap.plantSpecies[sp] || 0) + 1;

      if (!plantSums[sp]) {
        plantSums[sp] = { height: 0, rootEfficiency: 0, growthSpeed: 0, defense: 0, count: 0 };
        plantCounts[sp] = 0;
      }
      const g = p.genes || {};
      plantSums[sp].height += (g.height ?? 0.5);
      plantSums[sp].rootEfficiency += (g.rootEfficiency ?? 0.5);
      plantSums[sp].growthSpeed += (g.growthSpeed ?? 0.5);
      plantSums[sp].defense += (g.defense ?? 0.3);
      plantCounts[sp]++;
    });

    Object.keys(plantSums).forEach(sp => {
      const n = plantCounts[sp] || 1;
      snap.speciesGeneAverages[sp] = {
        height: parseFloat((plantSums[sp].height / n).toFixed(3)),
        rootEfficiency: parseFloat((plantSums[sp].rootEfficiency / n).toFixed(3)),
        growthSpeed: parseFloat((plantSums[sp].growthSpeed / n).toFixed(3)),
        defense: parseFloat((plantSums[sp].defense / n).toFixed(3))
      };
    });

    this.history.push(snap);
    if (this.history.length > 250) {
      this.history.shift();
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.loop();
  }

  pause() {
    this.isRunning = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  toggle() {
    if (this.isRunning) this.pause();
    else this.start();
  }

  setSpeed(s) {
    this.speed = Math.max(1, Math.min(10, s));
  }

  fastForward(ticks) {
    for (let i = 0; i < ticks; i++) {
      this.updateTick();
    }
    this.render();
    this.updateStatsUI();
  }

  loop() {
    if (!this.isRunning) return;
    for (let i = 0; i < this.speed; i++) {
      this.updateTick();
    }
    this.render();
    this.updateStatsUI();
    this.animFrameId = requestAnimationFrame(() => this.loop());
  }

  updateTick() {
    this.tickCount++;

    const carnivoresList = [];
    const herbivoresList = [];
    const aTotal = this.animals.length;
    for (let i = 0; i < aTotal; i++) {
      const a = this.animals[i];
      if ((a.genes?.diet?.meat || 0) > 0.45) carnivoresList.push(a);
      else herbivoresList.push(a);
    }
    this._carnivores = carnivoresList;
    this._herbivores = herbivoresList;

    this.aiMetrics ??= {
      fleeEvents: 0,
      herbivoreMeals: 0,
      plantTargets: 0,
      plantApproaches: 0,
      carcassMeals: 0,
      herbivoreCarcassMeals: 0,
      carnivoreCarcassMeals: 0,
      carcassTargets: 0,
      carcassDistanceTotal: 0,
      carcassFarTargets: 0,
      carcassMaxDistance: 0,
      prionInfections: 0,
      crowdInfections: 0,
      cannibalAttacks: 0,
      otherSpeciesKills: 0,
      carnivorePreyKills: 0,
      nonCarnivorePreyKills: 0
    };

    // Diagnósticos a cada 100 ciclos
    if (this.tickCount % 100 === 0) {
      let totalNeighbors = 0, maxNeighbors = 0, animalsAboveTwo = 0, animalsAboveFour = 0;
      let totalEnergy = 0, herbivoreEnergy = 0, carnivoreEnergy = 0, lowEnergyAnimals = 0, sickLowEnergyAnimals = 0;
      let herbivoreCount = 0, carnivoreCount = 0, minCarnivoreSize = Infinity, maxCarnivoreSize = -Infinity, totalCarnivoreSize = 0;
      let totalHerbivorePerception = 0, totalPredatorPerception = 0, maxHerbivorePerception = 0;
      let totalHerbivorePlant = 0, herbivoresWithPlantDiet = 0, herbivoresWithoutPlantDiet = 0;

      this.animals.forEach(anim => {
        let neighbors = 0;
        this.animals.forEach(other => {
          if (other !== anim && Math.hypot(other.x - anim.x, other.y - anim.y) < 48) {
            neighbors++;
          }
        });

        totalNeighbors += neighbors;
        maxNeighbors = Math.max(maxNeighbors, neighbors);
        totalEnergy += anim.energy;

        if (anim.energy < 25) {
          lowEnergyAnimals++;
          if (anim.isDiseased) sickLowEnergyAnimals++;
        }

        if (neighbors >= 2) animalsAboveTwo++;
        if (neighbors >= 4) animalsAboveFour++;

        if ((anim.genes?.diet?.meat || 0) > 0.45) {
          carnivoreCount++;
          carnivoreEnergy += anim.energy;
          const sz = anim.genes.size || 0.5;
          minCarnivoreSize = Math.min(minCarnivoreSize, sz);
          maxCarnivoreSize = Math.max(maxCarnivoreSize, sz);
          totalCarnivoreSize += sz;
          totalPredatorPerception += (anim.genes?.perception || 0.5);
        } else {
          herbivoreCount++;
          herbivoreEnergy += anim.energy;
          const p = anim.genes?.perception || 0.5;
          totalHerbivorePerception += p;
          maxHerbivorePerception = Math.max(maxHerbivorePerception, p);
          const plantAffinity = anim.genes?.diet?.plant || 0;
          totalHerbivorePlant += plantAffinity;
          if (plantAffinity > 0.15) herbivoresWithPlantDiet++;
          else herbivoresWithoutPlantDiet++;
        }
      });

      const averageHerbivorePerception = herbivoreCount > 0 ? (totalHerbivorePerception / herbivoreCount) : 0;
      const averagePredatorPerception = carnivoreCount > 0 ? (totalPredatorPerception / carnivoreCount) : 0;
      const averageHerbivorePlant = herbivoreCount > 0 ? (totalHerbivorePlant / herbivoreCount) : 0;

      const soilStats = {};
      for (const row of this.grid) {
        for (const cell of row) {
          if (!soilStats[cell.biome]) {
            soilStats[cell.biome] = { cells: 0, totalNitrogen: 0, minNitrogen: Infinity, maxNitrogen: -Infinity };
          }
          const stats = soilStats[cell.biome];
          stats.cells++;
          stats.totalNitrogen += cell.soilNitrogen;
          stats.minNitrogen = Math.min(stats.minNitrogen, cell.soilNitrogen);
          stats.maxNitrogen = Math.max(stats.maxNitrogen, cell.soilNitrogen);
        }
      }

      this.latestDiagnostics = {
        tick: this.tickCount,
        generation: this.generation,
        vegetation: {
          living: this.plants.length,
          reproduced: this.plantMetrics.reproduced,
          nutrientDeaths: this.plantMetrics.nutrientDeaths,
          ageDeaths: this.plantMetrics.ageDeaths,
          floodDeaths: this.plantMetrics.floodDeaths,
          grazingDeaths: this.plantMetrics.grazingDeaths,
          growthUpdates: this.plantMetrics.growthUpdates,
          growthBlocked: this.plantMetrics.growthBlocked
        },
        density: {
          population: this.animals.length,
          avgNeighbors: this.animals.length > 0 ? (totalNeighbors / this.animals.length).toFixed(2) : 0,
          maxNeighbors: maxNeighbors,
          aboveTwo: animalsAboveTwo,
          aboveFour: animalsAboveFour,
          herbivoreCount: herbivoreCount,
          carnivoreCount: carnivoreCount,
          minCarnivoreSize: carnivoreCount > 0 ? minCarnivoreSize.toFixed(2) : 0,
          maxCarnivoreSize: carnivoreCount > 0 ? maxCarnivoreSize.toFixed(2) : 0,
          avgCarnivoreSize: carnivoreCount > 0 ? (totalCarnivoreSize / carnivoreCount).toFixed(2) : 0,
          diseasedCount: this.animals.filter(a => a.isDiseased).length
        },
        energy: {
          avgGeneral: this.animals.length > 0 ? (totalEnergy / this.animals.length).toFixed(2) : 0,
          avgHerbivore: herbivoreCount > 0 ? (herbivoreEnergy / herbivoreCount).toFixed(2) : 0,
          avgCarnivore: carnivoreCount > 0 ? (carnivoreEnergy / carnivoreCount).toFixed(2) : 0,
          criticalLow: lowEnergyAnimals,
          criticalLowSick: sickLowEnergyAnimals
        },
        mortality: {
          energyDeaths: this.animalMetrics.energyDeaths,
          ageDeaths: this.animalMetrics.ageDeaths,
          sickDeaths: this.animalMetrics.sickDeaths,
          healthyDeaths: this.animalMetrics.healthyDeaths,
          juvenileDeaths: this.animalMetrics.juvenileDeaths,
          adultDeaths: this.animalMetrics.adultDeaths
        },
        ai: {
          avgHerbivorePerception: averageHerbivorePerception.toFixed(3),
          maxHerbivorePerception: maxHerbivorePerception.toFixed(3),
          avgPredatorPerception: averagePredatorPerception.toFixed(3),
          avgHerbivorePlantAffinity: averageHerbivorePlant.toFixed(3),
          herbivoresWithoutPlantDiet: herbivoresWithoutPlantDiet,
          herbivoresWithPlantDiet: herbivoresWithPlantDiet,
          fleeEvents: this.aiMetrics.fleeEvents,
          herbivoreMeals: this.aiMetrics.herbivoreMeals,
          carcassMeals: this.aiMetrics.carcassMeals,
          herbivoreCarcassMeals: this.aiMetrics.herbivoreCarcassMeals,
          carnivoreCarcassMeals: this.aiMetrics.carnivoreCarcassMeals,
          plantTargets: this.aiMetrics.plantTargets,
          plantApproaches: this.aiMetrics.plantApproaches,
          prionInfections: this.aiMetrics.prionInfections,
          cannibalAttacks: this.aiMetrics.cannibalAttacks,
          crowdInfections: this.aiMetrics.crowdInfections,
          otherSpeciesKills: this.aiMetrics.otherSpeciesKills,
          carnivorePreyKills: this.aiMetrics.carnivorePreyKills,
          nonCarnivorePreyKills: this.aiMetrics.nonCarnivorePreyKills,
          carcassTargets: this.aiMetrics.carcassTargets,
          avgCarcassDistance: this.aiMetrics.carcassTargets > 0 ? (this.aiMetrics.carcassDistanceTotal / this.aiMetrics.carcassTargets).toFixed(2) : 0,
          carcassFarTargets: this.aiMetrics.carcassFarTargets,
          carcassMaxDistance: this.aiMetrics.carcassMaxDistance.toFixed(2)
        },
        soil: soilStats
      };

      if (typeof window !== 'undefined' && window.systemConsole) {
        if (typeof window.systemConsole.onDiagnosticsUpdate === 'function') window.systemConsole.onDiagnosticsUpdate(this.latestDiagnostics);
      }
      this.aiMetrics.carcassTargets = 0;
      this.aiMetrics.carcassDistanceTotal = 0;
      this.aiMetrics.carcassFarTargets = 0;
      this.aiMetrics.carcassMaxDistance = 0;
      this.aiMetrics.fleeEvents = 0;
      this.aiMetrics.herbivoreMeals = 0;
      this.aiMetrics.plantTargets = 0;
      this.aiMetrics.carcassMeals = 0;
      this.aiMetrics.plantApproaches = 0;
      this.aiMetrics.prionInfections = 0;
      this.aiMetrics.crowdInfections = 0;
      this.aiMetrics.cannibalAttacks = 0;
      this.aiMetrics.otherSpeciesKills = 0;
      this.aiMetrics.herbivoreCarcassMeals = 0;
      this.aiMetrics.carnivoreCarcassMeals = 0;
      this.aiMetrics.carnivorePreyKills = 0;
      this.aiMetrics.nonCarnivorePreyKills = 0;
    }

    if (this.tickCount % this.seasonLength === 0) {
      this.seasonIndex = (this.seasonIndex + 1) % SEASONS.length;
      if (this.seasonIndex === 0) {
        this.generation++;
      }
    }
    const curSeason = { ...SEASONS[this.seasonIndex] };
    if (this.impactWinterTicks > 0) {
      this.impactWinterTicks--;
      curSeason.sunlight = Math.max(0.15, curSeason.sunlight * 0.35);
      curSeason.temp -= 0.40;
    }

    if (this.tickCount % this.historyInterval === 0) {
      this.recordHistorySnapshot();
    }

    this.climateTrend = this.climate.computeTrend(this.tickCount, this.generation);
    const effectiveTemp = curSeason.temp + this.climateTrend;

    // Hidrologia dinâmica
    this.hydrologyTimer++;
    if (this.hydrologyTimer >= 90) {
      this.hydrologyTimer = 0;
      const isWetPeriod = curSeason.rain > 1.0;
      const isFreezing = effectiveTemp < -0.6;

      const targetR = Math.floor(Math.random() * this.gridRows);
      const targetC = Math.floor(Math.random() * this.gridCols);
      const cell = this.grid[targetR]?.[targetC];

      if (cell) {
        if (isWetPeriod && cell.biome === 'fertile' && !isFreezing) {
          let neighborWater = 0;
          [[1,0], [-1,0], [0,1], [0,-1]].forEach(([dr, dc]) => {
            if (this.grid[targetR + dr]?.[targetC + dc]?.biome === 'water') neighborWater++;
          });
          if (neighborWater >= 1 && cell.moisture > 0.85 && Math.random() < 0.45) {
            cell.biome = 'water';
            cell.moisture = 1.0;
            cell.maxSoilNitrogen = 0;
            cell.soilNitrogen = 0;
            if (cell.plant) {
              const pIdx = this.plants.indexOf(cell.plant);
              if (pIdx !== -1) {
                this.plants.splice(pIdx, 1);
                this.plantMetrics.floodDeaths++;
              }
              cell.plant = null;
            }
          }
        } else if (!isWetPeriod && cell.biome === 'water' && effectiveTemp > 0.1) {
          let neighborDry = 0;
          [[1,0], [-1,0], [0,1], [0,-1]].forEach(([dr, dc]) => {
            const b = this.grid[targetR + dr]?.[targetC + dc]?.biome;
            if (b === 'dry' || b === 'fertile') neighborDry++;
          });
          if (neighborDry >= 2 && Math.random() < 0.35) {
            cell.biome = 'fertile';
            cell.moisture = 0.70;
            cell.maxSoilNitrogen = 120;
            cell.soilNitrogen = 50.0;
          }
        }
      }
    }

    // 1. DINÂMICA DO SOLO & NUTRIENTES (POO)
    for (let r = 0; r < this.gridRows; r++) {
      for (let c = 0; c < this.gridCols; c++) {
        this.grid[r][c].regenerate(curSeason);
      }
    }

    // 2. CARCAÇAS (POO)
    for (let idx = this.carcasses.length - 1; idx >= 0; idx--) {
      const carcass = this.carcasses[idx];
      if (!carcass) { this.carcasses.splice(idx, 1); continue; }
      const cell = this.grid[carcass.r]?.[carcass.c];
      carcass.tick(cell);
      if (!carcass.alive) {
        this.carcasses.splice(idx, 1);
      }
    }

    // 3. VEGETAIS (POO)
    for (let idx = this.plants.length - 1; idx >= 0; idx--) {
      const plant = this.plants[idx];
      if (!plant) { this.plants.splice(idx, 1); continue; }
      const cell = this.grid[plant.r]?.[plant.c];
      plant.tick(curSeason, cell, this.plantMetrics, this);
      if (!plant.alive) {
        this.plants.splice(idx, 1);
      }
    }

    // 3.1 BANCO DE SEMENTES NO SOLO
    const targetPlantCap = this.gridCols * this.gridRows * 0.48;
    const isPlantUnderPressure = this.plants.length < targetPlantCap;
    const isCriticallyLow = this.plants.length < 35;
    const baseSeedRate = this.equilibriumSettings?.seedBankRate ?? 0.14;
    const effectiveSeedRate = isCriticallyLow ? 0.95 : (isPlantUnderPressure ? baseSeedRate * 1.6 : baseSeedRate * 0.4);

    const seedBursts = isCriticallyLow ? 3 : 1;
    for (let b = 0; b < seedBursts; b++) {
      if (Math.random() < effectiveSeedRate && this.plants.length < this.gridCols * this.gridRows * 0.70) {
        const randR = Math.floor(Math.random() * this.gridRows);
        const randC = Math.floor(Math.random() * this.gridCols);
        const candidateCell = this.grid[randR]?.[randC];

        if (candidateCell && candidateCell.biome !== 'water' && !candidateCell.plant && candidateCell.soilNitrogen > (isCriticallyLow ? 5.0 : 12.0) && candidateCell.moisture > 0.15) {
          const knownPlantSpecies = this.speciesCatalog.filter(s => s.type === 'plant');
          const templateSpecies = knownPlantSpecies.length > 0 ? knownPlantSpecies[Math.floor(Math.random() * knownPlantSpecies.length)] : null;
          const baseGenes = (templateSpecies && (templateSpecies.founderGenes || templateSpecies.genes))
            ? (templateSpecies.founderGenes || templateSpecies.genes)
            : { growthSpeed: 0.6, height: 0.4, defense: 0.25, rootEfficiency: 0.6, thermal: 0.0, colorHue: 115 };

          const mutMul = this.equilibriumSettings?.mutationRateMultiplier ?? 1.0;
          const seedlingGenes = {};
          Object.keys(baseGenes).forEach(k => {
            const val = baseGenes[k];
            if (typeof val === 'number') {
              if (k === 'colorHue') {
                seedlingGenes[k] = Math.round((val + (Math.random() * 20 - 10) * mutMul + 360) % 360);
              } else if (k === 'thermal') {
                seedlingGenes[k] = parseFloat(Math.max(-1.0, Math.min(1.0, val + (Math.random() * 0.1 - 0.05) * mutMul)).toFixed(2));
              } else {
                seedlingGenes[k] = parseFloat(Math.max(0.05, Math.min(1.0, val + (Math.random() * 0.1 - 0.05) * mutMul)).toFixed(2));
              }
            } else {
              seedlingGenes[k] = val;
            }
          });

          const seedling = new Plant(
            'plant_' + Math.random().toString(36).substr(2, 9),
            templateSpecies ? templateSpecies.name : 'Grama Pioneira',
            randR, randC,
            this.cellSize,
            seedlingGenes,
            templateSpecies?.customImages ? { ...templateSpecies.customImages } : {}
          );
          seedling.growth = 0.18;
          seedling.energy = 34.0;
          candidateCell.plant = seedling;
          this.plants.push(seedling);
          this.plantMetrics.reproduced++;
        }
      }
    }

    // 4. FISIOLOGIA ANIMAL (POO)
    const deadAnimals = [];
    const newOffspring = [];

    this.animals.forEach(anim => {
      anim.tick(curSeason, this, newOffspring, deadAnimals);
    });

    deadAnimals.forEach(dead => {
      const idx = this.animals.indexOf(dead);
      if (idx !== -1) {
        this.animals.splice(idx, 1);
        const cr = Math.max(0, Math.min(this.gridRows - 1, Math.floor(dead.y / this.cellSize)));
        const cc = Math.max(0, Math.min(this.gridCols - 1, Math.floor(dead.x / this.cellSize)));

        if (this.grid[cr]?.[cc]) {
          const carcassEnergy = dead.carcassEnergy ?? (25.0 + (dead.genes.size || 0.5) * 50.0);
          const carcass = new Carcass(
            'carcass_' + Math.random().toString(36).substr(2, 9),
            dead.speciesName || dead.name,
            Math.max(10, Math.min((this.gridCols * this.cellSize) - 10, dead.x)),
            Math.max(10, Math.min((this.gridRows * this.cellSize) - 10, dead.y)),
            cr, cc,
            carcassEnergy,
            dead.genes
          );
          this.grid[cr][cc].carcass = carcass;
          this.carcasses.push(carcass);
        }
      }
    });

    const availableSlots = Math.max(0, HARD_CRASH_FAILSAFE - this.animals.length);
    newOffspring.slice(0, availableSlots).forEach(baby => {
      this.animals.push(baby);
    });

    if (this.animals.length === 0 && this.tickCount > 10) {
      this.handleExtinction();
    }
  }

  selectEntityAt(canvasX, canvasY) {
    let found = null, minDist = 22;

    this.animals.forEach(a => {
      const d = Math.hypot(a.x - canvasX, a.y - canvasY);
      if (d < minDist) { minDist = d; found = { type: 'animal', data: a }; }
    });

    if (!found) {
      this.plants.forEach(p => {
        const d = Math.hypot(p.x - canvasX, p.y - canvasY);
        if (d < minDist) { minDist = d; found = { type: 'plant', data: p }; }
      });
    }

    this.selectedEntity = found;
    this.updateInspectorUI();
  }
}


// --- controllers/UIController.js ---
// ====================================================
//  UICONTROLLER.JS — Controle geral de navegação, painéis e notificações
// ====================================================

class UIController {
  static _toastTimer = null;
  static _sideConsoleLastTick = -1;
  static _sideConsoleKillsLast = 0;

  /**
   * Navega entre as telas da interface.
   * @param {string} pageId - Identificador da tela (menu, species, plants, world, simulation, console)
   */
  static showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + pageId);
    if (target) {
      target.classList.add('active');
      window.scrollTo(0, 0);
    }

    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.page === pageId);
    });

    if (pageId !== 'simulation' && pageId !== 'console' && typeof window.engine !== 'undefined' && window.engine.isRunning) {
      window.engine.pause();
      if (typeof window.updatePlayPauseButtonUI === 'function') {
        window.updatePlayPauseButtonUI(false);
      }
    }

    if (pageId === 'species' && typeof window.renderAnimalPreview === 'function') window.renderAnimalPreview();
    if (pageId === 'plants'  && typeof window.renderPlantPreview === 'function')  window.renderPlantPreview();
    if (pageId === 'world'   && typeof window.refreshWorldSpeciesCounts === 'function') window.refreshWorldSpeciesCounts();
    if (pageId === 'simulation' && typeof window.startOrResumeSimulation === 'function') window.startOrResumeSimulation();
    if (pageId === 'console' && typeof window.systemConsole !== 'undefined') window.systemConsole.onOpen();
  }

  /**
   * Exibe notificação temporária em toast.
   * @param {string} msg
   * @param {number} duration
   */
  static toast(msg, duration = 3000) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(UIController._toastTimer);
    UIController._toastTimer = setTimeout(() => el.classList.remove('show'), duration);
  }

  /**
   * Alterna a aba do painel lateral da simulação.
   * @param {string} name - Nome do painel (census, inspector, console)
   */
  static switchSidePanel(name) {
    document.querySelectorAll('.sidepanel').forEach(p => {
      p.style.display = 'none';
      p.classList.remove('active');
    });
    document.querySelectorAll('.sidebar-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.sidepanel === name);
    });
    const target = document.getElementById('sidepanel-' + name);
    if (target) { target.style.display = 'flex'; target.classList.add('active'); }
  }

  /**
   * Atualiza o log e métricas do console lateral a cada 100 ticks.
   */
  static updateSideConsole() {
    const engine = window.engine;
    if (typeof engine === 'undefined' || !engine.latestDiagnostics) return;
    const d = engine.latestDiagnostics;
    const tick = engine.tickCount || 0;

    // Só atualiza a cada 100 ticks
    if (tick - UIController._sideConsoleLastTick < 100) return;
    UIController._sideConsoleLastTick = tick;

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

    // latestDiagnostics tem estrutura aninhada: d.vegetation, d.density, d.energy, d.ai
    const plants  = d.vegetation?.living   ?? (engine.plants?.length  ?? 0);
    const animals = d.density?.population  ?? (engine.animals?.length ?? 0);
    const herb    = d.density?.herbivoreCount ?? 0;
    const carn    = d.density?.carnivoreCount ?? 0;
    const avgE    = d.energy?.avgGeneral   ?? null;
    const kills   = (d.ai?.nonCarnivorePreyKills ?? 0) + (d.ai?.carnivorePreyKills ?? 0);

    set('side-console-tick-badge', 'Ciclo: ' + tick);
    set('sc-plants',     plants);
    set('sc-animals',    animals);
    set('sc-herbivores', herb);
    set('sc-carnivores', carn);
    set('sc-avg-energy', avgE != null ? parseFloat(avgE).toFixed(1) : '—');
    set('sc-kills',      kills - UIController._sideConsoleKillsLast);
    UIController._sideConsoleKillsLast = kills;

    // Adiciona linha ao log compacto
    const log = document.getElementById('side-console-log');
    if (log) {
      const isCritical = animals < 5 || plants < 5;
      const isWarn     = carn === 0 || herb === 0;
      const line = document.createElement('div');
      line.className = 'sc-line' + (isCritical ? ' sc-err' : isWarn ? ' sc-warn' : '');
      line.textContent = '[' + tick + '] 🌿' + plants + ' 🦊' + herb + ' 🐺' + carn
                       + ' ⚡' + (avgE != null ? parseFloat(avgE).toFixed(0) : '?');
      log.appendChild(line);
      while (log.children.length > 50) log.removeChild(log.firstChild);
      log.scrollTop = log.scrollHeight;
    }
  }
}


// --- controllers/AnimalCreatorController.js ---
// ====================================================
//  ANIMALCREATORCONTROLLER.JS — Criador e customizador de espécies animais (POO)
// ====================================================



const DEFAULT_ANIMAL_GENES = {
  size: 0.5,
  diet: { meat: 0.3, plant: 0.6, carcass: 0.1 },
  speed: 0.5,
  perception: 0.5,
  gestation: 0.4,
  offspringCount: 0.4,
  aggression: 0.3,
  health: 0.5,
  aquatic: 0.15, // 0 = Terrestre puro, 1 = Aquático puro
  thermal: 0.0,
  colorHue: 120
};

class AnimalCreatorController {
  static currentGenes = JSON.parse(JSON.stringify(DEFAULT_ANIMAL_GENES));
  static currentImages = { body: null, limbs: null, jaw: null, eyes: null, detail: null };
  static savedAnimals = [];
  static canvas = null;
  static ctx = null;

  static init() {
    AnimalCreatorController.canvas = document.getElementById('animal-canvas');
    if (!AnimalCreatorController.canvas) return;
    AnimalCreatorController.ctx = AnimalCreatorController.canvas.getContext('2d');

    try {
      AnimalCreatorController.savedAnimals = JSON.parse(localStorage.getItem('evo_animals') || '[]');
    } catch {
      AnimalCreatorController.savedAnimals = [];
    }
    AnimalCreatorController.renderSavedList();

    document.querySelectorAll('#animal-attrs [data-gene]').forEach(el => {
      el.addEventListener('input', () => {
        const g = el.dataset.gene;
        AnimalCreatorController.currentGenes[g] = parseFloat(el.value);
        AnimalCreatorController.updateSliderLabel(el);
        AnimalCreatorController.renderPreview();
      });
    });

    AnimalCreatorController.syncDietSlidersUI();

    ['body', 'limbs', 'jaw', 'eyes', 'detail'].forEach(part => {
      const input = document.getElementById(`upload-animal-${part}`);
      if (input) {
        input.addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (evt) => {
            AnimalCreatorController.currentImages[part] = evt.target.result;
            AnimalCreatorController.updateComponentBox('animal', part, evt.target.result);
            AnimalCreatorController.renderPreview();
            UIController.toast(`✅ Componente "${part}" importado!`);
          };
          reader.readAsDataURL(file);
        });
      }
    });

    AnimalCreatorController.renderPreview();
  }

  static updateSliderLabel(el) {
    const g = el.dataset.gene;
    const label = el.closest('.attr-row').querySelector('label span');
    const val = parseFloat(el.value);

    if (g === 'aquatic') {
      const icon = val > 0.65 ? '🐬 Marinho' : val > 0.35 ? '🐸 Anfíbio' : '🐾 Terrestre';
      label.textContent = `${icon} (${Math.round(val * 100)}%)`;
    } else if (g === 'thermal') {
      const icon = val > 0.25 ? '🔥 Calor' : val < -0.25 ? '❄️ Frio' : '🌿 Neutro';
      label.textContent = `${icon} (${val > 0 ? '+' : ''}${val.toFixed(2)})`;
      const col = val > 0.25 ? '#ffa657' : val < -0.25 ? '#79c0ff' : '#3fb950';
      el.closest('.attr-row').style.setProperty('--thermal-color', col);
    } else if (g === 'colorHue') {
      label.textContent = `${Math.round(val)}°`;
      label.style.color = `hsl(${val}, 75%, 65%)`;
    } else {
      label.textContent = Math.round(val * 100) + '%';
    }
  }

  static updateStrictDietUI(changedKey, val) {
    let newVal = parseFloat(val);
    if (!AnimalCreatorController.currentGenes.diet) {
      AnimalCreatorController.currentGenes.diet = { meat: 0.3, plant: 0.6, carcass: 0.1 };
    }
    AnimalCreatorController.currentGenes.diet[changedKey] = newVal;

    const keys = ['meat', 'plant', 'carcass'];
    const otherKeys = keys.filter(k => k !== changedKey);
    let sumOthers = otherKeys.reduce((acc, k) => acc + AnimalCreatorController.currentGenes.diet[k], 0);
    let targetOthers = Math.max(0, 1.0 - newVal);

    if (sumOthers > 0) {
      otherKeys.forEach(k => {
        AnimalCreatorController.currentGenes.diet[k] = parseFloat((AnimalCreatorController.currentGenes.diet[k] * (targetOthers / sumOthers)).toFixed(2));
      });
    } else {
      otherKeys.forEach(k => {
        AnimalCreatorController.currentGenes.diet[k] = parseFloat((targetOthers / otherKeys.length).toFixed(2));
      });
    }

    const finalSum = keys.reduce((acc, k) => acc + AnimalCreatorController.currentGenes.diet[k], 0);
    if (finalSum !== 1.0) {
      AnimalCreatorController.currentGenes.diet[otherKeys[0]] = parseFloat((AnimalCreatorController.currentGenes.diet[otherKeys[0]] + (1.0 - finalSum)).toFixed(2));
    }

    AnimalCreatorController.syncDietSlidersUI();
    AnimalCreatorController.renderPreview();
  }

  static syncDietSlidersUI() {
    if (!AnimalCreatorController.currentGenes.diet) {
      AnimalCreatorController.currentGenes.diet = { meat: 0.3, plant: 0.6, carcass: 0.1 };
    }
    const keys = ['meat', 'plant', 'carcass'];
    keys.forEach(k => {
      const inputEl = document.querySelector(`#animal-attrs [data-diet="${k}"]`);
      if (inputEl) {
        inputEl.value = AnimalCreatorController.currentGenes.diet[k];
        const spanEl = inputEl.closest('.attr-row').querySelector('label span');
        if (spanEl) spanEl.textContent = Math.round(AnimalCreatorController.currentGenes.diet[k] * 100) + '%';
      }
    });

    const totalLabel = document.getElementById('diet-total-label');
    if (totalLabel) {
      const totalPct = Math.round(keys.reduce((acc, k) => acc + AnimalCreatorController.currentGenes.diet[k], 0) * 100);
      totalLabel.textContent = totalPct + '%';
    }
  }

  static renderPreview() {
    const canvas = AnimalCreatorController.canvas;
    const ctx = AnimalCreatorController.ctx;
    if (!canvas || !ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    ctx.fillStyle = '#09130c';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#142718';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 36) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 36) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    const diet = AnimalCreatorController.currentGenes.diet || { meat: 0.3, plant: 0.6, carcass: 0.1 };

    if (typeof window.drawCreature === 'function') {
      window.drawCreature(ctx, AnimalCreatorController.currentGenes, W / 2, H / 2, 1.45, AnimalCreatorController.currentImages, () => {
        AnimalCreatorController.renderPreview();
      });
    }

    ctx.fillStyle = 'rgba(13, 17, 23, 0.75)';
    ctx.fillRect(0, H - 28, W, 28);
    ctx.fillStyle = '#8b949e';
    ctx.font = '11px system-ui';
    ctx.fillText(
      `Tam: ${Math.round(AnimalCreatorController.currentGenes.size*100)}% | Vel: ${Math.round(AnimalCreatorController.currentGenes.speed*100)}% | Carne: ${Math.round(diet.meat*100)}% | Planta: ${Math.round(diet.plant*100)}%`,
      12, H - 10
    );
  }

  static clearComponentImage(type, part) {
    if (type === 'animal') {
      AnimalCreatorController.currentImages[part] = null;
      AnimalCreatorController.updateComponentBox('animal', part, null);
      const input = document.getElementById(`upload-animal-${part}`);
      if (input) input.value = '';
      AnimalCreatorController.renderPreview();
    } else if (typeof window.clearComponentImagePlant === 'function') {
      window.clearComponentImagePlant(part);
    }
    UIController.toast(`🗑️ Componente "${part}" restaurado.`);
  }

  static updateComponentBox(type, part, dataUrl) {
    const box = document.getElementById(`box-${type}-${part}`);
    if (!box) return;
    if (dataUrl) {
      box.innerHTML = `<img src="${dataUrl}" alt="${part}" />`;
      box.style.borderColor = 'var(--accent)';
    } else {
      box.innerHTML = `<span class="placeholder-icon">🎨</span>`;
      box.style.borderColor = 'var(--border)';
    }
  }

  static switchSidebarTab(tab) {
    document.querySelectorAll('#page-species .panel-subnav button').forEach(b => b.classList.remove('active'));
    document.getElementById(`btn-animal-tab-${tab}`).classList.add('active');
    document.getElementById('animal-tab-attrs').style.display = tab === 'attrs' ? 'block' : 'none';
    document.getElementById('animal-tab-components').style.display = tab === 'components' ? 'block' : 'none';
  }

  static saveSpecies() {
    const nameEl = document.getElementById('animal-name');
    const name = nameEl.value.trim() || `Animal ${AnimalCreatorController.savedAnimals.length + 1}`;

    const mini = document.createElement('canvas');
    mini.width = 80; mini.height = 80;
    const mCtx = mini.getContext('2d');
    mCtx.fillStyle = '#09130c';
    mCtx.fillRect(0, 0, 80, 80);
    if (typeof window.drawCreature === 'function') {
      window.drawCreature(mCtx, AnimalCreatorController.currentGenes, 40, 40, 0.75, AnimalCreatorController.currentImages);
    }
    const thumbnail = mini.toDataURL('image/png');

    const entry = {
      id: 'a_' + Date.now(),
      type: 'animal',
      name,
      genes: JSON.parse(JSON.stringify(AnimalCreatorController.currentGenes)),
      customImages: { ...AnimalCreatorController.currentImages },
      thumbnail
    };

    AnimalCreatorController.savedAnimals.push(entry);
    localStorage.setItem('evo_animals', JSON.stringify(AnimalCreatorController.savedAnimals));

    nameEl.value = '';
    AnimalCreatorController.renderSavedList();
    if (typeof window.refreshWorldSpeciesCounts === 'function') {
      window.refreshWorldSpeciesCounts();
    }
    UIController.toast(`🦊 Espécie animal "${name}" salva com sucesso!`);
  }

  static exportPNG() {
    const nameEl = document.getElementById('animal-name');
    const name = (nameEl.value.trim() || 'especie_animal').replace(/\s+/g, '_');

    const exp = document.createElement('canvas');
    exp.width = 450; exp.height = 450;
    const eCtx = exp.getContext('2d');
    eCtx.fillStyle = '#09130c';
    eCtx.fillRect(0, 0, 450, 450);
    if (typeof window.drawCreature === 'function') {
      window.drawCreature(eCtx, AnimalCreatorController.currentGenes, 225, 225, 3.6, AnimalCreatorController.currentImages);
    }

    const a = document.createElement('a');
    a.href = exp.toDataURL('image/png');
    a.download = `${name}_sprite.png`;
    a.click();
    UIController.toast(`🖼️ Sprite PNG de "${name}" exportado!`);
  }

  static renderSavedList() {
    const list = document.getElementById('saved-animals-list');
    if (!list) return;
    list.innerHTML = '';

    if (AnimalCreatorController.savedAnimals.length === 0) {
      list.innerHTML = '<span style="color:var(--text-dim);font-size:12px;">Nenhum animal salvo ainda.</span>';
      return;
    }

    AnimalCreatorController.savedAnimals.forEach((sp, idx) => {
      const item = document.createElement('div');
      item.className = 'saved-item';
      item.innerHTML = `
        <img src="${sp.thumbnail}" width="36" height="36" />
        <span class="saved-name">${sp.name}</span>
        <button class="btn btn-secondary btn-sm" onclick="loadAnimal(${idx})">↩ Carregar</button>
        <button class="btn btn-secondary btn-sm" onclick="downloadAnimalPNG(${idx})">⬇ PNG</button>
        <button class="btn btn-danger btn-sm" onclick="deleteAnimal(${idx})">✕</button>
      `;
      list.appendChild(item);
    });
  }

  static load(idx) {
    const sp = AnimalCreatorController.savedAnimals[idx];
    AnimalCreatorController.currentGenes = JSON.parse(JSON.stringify(sp.genes));
    if (!AnimalCreatorController.currentGenes.diet) {
      AnimalCreatorController.currentGenes.diet = { meat: 0.3, plant: 0.6, carcass: 0.1 };
    }
    AnimalCreatorController.currentImages = { ...(sp.customImages || {}) };

    document.querySelectorAll('#animal-attrs [data-gene]').forEach(el => {
      if (AnimalCreatorController.currentGenes[el.dataset.gene] !== undefined) {
        el.value = AnimalCreatorController.currentGenes[el.dataset.gene];
        AnimalCreatorController.updateSliderLabel(el);
      }
    });

    AnimalCreatorController.syncDietSlidersUI();

    ['body', 'limbs', 'jaw', 'eyes', 'detail'].forEach(part => {
      AnimalCreatorController.updateComponentBox('animal', part, AnimalCreatorController.currentImages[part]);
    });

    document.getElementById('animal-name').value = sp.name;
    AnimalCreatorController.renderPreview();
    UIController.toast(`↩ Animal "${sp.name}" carregado.`);
  }

  static delete(idx) {
    const name = AnimalCreatorController.savedAnimals[idx].name;
    AnimalCreatorController.savedAnimals.splice(idx, 1);
    localStorage.setItem('evo_animals', JSON.stringify(AnimalCreatorController.savedAnimals));
    AnimalCreatorController.renderSavedList();
    if (typeof window.refreshWorldSpeciesCounts === 'function') {
      window.refreshWorldSpeciesCounts();
    }
    UIController.toast(`🗑️ Animal "${name}" removido.`);
  }

  static downloadPNG(idx) {
    const sp = AnimalCreatorController.savedAnimals[idx];
    const a = document.createElement('a');
    a.href = sp.thumbnail;
    a.download = `${sp.name.replace(/\s+/g, '_')}_thumb.png`;
    a.click();
    UIController.toast(`⬇️ PNG de "${sp.name}" baixado.`);
  }

  static randomizeGenes() {
    Object.keys(DEFAULT_ANIMAL_GENES).forEach(g => {
      if (g === 'colorHue') AnimalCreatorController.currentGenes[g] = Math.round(Math.random() * 360);
      else if (g === 'thermal') AnimalCreatorController.currentGenes[g] = parseFloat((Math.random() * 2 - 1).toFixed(2));
      else if (g === 'diet') {
        let m = Math.random(), p = Math.random(), c = Math.random();
        let tot = m + p + c;
        AnimalCreatorController.currentGenes.diet = {
          meat: parseFloat((m/tot).toFixed(2)),
          plant: parseFloat((p/tot).toFixed(2)),
          carcass: parseFloat((c/tot).toFixed(2))
        };
      } else {
        AnimalCreatorController.currentGenes[g] = parseFloat(Math.random().toFixed(2));
      }
    });

    document.querySelectorAll('#animal-attrs [data-gene]').forEach(el => {
      el.value = AnimalCreatorController.currentGenes[el.dataset.gene];
      AnimalCreatorController.updateSliderLabel(el);
    });
    AnimalCreatorController.syncDietSlidersUI();
    AnimalCreatorController.renderPreview();
    UIController.toast('🎲 Genes animais aleatorizados!');
  }

  static resetGenes() {
    AnimalCreatorController.currentGenes = JSON.parse(JSON.stringify(DEFAULT_ANIMAL_GENES));
    document.querySelectorAll('#animal-attrs [data-gene]').forEach(el => {
      el.value = AnimalCreatorController.currentGenes[el.dataset.gene];
      AnimalCreatorController.updateSliderLabel(el);
    });
    AnimalCreatorController.syncDietSlidersUI();
    AnimalCreatorController.renderPreview();
    UIController.toast('🔄 Genes animais resetados para o padrão.');
  }
}


// --- controllers/PlantCreatorController.js ---
// ====================================================
//  PLANTCREATORCONTROLLER.JS — Criador e customizador de espécies vegetais (POO)
// ====================================================



const DEFAULT_PLANT_GENES = {
  height: 0.5,
  rootEfficiency: 0.5,
  growthSpeed: 0.5,
  defense: 0.3,
  fruitAttraction: 0.4,
  parasiteResistance: 0.5,
  thermal: 0.0,
  colorHue: 110
};

class PlantCreatorController {
  static currentGenes = { ...DEFAULT_PLANT_GENES };
  static currentImages = { roots: null, stem: null, leaves: null, thorns: null, fruit: null };
  static savedPlants = [];
  static canvas = null;
  static ctx = null;

  static init() {
    PlantCreatorController.canvas = document.getElementById('plant-canvas');
    if (!PlantCreatorController.canvas) return;
    PlantCreatorController.ctx = PlantCreatorController.canvas.getContext('2d');

    try {
      PlantCreatorController.savedPlants = JSON.parse(localStorage.getItem('evo_plants') || '[]');
    } catch {
      PlantCreatorController.savedPlants = [];
    }
    PlantCreatorController.renderSavedList();

    document.querySelectorAll('#plant-attrs [data-gene]').forEach(el => {
      el.addEventListener('input', () => {
        const g = el.dataset.gene;
        PlantCreatorController.currentGenes[g] = parseFloat(el.value);
        PlantCreatorController.updateSliderLabel(el);
        PlantCreatorController.renderPreview();
      });
    });

    ['roots', 'stem', 'leaves', 'thorns', 'fruit'].forEach(part => {
      const input = document.getElementById(`upload-plant-${part}`);
      if (input) {
        input.addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (evt) => {
            PlantCreatorController.currentImages[part] = evt.target.result;
            PlantCreatorController.updateComponentBox('plant', part, evt.target.result);
            PlantCreatorController.renderPreview();
            UIController.toast(`✅ Componente botânico "${part}" importado!`);
          };
          reader.readAsDataURL(file);
        });
      }
    });

    PlantCreatorController.renderPreview();
  }

  static updateSliderLabel(el) {
    const g = el.dataset.gene;
    const label = el.closest('.attr-row').querySelector('label span');
    const val = parseFloat(el.value);

    if (g === 'thermal') {
      const icon = val > 0.25 ? '🔥 Calor' : val < -0.25 ? '❄️ Frio' : '🌿 Neutro';
      label.textContent = `${icon} (${val > 0 ? '+' : ''}${val.toFixed(2)})`;
      const col = val > 0.25 ? '#ffa657' : val < -0.25 ? '#79c0ff' : '#3fb950';
      el.closest('.attr-row').style.setProperty('--thermal-color', col);
    } else if (g === 'colorHue') {
      label.textContent = `${Math.round(val)}°`;
      label.style.color = `hsl(${val}, 75%, 65%)`;
    } else {
      label.textContent = Math.round(val * 100) + '%';
    }
  }

  static renderPreview() {
    const canvas = PlantCreatorController.canvas;
    const ctx = PlantCreatorController.ctx;
    if (!canvas || !ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    ctx.fillStyle = '#09130c';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#142718';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 36) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 36) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    const groundY = H * 0.68;
    if (typeof window.drawPlant === 'function') {
      window.drawPlant(ctx, PlantCreatorController.currentGenes, W / 2, groundY, 1.45, PlantCreatorController.currentImages, () => {
        PlantCreatorController.renderPreview();
      });
    }

    ctx.fillStyle = 'rgba(13, 17, 23, 0.75)';
    ctx.fillRect(0, H - 28, W, 28);
    ctx.fillStyle = '#8b949e';
    ctx.font = '11px system-ui';
    ctx.fillText(
      `Altura: ${Math.round(PlantCreatorController.currentGenes.height*100)}% | Raiz: ${Math.round(PlantCreatorController.currentGenes.rootEfficiency*100)}% | Defesa: ${Math.round(PlantCreatorController.currentGenes.defense*100)}% | Fruto: ${Math.round(PlantCreatorController.currentGenes.fruitAttraction*100)}%`,
      12, H - 10
    );
  }

  static clearComponentImage(part) {
    PlantCreatorController.currentImages[part] = null;
    PlantCreatorController.updateComponentBox('plant', part, null);
    const input = document.getElementById(`upload-plant-${part}`);
    if (input) input.value = '';
    PlantCreatorController.renderPreview();
    UIController.toast(`🗑️ Componente "${part}" restaurado.`);
  }

  static updateComponentBox(type, part, dataUrl) {
    const box = document.getElementById(`box-${type}-${part}`);
    if (!box) return;
    if (dataUrl) {
      box.innerHTML = `<img src="${dataUrl}" alt="${part}" />`;
      box.style.borderColor = 'var(--accent)';
    } else {
      box.innerHTML = `<span class="placeholder-icon">🎨</span>`;
      box.style.borderColor = 'var(--border)';
    }
  }

  static switchSidebarTab(tab) {
    document.querySelectorAll('#page-plants .panel-subnav button').forEach(b => b.classList.remove('active'));
    document.getElementById(`btn-plant-tab-${tab}`).classList.add('active');
    document.getElementById('plant-tab-attrs').style.display = tab === 'attrs' ? 'block' : 'none';
    document.getElementById('plant-tab-components').style.display = tab === 'components' ? 'block' : 'none';
  }

  static saveSpecies() {
    const nameEl = document.getElementById('plant-name');
    const name = nameEl.value.trim() || `Planta ${PlantCreatorController.savedPlants.length + 1}`;

    const mini = document.createElement('canvas');
    mini.width = 80; mini.height = 80;
    const mCtx = mini.getContext('2d');
    mCtx.fillStyle = '#09130c';
    mCtx.fillRect(0, 0, 80, 80);
    if (typeof window.drawPlant === 'function') {
      window.drawPlant(mCtx, PlantCreatorController.currentGenes, 40, 56, 0.65, PlantCreatorController.currentImages);
    }
    const thumbnail = mini.toDataURL('image/png');

    const entry = {
      id: 'p_' + Date.now(),
      type: 'plant',
      name,
      genes: { ...PlantCreatorController.currentGenes },
      customImages: { ...PlantCreatorController.currentImages },
      thumbnail
    };

    PlantCreatorController.savedPlants.push(entry);
    localStorage.setItem('evo_plants', JSON.stringify(PlantCreatorController.savedPlants));

    nameEl.value = '';
    PlantCreatorController.renderSavedList();
    if (typeof window.refreshWorldSpeciesCounts === 'function') {
      window.refreshWorldSpeciesCounts();
    }
    UIController.toast(`🌿 Espécie vegetal "${name}" salva com sucesso!`);
  }

  static exportPNG() {
    const nameEl = document.getElementById('plant-name');
    const name = (nameEl.value.trim() || 'especie_planta').replace(/\s+/g, '_');

    const exp = document.createElement('canvas');
    exp.width = 450; exp.height = 450;
    const eCtx = exp.getContext('2d');
    eCtx.fillStyle = '#09130c';
    eCtx.fillRect(0, 0, 450, 450);
    if (typeof window.drawPlant === 'function') {
      window.drawPlant(eCtx, PlantCreatorController.currentGenes, 225, 310, 3.2, PlantCreatorController.currentImages);
    }

    const a = document.createElement('a');
    a.href = exp.toDataURL('image/png');
    a.download = `${name}_planta_sprite.png`;
    a.click();
    UIController.toast(`🖼️ Sprite PNG de "${name}" exportado!`);
  }

  static renderSavedList() {
    const list = document.getElementById('saved-plants-list');
    if (!list) return;
    list.innerHTML = '';

    if (PlantCreatorController.savedPlants.length === 0) {
      list.innerHTML = '<span style="color:var(--text-dim);font-size:12px;">Nenhuma planta salva ainda.</span>';
      return;
    }

    PlantCreatorController.savedPlants.forEach((sp, idx) => {
      const item = document.createElement('div');
      item.className = 'saved-item';
      item.innerHTML = `
        <img src="${sp.thumbnail}" width="36" height="36" />
        <span class="saved-name">${sp.name}</span>
        <button class="btn btn-secondary btn-sm" onclick="loadPlant(${idx})">↩ Carregar</button>
        <button class="btn btn-secondary btn-sm" onclick="downloadPlantPNG(${idx})">⬇ PNG</button>
        <button class="btn btn-danger btn-sm" onclick="deletePlant(${idx})">✕</button>
      `;
      list.appendChild(item);
    });
  }

  static load(idx) {
    const sp = PlantCreatorController.savedPlants[idx];
    PlantCreatorController.currentGenes = { ...sp.genes };
    PlantCreatorController.currentImages = { ...(sp.customImages || {}) };

    document.querySelectorAll('#plant-attrs [data-gene]').forEach(el => {
      el.value = PlantCreatorController.currentGenes[el.dataset.gene];
      PlantCreatorController.updateSliderLabel(el);
    });

    ['roots', 'stem', 'leaves', 'thorns', 'fruit'].forEach(part => {
      PlantCreatorController.updateComponentBox('plant', part, PlantCreatorController.currentImages[part]);
    });

    document.getElementById('plant-name').value = sp.name;
    PlantCreatorController.renderPreview();
    UIController.toast(`↩ Planta "${sp.name}" carregada.`);
  }

  static delete(idx) {
    const name = PlantCreatorController.savedPlants[idx].name;
    PlantCreatorController.savedPlants.splice(idx, 1);
    localStorage.setItem('evo_plants', JSON.stringify(PlantCreatorController.savedPlants));
    PlantCreatorController.renderSavedList();
    if (typeof window.refreshWorldSpeciesCounts === 'function') {
      window.refreshWorldSpeciesCounts();
    }
    UIController.toast(`🗑️ Planta "${name}" removida.`);
  }

  static downloadPNG(idx) {
    const sp = PlantCreatorController.savedPlants[idx];
    const a = document.createElement('a');
    a.href = sp.thumbnail;
    a.download = `${sp.name.replace(/\s+/g, '_')}_thumb.png`;
    a.click();
    UIController.toast(`⬇️ PNG de "${sp.name}" baixado.`);
  }

  static randomizeGenes() {
    Object.keys(DEFAULT_PLANT_GENES).forEach(g => {
      if (g === 'colorHue') PlantCreatorController.currentGenes[g] = Math.round(Math.random() * 360);
      else if (g === 'thermal') PlantCreatorController.currentGenes[g] = parseFloat((Math.random() * 2 - 1).toFixed(2));
      else PlantCreatorController.currentGenes[g] = parseFloat(Math.random().toFixed(2));
    });

    document.querySelectorAll('#plant-attrs [data-gene]').forEach(el => {
      el.value = PlantCreatorController.currentGenes[el.dataset.gene];
      PlantCreatorController.updateSliderLabel(el);
    });
    PlantCreatorController.renderPreview();
    UIController.toast('🎲 Genes botânicos aleatorizados!');
  }

  static resetGenes() {
    PlantCreatorController.currentGenes = { ...DEFAULT_PLANT_GENES };
    document.querySelectorAll('#plant-attrs [data-gene]').forEach(el => {
      el.value = PlantCreatorController.currentGenes[el.dataset.gene];
      PlantCreatorController.updateSliderLabel(el);
    });
    PlantCreatorController.renderPreview();
    UIController.toast('🔄 Genes botânicos resetados para o padrão.');
  }
}


// --- controllers/WorldCreatorController.js ---
// ====================================================
//  WORLDCREATORCONTROLLER.JS — Configurador de Mundos, Biomas e Populações (POO)
// ====================================================





const WORLD_BIOMES = [
  { id: 'random',  name: 'Aleatório',     desc: 'Biomas misturados organicamente por ruído fractal' },
  { id: 'islands', name: 'Arquipélago',   desc: 'Ilhas férteis cercadas por oceanos de água azul' },
  { id: 'savanna', name: 'Savana Mista',  desc: 'Planícies secas, arbustos esparsos e oásis' },
  { id: 'fertile', name: 'Vale Fértil',   desc: 'Solo fértil, alta umidade, lagos e floresta densa' },
  { id: 'desert',  name: 'Deserto Árido', desc: 'Solos arenosos e rochosos sob calor abrasador' },
  { id: 'frozen',  name: 'Tundra Gelada', desc: 'Gelo, solos rochosos e baixas temperaturas' },
];

const STARTER_ANIMALS = [
  {
    id: 'starter_rabbit',
    name: 'Coelho Veloz',
    isStarter: true,
    thumbnail: null,
    defaultCount: 20,
    genes: {
      size: 0.30,
      diet: { meat: 0.0, plant: 0.95, carcass: 0.05 },
      speed: 0.72,
      perception: 0.65,
      gestation: 0.25,
      offspringCount: 0.80,
      aggression: 0.10,
      health: 0.45,
      thermal: 0.0,
      colorHue: 40,
      aquatic: 0.05
    },
    customImages: {}
  },
  {
    id: 'starter_wolf',
    name: 'Lobo da Matilha',
    isStarter: true,
    thumbnail: null,
    defaultCount: 6,
    genes: {
      size: 0.65,
      diet: { meat: 0.85, plant: 0.05, carcass: 0.10 },
      speed: 0.82,
      perception: 0.85,
      gestation: 0.45,
      offspringCount: 0.40,
      aggression: 0.75,
      health: 0.65,
      thermal: 0.0,
      colorHue: 15,
      aquatic: 0.2
    },
    customImages: {}
  }
];

const STARTER_PLANTS = [
  {
    id: 'starter_grass',
    name: 'Capim Silvestre (Rápido)',
    isStarter: true,
    thumbnail: null,
    defaultCount: 45,
    genes: {
      height: 0.25,
      rootEfficiency: 0.75,
      growthSpeed: 0.90,
      defense: 0.05,
      fruitAttraction: 0.20,
      parasiteResistance: 0.50,
      thermal: 0.0,
      colorHue: 120
    },
    customImages: {}
  }
];

class WorldCreatorController {
  static selectedBiomeId = 'random';
  static worldSpeciesSelection = {
    animals: {},
    plants: {}
  };

  static getSpeciesThumbnail(type, sp) {
    if (sp.thumbnail) return sp.thumbnail;
    const offscreen = document.createElement('canvas');
    offscreen.width = 44;
    offscreen.height = 44;
    const ctx = offscreen.getContext('2d');
    ctx.clearRect(0, 0, 44, 44);
    if (type === 'animal' && typeof window.drawCreature === 'function') {
      window.drawCreature(ctx, sp.genes, 22, 22, 0.38, sp.customImages || {});
    } else if (typeof window.drawPlant === 'function') {
      window.drawPlant(ctx, sp.genes, 22, 28, 0.36, sp.customImages || {});
    }
    sp.thumbnail = offscreen.toDataURL();
    return sp.thumbnail;
  }

  static init() {
    const grid = document.getElementById('world-grid');
    if (!grid) return;
    grid.innerHTML = '';

    WORLD_BIOMES.forEach(wb => {
      const card = document.createElement('div');
      card.className = 'world-card' + (wb.id === WorldCreatorController.selectedBiomeId ? ' sel' : '');
      card.id = `biome-card-${wb.id}`;
      card.innerHTML = `
        <canvas width="220" height="140" id="canvas-biome-${wb.id}"></canvas>
        <span class="badge-placeholder">MAPA</span>
        <div class="world-card-info">
          <h4>${wb.name}</h4>
          <p>${wb.desc}</p>
        </div>
      `;
      card.onclick = () => WorldCreatorController.selectBiome(wb.id);
      grid.appendChild(card);

      const canvas = card.querySelector('canvas');
      if (typeof window.drawWorldPreview === 'function') {
        window.drawWorldPreview(canvas.getContext('2d'), wb.id, 220, 140);
      }
    });

    ['world-size', 'world-season-length'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          const valEl = document.getElementById(id + '-val');
          if (valEl) valEl.textContent = el.value;
        });
      }
    });

    WorldCreatorController.refreshSpeciesCounts();
  }

  static selectBiome(id) {
    WorldCreatorController.selectedBiomeId = id;
    document.querySelectorAll('.world-card').forEach(c => c.classList.remove('sel'));
    const target = document.getElementById(`biome-card-${id}`);
    if (target) target.classList.add('sel');
  }

  static refreshSpeciesCounts() {
    const animalContainer = document.getElementById('world-animals-counts-list');
    const plantContainer  = document.getElementById('world-plants-counts-list');
    if (!animalContainer || !plantContainer) return;

    animalContainer.innerHTML = '';
    plantContainer.innerHTML = '';

    const savedAnimals = AnimalCreatorController.savedAnimals || [];
    const allAnimals = [
      ...savedAnimals.map(a => ({ ...a, isStarter: false })),
      ...STARTER_ANIMALS
    ];

    // Limpa chaves de animais deletados
    const validAnimalIds = new Set(allAnimals.map(a => a.id));
    Object.keys(WorldCreatorController.worldSpeciesSelection.animals).forEach(id => {
      if (!validAnimalIds.has(id)) delete WorldCreatorController.worldSpeciesSelection.animals[id];
    });

    allAnimals.forEach(sp => {
      if (!WorldCreatorController.worldSpeciesSelection.animals[sp.id]) {
        let defaultCount = !sp.isStarter ? 15 : (savedAnimals.length === 0 ? sp.defaultCount : 0);
        WorldCreatorController.worldSpeciesSelection.animals[sp.id] = { count: defaultCount, species: sp };
      } else {
        WorldCreatorController.worldSpeciesSelection.animals[sp.id].species = sp;
      }
      const currentCount = WorldCreatorController.worldSpeciesSelection.animals[sp.id].count;
      animalContainer.appendChild(WorldCreatorController.createSpeciesCard('animal', sp, currentCount));
    });

    const savedPlants = PlantCreatorController.savedPlants || [];
    const allPlants = [
      ...savedPlants.map(p => ({ ...p, isStarter: false })),
      ...STARTER_PLANTS
    ];

    // Limpa chaves de plantas deletadas
    const validPlantIds = new Set(allPlants.map(p => p.id));
    Object.keys(WorldCreatorController.worldSpeciesSelection.plants).forEach(id => {
      if (!validPlantIds.has(id)) delete WorldCreatorController.worldSpeciesSelection.plants[id];
    });

    allPlants.forEach(sp => {
      if (!WorldCreatorController.worldSpeciesSelection.plants[sp.id]) {
        let defaultCount = !sp.isStarter ? 35 : (savedPlants.length === 0 ? sp.defaultCount : 0);
        WorldCreatorController.worldSpeciesSelection.plants[sp.id] = { count: defaultCount, species: sp };
      } else {
        WorldCreatorController.worldSpeciesSelection.plants[sp.id].species = sp;
      }
      const currentCount = WorldCreatorController.worldSpeciesSelection.plants[sp.id].count;
      plantContainer.appendChild(WorldCreatorController.createSpeciesCard('plant', sp, currentCount));
    });

    WorldCreatorController.updateSpeciesTotals();
  }

  static createSpeciesCard(type, sp, count) {
    const thumb = WorldCreatorController.getSpeciesThumbnail(type, sp);
    const card = document.createElement('div');
    card.className = `species-count-card${count === 0 ? ' inactive' : ''}`;
    card.id = `species-card-${type}-${sp.id}`;

    let badgesHtml = '';
    if (type === 'animal') {
      const g = sp.genes;
      const diet = g.diet || { meat: 0.3, plant: 0.6, carcass: 0.1 };
      if (diet.meat >= 0.6) {
        badgesHtml += `<span class="species-badge badge-carnivore">🥩 Carnívoro (${Math.round(diet.meat * 100)}%)</span>`;
      } else if (diet.plant >= 0.6) {
        badgesHtml += `<span class="species-badge badge-herbivore">🌿 Herbívoro (${Math.round(diet.plant * 100)}%)</span>`;
      } else {
        badgesHtml += `<span class="species-badge badge-omnivore">🍲 Onívoro</span>`;
      }
    } else {
      badgesHtml += `<span class="species-badge badge-plant">🌿 Vegetal</span>`;
    }

    const maxVal = type === 'animal' ? 80 : 120;

    card.innerHTML = `
      <div class="species-card-thumb">
        <img src="${thumb}" alt="${sp.name}" />
      </div>
      <div class="species-card-info">
        <div class="species-card-name">
          <span>${sp.name}</span>
        </div>
        <div class="species-card-badges">${badgesHtml}</div>
      </div>
      <div class="species-card-controls">
        <div class="species-range-control">
          <input type="range"
                 min="0"
                 max="${maxVal}"
                 step="1"
                 value="${count}"
                 id="range-input-${type}-${sp.id}"
                 oninput="setSpeciesCountSlider('${type}', '${sp.id}', this.value)" />
          <span class="species-count-val" id="count-val-${type}-${sp.id}">${count}</span>
        </div>
      </div>
    `;
    return card;
  }

  static setSpeciesCountSlider(type, id, val) {
    const num = Math.max(0, parseInt(val) || 0);
    const targetMap = WorldCreatorController.worldSpeciesSelection[type === 'animal' ? 'animals' : 'plants'];
    if (targetMap && targetMap[id]) {
      targetMap[id].count = num;
    }

    const slider = document.getElementById(`range-input-${type}-${id}`);
    if (slider && parseInt(slider.value) !== num) slider.value = num;

    const valEl = document.getElementById(`count-val-${type}-${id}`);
    if (valEl) valEl.textContent = num;

    const cardEl = document.getElementById(`species-card-${type}-${id}`);
    if (cardEl) {
      cardEl.classList.toggle('inactive', num === 0);
    }

    WorldCreatorController.updateSpeciesTotals();
  }

  static adjustAllSpeciesCounts(type, delta) {
    const targetMap = WorldCreatorController.worldSpeciesSelection[type === 'animal' ? 'animals' : 'plants'];
    const maxVal = type === 'animal' ? 80 : 120;
    Object.keys(targetMap).forEach(id => {
      const current = targetMap[id].count || 0;
      const next = Math.max(0, Math.min(maxVal, current + delta));
      targetMap[id].count = next;
      const slider = document.getElementById(`range-input-${type}-${id}`);
      const valEl = document.getElementById(`count-val-${type}-${id}`);
      const cardEl = document.getElementById(`species-card-${type}-${id}`);
      if (slider) slider.value = next;
      if (valEl) valEl.textContent = next;
      if (cardEl) cardEl.classList.toggle('inactive', next === 0);
    });
    WorldCreatorController.updateSpeciesTotals();
  }

  static zeroAllSpeciesCounts(type) {
    const targetMap = WorldCreatorController.worldSpeciesSelection[type === 'animal' ? 'animals' : 'plants'];
    Object.keys(targetMap).forEach(id => {
      targetMap[id].count = 0;
      const slider = document.getElementById(`range-input-${type}-${id}`);
      const valEl = document.getElementById(`count-val-${type}-${id}`);
      const cardEl = document.getElementById(`species-card-${type}-${id}`);
      if (slider) slider.value = 0;
      if (valEl) valEl.textContent = 0;
      if (cardEl) cardEl.classList.toggle('inactive', true);
    });
    WorldCreatorController.updateSpeciesTotals();
  }

  static updateSpeciesTotals() {
    let totalAnimals = 0, totalPlants = 0;
    Object.values(WorldCreatorController.worldSpeciesSelection.animals).forEach(item => totalAnimals += (parseInt(item.count) || 0));
    Object.values(WorldCreatorController.worldSpeciesSelection.plants).forEach(item => totalPlants += (parseInt(item.count) || 0));

    const badgeAnimalsTotal = document.getElementById('total-animals-badge');
    const badgePlantsTotal  = document.getElementById('total-plants-badge');
    const subtotalAnimals   = document.getElementById('subtotal-animals-badge');
    const subtotalPlants    = document.getElementById('subtotal-plants-badge');

    if (badgeAnimalsTotal) badgeAnimalsTotal.textContent = totalAnimals;
    if (badgePlantsTotal)  badgePlantsTotal.textContent  = totalPlants;
    if (subtotalAnimals)   subtotalAnimals.textContent   = `${totalAnimals} indivíduos`;
    if (subtotalPlants)    subtotalPlants.textContent    = `${totalPlants} vegetais`;
  }

  // ── CALIBRADOR TRÓFICO INTELIGENTE ─────────────────
  static autoBalanceTrophicPopulations() {
    const size = parseInt(document.getElementById('world-size')?.value || 50);
    const cols = Math.min(50, Math.max(20, Math.round(size * 0.75)));
    const rows = Math.min(35, Math.max(15, Math.round(size * 0.5)));
    const totalCells = cols * rows;

    function distributePopulation(species, capacity, maxPerSpecies) {
      if (species.length === 0) return;

      const weights = species.map(item => 1 / item.totalDemand);
      const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

      const counts = species.map((item, index) => ({
        id: item.id,
        count: Math.min(
          maxPerSpecies,
          Math.floor(capacity * weights[index] / totalWeight)
        ),
        remainder: (capacity * weights[index] / totalWeight) % 1
      }));

      let remaining = Math.max(
        0,
        capacity - counts.reduce((sum, item) => sum + item.count, 0)
      );

      counts.sort((a, b) => b.remainder - a.remainder);

      while (remaining > 0) {
        let distributed = false;
        for (const item of counts) {
          if (remaining <= 0) break;
          if (item.count < maxPerSpecies) {
            item.count++;
            remaining--;
            distributed = true;
          }
        }
        if (!distributed) break;
      }

      counts.forEach(item => {
        WorldCreatorController.setSpeciesCountSlider('animal', item.id, item.count);
      });
    }

    // 1. Produtores primários.
    const targetPlantTotal = Math.min(
      110,
      Math.max(35, Math.round(totalCells * 0.22))
    );

    const plantEntries = Object.entries(WorldCreatorController.worldSpeciesSelection.plants);

    if (plantEntries.length > 0) {
      const totalGrowthWeight = plantEntries.reduce(
        (sum, [_, item]) => sum + (item.species.genes.growthSpeed || 0.5),
        0
      ) || 1;

      const plantWeights = plantEntries.map(([id, item]) => ({
        id,
        weight: (item.species.genes.growthSpeed || 0.5) / totalGrowthWeight
      }));

      plantWeights.forEach(item => {
        const count = Math.min(
          120,
          Math.round(targetPlantTotal * item.weight)
        );
        WorldCreatorController.setSpeciesCountSlider('plant', item.id, count);
      });
    }

    // 2. Classificação dos animais por nível trófico.
    const animalEntries = Object.entries(WorldCreatorController.worldSpeciesSelection.animals);

    if (animalEntries.length === 0) {
      WorldCreatorController.updateSpeciesTotals();
      UIController.toast('Nenhuma espécie animal disponível para balanceamento.');
      return;
    }

    const herbivores = [];
    const carnivores = [];
    const omnivores = [];

    animalEntries.forEach(([id, item]) => {
      const g = item.species.genes;
      const diet = g.diet || { meat: 0.3, plant: 0.6, carcass: 0.1 };
      const massKg = 5.0 + (g.size || 0.5) * 70.0;
      const basal = 0.06 * Math.pow(massKg / 40.0, 0.75);
      const motion = 0.04 * Math.pow((g.speed || 0.5) * 1.5, 1.5);
      const totalDemand = basal + motion;

      const data = { id, item, genes: g, diet, totalDemand };

      if (diet.meat >= 0.55) {
        carnivores.push(data);
      } else if (diet.plant >= 0.55) {
        herbivores.push(data);
      } else {
        omnivores.push(data);
      }
    });

    // 3. Herbívoros.
    const baseHerbivoreCapacity = Math.max(12, Math.round(targetPlantTotal * 0.36));
    distributePopulation(herbivores, baseHerbivoreCapacity, 80);

    // 4. Onívoros.
    const omniCapacity = Math.max(5, Math.round(baseHerbivoreCapacity * 0.40));
    distributePopulation(omnivores, omniCapacity, 80);

    // 5. Predadores.
    let totalPreyEstimate = 0;
    herbivores.forEach(h => {
      totalPreyEstimate += WorldCreatorController.worldSpeciesSelection.animals[h.id]?.count || 0;
    });
    omnivores.forEach(o => {
      totalPreyEstimate += (WorldCreatorController.worldSpeciesSelection.animals[o.id]?.count || 0) * 0.5;
    });

    const targetPredatorCapacity = Math.max(2, Math.round(totalPreyEstimate * 0.18));
    distributePopulation(carnivores, targetPredatorCapacity, 80);

    WorldCreatorController.updateSpeciesTotals();
    UIController.toast('Populações recalibradas pelo balanceamento trófico!');
  }

  static async applyTestSpeciesProfile() {
    try {
      const selectedProfile = document.getElementById('test-profile-select').value;
      const response = await fetch('data/test-species.json');
      if (!response.ok) throw new Error('Não foi possível carregar test-species.json.');
      const config = await response.json();
      const profile = config.tests.find(test => test.id === selectedProfile);
      if (!profile) throw new Error('Perfil de teste não encontrado.');

      WorldCreatorController.refreshSpeciesCounts();

      Object.values(WorldCreatorController.worldSpeciesSelection.animals).forEach(item => {
        item.count = 0;
      });
      Object.values(WorldCreatorController.worldSpeciesSelection.plants).forEach(item => {
        item.count = 0;
      });

      Object.entries(profile.animals).forEach(([id, count]) => {
        if (WorldCreatorController.worldSpeciesSelection.animals[id]) {
          WorldCreatorController.worldSpeciesSelection.animals[id].count = count;
        } else {
          console.warn(`Espécie animal não encontrada: ${id}`);
        }
      });

      Object.entries(profile.plants).forEach(([id, count]) => {
        if (WorldCreatorController.worldSpeciesSelection.plants[id]) {
          WorldCreatorController.worldSpeciesSelection.plants[id].count = count;
        } else {
          console.warn(`Espécie vegetal não encontrada: ${id}`);
        }
      });

      WorldCreatorController.refreshSpeciesCounts();
      UIController.toast(`Perfil ${selectedProfile} aplicado com sucesso!`);
    } catch (error) {
      console.error('Erro ao aplicar perfil de teste:', error);
      UIController.toast('Erro ao carregar o perfil de teste.');
    }
  }

  static saveAndStartWorld() {
    const size = parseInt(document.getElementById('world-size')?.value || 50);
    const seasonLen = parseInt(document.getElementById('world-season-length')?.value || 120);

    const animalList = [];
    let totalAnimals = 0;
    Object.values(WorldCreatorController.worldSpeciesSelection.animals).forEach(item => {
      const count = parseInt(item.count) || 0;
      if (count > 0) {
        totalAnimals += count;
        animalList.push({
          id: item.species.id,
          name: item.species.name,
          count: count,
          genes: item.species.genes,
          customImages: item.species.customImages || {},
          thumbnail: item.species.thumbnail || null
        });
      }
    });

    const plantList = [];
    let totalPlants = 0;
    Object.values(WorldCreatorController.worldSpeciesSelection.plants).forEach(item => {
      const count = parseInt(item.count) || 0;
      if (count > 0) {
        totalPlants += count;
        plantList.push({
          id: item.species.id,
          name: item.species.name,
          count: count,
          genes: item.species.genes,
          customImages: item.species.customImages || {},
          thumbnail: item.species.thumbnail || null
        });
      }
    });

    const worldConfig = {
      biome: WorldCreatorController.selectedBiomeId,
      gridSize: size,
      seasonLengthTicks: seasonLen,
      initialAnimalCount: totalAnimals,
      initialPlantCount: totalPlants,
      speciesCounts: { animals: animalList, plants: plantList }
    };

    localStorage.setItem('evo_world_config', JSON.stringify(worldConfig));
    const engine = window.engine;
    if (typeof engine !== 'undefined') {
      engine.init(document.getElementById('sim-canvas'), worldConfig);

      // Parâmetros de evolução e equilíbrio
      const mutRate = parseFloat(document.getElementById('world-mutation-rate')?.value || 1.0);
      const satiety = parseInt(document.getElementById('world-predator-satiety')?.value || 65) / 100;
      const seedBank = parseInt(document.getElementById('world-seed-bank')?.value || 14) / 100;
      const homeostasis = document.getElementById('world-auto-homeostasis')?.checked ?? true;

      if (engine.equilibriumSettings) {
        engine.equilibriumSettings.mutationRateMultiplier = mutRate;
        engine.equilibriumSettings.predatorSatietyThreshold = satiety;
        engine.equilibriumSettings.seedBankRate = seedBank;
        engine.equilibriumSettings.autoHomeostasis = homeostasis;
      }

      // ── Ambiente Personalizado ──────────────────────────────
      const initTempOffset = parseInt(document.getElementById('world-init-temp')?.value || 0);
      const waterRatio = parseInt(document.getElementById('world-water-ratio')?.value || 8) / 100;
      const rockyRatio = parseInt(document.getElementById('world-rocky-ratio')?.value || 6) / 100;
      const soilFertility = parseInt(document.getElementById('world-soil-fertility')?.value || 60) / 100;
      const sunlightMod = parseInt(document.getElementById('world-sunlight')?.value || 70) / 100;

      // Temperatura base: 1°C de slider ≈ 0.0625 unidade interna
      engine.climateOffset = initTempOffset / 16.0;

      // Proporção de água / rocha personalizada
      if (Math.abs(waterRatio - 0.08) > 0.01 || Math.abs(rockyRatio - 0.06) > 0.01) {
        for (let r = 0; r < engine.gridRows; r++) {
          for (let c = 0; c < engine.gridCols; c++) {
            const cell = engine.grid[r][c];
            const rnd = Math.random();
            if (cell.biome === 'water' && rnd > waterRatio / 0.08) {
              cell.biome = worldConfig.biome || 'fertile';
              cell.moisture = 0.6;
            } else if (cell.biome !== 'water' && rnd < Math.max(0, waterRatio - 0.08)) {
              cell.biome = 'water';
              cell.moisture = 1.0;
            } else if (cell.biome === 'rocky' && rnd > rockyRatio / 0.06) {
              cell.biome = worldConfig.biome || 'fertile';
            } else if (cell.biome !== 'water' && cell.biome !== 'rocky' && rnd < Math.max(0, rockyRatio - 0.06)) {
              cell.biome = 'rocky';
            }
          }
        }
        engine.createTerrainCache();
      }

      // Fertilidade do solo personalizada
      const fertFactor = soilFertility / 0.60;
      for (let r = 0; r < engine.gridRows; r++) {
        for (let c = 0; c < engine.gridCols; c++) {
          const cell = engine.grid[r][c];
          if (cell.biome !== 'water') {
            cell.soilNitrogen = Math.min(cell.maxSoilNitrogen, cell.soilNitrogen * fertFactor);
            cell.moisture = Math.max(0.1, Math.min(1.0, cell.moisture * (0.5 + soilFertility * 0.8)));
          }
        }
      }

      // Intensidade solar como multiplicador de equilíbrio
      engine.equilibriumSettings.sunlightMultiplier = sunlightMod / 0.70;

      engine.render();
      if (typeof window.updateClimateButtonStates === 'function') {
        window.updateClimateButtonStates();
      }
    }
    UIController.showPage('simulation');
  }
}


// --- controllers/SimulationController.js ---
// ====================================================
//  SIMULATIONCONTROLLER.JS — Controles da tela de simulação, câmera e clima (POO)
// ====================================================



class SimulationController {
  // Câmera interativa com Zoom e Pan
  static camera = {
    zoom: 1.0,
    panX: 0,
    panY: 0,
    isDragging: false,
    hasDragged: false,
    dragStartX: 0,
    dragStartY: 0,
    initialPanX: 0,
    initialPanY: 0,

    apply() {
      const canvas = document.getElementById('sim-canvas');
      const badge = document.getElementById('sim-zoom-badge');
      if (!canvas) return;

      canvas.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
      if (badge) badge.textContent = `${Math.round(this.zoom * 100)}%`;
    },

    zoomAt(factor, clientX = null, clientY = null) {
      const container = document.querySelector('.sim-canvas-area');
      const canvas = document.getElementById('sim-canvas');
      if (!container || !canvas) return;

      const oldZoom = this.zoom;
      const newZoom = Math.max(0.2, Math.min(4.0, oldZoom * factor));
      if (newZoom === oldZoom) return;

      if (clientX !== null && clientY !== null) {
        const rect = container.getBoundingClientRect();
        const mouseX = clientX - rect.left;
        const mouseY = clientY - rect.top;

        this.panX = mouseX - (mouseX - this.panX) * (newZoom / oldZoom);
        this.panY = mouseY - (mouseY - this.panY) * (newZoom / oldZoom);
      }

      this.zoom = newZoom;
      this.apply();
    },

    zoomIn()  { this.zoomAt(1.25); },
    zoomOut() { this.zoomAt(0.8); },

    resetZoom() {
      this.zoom = 1.0;
      this.centerCanvas();
    },

    fitToScreen() {
      const container = document.querySelector('.sim-canvas-area');
      const canvas = document.getElementById('sim-canvas');
      if (!container || !canvas) return;

      const pad = 30;
      const availW = container.clientWidth - pad * 2;
      const availH = container.clientHeight - pad * 2;

      const scaleX = availW / canvas.width;
      const scaleY = availH / canvas.height;
      this.zoom = Math.max(0.2, Math.min(1.0, Math.min(scaleX, scaleY)));
      this.centerCanvas();
    },

    centerCanvas() {
      const container = document.querySelector('.sim-canvas-area');
      const canvas = document.getElementById('sim-canvas');
      if (!container || !canvas) return;

      const scaledW = canvas.width * this.zoom;
      const scaledH = canvas.height * this.zoom;
      this.panX = Math.round((container.clientWidth - scaledW) / 2);
      this.panY = Math.round((container.clientHeight - scaledH) / 2);
      this.apply();
    }
  };

  static init() {
    const container = document.querySelector('.sim-canvas-area');
    const simCanvas = document.getElementById('sim-canvas');
    if (!container || !simCanvas) return;

    // Zoom pela roda do mouse
    container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      SimulationController.camera.zoomAt(factor, e.clientX, e.clientY);
    }, { passive: false });

    // Arrastar mapa com clique do mouse (Pan)
    container.addEventListener('mousedown', (e) => {
      if (e.button !== 0 && e.button !== 1) return;
      const cam = SimulationController.camera;
      cam.isDragging = true;
      cam.hasDragged = false;
      cam.dragStartX = e.clientX;
      cam.dragStartY = e.clientY;
      cam.initialPanX = cam.panX;
      cam.initialPanY = cam.panY;
      container.classList.add('grabbing');
    });

    window.addEventListener('mousemove', (e) => {
      const cam = SimulationController.camera;
      if (!cam.isDragging) return;
      const dx = e.clientX - cam.dragStartX;
      const dy = e.clientY - cam.dragStartY;

      if (Math.hypot(dx, dy) > 4) {
        cam.hasDragged = true;
      }

      cam.panX = cam.initialPanX + dx;
      cam.panY = cam.initialPanY + dy;
      cam.apply();
    });

    window.addEventListener('mouseup', () => {
      const cam = SimulationController.camera;
      if (cam.isDragging) {
        cam.isDragging = false;
        container.classList.remove('grabbing');
      }
    });

    // Seleção, mira de catástrofes e inspeção de criaturas
    simCanvas.addEventListener('click', (e) => {
      const cam = SimulationController.camera;
      if (cam.hasDragged) {
        cam.hasDragged = false;
        return;
      }

      const rect = simCanvas.getBoundingClientRect();
      const scaleX = simCanvas.width / rect.width;
      const scaleY = simCanvas.height / rect.height;
      const clickX = (e.clientX - rect.left) * scaleX;
      const clickY = (e.clientY - rect.top) * scaleY;

      if (window.meteorTargetingActive) {
        SimulationController.triggerMeteorImpactAt(clickX, clickY);
        return;
      }

      const engine = window.engine;
      if (typeof engine !== 'undefined') {
        engine.selectEntityAt(clickX, clickY);
      }
    });
  }

  static startOrResume() {
    const simCanvas = document.getElementById('sim-canvas');
    const engine = window.engine;
    if (!simCanvas || typeof engine === 'undefined') return;

    let cfg = {};
    try { cfg = JSON.parse(localStorage.getItem('evo_world_config') || '{}'); } catch { cfg = {}; }
    if (!engine.canvas || engine.grid.length === 0) engine.init(simCanvas, cfg);
    engine.start();
    SimulationController.updatePlayPauseButtonUI(true);

    setTimeout(() => {
      SimulationController.camera.fitToScreen();
    }, 50);

    // Injeta updateSideConsole no updateStatsUI do engine
    if (engine.updateStatsUI && !engine._sideConsoleHooked) {
      const _orig = engine.updateStatsUI.bind(engine);
      engine.updateStatsUI = function() {
        _orig();
        UIController.updateSideConsole();
      };
      engine._sideConsoleHooked = true;
    }
  }

  static togglePlayPause() {
    const engine = window.engine;
    if (typeof engine === 'undefined') return;
    engine.toggle();
    SimulationController.updatePlayPauseButtonUI(engine.isRunning);
  }

  static updatePlayPauseButtonUI(isPlaying) {
    const btn = document.getElementById('btn-sim-play');
    if (btn) {
      btn.innerHTML = isPlaying ? '⏸️ Pausar' : '▶️ Continuar';
      btn.className = isPlaying ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm';
    }
    const consoleBtn = document.getElementById('btn-console-play');
    if (consoleBtn) {
      consoleBtn.innerHTML = isPlaying ? '⏸️ Pausar' : '▶️ Continuar';
      consoleBtn.className = isPlaying ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm';
    }
  }

  static setSpeed(mult) {
    const engine = window.engine;
    if (typeof engine === 'undefined') return;
    engine.setSpeed(mult);
    document.querySelectorAll('.speed-btn, .console-speed-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.speed) === mult));
  }

  static fastForward() {
    const engine = window.engine;
    if (typeof engine !== 'undefined') engine.fastForward(50);
  }

  static reset() {
    const engine = window.engine;
    if (typeof engine === 'undefined') return;
    let cfg = {};
    try { cfg = JSON.parse(localStorage.getItem('evo_world_config') || '{}'); } catch { cfg = {}; }
    engine.init(document.getElementById('sim-canvas'), cfg);
    engine.start();
    SimulationController.updatePlayPauseButtonUI(true);
    UIController.toast('🔄 Ecossistema reiniciado!');
  }

  // ── AÇÕES ESPECÍFICAS DO MODAL DE EXTINÇÃO ─────────
  static goToWorldCreatorFromExtinction() {
    const modal = document.getElementById('extinction-modal');
    if (modal) modal.style.display = 'none';
    UIController.showPage('world');
  }

  static resetFromExtinction() {
    const modal = document.getElementById('extinction-modal');
    if (modal) modal.style.display = 'none';
    SimulationController.reset();
  }

  static viewAnalyticsFromExtinction() {
    const modal = document.getElementById('extinction-modal');
    if (modal) modal.style.display = 'none';
    if (typeof window.analyticsModal !== 'undefined') {
      window.analyticsModal.open('pop');
    }
  }

  // ── PRESETS DE EVOLUÇÃO ─────────────────────────────
  static applyWorldEvoPreset(preset) {
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = val;
      el.dispatchEvent(new Event('input'));
    };

    if (preset === 'sustainable') {
      setVal('world-mutation-rate', '1.0');
      setVal('world-predator-satiety', '65');
      setVal('world-seed-bank', '14');
      const cb = document.getElementById('world-auto-homeostasis');
      if (cb) { cb.checked = true; cb.dispatchEvent(new Event('change')); }
      UIController.toast('🟢 Preset "Equilíbrio Estável" aplicado!');
    } else if (preset === 'fast-evolution') {
      setVal('world-mutation-rate', '2.2');
      setVal('world-predator-satiety', '70');
      setVal('world-seed-bank', '22');
      const cb = document.getElementById('world-auto-homeostasis');
      if (cb) { cb.checked = true; cb.dispatchEvent(new Event('change')); }
      UIController.toast('⚡ Preset "Evolução Acelerada" aplicado!');
    } else if (preset === 'hardcore') {
      setVal('world-mutation-rate', '1.5');
      setVal('world-predator-satiety', '85');
      setVal('world-seed-bank', '4');
      const cb = document.getElementById('world-auto-homeostasis');
      if (cb) { cb.checked = false; cb.dispatchEvent(new Event('change')); }
      UIController.toast('🦁 Preset "Mundo Selvagem" aplicado! Sem rede de segurança.');
    }
  }

  // ── MODO RÁPIDO / SPRITES SIMPLIFICADOS ─────────────
  static toggleSimplifiedSprites() {
    const engine = window.engine;
    if (typeof engine === 'undefined') return;
    engine.simplifiedSprites = !engine.simplifiedSprites;
    localStorage.setItem('evo_simplified_sprites', engine.simplifiedSprites ? 'true' : 'false');
    SimulationController.updateSimplifiedButtonUI();
    engine.render();
    UIController.toast(engine.simplifiedSprites ? '⚡ Modo Rápido (Sprites Simplificados) ativado!' : '🎨 Modo Detalhado ativado!');
  }

  static updateSimplifiedButtonUI() {
    const btn = document.getElementById('btn-toggle-simplified');
    const engine = window.engine;
    if (!btn || typeof engine === 'undefined') return;
    if (engine.simplifiedSprites) {
      btn.innerHTML = '⚡ Modo Rápido: Ativo';
      btn.classList.add('active');
    } else {
      btn.innerHTML = '⚡ Modo Rápido: Desligado';
      btn.classList.remove('active');
    }
  }

  // ── CONTROLE DE CATÁSTROFES: METEORO ────────────────
  static toggleMeteorMode() {
    const btn = document.getElementById('btn-trigger-meteor');
    const container = document.querySelector('.sim-canvas-area');
    const engine = window.engine;

    if (window.meteorTargetingActive) {
      window.meteorTargetingActive = false;
      if (btn) btn.classList.remove('active');
      if (container) container.classList.remove('targeting-meteor');
      if (typeof engine !== 'undefined') {
        engine.triggerMeteor();
        if (!engine.isRunning) engine.render();
      }
      return;
    }

    window.meteorTargetingActive = true;
    if (btn) btn.classList.add('active');
    if (container) container.classList.add('targeting-meteor');
    UIController.toast('☄️ Modo Catástrofe: Clique no mapa para lançar o meteoro (ou clique no botão novamente para queda aleatória)!', 4000);
  }

  static triggerMeteorImpactAt(x, y) {
    const btn = document.getElementById('btn-trigger-meteor');
    const container = document.querySelector('.sim-canvas-area');
    const engine = window.engine;

    window.meteorTargetingActive = false;
    if (btn) btn.classList.remove('active');
    if (container) container.classList.remove('targeting-meteor');

    if (typeof engine !== 'undefined') {
      engine.triggerMeteor(x, y);
      if (!engine.isRunning) engine.render();
    }
  }

  // ── CONTROLES DE MUDANÇA CLIMÁTICA ──────────────────
  static shiftClimateGlobal(delta) {
    const engine = window.engine;
    if (typeof engine === 'undefined') return;
    engine.shiftClimate(delta);
    SimulationController.updateClimateButtonStates();
    if (!engine.isRunning) engine.updateStatsUI();
  }

  static resetClimate() {
    const engine = window.engine;
    if (typeof engine === 'undefined') return;
    engine.climateOffset = 0.0;
    engine.shiftClimate(0);
    UIController.toast('🌡️ Temperatura climática resetada para o padrão natural.');
    SimulationController.updateClimateButtonStates();
    if (!engine.isRunning) engine.updateStatsUI();
  }

  static updateClimateButtonStates() {
    const resetBtn = document.getElementById('btn-reset-climate');
    const engine = window.engine;
    if (!resetBtn || typeof engine === 'undefined') return;
    const off = engine.climateOffset || 0;
    if (Math.abs(off) > 0.05) {
      resetBtn.style.color = off > 0 ? 'var(--accent-hot)' : 'var(--accent-cold)';
      resetBtn.style.borderColor = off > 0 ? 'var(--accent-hot)' : 'var(--accent-cold)';
    } else {
      resetBtn.style.color = '';
      resetBtn.style.borderColor = '';
    }
  }

  // ── AMBIENTE PERSONALIZADO: label de temperatura ─────
  static updateInitTempLabel(val) {
    const el = document.getElementById('world-init-temp-val');
    if (el) el.textContent = (val >= 0 ? '+' : '') + val + '°C';
  }
}


// --- main.js ---
// ====================================================
//  MAIN.JS — Ponto de Entrada Principal (ES Modules & POO)
// ====================================================









// Instância global do motor de simulação (acessível pelo sistema e UI)
const engine = new SimulationEngine();
window.engine = engine;
window.SEASONS = SEASONS;
window.HARD_CRASH_FAILSAFE = HARD_CRASH_FAILSAFE;
window.SPECIES_PALETTE = SPECIES_PALETTE;

// Pontes reativas para paint.js e outros scripts secundários
Object.defineProperty(window, 'currentAnimalImages', {
  get: () => AnimalCreatorController.currentImages,
  set: (v) => { AnimalCreatorController.currentImages = v; },
  configurable: true
});
Object.defineProperty(window, 'currentPlantImages', {
  get: () => PlantCreatorController.currentImages,
  set: (v) => { PlantCreatorController.currentImages = v; },
  configurable: true
});
Object.defineProperty(window, 'currentAnimalGenes', {
  get: () => AnimalCreatorController.currentGenes,
  set: (v) => { AnimalCreatorController.currentGenes = v; },
  configurable: true
});
Object.defineProperty(window, 'currentPlantGenes', {
  get: () => PlantCreatorController.currentGenes,
  set: (v) => { PlantCreatorController.currentGenes = v; },
  configurable: true
});
Object.defineProperty(window, 'savedAnimals', {
  get: () => AnimalCreatorController.savedAnimals,
  set: (v) => { AnimalCreatorController.savedAnimals = v; },
  configurable: true
});
Object.defineProperty(window, 'savedPlants', {
  get: () => PlantCreatorController.savedPlants,
  set: (v) => { PlantCreatorController.savedPlants = v; },
  configurable: true
});

// Exporta classes e controladores


// ── MAPEAMENTO DE INTERFACE GLOBAL (COMPATIBILIDADE COM HTML INLINE) ──

// UI & Navegação
window.showPage = UIController.showPage.bind(UIController);
window.toast = UIController.toast.bind(UIController);
window.switchSidePanel = UIController.switchSidePanel.bind(UIController);
window.updateSideConsole = UIController.updateSideConsole.bind(UIController);

// Criador de Animais
window.initAnimalCreator = AnimalCreatorController.init.bind(AnimalCreatorController);
window.updateAnimalSliderLabel = AnimalCreatorController.updateSliderLabel.bind(AnimalCreatorController);
window.updateStrictDietUI = AnimalCreatorController.updateStrictDietUI.bind(AnimalCreatorController);
window.syncDietSlidersUI = AnimalCreatorController.syncDietSlidersUI.bind(AnimalCreatorController);
window.renderAnimalPreview = AnimalCreatorController.renderPreview.bind(AnimalCreatorController);
window.clearComponentImage = (type, part) => {
  if (type === 'animal') AnimalCreatorController.clearComponentImage('animal', part);
  else PlantCreatorController.clearComponentImage(part);
};
window.clearComponentImagePlant = PlantCreatorController.clearComponentImage.bind(PlantCreatorController);
window.updateComponentBox = AnimalCreatorController.updateComponentBox.bind(AnimalCreatorController);
window.switchAnimalSidebarTab = AnimalCreatorController.switchSidebarTab.bind(AnimalCreatorController);
window.saveAnimalSpecies = AnimalCreatorController.saveSpecies.bind(AnimalCreatorController);
window.exportAnimalPNG = AnimalCreatorController.exportPNG.bind(AnimalCreatorController);
window.renderSavedAnimalsList = AnimalCreatorController.renderSavedList.bind(AnimalCreatorController);
window.loadAnimal = AnimalCreatorController.load.bind(AnimalCreatorController);
window.deleteAnimal = AnimalCreatorController.delete.bind(AnimalCreatorController);
window.downloadAnimalPNG = AnimalCreatorController.downloadPNG.bind(AnimalCreatorController);
window.randomizeAnimalGenes = AnimalCreatorController.randomizeGenes.bind(AnimalCreatorController);
window.resetAnimalGenes = AnimalCreatorController.resetGenes.bind(AnimalCreatorController);

// Criador de Plantas
window.initPlantCreator = PlantCreatorController.init.bind(PlantCreatorController);
window.updatePlantSliderLabel = PlantCreatorController.updateSliderLabel.bind(PlantCreatorController);
window.renderPlantPreview = PlantCreatorController.renderPreview.bind(PlantCreatorController);
window.switchPlantSidebarTab = PlantCreatorController.switchSidebarTab.bind(PlantCreatorController);
window.savePlantSpecies = PlantCreatorController.saveSpecies.bind(PlantCreatorController);
window.exportPlantPNG = PlantCreatorController.exportPNG.bind(PlantCreatorController);
window.renderSavedPlantsList = PlantCreatorController.renderSavedList.bind(PlantCreatorController);
window.loadPlant = PlantCreatorController.load.bind(PlantCreatorController);
window.deletePlant = PlantCreatorController.delete.bind(PlantCreatorController);
window.downloadPlantPNG = PlantCreatorController.downloadPNG.bind(PlantCreatorController);
window.randomizePlantGenes = PlantCreatorController.randomizeGenes.bind(PlantCreatorController);
window.resetPlantGenes = PlantCreatorController.resetGenes.bind(PlantCreatorController);

// Criador de Mundos
window.initWorldCreator = WorldCreatorController.init.bind(WorldCreatorController);
window.selectWorldBiome = WorldCreatorController.selectBiome.bind(WorldCreatorController);
window.refreshWorldSpeciesCounts = WorldCreatorController.refreshSpeciesCounts.bind(WorldCreatorController);
window.createSpeciesCard = WorldCreatorController.createSpeciesCard.bind(WorldCreatorController);
window.setSpeciesCountSlider = WorldCreatorController.setSpeciesCountSlider.bind(WorldCreatorController);
window.adjustAllSpeciesCounts = WorldCreatorController.adjustAllSpeciesCounts.bind(WorldCreatorController);
window.zeroAllSpeciesCounts = WorldCreatorController.zeroAllSpeciesCounts.bind(WorldCreatorController);
window.updateWorldSpeciesTotals = WorldCreatorController.updateSpeciesTotals.bind(WorldCreatorController);
window.autoBalanceTrophicPopulations = WorldCreatorController.autoBalanceTrophicPopulations.bind(WorldCreatorController);
window.applyTestSpeciesProfile = WorldCreatorController.applyTestSpeciesProfile.bind(WorldCreatorController);
window.saveAndStartWorld = WorldCreatorController.saveAndStartWorld.bind(WorldCreatorController);
window.getSpeciesThumbnail = WorldCreatorController.getSpeciesThumbnail.bind(WorldCreatorController);

// Simulação & Câmera
window.simCamera = SimulationController.camera;
window.initSimulationScreen = SimulationController.init.bind(SimulationController);
window.startOrResumeSimulation = SimulationController.startOrResume.bind(SimulationController);
window.togglePlayPause = SimulationController.togglePlayPause.bind(SimulationController);
window.updatePlayPauseButtonUI = SimulationController.updatePlayPauseButtonUI.bind(SimulationController);
window.setSimSpeed = SimulationController.setSpeed.bind(SimulationController);
window.simFastForward = SimulationController.fastForward.bind(SimulationController);
window.resetSimulation = SimulationController.reset.bind(SimulationController);
window.goToWorldCreatorFromExtinction = SimulationController.goToWorldCreatorFromExtinction.bind(SimulationController);
window.resetSimulationFromExtinction = SimulationController.resetFromExtinction.bind(SimulationController);
window.viewAnalyticsFromExtinction = SimulationController.viewAnalyticsFromExtinction.bind(SimulationController);
window.applyWorldEvoPreset = SimulationController.applyWorldEvoPreset.bind(SimulationController);
window.toggleSimplifiedSprites = SimulationController.toggleSimplifiedSprites.bind(SimulationController);
window.updateSimplifiedButtonUI = SimulationController.updateSimplifiedButtonUI.bind(SimulationController);
window.toggleMeteorMode = SimulationController.toggleMeteorMode.bind(SimulationController);
window.triggerMeteorImpactAt = SimulationController.triggerMeteorImpactAt.bind(SimulationController);
window.shiftClimateGlobal = SimulationController.shiftClimateGlobal.bind(SimulationController);
window.resetClimate = SimulationController.resetClimate.bind(SimulationController);
window.updateClimateButtonStates = SimulationController.updateClimateButtonStates.bind(SimulationController);
window.updateInitTempLabel = SimulationController.updateInitTempLabel.bind(SimulationController);

// ── INICIALIZAÇÃO NO DOM READY ─────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (typeof window.miniPaint !== 'undefined') window.miniPaint.init();
  if (typeof window.systemConsole !== 'undefined') window.systemConsole.init();
  AnimalCreatorController.init();
  PlantCreatorController.init();
  WorldCreatorController.init();
  SimulationController.init();
  SimulationController.updateSimplifiedButtonUI();
  UIController.showPage('menu');
});


