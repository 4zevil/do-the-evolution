/**
 * ===================================================================
 * SISTEMA INTEGRADO DE CONSOLE & DIAGNÓSTICOS EM TEMPO REAL
 * EvoSim - Ecossistema & Evolução Natural
 * Permite visualizar métricas, logs e ajustar o equilíbrio ecológico
 * em uma aba separada, sem necessidade de inspecionar (F12).
 * ===================================================================
 */

class SystemConsoleManager {
  constructor() {
    this.logs = [];
    this.maxLogs = 600;
    this.activeSubTab = 'dashboard'; // 'dashboard', 'terminal', 'balance'
    this.filterCategory = 'all';
    this.searchQuery = '';
    this.autoScroll = true;
    this.originalConsole = {
      log: console.log.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console)
    };
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    this.interceptConsole();
    this.initDOM();
    this.initialized = true;
  }

  // Intercepta os logs do console padrão para espelhar no terminal interno
  interceptConsole() {
    const self = this;

    console.log = function(...args) {
      self.originalConsole.log(...args);
      self.recordLog('log', args);
    };

    console.info = function(...args) {
      self.originalConsole.info(...args);
      self.recordLog('info', args);
    };

    console.warn = function(...args) {
      self.originalConsole.warn(...args);
      self.recordLog('warn', args);
    };

    console.error = function(...args) {
      self.originalConsole.error(...args);
      self.recordLog('error', args);
    };
  }

  // Identifica a categoria a partir do conteúdo da mensagem
  classifyLog(text) {
    const lower = text.toLowerCase();
    if (lower.includes('vegetação') || lower.includes('planta') || lower.includes('pastoreio')) return 'vegetation';
    if (lower.includes('densidade') || lower.includes('população') || lower.includes('vizinhos')) return 'density';
    if (lower.includes('energético') || lower.includes('energia') || lower.includes('calorias')) return 'energy';
    if (lower.includes('mortalidade') || lower.includes('morte') || lower.includes('sucumbiu') || lower.includes('extinção')) return 'mortality';
    if (lower.includes('ia') || lower.includes('fuga') || lower.includes('presa') || lower.includes('carcaça') || lower.includes('predador') || lower.includes('canibal')) return 'ai';
    if (lower.includes('solo') || lower.includes('nitrogênio') || lower.includes('bioma') || lower.includes('semente')) return 'soil';
    if (lower.includes('espécie') || lower.includes('evolu') || lower.includes('mutação') || lower.includes('linhagem')) return 'evolution';
    return 'system';
  }

  recordLog(level, args) {
    const text = args.map(a => {
      if (typeof a === 'object' && a !== null) {
        try { return JSON.stringify(a, null, 2); } catch { return String(a); }
      }
      return String(a);
    }).join(' ');

    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
    const category = this.classifyLog(text);

    const entry = {
      id: Date.now() + Math.random(),
      timestamp: timeStr,
      level,
      category,
      text
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Se estiver no terminal do console ativo, renderiza a nova linha
    const terminalEl = document.getElementById('console-terminal-lines');
    if (terminalEl && document.getElementById('page-console')?.classList.contains('active') && this.activeSubTab === 'terminal') {
      if (this.matchesFilter(entry)) {
        this.appendLogDOM(entry, terminalEl);
        if (this.autoScroll) {
          const body = document.getElementById('console-terminal-body');
          if (body) body.scrollTop = body.scrollHeight;
        }
      }
    }
  }

  matchesFilter(entry) {
    if (this.filterCategory !== 'all') {
      if (this.filterCategory === 'warnings' && (entry.level !== 'warn' && entry.level !== 'error')) return false;
      if (this.filterCategory !== 'warnings' && entry.category !== this.filterCategory) return false;
    }
    if (this.searchQuery) {
      if (!entry.text.toLowerCase().includes(this.searchQuery.toLowerCase())) return false;
    }
    return true;
  }

  initDOM() {
    // Liga os botões de sub-abas do console
    document.querySelectorAll('.console-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchSubTab(btn.dataset.subtab);
      });
    });

    // Filtros de categoria do terminal
    document.querySelectorAll('.terminal-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.terminal-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.filterCategory = btn.dataset.filter;
        this.renderTerminal();
      });
    });

    // Campo de busca
    const searchInput = document.getElementById('console-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim();
        this.renderTerminal();
      });
    }

    // Checkbox de autoscroll
    const autoScrollCb = document.getElementById('console-autoscroll-cb');
    if (autoScrollCb) {
      autoScrollCb.addEventListener('change', (e) => {
        this.autoScroll = e.target.checked;
      });
    }
  }

  switchSubTab(subTab) {
    this.activeSubTab = subTab;
    document.querySelectorAll('.console-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.subtab === subTab);
    });

    document.querySelectorAll('.console-subview').forEach(view => {
      view.style.display = 'none';
    });

    const targetView = document.getElementById(`console-subview-${subTab}`);
    if (targetView) targetView.style.display = 'block';

    if (subTab === 'dashboard') {
      this.updateDashboard();
    } else if (subTab === 'terminal') {
      this.renderTerminal();
    } else if (subTab === 'balance') {
      this.syncBalanceUI();
    }
  }

  onOpen() {
    this.init();
    this.updateConsoleHeader();
    if (this.activeSubTab === 'dashboard') {
      this.updateDashboard();
    } else if (this.activeSubTab === 'terminal') {
      this.renderTerminal();
    } else if (this.activeSubTab === 'balance') {
      this.syncBalanceUI();
    }
  }

  updateConsoleHeader() {
    if (typeof engine === 'undefined') return;
    const tickEl = document.getElementById('console-tick-badge');
    const genEl = document.getElementById('console-gen-badge');
    const seasonEl = document.getElementById('console-season-badge');
    const animCount = document.getElementById('console-stat-animals');
    const plantCount = document.getElementById('console-stat-plants');
    const carcassCount = document.getElementById('console-stat-carcasses');
    const playPauseBtn = document.getElementById('btn-console-play');

    if (tickEl) tickEl.textContent = `Ciclo: ${engine.tickCount}`;
    if (genEl) genEl.textContent = `Geração ${engine.generation}`;

    if (seasonEl && typeof SEASONS !== 'undefined') {
      const curSeason = SEASONS[engine.seasonIndex] || { name: 'Primavera', icon: '🌸' };
      seasonEl.innerHTML = `${curSeason.icon} ${curSeason.name}`;
    }

    if (animCount) animCount.textContent = engine.animals.length;
    if (plantCount) plantCount.textContent = engine.plants.length;
    if (carcassCount) carcassCount.textContent = engine.carcasses.length;

    if (playPauseBtn) {
      playPauseBtn.innerHTML = engine.isRunning ? '⏸️ Pausar' : '▶️ Continuar';
      playPauseBtn.className = engine.isRunning ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm';
    }

    // Sincroniza botões de velocidade
    document.querySelectorAll('.console-speed-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.speed, 10) === engine.speed);
    });
  }

  // Chamado a cada 100 ticks pelo SimulationEngine para atualizar os dados estruturados
  onDiagnosticsUpdate(diag) {
    this.latestDiag = diag;
    if (document.getElementById('page-console')?.classList.contains('active')) {
      this.updateConsoleHeader();
      if (this.activeSubTab === 'dashboard') {
        this.updateDashboard();
      }
    }
  }

  updateDashboard() {
    const d = this.latestDiag || (typeof engine !== 'undefined' ? engine.latestDiagnostics : null);
    if (!d) return;

    // 1. Vegetação
    this.setVal('diag-plants-alive', d.vegetation?.living ?? 0);
    this.setVal('diag-plants-repro', d.vegetation?.reproduced ?? 0);
    this.setVal('diag-plants-nutrient-deaths', d.vegetation?.nutrientDeaths ?? 0);
    this.setVal('diag-plants-age-deaths', d.vegetation?.ageDeaths ?? 0);
    this.setVal('diag-plants-flood-deaths', d.vegetation?.floodDeaths ?? 0);
    this.setVal('diag-plants-grazing-deaths', d.vegetation?.grazingDeaths ?? 0);
    this.setVal('diag-plants-growth-active', d.vegetation?.growthUpdates ?? 0);
    this.setVal('diag-plants-growth-blocked', d.vegetation?.growthBlocked ?? 0);

    // 2. Densidade & População
    this.setVal('diag-pop-total', d.density?.population ?? 0);
    this.setVal('diag-pop-herbivores', d.density?.herbivoreCount ?? 0);
    this.setVal('diag-pop-carnivores', d.density?.carnivoreCount ?? 0);
    this.setVal('diag-pop-avg-neighbors', d.density?.avgNeighbors ?? 0);
    this.setVal('diag-pop-max-neighbors', d.density?.maxNeighbors ?? 0);
    this.setVal('diag-pop-above-two', d.density?.aboveTwo ?? 0);
    this.setVal('diag-pop-above-four', d.density?.aboveFour ?? 0);
    this.setVal('diag-pop-min-carn-size', d.density?.minCarnivoreSize ?? 0);
    this.setVal('diag-pop-avg-carn-size', d.density?.avgCarnivoreSize ?? 0);
    this.setVal('diag-pop-max-carn-size', d.density?.maxCarnivoreSize ?? 0);
    this.setVal('diag-pop-diseased', d.density?.diseasedCount ?? 0);

    // 3. Energia
    this.setVal('diag-energy-avg-gen', d.energy?.avgGeneral ?? 0);
    this.setVal('diag-energy-avg-herb', d.energy?.avgHerbivore ?? 0);
    this.setVal('diag-energy-avg-carn', d.energy?.avgCarnivore ?? 0);
    this.setVal('diag-energy-critical', d.energy?.criticalLow ?? 0);
    this.setVal('diag-energy-critical-sick', d.energy?.criticalLowSick ?? 0);

    // 4. Mortalidade
    this.setVal('diag-mort-energy', d.mortality?.energyDeaths ?? 0);
    this.setVal('diag-mort-age', d.mortality?.ageDeaths ?? 0);
    this.setVal('diag-mort-healthy', d.mortality?.healthyDeaths ?? 0);
    this.setVal('diag-mort-sick', d.mortality?.sickDeaths ?? 0);
    this.setVal('diag-mort-juvenile', d.mortality?.juvenileDeaths ?? 0);
    this.setVal('diag-mort-adult', d.mortality?.adultDeaths ?? 0);

    // 5. IA & Comportamentos
    this.setVal('diag-ai-herb-vision-avg', d.ai?.avgHerbivorePerception ?? 0);
    this.setVal('diag-ai-herb-vision-max', d.ai?.maxHerbivorePerception ?? 0);
    this.setVal('diag-ai-pred-vision-avg', d.ai?.avgPredatorPerception ?? 0);
    this.setVal('diag-ai-flee-events', d.ai?.fleeEvents ?? 0);
    this.setVal('diag-ai-herb-meals', d.ai?.herbivoreMeals ?? 0);
    this.setVal('diag-ai-carcass-meals', d.ai?.carcassMeals ?? 0);
    this.setVal('diag-ai-herb-carcass-meals', d.ai?.herbivoreCarcassMeals ?? 0);
    this.setVal('diag-ai-carn-carcass-meals', d.ai?.carnivoreCarcassMeals ?? 0);
    this.setVal('diag-ai-kills-other', d.ai?.otherSpeciesKills ?? 0);
    this.setVal('diag-ai-kills-prey', d.ai?.nonCarnivorePreyKills ?? 0);
    this.setVal('diag-ai-kills-carn', d.ai?.carnivorePreyKills ?? 0);
    this.setVal('diag-ai-cannibal', d.ai?.cannibalAttacks ?? 0);
    this.setVal('diag-ai-prion', d.ai?.prionInfections ?? 0);
    this.setVal('diag-ai-carcass-dist-avg', d.ai?.avgCarcassDistance ?? 0);

    // 6. Solo & Nitrogênio
    const soilContainer = document.getElementById('diag-soil-table-body');
    if (soilContainer && d.soil) {
      let rows = '';
      for (const [biome, stats] of Object.entries(d.soil)) {
        const icon = biome === 'fertile' ? '🌱 Fértil' : (biome === 'dry' ? '🏜️ Árido' : (biome === 'water' ? '💧 Água' : biome));
        rows += `
          <tr>
            <td><strong>${icon}</strong></td>
            <td>${stats.cells ?? stats.celulas}</td>
            <td><span class="badge-num">${stats.avgNitrogen ?? stats.media ?? (stats.totalNitrogen / stats.cells).toFixed(1)}</span></td>
            <td>${stats.minNitrogen ?? stats.minimo ?? stats.minNitrogen}</td>
            <td>${stats.maxNitrogen ?? stats.maximo ?? stats.maxNitrogen}</td>
          </tr>
        `;
      }
      soilContainer.innerHTML = rows;
    }
  }

  setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  renderTerminal() {
    const container = document.getElementById('console-terminal-lines');
    if (!container) return;

    container.innerHTML = '';
    const filtered = this.logs.filter(e => this.matchesFilter(e));

    filtered.forEach(entry => {
      this.appendLogDOM(entry, container);
    });

    if (this.autoScroll) {
      const body = document.getElementById('console-terminal-body');
      if (body) body.scrollTop = body.scrollHeight;
    }
  }

  appendLogDOM(entry, container) {
    const row = document.createElement('div');
    row.className = `terminal-line line-${entry.level} cat-${entry.category}`;

    const catBadge = this.getCategoryBadge(entry.category);

    row.innerHTML = `
      <span class="term-time">${entry.timestamp}</span>
      <span class="term-cat">${catBadge}</span>
      <span class="term-msg">${this.escapeHTML(entry.text)}</span>
    `;

    container.appendChild(row);
  }

  getCategoryBadge(cat) {
    switch(cat) {
      case 'vegetation': return '🌿 VEGETAÇÃO';
      case 'density':    return '👥 DENSIDADE';
      case 'energy':     return '⚡ ENERGIA';
      case 'mortality':  return '💀 MORTALIDADE';
      case 'ai':         return '🧠 IA & AÇÃO';
      case 'soil':       return '🧪 SOLO/BIOMA';
      case 'evolution':  return '🧬 EVOLUÇÃO';
      default:           return '💻 SISTEMA';
    }
  }

  escapeHTML(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  clearLogs() {
    this.logs = [];
    this.renderTerminal();
  }

  copyAllLogs() {
    const text = this.logs.map(l => `[${l.timestamp}] [${l.category.toUpperCase()}] ${l.text}`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      if (typeof toast === 'function') toast('📋 Todos os logs foram copiados para a área de transferência!');
    }).catch(() => {
      alert('Não foi possível copiar automaticamente.');
    });
  }

  downloadLogs() {
    const text = this.logs.map(l => `[${l.timestamp}] [${l.category.toUpperCase()}] ${l.text}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evosim-console-logs-tick-${engine?.tickCount || 0}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── CONTROLES DE EQUILÍBRIO & EVOLUÇÃO ──
  syncBalanceUI() {
    if (typeof engine === 'undefined' || !engine.equilibriumSettings) return;
    const cfg = engine.equilibriumSettings;

    const cbAutoHomeostasis = document.getElementById('setting-auto-homeostasis');
    const rangeSeedBank = document.getElementById('setting-seed-bank');
    const rangeGrazing = document.getElementById('setting-grazing-resilience');
    const rangeSatiety = document.getElementById('setting-predator-satiety');
    const rangeFlee = document.getElementById('setting-flee-perception');
    const rangeMutation = document.getElementById('setting-mutation-multiplier');

    if (cbAutoHomeostasis) cbAutoHomeostasis.checked = !!cfg.autoHomeostasis;
    if (rangeSeedBank) {
      rangeSeedBank.value = Math.round((cfg.seedBankRate || 0.12) * 100);
      document.getElementById('val-seed-bank').textContent = rangeSeedBank.value + '%';
    }
    if (rangeGrazing) {
      rangeGrazing.value = Math.round((cfg.grazingResilience || 0.85) * 100);
      document.getElementById('val-grazing-resilience').textContent = rangeGrazing.value + '%';
    }
    if (rangeSatiety) {
      rangeSatiety.value = Math.round((cfg.predatorSatietyThreshold || 0.65) * 100);
      document.getElementById('val-predator-satiety').textContent = rangeSatiety.value + '%';
    }
    if (rangeFlee) {
      rangeFlee.value = Math.round((cfg.fleePerceptionFactor || 1.0) * 100);
      document.getElementById('val-flee-perception').textContent = rangeFlee.value + '%';
    }
    if (rangeMutation) {
      rangeMutation.value = (cfg.mutationRateMultiplier || 1.0).toFixed(1);
      document.getElementById('val-mutation-multiplier').textContent = rangeMutation.value + 'x';
    }
  }

  applyBalanceSetting(key, value) {
    if (typeof engine === 'undefined') return;
    if (!engine.equilibriumSettings) engine.initEquilibriumSettings();
    engine.equilibriumSettings[key] = value;
    if (typeof toast === 'function') {
      toast(`⚙️ Ajuste ecológico atualizado: ${key} = ${value}`);
    }
  }

  applyPreset(presetName) {
    if (typeof engine === 'undefined') return;
    if (!engine.equilibriumSettings) engine.initEquilibriumSettings();

    switch(presetName) {
      case 'sustainable':
        // Equilíbrio sustentável ideal (Lotka-Volterra estável com evolução)
        engine.equilibriumSettings.autoHomeostasis = true;
        engine.equilibriumSettings.seedBankRate = 0.14;
        engine.equilibriumSettings.grazingResilience = 0.85;
        engine.equilibriumSettings.predatorSatietyThreshold = 0.65;
        engine.equilibriumSettings.fleePerceptionFactor = 1.0;
        engine.equilibriumSettings.mutationRateMultiplier = 1.0;
        engine.equilibriumSettings.vegetativeSpreading = true;
        if (typeof toast === 'function') toast('🌿 Modo Equilíbrio Sustentável ativado com sucesso!');
        break;

      case 'accelerated-evolution':
        // Alta pressão de mutação e diversificação rápida
        engine.equilibriumSettings.autoHomeostasis = true;
        engine.equilibriumSettings.seedBankRate = 0.18;
        engine.equilibriumSettings.grazingResilience = 0.90;
        engine.equilibriumSettings.predatorSatietyThreshold = 0.60;
        engine.equilibriumSettings.fleePerceptionFactor = 1.2;
        engine.equilibriumSettings.mutationRateMultiplier = 2.2;
        engine.equilibriumSettings.vegetativeSpreading = true;
        if (typeof toast === 'function') toast('⚡ Modo Evolução Acelerada ativado: alta taxa de mutações!');
        break;

      case 'hardcore':
        // Sem homeostase artificial: desafio estrito
        engine.equilibriumSettings.autoHomeostasis = false;
        engine.equilibriumSettings.seedBankRate = 0.04;
        engine.equilibriumSettings.grazingResilience = 0.50;
        engine.equilibriumSettings.predatorSatietyThreshold = 0.85;
        engine.equilibriumSettings.fleePerceptionFactor = 0.8;
        engine.equilibriumSettings.mutationRateMultiplier = 0.8;
        engine.equilibriumSettings.vegetativeSpreading = false;
        if (typeof toast === 'function') toast('🦁 Modo Mundo Selvagem ativado: seleção rigorosa sem rede de proteção!');
        break;

      case 'emergency-rescue':
        // Revitalização imediata do mundo
        engine.performEmergencyEcologicalRescue();
        if (typeof toast === 'function') toast('🚑 Socorro Ecológico aplicado: solo enriquecido e novas mudas plantadas!');
        break;
    }

    this.syncBalanceUI();
  }
}

// Instância singleton global do Console do Sistema
const systemConsole = new SystemConsoleManager();
window.systemConsole = systemConsole;

// Inicia imediatamente a interceptação para não perder nenhum log desde a inicialização
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => systemConsole.init());
  } else {
    systemConsole.init();
  }
}
