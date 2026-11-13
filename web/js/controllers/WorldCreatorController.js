// ====================================================
//  WORLDCREATORCONTROLLER.JS — Configurador de Mundos, Biomas e Populações (POO)
// ====================================================

import { UIController } from './UIController.js';
import { AnimalCreatorController } from './AnimalCreatorController.js';
import { PlantCreatorController } from './PlantCreatorController.js';

export const WORLD_BIOMES = [
  { id: 'random',  name: 'Aleatório',     desc: 'Biomas misturados organicamente por ruído fractal' },
  { id: 'islands', name: 'Arquipélago',   desc: 'Ilhas férteis cercadas por oceanos de água azul' },
  { id: 'savanna', name: 'Savana Mista',  desc: 'Planícies secas, arbustos esparsos e oásis' },
  { id: 'fertile', name: 'Vale Fértil',   desc: 'Solo fértil, alta umidade, lagos e floresta densa' },
  { id: 'desert',  name: 'Deserto Árido', desc: 'Solos arenosos e rochosos sob calor abrasador' },
  { id: 'frozen',  name: 'Tundra Gelada', desc: 'Gelo, solos rochosos e baixas temperaturas' },
];

export const STARTER_ANIMALS = [
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

export const STARTER_PLANTS = [
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

export class WorldCreatorController {
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
