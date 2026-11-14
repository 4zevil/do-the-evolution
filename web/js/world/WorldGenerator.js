// ====================================================
//  WORLDGENERATOR.JS — Geração planetária híbrida (gradiente + ruído 2D) e população
// ====================================================

import { GridCell, BIOME_PROFILES } from './GridCell.js';
import { Plant } from '../entities/Plant.js';
import { Animal } from '../entities/Animal.js';

export const WORLD_GENERATION_PRESETS = {
  random: {
    latStrength: 1.0,
    heatBias: 0.0,
    moistBias: 0.0,
    waterThreshold: -0.43,
    rockyThreshold: 0.62
  },
  islands: {
    latStrength: 0.85,
    heatBias: 0.05,
    moistBias: 0.22,
    waterThreshold: 0.04,
    rockyThreshold: 0.68
  },
  savanna: {
    latStrength: 0.55,
    heatBias: 0.38,
    moistBias: -0.10,
    waterThreshold: -0.52,
    rockyThreshold: 0.62
  },
  fertile: {
    latStrength: 0.50,
    heatBias: 0.0,
    moistBias: 0.28,
    waterThreshold: -0.40,
    rockyThreshold: 0.68
  },
  desert: {
    latStrength: 0.45,
    heatBias: 0.68,
    moistBias: -0.35,
    waterThreshold: -0.66,
    rockyThreshold: 0.52
  },
  frozen: {
    latStrength: 0.55,
    heatBias: -0.68,
    moistBias: 0.05,
    waterThreshold: -0.46,
    rockyThreshold: 0.54
  }
};

export class WorldGenerator {
  constructor(engine) {
    this.engine = engine; // referência ao SimulationEngine para grid/animals/plants arrays
  }

  _getWorldPreset(biomeType) {
    if (WORLD_GENERATION_PRESETS[biomeType]) {
      return WORLD_GENERATION_PRESETS[biomeType];
    }
    if (biomeType === 'tundra') return WORLD_GENERATION_PRESETS.frozen;
    if (biomeType === 'arid' || biomeType === 'dry') return WORLD_GENERATION_PRESETS.desert;
    if (biomeType === 'wetland') {
      return {
        latStrength: 0.40,
        heatBias: 0.05,
        moistBias: 0.45,
        waterThreshold: -0.34,
        rockyThreshold: 0.72
      };
    }
    return WORLD_GENERATION_PRESETS.random;
  }

  _createNoiseSeeds() {
    const randSeed = () => Math.floor(Math.random() * 1000000) + 1;
    return {
      temp: randSeed(),
      moist: randSeed(),
      water: randSeed(),
      elev: randSeed(),
      pocket: randSeed(),
      phaseA: Math.random() * Math.PI * 2,
      phaseB: Math.random() * Math.PI * 2,
      phaseC: Math.random() * Math.PI * 2
    };
  }

  _hash2D(ix, iy, seed) {
    let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041);
    n = (n ^ (n >>> 13)) | 0;
    n = Math.imul(n, 1274126177);
    n = n ^ (n >>> 16);
    return ((n >>> 0) / 2147483647.5) - 1.0;
  }

  _fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  _lerp(a, b, t) {
    return a + (b - a) * t;
  }

  _valueNoise2D(x, y, seed) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;

    const u = this._fade(fx);
    const v = this._fade(fy);

    const n00 = this._hash2D(ix, iy, seed);
    const n10 = this._hash2D(ix + 1, iy, seed);
    const n01 = this._hash2D(ix, iy + 1, seed);
    const n11 = this._hash2D(ix + 1, iy + 1, seed);

    const nx0 = this._lerp(n00, n10, u);
    const nx1 = this._lerp(n01, n11, u);
    return this._lerp(nx0, nx1, v);
  }

  fbm2D(x, y, seed, octaves = 3, persistence = 0.5, lacunarity = 2.0) {
    let total = 0.0;
    let amplitude = 1.0;
    let frequency = 1.0;
    let maxAmplitude = 0.0;

    for (let i = 0; i < octaves; i++) {
      total += this._valueNoise2D(x * frequency, y * frequency, seed + i * 101) * amplitude;
      maxAmplitude += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return maxAmplitude > 0 ? total / maxAmplitude : 0.0;
  }

  _resolveCellBiome(r, c, rows, cols, preset, seeds) {
    // 1. Gradiente latitudinal planetário (0 no equador central, 1 nos polos superior/inferior)
    const normY = rows > 1 ? (r + 0.5) / rows : 0.5;
    const polarDistance = Math.abs(normY - 0.5) * 2.0;
    const latThermal = (1.0 - 2.0 * polarDistance) * preset.latStrength;

    // 2. Ruído 2D multi-frequência + perturbações senoidais para bordas orgânicas e bolsões
    const macroTempNoise = this.fbm2D(c * 0.14, r * 0.14, seeds.temp, 3);
    const microPocketNoise = this.fbm2D(c * 0.38, r * 0.38, seeds.pocket, 2);
    const harmonicMicro =
      0.55 * Math.sin(c * 0.35 + seeds.phaseA) * Math.cos(r * 0.33 + seeds.phaseB) +
      0.45 * Math.sin(c * 0.72 - r * 0.64 + seeds.phaseC);

    const normX = cols > 1 ? (c + 0.5) / cols : 0.5;
    const edgeProximity = Math.max(polarDistance, Math.abs(normX - 0.5) * 2.0);
    const borderBoost = 0.08 + 0.14 * edgeProximity;
    const thermalPerturb =
      macroTempNoise * 0.24 +
      microPocketNoise * (0.14 + borderBoost * 0.5) +
      harmonicMicro * 0.08;

    const regionalHeat = latThermal + preset.heatBias + thermalPerturb;

    // 3. Umidade regional e elevação/hidrologia 2D
    const moistMacro = this.fbm2D(c * 0.15, r * 0.15, seeds.moist, 3);
    const moistDetail = this.fbm2D(c * 0.36, r * 0.36, seeds.moist + 97, 2);
    const latDryness = Math.max(0, 0.25 - polarDistance) * 0.35;
    const regionalMoisture = Math.max(
      0.05,
      Math.min(1.0, 0.52 + moistMacro * 0.38 + moistDetail * 0.14 + preset.moistBias - latDryness)
    );

    const elevMacro = this.fbm2D(c * 0.17, r * 0.17, seeds.elev, 3);
    const elevDetail = this.fbm2D(c * 0.42, r * 0.42, seeds.elev + 53, 2);
    const elevationNoise = elevMacro * 0.78 + elevDetail * 0.22;
    const normalizedElevation = Math.max(0, Math.min(1, (elevationNoise + 1) * 0.5));

    const waterNoise = this.fbm2D(c * 0.18, r * 0.18, seeds.water, 3) * 0.8 + elevDetail * 0.2;

    // 4. Classificação regional do bioma
    let chosenBiome;
    if (waterNoise < preset.waterThreshold) {
      chosenBiome = 'water';
    } else if (elevationNoise > preset.rockyThreshold) {
      chosenBiome = 'rocky';
    } else if (regionalHeat < -0.34) {
      if (regionalHeat > -0.40 && regionalMoisture > 0.82 && waterNoise < preset.waterThreshold + 0.14) {
        chosenBiome = 'wetland';
      } else {
        chosenBiome = 'tundra';
      }
    } else if (regionalHeat <= 0.34) {
      if (regionalMoisture > 0.72 || (waterNoise < preset.waterThreshold + 0.13 && regionalMoisture > 0.54)) {
        chosenBiome = 'wetland';
      } else if (regionalMoisture < 0.25 && regionalHeat > 0.15) {
        chosenBiome = 'savanna';
      } else {
        chosenBiome = 'temperate';
      }
    } else {
      if (regionalMoisture > 0.80 && waterNoise < preset.waterThreshold + 0.12) {
        chosenBiome = 'wetland';
      } else if (regionalHeat > 0.58 && regionalMoisture < 0.55) {
        chosenBiome = 'desert';
      } else if (regionalMoisture < 0.30) {
        chosenBiome = 'desert';
      } else {
        chosenBiome = 'savanna';
      }
    }

    return {
      chosenBiome,
      latThermal,
      microPocketNoise,
      regionalMoisture,
      normalizedElevation
    };
  }

  _ensureMinimumHabitableLand(grid, rows, cols, preset) {
    let habitableCount = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c].isHabitable()) habitableCount++;
      }
    }

    const minRequired = Math.max(12, Math.floor(rows * cols * 0.22));
    if (habitableCount >= minRequired) return;

    const centerR = (rows - 1) / 2;
    const centerC = (cols - 1) / 2;
    const candidates = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!grid[r][c].isHabitable()) {
          const dist = Math.hypot((r - centerR) / Math.max(1, rows), (c - centerC) / Math.max(1, cols));
          candidates.push({ r, c, dist });
        }
      }
    }

    candidates.sort((a, b) => a.dist - b.dist);
    const needed = minRequired - habitableCount;

    for (let i = 0; i < Math.min(needed, candidates.length); i++) {
      const { r, c } = candidates[i];
      const normY = rows > 1 ? (r + 0.5) / rows : 0.5;
      const polarDistance = Math.abs(normY - 0.5) * 2.0;
      const heat = (1.0 - 2.0 * polarDistance) * preset.latStrength + preset.heatBias;

      let landBiome = 'temperate';
      if (heat < -0.34) landBiome = 'tundra';
      else if (heat > 0.55) landBiome = 'desert';
      else if (heat > 0.34) landBiome = 'savanna';

      const cell = grid[r][c];
      cell.applyBiome(landBiome);
      const lum = Math.floor((Math.random() - 0.5) * 18);
      cell.cachedColor = this.adjustColor(cell.biomeColor, lum);
    }
  }

  buildGrid(biomeType = 'random') {
    const engine = this.engine;
    engine.grid = [];

    const rows = engine.gridRows;
    const cols = engine.gridCols;
    const preset = this._getWorldPreset(biomeType);
    const seeds = this._createNoiseSeeds();

    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        const {
          chosenBiome,
          latThermal,
          microPocketNoise,
          regionalMoisture,
          normalizedElevation
        } = this._resolveCellBiome(r, c, rows, cols, preset, seeds);

        const profile = GridCell.resolveBiomeProfile(chosenBiome);
        const localTempMicro = Math.max(
          -0.08,
          Math.min(0.08, latThermal * 0.08 + microPocketNoise * 0.04)
        );
        const localTempOffset = parseFloat((profile.localTempOffset + localTempMicro).toFixed(3));
        const initialNitrogen = chosenBiome === 'water'
          ? 0
          : parseFloat((profile.fertilityCap * (0.50 + Math.random() * 0.40)).toFixed(2));
        const initialMoisture = chosenBiome === 'water'
          ? 1.0
          : parseFloat(Math.max(0.10, Math.min(1.0, profile.baseMoisture * 0.7 + regionalMoisture * 0.3)).toFixed(3));
        const lum = Math.floor((Math.random() - 0.5) * 18);
        const cachedColor = this.adjustColor(profile.biomeColor, lum);

        const cell = new GridCell(r, c, engine.cellSize, chosenBiome, {
          biomeType: profile.biomeType,
          localTempOffset,
          waterRetention: profile.waterRetention,
          fertilityCap: profile.fertilityCap,
          biomeColor: profile.biomeColor,
          elevation: parseFloat(normalizedElevation.toFixed(3)),
          moisture: initialMoisture,
          soilNitrogen: initialNitrogen,
          organicBiomass: chosenBiome === 'water' ? 0.0 : parseFloat((Math.random() * 5.0).toFixed(2)),
          cachedColor
        });

        row.push(cell);
      }
      engine.grid.push(row);
    }

    this._ensureMinimumHabitableLand(engine.grid, rows, cols, preset);
  }

  adjustColor(hex, amt) {
    if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) {
      return '#2d6a3f';
    }
    const num = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + amt));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amt));
    const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
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

    for (let r = 0; r < engine.gridRows; r++) {
      for (let c = 0; c < engine.gridCols; c++) {
        const cell = engine.grid[r][c];
        if (!cell) continue;

        // Sincroniza caso algum sistema externo (ex: Meteoro ou slider) tenha alterado cell.biome diretamente
        if (cell.biome && cell.biome !== cell._appliedBiome && typeof cell.applyBiome === 'function') {
          const normalized = (cell.biome === 'random' || cell.biome === 'islands') ? 'temperate' : cell.biome;
          cell.applyBiome(normalized, { preservePhysicalState: true });
          const lum = Math.floor((Math.random() - 0.5) * 18);
          cell.cachedColor = this.adjustColor(cell.biomeColor, lum);
        }

        const fallbackColor = BIOME_PROFILES[cell.biomeType]?.biomeColor || '#2d6a3f';
        tctx.fillStyle = cell.cachedColor || cell.biomeColor || fallbackColor;
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
    const mapW = engine.canvas?.width ?? (engine.gridCols * engine.cellSize);
    const mapH = engine.canvas?.height ?? (engine.gridRows * engine.cellSize);
    const minCenterDist = Math.max(120, Math.min(mapW, mapH) * 0.28);
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
    const remainder = count % centers.length;

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
