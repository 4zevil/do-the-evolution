// ====================================================
//  RENDERER.JS — Sistema de renderização da simulação
// ====================================================

import { SEASONS } from '../core/constants.js';

export class Renderer {
  constructor(engine) {
    this.engine = engine;
  }

  render() {
    const engine = this.engine;
    if (!engine.ctx || !engine.canvas) return;
    const ctx = engine.ctx;
    const W = engine.canvas.width, H = engine.canvas.height;
    ctx.clearRect(0, 0, W, H);

    if (engine.terrainCanvas && engine.terrainCanvas.width === W && engine.terrainCanvas.height === H) {
      ctx.drawImage(engine.terrainCanvas, 0, 0);
    } else {
      engine.createTerrainCache();
      if (engine.terrainCanvas) ctx.drawImage(engine.terrainCanvas, 0, 0);
    }

    // Carcaças
    engine.carcasses.forEach(c => {
      if (!c || c.remainingEnergy <= 0) return;
      ctx.save();
      if (engine.highlightedSpecies) {
        ctx.globalAlpha = 0.25;
      }
      ctx.translate(c.x, c.y);
      ctx.fillStyle = '#8b263e';
      ctx.beginPath();
      ctx.ellipse(0, 0, 6, 4, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e6edf3';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-3, 0); ctx.lineTo(3, 0);
      ctx.stroke();
      ctx.restore();
    });

    // Vegetais
    if (engine.simplifiedSprites) {
      engine.plants.forEach(plant => {
        try {
          const isTargetSpecies = !engine.highlightedSpecies || (plant.name === engine.highlightedSpecies);
          const pScale = 0.35 + (plant.growth || 0.5) * 0.35;
          const r = Math.max(2.5, (3 + (plant.genes?.height || 0.5) * 5) * pScale);
          const hue = plant.genes?.colorHue ?? 110;
          ctx.fillStyle = `hsl(${hue}, 70%, 42%)`;
          ctx.beginPath();
          ctx.arc(plant.x, plant.y, r, 0, Math.PI * 2);
          ctx.fill();

          if (plant.hasFruit) {
            ctx.fillStyle = '#ff4d4f';
            ctx.beginPath();
            ctx.arc(plant.x, plant.y - r * 0.5, 2, 0, Math.PI * 2);
            ctx.fill();
          }

          if (engine.highlightedSpecies && isTargetSpecies) {
            ctx.strokeStyle = '#56d364';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        } catch (err) {}
      });
    } else {
      engine.plants.forEach(plant => {
        try {
          const isTargetSpecies = !engine.highlightedSpecies || (plant.name === engine.highlightedSpecies);
          ctx.save();
          if (engine.highlightedSpecies && !isTargetSpecies) {
            ctx.globalAlpha = 0.20;
          }
          const pScale = 0.35 + (plant.growth || 0.5) * 0.35;
          drawPlant(ctx, plant.genes, plant.x, plant.y + 4, pScale, plant.customImages || {});
          ctx.restore();

          if (engine.highlightedSpecies && isTargetSpecies) {
            ctx.save();
            const pulse = (Math.sin(Date.now() * 0.007) + 1) * 0.5;
            const spData = engine.speciesCatalog.find(s => s.name === plant.name);
            const glowColor = spData ? spData.color : '#3fb950';

            ctx.strokeStyle = glowColor;
            ctx.lineWidth = 2.5;
            ctx.shadowColor = glowColor;
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(plant.x, plant.y, 16 + pulse * 4, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
        } catch (err) {
          ctx.restore();
        }
      });
    }

    // Animais
    if (engine.simplifiedSprites) {
      engine.animals.forEach(anim => {
        try {
          const isCarn = (anim.genes?.diet?.meat || 0) > 0.45;
          const animSize = anim.genes?.size ?? 0.5;
          const r = Math.max(3.5, 4 + animSize * 7);

          if (isCarn) {
            ctx.fillStyle = '#f85149';
          } else {
            const hue = anim.genes?.colorHue ?? 120;
            ctx.fillStyle = `hsl(${hue}, 70%, 48%)`;
          }

          ctx.beginPath();
          ctx.arc(anim.x, anim.y, r, 0, Math.PI * 2);
          ctx.fill();

          const heading = Math.atan2(anim.vy || 0, anim.vx || 0);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(anim.x, anim.y);
          ctx.lineTo(anim.x + Math.cos(heading) * (r + 3.5), anim.y + Math.sin(heading) * (r + 3.5));
          ctx.stroke();

          if (anim.isDiseased) {
            ctx.strokeStyle = '#d2a8ff';
            ctx.lineWidth = 2;
            ctx.stroke();
          } else if (anim.isPregnant) {
            ctx.strokeStyle = '#ffa657';
            ctx.lineWidth = 2;
            ctx.stroke();
          }

          const barW = 12, barH = 2;
          const maxE = anim.maxEnergy || 100.0;
          const energyPct = Math.max(0, Math.min(1, anim.energy / maxE));
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.fillRect(anim.x - barW/2, anim.y - r - 4, barW, barH);
          ctx.fillStyle = energyPct > 0.5 ? '#3fb950' : (energyPct > 0.25 ? '#e3b341' : '#f78166');
          ctx.fillRect(anim.x - barW/2, anim.y - r - 4, barW * energyPct, barH);
        } catch (err) {}
      });
    } else {
      engine.animals.forEach(anim => {
        try {
          const animSpecies = anim.speciesName || anim.name;
          const isTargetSpecies = !engine.highlightedSpecies || (animSpecies === engine.highlightedSpecies);

          ctx.save();
          if (engine.highlightedSpecies && !isTargetSpecies) {
            ctx.globalAlpha = 0.20;
          }

          const animSize = anim.genes?.size ?? 0.5;
          const aScale = 0.35 + animSize * 0.35;
          drawCreature(ctx, anim.genes || {}, anim.x, anim.y, aScale, anim.customImages || {});

          if (anim.isDiseased) {
            ctx.strokeStyle = '#d2a8ff';
            ctx.lineWidth = 1.8;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.arc(anim.x, anim.y, 14 + animSize * 10, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
          }

          if (anim.isPregnant) {
            ctx.strokeStyle = '#ffa657';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(anim.x, anim.y, 12 + animSize * 8, 0, Math.PI * 2);
            ctx.stroke();
          }

          const barW = 18, barH = 3;
          const maxE = anim.maxEnergy || 100.0;
          const energyPct = Math.max(0, anim.energy / maxE);
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillRect(anim.x - barW/2, anim.y - 18, barW, barH);
          ctx.fillStyle = anim.isDiseased
            ? '#d2a8ff'
            : (anim.isPregnant ? '#ffa657' : (energyPct > 0.5 ? '#3fb950' : (energyPct > 0.25 ? '#e3b341' : '#f78166')));
          ctx.fillRect(anim.x - barW/2, anim.y - 18, barW * energyPct, barH);
          ctx.restore();
        } catch (err) {
          ctx.restore();
        }
      });
    }

    if (engine.selectedEntity) {
      const isAlive = engine.selectedEntity.type === 'animal'
        ? engine.animals.includes(engine.selectedEntity.data)
        : engine.plants.includes(engine.selectedEntity.data);

      if (!isAlive) {
        engine.selectedEntity = null;
        this.updateInspectorUI();
      } else {
        const e = engine.selectedEntity.data;
        ctx.save();
        ctx.strokeStyle = '#3fb950';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(e.x, e.y, 22, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    const effectiveTemp = SEASONS[engine.seasonIndex].temp + (engine.climateTrend || 0);
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

    // Catástrofes e meteoros
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

            eff.particles.forEach(p => {
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
            });
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

  updateStatsUI() {
    const engine = this.engine;
    const elSeason = document.getElementById('sim-season-badge');
    const elGen = document.getElementById('sim-gen-badge');
    const elAnimals = document.getElementById('stat-animals-count');
    const elPlants = document.getElementById('stat-plants-count');
    const elCarcasses = document.getElementById('stat-carcasses-count');

    const curSeason = SEASONS[engine.seasonIndex];
    const effTemp = curSeason.temp + (engine.climateTrend || 0);
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

    this.updateCensusUI();

    if (engine.selectedEntity) {
      this.updateInspectorUI();
    }

    if (typeof window !== 'undefined' && window.systemConsole) {
      if (typeof window.systemConsole.updateConsoleHeader === 'function') window.systemConsole.updateConsoleHeader();
    }
  }

  updateCensusUI() {
    const engine = this.engine;
    const censusBox = document.getElementById('sim-species-census');
    if (!censusBox) return;

    if (engine.speciesCatalog.length === 0) {
      censusBox.innerHTML = '<span style="color:var(--text-dim);font-size:11px;">Nenhuma espécie cadastrada.</span>';
      return;
    }

    const animalCounts = {};
    engine.animals.forEach(a => {
      const sp = a.speciesName || a.name;
      animalCounts[sp] = (animalCounts[sp] || 0) + 1;
    });

    const plantCounts = {};
    engine.plants.forEach(p => {
      const sp = p.name;
      plantCounts[sp] = (plantCounts[sp] || 0) + 1;
    });

    const totalAnimals = engine.animals.length || 1;
    const totalPlants = engine.plants.length || 1;

    const animalSpecies = engine.speciesCatalog.filter(s => s.type === 'animal');
    const plantSpecies = engine.speciesCatalog.filter(s => s.type === 'plant');

    let html = '';

    if (animalSpecies.length > 0) {
      html += '<div style="font-weight:700;color:var(--text-dim);font-size:10px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;display:flex;justify-content:space-between;">' +
              '<span>🦊 População Animal (' + engine.animals.length + ')</span>' +
              '<span style="font-size:9px;text-transform:none;opacity:0.8;">(Clique para focar)</span></div>';

      animalSpecies.forEach(sp => {
        const count = animalCounts[sp.name] || 0;
        const pct = Math.min(100, Math.round((count / totalAnimals) * 100));
        const isExtinct = (count === 0);
        const isHighlighted = (engine.highlightedSpecies === sp.name);

        html += `
          <div class="census-row ${isHighlighted ? 'active-focus' : ''}"
               onclick="engine.toggleHighlightSpecies('${sp.name.replace(/'/g, "\\'")}')"
               title="Clique para destacar todos os exemplares de ${sp.name}"
               style="cursor:pointer; padding:4px 6px; border-radius:6px; margin-bottom:3px; transition:all .15s; ${isHighlighted ? `background:rgba(255,255,255,0.12); box-shadow:0 0 0 1.5px ${sp.color};` : ''} ${isExtinct ? 'opacity:0.35;filter:grayscale(1);' : ''}">
            <span class="census-name" title="${sp.name}" style="display:flex;align-items:center;gap:4px;">
              ${isHighlighted ? '👁️ ' : ''}${sp.name}
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
              '<span>🌿 População Vegetal (' + engine.plants.length + ')</span>' +
              '<span style="font-size:9px;text-transform:none;opacity:0.8;">(Clique para focar)</span></div>';

      plantSpecies.forEach(sp => {
        const count = plantCounts[sp.name] || 0;
        const pct = Math.min(100, Math.round((count / totalPlants) * 100));
        const isExtinct = (count === 0);
        const isHighlighted = (engine.highlightedSpecies === sp.name);

        html += `
          <div class="census-row ${isHighlighted ? 'active-focus' : ''}"
               onclick="engine.toggleHighlightSpecies('${sp.name.replace(/'/g, "\\'")}')"
               title="Clique para destacar os vegetais de ${sp.name}"
               style="cursor:pointer; padding:4px 6px; border-radius:6px; margin-bottom:3px; transition:all .15s; ${isHighlighted ? `background:rgba(255,255,255,0.12); box-shadow:0 0 0 1.5px ${sp.color};` : ''} ${isExtinct ? 'opacity:0.35;filter:grayscale(1);' : ''}">
            <span class="census-name" title="${sp.name}" style="display:flex;align-items:center;gap:4px;">
              ${isHighlighted ? '👁️ ' : ''}${sp.name}
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

  updateInspectorUI() {
    const engine = this.engine;
    const panel = document.getElementById('sim-inspector');
    if (!panel) return;

    if (!engine.selectedEntity) {
      panel.innerHTML = '<span style="color:var(--text-dim);font-size:12px;">Clique em um animal ou vegetal na grade para inspecionar parâmetros fisiológicos, patologias e genótipo.</span>';
      return;
    }

    const { type, data } = engine.selectedEntity;
    if (type === 'animal') {
      const g = data.genes;
      const mass = (5.0 + g.size * 70.0).toFixed(1);
      const diet = g.diet || { meat: 0, plant: 1, carcass: 0 };
      const kleiber = (0.06 * Math.pow(mass / 40.0, 0.75)).toFixed(3);
      
      let healthStatus = '<span style="color:#3fb950;">Saudável</span>';
      if (data.isDiseased) {
        healthStatus = `<span style="color:#d2a8ff;font-weight:700;">☣️ Príon (${data.diseaseTimer}t)</span>`;
      } else if (data.isPregnant) {
        healthStatus = `<span style="color:#ffa657;font-weight:700;">🤰 Gestação (${data.gestationTicks}t)</span>`;
      }

      panel.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <span style="font-size:18px;">🦊</span>
          <div>
            <strong style="color:var(--text-main);font-size:13px;">${data.name}</strong>
            <div style="font-size:11px;color:var(--accent);">${data.stateLabel}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px;color:var(--text-muted);">
          <div>⚡ Energia: <strong style="color:var(--text-main);">${Math.round(data.energy)}%</strong></div>
          <div>⚖️ Massa: <strong style="color:var(--text-main);">${mass} kg</strong></div>
          <div>🔬 Kleiber: ${kleiber} cal/t</div>
          <div>🩺 Estado: ${healthStatus}</div>
          <div>⏳ Idade: ${data.age} ticks</div>
          <div>🐟 Aquático: <strong style="color:var(--text-main);">${Math.round((g.aquatic || 0.15) * 100)}%</strong></div>
          <div>🥩 Carne: ${Math.round(diet.meat * 100)}%</div>
          <div>🌿 Planta: ${Math.round(diet.plant * 100)}%</div>
          <div>🦴 Carcaça: ${Math.round(diet.carcass * 100)}%</div>
        </div>
      `;
    } else {
      const g = data.genes;
      panel.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <span style="font-size:18px;">🌿</span>
          <div>
            <strong style="color:var(--text-main);font-size:13px;">${data.name}</strong>
            <div style="font-size:11px;color:var(--accent);">${data.hasFruit ? 'Fruto Maduro (Dispersão)' : 'Em Crescimento'}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px;color:var(--text-muted);">
          <div>🌱 Biomassa: <strong style="color:var(--text-main);">${Math.round(data.growth * 100)}%</strong></div>
          <div>⏳ Idade: ${data.age} ticks</div>
          <div>🌾 Efic. Raiz: ${Math.round(g.rootEfficiency * 100)}%</div>
          <div>🛡️ Defesa/Lignina: ${Math.round(g.defense * 100)}%</div>
        </div>
      `;
    }
  }
}
