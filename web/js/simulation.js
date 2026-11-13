// ====================================================
//  SIMULATION.JS — Motor da Simulação Ecológica 2D em POO
//  Arquitetura Orientada a Objetos com Encapsulamento,
//  Herança e Despacho Polimórfico de Entidades
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

// ════════════════════════════════════════════════════
// 1. VALUE OBJECTS & GENÉTICA (POO)
// ════════════════════════════════════════════════════

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

// Funções globais legadas para retrocompatibilidade
function getGeneticDistance(a, b) { return Genome.getGeneticDistance(a, b); }
function evaluateSpeciation(c, f) { return Genome.evaluateAnimalSpeciation(c, f); }
function evaluatePlantSpeciation(c, f) { return Genome.evaluatePlantSpeciation(c, f); }
function mutateAndNormalizeDiet(d) { return Genome.mutateAndNormalizeDiet(d); }

// ════════════════════════════════════════════════════
// 2. MODELO DE GRADE E SOLO (POO)
// ════════════════════════════════════════════════════

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
}

// ════════════════════════════════════════════════════
// 3. HIERARQUIA DE ENTIDADES E ORGANISMOS (POO)
// ════════════════════════════════════════════════════

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

    const lightFactor = (curSeason.sunlight * 1.0) / (0.4 + curSeason.sunlight);
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

// ════════════════════════════════════════════════════
// 4. MOTOR DA SIMULAÇÃO (SimulationEngine)
// ════════════════════════════════════════════════════

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
    this.initEquilibriumSettings();
  }

  initEquilibriumSettings() {
    this.equilibriumSettings = {
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
    for (let r = 0; r < this.gridRows; r++) {
      for (let c = 0; c < this.gridCols; c++) {
        const cell = this.grid[r][c];
        if (cell.biome !== 'water') {
          cell.soilNitrogen = Math.min(100, cell.soilNitrogen + 25.0);
          cell.moisture = Math.max(0.40, cell.moisture);
        }
      }
    }

    const neededPlants = Math.max(0, 45 - this.plants.length);
    if (neededPlants > 0) {
      for (let i = 0; i < neededPlants; i++) {
        const r = Math.floor(Math.random() * this.gridRows);
        const c = Math.floor(Math.random() * this.gridCols);
        this.spawnSinglePlant('Grama Pioneira', { growthSpeed: 0.7, rootEfficiency: 0.7, height: 0.35, defense: 0.2 }, {}, r, c);
      }
    }

    if (typeof toast === 'function') {
      toast('🚑 Intervenção de Emergência executada: solo nutrido e plantas pioneiras semeadas!');
    }
  }

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

  createTerrainCache() {
    if (!this.canvas) return;
    if (!this.terrainCanvas) {
      this.terrainCanvas = document.createElement('canvas');
    }
    this.terrainCanvas.width = this.canvas.width;
    this.terrainCanvas.height = this.canvas.height;
    const tctx = this.terrainCanvas.getContext('2d');
    if (!tctx) return;

    const baseColors = {
      fertile: '#1a3320',
      arid: '#382e1e',
      tundra: '#1f2a38',
      wetland: '#153028',
      water: '#0d223a',
      rocky: '#262626'
    };

    for (let r = 0; r < this.gridRows; r++) {
      for (let c = 0; c < this.gridCols; c++) {
        const cell = this.grid[r][c];
        tctx.fillStyle = cell.cachedColor || baseColors[cell.biome] || '#1a3320';
        tctx.fillRect(c * this.cellSize, r * this.cellSize, this.cellSize, this.cellSize);

        if (this.showGridLines) {
          tctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
          tctx.lineWidth = 1;
          tctx.strokeRect(c * this.cellSize, r * this.cellSize, this.cellSize, this.cellSize);
        }
      }
    }
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

  buildGrid(biomeType) {
    this.grid = [];
    const baseColors = {
      fertile: '#1a3320',
      arid: '#382e1e',
      tundra: '#1f2a38',
      wetland: '#153028',
      water: '#0d223a',
      rocky: '#262626'
    };

    for (let r = 0; r < this.gridRows; r++) {
      const row = [];
      for (let c = 0; c < this.gridCols; c++) {
        let b = biomeType;
        if (Math.random() < 0.08) b = 'water';
        else if (Math.random() < 0.06) b = 'rocky';

        const cell = new GridCell(r, c, this.cellSize, b);
        cell.elevation = Math.random();
        cell.moisture = b === 'water' ? 1.0 : (b === 'wetland' ? 0.85 : (b === 'arid' ? 0.2 : 0.6));
        cell.maxSoilNitrogen = b === 'fertile' ? 120 : (b === 'arid' ? 45 : (b === 'tundra' ? 55 : (b === 'wetland' ? 90 : 20)));
        cell.soilNitrogen = cell.maxSoilNitrogen * (0.5 + Math.random() * 0.4);
        cell.organicBiomass = Math.random() * 5.0;

        const base = baseColors[b] || '#1a3320';
        const lum = Math.floor((Math.random() - 0.5) * 14);
        cell.cachedColor = this.adjustColor(base, lum);

        row.push(cell);
      }
      this.grid.push(row);
    }
  }

  adjustColor(hex, amt) {
    let num = parseInt(hex.slice(1), 16);
    let r = Math.min(255, Math.max(0, (num >> 16) + amt));
    let g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amt));
    let b = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }

  spawnInitialPlants(count) {
    this.plants = [];
    const speciesList = this.worldConfig?.speciesCounts?.plants;

    if (speciesList && speciesList.length > 0) {
      speciesList.forEach(sp => {
        const n = sp.count || 10;
        for (let i = 0; i < n; i++) {
          const r = Math.floor(Math.random() * this.gridRows);
          const c = Math.floor(Math.random() * this.gridCols);
          this.spawnSinglePlant(sp.name, sp.genes, sp.customImages || {}, r, c);
        }
      });
      return;
    }

    const targetCount = count || 40;
    for (let i = 0; i < targetCount; i++) {
      const r = Math.floor(Math.random() * this.gridRows);
      const c = Math.floor(Math.random() * this.gridCols);
      this.spawnSinglePlant('Grama Comum', { growthSpeed: 0.6, height: 0.4, defense: 0.25, rootEfficiency: 0.6 }, {}, r, c);
    }
  }

  spawnSinglePlant(name, genes, customImages, targetR, targetC) {
    const r = (targetR !== undefined) ? targetR : Math.floor(Math.random() * this.gridRows);
    const c = (targetC !== undefined) ? targetC : Math.floor(Math.random() * this.gridCols);
    const cell = this.grid[r]?.[c];
    if (!cell || cell.biome === 'water' || cell.plant) return null;

    this.registerSpecies(name, 'plant', genes);
    const plant = new Plant(
      'plant_' + Math.random().toString(36).substr(2, 9),
      name || 'Vegetal',
      r, c,
      this.cellSize,
      genes,
      customImages
    );
    if (this.tickCount === 0) {
      plant.age = Math.floor(Math.random() * 120);
      plant.growth = 0.25 + Math.random() * 0.45;
    }
    cell.plant = plant;
    this.plants.push(plant);
    return plant;
  }

  spawnSpeciesInClusters(name, genes, customImages, count, clusterCount = 3) {
    const validCells = [];
    for (let r = 0; r < this.gridRows; r++) {
      for (let c = 0; c < this.gridCols; c++) {
        if (this.grid[r][c].biome !== 'water') {
          validCells.push({
            x: (c + 0.5) * this.cellSize,
            y: (r + 0.5) * this.cellSize
          });
        }
      }
    }

    if (validCells.length === 0) return;

    this.spawnGroupCenters ??= [];
    const minCenterDist = Math.max(120, Math.min(this.canvas.width, this.canvas.height) * 0.28);
    const centers = [];
    const actualClusters = Math.min(clusterCount, Math.max(1, Math.floor(count / 2)));

    for (let k = 0; k < actualClusters; k++) {
      let chosen = null, maxDistToOthers = -1;
      for (let attempt = 0; attempt < 30; attempt++) {
        const candidate = validCells[Math.floor(Math.random() * validCells.length)];
        let minDist = Infinity;
        const allExisting = [...this.spawnGroupCenters, ...centers];
        allExisting.forEach(existing => {
          const d = Math.hypot(candidate.x - existing.x, candidate.y - existing.y);
          if (d < minDist) minDist = d;
        });

        if (minDist >= minCenterDist) { chosen = candidate; break; }
        if (minDist > maxDistToOthers) { maxDistToOthers = minDist; chosen = candidate; }
      }
      const finalCenter = chosen || validCells[Math.floor(Math.random() * validCells.length)];
      centers.push(finalCenter);
      this.spawnGroupCenters.push(finalCenter);
    }

    const basePerCluster = Math.floor(count / centers.length);
    let remainder = count % centers.length;

    centers.forEach((center, idx) => {
      const clusterSize = basePerCluster + (idx < remainder ? 1 : 0);
      for (let i = 0; i < clusterSize; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 45;
        const targetX = Math.max(15, Math.min((this.gridCols * this.cellSize) - 15, center.x + Math.cos(angle) * radius));
        const targetY = Math.max(15, Math.min((this.gridRows * this.cellSize) - 15, center.y + Math.sin(angle) * radius));
        this.spawnAnimal(name, genes, customImages, targetX, targetY);
      }
    });
  }

  spawnInitialAnimals(count) {
    this.animals = [];
    this.carcasses = [];
    this.spawnGroupCenters = [];
    const speciesList = this.worldConfig?.speciesCounts?.animals;

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
    let sumX = 0, sumY = 0, count = 0;
    for (let r = 0; r < this.gridRows; r++) {
      for (let c = 0; c < this.gridCols; c++) {
        if (this.grid[r][c].biome !== 'water') {
          sumX += (c + 0.5) * this.cellSize;
          sumY += (r + 0.5) * this.cellSize;
          count++;
        }
      }
    }
    if (count > 0) return { x: sumX / count, y: sumY / count };
    return { x: (this.gridCols * this.cellSize) / 2, y: (this.gridRows * this.cellSize) / 2 };
  }

  spawnAnimal(name, genes, customImages, targetX = null, targetY = null) {
    let rx, ry;
    if (targetX !== null && targetY !== null) {
      rx = targetX;
      ry = targetY;
      const cr = Math.floor(ry / this.cellSize);
      const cc = Math.floor(rx / this.cellSize);
      if (this.grid[cr]?.[cc]?.biome === 'water') {
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

    this.registerSpecies(name, 'animal', genes);

    const animal = new Animal(
      'anim_' + Math.random().toString(36).substr(2, 9),
      name || 'Criatura',
      name || 'Criatura',
      rx, ry,
      animalGenes,
      customImages
    );

    if (this.tickCount === 0) {
      animal.age = Math.floor(Math.random() * 260);
    }
    this.animals.push(animal);
    return animal;
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

    this.climateTrend = -0.00015 * this.generation + Math.sin(this.tickCount * 0.0012) * 0.25;
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

  handleExtinction() {
    this.pause();
    const modal = document.getElementById('extinction-modal');
    if (modal) {
      document.getElementById('extinction-gen').textContent = this.generation;
      document.getElementById('extinction-ticks').textContent = this.tickCount;
      modal.style.display = 'flex';
    }
  }

  reinjectPioneers(count = 18) {
    if (!Number.isFinite(count) || count <= 0) return;
    const speciesList = this.worldConfig?.speciesCounts?.animals;

    if (speciesList && speciesList.length > 0) {
      const availableSpecies = speciesList.filter(sp => sp && sp.name && sp.genes);
      if (availableSpecies.length === 0) return;
      const baseCount = Math.floor(count / availableSpecies.length);
      const remainder = count % availableSpecies.length;

      availableSpecies.forEach((sp, index) => {
        const amount = baseCount + (index < remainder ? 1 : 0);
        this.spawnSpeciesInClusters(sp.name, sp.genes, sp.customImages || {}, amount);
      });
      return;
    }

    const savedAnimals = JSON.parse(localStorage.getItem('evo_animals') || '[]');
    if (savedAnimals.length > 0) {
      const baseCount = Math.floor(count / savedAnimals.length);
      const remainder = count % savedAnimals.length;
      savedAnimals.forEach((sp, index) => {
        const amount = baseCount + (index < remainder ? 1 : 0);
        this.spawnSpeciesInClusters(sp.name, sp.genes, sp.customImages || {}, amount);
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

    this.spawnSpeciesInClusters('Herbívoro Campestre', herbGenes, {}, herbCount);
    this.spawnSpeciesInClusters('Predador Alfa', predGenes, {}, predCount);
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

  render() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);

    if (this.terrainCanvas && this.terrainCanvas.width === W && this.terrainCanvas.height === H) {
      ctx.drawImage(this.terrainCanvas, 0, 0);
    } else {
      this.createTerrainCache();
      if (this.terrainCanvas) ctx.drawImage(this.terrainCanvas, 0, 0);
    }

    // Carcaças
    this.carcasses.forEach(c => {
      if (!c || c.remainingEnergy <= 0) return;
      ctx.save();
      if (this.highlightedSpecies) {
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
    if (this.simplifiedSprites) {
      this.plants.forEach(plant => {
        try {
          const isTargetSpecies = !this.highlightedSpecies || (plant.name === this.highlightedSpecies);
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

          if (this.highlightedSpecies && isTargetSpecies) {
            ctx.strokeStyle = '#56d364';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        } catch (err) {}
      });
    } else {
      this.plants.forEach(plant => {
        try {
          const isTargetSpecies = !this.highlightedSpecies || (plant.name === this.highlightedSpecies);
          ctx.save();
          if (this.highlightedSpecies && !isTargetSpecies) {
            ctx.globalAlpha = 0.20;
          }
          const pScale = 0.35 + (plant.growth || 0.5) * 0.35;
          drawPlant(ctx, plant.genes, plant.x, plant.y + 4, pScale, plant.customImages || {});
          ctx.restore();

          if (this.highlightedSpecies && isTargetSpecies) {
            ctx.save();
            const pulse = (Math.sin(Date.now() * 0.007) + 1) * 0.5;
            const spData = this.speciesCatalog.find(s => s.name === plant.name);
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
    if (this.simplifiedSprites) {
      this.animals.forEach(anim => {
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
      this.animals.forEach(anim => {
        try {
          const animSpecies = anim.speciesName || anim.name;
          const isTargetSpecies = !this.highlightedSpecies || (animSpecies === this.highlightedSpecies);

          ctx.save();
          if (this.highlightedSpecies && !isTargetSpecies) {
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

    if (this.selectedEntity) {
      const isAlive = this.selectedEntity.type === 'animal'
        ? this.animals.includes(this.selectedEntity.data)
        : this.plants.includes(this.selectedEntity.data);

      if (!isAlive) {
        this.selectedEntity = null;
        this.updateInspectorUI();
      } else {
        const e = this.selectedEntity.data;
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

    const effectiveTemp = SEASONS[this.seasonIndex].temp + (this.climateTrend || 0);
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
    if (this.disasterEffects && this.disasterEffects.length > 0) {
      for (let i = this.disasterEffects.length - 1; i >= 0; i--) {
        const eff = this.disasterEffects[i];
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
                this.applyMeteorPhysicalImpact(eff);
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
              this.disasterEffects.splice(i, 1);
            }
          }
        }
      }
    }

    if (this.impactWinterTicks > 0) {
      ctx.save();
      const intensity = Math.min(1.0, this.impactWinterTicks / 50.0);
      ctx.fillStyle = `rgba(45, 35, 30, ${0.30 * intensity})`;
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = 'rgba(200, 190, 180, 0.45)';
      const ashSeed = (this.tickCount * 2) % 100;
      for (let s = 0; s < 22; s++) {
        const ax = ((s * 47 + ashSeed * 7) % W);
        const ay = ((s * 31 + this.tickCount * 3) % H);
        ctx.fillRect(ax, ay, 2, 2);
      }
      ctx.restore();
    }
  }

  triggerMeteor(targetX = null, targetY = null) {
    if (targetX === null || targetY === null) {
      if (this.animals.length > 0 && Math.random() < 0.75) {
        const targetAnim = this.animals[Math.floor(Math.random() * this.animals.length)];
        targetX = targetAnim.x + (Math.random() * 40 - 20);
        targetY = targetAnim.y + (Math.random() * 40 - 20);
      } else {
        targetX = (0.2 + Math.random() * 0.6) * (this.gridCols * this.cellSize);
        targetY = (0.2 + Math.random() * 0.6) * (this.gridRows * this.cellSize);
      }
    }

    targetX = Math.max(25, Math.min(this.gridCols * this.cellSize - 25, targetX));
    targetY = Math.max(25, Math.min(this.gridRows * this.cellSize - 25, targetY));

    this.disasterEffects ??= [];
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
      maxExplosionAge: 36,
      particles: [],
      shockwaveRadius: 0,
      maxShockwaveRadius: 115,
      craterRadiusPx: 48,
      executedImpact: false
    };

    for (let i = 0; i < 50; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.0 + Math.random() * 6.5;
      meteorEffect.particles.push({
        x: targetX,
        y: targetY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2.0 + Math.random() * 3.5,
        color: Math.random() < 0.5 ? '#ff5722' : (Math.random() < 0.5 ? '#ffeb3b' : '#ffffff'),
        life: 1.0,
        decay: 0.02 + Math.random() * 0.03
      });
    }

    this.disasterEffects.push(meteorEffect);

    if (typeof toast === 'function') {
      toast('☄️ CATÁSTROFE: Meteoro penetrou na atmosfera em direção ao quadrante!');
    }
  }

  applyMeteorPhysicalImpact(effect) {
    const targetX = effect.targetX;
    const targetY = effect.targetY;
    const craterCellRadius = 2.5;
    const shockRadiusPx = effect.maxShockwaveRadius || 115;

    let destroyedPlants = 0;
    let vaporizedAnimals = 0;
    let damagedAnimals = 0;

    for (let r = 0; r < this.gridRows; r++) {
      for (let c = 0; c < this.gridCols; c++) {
        const cell = this.grid[r]?.[c];
        if (!cell) continue;

        const cellCenterX = (c + 0.5) * this.cellSize;
        const cellCenterY = (r + 0.5) * this.cellSize;
        const dist = Math.hypot(cellCenterX - targetX, cellCenterY - targetY);
        const distInCells = dist / this.cellSize;

        if (distInCells <= craterCellRadius) {
          cell.biome = 'rocky';
          cell.soilNitrogen = Math.max(0.5, cell.soilNitrogen * 0.1);
          cell.moisture = Math.max(0.05, cell.moisture * 0.15);
          cell.addOrganicBiomass(30.0);

          if (cell.plant) {
            const pIdx = this.plants.indexOf(cell.plant);
            if (pIdx !== -1) this.plants.splice(pIdx, 1);
            cell.plant = null;
            this.plantMetrics.nutrientDeaths++;
            destroyedPlants++;
          }
        } else if (dist <= shockRadiusPx) {
          cell.moisture = Math.max(0.05, cell.moisture * 0.4);
          if (cell.plant && Math.random() < 0.65) {
            const pIdx = this.plants.indexOf(cell.plant);
            if (pIdx !== -1) this.plants.splice(pIdx, 1);
            cell.plant = null;
            this.plantMetrics.nutrientDeaths++;
            destroyedPlants++;
          }
        }
      }
    }

    for (let i = this.animals.length - 1; i >= 0; i--) {
      const a = this.animals[i];
      const dist = Math.hypot(a.x - targetX, a.y - targetY);

      if (dist <= effect.craterRadiusPx) {
        if (Math.random() < 0.45) {
          const ar = Math.floor(a.y / this.cellSize);
          const ac = Math.floor(a.x / this.cellSize);
          const cell = this.grid[ar]?.[ac];
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
            this.carcasses.push(carcass);
          }
        }
        this.animals.splice(i, 1);
        vaporizedAnimals++;
      } else if (dist <= shockRadiusPx) {
        const factor = 1.0 - (dist / shockRadiusPx);
        const damage = factor * 70.0;
        a.energy -= damage;

        const angle = Math.atan2(a.y - targetY, a.x - targetX);
        const impulse = factor * 9.0;
        a.vx += Math.cos(angle) * impulse;
        a.vy += Math.sin(angle) * impulse;
        a.stateLabel = 'Queimado por Onda de Choque!';

        if (a.energy <= 0) {
          this.animals.splice(i, 1);
          vaporizedAnimals++;
        } else {
          damagedAnimals++;
        }
      }
    }

    this.createTerrainCache();
    this.impactWinterTicks = 140;

    const msg = `💥 IMPACTO! ${vaporizedAnimals} animais e ${destroyedPlants} plantas eliminados! Inverno de Cinzas ativo por 140 ticks!`;
    if (typeof toast === 'function') toast(msg, 4500);
    console.log('[CATÁSTROFE]', msg);
  }

  updateStatsUI() {
    const elSeason = document.getElementById('sim-season-badge');
    const elGen = document.getElementById('sim-gen-badge');
    const elAnimals = document.getElementById('stat-animals-count');
    const elPlants = document.getElementById('stat-plants-count');
    const elCarcasses = document.getElementById('stat-carcasses-count');

    const curSeason = SEASONS[this.seasonIndex];
    const effTemp = curSeason.temp + (this.climateTrend || 0);
    const tempDeg = Math.round(18 + effTemp * 16);
    if (this.impactWinterTicks > 0) {
      if (elSeason) elSeason.innerHTML = `☄️ Inverno de Impacto (${tempDeg - 6}°C) [${this.impactWinterTicks}t]`;
    } else {
      if (elSeason) elSeason.innerHTML = `${curSeason.icon} ${curSeason.name} (${tempDeg}°C)`;
    }
    if (elGen) elGen.textContent = `Geração ${this.generation}`;
    if (elAnimals) elAnimals.textContent = this.animals.length;
    if (elPlants) elPlants.textContent = this.plants.length;
    if (elCarcasses) elCarcasses.textContent = this.carcasses.length;

    this.updateCensusUI();

    if (this.selectedEntity) {
      this.updateInspectorUI();
    }

    if (typeof window !== 'undefined' && window.systemConsole) {
      if (typeof window.systemConsole.updateConsoleHeader === 'function') window.systemConsole.updateConsoleHeader();
    }
  }

  updateCensusUI() {
    const censusBox = document.getElementById('sim-species-census');
    if (!censusBox) return;

    if (this.speciesCatalog.length === 0) {
      censusBox.innerHTML = '<span style="color:var(--text-dim);font-size:11px;">Nenhuma espécie cadastrada.</span>';
      return;
    }

    const animalCounts = {};
    this.animals.forEach(a => {
      const sp = a.speciesName || a.name;
      animalCounts[sp] = (animalCounts[sp] || 0) + 1;
    });

    const plantCounts = {};
    this.plants.forEach(p => {
      const sp = p.name;
      plantCounts[sp] = (plantCounts[sp] || 0) + 1;
    });

    const totalAnimals = this.animals.length || 1;
    const totalPlants = this.plants.length || 1;

    const animalSpecies = this.speciesCatalog.filter(s => s.type === 'animal');
    const plantSpecies = this.speciesCatalog.filter(s => s.type === 'plant');

    let html = '';

    if (animalSpecies.length > 0) {
      html += '<div style="font-weight:700;color:var(--text-dim);font-size:10px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;display:flex;justify-content:space-between;">' +
              '<span>🦊 População Animal (' + this.animals.length + ')</span>' +
              '<span style="font-size:9px;text-transform:none;opacity:0.8;">(Clique para focar)</span></div>';

      animalSpecies.forEach(sp => {
        const count = animalCounts[sp.name] || 0;
        const pct = Math.min(100, Math.round((count / totalAnimals) * 100));
        const isExtinct = (count === 0);
        const isHighlighted = (this.highlightedSpecies === sp.name);

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
              '<span>🌿 População Vegetal (' + this.plants.length + ')</span>' +
              '<span style="font-size:9px;text-transform:none;opacity:0.8;">(Clique para focar)</span></div>';

      plantSpecies.forEach(sp => {
        const count = plantCounts[sp.name] || 0;
        const pct = Math.min(100, Math.round((count / totalPlants) * 100));
        const isExtinct = (count === 0);
        const isHighlighted = (this.highlightedSpecies === sp.name);

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
    const panel = document.getElementById('sim-inspector');
    if (!panel) return;

    if (!this.selectedEntity) {
      panel.innerHTML = '<span style="color:var(--text-dim);font-size:12px;">Clique em um animal ou vegetal na grade para inspecionar parâmetros fisiológicos, patologias e genótipo.</span>';
      return;
    }

    const { type, data } = this.selectedEntity;
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

const engine = new SimulationEngine();

if (typeof window !== 'undefined') {
  window.Vector2D = Vector2D;
  window.Genome = Genome;
  window.GridCell = GridCell;
  window.Entity = Entity;
  window.Carcass = Carcass;
  window.Organism = Organism;
  window.Plant = Plant;
  window.Animal = Animal;
  window.SimulationEngine = SimulationEngine;
  window.engine = engine;
}
if (typeof globalThis !== 'undefined') {
  globalThis.Vector2D = Vector2D;
  globalThis.Genome = Genome;
  globalThis.GridCell = GridCell;
  globalThis.Entity = Entity;
  globalThis.Carcass = Carcass;
  globalThis.Organism = Organism;
  globalThis.Plant = Plant;
  globalThis.Animal = Animal;
  globalThis.SimulationEngine = SimulationEngine;
  globalThis.engine = engine;
}

