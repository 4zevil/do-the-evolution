// ====================================================
//  PLANTCREATORCONTROLLER.JS — Criador e customizador de espécies vegetais (POO)
// ====================================================

import { UIController } from './UIController.js';

export const DEFAULT_PLANT_GENES = {
  height: 0.5,
  rootEfficiency: 0.5,
  growthSpeed: 0.5,
  defense: 0.3,
  fruitAttraction: 0.4,
  parasiteResistance: 0.5,
  thermal: 0.0,
  colorHue: 110
};

export class PlantCreatorController {
  static currentGenes = { ...DEFAULT_PLANT_GENES };
  static currentImages = { roots: null, stem: null, leaves: null, thorns: null, fruit: null };
  static savedPlants = [];
  static canvas = null;
  static ctx = null;

  static init() {
    PlantCreatorController.canvas = document.getElementById('plant-canvas');
    if (!PlantCreatorController.canvas) return;
    PlantCreatorController.ctx = PlantCreatorController.canvas.getContext('2d');

    try {
      PlantCreatorController.savedPlants = JSON.parse(localStorage.getItem('evo_plants') || '[]');
    } catch {
      PlantCreatorController.savedPlants = [];
    }
    PlantCreatorController.renderSavedList();

    document.querySelectorAll('#plant-attrs [data-gene]').forEach(el => {
      el.addEventListener('input', () => {
        const g = el.dataset.gene;
        PlantCreatorController.currentGenes[g] = parseFloat(el.value);
        PlantCreatorController.updateSliderLabel(el);
        PlantCreatorController.renderPreview();
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
            PlantCreatorController.currentImages[part] = evt.target.result;
            PlantCreatorController.updateComponentBox('plant', part, evt.target.result);
            PlantCreatorController.renderPreview();
            UIController.toast(`✅ Componente botânico "${part}" importado!`);
          };
          reader.readAsDataURL(file);
        });
      }
    });

    PlantCreatorController.renderPreview();
  }

  static updateSliderLabel(el) {
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

  static renderPreview() {
    const canvas = PlantCreatorController.canvas;
    const ctx = PlantCreatorController.ctx;
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

    const groundY = H * 0.68;
    if (typeof window.drawPlant === 'function') {
      window.drawPlant(ctx, PlantCreatorController.currentGenes, W / 2, groundY, 1.45, PlantCreatorController.currentImages, () => {
        PlantCreatorController.renderPreview();
      });
    }

    ctx.fillStyle = 'rgba(13, 17, 23, 0.75)';
    ctx.fillRect(0, H - 28, W, 28);
    ctx.fillStyle = '#8b949e';
    ctx.font = '11px system-ui';
    ctx.fillText(
      `Altura: ${Math.round(PlantCreatorController.currentGenes.height*100)}% | Raiz: ${Math.round(PlantCreatorController.currentGenes.rootEfficiency*100)}% | Defesa: ${Math.round(PlantCreatorController.currentGenes.defense*100)}% | Fruto: ${Math.round(PlantCreatorController.currentGenes.fruitAttraction*100)}%`,
      12, H - 10
    );
  }

  static clearComponentImage(part) {
    PlantCreatorController.currentImages[part] = null;
    PlantCreatorController.updateComponentBox('plant', part, null);
    const input = document.getElementById(`upload-plant-${part}`);
    if (input) input.value = '';
    PlantCreatorController.renderPreview();
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
    document.querySelectorAll('#page-plants .panel-subnav button').forEach(b => b.classList.remove('active'));
    document.getElementById(`btn-plant-tab-${tab}`).classList.add('active');
    document.getElementById('plant-tab-attrs').style.display = tab === 'attrs' ? 'block' : 'none';
    document.getElementById('plant-tab-components').style.display = tab === 'components' ? 'block' : 'none';
  }

  static saveSpecies() {
    const nameEl = document.getElementById('plant-name');
    const name = nameEl.value.trim() || `Planta ${PlantCreatorController.savedPlants.length + 1}`;

    const mini = document.createElement('canvas');
    mini.width = 80; mini.height = 80;
    const mCtx = mini.getContext('2d');
    mCtx.fillStyle = '#09130c';
    mCtx.fillRect(0, 0, 80, 80);
    if (typeof window.drawPlant === 'function') {
      window.drawPlant(mCtx, PlantCreatorController.currentGenes, 40, 56, 0.65, PlantCreatorController.currentImages);
    }
    const thumbnail = mini.toDataURL('image/png');

    const entry = {
      id: 'p_' + Date.now(),
      type: 'plant',
      name,
      genes: { ...PlantCreatorController.currentGenes },
      customImages: { ...PlantCreatorController.currentImages },
      thumbnail
    };

    PlantCreatorController.savedPlants.push(entry);
    localStorage.setItem('evo_plants', JSON.stringify(PlantCreatorController.savedPlants));

    nameEl.value = '';
    PlantCreatorController.renderSavedList();
    if (typeof window.refreshWorldSpeciesCounts === 'function') {
      window.refreshWorldSpeciesCounts();
    }
    UIController.toast(`🌿 Espécie vegetal "${name}" salva com sucesso!`);
  }

  static exportPNG() {
    const nameEl = document.getElementById('plant-name');
    const name = (nameEl.value.trim() || 'especie_planta').replace(/\s+/g, '_');

    const exp = document.createElement('canvas');
    exp.width = 450; exp.height = 450;
    const eCtx = exp.getContext('2d');
    eCtx.fillStyle = '#09130c';
    eCtx.fillRect(0, 0, 450, 450);
    if (typeof window.drawPlant === 'function') {
      window.drawPlant(eCtx, PlantCreatorController.currentGenes, 225, 310, 3.2, PlantCreatorController.currentImages);
    }

    const a = document.createElement('a');
    a.href = exp.toDataURL('image/png');
    a.download = `${name}_planta_sprite.png`;
    a.click();
    UIController.toast(`🖼️ Sprite PNG de "${name}" exportado!`);
  }

  static renderSavedList() {
    const list = document.getElementById('saved-plants-list');
    if (!list) return;
    list.innerHTML = '';

    if (PlantCreatorController.savedPlants.length === 0) {
      list.innerHTML = '<span style="color:var(--text-dim);font-size:12px;">Nenhuma planta salva ainda.</span>';
      return;
    }

    PlantCreatorController.savedPlants.forEach((sp, idx) => {
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

  static load(idx) {
    const sp = PlantCreatorController.savedPlants[idx];
    PlantCreatorController.currentGenes = { ...sp.genes };
    PlantCreatorController.currentImages = { ...(sp.customImages || {}) };

    document.querySelectorAll('#plant-attrs [data-gene]').forEach(el => {
      el.value = PlantCreatorController.currentGenes[el.dataset.gene];
      PlantCreatorController.updateSliderLabel(el);
    });

    ['roots', 'stem', 'leaves', 'thorns', 'fruit'].forEach(part => {
      PlantCreatorController.updateComponentBox('plant', part, PlantCreatorController.currentImages[part]);
    });

    document.getElementById('plant-name').value = sp.name;
    PlantCreatorController.renderPreview();
    UIController.toast(`↩ Planta "${sp.name}" carregada.`);
  }

  static delete(idx) {
    const name = PlantCreatorController.savedPlants[idx].name;
    PlantCreatorController.savedPlants.splice(idx, 1);
    localStorage.setItem('evo_plants', JSON.stringify(PlantCreatorController.savedPlants));
    PlantCreatorController.renderSavedList();
    if (typeof window.refreshWorldSpeciesCounts === 'function') {
      window.refreshWorldSpeciesCounts();
    }
    UIController.toast(`🗑️ Planta "${name}" removida.`);
  }

  static downloadPNG(idx) {
    const sp = PlantCreatorController.savedPlants[idx];
    const a = document.createElement('a');
    a.href = sp.thumbnail;
    a.download = `${sp.name.replace(/\s+/g, '_')}_thumb.png`;
    a.click();
    UIController.toast(`⬇️ PNG de "${sp.name}" baixado.`);
  }

  static randomizeGenes() {
    Object.keys(DEFAULT_PLANT_GENES).forEach(g => {
      if (g === 'colorHue') PlantCreatorController.currentGenes[g] = Math.round(Math.random() * 360);
      else if (g === 'thermal') PlantCreatorController.currentGenes[g] = parseFloat((Math.random() * 2 - 1).toFixed(2));
      else PlantCreatorController.currentGenes[g] = parseFloat(Math.random().toFixed(2));
    });

    document.querySelectorAll('#plant-attrs [data-gene]').forEach(el => {
      el.value = PlantCreatorController.currentGenes[el.dataset.gene];
      PlantCreatorController.updateSliderLabel(el);
    });
    PlantCreatorController.renderPreview();
    UIController.toast('🎲 Genes botânicos aleatorizados!');
  }

  static resetGenes() {
    PlantCreatorController.currentGenes = { ...DEFAULT_PLANT_GENES };
    document.querySelectorAll('#plant-attrs [data-gene]').forEach(el => {
      el.value = PlantCreatorController.currentGenes[el.dataset.gene];
      PlantCreatorController.updateSliderLabel(el);
    });
    PlantCreatorController.renderPreview();
    UIController.toast('🔄 Genes botânicos resetados para o padrão.');
  }
}
