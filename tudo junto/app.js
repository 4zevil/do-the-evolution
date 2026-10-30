// ====================================================
//  APP.JS — LÓGICA DO MENU, CRIADORES E SIMULAÇÃO
//  Com:
//  - Auto-Equilíbrio Trófico (Elton, Lindeman & Kleiber)
//  - Ações do Modal de Extinção (Mundo, Reset, Gráficos)
// ====================================================

// ── NAVEGAÇÃO DE PÁGINAS ────────────────────────────
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + pageId);
  if (target) {
    target.classList.add('active');
    window.scrollTo(0, 0);
  }

  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === pageId);
  });

  if (pageId !== 'simulation' && typeof engine !== 'undefined' && engine.isRunning) {
    engine.pause();
    updatePlayPauseButtonUI(false);
  }

  if (pageId === 'species') renderAnimalPreview();
  if (pageId === 'plants')  renderPlantPreview();
  if (pageId === 'world')   refreshWorldSpeciesCounts();
  if (pageId === 'simulation') startOrResumeSimulation();
}

function toast(msg, duration = 3000) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => el.classList.remove('show'), duration);
}

// ====================================================
//  1. CRIADOR DE ANIMAIS
// ====================================================
const DEFAULT_ANIMAL_GENES = {
  size: 0.5,
  diet: { meat: 0.3, plant: 0.6, carcass: 0.1 },
  speed: 0.5,
  perception: 0.5,
  gestation: 0.4,
  offspringCount: 0.4,
  aggression: 0.3,
  health: 0.5,
  thermal: 0.0,
  colorHue: 120
};

let currentAnimalGenes = JSON.parse(JSON.stringify(DEFAULT_ANIMAL_GENES));
let currentAnimalImages = { body: null, limbs: null, jaw: null, eyes: null, detail: null };
let savedAnimals = [];
let animalCanvas, animalCtx;

function initAnimalCreator() {
  animalCanvas = document.getElementById('animal-canvas');
  if (!animalCanvas) return;
  animalCtx = animalCanvas.getContext('2d');

  try {
    savedAnimals = JSON.parse(localStorage.getItem('evo_animals') || '[]');
  } catch {
    savedAnimals = [];
  }
  renderSavedAnimalsList();

  document.querySelectorAll('#animal-attrs [data-gene]').forEach(el => {
    el.addEventListener('input', () => {
      const g = el.dataset.gene;
      currentAnimalGenes[g] = parseFloat(el.value);
      updateAnimalSliderLabel(el);
      renderAnimalPreview();
    });
  });

  syncDietSlidersUI();

  ['body', 'limbs', 'jaw', 'eyes', 'detail'].forEach(part => {
    const input = document.getElementById(`upload-animal-${part}`);
    if (input) {
      input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          currentAnimalImages[part] = evt.target.result;
          updateComponentBox('animal', part, evt.target.result);
          renderAnimalPreview();
          toast(`✅ Componente "${part}" importado!`);
        };
        reader.readAsDataURL(file);
      });
    }
  });

  renderAnimalPreview();
}

function updateAnimalSliderLabel(el) {
  const g = el.dataset.gene;
  const label = el.closest('.attr-row').querySelector('label span');
  const val = parseFloat(el.value);

  if (g === 'thermal') {
    const icon = val > 0.25 ? '🔥 Calor' : val < -0.25 ? '❄️ Frio' : '🌿 Neutro';
    label.textContent = `${icon} (${val > 0 ? '+' : ''}${val.toFixed(2)})`;
    const col = val > 0.25 ? '#ffa657' : val < -0.25 ? '#79c0ff' : '#3fb950';
    el.closest('.attr-row').style.setProperty('--thermal-color', col);
  } else if (g === 'colorHue') {
    label.textContent = `${Math.round(val)}°`;
    label.style.color = `hsl(${val}, 75%, 65%)`;
  } else {
    label.textContent = Math.round(val * 100) + '%';
  }
}

function updateStrictDietUI(changedKey, val) {
  let newVal = parseFloat(val);
  if (!currentAnimalGenes.diet) {
    currentAnimalGenes.diet = { meat: 0.3, plant: 0.6, carcass: 0.1 };
  }
  currentAnimalGenes.diet[changedKey] = newVal;

  const keys = ['meat', 'plant', 'carcass'];
  const otherKeys = keys.filter(k => k !== changedKey);
  let sumOthers = otherKeys.reduce((acc, k) => acc + currentAnimalGenes.diet[k], 0);
  let targetOthers = Math.max(0, 1.0 - newVal);

  if (sumOthers > 0) {
    otherKeys.forEach(k => {
      currentAnimalGenes.diet[k] = parseFloat((currentAnimalGenes.diet[k] * (targetOthers / sumOthers)).toFixed(2));
    });
  } else {
    otherKeys.forEach(k => {
      currentAnimalGenes.diet[k] = parseFloat((targetOthers / otherKeys.length).toFixed(2));
    });
  }

  const finalSum = keys.reduce((acc, k) => acc + currentAnimalGenes.diet[k], 0);
  if (finalSum !== 1.0) {
    currentAnimalGenes.diet[otherKeys[0]] = parseFloat((currentAnimalGenes.diet[otherKeys[0]] + (1.0 - finalSum)).toFixed(2));
  }

  syncDietSlidersUI();
  renderAnimalPreview();
}

function syncDietSlidersUI() {
  if (!currentAnimalGenes.diet) {
    currentAnimalGenes.diet = { meat: 0.3, plant: 0.6, carcass: 0.1 };
  }
  const keys = ['meat', 'plant', 'carcass'];
  keys.forEach(k => {
    const inputEl = document.querySelector(`#animal-attrs [data-diet="${k}"]`);
    if (inputEl) {
      inputEl.value = currentAnimalGenes.diet[k];
      const spanEl = inputEl.closest('.attr-row').querySelector('label span');
      if (spanEl) spanEl.textContent = Math.round(currentAnimalGenes.diet[k] * 100) + '%';
    }
  });

  const totalLabel = document.getElementById('diet-total-label');
  if (totalLabel) {
    const totalPct = Math.round(keys.reduce((acc, k) => acc + currentAnimalGenes.diet[k], 0) * 100);
    totalLabel.textContent = totalPct + '%';
  }
}

function renderAnimalPreview() {
  if (!animalCanvas) return;
  const W = animalCanvas.width, H = animalCanvas.height;
  animalCtx.clearRect(0, 0, W, H);

  animalCtx.fillStyle = '#09130c';
  animalCtx.fillRect(0, 0, W, H);
  animalCtx.strokeStyle = '#142718';
  animalCtx.lineWidth = 1;
  for (let x = 0; x < W; x += 36) {
    animalCtx.beginPath(); animalCtx.moveTo(x, 0); animalCtx.lineTo(x, H); animalCtx.stroke();
  }
  for (let y = 0; y < H; y += 36) {
    animalCtx.beginPath(); animalCtx.moveTo(0, y); animalCtx.lineTo(W, y); animalCtx.stroke();
  }

  const diet = currentAnimalGenes.diet || { meat: 0.3, plant: 0.6, carcass: 0.1 };

  drawCreature(animalCtx, currentAnimalGenes, W / 2, H / 2, 1.45, currentAnimalImages, () => {
    renderAnimalPreview();
  });

  animalCtx.fillStyle = 'rgba(13, 17, 23, 0.75)';
  animalCtx.fillRect(0, H - 28, W, 28);
  animalCtx.fillStyle = '#8b949e';
  animalCtx.font = '11px system-ui';
  animalCtx.fillText(
    `Tam: ${Math.round(currentAnimalGenes.size*100)}% | Vel: ${Math.round(currentAnimalGenes.speed*100)}% | Carne: ${Math.round(diet.meat*100)}% | Planta: ${Math.round(diet.plant*100)}%`,
    12, H - 10
  );
}

function clearComponentImage(type, part) {
  if (type === 'animal') {
    currentAnimalImages[part] = null;
    updateComponentBox('animal', part, null);
    const input = document.getElementById(`upload-animal-${part}`);
    if (input) input.value = '';
    renderAnimalPreview();
  } else {
    currentPlantImages[part] = null;
    updateComponentBox('plant', part, null);
    const input = document.getElementById(`upload-plant-${part}`);
    if (input) input.value = '';
    renderPlantPreview();
  }
  toast(`🗑️ Componente "${part}" restaurado.`);
}

function updateComponentBox(type, part, dataUrl) {
  const box = document.getElementById(`box-${type}-${part}`);
  if (!box) return;
  if (dataUrl) {
    box.innerHTML = `<img src="${dataUrl}" alt="${part}" />`;
    box.style.borderColor = 'var(--accent)';
  } else {
    box.innerHTML = `<span class="placeholder-icon">🎨</span>`;
    box.style.borderColor = 'var(--border)';
  }
}

function switchAnimalSidebarTab(tab) {
  document.querySelectorAll('#page-species .panel-subnav button').forEach(b => b.classList.remove('active'));
  document.getElementById(`btn-animal-tab-${tab}`).classList.add('active');
  document.getElementById('animal-tab-attrs').style.display = tab === 'attrs' ? 'block' : 'none';
  document.getElementById('animal-tab-components').style.display = tab === 'components' ? 'block' : 'none';
}

function saveAnimalSpecies() {
  const nameEl = document.getElementById('animal-name');
  const name = nameEl.value.trim() || `Animal ${savedAnimals.length + 1}`;

  const mini = document.createElement('canvas');
  mini.width = 80; mini.height = 80;
  const mCtx = mini.getContext('2d');
  mCtx.fillStyle = '#09130c';
  mCtx.fillRect(0, 0, 80, 80);
  drawCreature(mCtx, currentAnimalGenes, 40, 40, 0.75, currentAnimalImages);
  const thumbnail = mini.toDataURL('image/png');

  const entry = {
    id: 'a_' + Date.now(),
    type: 'animal',
    name,
    genes: JSON.parse(JSON.stringify(currentAnimalGenes)),
    customImages: { ...currentAnimalImages },
    thumbnail
  };

  savedAnimals.push(entry);
  localStorage.setItem('evo_animals', JSON.stringify(savedAnimals));

  nameEl.value = '';
  renderSavedAnimalsList();
  refreshWorldSpeciesCounts();
  toast(`🦊 Espécie animal "${name}" salva com sucesso!`);
}

function exportAnimalPNG() {
  const nameEl = document.getElementById('animal-name');
  const name = (nameEl.value.trim() || 'especie_animal').replace(/\s+/g, '_');

  const exp = document.createElement('canvas');
  exp.width = 450; exp.height = 450;
  const eCtx = exp.getContext('2d');
  eCtx.fillStyle = '#09130c';
  eCtx.fillRect(0, 0, 450, 450);
  drawCreature(eCtx, currentAnimalGenes, 225, 225, 3.6, currentAnimalImages);

  const a = document.createElement('a');
  a.href = exp.toDataURL('image/png');
  a.download = `${name}_sprite.png`;
  a.click();
  toast(`🖼️ Sprite PNG de "${name}" exportado!`);
}

function renderSavedAnimalsList() {
  const list = document.getElementById('saved-animals-list');
  if (!list) return;
  list.innerHTML = '';

  if (savedAnimals.length === 0) {
    list.innerHTML = '<span style="color:var(--text-dim);font-size:12px;">Nenhum animal salvo ainda.</span>';
    return;
  }

  savedAnimals.forEach((sp, idx) => {
    const item = document.createElement('div');
    item.className = 'saved-item';
    item.innerHTML = `
      <img src="${sp.thumbnail}" width="36" height="36" />
      <span class="saved-name">${sp.name}</span>
      <button class="btn btn-secondary btn-sm" onclick="loadAnimal(${idx})">↩ Carregar</button>
      <button class="btn btn-secondary btn-sm" onclick="downloadAnimalPNG(${idx})">⬇ PNG</button>
      <button class="btn btn-danger btn-sm" onclick="deleteAnimal(${idx})">✕</button>
    `;
    list.appendChild(item);
  });
}

function loadAnimal(idx) {
  const sp = savedAnimals[idx];
  currentAnimalGenes = JSON.parse(JSON.stringify(sp.genes));
  if (!currentAnimalGenes.diet) {
    currentAnimalGenes.diet = { meat: 0.3, plant: 0.6, carcass: 0.1 };
  }
  currentAnimalImages = { ...(sp.customImages || {}) };

  document.querySelectorAll('#animal-attrs [data-gene]').forEach(el => {
    if (currentAnimalGenes[el.dataset.gene] !== undefined) {
      el.value = currentAnimalGenes[el.dataset.gene];
      updateAnimalSliderLabel(el);
    }
  });

  syncDietSlidersUI();

  ['body', 'limbs', 'jaw', 'eyes', 'detail'].forEach(part => {
    updateComponentBox('animal', part, currentAnimalImages[part]);
  });

  document.getElementById('animal-name').value = sp.name;
  renderAnimalPreview();
  toast(`↩ Animal "${sp.name}" carregado.`);
}

function deleteAnimal(idx) {
  const name = savedAnimals[idx].name;
  savedAnimals.splice(idx, 1);
  localStorage.setItem('evo_animals', JSON.stringify(savedAnimals));
  renderSavedAnimalsList();
  refreshWorldSpeciesCounts();
  toast(`🗑️ Animal "${name}" removido.`);
}

function downloadAnimalPNG(idx) {
  const sp = savedAnimals[idx];
  const a = document.createElement('a');
  a.href = sp.thumbnail;
  a.download = `${sp.name.replace(/\s+/g, '_')}_thumb.png`;
  a.click();
  toast(`⬇️ PNG de "${sp.name}" baixado.`);
}

function randomizeAnimalGenes() {
  Object.keys(DEFAULT_ANIMAL_GENES).forEach(g => {
    if (g === 'colorHue') currentAnimalGenes[g] = Math.round(Math.random() * 360);
    else if (g === 'thermal') currentAnimalGenes[g] = parseFloat((Math.random() * 2 - 1).toFixed(2));
    else if (g === 'diet') {
      let m = Math.random(), p = Math.random(), c = Math.random();
      let tot = m + p + c;
      currentAnimalGenes.diet = {
        meat: parseFloat((m/tot).toFixed(2)),
        plant: parseFloat((p/tot).toFixed(2)),
        carcass: parseFloat((c/tot).toFixed(2))
      };
    } else {
      currentAnimalGenes[g] = parseFloat(Math.random().toFixed(2));
    }
  });

  document.querySelectorAll('#animal-attrs [data-gene]').forEach(el => {
    el.value = currentAnimalGenes[el.dataset.gene];
    updateAnimalSliderLabel(el);
  });
  syncDietSlidersUI();
  renderAnimalPreview();
  toast('🎲 Genes animais aleatorizados!');
}

function resetAnimalGenes() {
  currentAnimalGenes = JSON.parse(JSON.stringify(DEFAULT_ANIMAL_GENES));
  document.querySelectorAll('#animal-attrs [data-gene]').forEach(el => {
    el.value = currentAnimalGenes[el.dataset.gene];
    updateAnimalSliderLabel(el);
  });
  syncDietSlidersUI();
  renderAnimalPreview();
  toast('🔄 Genes animais resetados para o padrão.');
}

// ====================================================
//  2. CRIADOR DE PLANTAS
// ====================================================
const DEFAULT_PLANT_GENES = {
  height: 0.5,
  rootEfficiency: 0.5,
  growthSpeed: 0.5,
  defense: 0.3,
  fruitAttraction: 0.4,
  parasiteResistance: 0.5,
  thermal: 0.0,
  colorHue: 110
};

let currentPlantGenes = { ...DEFAULT_PLANT_GENES };
let currentPlantImages = { roots: null, stem: null, leaves: null, thorns: null, fruit: null };
let savedPlants = [];
let plantCanvas, plantCtx;

function initPlantCreator() {
  plantCanvas = document.getElementById('plant-canvas');
  if (!plantCanvas) return;
  plantCtx = plantCanvas.getContext('2d');

  try {
    savedPlants = JSON.parse(localStorage.getItem('evo_plants') || '[]');
  } catch {
    savedPlants = [];
  }
  renderSavedPlantsList();

  document.querySelectorAll('#plant-attrs [data-gene]').forEach(el => {
    el.addEventListener('input', () => {
      const g = el.dataset.gene;
      currentPlantGenes[g] = parseFloat(el.value);
      updatePlantSliderLabel(el);
      renderPlantPreview();
    });
  });

  ['roots', 'stem', 'leaves', 'thorns', 'fruit'].forEach(part => {
    const input = document.getElementById(`upload-plant-${part}`);
    if (input) {
      input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          currentPlantImages[part] = evt.target.result;
          updateComponentBox('plant', part, evt.target.result);
          renderPlantPreview();
          toast(`✅ Componente botânico "${part}" importado!`);
        };
        reader.readAsDataURL(file);
      });
    }
  });

  renderPlantPreview();
}

function updatePlantSliderLabel(el) {
  const g = el.dataset.gene;
  const label = el.closest('.attr-row').querySelector('label span');
  const val = parseFloat(el.value);

  if (g === 'thermal') {
    const icon = val > 0.25 ? '🔥 Calor' : val < -0.25 ? '❄️ Frio' : '🌿 Neutro';
    label.textContent = `${icon} (${val > 0 ? '+' : ''}${val.toFixed(2)})`;
    const col = val > 0.25 ? '#ffa657' : val < -0.25 ? '#79c0ff' : '#3fb950';
    el.closest('.attr-row').style.setProperty('--thermal-color', col);
  } else if (g === 'colorHue') {
    label.textContent = `${Math.round(val)}°`;
    label.style.color = `hsl(${val}, 75%, 65%)`;
  } else {
    label.textContent = Math.round(val * 100) + '%';
  }
}

function renderPlantPreview() {
  if (!plantCanvas) return;
  const W = plantCanvas.width, H = plantCanvas.height;
  plantCtx.clearRect(0, 0, W, H);

  plantCtx.fillStyle = '#09130c';
  plantCtx.fillRect(0, 0, W, H);
  plantCtx.strokeStyle = '#142718';
  plantCtx.lineWidth = 1;
  for (let x = 0; x < W; x += 36) {
    plantCtx.beginPath(); plantCtx.moveTo(x, 0); plantCtx.lineTo(x, H); plantCtx.stroke();
  }
  for (let y = 0; y < H; y += 36) {
    plantCtx.beginPath(); plantCtx.moveTo(0, y); plantCtx.lineTo(W, y); plantCtx.stroke();
  }

  const groundY = H * 0.68;
  drawPlant(plantCtx, currentPlantGenes, W / 2, groundY, 1.45, currentPlantImages, () => {
    renderPlantPreview();
  });

  plantCtx.fillStyle = 'rgba(13, 17, 23, 0.75)';
  plantCtx.fillRect(0, H - 28, W, 28);
  plantCtx.fillStyle = '#8b949e';
  plantCtx.font = '11px system-ui';
  plantCtx.fillText(
    `Altura: ${Math.round(currentPlantGenes.height*100)}% | Raiz: ${Math.round(currentPlantGenes.rootEfficiency*100)}% | Defesa: ${Math.round(currentPlantGenes.defense*100)}% | Fruto: ${Math.round(currentPlantGenes.fruitAttraction*100)}%`,
    12, H - 10
  );
}

function switchPlantSidebarTab(tab) {
  document.querySelectorAll('#page-plants .panel-subnav button').forEach(b => b.classList.remove('active'));
  document.getElementById(`btn-plant-tab-${tab}`).classList.add('active');
  document.getElementById('plant-tab-attrs').style.display = tab === 'attrs' ? 'block' : 'none';
  document.getElementById('plant-tab-components').style.display = tab === 'components' ? 'block' : 'none';
}

function savePlantSpecies() {
  const nameEl = document.getElementById('plant-name');
  const name = nameEl.value.trim() || `Planta ${savedPlants.length + 1}`;

  const mini = document.createElement('canvas');
  mini.width = 80; mini.height = 80;
  const mCtx = mini.getContext('2d');
  mCtx.fillStyle = '#09130c';
  mCtx.fillRect(0, 0, 80, 80);
  drawPlant(mCtx, currentPlantGenes, 40, 56, 0.65, currentPlantImages);
  const thumbnail = mini.toDataURL('image/png');

  const entry = {
    id: 'p_' + Date.now(),
    type: 'plant',
    name,
    genes: { ...currentPlantGenes },
    customImages: { ...currentPlantImages },
    thumbnail
  };

  savedPlants.push(entry);
  localStorage.setItem('evo_plants', JSON.stringify(savedPlants));

  nameEl.value = '';
  renderSavedPlantsList();
  refreshWorldSpeciesCounts();
  toast(`🌿 Espécie vegetal "${name}" salva com sucesso!`);
}

function exportPlantPNG() {
  const nameEl = document.getElementById('plant-name');
  const name = (nameEl.value.trim() || 'especie_planta').replace(/\s+/g, '_');

  const exp = document.createElement('canvas');
  exp.width = 450; exp.height = 450;
  const eCtx = exp.getContext('2d');
  eCtx.fillStyle = '#09130c';
  eCtx.fillRect(0, 0, 450, 450);
  drawPlant(eCtx, currentPlantGenes, 225, 310, 3.2, currentPlantImages);

  const a = document.createElement('a');
  a.href = exp.toDataURL('image/png');
  a.download = `${name}_planta_sprite.png`;
  a.click();
  toast(`🖼️ Sprite PNG de "${name}" exportado!`);
}

function renderSavedPlantsList() {
  const list = document.getElementById('saved-plants-list');
  if (!list) return;
  list.innerHTML = '';

  if (savedPlants.length === 0) {
    list.innerHTML = '<span style="color:var(--text-dim);font-size:12px;">Nenhuma planta salva ainda.</span>';
    return;
  }

  savedPlants.forEach((sp, idx) => {
    const item = document.createElement('div');
    item.className = 'saved-item';
    item.innerHTML = `
      <img src="${sp.thumbnail}" width="36" height="36" />
      <span class="saved-name">${sp.name}</span>
      <button class="btn btn-secondary btn-sm" onclick="loadPlant(${idx})">↩ Carregar</button>
      <button class="btn btn-secondary btn-sm" onclick="downloadPlantPNG(${idx})">⬇ PNG</button>
      <button class="btn btn-danger btn-sm" onclick="deletePlant(${idx})">✕</button>
    `;
    list.appendChild(item);
  });
}

function loadPlant(idx) {
  const sp = savedPlants[idx];
  currentPlantGenes = { ...sp.genes };
  currentPlantImages = { ...(sp.customImages || {}) };

  document.querySelectorAll('#plant-attrs [data-gene]').forEach(el => {
    el.value = currentPlantGenes[el.dataset.gene];
    updatePlantSliderLabel(el);
  });

  ['roots', 'stem', 'leaves', 'thorns', 'fruit'].forEach(part => {
    updateComponentBox('plant', part, currentPlantImages[part]);
  });

  document.getElementById('plant-name').value = sp.name;
  renderPlantPreview();
  toast(`↩ Planta "${sp.name}" carregada.`);
}

function deletePlant(idx) {
  const name = savedPlants[idx].name;
  savedPlants.splice(idx, 1);
  localStorage.setItem('evo_plants', JSON.stringify(savedPlants));
  renderSavedPlantsList();
  refreshWorldSpeciesCounts();
  toast(`🗑️ Planta "${name}" removida.`);
}

function downloadPlantPNG(idx) {
  const sp = savedPlants[idx];
  const a = document.createElement('a');
  a.href = sp.thumbnail;
  a.download = `${sp.name.replace(/\s+/g, '_')}_thumb.png`;
  a.click();
  toast(`⬇️ PNG de "${sp.name}" baixado.`);
}

function randomizePlantGenes() {
  Object.keys(DEFAULT_PLANT_GENES).forEach(g => {
    if (g === 'colorHue') currentPlantGenes[g] = Math.round(Math.random() * 360);
    else if (g === 'thermal') currentPlantGenes[g] = parseFloat((Math.random() * 2 - 1).toFixed(2));
    else currentPlantGenes[g] = parseFloat(Math.random().toFixed(2));
  });

  document.querySelectorAll('#plant-attrs [data-gene]').forEach(el => {
    el.value = currentPlantGenes[el.dataset.gene];
    updatePlantSliderLabel(el);
  });
  renderPlantPreview();
  toast('🎲 Genes botânicos aleatorizados!');
}

function resetPlantGenes() {
  currentPlantGenes = { ...DEFAULT_PLANT_GENES };
  document.querySelectorAll('#plant-attrs [data-gene]').forEach(el => {
    el.value = currentPlantGenes[el.dataset.gene];
    updatePlantSliderLabel(el);
  });
  renderPlantPreview();
  toast('🔄 Genes botânicos resetados para o padrão.');
}

// ====================================================
//  3. CONFIGURADOR DE MUNDOS NOVOS E POPULAÇÃO
// ====================================================

const WORLD_BIOMES = [
  { id: 'random',  name: 'Aleatório',     desc: 'Biomas misturados organicamente por ruído fractal' },
  { id: 'islands', name: 'Arquipélago',   desc: 'Ilhas férteis cercadas por oceanos de água azul' },
  { id: 'savanna', name: 'Savana Mista',  desc: 'Planícies secas, arbustos esparsos e oásis' },
  { id: 'fertile', name: 'Vale Fértil',   desc: 'Solo fértil, alta umidade, lagos e floresta densa' },
  { id: 'desert',  name: 'Deserto Árido', desc: 'Solos arenosos e rochosos sob calor abrasador' },
  { id: 'frozen',  name: 'Tundra Gelada', desc: 'Gelo, solos rochosos e baixas temperaturas' },
];

const STARTER_ANIMALS = [
  {
    id: 'starter_rabbit',
    name: 'Coelho Veloz',
    isStarter: true,
    thumbnail: null,
    defaultCount: 20,
    genes: {
      size: 0.30,
      diet: { meat: 0.0, plant: 0.95, carcass: 0.05 },
      speed: 0.80,
      perception: 0.65,
      gestation: 0.25,
      offspringCount: 0.80,
      aggression: 0.10,
      health: 0.45,
      thermal: 0.0,
      colorHue: 40
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
      speed: 0.70,
      perception: 0.85,
      gestation: 0.45,
      offspringCount: 0.40,
      aggression: 0.75,
      health: 0.65,
      thermal: 0.0,
      colorHue: 15
    },
    customImages: {}
  }
];

const STARTER_PLANTS = [
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

let selectedBiomeId = 'random';
let worldSpeciesSelection = {
  animals: {},
  plants: {}
};

function getSpeciesThumbnail(type, sp) {
  if (sp.thumbnail) return sp.thumbnail;
  const offscreen = document.createElement('canvas');
  offscreen.width = 44;
  offscreen.height = 44;
  const ctx = offscreen.getContext('2d');
  ctx.clearRect(0, 0, 44, 44);
  if (type === 'animal') {
    drawCreature(ctx, sp.genes, 22, 22, 0.38, sp.customImages || {});
  } else {
    drawPlant(ctx, sp.genes, 22, 28, 0.36, sp.customImages || {});
  }
  sp.thumbnail = offscreen.toDataURL();
  return sp.thumbnail;
}

function initWorldCreator() {
  const grid = document.getElementById('world-grid');
  if (!grid) return;
  grid.innerHTML = '';

  WORLD_BIOMES.forEach(wb => {
    const card = document.createElement('div');
    card.className = 'world-card' + (wb.id === selectedBiomeId ? ' sel' : '');
    card.id = `biome-card-${wb.id}`;
    card.innerHTML = `
      <canvas width="220" height="140" id="canvas-biome-${wb.id}"></canvas>
      <span class="badge-placeholder">MAPA</span>
      <div class="world-card-info">
        <h4>${wb.name}</h4>
        <p>${wb.desc}</p>
      </div>
    `;
    card.onclick = () => selectWorldBiome(wb.id);
    grid.appendChild(card);

    const canvas = card.querySelector('canvas');
    drawWorldPreview(canvas.getContext('2d'), wb.id, 220, 140);
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

  refreshWorldSpeciesCounts();
}

function selectWorldBiome(id) {
  selectedBiomeId = id;
  document.querySelectorAll('.world-card').forEach(c => c.classList.remove('sel'));
  const target = document.getElementById(`biome-card-${id}`);
  if (target) target.classList.add('sel');
}

function refreshWorldSpeciesCounts() {
  const animalContainer = document.getElementById('world-animals-counts-list');
  const plantContainer  = document.getElementById('world-plants-counts-list');
  if (!animalContainer || !plantContainer) return;

  animalContainer.innerHTML = '';
  plantContainer.innerHTML = '';

  const allAnimals = [
    ...savedAnimals.map(a => ({ ...a, isStarter: false })),
    ...STARTER_ANIMALS
  ];

  allAnimals.forEach(sp => {
    if (!worldSpeciesSelection.animals[sp.id]) {
      let defaultCount = !sp.isStarter ? 15 : (savedAnimals.length === 0 ? sp.defaultCount : 0);
      worldSpeciesSelection.animals[sp.id] = { count: defaultCount, species: sp };
    } else {
      worldSpeciesSelection.animals[sp.id].species = sp;
    }
    const currentCount = worldSpeciesSelection.animals[sp.id].count;
    animalContainer.appendChild(createSpeciesCard('animal', sp, currentCount));
  });

  const allPlants = [
    ...savedPlants.map(p => ({ ...p, isStarter: false })),
    ...STARTER_PLANTS
  ];

  allPlants.forEach(sp => {
    if (!worldSpeciesSelection.plants[sp.id]) {
      let defaultCount = !sp.isStarter ? 35 : (savedPlants.length === 0 ? sp.defaultCount : 0);
      worldSpeciesSelection.plants[sp.id] = { count: defaultCount, species: sp };
    } else {
      worldSpeciesSelection.plants[sp.id].species = sp;
    }
    const currentCount = worldSpeciesSelection.plants[sp.id].count;
    plantContainer.appendChild(createSpeciesCard('plant', sp, currentCount));
  });

  updateWorldSpeciesTotals();
}

function createSpeciesCard(type, sp, count) {
  const thumb = getSpeciesThumbnail(type, sp);
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

function setSpeciesCountSlider(type, id, val) {
  const num = Math.max(0, parseInt(val) || 0);
  const targetMap = worldSpeciesSelection[type === 'animal' ? 'animals' : 'plants'];
  if (targetMap && targetMap[id]) {
    targetMap[id].count = num;
  }

  const valEl = document.getElementById(`count-val-${type}-${id}`);
  if (valEl) valEl.textContent = num;

  const cardEl = document.getElementById(`species-card-${type}-${id}`);
  if (cardEl) {
    cardEl.classList.toggle('inactive', num === 0);
  }

  updateWorldSpeciesTotals();
}

function adjustAllSpeciesCounts(type, delta) {
  const targetMap = worldSpeciesSelection[type === 'animal' ? 'animals' : 'plants'];
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
  updateWorldSpeciesTotals();
}

function resetSpeciesCountsToDefault(type) {
  const targetMap = worldSpeciesSelection[type === 'animal' ? 'animals' : 'plants'];
  Object.keys(targetMap).forEach(id => {
    const sp = targetMap[id].species;
    let def = sp.isStarter ? (sp.defaultCount || (type === 'animal' ? 15 : 35)) : (type === 'animal' ? 15 : 35);
    targetMap[id].count = def;
    const slider = document.getElementById(`range-input-${type}-${id}`);
    const valEl = document.getElementById(`count-val-${type}-${id}`);
    const cardEl = document.getElementById(`species-card-${type}-${id}`);
    if (slider) slider.value = def;
    if (valEl) valEl.textContent = def;
    if (cardEl) cardEl.classList.toggle('inactive', def === 0);
  });
  updateWorldSpeciesTotals();
}

function zeroAllSpeciesCounts(type) {
  const targetMap = worldSpeciesSelection[type === 'animal' ? 'animals' : 'plants'];
  Object.keys(targetMap).forEach(id => {
    targetMap[id].count = 0;
    const slider = document.getElementById(`range-input-${type}-${id}`);
    const valEl = document.getElementById(`count-val-${type}-${id}`);
    const cardEl = document.getElementById(`species-card-${type}-${id}`);
    if (slider) slider.value = 0;
    if (valEl) valEl.textContent = 0;
    if (cardEl) cardEl.classList.toggle('inactive', true);
  });
  updateWorldSpeciesTotals();
}

function updateWorldSpeciesTotals() {
  let totalAnimals = 0, totalPlants = 0;
  Object.values(worldSpeciesSelection.animals).forEach(item => totalAnimals += (parseInt(item.count) || 0));
  Object.values(worldSpeciesSelection.plants).forEach(item => totalPlants += (parseInt(item.count) || 0));

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
// Aplica a Pirâmide Ecológica de Elton, Lindeman (10-18%) e a Lei de Kleiber
function autoBalanceTrophicPopulations() {
  const size = parseInt(document.getElementById('world-size')?.value || 50);
  const cols = Math.min(50, Math.max(20, Math.round(size * 0.75)));
  const rows = Math.min(35, Math.max(15, Math.round(size * 0.5)));
  const totalCells = cols * rows;

  // 1. Produtores Primários (Plantas): Sustentabilidade da área (~22% das células do mapa)
  const targetPlantTotal = Math.min(110, Math.max(35, Math.round(totalCells * 0.22)));
  const plantEntries = Object.entries(worldSpeciesSelection.plants);

  if (plantEntries.length > 0) {
    const totalGrowthWeight = plantEntries.reduce((sum, [_, item]) => sum + (item.species.genes.growthSpeed || 0.5), 0) || 1;
    plantEntries.forEach(([id, item]) => {
      const weight = (item.species.genes.growthSpeed || 0.5) / totalGrowthWeight;
      const count = Math.max(8, Math.min(120, Math.round(targetPlantTotal * weight)));
      setSpeciesCountSlider('plant', id, count);
    });
  }

  // 2. Consumidores Animais (Classificação por Nível Trófico e Gasto Metabólico de Kleiber)
  const animalEntries = Object.entries(worldSpeciesSelection.animals);
  if (animalEntries.length === 0) {
    updateWorldSpeciesTotals();
    toast('⚖️ Nenhuma espécie animal disponível para balanceamento.');
    return;
  }

  const herbivores = [];
  const carnivores = [];
  const omnivores = [];

  animalEntries.forEach(([id, item]) => {
    const g = item.species.genes;
    const diet = g.diet || { meat: 0.3, plant: 0.6, carcass: 0.1 };

    // Taxa metabólica basal e locomoção pelo porte de Kleiber
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

  // Capacidade de suporte para herbívoros (aproximadamente 35% do número de plantas)
  const baseHerbivoreCapacity = Math.max(12, Math.round(targetPlantTotal * 0.36));

  if (herbivores.length > 0) {
    const invDemandSum = herbivores.reduce((sum, h) => sum + (1.0 / h.totalDemand), 0);
    herbivores.forEach(h => {
      // Herbívoros menores e mais eficientes ganham cotas maiores; grandes herbívoros ganham cotas menores
      const share = (1.0 / h.totalDemand) / invDemandSum;
      const finalCount = Math.max(4, Math.min(45, Math.round(baseHerbivoreCapacity * share)));
      setSpeciesCountSlider('animal', h.id, finalCount);
    });
  }

  if (omnivores.length > 0) {
    const omniCapacity = Math.max(5, Math.round(baseHerbivoreCapacity * 0.40));
    const invDemandSum = omnivores.reduce((sum, o) => sum + (1.0 / o.totalDemand), 0);
    omnivores.forEach(o => {
      const share = (1.0 / o.totalDemand) / invDemandSum;
      const finalCount = Math.max(3, Math.min(25, Math.round(omniCapacity * share)));
      setSpeciesCountSlider('animal', o.id, finalCount);
    });
  }

  // Predadores de Topo (Regra de Lindeman: ~16% a 20% da biomassa de presas ativas)
  let totalPreyEstimate = 0;
  herbivores.forEach(h => totalPreyEstimate += (worldSpeciesSelection.animals[h.id]?.count || 10));
  omnivores.forEach(o => totalPreyEstimate += (worldSpeciesSelection.animals[o.id]?.count || 5) * 0.5);

  const targetPredatorCapacity = Math.max(2, Math.round(totalPreyEstimate * 0.18));
  if (carnivores.length > 0) {
    const invDemandSum = carnivores.reduce((sum, c) => sum + (1.0 / c.totalDemand), 0);
    carnivores.forEach(c => {
      const share = (1.0 / c.totalDemand) / invDemandSum;
      // Garante pelo menos 2 indivíduos (macho/fêmea ou par reprodutor mínimo)
      const finalCount = Math.max(2, Math.min(14, Math.round(targetPredatorCapacity * share)));
      setSpeciesCountSlider('animal', c.id, finalCount);
    });
  }

  updateWorldSpeciesTotals();
  toast('⚖️ Populações calibradas pela Pirâmide de Elton & Kleiber!');
}

function saveAndStartWorld() {
  const size = parseInt(document.getElementById('world-size')?.value || 50);
  const seasonLen = parseInt(document.getElementById('world-season-length')?.value || 120);

  const animalList = [];
  let totalAnimals = 0;
  Object.values(worldSpeciesSelection.animals).forEach(item => {
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
  Object.values(worldSpeciesSelection.plants).forEach(item => {
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
    biome: selectedBiomeId,
    gridSize: size,
    seasonLengthTicks: seasonLen,
    initialAnimalCount: totalAnimals,
    initialPlantCount: totalPlants,
    speciesCounts: { animals: animalList, plants: plantList }
  };

  localStorage.setItem('evo_world_config', JSON.stringify(worldConfig));
  if (typeof engine !== 'undefined') {
    engine.init(document.getElementById('sim-canvas'), worldConfig);
  }
  showPage('simulation');
}

// ── 4. TELA DA SIMULAÇÃO & CONTROLES DE EXTINÇÃO ──
function initSimulationScreen() {
  const simCanvas = document.getElementById('sim-canvas');
  if (!simCanvas) return;
  simCanvas.addEventListener('click', (e) => {
    const rect = simCanvas.getBoundingClientRect();
    const scaleX = simCanvas.width / rect.width;
    const scaleY = simCanvas.height / rect.height;
    if (typeof engine !== 'undefined') {
      engine.selectEntityAt((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
    }
  });
}

function startOrResumeSimulation() {
  const simCanvas = document.getElementById('sim-canvas');
  if (!simCanvas || typeof engine === 'undefined') return;
  let cfg = {};
  try { cfg = JSON.parse(localStorage.getItem('evo_world_config') || '{}'); } catch { cfg = {}; }
  if (!engine.canvas || engine.grid.length === 0) engine.init(simCanvas, cfg);
  engine.start();
  updatePlayPauseButtonUI(true);
}

function togglePlayPause() {
  if (typeof engine === 'undefined') return;
  engine.toggle();
  updatePlayPauseButtonUI(engine.isRunning);
}

function updatePlayPauseButtonUI(isPlaying) {
  const btn = document.getElementById('btn-sim-play');
  if (btn) {
    btn.innerHTML = isPlaying ? '⏸️ Pausar' : '▶️ Continuar';
  }
}

function setSimSpeed(mult) {
  if (typeof engine === 'undefined') return;
  engine.setSpeed(mult);
  document.querySelectorAll('.speed-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.speed) === mult));
}

function simFastForward() { if (typeof engine !== 'undefined') engine.fastForward(50); }

function resetSimulation() {
  if (typeof engine === 'undefined') return;
  let cfg = {};
  try { cfg = JSON.parse(localStorage.getItem('evo_world_config') || '{}'); } catch { cfg = {}; }
  engine.init(document.getElementById('sim-canvas'), cfg);
  engine.start();
  updatePlayPauseButtonUI(true);
  toast('🔄 Ecossistema reiniciado!');
}

// ── AÇÕES ESPECÍFICAS DO MODAL DE EXTINÇÃO ─────────
function goToWorldCreatorFromExtinction() {
  const modal = document.getElementById('extinction-modal');
  if (modal) modal.style.display = 'none';
  showPage('world');
}

function resetSimulationFromExtinction() {
  const modal = document.getElementById('extinction-modal');
  if (modal) modal.style.display = 'none';
  resetSimulation();
}

function viewAnalyticsFromExtinction() {
  const modal = document.getElementById('extinction-modal');
  if (modal) modal.style.display = 'none';
  if (typeof analyticsModal !== 'undefined') {
    analyticsModal.open('pop');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (typeof miniPaint !== 'undefined') miniPaint.init();
  initAnimalCreator();
  initPlantCreator();
  initWorldCreator();
  initSimulationScreen();
  showPage('menu');
});