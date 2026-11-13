// ====================================================
//  PLANT.JS — Entidade Vegetal (Lei de Liebig + partição de biomassa)
// ====================================================

import { Organism } from './Organism.js';
import { Genome } from '../core/Genome.js';

/**
 * Entidade Vegetal fundamentada na Lei de Liebig e partição de biomassa.
 */
export class Plant extends Organism {
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
