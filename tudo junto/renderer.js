// ====================================================
//  RENDERER.JS — Desenho de Criaturas, Plantas e Biomas
//  Suporta renderização procedural e imagens customizadas
// ====================================================

const ImageCache = {
  _cache: new Map(),

  /**
   * Obtém ou cria uma instância de Image a partir de uma URL/DataURL.
   * @param {string} src
   * @param {Function} [onLoadCallback]
   * @returns {HTMLImageElement|null}
   */
  get(src, onLoadCallback) {
    if (!src) return null;
    if (this._cache.has(src)) {
      const img = this._cache.get(src);
      if (img.complete && img.naturalWidth > 0) return img;
      if (onLoadCallback) img.addEventListener('load', onLoadCallback, { once: true });
      return null;
    }
    const img = new Image();
    img.src = src;
    this._cache.set(src, img);
    if (onLoadCallback) {
      img.addEventListener('load', onLoadCallback, { once: true });
    }
    return img.complete && img.naturalWidth > 0 ? img : null;
  }
};

/**
 * Desenha uma criatura (Animal) no Canvas.
 * Se houver imagens em customImages (body, limbs, jaw, eyes, detail),
 * usa as imagens importadas escalando-as dinamicamente pelos genes.
 */
function drawCreature(ctx, genes, cx, cy, scale = 1, customImages = {}, onImgLoaded = null) {
  const {
    size = 0.5,
    carnivore = 0.3,
    plant = 0.6,
    speed = 0.5,
    perception = 0.5,
    health = 0.5,
    thermal = 0.0,
    colorHue = 120,
    aggression = 0.3
  } = genes;

  const bodyR = (20 + size * 26) * scale;
  const saturation = 60 + carnivore * 30;
  const lightness  = 35 + health * 20;
  const bodyColor  = `hsl(${colorHue}, ${saturation}%, ${lightness}%)`;
  const darkBody   = `hsl(${colorHue}, ${saturation}%, ${lightness * 0.6}%)`;
  const eyeGlow    = `hsl(${colorHue}, 85%, 70%)`;

  let borderColor;
  if (thermal > 0.3)       borderColor = '#ffa65799';
  else if (thermal < -0.3) borderColor = '#79c0ff99';
  else                     borderColor = '#3fb95066';

  ctx.save();
  ctx.translate(cx, cy);

  // ── 1. MEMBROS / PATAS
  const legLen = (12 + speed * 26) * scale;
  const limbsImg = ImageCache.get(customImages.limbs, onImgLoaded);

  if (limbsImg) {
    const limbW = (18 + speed * 16) * scale;
    const limbH = legLen;
    // Desenha 4 patas nos 4 cantos
    const offsets = [
      { x: -bodyR * 0.6, y: -bodyR * 0.65, rot: -0.5 },
      { x:  bodyR * 0.6, y: -bodyR * 0.65, rot:  0.5 },
      { x: -bodyR * 0.6, y:  bodyR * 0.65, rot: -2.6 },
      { x:  bodyR * 0.6, y:  bodyR * 0.65, rot:  2.6 }
    ];
    offsets.forEach(pos => {
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(pos.rot);
      ctx.drawImage(limbsImg, -limbW / 2, 0, limbW, limbH);
      ctx.restore();
    });
  } else {
    // Procedural
    ctx.strokeStyle = darkBody;
    ctx.lineWidth   = (2.5 + size * 2) * scale;
    ctx.lineCap     = 'round';
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI / 2) + 0.45;
      const lx = Math.cos(angle) * bodyR * 0.75;
      const ly = Math.sin(angle) * bodyR * 0.75;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx + Math.cos(angle) * legLen, ly + Math.sin(angle) * legLen);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(lx + Math.cos(angle) * legLen, ly + Math.sin(angle) * legLen, (2.5 + size * 2) * scale, 0, Math.PI * 2);
      ctx.fillStyle = darkBody;
      ctx.fill();
    }
  }

  // ── 2. DETALHES / COBERTURA / ESPINHOS (atrás ou sob o corpo)
  const detailImg = ImageCache.get(customImages.detail, onImgLoaded);
  if (detailImg) {
    const detW = bodyR * 2.2;
    const detH = bodyR * 1.8;
    ctx.drawImage(detailImg, -detW / 2, -detH / 2, detW, detH);
  } else {
    // Espinhos procedurais (agressividade e carnívoro)
    if (aggression > 0.45 || carnivore > 0.55) {
      const spineCount = Math.round(4 + aggression * 6 + carnivore * 3);
      const spineLen   = (6 + aggression * 14 + carnivore * 8) * scale;
      ctx.strokeStyle  = `hsl(${colorHue}, 30%, 20%)`;
      ctx.lineWidth    = 1.8 * scale;
      for (let i = 0; i < spineCount; i++) {
        const a = (i / spineCount) * Math.PI * 2;
        const sx = Math.cos(a) * bodyR;
        const sy = Math.sin(a) * bodyR * 0.8;
        ctx.beginPath();
        ctx.moveTo(sx * 0.9, sy * 0.9);
        ctx.lineTo(sx + Math.cos(a) * spineLen, sy + Math.sin(a) * spineLen);
        ctx.stroke();
      }
    }
    // Pelagem para o frio
    if (thermal < -0.3) {
      const furOpacity = Math.min((-thermal - 0.3) * 1.5, 0.7);
      ctx.strokeStyle = `rgba(180, 215, 255, ${furOpacity})`;
      ctx.lineWidth   = 2 * scale;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const fx = Math.cos(a) * bodyR * 0.65;
        const fy = Math.sin(a) * bodyR * 0.55;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx + Math.cos(a + 0.4) * 8 * scale, fy + Math.sin(a + 0.4) * 8 * scale);
        ctx.stroke();
      }
    }
  }

  // ── 3. CORPO
  const bodyImg = ImageCache.get(customImages.body, onImgLoaded);
  if (bodyImg) {
    const bW = bodyR * 2.2;
    const bH = bodyR * 1.8;
    ctx.drawImage(bodyImg, -bW / 2, -bH / 2, bW, bH);
    // Borda indicadora de temperatura/clima
    ctx.beginPath();
    ctx.ellipse(0, 0, bodyR, bodyR * 0.8, 0, 0, Math.PI * 2);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 3 * scale;
    ctx.stroke();
  } else {
    // Procedural
    ctx.beginPath();
    ctx.ellipse(0, 0, bodyR, bodyR * 0.8, 0, 0, Math.PI * 2);
    ctx.fillStyle = bodyColor;
    ctx.fill();

    ctx.strokeStyle = borderColor;
    ctx.lineWidth   = 3.5 * scale;
    ctx.stroke();
  }

  // ── 4. MANDÍBULA / BOCA
  const jawSize = (5 + carnivore * 18) * scale;
  const jawImg = ImageCache.get(customImages.jaw, onImgLoaded);
  ctx.save();
  ctx.translate(bodyR * 0.72, 0);

  if (jawImg) {
    const jW = jawSize * 1.6;
    const jH = jawSize * 1.2;
    ctx.drawImage(jawImg, -jW * 0.3, -jH / 2, jW, jH);
  } else {
    // Procedural
    ctx.fillStyle = `hsl(${colorHue + 15}, 65%, 22%)`;
    ctx.beginPath();
    ctx.ellipse(0, -jawSize * 0.4, jawSize * 0.65, jawSize * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0,  jawSize * 0.4, jawSize * 0.65, jawSize * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    if (carnivore > 0.45) {
      ctx.fillStyle = '#ffffff';
      for (let t = -1; t <= 1; t++) {
        ctx.beginPath();
        ctx.moveTo(-jawSize * 0.2 + t * jawSize * 0.3, 0);
        ctx.lineTo(-jawSize * 0.2 + t * jawSize * 0.3 + jawSize * 0.1, -jawSize * 0.4);
        ctx.lineTo(-jawSize * 0.2 + t * jawSize * 0.3 + jawSize * 0.2, 0);
        ctx.fill();
      }
    }
  }
  ctx.restore();

  // ── 5. OLHOS
  const eyeR = (3.5 + perception * 10) * scale;
  const eyesImg = ImageCache.get(customImages.eyes, onImgLoaded);
  const eyeOffY = bodyR * 0.45;
  const eyeOffX = bodyR * 0.38;

  if (eyesImg) {
    const eSize = eyeR * 2.2;
    ctx.drawImage(eyesImg, eyeOffX - eSize/2, -eyeOffY - eSize/2, eSize, eSize);
    ctx.drawImage(eyesImg, eyeOffX - eSize/2,  eyeOffY - eSize/2, eSize, eSize);
  } else {
    [-1, 1].forEach(side => {
      const ex = eyeOffX, ey = side * eyeOffY;
      ctx.beginPath();
      ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
      ctx.fillStyle = '#161b22';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(ex + eyeR * 0.2, ey, eyeR * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = eyeGlow;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(ex + eyeR * 0.35, ey - eyeR * 0.3, eyeR * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    });
  }

  ctx.restore();
}

/**
 * Desenha uma Planta botânica no Canvas.
 * Suporta imagens customizadas para (roots, stem, leaves, thorns, fruit).
 */
function drawPlant(ctx, genes, cx, cy, scale = 1, customImages = {}, onImgLoaded = null) {
  const {
    height = 0.5,
    rootEfficiency = 0.5,
    growthSpeed = 0.5,
    defense = 0.3,
    fruitAttraction = 0.4,
    parasiteResistance = 0.5,
    thermal = 0.0,
    colorHue = 110
  } = genes;

  const stemHeight = (30 + height * 70) * scale;
  const stemWidth  = (6 + height * 8) * scale;
  const leafColor  = `hsl(${colorHue}, 70%, ${35 + growthSpeed * 20}%)`;
  const stemColor  = `hsl(${colorHue - 25}, 45%, 25%)`;
  const fruitColor = `hsl(${(colorHue + 140) % 360}, 85%, 55%)`;

  ctx.save();
  ctx.translate(cx, cy);

  // ── 1. RAÍZES (para baixo a partir de 0, 0)
  const rootsImg = ImageCache.get(customImages.roots, onImgLoaded);
  const rootDepth = (12 + rootEfficiency * 40) * scale;
  const rootSpread = (16 + rootEfficiency * 35) * scale;

  if (rootsImg) {
    ctx.drawImage(rootsImg, -rootSpread, 0, rootSpread * 2, rootDepth);
  } else {
    ctx.strokeStyle = '#5a3d1c';
    ctx.lineWidth = (2 + rootEfficiency * 2) * scale;
    ctx.lineCap = 'round';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 4 * scale, 0);
      ctx.quadraticCurveTo(
        i * (rootSpread * 0.6), rootDepth * 0.5,
        i * rootSpread, rootDepth
      );
      ctx.stroke();
    }
  }

  // Linha do solo de referência
  ctx.strokeStyle = '#2d333b';
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(-70 * scale, 0);
  ctx.lineTo(70 * scale, 0);
  ctx.stroke();

  // ── 2. CAULE / TRONCO (para cima)
  const stemImg = ImageCache.get(customImages.stem, onImgLoaded);
  if (stemImg) {
    ctx.drawImage(stemImg, -stemWidth * 1.5, -stemHeight, stemWidth * 3, stemHeight);
  } else {
    ctx.fillStyle = stemColor;
    ctx.beginPath();
    ctx.moveTo(-stemWidth, 0);
    ctx.lineTo(-stemWidth * 0.6, -stemHeight);
    ctx.lineTo( stemWidth * 0.6, -stemHeight);
    ctx.lineTo( stemWidth, 0);
    ctx.closePath();
    ctx.fill();
  }

  // ── 3. ESPINHOS / DEFESA
  const thornsImg = ImageCache.get(customImages.thorns, onImgLoaded);
  if (thornsImg && defense > 0.15) {
    const tSize = (10 + defense * 20) * scale;
    ctx.drawImage(thornsImg, -tSize * 1.5, -stemHeight * 0.7, tSize * 3, tSize);
  } else if (defense > 0.25) {
    ctx.strokeStyle = '#9e2a2b';
    ctx.lineWidth = 2 * scale;
    const thornCount = Math.round(3 + defense * 7);
    for (let i = 1; i <= thornCount; i++) {
      const y = -stemHeight * (i / (thornCount + 1));
      const side = (i % 2 === 0 ? 1 : -1);
      const len = (4 + defense * 10) * scale;
      ctx.beginPath();
      ctx.moveTo(side * stemWidth * 0.7, y);
      ctx.lineTo(side * (stemWidth * 0.7 + len), y - 4 * scale);
      ctx.stroke();
    }
  }

  // ── 4. FOLHAS / COPA
  const leavesImg = ImageCache.get(customImages.leaves, onImgLoaded);
  const foliageR  = (18 + height * 28 + growthSpeed * 15) * scale;
  const topY      = -stemHeight;

  ctx.save();
  ctx.translate(0, topY);

  if (leavesImg) {
    const lW = foliageR * 2.4;
    const lH = foliageR * 2;
    ctx.drawImage(leavesImg, -lW / 2, -lH * 0.7, lW, lH);
  } else {
    ctx.fillStyle = leafColor;
    const numLeaves = 5;
    for (let i = 0; i < numLeaves; i++) {
      const angle = (i / numLeaves) * Math.PI * 2;
      const lx = Math.cos(angle) * foliageR * 0.55;
      const ly = Math.sin(angle) * foliageR * 0.55;
      ctx.beginPath();
      ctx.ellipse(lx, ly, foliageR * 0.65, foliageR * 0.45, angle, 0, Math.PI * 2);
      ctx.fill();
    }
    // Folha central destacada
    ctx.beginPath();
    ctx.arc(0, 0, foliageR * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${colorHue + 10}, 75%, 45%)`;
    ctx.fill();
  }

  // ── 5. FRUTOS / FLORES
  if (fruitAttraction > 0.15) {
    const fruitImg = ImageCache.get(customImages.fruit, onImgLoaded);
    const fruitR = (4 + fruitAttraction * 14) * scale;
    const fruitCount = Math.round(2 + fruitAttraction * 4);

    if (fruitImg) {
      for (let f = 0; f < fruitCount; f++) {
        const a = (f / fruitCount) * Math.PI * 2 + 0.3;
        const fx = Math.cos(a) * (foliageR * 0.75);
        const fy = Math.sin(a) * (foliageR * 0.65);
        const fSize = fruitR * 2;
        ctx.drawImage(fruitImg, fx - fSize/2, fy - fSize/2, fSize, fSize);
      }
    } else {
      ctx.fillStyle = fruitColor;
      ctx.strokeStyle = '#ffffff44';
      ctx.lineWidth = 1.5 * scale;
      for (let f = 0; f < fruitCount; f++) {
        const a = (f / fruitCount) * Math.PI * 2 + 0.3;
        const fx = Math.cos(a) * (foliageR * 0.75);
        const fy = Math.sin(a) * (foliageR * 0.65);
        ctx.beginPath();
        ctx.arc(fx, fy, fruitR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  ctx.restore();
  ctx.restore();
}

/**
 * Desenha a miniatura do mapa/bioma no Canvas.
 */
function drawWorldPreview(ctx, type, w, h) {
  const rand = (seed, min, max) => {
    let s = Math.sin(seed * 9301 + 49297) * 233280;
    return min + (s - Math.floor(s)) * (max - min);
  };

  ctx.clearRect(0, 0, w, h);

  const BIOME_COLORS = {
    water:   '#183a66',
    fertile: '#1a521a',
    dry:     '#756128',
    rocky:   '#3e4347',
  };

  const WORLD_CONFIGS = {
    random:   { water: 0.22, fertile: 0.38, dry: 0.22, rocky: 0.18 },
    islands:  { water: 0.58, fertile: 0.28, dry: 0.08, rocky: 0.06 },
    savanna:  { water: 0.06, fertile: 0.16, dry: 0.64, rocky: 0.14 },
    fertile:  { water: 0.14, fertile: 0.68, dry: 0.08, rocky: 0.10 },
    desert:   { water: 0.02, fertile: 0.06, dry: 0.78, rocky: 0.14 },
    frozen:   { water: 0.28, fertile: 0.05, dry: 0.07, rocky: 0.60 },
  };

  const cfg = WORLD_CONFIGS[type] || WORLD_CONFIGS.random;
  const biomes = Object.keys(cfg);
  const CELL = 12;
  const cols = Math.ceil(w / CELL);
  const rows = Math.ceil(h / CELL);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const v = rand(idx + type.charCodeAt(0) * 88, 0, 1);
      let cum = 0, chosen = biomes[0];
      for (const b of biomes) {
        cum += cfg[b];
        if (v < cum) { chosen = b; break; }
      }
      ctx.fillStyle = BIOME_COLORS[chosen];
      ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
    }
  }

  // Gradiente vinheta
  const grad = ctx.createRadialGradient(w/2, h/2, h*0.2, w/2, h/2, h*0.75);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}
