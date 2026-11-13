// ====================================================
//  METEORSYSTEM.JS — Sistema de impacto de meteoros
// ====================================================

import { Carcass } from '../entities/Carcass.js';

export class MeteorSystem {
  constructor(engine) {
    this.engine = engine;
  }

  triggerMeteor(targetX = null, targetY = null) {
    const engine = this.engine;
    if (targetX === null || targetY === null) {
      if (engine.animals.length > 0 && Math.random() < 0.75) {
        const targetAnim = engine.animals[Math.floor(Math.random() * engine.animals.length)];
        targetX = targetAnim.x + (Math.random() * 40 - 20);
        targetY = targetAnim.y + (Math.random() * 40 - 20);
      } else {
        targetX = (0.2 + Math.random() * 0.6) * (engine.gridCols * engine.cellSize);
        targetY = (0.2 + Math.random() * 0.6) * (engine.gridRows * engine.cellSize);
      }
    }

    targetX = Math.max(25, Math.min(engine.gridCols * engine.cellSize - 25, targetX));
    targetY = Math.max(25, Math.min(engine.gridRows * engine.cellSize - 25, targetY));

    engine.disasterEffects ??= [];
    const meteorEffect = {
      type: 'meteor',
      phase: 'falling',
      startX: targetX - 260,
      startY: targetY - 360,
      targetX: targetX,
      targetY: targetY,
      progress: 0,
      fallSpeed: 0.065,
      explosionAge: 0,
      maxExplosionAge: 55,
      particles: [],
      shockwaveRadius: 0,
      maxShockwaveRadius: 220,
      craterRadiusPx: 90,
      executedImpact: false
    };

    for (let i = 0; i < 120; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3.0 + Math.random() * 11.0;
      meteorEffect.particles.push({
        x: targetX,
        y: targetY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2.5 + Math.random() * 5.5,
        color: Math.random() < 0.4 ? '#ff5722' : (Math.random() < 0.5 ? '#ffeb3b' : (Math.random() < 0.5 ? '#ffffff' : '#ff9800')),
        life: 1.0,
        decay: 0.012 + Math.random() * 0.025
      });
    }

    engine.disasterEffects.push(meteorEffect);

    if (typeof toast === 'function') {
      toast('☄️ CATÁSTROFE: Meteoro penetrou na atmosfera em direção ao quadrante!');
    }
  }

  applyMeteorPhysicalImpact(effect) {
    const engine = this.engine;
    const targetX = effect.targetX;
    const targetY = effect.targetY;
    const craterCellRadius = 4.5;
    const shockRadiusPx = effect.maxShockwaveRadius || 220;

    let destroyedPlants = 0;
    let vaporizedAnimals = 0;
    let damagedAnimals = 0;

    for (let r = 0; r < engine.gridRows; r++) {
      for (let c = 0; c < engine.gridCols; c++) {
        const cell = engine.grid[r]?.[c];
        if (!cell) continue;

        const cellCenterX = (c + 0.5) * engine.cellSize;
        const cellCenterY = (r + 0.5) * engine.cellSize;
        const dist = Math.hypot(cellCenterX - targetX, cellCenterY - targetY);
        const distInCells = dist / engine.cellSize;

        if (distInCells <= craterCellRadius) {
          // Cratera: vira rocky, perde todo nutriente
          cell.biome = 'rocky';
          cell.soilNitrogen = 0;
          cell.moisture = 0;
          cell.organicBiomass = 0;
          cell.addOrganicBiomass(5.0);

          if (cell.plant) {
            const pIdx = engine.plants.indexOf(cell.plant);
            if (pIdx !== -1) engine.plants.splice(pIdx, 1);
            cell.plant = null;
            engine.plantMetrics.nutrientDeaths++;
            destroyedPlants++;
          }
        } else if (dist <= shockRadiusPx * 0.45) {
          // Zona de incêndio próxima: solo danificado severamente
          cell.moisture = Math.max(0, cell.moisture * 0.1);
          cell.soilNitrogen = Math.max(0, cell.soilNitrogen * 0.15);
          if (cell.plant) {
            const pIdx = engine.plants.indexOf(cell.plant);
            if (pIdx !== -1) engine.plants.splice(pIdx, 1);
            cell.plant = null;
            engine.plantMetrics.nutrientDeaths++;
            destroyedPlants++;
          }
        } else if (dist <= shockRadiusPx) {
          // Zona de onda de choque: dano parcial
          const factor = 1.0 - (dist / shockRadiusPx);
          cell.moisture = Math.max(0.05, cell.moisture * (1.0 - factor * 0.7));
          cell.soilNitrogen = Math.max(2, cell.soilNitrogen * (1.0 - factor * 0.5));
          if (cell.plant && Math.random() < 0.55 + factor * 0.4) {
            const pIdx = engine.plants.indexOf(cell.plant);
            if (pIdx !== -1) engine.plants.splice(pIdx, 1);
            cell.plant = null;
            engine.plantMetrics.nutrientDeaths++;
            destroyedPlants++;
          }
        }
      }
    }

    for (let i = engine.animals.length - 1; i >= 0; i--) {
      const a = engine.animals[i];
      const dist = Math.hypot(a.x - targetX, a.y - targetY);

      if (dist <= effect.craterRadiusPx) {
        // Cratera: morte instantânea garantida
        const ar = Math.floor(a.y / engine.cellSize);
        const ac = Math.floor(a.x / engine.cellSize);
        const cell = engine.grid[ar]?.[ac];
        if (cell && !cell.carcass) {
          const carcass = new Carcass(
            'carcass_' + Math.random().toString(36).substr(2, 9),
            a.speciesName || a.name,
            a.x, a.y,
            ar, ac,
            20.0,
            a.genes
          );
          cell.carcass = carcass;
          engine.carcasses.push(carcass);
        }
        engine.animals.splice(i, 1);
        vaporizedAnimals++;
      } else if (dist <= shockRadiusPx * 0.45) {
        // Zona próxima: dano altíssimo, quase letal
        const factor = 1.0 - (dist / (shockRadiusPx * 0.45));
        const damage = 60.0 + factor * 110.0;
        a.energy -= damage;
        const angle = Math.atan2(a.y - targetY, a.x - targetX);
        a.vx += Math.cos(angle) * (factor * 18.0);
        a.vy += Math.sin(angle) * (factor * 18.0);
        a.stateLabel = '🔥 Vaporizado pela Explosão!';
        if (a.energy <= 0) {
          engine.animals.splice(i, 1);
          vaporizedAnimals++;
        } else {
          a.isDiseased = true;
          a.diseaseTimer = (a.diseaseTimer || 0) + 180;
          damagedAnimals++;
        }
      } else if (dist <= shockRadiusPx) {
        // Zona de onda de choque: dano moderado + arremesso
        const factor = 1.0 - (dist / shockRadiusPx);
        const damage = factor * 90.0;
        a.energy -= damage;
        const angle = Math.atan2(a.y - targetY, a.x - targetX);
        const impulse = factor * 14.0;
        a.vx += Math.cos(angle) * impulse;
        a.vy += Math.sin(angle) * impulse;
        a.stateLabel = '💥 Queimado por Onda de Choque!';
        if (a.energy <= 0) {
          engine.animals.splice(i, 1);
          vaporizedAnimals++;
        } else {
          damagedAnimals++;
        }
      }
    }

    engine.createTerrainCache();
    engine.impactWinterTicks = 280;

    const msg = `💥 CATÁSTROFE! ${vaporizedAnimals} animais e ${destroyedPlants} plantas eliminados! Inverno Nuclear ativo por 280 ticks!`;
    if (typeof toast === 'function') toast(msg, 5500);
    console.log('[CATÁSTROFE]', msg);
  }
}
