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

function evaluatePlantSpeciation(childGenes, founderGenes) {
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

function mutateAndNormalizeDiet(parentDiet) {
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

class SimulationEngine {
  constructor() {

    this.showGridLines = true;
    this.climateTrend = 0.0;     // Deslocamento gradual da temperatura global
    this.hydrologyTimer = 0;     // Cronômetro para avanço/recuo de rios e lagos

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

    // Contadores temporários para diagnóstico da vegetação.
this.plantMetrics = {
  reproduced: 0,
  nutrientDeaths: 0,
  ageDeaths: 0,
  floodDeaths: 0,
  grazingDeaths: 0,
  growthUpdates: 0, // Atualizações em que houve crescimento.
  growthBlocked: 0  // Atualizações bloqueadas por falta de nitrogênio.
};

// Contadores temporários para diagnóstico da mortalidade animal.
// Contadores temporários para diagnóstico da mortalidade animal.
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
          cell.soilNitrogen = Math.max(cell.soilNitrogen, 65.0);
          cell.moisture = Math.max(cell.moisture, 0.60);
        }
      }
    }
    const neededPlants = Math.max(0, 45 - this.plants.length);
    if (neededPlants > 0) {
      this.spawnInitialPlants(neededPlants);
    }
    this.animals.forEach(a => {
      a.energy = Math.max(a.energy, 45.0);
      a.isDiseased = false;
    });
    if (typeof toast === 'function') {
      toast('🚑 Socorro Ecológico: Solos enriquecidos, flora replantada e fauna revitalizada!');
    }
  }

  init(canvas, worldConfig) {
    this.pause();
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.worldConfig = worldConfig || {};

    const sz = this.worldConfig.gridSize || 45;
    this.gridCols = Math.min(120, Math.max(20, Math.round(sz * 0.75)));
    this.gridRows = Math.min(80, Math.max(15, Math.round(sz * 0.5)));

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
    // DIAGNÓSTICO TEMPORÁRIO: distribuição dos biomas e nitrogênio.
const biomeStats = {};

for (const row of this.grid) {
  for (const cell of row) {
    if (!biomeStats[cell.biome]) {
      biomeStats[cell.biome] = {
        cells: 0,
        totalNitrogen: 0
      };
    }

    biomeStats[cell.biome].cells++;
    biomeStats[cell.biome].totalNitrogen += cell.soilNitrogen;
  }
}

console.log('=== DIAGNÓSTICO DO SOLO INICIAL ===');

for (const [biome, stats] of Object.entries(biomeStats)) {
  console.log(biome, {
    celulas: stats.cells,
    nitrogenioMedio: (stats.totalNitrogen / stats.cells).toFixed(2)
  });
}
    this.spawnInitialPlants(this.worldConfig.initialPlantCount || 70);
    
    this.spawnInitialAnimals(this.worldConfig.initialAnimalCount || 25);

    this.createTerrainCache();
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


  createTerrainCache() {
    if (!this.canvas) return;
    if (!this.terrainCanvas) {
      this.terrainCanvas = document.createElement('canvas');
    }
    this.terrainCanvas.width = this.canvas.width;
    this.terrainCanvas.height = this.canvas.height;
    const tCtx = this.terrainCanvas.getContext('2d');

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
        tCtx.fillStyle = BIOME_TILES[cell.biome] || '#1a4e1d';
        tCtx.fillRect(x, y, this.cellSize, this.cellSize);

        if (this.showGridLines) {
          tCtx.strokeStyle = 'rgba(0,0,0,0.14)';
          tCtx.lineWidth = 1;
          tCtx.strokeRect(x, y, this.cellSize, this.cellSize);
        }
      }
    }
  }

  toggleGridLines() {
    this.showGridLines = !this.showGridLines;
    const btn = document.getElementById('btn-toggle-grid');
    if (btn) btn.classList.toggle('active', this.showGridLines);
    this.render();
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
    const meanGenes = {};

    // 1. Contagem e soma gênica dos animais
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

    // Média gênica dos animais
    Object.keys(geneSums).forEach(sp => {
      const n = geneCounts[sp] || 1;
      meanGenes[sp] = {
        size: geneSums[sp].size / n,
        speed: geneSums[sp].speed / n,
        dietMeat: geneSums[sp].dietMeat / n,
        thermal: geneSums[sp].thermal / n
      };
    });

    // 2. Contagem e soma gênica das plantas (em um único loop)
    const plantSums = {};
    const plantCounts = {};

    this.plants.forEach(p => {
      const sp = p.name;
      popCounts[sp] = (popCounts[sp] || 0) + 1;

      if (!plantSums[sp]) {
        plantSums[sp] = { height: 0, defense: 0, rootEfficiency: 0, thermal: 0 };
        plantCounts[sp] = 0;
      }
      plantSums[sp].height += (p.genes.height || 0.5);
      plantSums[sp].defense += (p.genes.defense || 0.3);
      plantSums[sp].rootEfficiency += (p.genes.rootEfficiency || 0.5);
      plantSums[sp].thermal += (p.genes.thermal || 0.0);
      plantCounts[sp]++;
    });

    // Média gênica das plantas
    Object.keys(plantSums).forEach(sp => {
      const n = plantCounts[sp] || 1;
      meanGenes[sp] = {
        height: plantSums[sp].height / n,
        defense: plantSums[sp].defense / n,
        rootEfficiency: plantSums[sp].rootEfficiency / n,
        thermal: plantSums[sp].thermal / n
      };
    });

    // 3. Salva o snapshot na linha do tempo
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
    const targetCount = count || 140;
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
  // Encontra um ponto central seguro em terra firme para o bando
// Encontra um ponto em terra firme, priorizando distância dos grupos existentes.
findLandCenter() {
    const margin = this.cellSize * 2;
    const maxX = (this.gridCols - 2) * this.cellSize;
    const maxY = (this.gridRows - 2) * this.cellSize;

    const candidates = [];

    // Procura até 100 posições aleatórias em terra firme.
    for (let attempts = 0; attempts < 100; attempts++) {
        const cx = margin + Math.random() * (maxX - margin);
        const cy = margin + Math.random() * (maxY - margin);

        const r = Math.floor(cy / this.cellSize);
        const c = Math.floor(cx / this.cellSize);

        // Ignora posições inválidas ou cobertas por água.
        if (!this.grid[r]?.[c] || this.grid[r][c].biome === 'water') {
            continue;
        }

        // Calcula a distância até o grupo mais próximo.
        let minDistance = Infinity;

        for (const center of this.spawnGroupCenters) {
            const distance = Math.hypot(
                cx - center.x,
                cy - center.y
            );

            minDistance = Math.min(minDistance, distance);
        }

        candidates.push({
            x: cx,
            y: cy,
            distance: minDistance
        });
    }

    // Se não houver grupos anteriores, escolhe uma posição válida aleatória.
    if (this.spawnGroupCenters.length === 0) {
        if (candidates.length > 0) {
            const selected = candidates[
                Math.floor(Math.random() * candidates.length)
            ];

            this.spawnGroupCenters.push({ x: selected.x, y: selected.y });
            return { x: selected.x, y: selected.y };
        }
    }

    // Escolhe a posição mais distante dos centros já utilizados.
    if (candidates.length > 0) {
        candidates.sort((a, b) => b.distance - a.distance);

        // Sorteia entre as 5 melhores posições para evitar distribuição previsível.
        const bestCandidates = candidates.slice(0, 5);
        const selected = bestCandidates[
            Math.floor(Math.random() * bestCandidates.length)
        ];

        this.spawnGroupCenters.push({ x: selected.x, y: selected.y });

        return { x: selected.x, y: selected.y };
    }

    // Alternativa caso nenhuma posição válida seja encontrada.
    return {
        x: (this.gridCols * this.cellSize) / 2,
        y: (this.gridRows * this.cellSize) / 2
    };
}
  // Divide uma população em grupos de 2 a 5 indivíduos (nunca deixando ninguém isolado)
  spawnSpeciesInClusters(name, genes, customImages, totalCount) {
    if (totalCount <= 0) return;
    this.registerSpecies(name, 'animal', genes);

    const clusters = [];
    let remaining = totalCount;

    while (remaining > 0) {
      // Se restam até 5 indivíduos, formam um único grupo
      if (remaining <= 5) {
        clusters.push(remaining);
        break;
      }
      // Sorteia tamanho do grupo (2 a 4 indivíduos)
      let sz = Math.floor(Math.random() * 3) + 2;
      // Evita deixar sobrar apenas 1 indivíduo sozinho no final
      if (remaining - sz === 1) sz++;
      clusters.push(sz);
      remaining -= sz;
    }

    // Spawna cada subgrupo agrupado em torno de um centro territorial comum
    clusters.forEach(groupSize => {
      const center = this.findLandCenter();
      for (let i = 0; i < groupSize; i++) {
        this.spawnSingleAnimal(name, genes, customImages, center.x, center.y);
      }
    });
  }

  spawnInitialAnimals(count) {
    this.animals = [];
        this.spawnGroupCenters = []; // Registra os centros dos grupos desta simulação.
    const speciesList = this.worldConfig?.speciesCounts?.animals;

    if (speciesList && speciesList.length > 0) {
      speciesList.forEach(sp => {
        const n = Math.max(0, parseInt(sp.count) || 0);
        this.spawnSpeciesInClusters(sp.name, sp.genes, sp.customImages || {}, n);
      });
      return;
    }

    // Fallback caso não venha da tela de configuração do mundo
    const savedAnimals = JSON.parse(localStorage.getItem('evo_animals') || '[]');
    const targetCount = count || 25;

    
if (savedAnimals.length > 0) {
  // Distribui a quantidade solicitada entre as espécies salvas.
  const baseCount = Math.floor(targetCount / savedAnimals.length);
  const remainder = targetCount % savedAnimals.length;

  savedAnimals.forEach((sp, index) => {
    // Algumas espécies recebem um indivíduo extra para completar o total.
    const speciesCount = baseCount + (index < remainder ? 1 : 0);

    // Não cria indivíduos quando a quantidade distribuída é zero.
    if (speciesCount > 0) {
      this.spawnSpeciesInClusters(
        sp.name,
        sp.genes,
        sp.customImages || {},
        speciesCount
      );
    }
  });
}
else {
      const predCount = Math.max(2, Math.round(targetCount * 0.25));
      const herbCount = Math.max(4, targetCount - predCount);

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
  }

spawnSingleAnimal(name, genes, customImages, centerX = null, centerY = null) {
    const margin = 14;
    const maxX = this.gridCols * this.cellSize - margin;
    const maxY = this.gridRows * this.cellSize - margin;

    let rx, ry;

    if (centerX !== null && centerY !== null) {
      // Espalha os membros do grupo a uma distância de contato visual (10px a 40px do centro)
      const angle = Math.random() * Math.PI * 2;
      const dist = 10 + Math.random() * 30;
      rx = Math.max(margin, Math.min(maxX, centerX + Math.cos(angle) * dist));
      ry = Math.max(margin, Math.min(maxY, centerY + Math.sin(angle) * dist));

      const r = Math.floor(ry / this.cellSize);
      const c = Math.floor(rx / this.cellSize);
      if (this.grid[r]?.[c]?.biome === 'water') {
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
  diet: genes.diet
    ? { ...genes.diet }
    : { meat: 0.05, plant: 0.85, carcass: 0.10 }
};

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
      genes: animalGenes,
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

    try {
      for (let s = 0; s < this.speed; s++) {
        this.updateTick();
      }
      this.render();
      this.updateStatsUI();
    } catch (err) {
      console.error("Erro recuperado na simulação:", err);
    }

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

  // OTIMIZAÇÃO ULTRA-FPS: Cache trófico O(N) único para eliminar varreduras quadráticas O(N^2)
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
  // Contadores temporários de comportamento alimentar.
this.aiMetrics ??= {
  fleeEvents: 0,
  herbivoreMeals: 0,
  plantTargets: 0,
  plantApproaches: 0,
  carcassMeals: 0,
   herbivoreCarcassMeals: 0,
  carnivoreCarcassMeals: 0,
  carcassTargets: 0, // Conta quantas vezes uma carcaça é selecionada como alvo.
  carcassDistanceTotal: 0, // Soma das distâncias das carcaças selecionadas.
carcassFarTargets: 0,     // Seleções de carcaças a mais de 18 pixels.
carcassMaxDistance: 0,   // Maior distância registrada.
  prionInfections: 0,
  crowdInfections: 0,
  cannibalAttacks: 0,
  otherSpeciesKills: 0,
    carnivorePreyKills: 0,
  nonCarnivorePreyKills: 0
};

  // Exibe as métricas das plantas a cada 100 ciclos.
  if (this.tickCount % 100 === 0) {
    console.log('=== DIAGNÓSTICO DA VEGETAÇÃO ===');
    
    console.log('Plantas vivas:', this.plants.length);
    console.log('Plantas reproduzidas:', this.plantMetrics.reproduced);
    console.log('Mortes por falta de nutrientes:', this.plantMetrics.nutrientDeaths);
    console.log('Mortes por idade:', this.plantMetrics.ageDeaths);
    console.log('Mortes por enchentes:', this.plantMetrics.floodDeaths);
    console.log('Remoções por pastoreio:', this.plantMetrics.grazingDeaths);
    console.log('Atualizações com crescimento:', this.plantMetrics.growthUpdates);
    
console.log('Atualizações bloqueadas:', this.plantMetrics.growthBlocked);
    // Diagnóstico temporário da densidade populacional.
    let totalNeighbors = 0;
    let maxNeighbors = 0;
    let animalsAboveTwo = 0;
    let animalsAboveFour = 0;

    // Contadores temporários para diagnosticar a energia dos animais.
let totalEnergy = 0;
let herbivoreEnergy = 0;
let carnivoreEnergy = 0;
let lowEnergyAnimals = 0;
let sickLowEnergyAnimals = 0;
let herbivoreCount = 0;
let carnivoreCount = 0;
// Métricas de tamanho dos carnívoros.
let minCarnivoreSize = Infinity;
let maxCarnivoreSize = -Infinity;
let totalCarnivoreSize = 0;
    

    this.animals.forEach(anim => {
      let neighbors = 0;

      this.animals.forEach(other => {
        if (
          other !== anim &&
          Math.hypot(other.x - anim.x, other.y - anim.y) < 48
        ) {
          neighbors++;
        }
      });

      totalNeighbors += neighbors;
      maxNeighbors = Math.max(maxNeighbors, neighbors);
            // Acumula a energia disponível na população.
      totalEnergy += anim.energy;

      // Identifica animais com energia crítica.
      if (anim.energy < 25) {
        lowEnergyAnimals++;

        if (anim.isDiseased) {
          sickLowEnergyAnimals++;
        }
      }

      // Separa herbívoros e carnívoros pelo perfil alimentar.
      if ((anim.genes.diet?.meat || 0) > 0.45) {
  carnivoreEnergy += anim.energy;
  carnivoreCount++;

  // Registra os tamanhos dos carnívoros.
  const size = anim.genes.size;
  minCarnivoreSize = Math.min(minCarnivoreSize, size);
  maxCarnivoreSize = Math.max(maxCarnivoreSize, size);
  totalCarnivoreSize += size;
} else {
        herbivoreEnergy += anim.energy;
        herbivoreCount++;
      }

      if (neighbors > 2) animalsAboveTwo++;
      if (neighbors > 4) animalsAboveFour++;
    });

    console.log('=== DIAGNÓSTICO DE DENSIDADE ===');
    console.log('Média de vizinhos:', this.animals.length > 0
      ? (totalNeighbors / this.animals.length).toFixed(2)
      : 0);
    console.log('Máximo de vizinhos:', maxNeighbors);
    console.log('Animais com mais de 2 vizinhos:', animalsAboveTwo);
    console.log('Animais com mais de 4 vizinhos:', animalsAboveFour);
    console.log('População atual:', this.animals.length);
    console.log('Quantidade de herbívoros:', herbivoreCount);
    
console.log('Quantidade de carnívoros:', carnivoreCount);
console.log('Menor tamanho dos carnívoros:', carnivoreCount > 0 ? minCarnivoreSize.toFixed(2) : 0);
console.log('Maior tamanho dos carnívoros:', carnivoreCount > 0 ? maxCarnivoreSize.toFixed(2) : 0);
console.log('Tamanho médio dos carnívoros:', carnivoreCount > 0 ? (totalCarnivoreSize / carnivoreCount).toFixed(2) : 0);
console.log('Animais doentes:', this.animals.filter(a => a.isDiseased).length);

// Exibe o diagnóstico energético da população.
console.log('=== DIAGNÓSTICO ENERGÉTICO ===');

console.log('Energia média geral:', this.animals.length > 0
  ? (totalEnergy / this.animals.length).toFixed(2)
  : 0);

console.log('Energia média dos herbívoros:', herbivoreCount > 0
  ? (herbivoreEnergy / herbivoreCount).toFixed(2)
  : 0);

console.log('Energia média dos carnívoros:', carnivoreCount > 0
  ? (carnivoreEnergy / carnivoreCount).toFixed(2)
  : 0);

console.log('Animais com energia abaixo de 25:', lowEnergyAnimals);
console.log('Doentes com energia abaixo de 25:', sickLowEnergyAnimals);
// Exibe o diagnóstico acumulado de mortalidade.
console.log('=== DIAGNÓSTICO DE MORTALIDADE ===');
console.log('Mortes por falta de energia:', this.animalMetrics.energyDeaths);
console.log('Mortes por idade:', this.animalMetrics.ageDeaths);
console.log('Mortes de animais doentes:', this.animalMetrics.sickDeaths);
console.log('Mortes de animais saudáveis:', this.animalMetrics.healthyDeaths);
console.log('Mortes de juvenis (menos de 50 ciclos):', this.animalMetrics.juvenileDeaths);
console.log('Mortes de adultos (50 ciclos ou mais):', this.animalMetrics.adultDeaths);

// Exibe os comportamentos registrados nos últimos 100 ciclos.

// DIAGNÓSTICO TEMPORÁRIO: evolução da percepção visual.
const herbivoresForVision = this.animals.filter(
  a => (a.genes.diet?.meat ?? 0) <= 0.45
);

const carnivoresForVision = this.animals.filter(
  a => (a.genes.diet?.meat ?? 0) > 0.45
);

const herbivorePerceptions = herbivoresForVision.map(
  a => a.genes.perception ?? 0
);

const predatorPerceptions = carnivoresForVision.map(
  a => a.genes.perception ?? 0
);

const averageHerbivorePerception = herbivorePerceptions.length > 0
  ? herbivorePerceptions.reduce((sum, value) => sum + value, 0) / herbivorePerceptions.length
  : 0;

const maxHerbivorePerception = herbivorePerceptions.length > 0
  ? Math.max(...herbivorePerceptions)
  : 0;

const averagePredatorPerception = predatorPerceptions.length > 0
  ? predatorPerceptions.reduce((sum, value) => sum + value, 0) / predatorPerceptions.length
  : 0;

  // Diagnóstico da composição alimentar dos animais classificados como herbívoros.
const herbivorePlantValues = herbivoresForVision.map(
  a => a.genes.diet?.plant ?? 0
);

const averageHerbivorePlant = herbivorePlantValues.length > 0
  ? herbivorePlantValues.reduce((sum, value) => sum + value, 0) / herbivorePlantValues.length
  : 0;

const herbivoresWithoutPlantDiet = herbivoresForVision.filter(
  a => (a.genes.diet?.plant ?? 0) <= 0.20
).length;

const herbivoresWithPlantDiet = herbivoresForVision.filter(
  a => (a.genes.diet?.plant ?? 0) > 0.20
).length;

console.log('Afinidade vegetal média dos herbívoros:', averageHerbivorePlant.toFixed(3));
console.log('Herbívoros sem busca por plantas:', herbivoresWithoutPlantDiet);
console.log('Herbívoros aptos a buscar plantas:', herbivoresWithPlantDiet);
console.log('=== DIAGNÓSTICO DA IA ===');
console.log('Percepção média dos herbívoros:', averageHerbivorePerception.toFixed(3));
console.log('Percepção máxima dos herbívoros:', maxHerbivorePerception.toFixed(3));
console.log('Percepção média dos carnívoros:', averagePredatorPerception.toFixed(3));
console.log('Eventos de fuga:', this.aiMetrics.fleeEvents);
console.log('Refeições herbívoras:', this.aiMetrics.herbivoreMeals);
console.log('Refeições de carcaças:', this.aiMetrics.carcassMeals);
console.log('Refeições de carcaças por herbívoros:', this.aiMetrics.herbivoreCarcassMeals);
console.log('Refeições de carcaças por carnívoros:', this.aiMetrics.carnivoreCarcassMeals);
console.log('Plantas encontradas:', this.aiMetrics.plantTargets);
console.log('Infecções por príon:', this.aiMetrics.prionInfections);
console.log('Ataques canibais:', this.aiMetrics.cannibalAttacks);
console.log('Infecções por superlotação:', this.aiMetrics.crowdInfections);
console.log('Aproximações de plantas:', this.aiMetrics.plantApproaches);
console.log('Abates de outras espécies:', this.aiMetrics.otherSpeciesKills);
console.log('Abates de carnívoros:', this.aiMetrics.carnivorePreyKills);
console.log('Abates de não carnívoros:', this.aiMetrics.nonCarnivorePreyKills);
console.log('Seleções de carcaças como alvo:', this.aiMetrics.carcassTargets);
console.log('Distância média das carcaças:', this.aiMetrics.carcassTargets > 0
  ? (this.aiMetrics.carcassDistanceTotal / this.aiMetrics.carcassTargets).toFixed(2)
  : 0);
console.log('Seleções de carcaças a 18px ou mais:', this.aiMetrics.carcassFarTargets);
console.log('Maior distância de carcaça:', this.aiMetrics.carcassMaxDistance.toFixed(2));
console.log('Ciclo:', this.tickCount);

// Reinicia os contadores para o próximo intervalo.
// DIAGNÓSTICO TEMPORÁRIO: nitrogênio do solo por bioma.
const soilStats = {};

for (const row of this.grid) {
  for (const cell of row) {
    if (!soilStats[cell.biome]) {
      soilStats[cell.biome] = {
        cells: 0,
        totalNitrogen: 0,
        minNitrogen: Infinity,
        maxNitrogen: -Infinity
      };
    }

    const stats = soilStats[cell.biome];

    stats.cells++;
    stats.totalNitrogen += cell.soilNitrogen;
    stats.minNitrogen = Math.min(stats.minNitrogen, cell.soilNitrogen);
    stats.maxNitrogen = Math.max(stats.maxNitrogen, cell.soilNitrogen);
  }
}

console.log('=== NITROGÊNIO DO SOLO POR BIOMA ===');

for (const [biome, stats] of Object.entries(soilStats)) {
  console.log(biome, {
    celulas: stats.cells,
    media: (stats.totalNitrogen / stats.cells).toFixed(2),
    minimo: stats.minNitrogen.toFixed(2),
    maximo: stats.maxNitrogen.toFixed(2)
  });
}

// Armazena objeto estruturado para o Console do Sistema (sem necessitar F12)
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
this.aiMetrics.crowdInfections =0;
this.aiMetrics.cannibalAttacks= 0;
this.aiMetrics.otherSpeciesKills= 0;
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
    const curSeason = SEASONS[this.seasonIndex];

    if (this.tickCount % this.historyInterval === 0) {
      this.recordHistorySnapshot();
    }

    // ── CLIMA DINÂMICO & MEIO EM TRANSIÇÃO ──
    this.climateTrend = -0.00015 * this.generation + Math.sin(this.tickCount * 0.0012) * 0.25;
    const effectiveTemp = curSeason.temp + this.climateTrend;

    // ── HIDROLOGIA DINÂMICA: RIOS SURGINDO E SECANDO ──
    this.hydrologyTimer++;
    if (this.hydrologyTimer >= 90) {
      this.hydrologyTimer = 0;
      const isWetPeriod = curSeason.rain > 1.0;
      const isFreezing = effectiveTemp < -0.6;

      const targetR = Math.floor(Math.random() * this.gridRows);
      const targetC = Math.floor(Math.random() * this.gridCols);
      const cell = this.grid[targetR]?.[targetC];

      if (cell) {
        // Enchentes e transbordamento em épocas de chuva
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

    // Registra a remoção da planta por enchente.
    this.plantMetrics.floodDeaths++;
  }

  cell.plant = null;
}
          }
        }
        // Seca de rios em épocas quentes
        else if (!isWetPeriod && cell.biome === 'water' && effectiveTemp > 0.1) {
          let neighborDry = 0;
          [[1,0], [-1,0], [0,1], [0,-1]].forEach(([dr, dc]) => {
            const b = this.grid[targetR + dr]?.[targetC + dc]?.biome;
            if (b === 'dry' || b === 'fertile') neighborDry++;
          });
          if (neighborDry >= 2 && Math.random() < 0.35) {
            cell.biome = 'fertile';
            cell.moisture = 0.70;
            cell.maxSoilNitrogen = 120; // Restaura a capacidade fértil do solo
            cell.soilNitrogen = 50.0;
          }
        }
      }
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

    // 3. VEGETAIS (Lei de Liebig, Estresse Térmico & Especiação Botânica)
    for (let idx = this.plants.length - 1; idx >= 0; idx--) {
      const plant = this.plants[idx];
      if (!plant) {
        this.plants.splice(idx, 1);
        continue;
      }

      plant.age++;
      const cell = this.grid[plant.r]?.[plant.c];
      if (!cell) {
        this.plants.splice(idx, 1);
        continue;
      }

      const g = plant.genes || {};
      const maintenanceCost = 0.02 + ((g.height || 0.5) * 0.02) + ((g.defense || 0.3) * 0.015);

      const tempDiff = Math.abs((g.thermal || 0.0) - curSeason.temp);
      const thermalPlantFactor = tempDiff > 0.4 ? 1.0 + (tempDiff - 0.4) * 0.6 : 1.0;

      const lightFactor = (curSeason.sunlight * 1.0) / (0.4 + curSeason.sunlight);
      const nitrogenFactor = cell.soilNitrogen / (10.0 + cell.soilNitrogen);
      const waterFactor = Math.min(1.0, cell.moisture * (0.7 + (g.rootEfficiency || 0.5) * 0.6));
      const liebig = Math.min(lightFactor, nitrogenFactor, waterFactor) / thermalPlantFactor;

      if (cell.soilNitrogen >= maintenanceCost) {
        this.plantMetrics.growthUpdates++;

        cell.soilNitrogen -= maintenanceCost;
        const leafAreaFactor = Math.max(0.20, plant.growth);
        const growthDelta = 0.016 * leafAreaFactor * (0.5 + (g.growthSpeed || 0.5) * 0.8) * liebig;
        plant.growth = Math.min(1.0, plant.growth + growthDelta);

        if (plant.growth >= 0.70) {
          plant.hasFruit = true;
          plant.fruitCount = Math.round(1 + (g.fruitAttraction || 0.4) * 4);
        }
      } else {
        this.plantMetrics.growthBlocked++;
       plant.energy -= 0.22;

// Registra a causa da remoção da planta.
if (plant.energy <= 0 || plant.age > 500) {
  if (plant.energy <= 0) {
    this.plantMetrics.nutrientDeaths++;
  } else {
    this.plantMetrics.ageDeaths++;
  }

  cell.organicBiomass += plant.growth * 10.0;
  cell.plant = null;
  this.plants.splice(idx, 1);
  continue;
}
      }

      // Dispersão e reprodução
      // Taxa aumentada de 0.006 para 0.014 — plantas precisam se recuperar mais rápido do pastoreio
      const reproThreshold = 0.014 * (g.growthSpeed || 0.5);
      if (plant.hasFruit && Math.random() < reproThreshold && this.plants.length < this.gridCols * this.gridRows * 0.60) {
        const windReach = Math.max(1, Math.round(1 + (g.height || 0.5) * 3));
        const dr = Math.floor(Math.random() * (windReach * 2 + 1)) - windReach;
        const dc = Math.floor(Math.random() * (windReach * 2 + 1)) - windReach;
        const nr = plant.r + dr, nc = plant.c + dc;

        if (this.grid[nr]?.[nc] && this.grid[nr][nc].biome !== 'water' && !this.grid[nr][nc].plant) {
          const childGenes = {};
          Object.keys(g).forEach(k => {
            if (k === 'colorHue') {
              childGenes[k] = Math.round(((g[k] || 110) + (Math.random() * 24 - 12) + 360) % 360);
            } else if (k === 'thermal') {
              childGenes[k] = parseFloat(Math.max(-1.0, Math.min(1.0, (g[k] || 0) + (Math.random() * 0.12 - 0.06))).toFixed(2));
            } else {
              childGenes[k] = parseFloat(Math.max(0.05, Math.min(1.0, g[k] + (Math.random() * 0.12 - 0.06))).toFixed(2));
            }
          });

          const baseName = plant.name;
          const speciesData = this.speciesRegistry[baseName] || {};
          const founderGenes = speciesData.founderGenes || g;
          const rootName = speciesData.rootName || baseName.replace(/\s*(Espinhosa|Indefesa|Gigante|Rasteira|Árida|Aquática|Pioneira|Tardia|Tropical|Boreal)/g, '').trim();

          const speciation = evaluatePlantSpeciation(childGenes, founderGenes);
          let childSpeciesName = baseName;

          if (speciation.diverged) {
            childSpeciesName = `${rootName} ${speciation.desc}`;
            const isNew = this.registerSpecies(
              childSpeciesName,
              'plant',
              childGenes,
              baseName,
              rootName,
              speciation.traitName + ' ' + speciation.desc
            );

            if (isNew && typeof toast === 'function') {
              toast(`🌿 Nova Linhagem Vegetal: "${childSpeciesName}" evoluiu por adaptação de ${speciation.traitName}!`);
            }
          }

          const childPlant = {
            id: 'plant_' + Math.random().toString(36).substr(2, 9),
            name: childSpeciesName,
            r: nr, c: nc,
            x: (nc + 0.5) * this.cellSize,
            y: (nr + 0.5) * this.cellSize,
            energy: 35.0,
            growth: 0.18,
            hasFruit: false,
            fruitCount: 0,
            age: 0,
            genes: childGenes,
            customImages: plant.customImages
          };
          this.grid[nr][nc].plant = childPlant;
          this.plants.push(childPlant);
          this.plantMetrics.reproduced++;
        }
      }

      // Propagação vegetativa clonal (rizomas/estolões): permite colonização contínua sem depender apenas de frutos
      if (this.equilibriumSettings?.vegetativeSpreading && plant.growth >= 0.30 && Math.random() < 0.008 * (g.growthSpeed || 0.5) && this.plants.length < this.gridCols * this.gridRows * 0.65) {
        const deltas = [[1,0], [-1,0], [0,1], [0,-1]];
        const [dr, dc] = deltas[Math.floor(Math.random() * deltas.length)];
        const nr = plant.r + dr, nc = plant.c + dc;

        if (this.grid[nr]?.[nc] && this.grid[nr][nc].biome !== 'water' && !this.grid[nr][nc].plant && this.grid[nr][nc].soilNitrogen > 10.0) {
          const clonePlant = {
            id: 'plant_' + Math.random().toString(36).substr(2, 9),
            name: plant.name,
            r: nr, c: nc,
            x: (nc + 0.5) * this.cellSize,
            y: (nr + 0.5) * this.cellSize,
            energy: 28.0,
            growth: 0.14,
            hasFruit: false,
            fruitCount: 0,
            age: 0,
            genes: { ...g },
            customImages: plant.customImages
          };
          this.grid[nr][nc].plant = clonePlant;
          this.plants.push(clonePlant);
          this.plantMetrics.reproduced++;
        }
      }
    }

    // 3.1 BANCO DE SEMENTES NO SOLO (HOMEOSTASE E SUCESSÃO ECOLÓGICA SECUNDÁRIA)
    // Permite que sementes dormentes no solo fértil brotem quando a vegetação sofre pressão de sobrepastoreio
    const targetPlantCap = this.gridCols * this.gridRows * 0.45;
    const isPlantUnderPressure = this.plants.length < targetPlantCap;
    const baseSeedRate = this.equilibriumSettings?.seedBankRate ?? 0.14;
    const effectiveSeedRate = isPlantUnderPressure ? baseSeedRate * 1.5 : baseSeedRate * 0.4;

    if (Math.random() < effectiveSeedRate && this.plants.length < this.gridCols * this.gridRows * 0.65) {
      const randR = Math.floor(Math.random() * this.gridRows);
      const randC = Math.floor(Math.random() * this.gridCols);
      const candidateCell = this.grid[randR]?.[randC];

      if (candidateCell && candidateCell.biome !== 'water' && !candidateCell.plant && candidateCell.soilNitrogen > 15.0 && candidateCell.moisture > 0.20) {
        const knownPlantSpecies = this.speciesCatalog.filter(s => s.type === 'plant');
        const templateSpecies = knownPlantSpecies.length > 0 ? knownPlantSpecies[Math.floor(Math.random() * knownPlantSpecies.length)] : null;
        const baseGenes = (templateSpecies && (templateSpecies.founderGenes || templateSpecies.genes))
          ? (templateSpecies.founderGenes || templateSpecies.genes)
          : { growthSpeed: 0.5, height: 0.5, defense: 0.3, rootEfficiency: 0.5, thermal: 0.0 };

        const seedlingGenes = {};
        Object.keys(baseGenes).forEach(k => {
          const val = baseGenes[k];
          seedlingGenes[k] = typeof val === 'number'
            ? parseFloat(Math.max(0.05, Math.min(1.0, val + (Math.random() * 0.08 - 0.04))).toFixed(2))
            : val;
        });

        const seedling = {
          id: 'plant_' + Math.random().toString(36).substr(2, 9),
          name: templateSpecies ? templateSpecies.name : 'Grama Pioneira',
          r: randR, c: randC,
          x: (randC + 0.5) * this.cellSize,
          y: (randR + 0.5) * this.cellSize,
          energy: 32.0,
          growth: 0.18,
          hasFruit: false,
          fruitCount: 0,
          age: 0,
          genes: seedlingGenes,
          customImages: templateSpecies?.customImages ? { ...templateSpecies.customImages } : {}
        };
        candidateCell.plant = seedling;
        this.plants.push(seedling);
        this.plantMetrics.reproduced++;
      }
    }

    // 4. FISIOLOGIA ANIMAL & REGULAÇÃO DEPENDENTE DE DENSIDADE
    const deadAnimals = [];
    const newOffspring = [];
    // Contadores temporários para diagnosticar as mortes dos animais.


    this.animals.forEach(anim => {
      // ── DECLARAÇÕES E ATUALIZAÇÕES RESTAURADAS ──
      anim.age++;
      if (anim.mateCooldown > 0) anim.mateCooldown--;
      if (anim.attackCooldown > 0) anim.attackCooldown--;

      const g = anim.genes;
      const curSpeed = Math.hypot(anim.vx || 0, anim.vy || 0);

      const massKg = 5.0 + (g.size || 0.5) * 70.0;
      const basalMetabolism = 0.06 * Math.pow(massKg / 40.0, 0.75);
      const locomotionCost = 0.04 * Math.pow(curSpeed / 2.0, 1.5);

      // Reserva de gordura para carnívoros
      const meatRatio = g.diet?.meat || 0.0;
      anim.maxEnergy = 100.0 + meatRatio * 80.0;

      // Jejum prolongado para predadores
      const fastingEfficiency = 1.0 - meatRatio * 0.45;

      const tempDiff = Math.abs((g.thermal || 0.0) - curSeason.temp);
      const thermalFactor = 1.0 + (tempDiff > 0.4 ? 0.3 : 0.0) * curSeason.thermalCost;

      // Custo total declarado
      let totalCost = (basalMetabolism * fastingEfficiency + locomotionCost) * thermalFactor;

      // Modificadores de bioma (Água vs Terra)
      const curR = Math.max(0, Math.min(this.gridRows - 1, Math.floor(anim.y / this.cellSize)));
      const curC = Math.max(0, Math.min(this.gridCols - 1, Math.floor(anim.x / this.cellSize)));
      const inWater = this.grid[curR]?.[curC]?.biome === 'water';
      const aquatic = g.aquatic ?? 0.15;

      if (inWater) {
        if (aquatic < 0.35) {
          totalCost += (0.35 - aquatic) * 0.30;
          anim.vx *= 0.65;
          anim.vy *= 0.65;
          anim.stateLabel = 'Nadando com Esforço!';
        } else {
          totalCost *= 0.80;
        }
      } else {
        if (aquatic > 0.70) {
          totalCost += (aquatic - 0.70) * 0.25;
          anim.vx *= 0.75;
          anim.vy *= 0.75;
          anim.stateLabel = 'Rastejando em Terra!';
        }
      }

      // (Otimizado: Loop inútil de cortisol O(N^2) removido para ultra performance)

      if (anim.isDiseased) {
        anim.diseaseTimer--;
        totalCost += 0.12;
        if (anim.diseaseTimer <= 0) anim.isDiseased = false;
      }

      // Gestação e aborto
      if (anim.isPregnant) {
        anim.gestationTicks--;
        totalCost += 0.08;

        if (anim.energy < 22.0) {
          anim.isPregnant = false;
          anim.pregnantGenes = null;
          anim.stateLabel = '⚠️ Aborto por Inanição';
          if (typeof toast === 'function' && Math.random() < 0.18) {
            toast(`⚠️ ${anim.name} sofreu aborto espontâneo por falta de comida!`);
          }
        } else if (anim.gestationTicks <= 0) {
          anim.isPregnant = false;
          const clutch = anim.pregnantClutchSize || 1;

          for (let b = 0; b < clutch; b++) {
            const babyGenes = anim.pregnantGenes || g;
            const babySpeed = (0.5 + (babyGenes.speed || 0.5) * 1.5);
            newOffspring.push({
              id: 'anim_' + Math.random().toString(36).substr(2, 9),
              name: anim.pregnantSpeciesName || anim.speciesName,
              speciesName: anim.pregnantSpeciesName || anim.speciesName,
              x: Math.max(10, Math.min((this.gridCols * this.cellSize) - 10, anim.x + (Math.random() * 14 - 7))),
              y: Math.max(10, Math.min((this.gridRows * this.cellSize) - 10, anim.y + (Math.random() * 14 - 7))),
              vx: (Math.random() - 0.5) * babySpeed,
              vy: (Math.random() - 0.5) * babySpeed,
              energy: (babyGenes.diet?.meat || 0) > 0.45 ? 58.0 : 24.0,
              maxEnergy: 100.0 + (babyGenes.diet?.meat || 0) * 80.0,
              age: 0,
              genes: {
  ...babyGenes,
  diet: babyGenes.diet ? { ...babyGenes.diet } : undefined
},
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

      if ((g.diet?.meat || 0) > 0.45 && anim.state !== "hunting" && anim.state !== "fleeing") { totalCost *= 0.72; }
      anim.energy -= totalCost;

     // Identifica o motivo da morte do animal.
// Verifica se o animal realmente morreu.
const maxLifespan = (g.diet?.meat || 0) > 0.45 ? (950 + (g.size || 0.5) * 300) : (700 + (g.size || 0.5) * 150);
if (anim.energy <= 0 || anim.age > maxLifespan) {

// Identifica o motivo da morte.
if (anim.energy <= 0) {
  this.animalMetrics.energyDeaths++;
} else {
  this.animalMetrics.ageDeaths++;
}

// Separa mortes juvenis e adultas.
if (anim.age < 50) {
  this.animalMetrics.juvenileDeaths++;
} else {
  this.animalMetrics.adultDeaths++;
}

  // Registra se morreu enquanto estava doente.
  if (anim.isDiseased) {
    this.animalMetrics.sickDeaths++;
  } else {
    this.animalMetrics.healthyDeaths++;
  }

  deadAnimals.push(anim);
  return;
}

      // Executa a IA para buscar alimento, fugir e reproduzir.
      this.updateAnimalAI(anim, newOffspring);

      anim.x += anim.vx;
      anim.y += anim.vy;

      // Germinação zoocórica
      if (anim.carriedSeed) {
        anim.carriedSeed.dropTimer--;
        if (anim.carriedSeed.dropTimer <= 0) {
          const ar = Math.floor(anim.y / this.cellSize);
          const ac = Math.floor(anim.x / this.cellSize);
          const targetCell = this.grid[ar]?.[ac];

          if (targetCell && targetCell.biome !== 'water' && !targetCell.plant && this.plants.length < this.gridCols * this.gridRows * 0.60) {
            const seedPlant = {
              id: 'plant_' + Math.random().toString(36).substr(2, 9),
              name: anim.carriedSeed.speciesName,
              r: ar, c: ac,
              x: (ac + 0.5) * this.cellSize,
              y: (ar + 0.5) * this.cellSize,
              energy: 40.0,
              growth: 0.25,
              hasFruit: false,
              fruitCount: 0,
              age: 0,
              genes: anim.carriedSeed.genes || {},
              customImages: anim.carriedSeed.customImages || {}
            };
            targetCell.plant = seedPlant;
            targetCell.organicBiomass = Math.min(80.0, targetCell.organicBiomass + 5.0);
            this.plants.push(seedPlant);
          }
          anim.carriedSeed = null;
        }
      }

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
          // Presas abatidas reservam 35% da energia para a carcaça.
// Mortes naturais continuam usando o cálculo anterior.
const carcassEnergy = dead.carcassEnergy ??
  (25.0 + (dead.genes.size || 0.5) * 50.0);
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

   // Adiciona os filhotes sem ultrapassar o limite populacional.
const availableSlots = Math.max(
  0,
  HARD_CRASH_FAILSAFE - this.animals.length
);

// Adiciona somente a quantidade de filhotes que cabe na população.
newOffspring.slice(0, availableSlots).forEach(baby => {
  this.animals.push(baby);
});

    if (this.animals.length === 0 && this.tickCount > 10) {
      this.handleExtinction();
    }
  }

 updateAnimalAI(anim, newOffspring) {
    const g = anim.genes;
    const isCarnivore = (g.diet?.meat || 0) > 0.45;

    // Carnívoros famintos ampliam a área de busca/faro em até 50%
    const hungerRatio = Math.max(0, 1.0 - (anim.energy / anim.maxEnergy));
    const hungerVisionBonus = isCarnivore ? (1.0 + hungerRatio * 0.5) : 1.0;
    const viewDist = (45 + g.perception * 130) * (isCarnivore ? 1.4 : 1.0) * hungerVisionBonus;

    const speedPenalty = anim.isDiseased ? 0.65 : (anim.isPregnant ? 0.82 : 1.0);
    const curR = Math.max(0, Math.min(this.gridRows - 1, Math.floor(anim.y / this.cellSize)));
    const curC = Math.max(0, Math.min(this.gridCols - 1, Math.floor(anim.x / this.cellSize)));
    const inWater = this.grid[curR]?.[curC]?.biome === 'water';
    const aquatic = g.aquatic ?? 0.15;

    // Modificador de velocidade conforme adaptação anatômica
    const terrainSpeedFactor = inWater
      ? (0.30 + aquatic * 0.90)   // De 30% (terrestre) até 120% (nadador ágil)
      : (1.10 - aquatic * 0.55);  // De 110% (terrestre) até 55% (nadador em terra)

    const maxSpeed = (0.7 + g.speed * 2.2) * speedPenalty * terrainSpeedFactor;

    let targetX = null, targetY = null;
    let desiredSpeed = maxSpeed * 0.45;
    anim.stateLabel = anim.isDiseased
      ? `☣️ Infectado (${anim.diseaseTimer}t)`
      : (anim.isPregnant ? `🤰 Gestante (${anim.gestationTicks}t)` : 'Forrageando');

    // 1. Fuga de Predadores adaptativa (Seleção Natural para Percepção e Velocidade)
    if (!isCarnivore) {
      const fleePerceptionBonus = (g.perception ?? 0.5) * 60.0 * (this.equilibriumSettings?.fleePerceptionFactor ?? 1.0);
      const maxFleeDist = Math.min(viewDist, 32.0 + fleePerceptionBonus); // Presas atentas detectam a até 92px!
      let threat = null, minTDist = maxFleeDist;
      this.animals.forEach(other => {
        if (other !== anim && (other.genes.diet?.meat || 0) > 0.45 && other.genes.size > g.size * 1.1) {
          const d = Math.hypot(other.x - anim.x, other.y - anim.y);
          if (d < minTDist) { minTDist = d; threat = other; }
        }
      });

      if (threat) {
        this.aiMetrics.fleeEvents++;
        anim.state = 'fleeing';
        anim.stateLabel = 'Fugindo de Predador!';
        
        // Fadiga de fuga da presa: correr sem parar consome fôlego
        anim.fleeTicks = (anim.fleeTicks || 0) + 1;
        const fatigue = anim.fleeTicks > 40 ? Math.max(0.68, 1.0 - (anim.fleeTicks - 40) * 0.012) : 1.0;
        desiredSpeed = maxSpeed * fatigue;
        
        const angle = Math.atan2(anim.y - threat.y, anim.x - threat.x);
        // Suavização direcional da presa (impede teletransporte instantâneo de vetor)
        anim.vx = anim.vx * 0.50 + Math.cos(angle) * desiredSpeed * 0.50;
        anim.vy = anim.vy * 0.50 + Math.sin(angle) * desiredSpeed * 0.50;
        return;
      } else if (anim.fleeTicks > 0) {
        anim.fleeTicks = Math.max(0, anim.fleeTicks - 2);
      }
    }

    // 2. Busca por Alimento
    const hungerThreshold = isCarnivore ? (anim.maxEnergy * (this.equilibriumSettings?.predatorSatietyThreshold ?? 0.75)) : 85.0;
    if (anim.energy < hungerThreshold) {
      // A. Necrofagia
      // Herbívoros só buscam carcaças em desespero extremo (energia < 20).
      // Carnívoros buscam carcaças normalmente (energia < 85).
      const carcassHungerThreshold = isCarnivore ? 85.0 : 20.0;
      if ((g.diet?.carcass || 0) > 0.08 && anim.energy < carcassHungerThreshold) {
        // Só considera carcaças que já estejam próximas o suficiente para alimentação.
let bestCarcass = null, minCDist = Math.min(viewDist, 17.99);
        this.carcasses.forEach(c => {
          if (!c || c.remainingEnergy <= 0) return;

          const isConspecificCarcass = (c.speciesName === anim.speciesName);
          // Herbívoros NUNCA comem carcaças conspecíficas (repulsa instintiva).
          // Carnívoros evitam carcaças conspecíficas quando têm energia suficiente.
          if (isConspecificCarcass && (!isCarnivore || anim.energy >= 25.0)) return;

          const d = Math.hypot(c.x - anim.x, c.y - anim.y);
          if (d < minCDist) { minCDist = d; bestCarcass = c; }
        });

        if (bestCarcass) {
          this.aiMetrics.carcassTargets++;
          this.aiMetrics.carcassDistanceTotal += minCDist;
if (minCDist >= 18) this.aiMetrics.carcassFarTargets++;
this.aiMetrics.carcassMaxDistance = Math.max(this.aiMetrics.carcassMaxDistance, minCDist);
          targetX = bestCarcass.x;
          targetY = bestCarcass.y;
          desiredSpeed = maxSpeed * 0.7;
          anim.stateLabel = 'Comendo Carcaça';

          if (minCDist < 18) {
  this.aiMetrics.carcassMeals++;

  // Separa as refeições de carcaças por tipo de animal.
  if (isCarnivore) {
    this.aiMetrics.carnivoreCarcassMeals++;
  } else {
    this.aiMetrics.herbivoreCarcassMeals++;
  }

  anim.vx *= 0.1; anim.vy *= 0.1;
            const bite = Math.min(bestCarcass.remainingEnergy, 4.0);
            bestCarcass.remainingEnergy -= bite;

            if (bestCarcass.speciesName === anim.speciesName) {
              this.aiMetrics.prionInfections++;
              anim.isDiseased = true;
              anim.diseaseTimer = Math.min(320, (anim.diseaseTimer || 0) + 180);
              anim.stateLabel = '☣️ Canibalismo (Infectado por Príon!)';
              if (typeof toast === 'function' && Math.random() < 0.25) {
                toast(`☣️ ${anim.name} contraiu Príon por necro-canibalismo!`);
              }
            }

            // Converte 80% da energia consumida em energia aproveitável.
const absorbedEnergy = bite * 0.80;

anim.energy = Math.min(anim.maxEnergy, anim.energy + absorbedEnergy);
            return;
          }
        }
      }

      // B. Predação (com saciedade para evitar super-predação em cascata)
      // B. Predação (com saciedade para evitar super-predação em cascata)
      const satietyThreshold = anim.maxEnergy * (this.equilibriumSettings?.predatorSatietyThreshold ?? 0.65);
      const isCarnivoreAgent = (g.diet?.meat || 0) > 0.45;
      const isHungryCarnivore = isCarnivoreAgent && !targetX && anim.energy < satietyThreshold;

      if (isHungryCarnivore) {
        // Carnívoros caçam presas conforme tamanho e agressividade
        const sizeAdvantage = 1.15 + (g.aggression || 0.3) * 0.6;
        let bestPrey = null, minPDist = viewDist;
        let bestPreyScore = Infinity;

        this.animals.forEach(other => {
          if (other === anim) return;
          if (other.energy <= 0) return;
          if (other.genes.size > g.size * sizeAdvantage) return;

          // ✅ 1. Calcula a distância 'd' PRIMEIRO:
          const d = Math.hypot(other.x - anim.x, other.y - anim.y);
          if (d >= viewDist) return;

          // ✅ 2. Usa o cache trófico _herbivores (evita travar a CPU):
          const totalPreyCount = this._herbivores ? this._herbivores.length : 30;
          if (totalPreyCount < 30 && d > 45) return;

          const isSameSpecies = (other.speciesName === anim.speciesName);
          if (isSameSpecies && anim.energy >= 30.0) return;
          if ((other.genes.diet?.meat || 0) > 0.45 && other.genes.size > g.size * 1.05) return;

          // Prefere presas mais próximas e mais fatigadas/fracas
          const preyEnergyRatio = (other.energy || 0) / (other.maxEnergy || 100);
          const score = d + preyEnergyRatio * 40;
          if (score < bestPreyScore) { 
            bestPreyScore = score; 
            minPDist = d; 
            bestPrey = other; 
          }
        });

        if (bestPrey) {
          // Continua o restante do código normalmente...
          targetX = bestPrey.x;
          targetY = bestPrey.y;

          // BOTE / ARRANCADA (Sprint Burst): quando se aproxima a menos de 80px, dispara em arrancada
          const isPouncing = minPDist < 80;
          const sprintBoost = isPouncing 
            ? (1.38 + (g.speed || 0.5) * 0.22 + (g.aggression || 0.5) * 0.20) // Arrancada fatal: 1.4x a 1.7x!
            : 1.15; // Perseguição inicial firme

          desiredSpeed = maxSpeed * sprintBoost;
          anim.state = 'hunting';
          anim.stateLabel = isPouncing 
            ? `⚡ Bote em ${bestPrey.name}!` 
            : `🎯 Caçando ${bestPrey.name}`;

          // Manobra mais precisa e agressiva do predador focado na presa
          const angleToPrey = Math.atan2(targetY - anim.y, targetX - anim.x);
          anim.vx = anim.vx * 0.30 + Math.cos(angleToPrey) * desiredSpeed * 0.70;
          anim.vy = anim.vy * 0.30 + Math.sin(angleToPrey) * desiredSpeed * 0.70;

          // Raio de alcance do ataque
          const attackRange = 22 + (g.size || 0.5) * 26;
          if (minPDist < attackRange && anim.attackCooldown === 0) {
            anim.vx *= 0.1; anim.vy *= 0.1;
            const preyEnergy = Math.max(0, bestPrey.energy || 0);

            // Abate consumado
            bestPrey.carcassEnergy = preyEnergy * 0.25;
            bestPrey.energy = 0;

            if (bestPrey.speciesName === anim.speciesName) {
              this.aiMetrics.cannibalAttacks++;
              anim.isDiseased = true;
              anim.diseaseTimer = Math.min(350, (anim.diseaseTimer || 0) + 240);
              anim.stateLabel = '☣️ Canibalismo (Infectado por Príon!)';
              if (typeof toast === 'function') {
                toast(`☣️ Alerta: ${anim.name} cometeu canibalismo e contraiu Príon letal!`);
              }
            } else {
              this.aiMetrics.otherSpeciesKills++;
              if ((bestPrey.genes.diet?.meat || 0) > 0.45) {
                this.aiMetrics.carnivorePreyKills++;
              } else {
                this.aiMetrics.nonCarnivorePreyKills++;
              }
            }

            // BANQUETE NUTRITIVO REALISTA: A presa fornece biomassa garantida pelo seu porte físico!
            // Garante que o predador fique bem alimentado e com energia para viver e procriar.
            const preyMeatBiomass = 45.0 + (bestPrey.genes.size || 0.5) * 55.0;
            const mealCalories = Math.max(preyMeatBiomass, preyEnergy * 0.85);
            anim.energy = Math.min(anim.maxEnergy, anim.energy + mealCalories);
            anim.attackCooldown = 35; // Cooldown ágil para não ficar travado
            anim.stateLabel = `🍖 Banquete: abateu ${bestPrey.name}`;
            return;
          }
          return;
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
          this.aiMetrics.plantTargets = (this.aiMetrics.plantTargets || 0) + 1;
          targetX = bestPlant.x;
          targetY = bestPlant.y;
          desiredSpeed = maxSpeed * 0.65;
          anim.stateLabel = 'Pastando';

          if (minPlDist < 16) {
            this.aiMetrics.plantApproaches++;
            this.aiMetrics.herbivoreMeals++;
            anim.vx *= 0.1; anim.vy *= 0.1;

            // PRESSÃO COEVOLUTIVA: Espinhos/toxinas (defense) reduzem o dano e ferem o herbívoro
            const defenseFactor = Math.max(0.2, 1.0 - (bestPlant.genes.defense || 0) * 0.75);
            const biteAmount = Math.min(bestPlant.growth * 0.6, 0.28) * defenseFactor;

            // Se a planta é altamente armada, o herbívoro sofre dano de repulsa
            if ((bestPlant.genes.defense || 0) > 0.45) {
              const thornDamage = (bestPlant.genes.defense - 0.45) * 12.0;
              anim.energy = Math.max(1.0, anim.energy - thornDamage);
              anim.stateLabel = 'Repelido por Espinhos/Toxina!';
            }

            // Calcula a energia obtida com assimilação melhorada
            const calories = (Math.max(0.06, biteAmount) / 0.20) * (bestPlant.hasFruit ? 26.0 : 18.0);
            const absorbedEnergy = calories * 0.85;
            anim.energy = Math.min(anim.maxEnergy, anim.energy + absorbedEnergy);

            // ZOOCORIA: Comer fruto maduro transporta semente no intestino do animal
            if (bestPlant.hasFruit && Math.random() < (bestPlant.genes.fruitAttraction || 0.4)) {
              anim.carriedSeed = {
                speciesName: bestPlant.name,
                genes: JSON.parse(JSON.stringify(bestPlant.genes)),
                customImages: bestPlant.customImages,
                dropTimer: Math.round(25 + Math.random() * 40)
              };
            }

            // SOBREVIVÊNCIA E RESILIÊNCIA AO PASTOREIO (Raízes protegidas)
            const remainingGrowth = bestPlant.growth - biteAmount;
            // Só morre definitivamente se for comida abaixo de 0.03 e com reserva esgotada
            if (remainingGrowth < 0.03 && bestPlant.energy < 12.0) {
              const cell = this.grid[bestPlant.r]?.[bestPlant.c];
              if (cell && cell.plant === bestPlant) cell.plant = null;
              this.plantMetrics.grazingDeaths++;
              if (cell) {
                const remainingBiomass = Math.max(0, remainingGrowth) * 10.0;
                cell.organicBiomass = Math.min(80.0, cell.organicBiomass + remainingBiomass);
              }

              const pIdx = this.plants.indexOf(bestPlant);
              if (pIdx !== -1) this.plants.splice(pIdx, 1);
              anim.stateLabel = 'Arrancou raiz (Overgrazing)!';
            } else {
              // A planta fica podada e preserva a raiz para rebrotar com vigor
              bestPlant.growth = Math.max(0.05, remainingGrowth);
              bestPlant.hasFruit = false;
            }
            return;
          }
        }
      }
    }

        // 3. REPRODUÇÃO SEXUADA COM INÍCIO DE GESTAÇÃO (Desacoplamento por Nível Trófico)
    let totalCarnivores = 0;
    let totalHerbivores = 0;
    for (let i = 0; i < this.animals.length; i++) {
      if ((this.animals[i].genes?.diet?.meat || 0) > 0.45) totalCarnivores++;
      else totalHerbivores++;
    }

    const preyPerPredator = totalCarnivores > 0 ? (totalHerbivores / totalCarnivores) : 20.0;

    let reproductionFactor;
    if (isCarnivore) {
      // CARNÍVOROS (Regulação Lotka-Volterra por razão presa/predador):
      // Um ecossistema saudável mantém ~8 a 20 presas por predador.
      if (totalCarnivores < 4) {
        // População crítica: esforço de sobrevivência se houver presas mínimas
        reproductionFactor = totalHerbivores >= 8 ? 1.8 : 0.2;
      } else if (preyPerPredator < 5.0 || totalCarnivores >= 40) {
        // Superpredação ou saturação de carnívoros: trava natalidade de predadores
        reproductionFactor = 0.02;
      } else if (preyPerPredator < 8.0) {
        reproductionFactor = 0.25;
      } else if (totalCarnivores < 18) {
        reproductionFactor = 1.25;
      } else {
        reproductionFactor = 0.65;
      }
    } else {
      // HERBÍVOROS: Alta recuperação quando caem abaixo de 80
      reproductionFactor = totalHerbivores < 80
        ? 1.85
        : totalHerbivores < 260
          ? 1.15
          : totalHerbivores >= 400
            ? 0.0
            : 1.0 - ((totalHerbivores - 260) / 140);
    }

    const canStartReproduction = Math.random() < reproductionFactor;
    const reproEnergyThreshold = isCarnivore 
      ? (totalCarnivores < 20 ? 75.0 : 90.0)
      : 68.0;

    if (
      canStartReproduction &&
      anim.energy > reproEnergyThreshold &&
      anim.age > 45 &&
      anim.mateCooldown === 0 &&
      !anim.isDiseased &&
      !anim.isPregnant
    ) {
      // Carnívoros usam faro e uivos de longo alcance para rastrear parceiros no território
      const mateSearchRadius = isCarnivore 
        ? Math.max(viewDist * 4.0, 750) 
        : (viewDist * 1.2);
      let bestMate = null, minMDist = mateSearchRadius;

      this.animals.forEach(other => {
        const otherIsCarnivore = (other.genes.diet?.meat || 0) > 0.45;
        const otherReproThreshold = otherIsCarnivore 
          ? (totalCarnivores < 20 ? 70.0 : 85.0) 
          : 65.0;
        if (other === anim || other.energy <= otherReproThreshold * 0.85 || other.mateCooldown > 0 || other.isDiseased || other.isPregnant) return;

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
        desiredSpeed = maxSpeed * 0.85;
        anim.stateLabel = 'Buscando Parceiro';

        if (minMDist < 16) {
          anim.vx *= 0.1; anim.vy *= 0.1;
          // Custo de reprodução: carnívoros gastam mais, herbívoros menos (facilita recuperação)
          const mateCost = isCarnivore ? 24.0 : 16.0;
          anim.energy -= mateCost;
          bestMate.energy -= mateCost;

          anim.mateCooldown = 110;
          bestMate.mateCooldown = 110;

          const baseSpecies = anim.speciesName;
          const speciesData = this.speciesRegistry[baseSpecies] || {};
          const founderGenes = speciesData.founderGenes || g;
          const rootName = speciesData.rootName || baseSpecies.replace(/\s*(Gigante|Pigmeu|Tropical|Polar|Veloz|Robusto|Predador|Herbívoro)/g, '').trim();

                    const childGenes = {};

          // Reúne os genes presentes nos dois progenitores.
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

              childGenes.diet = mutateAndNormalizeDiet(avgDiet);
            } else {
              // Calcula a média dos genes dos dois progenitores.
              const geneA = g[k] ?? bestMate.genes[k] ?? 0.5;
              const geneB = bestMate.genes[k] ?? g[k] ?? 0.5;
              const avg = (geneA + geneB) / 2;

              const mutMul = this.equilibriumSettings?.mutationRateMultiplier ?? 1.0;
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

          const gestA = g.gestation ?? 0.45;
          const gestB = bestMate.genes?.gestation ?? 0.45;
          const offA = g.offspringCount ?? 0.45;
          const offB = bestMate.genes?.offspringCount ?? 0.45;

          let clutchSize;
          if (isCarnivore) {
            clutchSize = totalCarnivores < 20 ? 3 : (totalCarnivores < 40 ? 2 : (Math.random() < ((offA + offB) / 2) ? 2 : 1));
          } else {
            clutchSize = Math.random() < ((offA + offB) / 2) ? 2 : 1;
          }
          if (speciationCheck.diverged && clutchSize < 2) clutchSize = 2;

          anim.isPregnant = true;
          const gestFactor = (isCarnivore && totalCarnivores < 20) ? 0.70 : 1.0;
          anim.gestationTicks = Math.max(15, Math.round((28 + ((gestA + gestB) / 2) * 35) * gestFactor));
          anim.pregnantGenes = childGenes;
          anim.pregnantSpeciesName = finalSpeciesName;
          anim.pregnantClutchSize = clutchSize;
          anim.stateLabel = 'Iniciou Gestação';

          const mateCooldownVal = (isCarnivore && totalCarnivores < 20) ? 45 : 85;
          anim.mateCooldown = mateCooldownVal;
          bestMate.mateCooldown = mateCooldownVal;
          return;
        }
      }
    }

    if (targetX !== null && targetY !== null) {
      const angle = Math.atan2(targetY - anim.y, targetX - anim.x);
      anim.vx = anim.vx * 0.55 + Math.cos(angle) * desiredSpeed * 0.45;
      anim.vy = anim.vy * 0.55 + Math.sin(angle) * desiredSpeed * 0.45;
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
  // Impede a reinjeção quando a quantidade solicitada é inválida.
  if (!Number.isFinite(count) || count <= 0) return;

  // Recupera as espécies configuradas para o mundo.
  const speciesList = this.worldConfig?.speciesCounts?.animals;

  // Se existem espécies configuradas, utiliza seus dados genéticos.
  if (speciesList && speciesList.length > 0) {
    const availableSpecies = speciesList.filter(sp => 
      sp && sp.name && sp.genes
    );

    // Não há espécies válidas para reintroduzir.
    if (availableSpecies.length === 0) return;

    // Distribui a quantidade solicitada entre as espécies disponíveis.
    const baseCount = Math.floor(count / availableSpecies.length);
    const remainder = count % availableSpecies.length;

    availableSpecies.forEach((sp, index) => {
      const amount = baseCount + (index < remainder ? 1 : 0);

      // Adiciona os animais sem limpar a população existente.
      this.spawnSpeciesInClusters(
        sp.name,
        sp.genes,
        sp.customImages || {},
        amount
      );
    });

    return;
  }

  // Se não houver espécies configuradas, utiliza as espécies salvas.
  const savedAnimals = JSON.parse(
    localStorage.getItem('evo_animals') || '[]'
  );

  if (savedAnimals.length > 0) {
    const baseCount = Math.floor(count / savedAnimals.length);
    const remainder = count % savedAnimals.length;

    savedAnimals.forEach((sp, index) => {
      const amount = baseCount + (index < remainder ? 1 : 0);

      this.spawnSpeciesInClusters(
        sp.name,
        sp.genes,
        sp.customImages || {},
        amount
      );
    });

    return;
  }

  // Sem espécies salvas, utiliza as espécies padrão.
  const predCount = Math.max(1, Math.round(count * 0.25));
  const herbCount = count - predCount;

  const herbGenes = {
    size: 0.35,
    diet: { meat: 0.0, plant: 0.90, carcass: 0.10 },
    speed: 0.60,
    perception: 0.65,
    gestation: 0.30,
    offspringCount: 0.70,
    aggression: 0.10,
    health: 0.60,
    thermal: 0.0,
    colorHue: 125
  };

  const predGenes = {
    size: 0.65,
    diet: { meat: 0.85, plant: 0.05, carcass: 0.10 },
    speed: 0.70,
    perception: 0.80,
    gestation: 0.50,
    offspringCount: 0.35,
    aggression: 0.75,
    health: 0.60,
    thermal: 0.0,
    colorHue: 15
  };

  this.spawnSpeciesInClusters(
    'Herbívoro Campestre',
    herbGenes,
    {},
    herbCount
  );

  this.spawnSpeciesInClusters(
    'Predador Alfa',
    predGenes,
    {},
    predCount
  );
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

    // OTIMIZAÇÃO: Desenha o terreno do cache pré-renderizado (1 única operação de GPU)
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

    // ── VEGETAIS (Modo Simplificado vs Modo Detalhado) ──
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

    // ── ANIMAIS (Modo Simplificado vs Modo Detalhado) ──
    if (this.simplifiedSprites) {
      this.animals.forEach(anim => {
        try {
          const isCarn = (anim.genes?.diet?.meat || 0) > 0.45;
          const animSize = anim.genes?.size ?? 0.5;
          const r = Math.max(3.5, 4 + animSize * 7);

          // Cor pelo papel trófico
          if (isCarn) {
            ctx.fillStyle = '#f85149';
          } else {
            const hue = anim.genes?.colorHue ?? 120;
            ctx.fillStyle = `hsl(${hue}, 70%, 48%)`;
          }

          ctx.beginPath();
          ctx.arc(anim.x, anim.y, r, 0, Math.PI * 2);
          ctx.fill();

          // Vetor de direção da criatura
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

          // Mini barra de energia rápida
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
    // ── 4. FILTRO VISUAL CLIMÁTICO (Azulado para Frio / Amarelado para Calor) ──
    const effectiveTemp = SEASONS[this.seasonIndex].temp + (this.climateTrend || 0);
    if (Math.abs(effectiveTemp) > 0.12) {
      ctx.save();
      if (effectiveTemp < 0) {
        // Clima frio/glacial: névoa azul-gelo
        const coldAlpha = Math.min(0.24, Math.abs(effectiveTemp) * 0.20);
        ctx.fillStyle = `rgba(80, 160, 255, ${coldAlpha})`;
      } else {
        // Clima quente/árido: radiação dourada/âmbar
        const heatAlpha = Math.min(0.22, effectiveTemp * 0.18);
        ctx.fillStyle = `rgba(255, 170, 40, ${heatAlpha})`;
      }
      ctx.fillRect(0, 0, W, H);
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
    const effTemp = curSeason.temp + (this.climateTrend || 0);
    const tempDeg = Math.round(18 + effTemp * 16); // Temperatura em graus Celsius realistas
    if (elSeason) elSeason.innerHTML = `${curSeason.icon} ${curSeason.name} (${tempDeg}°C)`;
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