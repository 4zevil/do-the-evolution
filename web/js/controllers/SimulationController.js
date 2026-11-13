// ====================================================
//  SIMULATIONCONTROLLER.JS — Controles da tela de simulação, câmera e clima (POO)
// ====================================================

import { UIController } from './UIController.js';

export class SimulationController {
  // Câmera interativa com Zoom e Pan
  static camera = {
    zoom: 1.0,
    panX: 0,
    panY: 0,
    isDragging: false,
    hasDragged: false,
    dragStartX: 0,
    dragStartY: 0,
    initialPanX: 0,
    initialPanY: 0,

    apply() {
      const canvas = document.getElementById('sim-canvas');
      const badge = document.getElementById('sim-zoom-badge');
      if (!canvas) return;

      canvas.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
      if (badge) badge.textContent = `${Math.round(this.zoom * 100)}%`;
    },

    zoomAt(factor, clientX = null, clientY = null) {
      const container = document.querySelector('.sim-canvas-area');
      const canvas = document.getElementById('sim-canvas');
      if (!container || !canvas) return;

      const oldZoom = this.zoom;
      const newZoom = Math.max(0.2, Math.min(4.0, oldZoom * factor));
      if (newZoom === oldZoom) return;

      if (clientX !== null && clientY !== null) {
        const rect = container.getBoundingClientRect();
        const mouseX = clientX - rect.left;
        const mouseY = clientY - rect.top;

        this.panX = mouseX - (mouseX - this.panX) * (newZoom / oldZoom);
        this.panY = mouseY - (mouseY - this.panY) * (newZoom / oldZoom);
      }

      this.zoom = newZoom;
      this.apply();
    },

    zoomIn()  { this.zoomAt(1.25); },
    zoomOut() { this.zoomAt(0.8); },

    resetZoom() {
      this.zoom = 1.0;
      this.centerCanvas();
    },

    fitToScreen() {
      const container = document.querySelector('.sim-canvas-area');
      const canvas = document.getElementById('sim-canvas');
      if (!container || !canvas) return;

      const pad = 30;
      const availW = container.clientWidth - pad * 2;
      const availH = container.clientHeight - pad * 2;

      const scaleX = availW / canvas.width;
      const scaleY = availH / canvas.height;
      this.zoom = Math.max(0.2, Math.min(1.0, Math.min(scaleX, scaleY)));
      this.centerCanvas();
    },

    centerCanvas() {
      const container = document.querySelector('.sim-canvas-area');
      const canvas = document.getElementById('sim-canvas');
      if (!container || !canvas) return;

      const scaledW = canvas.width * this.zoom;
      const scaledH = canvas.height * this.zoom;
      this.panX = Math.round((container.clientWidth - scaledW) / 2);
      this.panY = Math.round((container.clientHeight - scaledH) / 2);
      this.apply();
    }
  };

  static init() {
    const container = document.querySelector('.sim-canvas-area');
    const simCanvas = document.getElementById('sim-canvas');
    if (!container || !simCanvas) return;

    // Zoom pela roda do mouse
    container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      SimulationController.camera.zoomAt(factor, e.clientX, e.clientY);
    }, { passive: false });

    // Arrastar mapa com clique do mouse (Pan)
    container.addEventListener('mousedown', (e) => {
      if (e.button !== 0 && e.button !== 1) return;
      const cam = SimulationController.camera;
      cam.isDragging = true;
      cam.hasDragged = false;
      cam.dragStartX = e.clientX;
      cam.dragStartY = e.clientY;
      cam.initialPanX = cam.panX;
      cam.initialPanY = cam.panY;
      container.classList.add('grabbing');
    });

    window.addEventListener('mousemove', (e) => {
      const cam = SimulationController.camera;
      if (!cam.isDragging) return;
      const dx = e.clientX - cam.dragStartX;
      const dy = e.clientY - cam.dragStartY;

      if (Math.hypot(dx, dy) > 4) {
        cam.hasDragged = true;
      }

      cam.panX = cam.initialPanX + dx;
      cam.panY = cam.initialPanY + dy;
      cam.apply();
    });

    window.addEventListener('mouseup', () => {
      const cam = SimulationController.camera;
      if (cam.isDragging) {
        cam.isDragging = false;
        container.classList.remove('grabbing');
      }
    });

    // Seleção, mira de catástrofes e inspeção de criaturas
    simCanvas.addEventListener('click', (e) => {
      const cam = SimulationController.camera;
      if (cam.hasDragged) {
        cam.hasDragged = false;
        return;
      }

      const rect = simCanvas.getBoundingClientRect();
      const scaleX = simCanvas.width / rect.width;
      const scaleY = simCanvas.height / rect.height;
      const clickX = (e.clientX - rect.left) * scaleX;
      const clickY = (e.clientY - rect.top) * scaleY;

      if (window.meteorTargetingActive) {
        SimulationController.triggerMeteorImpactAt(clickX, clickY);
        return;
      }

      const engine = window.engine;
      if (typeof engine !== 'undefined') {
        engine.selectEntityAt(clickX, clickY);
      }
    });
  }

  static startOrResume() {
    const simCanvas = document.getElementById('sim-canvas');
    const engine = window.engine;
    if (!simCanvas || typeof engine === 'undefined') return;

    let cfg = {};
    try { cfg = JSON.parse(localStorage.getItem('evo_world_config') || '{}'); } catch { cfg = {}; }
    if (!engine.canvas || engine.grid.length === 0) engine.init(simCanvas, cfg);
    engine.start();
    SimulationController.updatePlayPauseButtonUI(true);

    setTimeout(() => {
      SimulationController.camera.fitToScreen();
    }, 50);

    // Injeta updateSideConsole no updateStatsUI do engine
    if (engine.updateStatsUI && !engine._sideConsoleHooked) {
      const _orig = engine.updateStatsUI.bind(engine);
      engine.updateStatsUI = function() {
        _orig();
        UIController.updateSideConsole();
      };
      engine._sideConsoleHooked = true;
    }
  }

  static togglePlayPause() {
    const engine = window.engine;
    if (typeof engine === 'undefined') return;
    engine.toggle();
    SimulationController.updatePlayPauseButtonUI(engine.isRunning);
  }

  static updatePlayPauseButtonUI(isPlaying) {
    const btn = document.getElementById('btn-sim-play');
    if (btn) {
      btn.innerHTML = isPlaying ? '⏸️ Pausar' : '▶️ Continuar';
      btn.className = isPlaying ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm';
    }
    const consoleBtn = document.getElementById('btn-console-play');
    if (consoleBtn) {
      consoleBtn.innerHTML = isPlaying ? '⏸️ Pausar' : '▶️ Continuar';
      consoleBtn.className = isPlaying ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm';
    }
  }

  static setSpeed(mult) {
    const engine = window.engine;
    if (typeof engine === 'undefined') return;
    engine.setSpeed(mult);
    document.querySelectorAll('.speed-btn, .console-speed-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.speed) === mult));
  }

  static fastForward() {
    const engine = window.engine;
    if (typeof engine !== 'undefined') engine.fastForward(50);
  }

  static reset() {
    const engine = window.engine;
    if (typeof engine === 'undefined') return;
    let cfg = {};
    try { cfg = JSON.parse(localStorage.getItem('evo_world_config') || '{}'); } catch { cfg = {}; }
    engine.init(document.getElementById('sim-canvas'), cfg);
    engine.start();
    SimulationController.updatePlayPauseButtonUI(true);
    UIController.toast('🔄 Ecossistema reiniciado!');
  }

  // ── AÇÕES ESPECÍFICAS DO MODAL DE EXTINÇÃO ─────────
  static goToWorldCreatorFromExtinction() {
    const modal = document.getElementById('extinction-modal');
    if (modal) modal.style.display = 'none';
    UIController.showPage('world');
  }

  static resetFromExtinction() {
    const modal = document.getElementById('extinction-modal');
    if (modal) modal.style.display = 'none';
    SimulationController.reset();
  }

  static viewAnalyticsFromExtinction() {
    const modal = document.getElementById('extinction-modal');
    if (modal) modal.style.display = 'none';
    if (typeof window.analyticsModal !== 'undefined') {
      window.analyticsModal.open('pop');
    }
  }

  // ── PRESETS DE EVOLUÇÃO ─────────────────────────────
  static applyWorldEvoPreset(preset) {
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = val;
      el.dispatchEvent(new Event('input'));
    };

    if (preset === 'sustainable') {
      setVal('world-mutation-rate', '1.0');
      setVal('world-predator-satiety', '65');
      setVal('world-seed-bank', '14');
      const cb = document.getElementById('world-auto-homeostasis');
      if (cb) { cb.checked = true; cb.dispatchEvent(new Event('change')); }
      UIController.toast('🟢 Preset "Equilíbrio Estável" aplicado!');
    } else if (preset === 'fast-evolution') {
      setVal('world-mutation-rate', '2.2');
      setVal('world-predator-satiety', '70');
      setVal('world-seed-bank', '22');
      const cb = document.getElementById('world-auto-homeostasis');
      if (cb) { cb.checked = true; cb.dispatchEvent(new Event('change')); }
      UIController.toast('⚡ Preset "Evolução Acelerada" aplicado!');
    } else if (preset === 'hardcore') {
      setVal('world-mutation-rate', '1.5');
      setVal('world-predator-satiety', '85');
      setVal('world-seed-bank', '4');
      const cb = document.getElementById('world-auto-homeostasis');
      if (cb) { cb.checked = false; cb.dispatchEvent(new Event('change')); }
      UIController.toast('🦁 Preset "Mundo Selvagem" aplicado! Sem rede de segurança.');
    }
  }

  // ── MODO RÁPIDO / SPRITES SIMPLIFICADOS ─────────────
  static toggleSimplifiedSprites() {
    const engine = window.engine;
    if (typeof engine === 'undefined') return;
    engine.simplifiedSprites = !engine.simplifiedSprites;
    localStorage.setItem('evo_simplified_sprites', engine.simplifiedSprites ? 'true' : 'false');
    SimulationController.updateSimplifiedButtonUI();
    engine.render();
    UIController.toast(engine.simplifiedSprites ? '⚡ Modo Rápido (Sprites Simplificados) ativado!' : '🎨 Modo Detalhado ativado!');
  }

  static updateSimplifiedButtonUI() {
    const btn = document.getElementById('btn-toggle-simplified');
    const engine = window.engine;
    if (!btn || typeof engine === 'undefined') return;
    if (engine.simplifiedSprites) {
      btn.innerHTML = '⚡ Modo Rápido: Ativo';
      btn.classList.add('active');
    } else {
      btn.innerHTML = '⚡ Modo Rápido: Desligado';
      btn.classList.remove('active');
    }
  }

  // ── CONTROLE DE CATÁSTROFES: METEORO ────────────────
  static toggleMeteorMode() {
    const btn = document.getElementById('btn-trigger-meteor');
    const container = document.querySelector('.sim-canvas-area');
    const engine = window.engine;

    if (window.meteorTargetingActive) {
      window.meteorTargetingActive = false;
      if (btn) btn.classList.remove('active');
      if (container) container.classList.remove('targeting-meteor');
      if (typeof engine !== 'undefined') {
        engine.triggerMeteor();
        if (!engine.isRunning) engine.render();
      }
      return;
    }

    window.meteorTargetingActive = true;
    if (btn) btn.classList.add('active');
    if (container) container.classList.add('targeting-meteor');
    UIController.toast('☄️ Modo Catástrofe: Clique no mapa para lançar o meteoro (ou clique no botão novamente para queda aleatória)!', 4000);
  }

  static triggerMeteorImpactAt(x, y) {
    const btn = document.getElementById('btn-trigger-meteor');
    const container = document.querySelector('.sim-canvas-area');
    const engine = window.engine;

    window.meteorTargetingActive = false;
    if (btn) btn.classList.remove('active');
    if (container) container.classList.remove('targeting-meteor');

    if (typeof engine !== 'undefined') {
      engine.triggerMeteor(x, y);
      if (!engine.isRunning) engine.render();
    }
  }

  // ── CONTROLES DE MUDANÇA CLIMÁTICA ──────────────────
  static shiftClimateGlobal(delta) {
    const engine = window.engine;
    if (typeof engine === 'undefined') return;
    engine.shiftClimate(delta);
    SimulationController.updateClimateButtonStates();
    if (!engine.isRunning) engine.updateStatsUI();
  }

  static resetClimate() {
    const engine = window.engine;
    if (typeof engine === 'undefined') return;
    engine.climateOffset = 0.0;
    engine.shiftClimate(0);
    UIController.toast('🌡️ Temperatura climática resetada para o padrão natural.');
    SimulationController.updateClimateButtonStates();
    if (!engine.isRunning) engine.updateStatsUI();
  }

  static updateClimateButtonStates() {
    const resetBtn = document.getElementById('btn-reset-climate');
    const engine = window.engine;
    if (!resetBtn || typeof engine === 'undefined') return;
    const off = engine.climateOffset || 0;
    if (Math.abs(off) > 0.05) {
      resetBtn.style.color = off > 0 ? 'var(--accent-hot)' : 'var(--accent-cold)';
      resetBtn.style.borderColor = off > 0 ? 'var(--accent-hot)' : 'var(--accent-cold)';
    } else {
      resetBtn.style.color = '';
      resetBtn.style.borderColor = '';
    }
  }

  // ── AMBIENTE PERSONALIZADO: label de temperatura ─────
  static updateInitTempLabel(val) {
    const el = document.getElementById('world-init-temp-val');
    if (el) el.textContent = (val >= 0 ? '+' : '') + val + '°C';
  }
}
