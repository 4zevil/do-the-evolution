// ====================================================
//  ANALYTICS.JS — Gráficos Ecológicos & Árvore Filogenética
// ====================================================

class AnalyticsModal {
  constructor() {
    this.modal = null;
    this.canvas = null;
    this.ctx = null;
    this.currentTab = 'phylo'; // 'phylo', 'pop', 'genes'
    this.selectedGeneSpecies = null;
  }

  init() {
    this.modal = document.getElementById('analytics-modal');
    this.canvas = document.getElementById('analytics-canvas');
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
    }
  }

  open(tab = 'phylo') {
    if (!this.modal) this.init();
    this.currentTab = tab;
    this.modal.style.display = 'flex';
    this.switchTab(tab);
  }

  close() {
    if (this.modal) this.modal.style.display = 'none';
  }

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.analytics-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    const selectorWrap = document.getElementById('analytics-gene-selector-wrap');
    if (selectorWrap) {
      selectorWrap.style.display = tab === 'genes' ? 'flex' : 'none';
      if (tab === 'genes') this.populateGeneSpeciesSelect();
    }

    this.render();
  }

populateGeneSpeciesSelect() {
    const sel = document.getElementById('analytics-gene-species-select');
    if (!sel || !engine) return;

    sel.innerHTML = '';
    const allSpecies = engine.speciesCatalog || [];

    // Agrupa e lista tanto animais quanto vegetais
    allSpecies.forEach(sp => {
      const opt = document.createElement('option');
      opt.value = sp.name;
      opt.textContent = `${sp.type === 'plant' ? '🌿' : '🦊'} ${sp.name}`;
      sel.appendChild(opt);
    });

    const exists = allSpecies.some(a => a.name === this.selectedGeneSpecies);
    if ((!this.selectedGeneSpecies || !exists) && allSpecies.length > 0) {
      this.selectedGeneSpecies = allSpecies[0].name;
    }
    sel.value = this.selectedGeneSpecies || '';
  }

  onGeneSpeciesChange(val) {
    this.selectedGeneSpecies = val;
    this.render();
  }

  render() {
    if (!this.canvas || !this.ctx) return;
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Fundo quadriculado sutil de laboratório
    ctx.fillStyle = '#0a0e14';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#161f2c';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    if (this.currentTab === 'phylo') {
      this.renderPhylogeneticTree();
    } else if (this.currentTab === 'pop') {
      this.renderPopulationChart();
    } else if (this.currentTab === 'genes') {
      this.renderGeneTrajectoryChart();
    }
  }

  // ── 1. RENDERIZADOR DA ÁRVORE FILOGENÉTICA (CLADOGRAMA) ──
  renderPhylogeneticTree() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;

    const catalog = engine.speciesCatalog || [];
    if (catalog.length === 0) {
      ctx.fillStyle = '#8b949e';
      ctx.font = '14px sans-serif';
      ctx.fillText('Nenhuma espécie registrada ainda.', W / 2 - 100, H / 2);
      return;
    }

    // Contagem de indivíduos vivos atuais
    const aliveCounts = {};
    engine.animals.forEach(a => {
      const sp = a.speciesName || a.name;
      aliveCounts[sp] = (aliveCounts[sp] || 0) + 1;
    });

    // Filtra animais para o cladograma
    const animals = catalog.filter(s => s.type === 'animal');

    // Mapeamento hierárquico
    const nodeMap = new Map();
    animals.forEach(sp => {
      nodeMap.set(sp.name, {
        ...sp,
        children: [],
        alive: (aliveCounts[sp.name] || 0)
      });
    });

    const roots = [];
    animals.forEach(sp => {
      const node = nodeMap.get(sp.name);
      if (sp.ancestor && nodeMap.has(sp.ancestor)) {
        nodeMap.get(sp.ancestor).children.push(node);
      } else {
        roots.push(node);
      }
    });

    // Layout hierárquico horizontal (Raiz na esquerda -> Ramos na direita)
    let currentY = 50;
    const startX = 70;
    const levelSpacing = 160;
    const rowSpacing = Math.min(42, Math.max(22, (H - 90) / Math.max(1, animals.length)));

    function assignPositions(node, depth) {
      node.x = startX + depth * levelSpacing;
      if (node.children.length === 0) {
        node.y = currentY;
        currentY += rowSpacing;
      } else {
        node.children.forEach(c => assignPositions(c, depth + 1));
        const firstY = node.children[0].y;
        const lastY = node.children[node.children.length - 1].y;
        node.y = (firstY + lastY) / 2;
      }
    }

    roots.forEach(r => assignPositions(r, 0));

    // Desenha as linhas ortogonais de ramificação cladística
    function drawLinks(node) {
      node.children.forEach(child => {
        ctx.save();
        ctx.strokeStyle = child.alive > 0 ? child.color : '#484f58';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(node.x, node.y);
        ctx.lineTo(node.x + 35, node.y);
        ctx.lineTo(node.x + 35, child.y);
        ctx.lineTo(child.x, child.y);
        ctx.stroke();

        // Rótulo da mutação na ramificação
        if (child.divergentTrait) {
          ctx.fillStyle = '#e6edf3';
          ctx.font = '9px monospace';
          ctx.fillText(`+${child.divergentTrait}`, node.x + 40, child.y - 5);
        }
        ctx.restore();
        drawLinks(child);
      });
    }

    roots.forEach(r => drawLinks(r));

    // Desenha os nós (espécies)
    nodeMap.forEach(node => {
      ctx.save();
      const isExtinct = node.alive === 0;

      // Círculo do Nó
      ctx.fillStyle = isExtinct ? '#21262d' : node.color;
      ctx.strokeStyle = isExtinct ? '#484f58' : '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(node.x, node.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Rótulos de Texto
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = isExtinct ? '#8b949e' : '#e6edf3';
      ctx.fillText(node.name, node.x + 14, node.y + 4);

      // Metadados (Geração & População)
      ctx.font = '10px monospace';
      ctx.fillStyle = isExtinct ? '#f78166' : node.color;
      const statusText = isExtinct ? '✖ Extinta' : `● ${node.alive} vivos`;
      ctx.fillText(`[G${node.generation || 1}] ${statusText}`, node.x + 14, node.y + 16);

      ctx.restore();
    });
  }

  // ── 2. RENDERIZADOR DO GRÁFICO POPULACIONAL (LOTKA-VOLTERRA) ──
  renderPopulationChart() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const history = engine.history || [];

    if (history.length < 2) {
      ctx.fillStyle = '#8b949e';
      ctx.font = '14px sans-serif';
      ctx.fillText('Coletando dados temporais... aguarde alguns ticks.', W / 2 - 130, H / 2);
      return;
    }

    const padL = 60, padR = 140, padT = 30, padB = 40;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    // Encontra a população máxima registrada
    let maxVal = 10;
    history.forEach(h => {
      Object.values(h.populations).forEach(v => { if (v > maxVal) maxVal = v; });
    });
    maxVal = Math.ceil(maxVal * 1.15);

    // Eixos
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, padT); ctx.lineTo(padL, H - padB); ctx.lineTo(W - padR, H - padB);
    ctx.stroke();

    // Linhas de grade e valores no eixo Y
    ctx.fillStyle = '#8b949e';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
      const y = padT + (plotH / 5) * i;
      const val = Math.round(maxVal - (maxVal / 5) * i);
      ctx.fillText(val, padL - 8, y + 4);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    }

    // Desenha as curvas para cada espécie
    const catalog = engine.speciesCatalog || [];
    catalog.forEach(sp => {
      ctx.save();
      ctx.strokeStyle = sp.color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      let started = false;
      history.forEach((h, idx) => {
        const count = h.populations[sp.name] || 0;
        const x = padL + (idx / (history.length - 1)) * plotW;
        const y = padT + plotH - (count / maxVal) * plotH;

        if (!started) { ctx.moveTo(x, y); started = true; }
        else { ctx.lineTo(x, y); }
      });
      ctx.stroke();

      // Rótulo na ponta da linha
      const lastCount = history[history.length - 1].populations[sp.name] || 0;
      const lastX = padL + plotW;
      const lastY = padT + plotH - (lastCount / maxVal) * plotH;
      ctx.fillStyle = sp.color;
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${sp.name} (${lastCount})`, lastX + 6, lastY + 3);
      ctx.restore();
    });

    ctx.textAlign = 'center';
    ctx.fillStyle = '#8b949e';
    ctx.fillText('Tempo (Ticks / Histórico Recente) ➔', padL + plotW / 2, H - 12);
  }

  // ── 3. RENDERIZADOR DA TRAJETÓRIA GÊNICA (SELEÇÃO NATURAL) ──
  renderGeneTrajectoryChart() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const history = engine.history || [];
    const targetSp = this.selectedGeneSpecies;

    if (!targetSp || history.length < 2) {
      ctx.fillStyle = '#8b949e';
      ctx.font = '14px sans-serif';
      ctx.fillText('Selecione uma espécie para visualizar a frequência alélica.', W / 2 - 140, H / 2);
      return;
    }

    const padL = 60, padR = 140, padT = 30, padB = 40;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    // Eixos
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, padT); ctx.lineTo(padL, H - padB); ctx.lineTo(W - padR, H - padB);
    ctx.stroke();

    // Eixo Y (0% a 100%)
    ctx.fillStyle = '#8b949e';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const y = padT + (plotH / 4) * i;
      const pct = Math.round(100 - (100 / 4) * i) + '%';
      ctx.fillText(pct, padL - 8, y + 4);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    }

    const targetSpData = (engine.speciesCatalog || []).find(s => s.name === targetSp);
    const isPlant = targetSpData?.type === 'plant';

    const trackedGenes = isPlant ? [
      { key: 'height', name: 'Altura (Porte)', color: '#58a6ff' },
      { key: 'defense', name: 'Defesa (Espinhos)', color: '#f78166' },
      { key: 'rootEfficiency', name: 'Eficiência de Raiz', color: '#3fb950' },
      { key: 'thermal', name: 'Adaptação Térmica', color: '#ffa657' }
    ] : [
      { key: 'size', name: 'Porte (Massa)', color: '#58a6ff' },
      { key: 'speed', name: 'Velocidade', color: '#3fb950' },
      { key: 'dietMeat', name: 'Dieta Carnívora', color: '#f78166' },
      { key: 'thermal', name: 'Adaptação Térmica', color: '#ffa657' }
    ];

    trackedGenes.forEach(tg => {
      ctx.save();
      ctx.strokeStyle = tg.color;
      ctx.lineWidth = 2.2;
      ctx.beginPath();

      let started = false;
      let lastVal = 0;

      history.forEach((h, idx) => {
        const geneData = h.meanGenes[targetSp];
        let val = 0.5;
        if (geneData && geneData[tg.key] !== undefined) {
          val = geneData[tg.key];
          // Normaliza thermal (-1 a 1 para 0 a 1)
          if (tg.key === 'thermal') val = (val + 1) / 2;
        }

        const x = padL + (idx / (history.length - 1)) * plotW;
        const y = padT + plotH - val * plotH;

        if (!started) { ctx.moveTo(x, y); started = true; }
        else { ctx.lineTo(x, y); }
        lastVal = val;
      });
      ctx.stroke();

      // Legenda à direita
      const lastX = padL + plotW;
      const lastY = padT + plotH - lastVal * plotH;
      ctx.fillStyle = tg.color;
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${tg.name} (${Math.round(lastVal * 100)}%)`, lastX + 6, lastY + 3);
      ctx.restore();
    });

    ctx.textAlign = 'center';
    ctx.fillStyle = '#8b949e';
    ctx.fillText(`Média Genética ao Longo das Gerações: ${targetSp}`, padL + plotW / 2, H - 12);
  }
}

const analyticsModal = new AnalyticsModal();