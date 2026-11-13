// ====================================================
//  UICONTROLLER.JS — Controle geral de navegação, painéis e notificações
// ====================================================

export class UIController {
  static _toastTimer = null;
  static _sideConsoleLastTick = -1;
  static _sideConsoleKillsLast = 0;

  /**
   * Navega entre as telas da interface.
   * @param {string} pageId - Identificador da tela (menu, species, plants, world, simulation, console)
   */
  static showPage(pageId) {
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

    // latestDiagnostics tem estrutura aninhada: d.vegetation, d.density, d.energy, d.ai
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

    // Adiciona linha ao log compacto
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
