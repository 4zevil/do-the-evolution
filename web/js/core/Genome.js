// ====================================================
//  GENOME.JS — Genoma quantitativo de organismos vivos
// ====================================================

/**
 * Genoma quantitativo de organismos vivos.
 * Encapsula cálculo de distância genética, mutação e especiação.
 */
export class Genome {
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
