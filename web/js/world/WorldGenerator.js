// ====================================================
//  WORLDGENERATOR.JS — Geração de terreno e população inicial
// ====================================================

import { GridCell } from './GridCell.js';
import { Plant } from '../entities/Plant.js';
import { Animal } from '../entities/Animal.js';

export class WorldGenerator {
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
