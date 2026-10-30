// ====================================================
//  SIMULATION.JS — Motor da Simulação Ecológica 2D
//  Com Regulação Populacional Natural por Capacidade de Suporte (K):
//  - 1. Estresse de Aglomeração Territorial (Cortisol por densidade)
//  - 2. Sobrepastoreio (Overgrazing) e Morte Definitiva da Raiz
//  - 3. Gestação Contínua com Aborto Espontâneo por Inanição
//  - 4. Vulnerabilidade e Mortalidade Juvenil Natural
//  - 5. Epidemias e Parasitismo por Aglomeração
//  - Árvore Filogenética, Especiação e Telemetria Histórica
// ====================================================

const SEASONS = [
  { name: 'Primavera', icon: '🌸', temp: 0.0, rain: 1.5, sunlight: 1.4, thermalCost: 1.0 },
  { name: 'Verão',     icon: '☀️', temp: 0.8, rain: 0.6, sunlight: 1.7, thermalCost: 1.2 },
  { name: 'Outono',    icon: '🍂', temp: -0.2, rain: 1.1, sunlight: 0.9, thermalCost: 1.0 },
  { name: 'Inverno',   icon: '❄️', temp: -0.7, rain: 0.5, sunlight: 0.6, thermalCost: 1.35 }
];

// Trava extrema apenas para segurança da memória do navegador (evita congelamento da aba)
const HARD_CRASH_FAILSAFE = 600;

const SPECIES_PALETTE = [
  '#58a6ff', '#3fb950', '#ffa657', '#d2a8ff', '#f78166',
  '#79c0ff', '#56d364', '#e3b341', '#f0883e', '#db61a2',
  '#2ea043', '#388bfd', '#bc8cff', '#ff7b72', '#238636'
];

function getGeneticDistance(genesA, genesB) {
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

function evaluateSpeciation(childGenes, founderGenes) {
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

  const dist = getGeneticDistance(childGenes, founderGenes);
  if (dist >= 0.28) {
    const desc = (childGenes.diet?.meat || 0) > 0.5 ? 'Predador' : 'Herbívoro';
    return { diverged: true, traitName: 'Genoma Geral', desc: desc };
  }

  return { diverged: false };
}

function mutateAndNormalizeDiet(parentDiet) {
  const newDiet = {
    meat: Math.max(0.01, (parentDiet.meat || 0.33) + (Math.random() * 0.14 - 0.07)),
    plant: Math.max(0.01, (parentDiet.plant || 0.33) + (Math.random() * 0.14 - 0.07)),
    carcass: Math.max(0.01, (parentDiet.carcass || 0.33) + (Math.random() * 0.14 - 0.07))
  };

  const total = newDiet.meat + newDiet.plant + newDiet.carcass;
  return {
    meat: parseFloat((newDiet.meat / total).toFixed(2)),
    plant: parseFloat((newDiet.plant / total).toFixed(2)),
    carcass: parseFloat((newDiet.carcass / total).toFixed(2))
  };
}

class SimulationEngine {
  constructor() {
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
    this.historyInterval = 10;
  }

  init(canvas, worldConfig) {
    this.pause();
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.worldConfig = worldConfig || {};

    const sz = this.worldConfig.gridSize || 45;
    this.gridCols = Math.min(50, Math.max(20, Math.round(sz * 0.75)));
    this.gridRows = Math.min(35, Math.max(15, Math.round(sz * 0.5)));

    this.canvas.width = this.gridCols * this.cellSize;
    this.canvas.height = this.gridRows * this.cellSize;

    this.seasonLength = this.worldConfig.seasonLengthTicks || 120;
    this.seasonIndex = 0;
    this.tickCount = 0;
    this.generation = 1;
    this.selectedEntity = null;
    this.highlightedSpecies = null;

    this.speciesCatalog = [];
    this.speciesRegistry = {};
    this.history = [];

    this.buildGrid(this.worldConfig.biome || 'random');
    this.spawnInitialPlants(this.worldConfig.initialPlantCount || 70);
    this.spawnInitialAnimals(this.worldConfig.initialAnimalCount || 25);

    this.render();
  }

  toggleHighlightSpecies(speciesName) {
    if (this.highlightedSpecies === speciesName) {
      this.highlightedSpecies = null;
      if (typeof toast === 'function') toast('Foco de espécie desativado.');
    } else {
      this.highlightedSpecies = speciesName;
      const count = this.animals.filter(a => (a.speciesName || a.name) === speciesName).length +
                    this.plants.filter(p => p.name === speciesName).length;
      if (typeof toast === 'function') {
        toast(`🔍 Destacando ${count} exemplar(es) de "${speciesName}"!`);
      }
    }
    this.render();
    this.updateCensusUI();
  }

  registerSpecies(name, type, genes, ancestor = null, rootName = null, divergentTrait = null) {
    if (!this.speciesRegistry[name]) {
      this.speciesRegistry[name] = {
        founderGenes: JSON.parse(JSON.stringify(genes)),
        ancestor: ancestor,
        rootName: rootName || name
      };
      const color = SPECIES_PALETTE[this.speciesCatalog.length % SPECIES_PALETTE.length];
      this.speciesCatalog.push({
        id: 'sp_' + this.speciesCatalog.length,
        name: name,
        type: type,
        color: color,
        ancestor: ancestor,
        divergentTrait: divergentTrait,
        founderGenes: JSON.parse(JSON.stringify(genes)),
        generation: this.generation
      });
      return true;
    }
    return false;
  }

  recordHistorySnapshot() {
    const popCounts = {};
    const geneSums = {};
    const geneCounts = {};

    this.animals.forEach(a => {
      const sp = a.speciesName || a.name;
      popCounts[sp] = (popCounts[sp] || 0) + 1;

      if (!geneSums[sp]) {
        geneSums[sp] = { size: 0, speed: 0, dietMeat: 0, thermal: 0 };
        geneCounts[sp] = 0;
      }
      geneSums[sp].size += a.genes.size;
      geneSums[sp].speed += a.genes.speed;
      geneSums[sp].dietMeat += (a.genes.diet?.meat || 0);
      geneSums[sp].thermal += a.genes.thermal;
      geneCounts[sp]++;
    });

    const meanGenes = {};
    Object.keys(geneSums).forEach(sp => {
      const n = geneCounts[sp] || 1;
      meanGenes[sp] = {
        size: geneSums[sp].size / n,
        speed: geneSums[sp].speed / n,
        dietMeat: geneSums[sp].dietMeat / n,
        thermal: geneSums[sp].thermal / n
      };
    });

    this.history.push({
      tick: this.tickCount,
      generation: this.generation,
      populations: popCounts,
      meanGenes: meanGenes
    });

    if (this.history.length > 250) {
      this.history.shift();
    }
  }

  buildGrid(biomeType) {
    this.grid = [];
    const BIOME_WEIGHTS = {
      random:   { water: 0.12, fertile: 0.50, dry: 0.24, rocky: 0.14 },
      islands:  { water: 0.50, fertile: 0.34, dry: 0.10, rocky: 0.06 },
      savanna:  { water: 0.05, fertile: 0.25, dry: 0.60, rocky: 0.10 },
      fertile:  { water: 0.10, fertile: 0.75, dry: 0.08, rocky: 0.07 },
      desert:   { water: 0.03, fertile: 0.08, dry: 0.75, rocky: 0.14 },
      frozen:   { water: 0.22, fertile: 0.08, dry: 0.10, rocky: 0.60 }
    };
    const weights = BIOME_WEIGHTS[biomeType] || BIOME_WEIGHTS.random;

    for (let r = 0; r < this.gridRows; r++) {
      this.grid[r] = [];
      for (let c = 0; c < this.gridCols; c++) {
        const noise = (Math.sin(r * 0.4) + Math.cos(c * 0.4) + Math.sin((r + c) * 0.3) + 3) / 6;
        let biome = 'fertile';
        if (noise < weights.water) biome = 'water';
        else if (noise < weights.water + weights.fertile) biome = 'fertile';
        else if (noise < weights.water + weights.fertile + weights.dry) biome = 'dry';
        else biome = 'rocky';

        let moisture = biome === 'water' ? 1.0 : (biome === 'fertile' ? 0.85 : (biome === 'dry' ? 0.28 : 0.40));
        let maxSoilNitrogen = biome === 'water' ? 0 : (biome === 'fertile' ? 120 : (biome === 'dry' ? 50 : 35));

        this.grid[r][c] = {
          r, c,
          biome,
          moisture,
          soilNitrogen: maxSoilNitrogen * 0.85,
          maxSoilNitrogen: maxSoilNitrogen,
          organicBiomass: 0.0,
          plant: null,
          carcass: null
        };
      }
    }
  }

  spawnInitialPlants(count) {
    this.plants = [];
    const speciesList = this.worldConfig?.speciesCounts?.plants;

    if (speciesList && speciesList.length > 0) {
      speciesList.forEach(sp => {
        const n = Math.max(0, parseInt(sp.count) || 0);
        this.registerSpecies(sp.name, 'plant', sp.genes);
        for (let i = 0; i < n; i++) {
          this.spawnSinglePlant(sp.name, sp.genes, sp.customImages || {});
        }
      });
      return;
    }

    const savedPlants = JSON.parse(localStorage.getItem('evo_plants') || '[]');
    const targetCount = count || 70;
    for (let i = 0; i < targetCount; i++) {
      let sp = savedPlants.length > 0 ? savedPlants[i % savedPlants.length] : null;
      let name = sp ? sp.name : 'Grama Nutritiva';
      let genes = sp ? { ...sp.genes } : {
        height: 0.4,
        rootEfficiency: 0.7,
        growthSpeed: 0.8,
        defense: 0.15,
        fruitAttraction: 0.4,
        parasiteResistance: 0.5,
        thermal: 0.0,
        colorHue: 115
      };
      this.registerSpecies(name, 'plant', genes);
      this.spawnSinglePlant(name, genes, sp?.customImages || {});
    }
  }

  spawnSinglePlant(name, genes, customImages) {
    let attempts = 0;
    while (attempts < 40) {
      attempts++;
      const r = Math.floor(Math.random() * this.gridRows);
      const c = Math.floor(Math.random() * this.gridCols);
      const cell = this.grid[r]?.[c];

      if (cell && cell.biome !== 'water' && !cell.plant) {
        const plant = {
          id: 'plant_' + Math.random().toString(36).substr(2, 9),
          name: name || 'Planta',
          r, c,
          x: (c + 0.5) * this.cellSize,
          y: (r + 0.5) * this.cellSize,
          energy: 40.0,
          growth: 0.35 + Math.random() * 0.4,
          hasFruit: false,
          fruitCount: 0,
          age: Math.floor(Math.random() * 40),
          genes: { ...genes },
          customImages: { ...(customImages || {}) }
        };
        cell.plant = plant;
        this.plants.push(plant);
        return plant;
      }
    }
    return null;
  }

  spawnInitialAnimals(count) {
    this.animals = [];
    const speciesList = this.worldConfig?.speciesCounts?.animals;

    if (speciesList && speciesList.length > 0) {
      speciesList.forEach(sp => {
        const n = Math.max(0, parseInt(sp.count) || 0);
        this.registerSpecies(sp.name, 'animal', sp.genes);
        for (let i = 0; i < n; i++) {
          this.spawnSingleAnimal(sp.name, sp.genes, sp.customImages || {});
        }
      });
      return;
    }

    const savedAnimals = JSON.parse(localStorage.getItem('evo_animals') || '[]');
    const targetCount = count || 25;

    for (let i = 0; i < targetCount; i++) {
      if (savedAnimals.length > 0) {
        const sp = savedAnimals[i % savedAnimals.length];
        this.registerSpecies(sp.name, 'animal', sp.genes);
        this.spawnSingleAnimal(sp.name, sp.genes, sp.customImages || {});
      } else {
        const isPred = (i % 4 === 0);
        const name = isPred ? 'Predador Alfa' : 'Herbívoro Campestre';
        const genes = {
          size: isPred ? 0.65 : 0.35,
          diet: isPred ? { meat: 0.85, plant: 0.05, carcass: 0.10 } : { meat: 0.0, plant: 0.90, carcass: 0.10 },
          speed: isPred ? 0.70 : 0.60,
          perception: isPred ? 0.80 : 0.65,
          gestation: isPred ? 0.50 : 0.30,
          offspringCount: isPred ? 0.35 : 0.70,
          aggression: isPred ? 0.75 : 0.10,
          health: 0.60,
          thermal: 0.0,
          colorHue: isPred ? 15 : 125
        };
        this.registerSpecies(name, 'animal', genes);
        this.spawnSingleAnimal(name, genes, {});
      }
    }
  }

  spawnSingleAnimal(name, genes, customImages) {
    let rx = Math.random() * (this.gridCols * this.cellSize);
    let ry = Math.random() * (this.gridRows * this.cellSize);
    let r = Math.floor(ry / this.cellSize);
    let c = Math.floor(rx / this.cellSize);
    if (this.grid[r]?.[c]?.biome === 'water') {
      rx = ((c + 2) % this.gridCols) * this.cellSize;
    }

    if (!genes.diet) {
      genes.diet = { meat: 0.05, plant: 0.85, carcass: 0.10 };
    }

    this.registerSpecies(name, 'animal', genes);

    const animal = {
      id: 'anim_' + Math.random().toString(36).substr(2, 9),
      name: name || 'Criatura',
      speciesName: name || 'Criatura',
      x: rx,
      y: ry,
      vx: (Math.random() - 0.5) * 1.5,
      vy: (Math.random() - 0.5) * 1.5,
      energy: 90.0 + Math.random() * 10,
      maxEnergy: 100.0,
      age: Math.floor(Math.random() * 40),
      genes: { ...genes },
      customImages: { ...(customImages || {}) },
      state: 'wandering',
      stateLabel: 'Forrageando',
      mateCooldown: 30,
      attackCooldown: 0,
      isDiseased: false,
      diseaseTimer: 0,
      isPregnant: false,
      gestationTicks: 0,
      pregnantGenes: null,
      pregnantSpeciesName: null,
      pregnantClutchSize: 1
    };
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

  setSpeed(val) {
    this.speed = val;
  }

  loop() {
    if (!this.isRunning) return;
    for (let s = 0; s < this.speed; s++) {
      this.updateTick();
    }
    this.render();
    this.updateStatsUI();
    if (this.isRunning) {
      this.animFrameId = requestAnimationFrame(() => this.loop());
    }
  }

  fastForward(ticks = 50) {
    const wasRunning = this.isRunning;
    this.pause();
    for (let t = 0; t < ticks; t++) {
      this.updateTick();
    }
    this.render();
    this.updateStatsUI();
    if (wasRunning) this.start();
  }

  updateTick() {
    this.tickCount++;

    if (this.tickCount % this.seasonLength === 0) {
      this.seasonIndex = (this.seasonIndex + 1) % SEASONS.length;
      if (this.seasonIndex === 0) {
        this.generation++;
      }
    }
    const curSeason = SEASONS[this.seasonIndex];

    if (this.tickCount % this.historyInterval === 0) {
      this.recordHistorySnapshot();
    }

    // 1. DINÂMICA DO SOLO & NUTRIENTES
    for (let r = 0; r < this.gridRows; r++) {
      for (let c = 0; c < this.gridCols; c++) {
        const cell = this.grid[r][c];
        if (cell.biome !== 'water') {
          cell.moisture = Math.min(1.0, Math.max(0.12, cell.moisture + 0.02 * curSeason.rain - 0.005));

          if (cell.organicBiomass > 0.05) {
            const minRate = cell.organicBiomass * 0.04 * cell.moisture;
            cell.organicBiomass -= minRate;
            cell.soilNitrogen = Math.min(cell.maxSoilNitrogen, cell.soilNitrogen + minRate * 0.9);
          } else if (cell.soilNitrogen < cell.maxSoilNitrogen) {
            cell.soilNitrogen = Math.min(cell.maxSoilNitrogen, cell.soilNitrogen + 0.12 * curSeason.rain);
          }
        }
      }
    }

    // 2. CARCAÇAS
    for (let idx = this.carcasses.length - 1; idx >= 0; idx--) {
      const carcass = this.carcasses[idx];
      if (!carcass) { this.carcasses.splice(idx, 1); continue; }

      carcass.decayTimer++;
      const cell = this.grid[carcass.r]?.[carcass.c];
      const decayLoss = 0.20;
      carcass.remainingEnergy -= decayLoss;

      if (cell) {
        cell.organicBiomass = Math.min(80.0, cell.organicBiomass + decayLoss * 0.85);
      }

      if (carcass.remainingEnergy <= 0 || carcass.decayTimer > 250) {
        if (cell && cell.carcass === carcass) cell.carcass = null;
        this.carcasses.splice(idx, 1);
      }
    }

    // 3. VEGETAIS (Lei de Liebig)
    for (let idx = this.plants.length - 1; idx >= 0; idx--) {
      const plant = this.plants[idx];
      plant.age++;
      const cell = this.grid[plant.r][plant.c];
      const g = plant.genes;

      const maintenanceCost = 0.02 + (g.height * 0.02) + (g.defense * 0.015);

      const lightFactor = (curSeason.sunlight * 1.0) / (0.4 + curSeason.sunlight);
      const nitrogenFactor = cell.soilNitrogen / (10.0 + cell.soilNitrogen);
      const waterFactor = Math.min(1.0, cell.moisture * (0.7 + g.rootEfficiency * 0.6));
      const liebig = Math.min(lightFactor, nitrogenFactor, waterFactor);

      if (cell.soilNitrogen >= maintenanceCost) {
        cell.soilNitrogen -= maintenanceCost;
        const leafAreaFactor = Math.max(0.20, plant.growth);
        const growthDelta = 0.016 * leafAreaFactor * (0.5 + g.growthSpeed * 0.8) * liebig;
        plant.growth = Math.min(1.0, plant.growth + growthDelta);

        if (plant.growth >= 0.70) {
          plant.hasFruit = true;
          plant.fruitCount = Math.round(1 + g.fruitAttraction * 4);
        }
      } else {
        plant.energy -= 0.2;
        if (plant.energy <= 0 || plant.age > 500) {
          cell.organicBiomass += plant.growth * 10.0;
          cell.plant = null;
          this.plants.splice(idx, 1);
          continue;
        }
      }

      if (plant.hasFruit && Math.random() < 0.008 * g.growthSpeed && this.plants.length < this.gridCols * this.gridRows * 0.55) {
        const dr = Math.floor(Math.random() * 3) - 1;
        const dc = Math.floor(Math.random() * 3) - 1;
        const nr = plant.r + dr, nc = plant.c + dc;

        if (this.grid[nr]?.[nc] && this.grid[nr][nc].biome !== 'water' && !this.grid[nr][nc].plant) {
          const childGenes = { ...plant.genes };
          Object.keys(childGenes).forEach(k => {
            if (k !== 'colorHue' && k !== 'thermal') {
              childGenes[k] = Math.max(0.05, Math.min(1.0, childGenes[k] + (Math.random() * 0.1 - 0.05)));
            }
          });

          const childPlant = {
            id: 'plant_' + Math.random().toString(36).substr(2, 9),
            name: plant.name,
            r: nr, c: nc,
            x: (nc + 0.5) * this.cellSize,
            y: (nr + 0.5) * this.cellSize,
            energy: 35.0,
            growth: 0.2,
            hasFruit: false,
            fruitCount: 0,
            age: 0,
            genes: childGenes,
            customImages: plant.customImages
          };
          this.grid[nr][nc].plant = childPlant;
          this.plants.push(childPlant);
        }
      }
    }

    // 4. FISIOLOGIA ANIMAL & REGULAÇÃO DEPENDENTE DE DENSIDADE
    const deadAnimals = [];
    const newOffspring = [];

    this.animals.forEach(anim => {
      anim.age++;
      if (anim.mateCooldown > 0) anim.mateCooldown--;
      if (anim.attackCooldown > 0) anim.attackCooldown--;

      const g = anim.genes;
      const curSpeed = Math.hypot(anim.vx, anim.vy);

      const massKg = 5.0 + g.size * 70.0;
      const basalMetabolism = 0.06 * Math.pow(massKg / 40.0, 0.75);
      const locomotionCost = 0.04 * Math.pow(curSpeed / 2.0, 1.5);

      const tempDiff = Math.abs(g.thermal - curSeason.temp);
      const thermalFactor = 1.0 + (tempDiff > 0.4 ? 0.3 : 0.0) * curSeason.thermalCost;

      let totalCost = (basalMetabolism + locomotionCost) * thermalFactor;

      // ── MECANISMO 1: ESTRESSE DE AGLOMERAÇÃO TERRITORIAL (CORTISOL) ──
      let nearbyNeighbors = 0;
      for (let oIdx = 0; oIdx < this.animals.length; oIdx++) {
        const other = this.animals[oIdx];
        if (other !== anim && Math.hypot(other.x - anim.x, other.y - anim.y) < 48) {
          nearbyNeighbors++;
        }
      }

      if (nearbyNeighbors > 2) {
        const crowdStressFactor = 1.0 + (nearbyNeighbors - 2) * 0.14;
        totalCost *= crowdStressFactor;
      }

      // ── MECANISMO 4: EPIDEMIAS DEPENDENTES DE DENSIDADE ──
      if (!anim.isDiseased && nearbyNeighbors > 4 && Math.random() < 0.004 * nearbyNeighbors) {
        anim.isDiseased = true;
        anim.diseaseTimer = 190;
        anim.stateLabel = '☣️ Epidemia por Superlotação!';
      }

      if (anim.isDiseased) {
        anim.diseaseTimer--;
        totalCost += 0.12;
        if (anim.diseaseTimer <= 0) {
          anim.isDiseased = false;
        }
      }

      // ── MECANISMO 5: CUSTO GESTACIONAL CONTÍNUO E ABORTO POR FOME ──
      if (anim.isPregnant) {
        anim.gestationTicks--;
        totalCost += 0.08; // Custo energético para sustentar embriões

        // Se a mãe passar fome crítica durante a gravidez, aborta a ninhada!
        if (anim.energy < 22.0) {
          anim.isPregnant = false;
          anim.pregnantGenes = null;
          anim.stateLabel = '⚠️ Aborto por Inanição';
          if (typeof toast === 'function' && Math.random() < 0.18) {
            toast(`⚠️ ${anim.name} sofreu aborto espontâneo por falta de comida!`);
          }
        } else if (anim.gestationTicks <= 0) {
          // Parto bem-sucedido!
          anim.isPregnant = false;
          const clutch = anim.pregnantClutchSize || 1;

          for (let b = 0; b < clutch; b++) {
            const babyGenes = anim.pregnantGenes || g;
            const babySpeed = (0.5 + babyGenes.speed * 1.5);
            newOffspring.push({
              id: 'anim_' + Math.random().toString(36).substr(2, 9),
              name: anim.pregnantSpeciesName || anim.speciesName,
              speciesName: anim.pregnantSpeciesName || anim.speciesName,
              x: Math.max(10, Math.min((this.gridCols * this.cellSize) - 10, anim.x + (Math.random() * 14 - 7))),
              y: Math.max(10, Math.min((this.gridRows * this.cellSize) - 10, anim.y + (Math.random() * 14 - 7))),
              vx: (Math.random() - 0.5) * babySpeed,
              vy: (Math.random() - 0.5) * babySpeed,
              // MECANISMO 2: FILHOTES FRÁGEIS (precisam se alimentar rápido ou morrem de fome)
              energy: 14.0,
              maxEnergy: 100.0,
              age: 0,
              genes: babyGenes,
              customImages: anim.customImages,
              state: 'wandering',
              stateLabel: 'Recém-nascido (Frágil)',
              mateCooldown: 60,
              attackCooldown: 0,
              isDiseased: false,
              diseaseTimer: 0,
              isPregnant: false,
              gestationTicks: 0,
              pregnantGenes: null,
              pregnantSpeciesName: null,
              pregnantClutchSize: 1
            });
          }
          anim.pregnantGenes = null;
          anim.stateLabel = 'Deu à luz!';
        }
      }

      anim.energy -= totalCost;

      if (anim.energy <= 0 || anim.age > 750) {
        deadAnimals.push(anim);
        return;
      }

      this.updateAnimalAI(anim, newOffspring);

      anim.x += anim.vx;
      anim.y += anim.vy;

      const margin = 12;
      const maxX = this.gridCols * this.cellSize - margin;
      const maxY = this.gridRows * this.cellSize - margin;
      if (anim.x < margin) { anim.x = margin; anim.vx *= -1; }
      if (anim.x > maxX)   { anim.x = maxX; anim.vx *= -1; }
      if (anim.y < margin) { anim.y = margin; anim.vy *= -1; }
      if (anim.y > maxY)   { anim.y = maxY; anim.vy *= -1; }
    });

    deadAnimals.forEach(dead => {
      const idx = this.animals.indexOf(dead);
      if (idx !== -1) {
        this.animals.splice(idx, 1);
        const cr = Math.max(0, Math.min(this.gridRows - 1, Math.floor(dead.y / this.cellSize)));
        const cc = Math.max(0, Math.min(this.gridCols - 1, Math.floor(dead.x / this.cellSize)));

        if (this.grid[cr]?.[cc]) {
          const carcassEnergy = 25.0 + (dead.genes.size || 0.5) * 50.0;
          const carcass = {
            id: 'carcass_' + Math.random().toString(36).substr(2, 9),
            speciesName: dead.speciesName || dead.name,
            x: Math.max(10, Math.min((this.gridCols * this.cellSize) - 10, dead.x)),
            y: Math.max(10, Math.min((this.gridRows * this.cellSize) - 10, dead.y)),
            r: cr, c: cc,
            remainingEnergy: carcassEnergy,
            decayTimer: 0
          };
          this.grid[cr][cc].carcass = carcass;
          this.carcasses.push(carcass);
        }
      }
    });

    newOffspring.forEach(baby => {
      if (this.animals.length < HARD_CRASH_FAILSAFE) {
        this.animals.push(baby);
      }
    });

    if (this.animals.length === 0 && this.tickCount > 10) {
      this.handleExtinction();
    }
  }

  updateAnimalAI(anim, newOffspring) {
    const g = anim.genes;
    const isCarnivore = (g.diet?.meat || 0) > 0.45;
    const viewDist = (45 + g.perception * 130) * (isCarnivore ? 1.4 : 1.0);
    const speedPenalty = anim.isDiseased ? 0.65 : (anim.isPregnant ? 0.82 : 1.0);
    const maxSpeed = (0.7 + g.speed * 2.2) * speedPenalty;

    let targetX = null, targetY = null;
    let desiredSpeed = maxSpeed * 0.45;
    anim.stateLabel = anim.isDiseased
      ? `☣️ Infectado (${anim.diseaseTimer}t)`
      : (anim.isPregnant ? `🤰 Gestante (${anim.gestationTicks}t)` : 'Forrageando');

    // 1. Fuga de Predadores
    if (!isCarnivore) {
      let threat = null, minTDist = viewDist * 0.8;
      this.animals.forEach(other => {
        if (other !== anim && (other.genes.diet?.meat || 0) > 0.45 && other.genes.size > g.size * 1.1) {
          const d = Math.hypot(other.x - anim.x, other.y - anim.y);
          if (d < minTDist) { minTDist = d; threat = other; }
        }
      });

      if (threat) {
        anim.state = 'fleeing';
        anim.stateLabel = 'Fugindo de Predador!';
        desiredSpeed = maxSpeed;
        const angle = Math.atan2(anim.y - threat.y, anim.x - threat.x);
        anim.vx = Math.cos(angle) * desiredSpeed;
        anim.vy = Math.sin(angle) * desiredSpeed;
        return;
      }
    }

    // 2. Busca por Alimento
    if (anim.energy < 85.0) {
      // A. Necrofagia
      if ((g.diet?.carcass || 0) > 0.08) {
        let bestCarcass = null, minCDist = viewDist;
        this.carcasses.forEach(c => {
          if (!c || c.remainingEnergy <= 0) return;

          const isConspecificCarcass = (c.speciesName === anim.speciesName);
          if (isConspecificCarcass && anim.energy >= 25.0) return;

          const d = Math.hypot(c.x - anim.x, c.y - anim.y);
          if (d < minCDist) { minCDist = d; bestCarcass = c; }
        });

        if (bestCarcass) {
          targetX = bestCarcass.x;
          targetY = bestCarcass.y;
          desiredSpeed = maxSpeed * 0.7;
          anim.stateLabel = 'Comendo Carcaça';

          if (minCDist < 18) {
            anim.vx *= 0.1; anim.vy *= 0.1;
            const bite = Math.min(bestCarcass.remainingEnergy, 4.0);
            bestCarcass.remainingEnergy -= bite;

            if (bestCarcass.speciesName === anim.speciesName) {
              anim.isDiseased = true;
              anim.diseaseTimer = Math.min(320, (anim.diseaseTimer || 0) + 180);
              anim.stateLabel = '☣️ Canibalismo (Infectado por Príon!)';
              if (typeof toast === 'function' && Math.random() < 0.25) {
                toast(`☣️ ${anim.name} contraiu Príon por necro-canibalismo!`);
              }
            }

            anim.energy = Math.min(anim.maxEnergy, anim.energy + bite * 4.5 * (0.5 + g.diet.carcass));
            return;
          }
        }
      }

      // B. Predação
      if ((g.diet?.meat || 0) > 0.25 && !targetX) {
        let bestPrey = null, minPDist = viewDist;
        this.animals.forEach(other => {
          if (other !== anim && other.genes.size < g.size * 0.95 && other.energy > 0) {
            const isSameSpecies = (other.speciesName === anim.speciesName);
            if (isSameSpecies && anim.energy >= 25.0) return;

            const d = Math.hypot(other.x - anim.x, other.y - anim.y);
            if (d < minPDist) { minPDist = d; bestPrey = other; }
          }
        });

        if (bestPrey) {
          targetX = bestPrey.x;
          targetY = bestPrey.y;
          desiredSpeed = maxSpeed;
          anim.stateLabel = (bestPrey.speciesName === anim.speciesName)
            ? `⚠️ Canibalizando ${bestPrey.name}`
            : `Caçando ${bestPrey.name}`;

          if (minPDist < 22 && anim.attackCooldown === 0) {
            anim.vx *= 0.1; anim.vy *= 0.1;
            bestPrey.energy = 0;

            if (bestPrey.speciesName === anim.speciesName) {
              anim.isDiseased = true;
              anim.diseaseTimer = Math.min(350, (anim.diseaseTimer || 0) + 240);
              anim.stateLabel = '☣️ Canibalismo (Infectado por Príon!)';
              if (typeof toast === 'function') {
                toast(`☣️ Alerta: ${anim.name} cometeu canibalismo e contraiu Príon letal!`);
              }
            }

            anim.energy = Math.min(anim.maxEnergy, anim.energy + 40.0 * (0.6 + g.diet.meat * 0.4));
            anim.attackCooldown = 25;
            return;
          }
        }
      }

      // C. Herbivoria & MECANISMO 3: SOBREPASTOREIO (OVERGRAZING)
      if ((g.diet?.plant || 0) > 0.20 && !targetX) {
        let bestPlant = null, minPlDist = viewDist;
        this.plants.forEach(pl => {
          if (pl.growth > 0.10) {
            const d = Math.hypot(pl.x - anim.x, pl.y - anim.y);
            if (d < minPlDist) { minPlDist = d; bestPlant = pl; }
          }
        });

        if (bestPlant) {
          targetX = bestPlant.x;
          targetY = bestPlant.y;
          desiredSpeed = maxSpeed * 0.65;
          anim.stateLabel = 'Pastando';

          if (minPlDist < 16) {
            anim.vx *= 0.1; anim.vy *= 0.1;
            const availableBiomass = bestPlant.growth;
            const biteAmount = Math.min(availableBiomass * 0.6, 0.28);
            const calories = (biteAmount / 0.25) * (bestPlant.hasFruit ? 24.0 : 15.0);
            anim.energy = Math.min(anim.maxEnergy, anim.energy + calories * (0.6 + g.diet.plant * 0.5));

            // OVERGRAZING: Se for pastada abaixo de 0.09, o animal arranca a raiz e a planta morre definitivamente!
            if (bestPlant.growth - biteAmount < 0.09) {
              const cell = this.grid[bestPlant.r]?.[bestPlant.c];
              if (cell && cell.plant === bestPlant) cell.plant = null;
              if (cell) cell.organicBiomass = Math.min(80.0, cell.organicBiomass + 6.0);

              const pIdx = this.plants.indexOf(bestPlant);
              if (pIdx !== -1) this.plants.splice(pIdx, 1);

              anim.stateLabel = 'Arrancou raiz (Overgrazing)!';
            } else {
              bestPlant.growth = Math.max(0.08, bestPlant.growth - biteAmount);
              bestPlant.hasFruit = false;
            }
            return;
          }
        }
      }
    }

    // 3. REPRODUÇÃO SEXUADA COM INÍCIO DE GESTAÇÃO
    if (
      anim.energy > 84.0 &&
      anim.age > 50 &&
      anim.mateCooldown === 0 &&
      !anim.isDiseased &&
      !anim.isPregnant &&
      !targetX
    ) {
      let bestMate = null, minMDist = viewDist * 1.2;

      this.animals.forEach(other => {
        if (other === anim || other.energy <= 78.0 || other.mateCooldown > 0 || other.isDiseased || other.isPregnant) return;

        const genDist = getGeneticDistance(anim.genes, other.genes);
        let isCompatible = false;

        if (other.speciesName === anim.speciesName) {
          isCompatible = true;
        } else if (genDist < 0.14) {
          isCompatible = true;
        }

        if (genDist >= 0.28) {
          isCompatible = false;
        }

        if (isCompatible) {
          const d = Math.hypot(other.x - anim.x, other.y - anim.y);
          if (d < minMDist) { minMDist = d; bestMate = other; }
        }
      });

      if (bestMate) {
        targetX = bestMate.x;
        targetY = bestMate.y;
        desiredSpeed = maxSpeed * 0.6;
        anim.stateLabel = 'Buscando Parceiro';

        if (minMDist < 16) {
          anim.vx *= 0.1; anim.vy *= 0.1;
          anim.energy -= 28.0;
          bestMate.energy -= 28.0;

          anim.mateCooldown = 110;
          bestMate.mateCooldown = 110;

          const baseSpecies = anim.speciesName;
          const speciesData = this.speciesRegistry[baseSpecies] || {};
          const founderGenes = speciesData.founderGenes || g;
          const rootName = speciesData.rootName || baseSpecies.replace(/\s*(Gigante|Pigmeu|Tropical|Polar|Veloz|Robusto|Predador|Herbívoro)/g, '').trim();

          const childGenes = {};
          Object.keys(g).forEach(k => {
            if (k === 'diet') {
              const avgDiet = {
                meat: ((g.diet.meat || 0) + (bestMate.genes.diet.meat || 0)) / 2,
                plant: ((g.diet.plant || 0) + (bestMate.genes.diet.plant || 0)) / 2,
                carcass: ((g.diet.carcass || 0) + (bestMate.genes.diet.carcass || 0)) / 2,
              };
              childGenes.diet = mutateAndNormalizeDiet(avgDiet);
            } else {
              const avg = (g[k] + bestMate.genes[k]) / 2;
              if (k === 'colorHue') {
                childGenes[k] = Math.round((avg + (Math.random() * 20 - 10) + 360) % 360);
              } else if (k === 'thermal') {
                childGenes[k] = parseFloat(Math.max(-1.0, Math.min(1.0, avg + (Math.random() * 0.1 - 0.05))).toFixed(2));
              } else {
                childGenes[k] = parseFloat(Math.max(0.05, Math.min(1.0, avg + (Math.random() * 0.12 - 0.06))).toFixed(2));
              }
            }
          });

          const speciationCheck = evaluateSpeciation(childGenes, founderGenes);
          let finalSpeciesName = baseSpecies;

          if (speciationCheck.diverged) {
            finalSpeciesName = `${rootName} ${speciationCheck.desc}`;
            const isNew = this.registerSpecies(
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

          let clutchSize = Math.random() < ((g.offspringCount + bestMate.genes.offspringCount) / 2) ? 2 : 1;
          if (speciationCheck.diverged && clutchSize < 2) clutchSize = 2;

          // Inicia a gestação na mãe em vez de parir instantaneamente
          anim.isPregnant = true;
          anim.gestationTicks = Math.round(35 + ((g.gestation + bestMate.genes.gestation) / 2) * 45);
          anim.pregnantGenes = childGenes;
          anim.pregnantSpeciesName = finalSpeciesName;
          anim.pregnantClutchSize = clutchSize;
          anim.stateLabel = 'Iniciou Gestação';
          return;
        }
      }
    }

    if (targetX !== null && targetY !== null) {
      const angle = Math.atan2(targetY - anim.y, targetX - anim.x);
      anim.vx = anim.vx * 0.82 + Math.cos(angle) * desiredSpeed * 0.18;
      anim.vy = anim.vy * 0.82 + Math.sin(angle) * desiredSpeed * 0.18;
    } else {
      if (Math.random() < 0.07) {
        const randAngle = Math.random() * Math.PI * 2;
        anim.vx = Math.cos(randAngle) * desiredSpeed;
        anim.vy = Math.sin(randAngle) * desiredSpeed;
      }
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
    this.spawnInitialAnimals(count);
    const modal = document.getElementById('extinction-modal');
    if (modal) modal.style.display = 'none';
    this.start();
    if (typeof toast === 'function') toast(`🌱 ${count} animais pioneiros reintroduzidos!`);
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

    const BIOME_TILES = {
      water:   '#183a66',
      fertile: '#1a4e1d',
      dry:     '#5e5025',
      rocky:   '#3c4146'
    };

    for (let r = 0; r < this.gridRows; r++) {
      for (let c = 0; c < this.gridCols; c++) {
        const cell = this.grid[r][c];
        const x = c * this.cellSize, y = r * this.cellSize;

        ctx.fillStyle = BIOME_TILES[cell.biome] || '#1a4e1d';
        ctx.fillRect(x, y, this.cellSize, this.cellSize);

        if (cell.organicBiomass > 2.0) {
          ctx.fillStyle = `rgba(160, 95, 25, ${Math.min(0.35, cell.organicBiomass / 80)})`;
          ctx.fillRect(x, y, this.cellSize, this.cellSize);
        }

        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, this.cellSize, this.cellSize);
      }
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
      ctx.ellipse(0, 0, 7, 5, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e6edf3';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-4, 0); ctx.lineTo(4, 0);
      ctx.stroke();
      ctx.restore();
    });

    // Vegetais
    this.plants.forEach(plant => {
      const isTargetSpecies = !this.highlightedSpecies || (plant.name === this.highlightedSpecies);
      ctx.save();
      if (this.highlightedSpecies && !isTargetSpecies) {
        ctx.globalAlpha = 0.20;
      }
      const pScale = 0.35 + plant.growth * 0.35;
      drawPlant(ctx, plant.genes, plant.x, plant.y + 4, pScale, plant.customImages);
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
    });

    // Animais
    this.animals.forEach(anim => {
      const animSpecies = anim.speciesName || anim.name;
      const isTargetSpecies = !this.highlightedSpecies || (animSpecies === this.highlightedSpecies);

      ctx.save();
      if (this.highlightedSpecies && !isTargetSpecies) {
        ctx.globalAlpha = 0.20;
      }

      const aScale = 0.35 + anim.genes.size * 0.35;
      drawCreature(ctx, anim.genes, anim.x, anim.y, aScale, anim.customImages);

      // Indicador de Doença / Príon
      if (anim.isDiseased) {
        ctx.strokeStyle = '#d2a8ff';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(anim.x, anim.y, 14 + anim.genes.size * 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Indicador Visual de Gestação
      if (anim.isPregnant) {
        ctx.strokeStyle = '#ffa657';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(anim.x, anim.y, 12 + anim.genes.size * 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      const barW = 18, barH = 3;
      const energyPct = Math.max(0, anim.energy / anim.maxEnergy);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(anim.x - barW/2, anim.y - 18, barW, barH);
      ctx.fillStyle = anim.isDiseased
        ? '#d2a8ff'
        : (anim.isPregnant ? '#ffa657' : (energyPct > 0.5 ? '#3fb950' : (energyPct > 0.25 ? '#e3b341' : '#f78166')));
      ctx.fillRect(anim.x - barW/2, anim.y - 18, barW * energyPct, barH);
      ctx.restore();

      if (this.highlightedSpecies && isTargetSpecies) {
        ctx.save();
        const pulse = (Math.sin(Date.now() * 0.007) + 1) * 0.5;
        const spData = this.speciesCatalog.find(s => s.name === animSpecies);
        const glowColor = spData ? spData.color : '#58a6ff';
        const ringRadius = 18 + anim.genes.size * 12 + pulse * 5;

        ctx.strokeStyle = glowColor;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(anim.x, anim.y, ringRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = glowColor;
        const topY = anim.y - ringRadius - 6;
        ctx.beginPath();
        ctx.moveTo(anim.x, topY);
        ctx.lineTo(anim.x - 5, topY - 8);
        ctx.lineTo(anim.x + 5, topY - 8);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    });

    if (this.selectedEntity) {
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

  updateStatsUI() {
    const elSeason = document.getElementById('sim-season-badge');
    const elGen = document.getElementById('sim-gen-badge');
    const elAnimals = document.getElementById('stat-animals-count');
    const elPlants = document.getElementById('stat-plants-count');
    const elCarcasses = document.getElementById('stat-carcasses-count');

    const curSeason = SEASONS[this.seasonIndex];
    if (elSeason) elSeason.innerHTML = `${curSeason.icon} ${curSeason.name}`;
    if (elGen) elGen.textContent = `Geração ${this.generation}`;
    if (elAnimals) elAnimals.textContent = this.animals.length;
    if (elPlants) elPlants.textContent = this.plants.length;
    if (elCarcasses) elCarcasses.textContent = this.carcasses.length;

    this.updateCensusUI();

    if (this.selectedEntity) {
      this.updateInspectorUI();
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