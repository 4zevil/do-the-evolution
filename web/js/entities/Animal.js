// ====================================================
//  ANIMAL.JS — Organismo Animal (Lei de Kleiber, termorregulação e IA)
// ====================================================

import { Organism } from './Organism.js';
import { Genome } from '../core/Genome.js';
import { Plant } from './Plant.js';

/**
 * Organismo Animal regido pela Lei de Kleiber, termorregulação e IA de caça/fuga.
 */
export class Animal extends Organism {
  constructor(id, name, speciesName, x, y, genes = {}, customImages = {}) {
    const genome = genes instanceof Genome ? genes : new Genome(genes);
    const meatRatio = genome.diet?.meat || 0.0;
    const initialEnergy = 90.0 + Math.random() * 10;
    const maxEnergy = 100.0 + meatRatio * 80.0;

    super(id, name, speciesName, x, y, initialEnergy, maxEnergy, genome, customImages);

    this.vx = (Math.random() - 0.5) * 1.5;
    this.vy = (Math.random() - 0.5) * 1.5;

    this.state = 'wandering';
    this.stateLabel = 'Forrageando';
    this.mateCooldown = 30;
    this.isSeekingMate = false;
    this.attackCooldown = 0;
    this.isDiseased = false;
    this.diseaseTimer = 0;
    this.isPregnant = false;
    this.gestationTicks = 0;
    this.pregnantGenes = null;
    this.pregnantSpeciesName = null;
    this.pregnantClutchSize = 1;
    this.carriedSeed = null;
    this.fleeTicks = 0;
    this.carcassEnergy = null;
    const baseLifespan = meatRatio > 0.45 ? (950 + (genome.size || 0.5) * 300) : (700 + (genome.size || 0.5) * 150);
    this.maxLifespan = Math.round(baseLifespan * (0.82 + Math.random() * 0.36));
  }

  calculateMetabolicCost(curSeason, inWater) {
    const g = this.genes;
    const curSpeed = Math.hypot(this.vx || 0, this.vy || 0);
    const massKg = 5.0 + (g.size || 0.5) * 70.0;
    const basalMetabolism = 0.06 * Math.pow(massKg / 40.0, 0.75);
    const locomotionCost = 0.04 * Math.pow(curSpeed / 2.0, 1.5);

    const meatRatio = g.diet?.meat || 0.0;
    this.maxEnergy = 100.0 + meatRatio * 80.0;
    const fastingEfficiency = 1.0 - meatRatio * 0.45;

    const tempDiff = Math.abs((g.thermal || 0.0) - curSeason.temp);
    const thermalFactor = 1.0 + (tempDiff > 0.4 ? 0.3 : 0.0) * curSeason.thermalCost;

    let totalCost = (basalMetabolism * fastingEfficiency + locomotionCost) * thermalFactor;

    const aquatic = g.aquatic ?? 0.15;
    if (inWater) {
      if (aquatic < 0.35) {
        totalCost += (0.35 - aquatic) * 0.30;
        this.vx *= 0.65;
        this.vy *= 0.65;
        this.stateLabel = 'Nadando com Esforço!';
      } else {
        totalCost *= 0.80;
      }
    } else {
      if (aquatic > 0.70) {
        totalCost += (aquatic - 0.70) * 0.25;
        this.vx *= 0.75;
        this.vy *= 0.75;
        this.stateLabel = 'Rastejando em Terra!';
      }
    }

    if (this.isDiseased) {
      this.diseaseTimer--;
      totalCost += 0.12;
      if (this.diseaseTimer <= 0) this.isDiseased = false;
    }

    if (this.isPregnant) {
      this.gestationTicks--;
      totalCost += 0.08;
    }

    if (meatRatio > 0.45 && this.energy < 28.0 && this.state !== 'hunting') {
      totalCost *= 0.65;
    }

    if (meatRatio > 0.45 && this.state !== 'hunting' && this.state !== 'fleeing') {
      totalCost *= 0.72;
    }

    return totalCost;
  }

  tick(curSeason, engine, newOffspring, deadAnimals) {
    this.ageOneTick();
    if (this.mateCooldown > 0) this.mateCooldown--;
    if (this.attackCooldown > 0) this.attackCooldown--;

    const curR = Math.max(0, Math.min(engine.gridRows - 1, Math.floor(this.y / engine.cellSize)));
    const curC = Math.max(0, Math.min(engine.gridCols - 1, Math.floor(this.x / engine.cellSize)));
    const inWater = engine.grid[curR]?.[curC]?.biome === 'water';

    const cost = this.calculateMetabolicCost(curSeason, inWater);

    // Gestação, abortos e partos
    if (this.isPregnant) {
      if (this.energy < 22.0) {
        this.isPregnant = false;
        this.pregnantGenes = null;
        this.stateLabel = '⚠️ Aborto por Inanição';
        if (typeof toast === 'function' && Math.random() < 0.18) {
          toast(`⚠️ ${this.name} sofreu aborto espontâneo por falta de comida!`);
        }
      } else if (this.gestationTicks <= 0) {
        this.isPregnant = false;
        const clutch = this.pregnantClutchSize || 1;
        const babyGenes = this.pregnantGenes || this.genes;
        const babySpeed = (0.5 + (babyGenes.speed || 0.5) * 1.5);

        for (let b = 0; b < clutch; b++) {
          const baby = new Animal(
            'anim_' + Math.random().toString(36).substr(2, 9),
            this.pregnantSpeciesName || this.speciesName,
            this.pregnantSpeciesName || this.speciesName,
            Math.max(10, Math.min((engine.gridCols * engine.cellSize) - 10, this.x + (Math.random() * 14 - 7))),
            Math.max(10, Math.min((engine.gridRows * engine.cellSize) - 10, this.y + (Math.random() * 14 - 7))),
            babyGenes,
            this.customImages
          );
          baby.vx = (Math.random() - 0.5) * babySpeed;
          baby.vy = (Math.random() - 0.5) * babySpeed;
          baby.energy = (babyGenes.diet?.meat || 0) > 0.45 ? 58.0 : 38.0;
          baby.stateLabel = 'Recém-nascido (Frágil)';
          baby.mateCooldown = 60;
          newOffspring.push(baby);
        }
        this.pregnantGenes = null;
        this.stateLabel = 'Deu à luz!';
      }
    }

    this.consumeEnergy(cost);

    const g = this.genes;
    const maxLifespan = this.maxLifespan || ((g.diet?.meat || 0) > 0.45 ? (950 + (g.size || 0.5) * 300) : (700 + (g.size || 0.5) * 150));

    if (this.energy <= 0 || this.age > maxLifespan) {
      if (engine.animalMetrics) {
        if (this.energy <= 0) engine.animalMetrics.energyDeaths++;
        else engine.animalMetrics.ageDeaths++;

        if (this.age < 50) engine.animalMetrics.juvenileDeaths++;
        else engine.animalMetrics.adultDeaths++;

        if (this.isDiseased) engine.animalMetrics.sickDeaths++;
        else engine.animalMetrics.healthyDeaths++;
      }

      this.alive = false;
      deadAnimals.push(this);
      return;
    }

    // Execução da IA e tomada de decisão
    this.updateAI(engine, newOffspring);

    this.x += this.vx;
    this.y += this.vy;

    // Dispersão zoocórica de sementes ingeridas
    if (this.carriedSeed) {
      this.carriedSeed.dropTimer--;
      if (this.carriedSeed.dropTimer <= 0) {
        const ar = Math.floor(this.y / engine.cellSize);
        const ac = Math.floor(this.x / engine.cellSize);
        const targetCell = engine.grid[ar]?.[ac];

        if (targetCell && targetCell.biome !== 'water' && !targetCell.plant && engine.plants.length < engine.gridCols * engine.gridRows * 0.70) {
          const baseName = this.carriedSeed.speciesName;
          const speciesData = engine.speciesRegistry[baseName] || {};
          const founderGenes = speciesData.founderGenes || this.carriedSeed.genes;
          const rootName = speciesData.rootName || baseName.replace(/\s*(Espinhosa|Indefesa|Gigante|Rasteira|Árida|Aquática|Pioneira|Tardia|Tropical|Boreal)/g, '').trim();

          const speciation = Genome.evaluatePlantSpeciation(this.carriedSeed.genes, founderGenes);
          let childSpeciesName = baseName;

          if (speciation.diverged) {
            childSpeciesName = rootName + ' ' + speciation.desc;
            const isNew = engine.registerSpecies(
              childSpeciesName,
              'plant',
              this.carriedSeed.genes,
              baseName,
              rootName,
              speciation.traitName + ' ' + speciation.desc
            );
            if (isNew && typeof toast === 'function') {
              toast('🌿 Nova Linhagem Vegetal (Zoocoria): "' + childSpeciesName + '" germinou após dispersão animal!');
            }
          }

          const seedPlant = new Plant(
            'plant_' + Math.random().toString(36).substr(2, 9),
            childSpeciesName,
            ar, ac,
            engine.cellSize,
            this.carriedSeed.genes || {},
            this.carriedSeed.customImages || {}
          );
          seedPlant.growth = 0.22;
          seedPlant.energy = 40.0;
          targetCell.plant = seedPlant;
          targetCell.addOrganicBiomass(5.0);
          engine.plants.push(seedPlant);
          if (engine.plantMetrics) engine.plantMetrics.reproduced++;
        }
        this.carriedSeed = null;
      }
    }

    const margin = 12;
    const maxX = engine.gridCols * engine.cellSize - margin;
    const maxY = engine.gridRows * engine.cellSize - margin;
    this.clampToBounds(margin, maxX, maxY);
  }

  updateAI(engine, newOffspring) {
    const g = this.genes;
    const isCarnivore = (g.diet?.meat || 0) > 0.45;

    const hungerRatio = Math.max(0, 1.0 - (this.energy / this.maxEnergy));
    const hungerVisionBonus = isCarnivore ? (1.0 + hungerRatio * 0.5) : 1.0;
    const viewDist = (45 + g.perception * 130) * (isCarnivore ? 1.4 : 1.0) * hungerVisionBonus;

    const speedPenalty = this.isDiseased ? 0.65 : (this.isPregnant ? 0.82 : 1.0);
    const curR = Math.max(0, Math.min(engine.gridRows - 1, Math.floor(this.y / engine.cellSize)));
    const curC = Math.max(0, Math.min(engine.gridCols - 1, Math.floor(this.x / engine.cellSize)));
    const inWater = engine.grid[curR]?.[curC]?.biome === 'water';
    const aquatic = g.aquatic ?? 0.15;

    const terrainSpeedFactor = inWater
      ? (0.30 + aquatic * 0.90)
      : (1.10 - aquatic * 0.55);

    const maxSpeed = (0.7 + g.speed * 2.2) * speedPenalty * terrainSpeedFactor;

    let targetX = null, targetY = null;
    let desiredSpeed = maxSpeed * 0.45;
    this.stateLabel = this.isDiseased
      ? `☣️ Infectado (${this.diseaseTimer}t)`
      : (this.isPregnant ? `🤰 Gestante (${this.gestationTicks}t)` : 'Forrageando');

    // 1. Fuga de Predadores
    if (!isCarnivore) {
      const fleePerceptionBonus = (g.perception ?? 0.5) * 60.0 * (engine.equilibriumSettings?.fleePerceptionFactor ?? 1.0);
      const maxFleeDist = Math.min(viewDist, 32.0 + fleePerceptionBonus);
      let threat = null, minTDist = maxFleeDist;
      engine.animals.forEach(other => {
        if (other !== this && (other.genes.diet?.meat || 0) > 0.45 && other.genes.size > g.size * 1.1) {
          const d = Math.hypot(other.x - this.x, other.y - this.y);
          if (d < minTDist) { minTDist = d; threat = other; }
        }
      });

      if (threat) {
        if (engine.aiMetrics) engine.aiMetrics.fleeEvents++;
        this.state = 'fleeing';
        this.isSeekingMate = false;
        this.stateLabel = 'Fugindo de Predador!';
        this.fleeTicks = (this.fleeTicks || 0) + 1;
        const burst = this.fleeTicks < 25 ? 1.22 : 1.0;
        const fatigue = this.fleeTicks > 45 ? Math.max(0.72, 1.0 - (this.fleeTicks - 45) * 0.012) : 1.0;
        desiredSpeed = maxSpeed * burst * fatigue;

        const angle = Math.atan2(this.y - threat.y, this.x - threat.x);
        this.vx = this.vx * 0.50 + Math.cos(angle) * desiredSpeed * 0.50;
        this.vy = this.vy * 0.50 + Math.sin(angle) * desiredSpeed * 0.50;
        return;
      } else if (this.fleeTicks > 0) {
        this.fleeTicks = Math.max(0, this.fleeTicks - 2);
      }
    }

    // 2. Busca por Alimento
    const hungerThreshold = isCarnivore ? (this.maxEnergy * (engine.equilibriumSettings?.predatorSatietyThreshold ?? 0.75)) : 85.0;
    if (this.energy < hungerThreshold) {
      // A. Necrofagia
      const carcassHungerThreshold = isCarnivore ? 85.0 : 20.0;
      if ((g.diet?.carcass || 0) > 0.08 && this.energy < carcassHungerThreshold) {
        let bestCarcass = null, minCDist = Math.min(viewDist, 17.99);
        engine.carcasses.forEach(c => {
          if (!c || c.remainingEnergy <= 0) return;
          const isConspecificCarcass = (c.speciesName === this.speciesName);
          if (isConspecificCarcass && (!isCarnivore || this.energy >= 25.0)) return;

          const d = Math.hypot(c.x - this.x, c.y - this.y);
          if (d < minCDist) { minCDist = d; bestCarcass = c; }
        });

        if (bestCarcass) {
          if (engine.aiMetrics) {
            engine.aiMetrics.carcassTargets++;
            engine.aiMetrics.carcassDistanceTotal += minCDist;
            if (minCDist >= 18) engine.aiMetrics.carcassFarTargets++;
            engine.aiMetrics.carcassMaxDistance = Math.max(engine.aiMetrics.carcassMaxDistance, minCDist);
          }
          targetX = bestCarcass.x;
          targetY = bestCarcass.y;
          desiredSpeed = maxSpeed * 0.7;
          this.stateLabel = 'Comendo Carcaça';

          if (minCDist < 18) {
            if (engine.aiMetrics) {
              engine.aiMetrics.carcassMeals++;
              if (isCarnivore) engine.aiMetrics.carnivoreCarcassMeals++;
              else engine.aiMetrics.herbivoreCarcassMeals++;
            }
            this.vx *= 0.1; this.vy *= 0.1;
            const bite = bestCarcass.consumeBite(4.0);

            if (bestCarcass.speciesName === this.speciesName && Math.random() < 0.40) {
              if (engine.aiMetrics) engine.aiMetrics.prionInfections++;
              this.isDiseased = true;
              this.diseaseTimer = Math.min(200, (this.diseaseTimer || 0) + 120);
              this.stateLabel = '☣️ Canibalismo (Infectado por Príon!)';
              if (typeof toast === 'function' && Math.random() < 0.25) {
                toast(`☣️ ${this.name} contraiu Príon por necro-canibalismo!`);
              }
            }

            this.gainEnergy(bite * 0.80);
            return;
          }
        }
      }

      // B. Predação
      const satietyThreshold = this.maxEnergy * (engine.equilibriumSettings?.predatorSatietyThreshold ?? 0.52);
      const isCarnivoreAgent = (g.diet?.meat || 0) > 0.45;
      const isHungryCarnivore = isCarnivoreAgent && !targetX && this.energy < satietyThreshold;

      if (isHungryCarnivore) {
        const sizeAdvantage = 1.15 + (g.aggression || 0.3) * 0.6;
        let bestPrey = null, minPDist = viewDist;

        engine.animals.forEach(other => {
          if (other === this || !other.alive) return;
          const isSameSpecies = (other.speciesName === this.speciesName);
          const isOtherCarnivore = (other.genes.diet?.meat || 0) > 0.45;
          if (isSameSpecies && this.energy >= 20.0) return;

          const mySize = g.size || 0.5;
          const preySize = other.genes.size || 0.5;
          const isTargetVulnerable = (mySize * sizeAdvantage) > preySize;

          if (isTargetVulnerable || this.energy < 25.0) {
            const d = Math.hypot(other.x - this.x, other.y - this.y);
            if (d < minPDist) {
              minPDist = d;
              bestPrey = other;
            }
          }
        });

        if (bestPrey) {
          targetX = bestPrey.x;
          targetY = bestPrey.y;
          this.state = 'hunting';
          this.stateLabel = 'Caçando Presa!';
          desiredSpeed = maxSpeed * 1.05;

          if (minPDist < 22 && this.attackCooldown === 0) {
            this.attackCooldown = 15;
            this.vx *= 0.2; this.vy *= 0.2;

            const predAggro = (g.aggression || 0.3);
            const preyHealth = (bestPrey.genes.health || 0.5);
            const mySize = (g.size || 0.5);
            const preySize = (bestPrey.genes.size || 0.5);

            const damage = (28.0 + predAggro * 35.0) * (mySize / Math.max(0.2, preySize));
            bestPrey.energy -= damage;

            if (bestPrey.energy <= 0) {
              bestPrey.alive = false;
              if (engine.aiMetrics) {
                if (bestPrey.speciesName === this.speciesName) engine.aiMetrics.cannibalAttacks++;
                else engine.aiMetrics.otherSpeciesKills++;
                if ((bestPrey.genes.diet?.meat || 0) > 0.45) engine.aiMetrics.carnivorePreyKills++;
                else engine.aiMetrics.nonCarnivorePreyKills++;
              }

              const meatGain = (35.0 + preySize * 45.0) * 0.65;
              this.gainEnergy(meatGain);
              bestPrey.carcassEnergy = (35.0 + preySize * 45.0) * 0.35;
              this.stateLabel = 'Abateu Presa!';
              return;
            } else {
              this.stateLabel = 'Atacando Presa!';
              bestPrey.vx += (this.vx * 1.5);
              bestPrey.vy += (this.vy * 1.5);
            }
          }
        }
      }

      // C. Herbivoria
      if (!targetX && (g.diet?.plant || 0) > 0.15 && engine.plants.length > 0) {
        let bestPlant = null, minPlDist = viewDist;
        engine.plants.forEach(p => {
          if (!p || p.growth < 0.15) return;
          const d = Math.hypot(p.x - this.x, p.y - this.y);
          if (d < minPlDist) { minPlDist = d; bestPlant = p; }
        });

        if (bestPlant) {
          if (engine.aiMetrics) engine.aiMetrics.plantTargets = (engine.aiMetrics.plantTargets || 0) + 1;
          targetX = bestPlant.x;
          targetY = bestPlant.y;
          desiredSpeed = maxSpeed * 0.65;
          this.stateLabel = 'Pastando';

          if (minPlDist < 16) {
            if (engine.aiMetrics) {
              engine.aiMetrics.plantApproaches++;
              engine.aiMetrics.herbivoreMeals++;
            }
            this.vx *= 0.1; this.vy *= 0.1;

            const plantDef = bestPlant.genes?.defense || 0;
            const defenseFactor = Math.max(0.18, 1.0 - plantDef * 0.75);
            const biteAmount = Math.min(bestPlant.growth * 0.65, 0.30) * defenseFactor;

            if (plantDef > 0.40) {
              const thornDamage = (plantDef - 0.40) * 14.0;
              this.energy = Math.max(1.0, this.energy - thornDamage);
              this.stateLabel = 'Repelido por Espinhos/Toxina!';
            }

            const calories = (Math.max(0.06, biteAmount) / 0.20) * (bestPlant.hasFruit ? 26.0 : 18.0);
            this.gainEnergy(calories * 0.85);

            bestPlant.energy -= biteAmount * 16.0;

            if (bestPlant.hasFruit && Math.random() < (bestPlant.genes?.fruitAttraction || 0.4)) {
              const mutMul = engine.equilibriumSettings?.mutationRateMultiplier ?? 1.0;
              const seedGenes = {};
              const bg = bestPlant.genes || {};
              const allGeneKeys = ['height', 'rootEfficiency', 'growthSpeed', 'defense', 'fruitAttraction', 'parasiteResistance', 'thermal', 'colorHue'];

              allGeneKeys.forEach(k => {
                const val = bg[k] ?? (k === 'colorHue' ? 110 : (k === 'thermal' ? 0.0 : 0.5));
                if (k === 'colorHue') {
                  seedGenes[k] = Math.round((val + (Math.random() * 26 - 13) * mutMul + 360) % 360);
                } else if (k === 'thermal') {
                  seedGenes[k] = parseFloat(Math.max(-1.0, Math.min(1.0, val + (Math.random() * 0.12 - 0.06) * mutMul)).toFixed(2));
                } else {
                  seedGenes[k] = parseFloat(Math.max(0.05, Math.min(1.0, val + (Math.random() * 0.12 - 0.06) * mutMul)).toFixed(2));
                }
              });

              this.carriedSeed = {
                speciesName: bestPlant.name,
                genes: seedGenes,
                customImages: bestPlant.customImages,
                dropTimer: Math.round(20 + Math.random() * 35)
              };
            }

            const remainingGrowth = bestPlant.growth - biteAmount;
            if (remainingGrowth < 0.08 || bestPlant.energy <= 4.0) {
              const cell = engine.grid[bestPlant.r]?.[bestPlant.c];
              if (cell && cell.plant === bestPlant) cell.plant = null;
              if (engine.plantMetrics) engine.plantMetrics.grazingDeaths++;
              if (cell) {
                cell.addOrganicBiomass(Math.max(0, remainingGrowth) * 8.0);
              }
              const pIdx = engine.plants.indexOf(bestPlant);
              if (pIdx !== -1) engine.plants.splice(pIdx, 1);
              this.stateLabel = 'Arrancou raiz (Overgrazing)!';
            } else {
              bestPlant.growth = Math.max(0.06, remainingGrowth);
              bestPlant.hasFruit = false;
            }
            return;
          }
        }
      }
    }

    // 3. REPRODUÇÃO SEXUADA COM INÍCIO DE GESTAÇÃO
    let totalCarnivores = 0;
    let totalHerbivores = 0;
    for (let i = 0; i < engine.animals.length; i++) {
      if ((engine.animals[i].genes?.diet?.meat || 0) > 0.45) totalCarnivores++;
      else totalHerbivores++;
    }

    const preyPerPredator = totalCarnivores > 0 ? (totalHerbivores / totalCarnivores) : 20.0;
    let reproductionFactor;
    if (isCarnivore) {
      if (totalCarnivores <= 3) {
        // Resgate reprodutivo para evitar extinção do topo da cadeia
        reproductionFactor = totalHerbivores >= 5 ? 0.85 : 0.25;
      } else if (totalCarnivores >= 15 || totalCarnivores > totalHerbivores * 0.18 || preyPerPredator < 3.0) {
        // Teto de capacidade de suporte de predadores (evita superpopulação)
        reproductionFactor = 0.0;
      } else if (preyPerPredator < 5.0 || totalCarnivores >= 10) {
        reproductionFactor = 0.18;
      } else if (preyPerPredator >= 8.0) {
        reproductionFactor = 0.60;
      } else {
        reproductionFactor = 0.35;
      }
    } else {
      reproductionFactor = totalHerbivores < 35
        ? 1.60
        : totalHerbivores < 70
          ? 1.15
          : totalHerbivores < 120
            ? 0.65
            : totalHerbivores < 160
              ? 0.20
              : 0.01;
    }

    if (reproductionFactor === 0.0) {
      this.isSeekingMate = false;
    } else if (this.isSeekingMate && (this.energy < 55.0 || this.mateCooldown > 0)) {
      this.isSeekingMate = false;
    }

    const canStartReproduction = reproductionFactor > 0 && (this.isSeekingMate || Math.random() < reproductionFactor);
    const reproEnergyThreshold = isCarnivore ? 78.0 : 62.0;

    if (
      canStartReproduction &&
      this.energy > reproEnergyThreshold &&
      this.age > 40 &&
      this.mateCooldown === 0 &&
      !this.isDiseased &&
      !this.isPregnant
    ) {
      const mateSearchRadius = isCarnivore
        ? Math.max(viewDist * 4.0, 750)
        : (viewDist * 1.2);
      let bestMate = null, minMDist = mateSearchRadius;

      engine.animals.forEach(other => {
        const otherIsCarnivore = (other.genes.diet?.meat || 0) > 0.45;
        const otherReproThreshold = otherIsCarnivore
          ? (totalCarnivores < 20 ? 70.0 : 85.0)
          : 65.0;
        if (other === this || other.energy <= otherReproThreshold * 0.85 || other.mateCooldown > 0 || other.isDiseased || other.isPregnant) return;

        const genDist = Genome.getGeneticDistance(this.genes, other.genes);
        let isCompatible = false;
        if (other.speciesName === this.speciesName || genDist < 0.14) {
          isCompatible = true;
        }
        if (genDist >= 0.28) {
          isCompatible = false;
        }

        if (isCompatible) {
          const d = Math.hypot(other.x - this.x, other.y - this.y);
          if (d < minMDist) { minMDist = d; bestMate = other; }
        }
      });

      if (bestMate) {
        targetX = bestMate.x;
        targetY = bestMate.y;
        desiredSpeed = maxSpeed * 0.85;
        this.isSeekingMate = true;
        this.stateLabel = 'Buscando Parceiro';

        if (minMDist < 16) {
          this.vx *= 0.1; this.vy *= 0.1;
          const mateCost = isCarnivore ? 24.0 : 16.0;
          this.energy -= mateCost;
          bestMate.energy -= mateCost;

          this.isSeekingMate = false;
          bestMate.isSeekingMate = false;
          this.mateCooldown = 110;
          bestMate.mateCooldown = 110;

          const baseSpecies = this.speciesName;
          const speciesData = engine.speciesRegistry[baseSpecies] || {};
          const founderGenes = speciesData.founderGenes || g;
          const rootName = speciesData.rootName || baseSpecies.replace(/\s*(Gigante|Pigmeu|Tropical|Polar|Veloz|Robusto|Predador|Herbívoro)/g, '').trim();

          const childGenes = {};
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
              childGenes.diet = Genome.mutateAndNormalizeDiet(avgDiet);
            } else {
              const geneA = g[k] ?? bestMate.genes[k] ?? 0.5;
              const geneB = bestMate.genes[k] ?? g[k] ?? 0.5;
              const avg = (geneA + geneB) / 2;

              const mutMul = engine.equilibriumSettings?.mutationRateMultiplier ?? 1.0;
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

          const speciationCheck = Genome.evaluateAnimalSpeciation(childGenes, founderGenes);
          let finalSpeciesName = baseSpecies;

          if (speciationCheck.diverged) {
            finalSpeciesName = `${rootName} ${speciationCheck.desc}`;
            const isNew = engine.registerSpecies(
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
            clutchSize = (preyPerPredator >= 12 && totalCarnivores < 6) ? 2 : 1;
          } else {
            clutchSize = (totalHerbivores < 60 && Math.random() < 0.6) ? 2 : 1;
          }
          if (speciationCheck.diverged && clutchSize < 2) clutchSize = 2;

          this.isPregnant = true;
          const gestFactor = isCarnivore ? 1.25 : (totalHerbivores < 60 ? 0.80 : 1.0);
          this.gestationTicks = Math.max(15, Math.round((28 + ((gestA + gestB) / 2) * 35) * gestFactor));
          this.pregnantGenes = childGenes;
          this.pregnantSpeciesName = finalSpeciesName;
          this.pregnantClutchSize = clutchSize;
          this.stateLabel = 'Iniciou Gestação';

          const mateCooldownVal = isCarnivore ? 160 : (totalHerbivores < 60 ? 60 : 85);
          this.mateCooldown = mateCooldownVal;
          bestMate.mateCooldown = mateCooldownVal;
          return;
        }
      }
    }

    if (targetX !== null && targetY !== null) {
      const angle = Math.atan2(targetY - this.y, targetX - this.x);
      this.vx = this.vx * 0.55 + Math.cos(angle) * desiredSpeed * 0.45;
      this.vy = this.vy * 0.55 + Math.sin(angle) * desiredSpeed * 0.45;
    } else {
      if (Math.random() < 0.07) {
        const randAngle = Math.random() * Math.PI * 2;
        this.vx = Math.cos(randAngle) * desiredSpeed;
        this.vy = Math.sin(randAngle) * desiredSpeed;
      }
    }
  }
}
