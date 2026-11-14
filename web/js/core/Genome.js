// ====================================================
//  GENOME.JS — Genoma quantitativo de organismos vivos
// ====================================================

/**
 * Genoma quantitativo de organismos vivos.
 * Encapsula cálculo de distância genética, mutação e especiação.
 */
export class Genome {
  static SPECIATION_DISTANCE_THRESHOLD = 0.28;
  static PLANT_SPECIATION_DISTANCE_THRESHOLD = 0.28;
  static MATE_COMPATIBILITY_THRESHOLD = 0.14;
  static MATE_INCOMPATIBILITY_THRESHOLD = 0.28;

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

  static getGeneticDistance(genesA = {}, genesB = {}) {
    const defaults = {
      size: 0.5,
      speed: 0.5,
      perception: 0.5,
      gestation: 0.4,
      offspringCount: 0.4,
      aggression: 0.3,
      health: 0.5,
      aquatic: 0.15
    };
    const keys = Object.keys(defaults);
    let sumSq = 0;

    keys.forEach(k => {
      const def = defaults[k];
      const diff = (genesA[k] ?? def) - (genesB[k] ?? def);
      sumSq += diff * diff;
    });

    // Normaliza amplitude [-1, 1] -> [0, 1] dividindo por 2
    const thermalDiff = ((genesA.thermal ?? 0.0) - (genesB.thermal ?? 0.0)) / 2.0;
    sumSq += thermalDiff * thermalDiff;

    const dietA = genesA.diet || { meat: 0.05, plant: 0.85, carcass: 0.10 };
    const dietB = genesB.diet || { meat: 0.05, plant: 0.85, carcass: 0.10 };
    const dietDiffMeat = (dietA.meat ?? 0) - (dietB.meat ?? 0);
    const dietDiffPlant = (dietA.plant ?? 0) - (dietB.plant ?? 0);
    const dietDiffCarcass = (dietA.carcass ?? 0) - (dietB.carcass ?? 0);
    sumSq += (dietDiffMeat * dietDiffMeat + dietDiffPlant * dietDiffPlant + dietDiffCarcass * dietDiffCarcass);

    return Math.sqrt(sumSq / (keys.length + 4));
  }

  static getPlantGeneticDistance(genesA = {}, genesB = {}) {
    const defaults = {
      height: 0.5,
      rootEfficiency: 0.5,
      growthSpeed: 0.5,
      defense: 0.3,
      fruitAttraction: 0.4,
      parasiteResistance: 0.4
    };
    const keys = Object.keys(defaults);
    let sumSq = 0;

    keys.forEach(k => {
      const def = defaults[k];
      const diff = (genesA[k] ?? def) - (genesB[k] ?? def);
      sumSq += diff * diff;
    });

    const thermalDiff = ((genesA.thermal ?? 0.0) - (genesB.thermal ?? 0.0)) / 2.0;
    sumSq += thermalDiff * thermalDiff;

    return Math.sqrt(sumSq / (keys.length + 1));
  }

  static createSpeciationMetadata(context = {}, distance = 0, threshold = Genome.SPECIATION_DISTANCE_THRESHOLD) {
    return {
      parentSpeciesId: context.parentSpeciesId ?? context.ancestorId ?? context.ancestor ?? null,
      originTick: context.originTick ?? 0,
      originBiome: context.originBiome ?? null,
      distance: parseFloat(distance.toFixed(4)),
      threshold
    };
  }

  static evaluateAnimalSpeciation(childGenes = {}, founderGenes = {}, context = {}) {
    const distance = Genome.getGeneticDistance(childGenes, founderGenes);
    const threshold = context.threshold ?? Genome.SPECIATION_DISTANCE_THRESHOLD;

    const traits = [
      { key: 'size', name: 'Porte', threshold: 0.28 },
      { key: 'speed', name: 'Velocidade', threshold: 0.28 },
      { key: 'perception', name: 'Visão', threshold: 0.30 },
      { key: 'thermal', name: 'Clima', threshold: 0.35 },
      { key: 'aquatic', name: 'Habitat', threshold: 0.35 }
    ];

    const dietMeatDiff = Math.abs((childGenes.diet?.meat ?? 0) - (founderGenes.diet?.meat ?? 0));
    if (dietMeatDiff >= 0.28) {
      const desc = (childGenes.diet?.meat ?? 0) > (founderGenes.diet?.meat ?? 0) ? 'Predador' : 'Herbívoro';
      return {
        diverged: true,
        traitName: 'Dieta',
        desc,
        ...Genome.createSpeciationMetadata(context, distance, threshold)
      };
    }

    for (const t of traits) {
      const valChild = childGenes[t.key] ?? 0;
      const valFounder = founderGenes[t.key] ?? 0;
      const diff = Math.abs(valChild - valFounder);
      if (diff >= t.threshold) {
        let desc = valChild > valFounder ? 'Superior' : 'Reduzido';
        if (t.key === 'size') desc = valChild > valFounder ? 'Gigante' : 'Pigmeu';
        if (t.key === 'thermal') desc = valChild > valFounder ? 'Tropical' : 'Polar';
        if (t.key === 'speed') desc = valChild > valFounder ? 'Veloz' : 'Robusto';
        if (t.key === 'aquatic') desc = valChild > valFounder ? 'Aquático' : 'Terrestre';
        return {
          diverged: true,
          traitName: t.name,
          desc,
          ...Genome.createSpeciationMetadata(context, distance, threshold)
        };
      }
    }

    if (distance >= threshold) {
      const desc = (childGenes.diet?.meat ?? 0) > 0.5 ? 'Predador' : 'Herbívoro';
      return {
        diverged: true,
        traitName: 'Genoma Geral',
        desc,
        ...Genome.createSpeciationMetadata(context, distance, threshold)
      };
    }

    return {
      diverged: false,
      distance: parseFloat(distance.toFixed(4)),
      threshold
    };
  }

  static evaluatePlantSpeciation(childGenes = {}, founderGenes = {}, context = {}) {
    const distance = Genome.getPlantGeneticDistance(childGenes, founderGenes);
    const threshold = context.threshold ?? Genome.PLANT_SPECIATION_DISTANCE_THRESHOLD;

    const traits = [
      { key: 'defense', name: 'Defesa', threshold: 0.28, high: 'Espinhosa', low: 'Indefesa' },
      { key: 'height', name: 'Porte', threshold: 0.28, high: 'Gigante', low: 'Rasteira' },
      { key: 'rootEfficiency', name: 'Raiz', threshold: 0.30, high: 'Árida', low: 'Aquática' },
      { key: 'growthSpeed', name: 'Ciclo', threshold: 0.28, high: 'Pioneira', low: 'Tardia' },
      { key: 'thermal', name: 'Clima', threshold: 0.32, high: 'Tropical', low: 'Boreal' }
    ];

    for (const t of traits) {
      const diff = (childGenes[t.key] ?? 0) - (founderGenes[t.key] ?? 0);
      if (Math.abs(diff) >= t.threshold) {
        const desc = diff > 0 ? t.high : t.low;
        return {
          diverged: true,
          traitName: t.name,
          desc,
          ...Genome.createSpeciationMetadata(context, distance, threshold)
        };
      }
    }

    if (distance >= threshold) {
      const desc = (childGenes.defense ?? 0.3) > 0.5 ? 'Espinhosa' : 'Pioneira';
      return {
        diverged: true,
        traitName: 'Genoma Geral',
        desc,
        ...Genome.createSpeciationMetadata(context, distance, threshold)
      };
    }

    return {
      diverged: false,
      distance: parseFloat(distance.toFixed(4)),
      threshold
    };
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
