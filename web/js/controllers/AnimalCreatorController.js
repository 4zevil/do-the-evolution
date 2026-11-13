// ====================================================
//  ANIMALCREATORCONTROLLER.JS — Criador e customizador de espécies animais (POO)
// ====================================================

import { UIController } from './UIController.js';

export const DEFAULT_ANIMAL_GENES = {
  size: 0.5,
  diet: { meat: 0.3, plant: 0.6, carcass: 0.1 },
  speed: 0.5,
  perception: 0.5,
  gestation: 0.4,
  offspringCount: 0.4,
  aggression: 0.3,
  health: 0.5,
  aquatic: 0.15, // 0 = Terrestre puro, 1 = Aquático puro
  thermal: 0.0,
  colorHue: 120
};

export class AnimalCreatorController {
  static currentGenes = JSON.parse(JSON.stringify(DEFAULT_ANIMAL_GENES));
  static currentImages = { body: null, limbs: null, jaw: null, eyes: null, detail: null };
  static savedAnimals = [];
  static canvas = null;
  static ctx = null;

  static init() {
    AnimalCreatorController.canvas = document.getElementById('animal-canvas');
    if (!AnimalCreatorController.canvas) return;
    AnimalCreatorController.ctx = AnimalCreatorController.canvas.getContext('2d');

    try {
      AnimalCreatorController.savedAnimals = JSON.parse(localStorage.getItem('evo_animals') || '[]');
    } catch {
      AnimalCreatorController.savedAnimals = [];
    }
    AnimalCreatorController.renderSavedList();

    document.querySelectorAll('#animal-attrs [data-gene]').forEach(el => {
      el.addEventListener('input', () => {
        const g = el.dataset.gene;
        AnimalCreatorController.currentGenes[g] = parseFloat(el.value);
        AnimalCreatorController.updateSliderLabel(el);
        AnimalCreatorController.renderPreview();
      });
    });

    AnimalCreatorController.syncDietSlidersUI();

    ['body', 'limbs', 'jaw', 'eyes', 'detail'].forEach(part => {
      const input = document.getElementById(`upload-animal-${part}`);
      if (input) {
        input.addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (evt) => {
            AnimalCreatorController.currentImages[part] = evt.target.result;
            AnimalCreatorController.updateComponentBox('animal', part, evt.target.result);
            AnimalCreatorController.renderPreview();
            UIController.toast(`✅ Componente "${part}" importado!`);
          };
          reader.readAsDataURL(file);
        });
      }
    });

    AnimalCreatorController.renderPreview();
  }

  static updateSliderLabel(el) {
    const g = el.dataset.gene;
    const label = el.closest('.attr-row').querySelector('label span');
    const val = parseFloat(el.value);

    if (g === 'aquatic') {
      const icon = val > 0.65 ? '🐬 Marinho' : val > 0.35 ? '🐸 Anfíbio' : '🐾 Terrestre';
      label.textContent = `${icon} (${Math.round(val * 100)}%)`;
    } else if (g === 'thermal') {
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

  static updateStrictDietUI(changedKey, val) {
    let newVal = parseFloat(val);
    if (!AnimalCreatorController.currentGenes.diet) {
      AnimalCreatorController.currentGenes.diet = { meat: 0.3, plant: 0.6, carcass: 0.1 };
    }
    AnimalCreatorController.currentGenes.diet[changedKey] = newVal;

    const keys = ['meat', 'plant', 'carcass'];
    const otherKeys = keys.filter(k => k !== changedKey);
    let sumOthers = otherKeys.reduce((acc, k) => acc + AnimalCreatorController.currentGenes.diet[k], 0);
    let targetOthers = Math.max(0, 1.0 - newVal);

    if (sumOthers > 0) {
      otherKeys.forEach(k => {
        AnimalCreatorController.currentGenes.diet[k] = parseFloat((AnimalCreatorController.currentGenes.diet[k] * (targetOthers / sumOthers)).toFixed(2));
      });
    } else {
      otherKeys.forEach(k => {
        AnimalCreatorController.currentGenes.diet[k] = parseFloat((targetOthers / otherKeys.length).toFixed(2));
      });
    }

    const finalSum = keys.reduce((acc, k) => acc + AnimalCreatorController.currentGenes.diet[k], 0);
    if (finalSum !== 1.0) {
      AnimalCreatorController.currentGenes.diet[otherKeys[0]] = parseFloat((AnimalCreatorController.currentGenes.diet[otherKeys[0]] + (1.0 - finalSum)).toFixed(2));
    }

    AnimalCreatorController.syncDietSlidersUI();
    AnimalCreatorController.renderPreview();
  }

  static syncDietSlidersUI() {
    if (!AnimalCreatorController.currentGenes.diet) {
      AnimalCreatorController.currentGenes.diet = { meat: 0.3, plant: 0.6, carcass: 0.1 };
    }
    const keys = ['meat', 'plant', 'carcass'];
    keys.forEach(k => {
      const inputEl = document.querySelector(`#animal-attrs [data-diet="${k}"]`);
      if (inputEl) {
        inputEl.value = AnimalCreatorController.currentGenes.diet[k];
        const spanEl = inputEl.closest('.attr-row').querySelector('label span');
        if (spanEl) spanEl.textContent = Math.round(AnimalCreatorController.currentGenes.diet[k] * 100) + '%';
      }
    });

    const totalLabel = document.getElementById('diet-total-label');
    if (totalLabel) {
      const totalPct = Math.round(keys.reduce((acc, k) => acc + AnimalCreatorController.currentGenes.diet[k], 0) * 100);
      totalLabel.textContent = totalPct + '%';
    }
  }

  static renderPreview() {
    const canvas = AnimalCreatorController.canvas;
    const ctx = AnimalCreatorController.ctx;
    if (!canvas || !ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    ctx.fillStyle = '#09130c';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#142718';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 36) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 36) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    const diet = AnimalCreatorController.currentGenes.diet || { meat: 0.3, plant: 0.6, carcass: 0.1 };

    if (typeof window.drawCreature === 'function') {
      window.drawCreature(ctx, AnimalCreatorController.currentGenes, W / 2, H / 2, 1.45, AnimalCreatorController.currentImages, () => {
        AnimalCreatorController.renderPreview();
      });
    }

    ctx.fillStyle = 'rgba(13, 17, 23, 0.75)';
    ctx.fillRect(0, H - 28, W, 28);
    ctx.fillStyle = '#8b949e';
    ctx.font = '11px system-ui';
    ctx.fillText(
      `Tam: ${Math.round(AnimalCreatorController.currentGenes.size*100)}% | Vel: ${Math.round(AnimalCreatorController.currentGenes.speed*100)}% | Carne: ${Math.round(diet.meat*100)}% | Planta: ${Math.round(diet.plant*100)}%`,
      12, H - 10
    );
  }

  static clearComponentImage(type, part) {
    if (type === 'animal') {
      AnimalCreatorController.currentImages[part] = null;
      AnimalCreatorController.updateComponentBox('animal', part, null);
      const input = document.getElementById(`upload-animal-${part}`);
      if (input) input.value = '';
      AnimalCreatorController.renderPreview();
    } else if (typeof window.clearComponentImagePlant === 'function') {
      window.clearComponentImagePlant(part);
    }
    UIController.toast(`🗑️ Componente "${part}" restaurado.`);
  }

  static updateComponentBox(type, part, dataUrl) {
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

  static switchSidebarTab(tab) {
    document.querySelectorAll('#page-species .panel-subnav button').forEach(b => b.classList.remove('active'));
    document.getElementById(`btn-animal-tab-${tab}`).classList.add('active');
    document.getElementById('animal-tab-attrs').style.display = tab === 'attrs' ? 'block' : 'none';
    document.getElementById('animal-tab-components').style.display = tab === 'components' ? 'block' : 'none';
  }

  static saveSpecies() {
    const nameEl = document.getElementById('animal-name');
    const name = nameEl.value.trim() || `Animal ${AnimalCreatorController.savedAnimals.length + 1}`;

    const mini = document.createElement('canvas');
    mini.width = 80; mini.height = 80;
    const mCtx = mini.getContext('2d');
    mCtx.fillStyle = '#09130c';
    mCtx.fillRect(0, 0, 80, 80);
    if (typeof window.drawCreature === 'function') {
      window.drawCreature(mCtx, AnimalCreatorController.currentGenes, 40, 40, 0.75, AnimalCreatorController.currentImages);
    }
    const thumbnail = mini.toDataURL('image/png');

    const entry = {
      id: 'a_' + Date.now(),
      type: 'animal',
      name,
      genes: JSON.parse(JSON.stringify(AnimalCreatorController.currentGenes)),
      customImages: { ...AnimalCreatorController.currentImages },
      thumbnail
    };

    AnimalCreatorController.savedAnimals.push(entry);
    localStorage.setItem('evo_animals', JSON.stringify(AnimalCreatorController.savedAnimals));

    nameEl.value = '';
    AnimalCreatorController.renderSavedList();
    if (typeof window.refreshWorldSpeciesCounts === 'function') {
      window.refreshWorldSpeciesCounts();
    }
    UIController.toast(`🦊 Espécie animal "${name}" salva com sucesso!`);
  }

  static exportPNG() {
    const nameEl = document.getElementById('animal-name');
    const name = (nameEl.value.trim() || 'especie_animal').replace(/\s+/g, '_');

    const exp = document.createElement('canvas');
    exp.width = 450; exp.height = 450;
    const eCtx = exp.getContext('2d');
    eCtx.fillStyle = '#09130c';
    eCtx.fillRect(0, 0, 450, 450);
    if (typeof window.drawCreature === 'function') {
      window.drawCreature(eCtx, AnimalCreatorController.currentGenes, 225, 225, 3.6, AnimalCreatorController.currentImages);
    }

    const a = document.createElement('a');
    a.href = exp.toDataURL('image/png');
    a.download = `${name}_sprite.png`;
    a.click();
    UIController.toast(`🖼️ Sprite PNG de "${name}" exportado!`);
  }

  static renderSavedList() {
    const list = document.getElementById('saved-animals-list');
    if (!list) return;
    list.innerHTML = '';

    if (AnimalCreatorController.savedAnimals.length === 0) {
      list.innerHTML = '<span style="color:var(--text-dim);font-size:12px;">Nenhum animal salvo ainda.</span>';
      return;
    }

    AnimalCreatorController.savedAnimals.forEach((sp, idx) => {
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

  static load(idx) {
    const sp = AnimalCreatorController.savedAnimals[idx];
    AnimalCreatorController.currentGenes = JSON.parse(JSON.stringify(sp.genes));
    if (!AnimalCreatorController.currentGenes.diet) {
      AnimalCreatorController.currentGenes.diet = { meat: 0.3, plant: 0.6, carcass: 0.1 };
    }
    AnimalCreatorController.currentImages = { ...(sp.customImages || {}) };

    document.querySelectorAll('#animal-attrs [data-gene]').forEach(el => {
      if (AnimalCreatorController.currentGenes[el.dataset.gene] !== undefined) {
        el.value = AnimalCreatorController.currentGenes[el.dataset.gene];
        AnimalCreatorController.updateSliderLabel(el);
      }
    });

    AnimalCreatorController.syncDietSlidersUI();

    ['body', 'limbs', 'jaw', 'eyes', 'detail'].forEach(part => {
      AnimalCreatorController.updateComponentBox('animal', part, AnimalCreatorController.currentImages[part]);
    });

    document.getElementById('animal-name').value = sp.name;
    AnimalCreatorController.renderPreview();
    UIController.toast(`↩ Animal "${sp.name}" carregado.`);
  }

  static delete(idx) {
    const name = AnimalCreatorController.savedAnimals[idx].name;
    AnimalCreatorController.savedAnimals.splice(idx, 1);
    localStorage.setItem('evo_animals', JSON.stringify(AnimalCreatorController.savedAnimals));
    AnimalCreatorController.renderSavedList();
    if (typeof window.refreshWorldSpeciesCounts === 'function') {
      window.refreshWorldSpeciesCounts();
    }
    UIController.toast(`🗑️ Animal "${name}" removido.`);
  }

  static downloadPNG(idx) {
    const sp = AnimalCreatorController.savedAnimals[idx];
    const a = document.createElement('a');
    a.href = sp.thumbnail;
    a.download = `${sp.name.replace(/\s+/g, '_')}_thumb.png`;
    a.click();
    UIController.toast(`⬇️ PNG de "${sp.name}" baixado.`);
  }

  static randomizeGenes() {
    Object.keys(DEFAULT_ANIMAL_GENES).forEach(g => {
      if (g === 'colorHue') AnimalCreatorController.currentGenes[g] = Math.round(Math.random() * 360);
      else if (g === 'thermal') AnimalCreatorController.currentGenes[g] = parseFloat((Math.random() * 2 - 1).toFixed(2));
      else if (g === 'diet') {
        let m = Math.random(), p = Math.random(), c = Math.random();
        let tot = m + p + c;
        AnimalCreatorController.currentGenes.diet = {
          meat: parseFloat((m/tot).toFixed(2)),
          plant: parseFloat((p/tot).toFixed(2)),
          carcass: parseFloat((c/tot).toFixed(2))
        };
      } else {
        AnimalCreatorController.currentGenes[g] = parseFloat(Math.random().toFixed(2));
      }
    });

    document.querySelectorAll('#animal-attrs [data-gene]').forEach(el => {
      el.value = AnimalCreatorController.currentGenes[el.dataset.gene];
      AnimalCreatorController.updateSliderLabel(el);
    });
    AnimalCreatorController.syncDietSlidersUI();
    AnimalCreatorController.renderPreview();
    UIController.toast('🎲 Genes animais aleatorizados!');
  }

  static resetGenes() {
    AnimalCreatorController.currentGenes = JSON.parse(JSON.stringify(DEFAULT_ANIMAL_GENES));
    document.querySelectorAll('#animal-attrs [data-gene]').forEach(el => {
      el.value = AnimalCreatorController.currentGenes[el.dataset.gene];
      AnimalCreatorController.updateSliderLabel(el);
    });
    AnimalCreatorController.syncDietSlidersUI();
    AnimalCreatorController.renderPreview();
    UIController.toast('🔄 Genes animais resetados para o padrão.');
  }
}
