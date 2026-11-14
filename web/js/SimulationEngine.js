// ====================================================
//  SIMULATIONENGINE.JS — Motor principal da simulação ecológica
//  Motor enxuto: apenas loop/tick/estado/coordenação
// ====================================================

import { SEASONS, HARD_CRASH_FAILSAFE, SPECIES_PALETTE } from './core/constants.js';
import { Genome } from './core/Genome.js';
import { WorldGenerator } from './world/WorldGenerator.js';
import { Renderer } from './systems/Renderer.js';
import { MeteorSystem } from './systems/MeteorSystem.js';
import { ClimateSystem } from './systems/ClimateSystem.js';
import { EcologyManager } from './systems/EcologyManager.js';
import { Plant } from './entities/Plant.js';
import { Animal } from './entities/Animal.js';
import { Carcass } from './entities/Carcass.js';

export class SimulationEngine {
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

  registerSpecies(name, type, genes, ancestor = null, rootName = null, divergentTrait = null, metadata = {}) {
    if (!this.speciesRegistry[name]) {
      const color = SPECIES_PALETTE[this.speciesCatalog.length % SPECIES_PALETTE.length];
      const slug = String(name || 'species').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'sp';
      const speciesId = metadata.id || `sp_${this.speciesCatalog.length + 1}_${slug}`;
      const parentEntry = ancestor ? this.speciesRegistry[ancestor] : null;
      const parentSpeciesId = metadata.parentSpeciesId !== undefined
        ? metadata.parentSpeciesId
        : (parentEntry ? parentEntry.id : (ancestor || null));
      const originTick = metadata.originTick !== undefined ? metadata.originTick : this.tickCount;
      const originBiome = metadata.originBiome !== undefined
        ? metadata.originBiome
        : (this.worldConfig?.biome || null);

      const entry = {
        id: speciesId,
        name: name,
        type: type,
        color: color,
        originGeneration: this.generation,
        originTick: originTick,
        originBiome: originBiome,
        ancestor: ancestor,
        parentSpeciesId: parentSpeciesId,
        rootName: rootName || name,
        divergentTrait: divergentTrait,
        geneticDistance: metadata.geneticDistance ?? 0,
        speciationThreshold: metadata.speciationThreshold ?? Genome.SPECIATION_DISTANCE_THRESHOLD,
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

    // 3. VEGETAIS (POO) — já envia a GridCell atual para cálculo de Liebig
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

    // 4. FISIOLOGIA ANIMAL (POO) — passa a GridCell atual para camuflagem e bioma de origem
    const deadAnimals = [];
    const newOffspring = [];

    this.animals.forEach(anim => {
      const cr = Math.max(0, Math.min(this.gridRows - 1, Math.floor(anim.y / this.cellSize)));
      const cc = Math.max(0, Math.min(this.gridCols - 1, Math.floor(anim.x / this.cellSize)));
      const currentCell = this.grid[cr]?.[cc] || null;
      anim.tick(curSeason, this, newOffspring, deadAnimals, currentCell);
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
