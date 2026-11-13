// ====================================================
//  ECOLOGYMANAGER.JS — Gerenciamento de equilíbrio ecológico
// ====================================================

export class EcologyManager {
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
