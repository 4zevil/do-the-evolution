// ====================================================
//  UICONTROLLER.JS — Controle geral de UI, Inspetor, Censo e Lente (SOLID)
// ====================================================

import { SEASONS } from '../core/constants.js';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getThermalCompatibilityInfo(organismThermal, ambientTemp) {
  const ideal = organismThermal ?? 0.0;
  const diff = Math.abs(ideal - ambientTemp);
  const idealDeg = Math.round(18 + ideal * 16);
  const envDeg = Math.round(18 + ambientTemp * 16);

  if (diff <= 0.25) {
    return {
      label: '✅ Ótima',
      color: '#3fb950',
      detail: `Ideal ${idealDeg}°C / Local ${envDeg}°C`
    };
  }
  if (diff <= 0.45) {
    return {
      label: '🟡 Tolerável',
      color: '#e3b341',
      detail: `Ideal ${idealDeg}°C / Local ${envDeg}°C`
    };
  }
  const isHot = ambientTemp > ideal;
  return {
    label: isHot ? '🔥 Estresse por Calor' : '❄️ Estresse por Frio',
    color: isHot ? '#f78166' : '#79c0ff',
    detail: `Ideal ${idealDeg}°C / Local ${envDeg}°C`
  };
}

export class UIController {
  static _toastTimer = null;
  static _sideConsoleLastTick = -1;
  static _sideConsoleKillsLast = 0;
  static _mapViewMode = 'biomes';

  static init() {
    UIController.bindEngineUI(typeof window !== 'undefined' ? window.engine : undefined);
    const selectEl = document.getElementById('map-lens-select');
    if (selectEl) {
      selectEl.value = UIController._mapViewMode;
    }
    UIController._updateMapLegendUI(UIController._mapViewMode, typeof window !== 'undefined' ? window.engine : undefined);
  }

  /**
   * Conecta os ganchos de UI do motor ao UIController (SOLID: evita DOM no Renderer).
   */
  static bindEngineUI(engine = (typeof window !== 'undefined' ? window.engine : undefined)) {
    if (!engine || engine._uiBound) return;
    engine.updateStatsUI = () => UIController.updateStatsUI(engine);
    engine.updateCensusUI = () => UIController.updateCensusUI(engine);
    engine.updateInspectorUI = () => UIController.updateInspectorUI(engine);
    if (!engine.mapViewMode) {
      engine.mapViewMode = UIController._mapViewMode;
    }
    engine._uiBound = true;
  }

  /**
   * Alterna a lente didática de visualização do mapa.
   * @param {'biomes'|'temperature'|'nutrients'} mode
   */
  static setMapViewMode(mode) {
    const validMode = (mode === 'temperature' || mode === 'nutrients') ? mode : 'biomes';
    UIController._mapViewMode = validMode;

    const selectEl = document.getElementById('map-lens-select');
    if (selectEl && selectEl.value !== validMode) {
      selectEl.value = validMode;
    }

    const engine = typeof window !== 'undefined' ? window.engine : undefined;
    if (engine) {
      engine.mapViewMode = validMode;
      UIController._updateMapLegendUI(validMode, engine);
      if (typeof engine.render === 'function') {
        engine.render();
      }
    } else {
      UIController._updateMapLegendUI(validMode, undefined);
    }
  }

  static _updateMapLegendUI(mode, engine) {
    const legendEl = document.getElementById('map-lens-legend');
    if (!legendEl) return;

    if (mode === 'temperature') {
      const curSeason = engine ? (SEASONS[engine.seasonIndex] || SEASONS[0]) : SEASONS[0];
      const trend = engine ? ((engine.tickCount || 0) === 0 ? (engine.climateOffset || 0) : (engine.climateTrend || 0)) : 0;
      const impact = engine && engine.impactWinterTicks > 0 ? -0.40 : 0;
      const baseDeg = Math.round(18 + (curSeason.temp + trend + impact) * 16);

      legendEl.style.display = 'flex';
      legendEl.style.alignItems = 'center';
      legendEl.style.gap = '8px';
      legendEl.innerHTML =
        '<span>❄️ Frio</span>' +
        '<span style="display:inline-block;width:74px;height:7px;border-radius:4px;background:linear-gradient(90deg,#184edc,#3aaeeb,#a5d8a0,#f5a230,#e02622);"></span>' +
        '<span>🔥 Quente</span>' +
        `<span style="color:var(--text-muted);margin-left:4px;">(Base: ${baseDeg}°C)</span>`;
    } else if (mode === 'nutrients') {
      legendEl.style.display = 'flex';
      legendEl.style.alignItems = 'center';
      legendEl.style.gap = '10px';
      legendEl.innerHTML =
        '<span><span style="color:#6d5139;">■</span> Pobre</span>' +
        '<span><span style="color:#c49830;">■</span> N seco</span>' +
        '<span><span style="color:#267ea2;">■</span> Úmido</span>' +
        '<span><span style="color:#24e060;">■</span> Fértil (N+H₂O)</span>' +
        '<span><span style="color:#164480;">■</span> Água</span>';
    } else {
      legendEl.style.display = 'none';
      legendEl.innerHTML = '';
    }
  }

  /**
   * Navega entre as telas da interface.
   * @param {string} pageId - Identificador da tela (menu, species, plants, world, simulation, console)
   */
  static showPage(pageId) {
    UIController.bindEngineUI(typeof window !== 'undefined' ? window.engine : undefined);

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + pageId);
    if (target) {
      target.classList.add('active');
      window.scrollTo(0, 0);
    }

    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.page === pageId);
    });

    if (pageId !== 'simulation' && pageId !== 'console' && typeof window.engine !== 'undefined' && window.engine.isRunning) {
      window.engine.pause();
      if (typeof window.updatePlayPauseButtonUI === 'function') {
        window.updatePlayPauseButtonUI(false);
      }
    }

    if (pageId === 'species' && typeof window.renderAnimalPreview === 'function') window.renderAnimalPreview();
    if (pageId === 'plants'  && typeof window.renderPlantPreview === 'function')  window.renderPlantPreview();
    if (pageId === 'world'   && typeof window.refreshWorldSpeciesCounts === 'function') window.refreshWorldSpeciesCounts();
    if (pageId === 'simulation' && typeof window.startOrResumeSimulation === 'function') window.startOrResumeSimulation();
    if (pageId === 'console' && typeof window.systemConsole !== 'undefined') window.systemConsole.onOpen();
  }

  /**
   * Exibe notificação temporária em toast.
   * @param {string} msg
   * @param {number} duration
   */
  static toast(msg, duration = 3000) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(UIController._toastTimer);
    UIController._toastTimer = setTimeout(() => el.classList.remove('show'), duration);
  }

  /**
   * Alterna a aba do painel lateral da simulação.
   * @param {string} name - Nome do painel (census, inspector, console)
   */
  static switchSidePanel(name) {
    document.querySelectorAll('.sidepanel').forEach(p => {
      p.style.display = 'none';
      p.classList.remove('active');
    });
    document.querySelectorAll('.sidebar-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.sidepanel === name);
    });
    const target = document.getElementById('sidepanel-' + name);
    if (target) { target.style.display = 'flex'; target.classList.add('active'); }
  }

  /**
   * Atualiza o HUD superior, legenda térmica, censo e inspetor.
   */
  static updateStatsUI(engine = (typeof window !== 'undefined' ? window.engine : undefined)) {
    if (!engine) return;

    if (!engine.mapViewMode) {
      engine.mapViewMode = UIController._mapViewMode || 'biomes';
    }

    const elSeason = document.getElementById('sim-season-badge');
    const elGen = document.getElementById('sim-gen-badge');
    const elAnimals = document.getElementById('stat-animals-count');
    const elPlants = document.getElementById('stat-plants-count');
    const elCarcasses = document.getElementById('stat-carcasses-count');

    const curSeason = SEASONS[engine.seasonIndex] || SEASONS[0];
    const trend = (engine.tickCount || 0) === 0 ? (engine.climateOffset || 0) : (engine.climateTrend || 0);
    const effTemp = curSeason.temp + trend;
    const tempDeg = Math.round(18 + effTemp * 16);
    const climOff = engine.climateOffset || 0;
    const climSuffix = Math.abs(climOff) > 0.05
      ? ` <span style="color:${climOff > 0 ? '#f78166' : '#79c0ff'};font-size:10px;">${climOff > 0 ? '🔥' : '🧊'}${climOff > 0 ? '+' : ''}${Math.round(climOff * 16)}°</span>`
      : '';

    if (engine.impactWinterTicks > 0) {
      if (elSeason) elSeason.innerHTML = `☄️ Inverno Nuclear (${tempDeg - 10}°C) [${engine.impactWinterTicks}t]`;
    } else {
      if (elSeason) elSeason.innerHTML = `${curSeason.icon} ${curSeason.name} (${tempDeg}°C)${climSuffix}`;
    }

    if (elGen) elGen.textContent = `Geração ${engine.generation}`;
    if (elAnimals) elAnimals.textContent = engine.animals.length;
    if (elPlants) elPlants.textContent = engine.plants.length;
    if (elCarcasses) elCarcasses.textContent = engine.carcasses.length;

    if (engine.mapViewMode === 'temperature') {
      UIController._updateMapLegendUI('temperature', engine);
    }

    UIController.updateCensusUI(engine);

    if (engine.selectedEntity) {
      UIController.updateInspectorUI(engine);
    }

    if (typeof window !== 'undefined' && window.systemConsole && typeof window.systemConsole.updateConsoleHeader === 'function') {
      window.systemConsole.updateConsoleHeader();
    }
  }

  /**
   * Atualiza o painel de Censo de Espécies na barra lateral.
   */
  static updateCensusUI(engine = (typeof window !== 'undefined' ? window.engine : undefined)) {
    const censusBox = document.getElementById('sim-species-census');
    if (!censusBox || !engine) return;

    if (engine.speciesCatalog.length === 0) {
      censusBox.innerHTML = '<span style="color:var(--text-dim);font-size:11px;">Nenhuma espécie cadastrada.</span>';
      return;
    }

    const animalCounts = {};
    for (let i = 0, len = engine.animals.length; i < len; i++) {
      const a = engine.animals[i];
      const sp = a.speciesName || a.name;
      animalCounts[sp] = (animalCounts[sp] || 0) + 1;
    }

    const plantCounts = {};
    for (let i = 0, len = engine.plants.length; i < len; i++) {
      const p = engine.plants[i];
      const sp = p.name;
      plantCounts[sp] = (plantCounts[sp] || 0) + 1;
    }

    const totalAnimals = engine.animals.length || 1;
    const totalPlants = engine.plants.length || 1;

    const animalSpecies = engine.speciesCatalog.filter(s => s.type === 'animal');
    const plantSpecies = engine.speciesCatalog.filter(s => s.type === 'plant');

    let html = '';

    if (animalSpecies.length > 0) {
      html += '<div style="font-weight:700;color:var(--text-dim);font-size:10px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;display:flex;justify-content:space-between;">' +
              `<span>🦊 População Animal (${engine.animals.length})</span>` +
              '<span style="font-size:9px;text-transform:none;opacity:0.8;">(Clique para focar)</span></div>';

      animalSpecies.forEach(sp => {
        const count = animalCounts[sp.name] || 0;
        const pct = Math.min(100, Math.round((count / totalAnimals) * 100));
        const isExtinct = (count === 0);
        const isHighlighted = (engine.highlightedSpecies === sp.name);
        const safeName = escapeHtml(sp.name);
        const jsArg = sp.name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

        html += `
          <div class="census-row ${isHighlighted ? 'active-focus' : ''}"
               onclick="engine.toggleHighlightSpecies('${escapeHtml(jsArg)}')"
               title="Clique para destacar todos os exemplares de ${safeName}"
               style="cursor:pointer; padding:4px 6px; border-radius:6px; margin-bottom:3px; transition:all .15s; ${isHighlighted ? `background:rgba(255,255,255,0.12); box-shadow:0 0 0 1.5px ${sp.color};` : ''} ${isExtinct ? 'opacity:0.35;filter:grayscale(1);' : ''}">
            <span class="census-name" title="${safeName}" style="display:flex;align-items:center;gap:4px;">
              ${isHighlighted ? '👁️ ' : ''}${safeName}
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
              `<span>🌿 População Vegetal (${engine.plants.length})</span>` +
              '<span style="font-size:9px;text-transform:none;opacity:0.8;">(Clique para focar)</span></div>';

      plantSpecies.forEach(sp => {
        const count = plantCounts[sp.name] || 0;
        const pct = Math.min(100, Math.round((count / totalPlants) * 100));
        const isExtinct = (count === 0);
        const isHighlighted = (engine.highlightedSpecies === sp.name);
        const safeName = escapeHtml(sp.name);
        const jsArg = sp.name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

        html += `
          <div class="census-row ${isHighlighted ? 'active-focus' : ''}"
               onclick="engine.toggleHighlightSpecies('${escapeHtml(jsArg)}')"
               title="Clique para destacar os vegetais de ${safeName}"
               style="cursor:pointer; padding:4px 6px; border-radius:6px; margin-bottom:3px; transition:all .15s; ${isHighlighted ? `background:rgba(255,255,255,0.12); box-shadow:0 0 0 1.5px ${sp.color};` : ''} ${isExtinct ? 'opacity:0.35;filter:grayscale(1);' : ''}">
            <span class="census-name" title="${safeName}" style="display:flex;align-items:center;gap:4px;">
              ${isHighlighted ? '👁️ ' : ''}${safeName}
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

  /**
   * Atualiza o Inspetor didático de Animal ou Planta (texto exclusivo fora do Canvas).
   */
  static updateInspectorUI(engine = (typeof window !== 'undefined' ? window.engine : undefined)) {
    const panel = document.getElementById('sim-inspector');
    if (!panel || !engine) return;

    if (!engine.selectedEntity) {
      panel.innerHTML = '<span style="color:var(--text-dim);font-size:12px;">Clique em um animal ou planta na tela para inspecionar seu estágio de vida, compatibilidade térmica, fator limitante e genótipo.</span>';
      return;
    }

    const { type, data } = engine.selectedEntity;
    const isAlive = type === 'animal' ? engine.animals.includes(data) : engine.plants.includes(data);
    if (!isAlive) {
      engine.selectedEntity = null;
      panel.innerHTML = '<span style="color:var(--text-dim);font-size:12px;">O organismo selecionado encerrou seu ciclo vital. Clique em outro indivíduo no mapa para inspecionar.</span>';
      return;
    }

    const curSeason = SEASONS[engine.seasonIndex] || SEASONS[0];
    const impactTemp = engine.impactWinterTicks > 0 ? -0.40 : 0;
    const trend = (engine.tickCount || 0) === 0 ? (engine.climateOffset || 0) : (engine.climateTrend || 0);
    const baseEnvTemp = curSeason.temp + impactTemp + trend;

    if (type === 'animal') {
      const g = data.genes || {};
      const diet = g.diet || { meat: 0, plant: 1, carcass: 0 };
      const meat = diet.meat ?? 0;
      const plantPct = diet.plant ?? 0;
      const carcass = diet.carcass ?? 0;
      const size = typeof data.getEffectiveSize === 'function' ? data.getEffectiveSize() : (g.size ?? 0.5);
      const mass = (5.0 + size * 70.0).toFixed(1);
      const kleiber = (0.06 * Math.pow(parseFloat(mass) / 40.0, 0.75)).toFixed(3);

      // Estágio de vida
      const maxLife = data.maxLifespan || (meat > 0.45 ? (950 + size * 300) : (700 + size * 150));
      const age = data.age || 0;
      const ageRatio = age / maxLife;
      let lifeStageLabel = '🦊 Adulto';
      let lifeStageColor = '#58a6ff';
      if (data.lifeStage === 'juvenile' || data.lifeStage === 'juvenil' || (!data.lifeStage && (age < 60 || ageRatio < 0.10))) {
        lifeStageLabel = '🐣 Juvenil';
        lifeStageColor = '#7ee787';
      } else if (data.lifeStage === 'elder' || data.lifeStage === 'senescent' || data.lifeStage === 'senescente' || (!data.lifeStage && ageRatio >= 0.80)) {
        lifeStageLabel = '⏳ Senescente';
        lifeStageColor = '#ffa657';
      }

      // Dieta trófica
      let dietBadge = '🍲 Onívoro';
      if (carcass >= 0.35 || (carcass > meat && carcass > plantPct)) dietBadge = '🦴 Necrófago';
      else if (meat > 0.45) dietBadge = '🥩 Carnívoro';
      else if (plantPct >= 0.55) dietBadge = '🌿 Herbívoro';

      // Célula e temperatura local
      const ar = Math.max(0, Math.min(engine.gridRows - 1, Math.floor(data.y / engine.cellSize)));
      const ac = Math.max(0, Math.min(engine.gridCols - 1, Math.floor(data.x / engine.cellSize)));
      const cell = engine.grid[ar]?.[ac];
      let localTemp = baseEnvTemp;
      if (cell && typeof cell.temperature === 'number') {
        localTemp = Math.abs(cell.temperature) > 3 ? (cell.temperature - 18) / 16 : cell.temperature;
      }
      const thermalInfo = getThermalCompatibilityInfo(g.thermal, localTemp);

      // Estado fisiológico/comportamental
      let healthStatus = '<span style="color:#3fb950;">Saudável</span>';
      if (data.isDiseased) {
        healthStatus = `<span style="color:#d2a8ff;font-weight:700;">☣️ Príon (${data.diseaseTimer}t)</span>`;
      } else if (data.isPregnant) {
        healthStatus = `<span style="color:#ffa657;font-weight:700;">🤰 Gestação (${data.gestationTicks}t)</span>`;
      }

      const maxE = Math.round(data.maxEnergy || 100);
      const curE = Math.round(data.energy || 0);

      panel.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <span style="font-size:18px;">🦊</span>
          <div style="min-width:0;flex:1;">
            <strong style="color:var(--text-main);font-size:13px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(data.name)}</strong>
            <div style="font-size:11px;color:var(--text-muted);">${dietBadge} • ${cell?.biome === 'water' ? '💧 Na água' : '🌿 Em terra'}</div>
          </div>
        </div>

        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:6px;padding:8px;margin-bottom:10px;display:flex;flex-direction:column;gap:5px;font-size:11px;">
          <div style="display:flex;justify-content:space-between;">
            <span style="color:var(--text-muted);">Estágio de vida:</span>
            <strong style="color:${lifeStageColor};">${lifeStageLabel}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;gap:8px;">
            <span style="color:var(--text-muted);">Estado atual:</span>
            <strong style="color:var(--accent);text-align:right;">${escapeHtml(data.stateLabel || 'Forrageando')}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;gap:8px;">
            <span style="color:var(--text-muted);">Compat. térmica:</span>
            <strong style="color:${thermalInfo.color};text-align:right;">${thermalInfo.label}</strong>
          </div>
          <div style="font-size:10px;color:var(--text-dim);text-align:right;">${thermalInfo.detail}</div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px;color:var(--text-muted);">
          <div>⚡ Energia: <strong style="color:var(--text-main);">${curE}/${maxE}</strong></div>
          <div>⚖️ Massa: <strong style="color:var(--text-main);">${mass} kg</strong></div>
          <div>🔬 Kleiber: ${kleiber} cal/t</div>
          <div>🩺 Saúde: ${healthStatus}</div>
          <div>⏳ Idade: ${age}/${maxLife}t</div>
          <div>🐟 Aquático: <strong style="color:var(--text-main);">${Math.round((g.aquatic ?? 0.15) * 100)}%</strong></div>
          <div>🥩 Carne: ${Math.round(meat * 100)}%</div>
          <div>🌿 Planta: ${Math.round(plantPct * 100)}%</div>
          <div>🦴 Carcaça: ${Math.round(carcass * 100)}%</div>
          <div>🏃 Vel.: ${Math.round((g.speed ?? 0.5) * 100)}%</div>
        </div>
      `;
    } else {
      // PLANTA — Estágio, Estado Atual, Compatibilidade Térmica e Fator Limitante de Liebig
      const g = data.genes || {};
      const growth = data.growth ?? 0.35;
      const cell = engine.grid[data.r]?.[data.c] || null;
      const baseLifespan = 320 + ((g.height || 0.5) * 320) + ((g.defense || 0.3) * 180) - ((g.growthSpeed || 0.5) * 140);
      const plantMaxAge = Math.max(180, Math.round(baseLifespan));
      const age = data.age || 0;

      // Estágio de vida
      let lifeStageLabel = '🌿 Em Crescimento';
      let lifeStageColor = '#56d364';
      if (data.lifeStage === 'senescent' || data.lifeStage === 'senescente' || (!data.lifeStage && age > plantMaxAge * 0.85)) {
        lifeStageLabel = '🍂 Senescente';
        lifeStageColor = '#ffa657';
      } else if (data.lifeStage === 'sprout' || data.lifeStage === 'broto' || (!data.lifeStage && growth < 0.28)) {
        lifeStageLabel = '🌱 Broto';
        lifeStageColor = '#7ee787';
      } else if (data.hasFruit) {
        lifeStageLabel = '🍎 Madura (Com Frutos)';
        lifeStageColor = '#f78166';
      }

      // Cálculo exato dos fatores da Lei do Mínimo de Liebig (espelhando Plant.js)
      let localTemp = baseEnvTemp;
      if (cell && typeof cell.temperature === 'number') {
        localTemp = Math.abs(cell.temperature) > 3 ? (cell.temperature - 18) / 16 : cell.temperature;
      }
      const thermalInfo = getThermalCompatibilityInfo(g.thermal, localTemp);

      const impactSunFactor = engine.impactWinterTicks > 0 ? 0.35 : 1.0;
      const sunlightMod = engine.equilibriumSettings?.sunlightMultiplier ?? 1.0;
      const effectiveSunlight = Math.max(0.15, curSeason.sunlight * impactSunFactor) * sunlightMod;

      const lightFactor = effectiveSunlight / (0.4 + effectiveSunlight);
      const nitrogenFactor = cell ? (cell.soilNitrogen / (10.0 + cell.soilNitrogen)) : 0;
      const waterFactor = cell ? Math.min(1.0, cell.moisture * (0.7 + (g.rootEfficiency || 0.5) * 0.6)) : 0;

      const tempDiff = Math.abs((g.thermal || 0.0) - localTemp);
      const thermalPlantFactor = tempDiff > 0.4 ? 1.0 + (tempDiff - 0.4) * 0.6 : 1.0;
      const thermalEfficiency = 1.0 / thermalPlantFactor;

      const maintenanceCost = 0.02 + ((g.height || 0.5) * 0.02) + ((g.defense || 0.3) * 0.015);
      const nitrogenStarving = cell ? cell.soilNitrogen < maintenanceCost : true;

      let limitingFactor = 'Nitrogênio';
      let limitingColor = '#e3b341';
      if (nitrogenStarving) {
        limitingFactor = 'Nitrogênio';
        limitingColor = '#f78166';
      } else {
        let minVal = nitrogenFactor;
        limitingFactor = 'Nitrogênio';
        limitingColor = '#e3b341';

        if (waterFactor < minVal) {
          minVal = waterFactor;
          limitingFactor = 'Água';
          limitingColor = '#79c0ff';
        }
        if (lightFactor < minVal) {
          minVal = lightFactor;
          limitingFactor = 'Luz';
          limitingColor = '#ffa657';
        }
        if (thermalEfficiency < minVal) {
          limitingFactor = 'Estresse Térmico';
          limitingColor = '#f78166';
        }
      }

      if (typeof data.limitingFactor === 'string' && data.limitingFactor.trim()) {
        limitingFactor = data.limitingFactor.trim();
      }

      // Estado fisiológico atual
      let currentState = 'Fotossíntese ativa';
      if (age > plantMaxAge * 0.85) {
        currentState = 'Senescência avançada';
      } else if (nitrogenStarving || Math.min(lightFactor, nitrogenFactor, waterFactor) / thermalPlantFactor < 0.20) {
        currentState = 'Em estresse metabólico';
      } else if (data.hasFruit) {
        currentState = 'Frutificação e dispersão';
      } else if (growth < 0.28) {
        currentState = 'Estabelecimento inicial';
      }

      panel.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <span style="font-size:18px;">🌿</span>
          <div style="min-width:0;flex:1;">
            <strong style="color:var(--text-main);font-size:13px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(data.name)}</strong>
            <div style="font-size:11px;color:var(--text-muted);">Solo: ${escapeHtml(cell?.biome || 'desconhecido')}</div>
          </div>
        </div>

        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:6px;padding:8px;margin-bottom:10px;display:flex;flex-direction:column;gap:5px;font-size:11px;">
          <div style="display:flex;justify-content:space-between;">
            <span style="color:var(--text-muted);">Estágio de vida:</span>
            <strong style="color:${lifeStageColor};">${lifeStageLabel}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;">
            <span style="color:var(--text-muted);">Estado atual:</span>
            <strong style="color:var(--accent);">${currentState}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;">
            <span style="color:var(--text-muted);">Compat. térmica:</span>
            <strong style="color:${thermalInfo.color};">${thermalInfo.label}</strong>
          </div>
          <div style="font-size:10px;color:var(--text-dim);text-align:right;">${thermalInfo.detail}</div>
          <div style="margin-top:3px;padding-top:5px;border-top:1px solid rgba(255,255,255,0.06);display:flex;justify-content:space-between;align-items:center;">
            <span style="color:var(--text-muted);">Lei de Liebig:</span>
            <strong style="color:${limitingColor};">Limitado por: ${escapeHtml(limitingFactor)}</strong>
          </div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;font-size:10px;color:var(--text-dim);text-align:center;margin-top:2px;">
            <div>N: <strong style="color:var(--text-main);">${Math.round(nitrogenFactor * 100)}%</strong></div>
            <div>Água: <strong style="color:var(--text-main);">${Math.round(waterFactor * 100)}%</strong></div>
            <div>Luz: <strong style="color:var(--text-main);">${Math.round(lightFactor * 100)}%</strong></div>
            <div>Térm.: <strong style="color:var(--text-main);">${Math.round(thermalEfficiency * 100)}%</strong></div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px;color:var(--text-muted);">
          <div>🌱 Biomassa: <strong style="color:var(--text-main);">${Math.round(growth * 100)}%</strong></div>
          <div>⚡ Energia: <strong style="color:var(--text-main);">${Math.round(data.energy || 0)}/45</strong></div>
          <div>⏳ Idade: ${age}/${plantMaxAge}t</div>
          <div>🌾 Efic. Raiz: ${Math.round((g.rootEfficiency ?? 0.5) * 100)}%</div>
          <div>🛡️ Defesa: ${Math.round((g.defense ?? 0.3) * 100)}%</div>
          <div>🍎 Fruto: ${data.hasFruit ? 'Sim' : 'Não'}</div>
        </div>
      `;
    }
  }

  /**
   * Atualiza o log e métricas do console lateral a cada 100 ticks.
   */
  static updateSideConsole() {
    const engine = window.engine;
    if (typeof engine === 'undefined' || !engine.latestDiagnostics) return;
    const d = engine.latestDiagnostics;
    const tick = engine.tickCount || 0;

    // Só atualiza a cada 100 ticks
    if (tick - UIController._sideConsoleLastTick < 100) return;
    UIController._sideConsoleLastTick = tick;

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

    const plants  = d.vegetation?.living   ?? (engine.plants?.length  ?? 0);
    const animals = d.density?.population  ?? (engine.animals?.length ?? 0);
    const herb    = d.density?.herbivoreCount ?? 0;
    const carn    = d.density?.carnivoreCount ?? 0;
    const avgE    = d.energy?.avgGeneral   ?? null;
    const kills   = (d.ai?.nonCarnivorePreyKills ?? 0) + (d.ai?.carnivorePreyKills ?? 0);

    set('side-console-tick-badge', 'Ciclo: ' + tick);
    set('sc-plants',     plants);
    set('sc-animals',    animals);
    set('sc-herbivores', herb);
    set('sc-carnivores', carn);
    set('sc-avg-energy', avgE != null ? parseFloat(avgE).toFixed(1) : '—');
    set('sc-kills',      kills - UIController._sideConsoleKillsLast);
    UIController._sideConsoleKillsLast = kills;

    const log = document.getElementById('side-console-log');
    if (log) {
      const isCritical = animals < 5 || plants < 5;
      const isWarn     = carn === 0 || herb === 0;
      const line = document.createElement('div');
      line.className = 'sc-line' + (isCritical ? ' sc-err' : isWarn ? ' sc-warn' : '');
      line.textContent = '[' + tick + '] 🌿' + plants + ' 🦊' + herb + ' 🐺' + carn
                       + ' ⚡' + (avgE != null ? parseFloat(avgE).toFixed(0) : '?');
      log.appendChild(line);
      while (log.children.length > 50) log.removeChild(log.firstChild);
      log.scrollTop = log.scrollHeight;
    }
  }
}

// Vinculação automática de UI para handlers inline e inicialização SOLID
if (typeof window !== 'undefined') {
  if (typeof window !== 'undefined') {
  window.setMapViewMode = UIController.setMapViewMode.bind(UIController);
  window.showPage = UIController.showPage.bind(UIController);
  window.toast = UIController.toast.bind(UIController);
  window.switchSidePanel = UIController.switchSidePanel.bind(UIController);
  window.updateSideConsole = UIController.updateSideConsole.bind(UIController);
}
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => UIController.init());
  } else {
    UIController.init();
  }
}
