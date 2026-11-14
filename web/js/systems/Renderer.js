// ====================================================
//  RENDERER.JS — Visualização Científica 2D em Canvas (SOLID / 60fps)
//  Responsabilidade única: renderização vetorial, terreno offline e lentes.
// ====================================================

import { SEASONS } from '../core/constants.js';

// Paleta RGB base para interpolação suave de biomas no terreno offline
const BIOME_RGB = {
  water:         [26, 74, 122],
  shallow:       [40, 114, 156],
  shallow_water: [40, 114, 156],
  temperate:     [45, 106, 63],
  fertile:       [45, 106, 63],
  grassland:     [68, 126, 62],
  plains:        [76, 132, 66],
  forest:        [30, 82, 48],
  floresta:      [30, 82, 48],
  wetland:       [42, 102, 85],
  swamp:         [38, 92, 74],
  pantano:       [38, 92, 74],
  savanna:       [140, 122, 54],
  savana:        [140, 122, 54],
  arid:          [122, 92, 46],
  dry:           [122, 92, 46],
  desert:        [168, 134, 78],
  deserto:       [168, 134, 78],
  tundra:        [66, 98, 122],
  frozen:        [162, 196, 222],
  ice:           [184, 214, 236],
  snow:          [202, 222, 238],
  gelo:          [184, 214, 236],
  rocky:         [82, 86, 94],
  mountain:      [94, 96, 104],
  islands:       [52, 114, 68],
  random:        [50, 112, 65]
};

const BIOME_TEMP_OFFSET = {
  water:         -0.15,
  shallow:       -0.08,
  shallow_water: -0.08,
  temperate:      0.00,
  fertile:        0.00,
  grassland:      0.04,
  plains:         0.05,
  forest:        -0.12,
  floresta:      -0.12,
  wetland:       -0.08,
  swamp:         -0.06,
  pantano:       -0.06,
  savanna:        0.26,
  savana:         0.26,
  arid:           0.44,
  dry:            0.44,
  desert:         0.58,
  deserto:        0.58,
  tundra:        -0.48,
  frozen:        -0.68,
  ice:           -0.75,
  snow:          -0.72,
  gelo:          -0.75,
  rocky:          0.06,
  mountain:      -0.25,
  islands:        0.04,
  random:         0.00
};

const BIOME_CODE = Object.create(null);
Object.keys(BIOME_RGB).forEach((k, idx) => { BIOME_CODE[k] = idx + 1; });

// LUT pré-calculada (256 passos) Azul -> Ciano -> Verde-neutro -> Laranja -> Vermelho
const TEMP_LUT_R = new Uint8Array(256);
const TEMP_LUT_G = new Uint8Array(256);
const TEMP_LUT_B = new Uint8Array(256);

(function buildThermalLUT() {
  const stops = [
    [0.00,  24,  78, 220],
    [0.28,  58, 174, 235],
    [0.50, 165, 216, 160],
    [0.72, 245, 162,  48],
    [1.00, 224,  38,  34]
  ];
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let s0 = stops[0], s1 = stops[stops.length - 1];
    for (let k = 0; k < stops.length - 1; k++) {
      if (t >= stops[k][0] && t <= stops[k + 1][0]) {
        s0 = stops[k];
        s1 = stops[k + 1];
        break;
      }
    }
    const span = (s1[0] - s0[0]) || 1;
    const f = (t - s0[0]) / span;
    TEMP_LUT_R[i] = (s0[1] + (s1[1] - s0[1]) * f) | 0;
    TEMP_LUT_G[i] = (s0[2] + (s1[2] - s0[2]) * f) | 0;
    TEMP_LUT_B[i] = (s0[3] + (s1[3] - s0[3]) * f) | 0;
  }
})();

export class Renderer {
  constructor(engine) {
    this.engine = engine;

    // Buffers offscreen reutilizáveis (zero alocações no loop 60fps)
    this._terrainLowResCanvas = null;
    this._terrainLowResCtx = null;
    this._terrainImgData = null;
    this._lastGridRef = null;
    this._lastTerrainCanvasRef = null;
    this._lastShowGridLines = null;
    this._lastBiomeSignature = -1;
    this._lastTerrainW = 0;
    this._lastTerrainH = 0;

    // Cache da lente didática (Temperatura / Nutrientes)
    this._lensCanvas = null;
    this._lensCtx = null;
    this._lensLowResCanvas = null;
    this._lensLowResCtx = null;
    this._lensImgData = null;
    this._lastLensMode = null;
    this._lastLensTick = -1;
    this._lastLensW = 0;
    this._lastLensH = 0;
    this._lastLensSeason = -1;
    this._lastLensClimate = null;
    this._lastLensImpact = -1;
  }

  render() {
    const engine = this.engine;
    if (!engine || !engine.ctx || !engine.canvas) return;

    const ctx = engine.ctx;
    const W = engine.canvas.width;
    const H = engine.canvas.height;
    ctx.clearRect(0, 0, W, H);

    // 1. Terreno base offline com transições suaves de biomas
    this._ensureTerrainCanvas(engine, W, H);
    if (engine.terrainCanvas) {
      ctx.drawImage(engine.terrainCanvas, 0, 0);
    }

    // 2. Lente Didática (Mapa de Temperatura ou Mapa de Nutrientes)
    const viewMode = engine.mapViewMode || 'biomes';
    if (viewMode === 'temperature' || viewMode === 'nutrients') {
      this._ensureLensCanvas(engine, viewMode, W, H);
      if (this._lensCanvas) {
        ctx.save();
        ctx.globalAlpha = viewMode === 'temperature' ? 0.78 : 0.84;
        ctx.drawImage(this._lensCanvas, 0, 0);
        ctx.restore();
      }
    }

    const highlighted = engine.highlightedSpecies || null;
    const tick = engine.tickCount || 0;
    const grid = engine.grid;
    const carcasses = engine.carcasses;
    const plants = engine.plants;
    const animals = engine.animals;

    // 3. Carcaças
    for (let i = 0, len = carcasses.length; i < len; i++) {
      const c = carcasses[i];
      if (!c || c.remainingEnergy <= 0) continue;
      ctx.save();
      if (highlighted) ctx.globalAlpha = 0.25;
      ctx.translate(c.x, c.y);
      ctx.fillStyle = '#8b263e';
      ctx.beginPath();
      ctx.ellipse(0, 0, 6, 3.8, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e6edf3';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-3.2, 0);
      ctx.lineTo(3.2, 0);
      ctx.stroke();
      ctx.restore();
    }

    // 4. Vegetais (Broto -> Caule/Copa -> Espinhos -> Frutos apenas se hasFruit === true)
    const pulse = (Math.sin(tick * 0.22) + 1) * 0.5;
    if (engine.simplifiedSprites) {
      for (let i = 0, len = plants.length; i < len; i++) {
        const plant = plants[i];
        if (!plant) continue;
        const isTarget = !highlighted || plant.name === highlighted;
        const pScale = 0.35 + (plant.growth || 0.5) * 0.35;
        const r = Math.max(2.5, (3 + (plant.genes?.height || 0.5) * 5) * pScale);
        const hue = plant.genes?.colorHue ?? 110;

        ctx.save();
        if (highlighted && !isTarget) ctx.globalAlpha = 0.22;
        ctx.fillStyle = `hsl(${hue}, 68%, 42%)`;
        ctx.beginPath();
        ctx.arc(plant.x, plant.y, r, 0, Math.PI * 2);
        ctx.fill();

        if (plant.hasFruit === true) {
          ctx.fillStyle = '#ff4d4f';
          ctx.beginPath();
          ctx.arc(plant.x, plant.y - r * 0.45, 2, 0, Math.PI * 2);
          ctx.fill();
        }

        if (highlighted && isTarget) {
          ctx.strokeStyle = '#56d364';
          ctx.lineWidth = 1.6;
          ctx.stroke();
        }
        ctx.restore();
      }
    } else {
      for (let i = 0, len = plants.length; i < len; i++) {
        const plant = plants[i];
        if (!plant) continue;
        const isTarget = !highlighted || plant.name === highlighted;
        const cell = grid[plant.r]?.[plant.c] || null;

        ctx.save();
        if (highlighted && !isTarget) ctx.globalAlpha = 0.20;

        const imgs = plant.customImages;
        const hasCustom = imgs && (imgs.roots || imgs.stem || imgs.leaves || imgs.thorns || imgs.fruit);
        if (hasCustom && typeof window !== 'undefined' && typeof window.drawPlant === 'function') {
          const pScale = 0.35 + (plant.growth || 0.5) * 0.35;
          // Preserva regra: só exibe fruto customizado quando hasFruit === true
          if (plant.hasFruit) {
            window.drawPlant(ctx, plant.genes, plant.x, plant.y + 4, pScale, imgs);
          } else {
            const g = plant.genes || {};
            const savedAttr = g.fruitAttraction;
            g.fruitAttraction = 0;
            window.drawPlant(ctx, g, plant.x, plant.y + 4, pScale, imgs);
            g.fruitAttraction = savedAttr;
          }
        } else {
          this._drawPlantVector(ctx, plant, cell);
        }

        if (highlighted && isTarget) {
          const highlightColor = this._getSpeciesColor(engine, plant.name, '#3fb950');
          ctx.strokeStyle = highlightColor;
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.arc(plant.x, plant.y, 14 + pulse * 3.5, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // 5. Animais (Morfologia vetorial paramétrica em 3 camadas — zero rótulos de texto)
    if (engine.simplifiedSprites) {
      for (let i = 0, len = animals.length; i < len; i++) {
        const anim = animals[i];
        if (!anim) continue;
        const animSpecies = anim.speciesName || anim.name;
        const isTarget = !highlighted || animSpecies === highlighted;
        const isCarn = (anim.genes?.diet?.meat || 0) > 0.45;
        const animSize = typeof anim.getEffectiveSize === 'function' ? anim.getEffectiveSize() : (anim.genes?.size ?? 0.5);
        const r = Math.max(3.5, 4 + animSize * 6.5);
        const heading = Math.atan2(anim.vy || 0, anim.vx || 0);

        ctx.save();
        if (highlighted && !isTarget) ctx.globalAlpha = 0.20;

        if (isCarn) {
          ctx.fillStyle = '#f85149';
        } else {
          const hue = anim.genes?.colorHue ?? 120;
          ctx.fillStyle = `hsl(${hue}, 70%, 48%)`;
        }

        ctx.beginPath();
        ctx.arc(anim.x, anim.y, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(anim.x, anim.y);
        ctx.lineTo(anim.x + Math.cos(heading) * (r + 3.2), anim.y + Math.sin(heading) * (r + 3.2));
        ctx.stroke();

        if (anim.isDiseased) {
          ctx.strokeStyle = '#d2a8ff';
          ctx.lineWidth = 1.8;
          ctx.stroke();
        } else if (anim.isPregnant) {
          ctx.strokeStyle = '#ffa657';
          ctx.lineWidth = 1.8;
          ctx.stroke();
        }

        this._drawEnergyBar(ctx, anim.x, anim.y - r - 4, 12, 2, anim);
        ctx.restore();
      }
    } else {
      for (let i = 0, len = animals.length; i < len; i++) {
        const anim = animals[i];
        if (!anim) continue;
        const animSpecies = anim.speciesName || anim.name;
        const isTarget = !highlighted || animSpecies === highlighted;
        const animSize = typeof anim.getEffectiveSize === 'function' ? anim.getEffectiveSize() : (anim.genes?.size ?? 0.5);

        ctx.save();
        if (highlighted && !isTarget) ctx.globalAlpha = 0.20;

        const imgs = anim.customImages;
        const hasCustom = imgs && (imgs.body || imgs.limbs || imgs.jaw || imgs.eyes || imgs.detail);
        if (hasCustom && typeof window !== 'undefined' && typeof window.drawCreature === 'function') {
          const stage = this._getAnimalLifeStage(anim);
          const stageScale = stage === 0 ? 0.68 : (stage === 2 ? 0.94 : 1.0);
          const aScale = (0.35 + animSize * 0.35) * stageScale;
          const heading = Math.atan2(anim.vy || 0, anim.vx || 0);
          if (stage === 2) ctx.globalAlpha *= 0.78;
          ctx.save();
          ctx.translate(anim.x, anim.y);
          ctx.rotate(heading);
          window.drawCreature(ctx, anim.genes || {}, 0, 0, aScale, imgs);
          ctx.restore();
        } else {
          this._drawAnimalVector(ctx, anim, tick);
        }

        if (anim.isDiseased) {
          ctx.strokeStyle = '#d2a8ff';
          ctx.lineWidth = 1.6;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.arc(anim.x, anim.y, 12 + animSize * 8, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        if (anim.isPregnant) {
          ctx.strokeStyle = '#ffa657';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(anim.x, anim.y, 10 + animSize * 7, 0, Math.PI * 2);
          ctx.stroke();
        }

        if (highlighted && isTarget) {
          const highlightColor = this._getSpeciesColor(engine, animSpecies, '#58a6ff');
          ctx.strokeStyle = highlightColor;
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.arc(anim.x, anim.y, 15 + animSize * 6 + pulse * 3, 0, Math.PI * 2);
          ctx.stroke();
        }

        this._drawEnergyBar(ctx, anim.x, anim.y - (13 + animSize * 6), 16, 2.5, anim);
        ctx.restore();
      }
    }

    // 6. Anel de seleção da entidade inspecionada (sem mutar estado ou tocar DOM)
    if (engine.selectedEntity) {
      const sel = engine.selectedEntity;
      const list = sel.type === 'animal' ? animals : plants;
      if (list && list.includes(sel.data)) {
        const e = sel.data;
        ctx.save();
        ctx.strokeStyle = '#3fb950';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(e.x, e.y, 21, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 7. Tonalidade climática sazonal (omitida na lente térmica para preservar leitura exata da escala)
    if (viewMode !== 'temperature') {
      const curSeason = SEASONS[engine.seasonIndex] || SEASONS[0];
      const effectiveTemp = curSeason.temp + (engine.climateTrend || 0);
      if (Math.abs(effectiveTemp) > 0.12) {
        ctx.save();
        if (effectiveTemp < 0) {
          const coldAlpha = Math.min(0.24, Math.abs(effectiveTemp) * 0.20);
          ctx.fillStyle = `rgba(80, 160, 255, ${coldAlpha})`;
        } else {
          const heatAlpha = Math.min(0.22, effectiveTemp * 0.18);
          ctx.fillStyle = `rgba(255, 170, 40, ${heatAlpha})`;
        }
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    }

    // 8. Efeitos visuais de catástrofes (Meteoros & Inverno de Impacto)
    this._renderDisasters(ctx, engine, W, H);
  }

  // ════════════════════════════════════════════════════
  // MORFOLOGIA VETORIAL PARAMÉTRICA — ANIMAIS (3 CAMADAS)
  // ════════════════════════════════════════════════════

  /**
   * Retorna 0 = Juvenil, 1 = Adulto, 2 = Senescente.
   */
  _getAnimalLifeStage(anim) {
    if (anim.lifeStage === 'juvenile' || anim.lifeStage === 'juvenil') return 0;
    if (anim.lifeStage === 'elder' || anim.lifeStage === 'senescent' || anim.lifeStage === 'senescente') return 2;
    if (anim.lifeStage === 'adult' || anim.lifeStage === 'adulto') return 1;

    const g = anim.genes || {};
    const size = typeof anim.getEffectiveSize === 'function' ? anim.getEffectiveSize() : (g.size ?? 0.5);
    const meat = g.diet?.meat ?? 0.0;
    const maxLife = anim.maxLifespan || (meat > 0.45 ? (950 + size * 300) : (700 + size * 150));
    const age = anim.age || 0;
    const ratio = age / maxLife;

    if (age < 60 || ratio < 0.10) return 0;
    if (ratio >= 0.80) return 2;
    return 1;
  }

  _drawAnimalVector(ctx, anim, tick) {
    const g = anim.genes || {};
    const size = typeof anim.getEffectiveSize === 'function' ? anim.getEffectiveSize() : (g.size ?? 0.5);
    const speed = g.speed ?? 0.5;
    const perception = g.perception ?? 0.5;
    const health = g.health ?? 0.5;
    const aggression = g.aggression ?? 0.3;
    const aquatic = g.aquatic ?? 0.15;
    const thermal = g.thermal ?? 0.0;
    const hue = g.colorHue ?? 120;

    const diet = g.diet;
    const meat = diet ? (diet.meat ?? 0.05) : 0.05;
    const plant = diet ? (diet.plant ?? 0.85) : 0.85;
    const carcass = diet ? (diet.carcass ?? 0.10) : 0.10;

    const isScavenger = (carcass >= 0.35) || (carcass > meat && carcass > plant);
    const isCarnivore = !isScavenger && (meat > 0.45 || (meat > plant && meat >= 0.35));

    const stage = this._getAnimalLifeStage(anim); // 0=juvenile, 1=adult, 2=senescent
    const showOrnaments = stage !== 0;
    const ageProgress = Math.min(1, (anim.age || 0) / 60);
    const stageScale = stage === 0 ? (0.60 + 0.18 * ageProgress) : (stage === 2 ? 0.95 : 1.0);

    // Cor com dessaturação aritmética para senescentes (evita ctx.filter lento)
    const baseSat = 62 + meat * 26;
    const baseLight = 36 + health * 16;
    let sat, light;
    if (stage === 2) {
      sat = (baseSat * 0.42) | 0;
      light = Math.min(62, (baseLight + 6) | 0);
    } else if (stage === 0) {
      sat = Math.min(92, (baseSat * 1.05) | 0);
      light = Math.min(60, (baseLight + 7) | 0);
    } else {
      sat = baseSat | 0;
      light = baseLight | 0;
    }

    const bodyColor = `hsl(${hue}, ${sat}%, ${light}%)`;
    const limbColor = `hsl(${hue}, ${Math.max(14, sat - 10)}%, ${Math.max(16, light - 14)}%)`;
    const plateColor = `hsl(${hue}, ${Math.max(12, sat - 14)}%, ${Math.max(14, light - 19)}%)`;
    const armored = showOrnaments && (health > 0.55 || aggression > 0.50);
    const outlineColor = armored
      ? `hsl(${hue}, ${sat}%, ${Math.max(11, light - 24)}%)`
      : `hsl(${hue}, ${sat}%, ${Math.max(15, light - 16)}%)`;

    const baseR = (6.0 + size * 6.5) * stageScale;
    // Silhueta mais alongada quando speed é alto
    const elongation = 1.02 + speed * 0.58;
    const rx = baseR * elongation;
    const ry = baseR * (0.90 - speed * 0.18);

    const heading = Math.atan2(anim.vy || 0, anim.vx || 0);
    const idSeed = anim.id ? anim.id.charCodeAt(anim.id.length - 1) * 0.73 : 0;
    const oscSpeed = stage === 2 ? 0.11 : 0.17;
    const swimOsc = Math.sin(tick * oscSpeed + idSeed);

    ctx.save();
    ctx.translate(anim.x, anim.y);
    ctx.rotate(heading);

    // ── CAMADA 1: Locomoção (Nadadeiras/Cauda oscilante ou Patas) ──
    const isAquatic = aquatic > 0.5;
    if (isAquatic) {
      const swing = swimOsc * (0.36 + speed * 0.25);
      const tailLen = baseR * (0.72 + speed * 0.38);
      const tailTipX = -rx - tailLen;
      const tailTipY = swing * baseR * 0.95;
      const flukeSpan = baseR * 0.44;

      // Cauda hidrodinâmica + nadadeira caudal oscilante
      ctx.fillStyle = limbColor;
      ctx.beginPath();
      ctx.moveTo(-rx * 0.72, -ry * 0.30);
      ctx.quadraticCurveTo(-rx * 1.10, tailTipY * 0.45, tailTipX - flukeSpan * 0.35, tailTipY - flukeSpan);
      ctx.lineTo(tailTipX + baseR * 0.18, tailTipY);
      ctx.lineTo(tailTipX - flukeSpan * 0.35, tailTipY + flukeSpan);
      ctx.quadraticCurveTo(-rx * 1.10, tailTipY * 0.45, -rx * 0.72, ry * 0.30);
      ctx.closePath();
      ctx.fill();

      // Nadadeiras laterais oscilantes
      const finLen = baseR * (0.55 + speed * 0.22);
      const finWid = baseR * 0.25;
      for (let s = -1; s <= 1; s += 2) {
        const finSwing = swing * 0.55 * s;
        const bx = rx * 0.15;
        const by = s * ry * 0.78;
        const tipX = bx - finLen * (0.65 + finSwing * 0.25);
        const tipY = by + s * finLen * (0.72 - finSwing * 0.20);
        ctx.beginPath();
        ctx.moveTo(bx + finWid * 0.4, by);
        ctx.quadraticCurveTo(bx - finLen * 0.15, tipY, tipX, tipY);
        ctx.quadraticCurveTo(bx - finLen * 0.45, by + s * finWid * 0.3, bx - finWid * 0.5, by);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      // Cauda terrestre discreta
      ctx.strokeStyle = limbColor;
      ctx.lineWidth = Math.max(1.4, baseR * 0.22);
      ctx.lineCap = 'round';
      if (!isScavenger && !isCarnivore) {
        // Herbívoro: cauda curta arredondada
        ctx.fillStyle = limbColor;
        ctx.beginPath();
        ctx.arc(-rx * 0.96, 0, baseR * 0.24, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Carnívoro / necrófago: cauda flexível
        const tLen = baseR * (0.50 + speed * 0.32);
        ctx.beginPath();
        ctx.moveTo(-rx * 0.85, 0);
        ctx.quadraticCurveTo(-rx - tLen * 0.5, swimOsc * baseR * 0.18, -rx - tLen, swimOsc * baseR * 0.25);
        ctx.stroke();
      }

      // 4 patas laterais compactas
      const legReach = baseR * (0.34 + speed * 0.24);
      const pawR = Math.max(1.1, baseR * 0.16);
      ctx.strokeStyle = limbColor;
      ctx.fillStyle = limbColor;
      ctx.lineWidth = Math.max(1.3, baseR * 0.20);
      for (let s = -1; s <= 1; s += 2) {
        // Pata dianteira
        const fx = rx * 0.40;
        const fy = s * ry * 0.72;
        const fex = fx + baseR * 0.18;
        const fey = fy + s * legReach;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(fex, fey);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(fex, fey, pawR, 0, Math.PI * 2);
        ctx.fill();

        // Pata traseira
        const hx = -rx * 0.44;
        const hy = s * ry * 0.70;
        const hex = hx - baseR * 0.22;
        const hey = hy + s * legReach;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(hex, hey);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(hex, hey, pawR, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ── CAMADA 2: Corpo & Placas Dorsais / Contorno Reforçado ──
    ctx.fillStyle = bodyColor;
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = armored ? (1.8 + (health + aggression) * 0.85) : 1.15;

    ctx.beginPath();
    ctx.moveTo(rx, 0);
    ctx.bezierCurveTo(rx * 0.95, -ry * 0.85, rx * 0.15, -ry * 1.05, -rx * 0.42, -ry * 0.86);
    ctx.bezierCurveTo(-rx * 0.88, -ry * 0.65, -rx * 1.02, -ry * 0.25, -rx, 0);
    ctx.bezierCurveTo(-rx * 1.02, ry * 0.25, -rx * 0.88, ry * 0.65, -rx * 0.42, ry * 0.86);
    ctx.bezierCurveTo(rx * 0.15, ry * 1.05, rx * 0.95, ry * 0.85, rx, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Placas dorsais (apenas em adultos/senescentes com health ou aggression altos)
    if (armored) {
      const plateCount = (health > 0.72 || aggression > 0.72) ? 4 : 3;
      const plateW = rx * 0.18;
      const plateH = ry * (0.42 + Math.max(health, aggression) * 0.18);
      ctx.fillStyle = plateColor;
      for (let p = 0; p < plateCount; p++) {
        const px = -rx * 0.48 + p * (rx * 0.26);
        ctx.beginPath();
        ctx.moveTo(px + plateW, 0);
        ctx.lineTo(px - plateW * 0.4, -plateH);
        ctx.lineTo(px - plateW * 0.9, 0);
        ctx.lineTo(px - plateW * 0.4, plateH);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Indicação térmica sutil no dorso quando adaptado a extremos (sem poluir)
    if (showOrnaments && Math.abs(thermal) > 0.35) {
      ctx.strokeStyle = thermal > 0 ? 'rgba(255, 178, 86, 0.45)' : 'rgba(145, 208, 255, 0.50)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-rx * 0.45, 0);
      ctx.lineTo(rx * 0.18, 0);
      ctx.stroke();
    }

    // ── CAMADA 3: Cabeça, Olhos e Boca conforme Dieta ──
    const eyeR = Math.max(1.3, (1.35 + perception * 1.35) * stageScale);

    if (isScavenger) {
      // Necrófago: Bico curvo + antenas sensoriais
      const beakBaseX = rx * 0.84;
      const beakTipX = rx * 1.30;
      ctx.fillStyle = '#b7976b';
      ctx.strokeStyle = '#5c462f';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(beakBaseX, -ry * 0.26);
      ctx.quadraticCurveTo(beakTipX, -ry * 0.05, beakTipX * 1.02, ry * 0.16);
      ctx.quadraticCurveTo(beakBaseX + baseR * 0.18, ry * 0.20, beakBaseX, ry * 0.24);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Antenas curvadas
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 1.05;
      for (let s = -1; s <= 1; s += 2) {
        ctx.beginPath();
        ctx.moveTo(rx * 0.62, s * ry * 0.35);
        ctx.quadraticCurveTo(rx * 0.96, s * ry * 0.72, rx * 1.12, s * ry * 0.88);
        ctx.stroke();
        ctx.fillStyle = '#e3b341';
        ctx.beginPath();
        ctx.arc(rx * 1.12, s * ry * 0.88, Math.max(0.9, baseR * 0.09), 0, Math.PI * 2);
        ctx.fill();
      }

      // Olhos oblíquos
      this._drawEyePair(ctx, rx * 0.46, ry * 0.54, eyeR, '#f6f8fa', '#161b22');
    } else if (isCarnivore) {
      // Carnívoro: Mandíbula estreita + presas discretas (omitidas em juvenis)
      ctx.fillStyle = limbColor;
      ctx.beginPath();
      ctx.moveTo(rx * 0.78, -ry * 0.34);
      ctx.lineTo(rx * 1.12, -ry * 0.14);
      ctx.lineTo(rx * 1.12, ry * 0.14);
      ctx.lineTo(rx * 0.78, ry * 0.34);
      ctx.closePath();
      ctx.fill();

      if (showOrnaments) {
        const fangL = baseR * 0.24;
        ctx.fillStyle = '#f0f6fc';
        for (let s = -1; s <= 1; s += 2) {
          ctx.beginPath();
          ctx.moveTo(rx * 0.98, s * ry * 0.16);
          ctx.lineTo(rx * 0.98 + fangL, s * ry * 0.21);
          ctx.lineTo(rx * 0.94, s * ry * 0.27);
          ctx.closePath();
          ctx.fill();
        }
      }

      // Olhos frontais binoculares
      this._drawEyePair(ctx, rx * 0.58, ry * 0.30, eyeR, '#fff8e6', '#161b22');
    } else {
      // Herbívoro: Focinho arredondado + olhos laterais
      ctx.fillStyle = limbColor;
      ctx.beginPath();
      ctx.ellipse(rx * 0.88, 0, baseR * 0.24, ry * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();

      // Narina discreta
      ctx.fillStyle = '#161b22';
      ctx.beginPath();
      ctx.arc(rx * 0.98, -ry * 0.10, Math.max(0.7, baseR * 0.06), 0, Math.PI * 2);
      ctx.arc(rx * 0.98, ry * 0.10, Math.max(0.7, baseR * 0.06), 0, Math.PI * 2);
      ctx.fill();

      // Olhos laterais (amplo campo visual)
      this._drawEyePair(ctx, rx * 0.30, ry * 0.74, eyeR, '#ffffff', '#161b22');
    }

    ctx.restore();
  }

  _drawEyePair(ctx, ex, ey, eyeR, scleraColor, pupilColor) {
    for (let s = -1; s <= 1; s += 2) {
      const yPos = s * ey;
      ctx.fillStyle = scleraColor;
      ctx.beginPath();
      ctx.arc(ex, yPos, eyeR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = pupilColor;
      ctx.beginPath();
      ctx.arc(ex + eyeR * 0.28, yPos, eyeR * 0.56, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex + eyeR * 0.42, yPos - eyeR * 0.22, eyeR * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawEnergyBar(ctx, cx, topY, w, h, anim) {
    const maxE = anim.maxEnergy || 100.0;
    const pct = Math.max(0, Math.min(1, (anim.energy || 0) / maxE));
    const left = cx - w * 0.5;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(left, topY, w, h);
    ctx.fillStyle = anim.isDiseased
      ? '#d2a8ff'
      : (anim.isPregnant ? '#ffa657' : (pct > 0.5 ? '#3fb950' : (pct > 0.25 ? '#e3b341' : '#f78166')));
    ctx.fillRect(left, topY, w * pct, h);
  }

  // ════════════════════════════════════════════════════
  // MORFOLOGIA VETORIAL PARAMÉTRICA — PLANTAS
  // ════════════════════════════════════════════════════

  _drawPlantVector(ctx, plant, cell) {
    const g = plant.genes || {};
    const growth = plant.growth ?? 0.35;
    const height = g.height ?? 0.5;
    const rootEff = g.rootEfficiency ?? 0.5;
    const defense = g.defense ?? 0.3;
    const fruitAttr = g.fruitAttraction ?? 0.4;
    const baseHue = g.colorHue ?? 110;

    // Estresse hídrico / nutricional discreto para sinalização visual sutil na folha
    let stress = 0;
    if (cell) {
      const waterF = Math.min(1.0, cell.moisture * (0.7 + rootEff * 0.6));
      const nitroF = cell.soilNitrogen / (10.0 + cell.soilNitrogen);
      const minRes = Math.min(waterF, nitroF);
      if (minRes < 0.34) {
        stress = Math.min(1, (0.34 - minRes) / 0.26);
      }
    }
    if (plant.energy !== undefined && plant.energy < 18) {
      stress = Math.max(stress, Math.min(1, (18 - plant.energy) / 14));
    }

    // Deslocamento sutil da cor da folha (verde vivo -> verde-oliva/amarelado sob estresse)
    const leafHue = Math.round(baseHue - stress * (baseHue > 65 ? 38 : 12));
    const leafSat = Math.round(68 - stress * 24);
    const leafLight = Math.round(40 + stress * 4);
    const leafColor = `hsl(${leafHue}, ${leafSat}%, ${leafLight}%)`;
    const highlightLeaf = `hsl(${leafHue + 8}, ${Math.min(82, leafSat + 6)}%, ${Math.min(58, leafLight + 9)}%)`;
    const stemColor = `hsl(${Math.max(20, baseHue - 26)}, 40%, 26%)`;

    const px = plant.x;
    const py = plant.y + 4;
    const wiltDrop = stress * 2.2;

    // Estágio 1: Broto
    if (growth < 0.28) {
      const sproutH = 4 + growth * 12;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.beginPath();
      ctx.ellipse(px, py, 3.8, 1.8, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = stemColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px - 1, py - sproutH * 0.5, px, py - sproutH);
      ctx.stroke();

      ctx.fillStyle = leafColor;
      ctx.beginPath();
      ctx.ellipse(px - 2.6, py - sproutH + wiltDrop * 0.4, 2.8, 1.4, -0.45 + stress * 0.4, 0, Math.PI * 2);
      ctx.ellipse(px + 2.6, py - sproutH + wiltDrop * 0.4, 2.8, 1.4, 0.45 - stress * 0.4, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    // Estágio 2+: Caule + Copa escalando com height e growth
    const sizeMod = 0.42 + growth * 0.62;
    const stemH = (5.5 + height * 13.0) * sizeMod;
    const stemW = 1.2 + height * 2.1;
    const canopyR = (4.0 + height * 6.0) * sizeMod;
    const topY = py - stemH;

    // Sombra na base
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(px, py + 0.5, canopyR * 0.85, canopyR * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // Caule
    ctx.fillStyle = stemColor;
    ctx.beginPath();
    ctx.moveTo(px - stemW, py);
    ctx.lineTo(px - stemW * 0.55, topY);
    ctx.lineTo(px + stemW * 0.55, topY);
    ctx.lineTo(px + stemW, py);
    ctx.closePath();
    ctx.fill();

    // Espinhos defensivos quando defense > 0.35
    if (defense > 0.35) {
      const thornCount = Math.min(5, Math.round(1 + defense * 4));
      const thornLen = 2.0 + defense * 3.5;
      ctx.strokeStyle = '#c94c4c';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let t = 1; t <= thornCount; t++) {
        const ty = py - stemH * (t / (thornCount + 1));
        const side = (t & 1) ? 1 : -1;
        ctx.moveTo(px + side * stemW * 0.6, ty);
        ctx.lineTo(px + side * (stemW * 0.6 + thornLen), ty - 1.5);
      }
      ctx.stroke();
    }
    // Copa foliar (lóbulos orgânicos)
    ctx.fillStyle = leafColor;
    ctx.beginPath();
    ctx.arc(px - canopyR * 0.48, topY + wiltDrop * 0.5, canopyR * 0.68, 0, Math.PI * 2);
    ctx.arc(px + canopyR * 0.48, topY + wiltDrop * 0.5, canopyR * 0.68, 0, Math.PI * 2);
    ctx.arc(px, topY - canopyR * 0.25 + wiltDrop * 0.3, canopyR * 0.78, 0, Math.PI * 2);
    ctx.fill();

    // Realce na copa
    ctx.fillStyle = highlightLeaf;
    ctx.beginPath();
    ctx.arc(px - canopyR * 0.12, topY - canopyR * 0.28 + wiltDrop * 0.3, canopyR * 0.42, 0, Math.PI * 2);
    ctx.fill();

    // Indicação visual sutil de estresse hídrico/nutricional na folha
    if (stress > 0.25) {
      ctx.fillStyle = 'rgba(218, 178, 62, 0.72)';
      ctx.beginPath();
      ctx.ellipse(px + canopyR * 0.54, topY + wiltDrop * 0.7, canopyR * 0.26, canopyR * 0.14, 0.55, 0, Math.PI * 2);
      ctx.fill();
    }

    // Frutos coloridos apenas quando hasFruit === true
    if (plant.hasFruit === true) {
      const fruitHue = (baseHue + 150) % 360;
      const fruitR = 1.45 + fruitAttr * 1.25;
      const fruitCount = Math.min(4, Math.max(2, Math.round(1.5 + fruitAttr * 2.5)));

      ctx.fillStyle = `hsl(${fruitHue}, 88%, 58%)`;
      ctx.beginPath();
      for (let f = 0; f < fruitCount; f++) {
        const angle = (f / fruitCount) * Math.PI * 2 + 0.4;
        const fx = px + Math.cos(angle) * canopyR * 0.58;
        const fy = (topY - canopyR * 0.08) + Math.sin(angle) * canopyR * 0.48 + wiltDrop * 0.3;
        ctx.moveTo(fx + fruitR, fy);
        ctx.arc(fx, fy, fruitR, 0, Math.PI * 2);
      }
      ctx.fill();

      // Brilho especular discreto nos frutos
      ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
      ctx.beginPath();
      for (let f = 0; f < fruitCount; f++) {
        const angle = (f / fruitCount) * Math.PI * 2 + 0.4;
        const fx = px + Math.cos(angle) * canopyR * 0.58 - fruitR * 0.25;
        const fy = (topY - canopyR * 0.08) + Math.sin(angle) * canopyR * 0.48 + wiltDrop * 0.3 - fruitR * 0.25;
        ctx.moveTo(fx + 0.65, fy);
        ctx.arc(fx, fy, 0.65, 0, Math.PI * 2);
      }
      ctx.fill();
    }
  }

  _getSpeciesColor(engine, speciesName, fallback) {
    const reg = engine.speciesRegistry && engine.speciesRegistry[speciesName];
    if (reg && reg.color) return reg.color;
    const cat = engine.speciesCatalog;
    if (cat) {
      for (let i = 0, len = cat.length; i < len; i++) {
        if (cat[i].name === speciesName) return cat[i].color;
      }
    }
    return fallback;
  }

  // ════════════════════════════════════════════════════
  // TERRENO OFFLINE SUAVE (terrainCanvas)
  // ════════════════════════════════════════════════════

  _computeBiomeSignature(engine) {
    const grid = engine.grid;
    const rows = engine.gridRows;
    const cols = engine.gridCols;
    let hash = (rows * 397) ^ cols;
    for (let r = 0; r < rows; r++) {
      const row = grid[r];
      if (!row) continue;
      for (let c = 0; c < cols; c++) {
        const code = BIOME_CODE[row[c]?.biome] || 31;
        hash = ((hash * 31) + code) | 0;
      }
    }
    return hash;
  }

  _ensureTerrainCanvas(engine, W, H) {
    const grid = engine.grid;
    if (!grid || grid.length === 0) return;

    const sig = this._computeBiomeSignature(engine);
    const needsRebuild =
      !engine.terrainCanvas ||
      engine.terrainCanvas.width !== W ||
      engine.terrainCanvas.height !== H ||
      this._lastGridRef !== grid ||
      this._lastTerrainCanvasRef !== engine.terrainCanvas ||
      this._lastShowGridLines !== engine.showGridLines ||
      this._lastBiomeSignature !== sig ||
      this._lastTerrainW !== W ||
      this._lastTerrainH !== H;

    if (!needsRebuild) return;

    this._rebuildSmoothTerrain(engine, W, H);
    this._lastGridRef = grid;
    this._lastTerrainCanvasRef = engine.terrainCanvas;
    this._lastShowGridLines = engine.showGridLines;
    this._lastBiomeSignature = sig;
    this._lastTerrainW = W;
    this._lastTerrainH = H;
  }

  _rebuildSmoothTerrain(engine, W, H) {
    if (!engine.terrainCanvas) {
      engine.terrainCanvas = document.createElement('canvas');
    }
    engine.terrainCanvas.width = W;
    engine.terrainCanvas.height = H;
    const tctx = engine.terrainCanvas.getContext('2d');
    if (!tctx) return;

    const grid = engine.grid;
    const rows = engine.gridRows;
    const cols = engine.gridCols;
    const cellSize = engine.cellSize;
    const sub = 4;
    const lw = cols * sub;
    const lh = rows * sub;

    if (!this._terrainLowResCanvas) {
      this._terrainLowResCanvas = document.createElement('canvas');
      this._terrainLowResCtx = this._terrainLowResCanvas.getContext('2d');
    }
    if (this._terrainLowResCanvas.width !== lw || this._terrainLowResCanvas.height !== lh) {
      this._terrainLowResCanvas.width = lw;
      this._terrainLowResCanvas.height = lh;
      this._terrainImgData = this._terrainLowResCtx.createImageData(lw, lh);
    }

    const data = this._terrainImgData.data;

    for (let sy = 0; sy < lh; sy++) {
      const fy = Math.max(0, Math.min(rows - 1, (sy + 0.5) / sub - 0.5));
      const r0 = fy | 0;
      const r1 = r0 + 1 < rows ? r0 + 1 : r0;
      const ty = fy - r0;
      const uy = ty * ty * (3 - 2 * ty);
      const row0 = grid[r0];
      const row1 = grid[r1];

      for (let sx = 0; sx < lw; sx++) {
        const fx = Math.max(0, Math.min(cols - 1, (sx + 0.5) / sub - 0.5));
        const c0 = fx | 0;
        const c1 = c0 + 1 < cols ? c0 + 1 : c0;
        const tx = fx - c0;
        const ux = tx * tx * (3 - 2 * tx);

        const cell00 = row0[c0];
        const cell10 = row0[c1];
        const cell01 = row1[c0];
        const cell11 = row1[c1];

        const rgb00 = BIOME_RGB[cell00.biome] || BIOME_RGB.fertile;
        const rgb10 = BIOME_RGB[cell10.biome] || BIOME_RGB.fertile;
        const rgb01 = BIOME_RGB[cell01.biome] || BIOME_RGB.fertile;
        const rgb11 = BIOME_RGB[cell11.biome] || BIOME_RGB.fertile;

        const w00 = (1 - ux) * (1 - uy);
        const w10 = ux * (1 - uy);
        const w01 = (1 - ux) * uy;
        const w11 = ux * uy;

        let rVal = rgb00[0] * w00 + rgb10[0] * w10 + rgb01[0] * w01 + rgb11[0] * w11;
        let gVal = rgb00[1] * w00 + rgb10[1] * w10 + rgb01[1] * w01 + rgb11[1] * w11;
        let bVal = rgb00[2] * w00 + rgb10[2] * w10 + rgb01[2] * w01 + rgb11[2] * w11;

        // Realce sutil de margem rasa na transição água-terra
        const waterCount =
          (cell00.biome === 'water' ? 1 : 0) +
          (cell10.biome === 'water' ? 1 : 0) +
          (cell01.biome === 'water' ? 1 : 0) +
          (cell11.biome === 'water' ? 1 : 0);

        if (waterCount > 0 && waterCount < 4) {
          rVal += 10;
          gVal += 20;
          bVal += 22;
        }

        // Micro-variação orgânica determinística por elevação/coordenada
        const elevShade = ((cell00.elevation ?? 0.5) - 0.5) * 14;
        const grain = (((sx * 37 + sy * 91 + (sx ^ sy) * 13) & 7) - 3) * 0.9;
        const delta = elevShade + grain;

        const idx = (sy * lw + sx) * 4;
        data[idx]     = Math.max(0, Math.min(255, (rVal + delta) | 0));
        data[idx + 1] = Math.max(0, Math.min(255, (gVal + delta) | 0));
        data[idx + 2] = Math.max(0, Math.min(255, (bVal + delta) | 0));
        data[idx + 3] = 255;
      }
    }

    this._terrainLowResCtx.putImageData(this._terrainImgData, 0, 0);
    tctx.imageSmoothingEnabled = true;
    tctx.imageSmoothingQuality = 'high';
    tctx.drawImage(this._terrainLowResCanvas, 0, 0, W, H);

    // Micro-texturas sutis por bioma em lotes (1 path por categoria)
    tctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    tctx.lineWidth = 1;
    tctx.beginPath();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const b = grid[r][c].biome;
        const seed = (r * 73856093 ^ c * 19349663) & 255;
        if (b === 'water' && (seed & 3) === 0) {
          const x0 = c * cellSize + 5 + (seed % 10);
          const y0 = r * cellSize + 8 + ((seed >> 3) % 10);
          tctx.moveTo(x0, y0);
          tctx.lineTo(x0 + 7, y0);
        } else if ((b === 'rocky' || b === 'mountain') && (seed & 3) === 1) {
          const x0 = c * cellSize + 6 + (seed % 12);
          const y0 = r * cellSize + 6 + ((seed >> 2) % 12);
          tctx.moveTo(x0, y0);
          tctx.lineTo(x0 + 3, y0 + 2);
        } else if ((b === 'frozen' || b === 'ice' || b === 'snow' || b === 'tundra') && (seed & 3) === 2) {
          const x0 = c * cellSize + 7 + (seed % 11);
          const y0 = r * cellSize + 7 + ((seed >> 3) % 11);
          tctx.moveTo(x0 - 2, y0);
          tctx.lineTo(x0 + 2, y0);
          tctx.moveTo(x0, y0 - 2);
          tctx.lineTo(x0, y0 + 2);
        }
      }
    }
    tctx.stroke();

    // Grade opcional em uma única chamada batched
    if (engine.showGridLines) {
      tctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
      tctx.lineWidth = 1;
      tctx.beginPath();
      for (let c = 0; c <= cols; c++) {
        const x = c * cellSize + 0.5;
        tctx.moveTo(x, 0);
        tctx.lineTo(x, H);
      }
      for (let r = 0; r <= rows; r++) {
        const y = r * cellSize + 0.5;
        tctx.moveTo(0, y);
        tctx.lineTo(W, y);
      }
      tctx.stroke();
    }
  }

  // ════════════════════════════════════════════════════
  // LENTES DIDÁTICAS OFFLINE (TEMPERATURA / NUTRIENTES)
  // ════════════════════════════════════════════════════

  _ensureLensCanvas(engine, mode, W, H) {
    const grid = engine.grid;
    if (!grid || grid.length === 0) return;

    const tick = engine.tickCount || 0;
    const seasonIdx = engine.seasonIndex || 0;
    const climateOff = engine.climateOffset || 0;
    const impactActive = (engine.impactWinterTicks || 0) > 0 ? 1 : 0;

    if (
      this._lensCanvas &&
      this._lastLensMode === mode &&
      this._lastLensTick === tick &&
      this._lastLensW === W &&
      this._lastLensH === H &&
      this._lastLensSeason === seasonIdx &&
      this._lastLensClimate === climateOff &&
      this._lastLensImpact === impactActive
    ) {
      return;
    }

    const rows = engine.gridRows;
    const cols = engine.gridCols;
    const sub = 3;
    const lw = cols * sub;
    const lh = rows * sub;

    if (!this._lensCanvas) {
      this._lensCanvas = document.createElement('canvas');
      this._lensCtx = this._lensCanvas.getContext('2d');
    }
    if (this._lensCanvas.width !== W || this._lensCanvas.height !== H) {
      this._lensCanvas.width = W;
      this._lensCanvas.height = H;
    }

    if (!this._lensLowResCanvas) {
      this._lensLowResCanvas = document.createElement('canvas');
      this._lensLowResCtx = this._lensLowResCanvas.getContext('2d');
    }
    if (this._lensLowResCanvas.width !== lw || this._lensLowResCanvas.height !== lh) {
      this._lensLowResCanvas.width = lw;
      this._lensLowResCanvas.height = lh;
      this._lensImgData = this._lensLowResCtx.createImageData(lw, lh);
    }

    const data = this._lensImgData.data;

    if (mode === 'temperature') {
      const curSeason = SEASONS[seasonIdx] || SEASONS[0];
      const impactDelta = impactActive ? -0.40 : 0;
      const trendOrOffset = tick === 0 ? climateOff : (engine.climateTrend || 0);
      const globalTemp = curSeason.temp + impactDelta + trendOrOffset;

      for (let sy = 0; sy < lh; sy++) {
        const fy = Math.max(0, Math.min(rows - 1, (sy + 0.5) / sub - 0.5));
        const r0 = fy | 0;
        const r1 = r0 + 1 < rows ? r0 + 1 : r0;
        const ty = fy - r0;
        const row0 = grid[r0];
        const row1 = grid[r1];

        for (let sx = 0; sx < lw; sx++) {
          const fx = Math.max(0, Math.min(cols - 1, (sx + 0.5) / sub - 0.5));
          const c0 = fx | 0;
          const c1 = c0 + 1 < cols ? c0 + 1 : c0;
          const tx = fx - c0;

          const t00 = this._getCellTemp(row0[c0], globalTemp);
          const t10 = this._getCellTemp(row0[c1], globalTemp);
          const t01 = this._getCellTemp(row1[c0], globalTemp);
          const t11 = this._getCellTemp(row1[c1], globalTemp);

          const w00 = (1 - tx) * (1 - ty);
          const w10 = tx * (1 - ty);
          const w01 = (1 - tx) * ty;
          const w11 = tx * ty;

          const tCell = t00 * w00 + t10 * w10 + t01 * w01 + t11 * w11;
          const norm = Math.max(0, Math.min(1, (tCell + 1.2) / 2.4));
          const lutIdx = (norm * 255) | 0;

          const idx = (sy * lw + sx) * 4;
          data[idx]     = TEMP_LUT_R[lutIdx];
          data[idx + 1] = TEMP_LUT_G[lutIdx];
          data[idx + 2] = TEMP_LUT_B[lutIdx];
          data[idx + 3] = 255;
        }
      }
    } else {
      // Mapa de Nutrientes (Nitrogênio + Biomassa Orgânica + Umidade)
      for (let sy = 0; sy < lh; sy++) {
        const fy = Math.max(0, Math.min(rows - 1, (sy + 0.5) / sub - 0.5));
        const r0 = fy | 0;
        const r1 = r0 + 1 < rows ? r0 + 1 : r0;
        const ty = fy - r0;
        const row0 = grid[r0];
        const row1 = grid[r1];

        for (let sx = 0; sx < lw; sx++) {
          const fx = Math.max(0, Math.min(cols - 1, (sx + 0.5) / sub - 0.5));
          const c0 = fx | 0;
          const c1 = c0 + 1 < cols ? c0 + 1 : c0;
          const tx = fx - c0;

          const c00 = row0[c0];
          const c10 = row0[c1];
          const c01 = row1[c0];
          const c11 = row1[c1];

          const w00 = (1 - tx) * (1 - ty);
          const w10 = tx * (1 - ty);
          const w01 = (1 - tx) * ty;
          const w11 = tx * ty;

          const waterMix =
            (c00.biome === 'water' ? w00 : 0) +
            (c10.biome === 'water' ? w10 : 0) +
            (c01.biome === 'water' ? w01 : 0) +
            (c11.biome === 'water' ? w11 : 0);

          const nitro =
            (c00.soilNitrogen + (c00.organicBiomass || 0) * 0.45) * w00 +
            (c10.soilNitrogen + (c10.organicBiomass || 0) * 0.45) * w10 +
            (c01.soilNitrogen + (c01.organicBiomass || 0) * 0.45) * w01 +
            (c11.soilNitrogen + (c11.organicBiomass || 0) * 0.45) * w11;

          const moist =
            c00.moisture * w00 +
            c10.moisture * w10 +
            c01.moisture * w01 +
            c11.moisture * w11;

          const organic =
            (c00.organicBiomass || 0) * w00 +
            (c10.organicBiomass || 0) * w10 +
            (c01.organicBiomass || 0) * w01 +
            (c11.organicBiomass || 0) * w11;

          const landWeight = 1 - waterMix;
          const nNorm = landWeight > 0.05 ? Math.min(1, Math.max(0, (nitro / landWeight) / 100)) : 0;
          const mNorm = Math.min(1, Math.max(0, moist));
          const orgNorm = Math.min(1, Math.max(0, organic / 35));

          // Solo pobre (marrom escuro) -> Nitrogênio seco (âmbar) -> Úmido infértil (azul-petróleo) -> Fértil N+H2O (esmeralda)
          const kBarren = (1 - nNorm) * (1 - mNorm);
          const kDryN = nNorm * (1 - mNorm);
          const kWetLowN = (1 - nNorm) * mNorm;
          const kFertile = nNorm * mNorm;

          let rVal = 56 * kBarren + 196 * kDryN + 38 * kWetLowN + 36 * kFertile + 20 * orgNorm;
          let gVal = 40 * kBarren + 152 * kDryN + 126 * kWetLowN + 224 * kFertile + 32 * orgNorm;
          let bVal = 28 * kBarren + 48 * kDryN + 162 * kWetLowN + 96 * kFertile + 16 * orgNorm;

          if (waterMix > 0) {
            rVal = rVal * (1 - waterMix) + 22 * waterMix;
            gVal = gVal * (1 - waterMix) + 68 * waterMix;
            bVal = bVal * (1 - waterMix) + 128 * waterMix;
          }

          const idx = (sy * lw + sx) * 4;
          data[idx]     = Math.max(0, Math.min(255, rVal | 0));
          data[idx + 1] = Math.max(0, Math.min(255, gVal | 0));
          data[idx + 2] = Math.max(0, Math.min(255, bVal | 0));
          data[idx + 3] = 255;
        }
      }
    }

    this._lensLowResCtx.putImageData(this._lensImgData, 0, 0);
    this._lensCtx.clearRect(0, 0, W, H);
    this._lensCtx.imageSmoothingEnabled = true;
    this._lensCtx.imageSmoothingQuality = 'high';
    this._lensCtx.drawImage(this._lensLowResCanvas, 0, 0, W, H);

    this._lastLensMode = mode;
    this._lastLensTick = tick;
    this._lastLensW = W;
    this._lastLensH = H;
    this._lastLensSeason = seasonIdx;
    this._lastLensClimate = climateOff;
    this._lastLensImpact = impactActive;
  }

  _getCellTemp(cell, globalTemp) {
    if (typeof cell.temperature === 'number') {
      return Math.abs(cell.temperature) > 3
        ? (cell.temperature - 18) / 16
        : cell.temperature;
    }
    const biomeOffset = (typeof cell.localTempOffset === 'number')
      ? cell.localTempOffset
      : (BIOME_TEMP_OFFSET[cell.biome] || 0);
    const elevOffset = ((cell.elevation ?? 0.5) - 0.5) * -0.25;
    return globalTemp + biomeOffset + elevOffset;
  }

  // ════════════════════════════════════════════════════
  // CATÁSTROFES (METEOROS & INVERNO DE IMPACTO)
  // ════════════════════════════════════════════════════

  _renderDisasters(ctx, engine, W, H) {
    if (engine.disasterEffects && engine.disasterEffects.length > 0) {
      for (let i = engine.disasterEffects.length - 1; i >= 0; i--) {
        const eff = engine.disasterEffects[i];
        if (eff.type === 'meteor') {
          if (eff.phase === 'falling') {
            eff.progress += eff.fallSpeed;
            const curX = eff.startX + (eff.targetX - eff.startX) * eff.progress;
            const curY = eff.startY + (eff.targetY - eff.startY) * eff.progress;

            ctx.save();
            ctx.strokeStyle = '#ff6f00';
            ctx.lineWidth = 6;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(eff.startX, eff.startY);
            ctx.lineTo(curX, curY);
            ctx.stroke();

            ctx.strokeStyle = '#fff9c4';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(curX - (eff.targetX - eff.startX) * 0.35, curY - (eff.targetY - eff.startY) * 0.35);
            ctx.lineTo(curX, curY);
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(curX, curY, 6, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = 'rgba(255, 87, 34, 0.6)';
            ctx.beginPath();
            ctx.arc(curX, curY, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            if (eff.progress >= 1.0) {
              eff.phase = 'exploding';
              if (!eff.executedImpact) {
                eff.executedImpact = true;
                engine.applyMeteorPhysicalImpact(eff);
              }
            }
          } else if (eff.phase === 'exploding') {
            eff.explosionAge++;
            const t = eff.explosionAge / eff.maxExplosionAge;

            ctx.save();
            if (eff.explosionAge <= 3) {
              ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
              ctx.fillRect(0, 0, W, H);
            }

            eff.shockwaveRadius = t * eff.maxShockwaveRadius;
            const shockAlpha = Math.max(0, 1.0 - t);
            ctx.strokeStyle = `rgba(255, 140, 0, ${shockAlpha})`;
            ctx.lineWidth = Math.max(1, 4.5 * (1.0 - t));
            ctx.beginPath();
            ctx.arc(eff.targetX, eff.targetY, eff.shockwaveRadius, 0, Math.PI * 2);
            ctx.stroke();

            if (t > 0.15) {
              const t2 = (t - 0.15) / 0.85;
              ctx.strokeStyle = `rgba(255, 215, 0, ${Math.max(0, 0.8 - t2)})`;
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(eff.targetX, eff.targetY, t2 * eff.maxShockwaveRadius * 0.75, 0, Math.PI * 2);
              ctx.stroke();
            }

            ctx.fillStyle = `rgba(255, 69, 0, ${Math.max(0, 0.75 - t * 0.75)})`;
            ctx.beginPath();
            ctx.arc(eff.targetX, eff.targetY, eff.craterRadiusPx * (0.8 + t * 0.2), 0, Math.PI * 2);
            ctx.fill();

            const particles = eff.particles;
            for (let pIdx = 0, pLen = particles.length; pIdx < pLen; pIdx++) {
              const p = particles[pIdx];
              p.x += p.vx;
              p.y += p.vy;
              p.life -= p.decay;
              if (p.life > 0) {
                ctx.fillStyle = p.color;
                ctx.globalAlpha = Math.max(0, p.life);
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
                ctx.fill();
              }
            }
            ctx.restore();

            if (eff.explosionAge >= eff.maxExplosionAge) {
              engine.disasterEffects.splice(i, 1);
            }
          }
        }
      }
    }

    if (engine.impactWinterTicks > 0) {
      ctx.save();
      const intensity = Math.min(1.0, engine.impactWinterTicks / 50.0);
      ctx.fillStyle = `rgba(45, 35, 30, ${0.30 * intensity})`;
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = 'rgba(200, 190, 180, 0.45)';
      const ashSeed = (engine.tickCount * 2) % 100;
      for (let s = 0; s < 22; s++) {
        const ax = ((s * 47 + ashSeed * 7) % W);
        const ay = ((s * 31 + engine.tickCount * 3) % H);
        ctx.fillRect(ax, ay, 2, 2);
      }
      ctx.restore();
    }
  }
}
