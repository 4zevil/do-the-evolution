// ====================================================
//  CLIMATESYSTEM.JS — Sistema de mudança climática global e clima local
// ====================================================

import { SEASONS } from '../core/constants.js';

export class ClimateSystem {
  constructor(engine = null) {
    this.engine = engine;
    this.climateOffset = 0.0;
    this.currentSeasonIndex = 0;
    this.currentSeasonTemp = SEASONS[0]?.temp ?? 0.0;
  }

  /**
   * Desloca o offset permanente de temperatura para simular mudanças climáticas.
   * @param {number} delta — valor entre -0.5 e +0.5 (cada unidade ≈ 8°C)
   */
  shift(delta) {
    this.climateOffset = Math.max(-1.5, Math.min(1.5, (this.climateOffset || 0) + delta));
    const offsetC = Math.round(this.climateOffset * 16);
    const sign = offsetC >= 0 ? '+' : '';
    const icon = this.climateOffset > 0.3 ? '🔥' : (this.climateOffset < -0.3 ? '🧊' : '🌡️');
    if (typeof toast === 'function') {
      toast(`${icon} Mudança Climática: temperatura base ${sign}${offsetC}°C (offset acumulado)`);
    }
  }

  reset() {
    this.climateOffset = 0.0;
  }

  /**
   * Atualiza a estação atual de referência.
   * @param {number|object} seasonOrIndex — índice em SEASONS ou objeto de estação ({ temp, name, ... })
   */
  setSeason(seasonOrIndex) {
    if (typeof seasonOrIndex === 'number') {
      const idx = ((seasonOrIndex % SEASONS.length) + SEASONS.length) % SEASONS.length;
      this.currentSeasonIndex = idx;
      this.currentSeasonTemp = SEASONS[idx].temp;
    } else if (seasonOrIndex && typeof seasonOrIndex.temp === 'number') {
      const foundIdx = SEASONS.findIndex(s => s.name === seasonOrIndex.name);
      if (foundIdx >= 0) this.currentSeasonIndex = foundIdx;
      this.currentSeasonTemp = seasonOrIndex.temp;
    }
  }

  /**
   * Obtém a temperatura base da estação atual.
   * @param {number|object|null} [seasonOverride=null]
   * @returns {number}
   */
  getSeasonTemperature(seasonOverride = null) {
    if (typeof seasonOverride === 'number') {
      return seasonOverride;
    }
    if (seasonOverride && typeof seasonOverride.temp === 'number') {
      return seasonOverride.temp;
    }
    if (this.engine && SEASONS[this.engine.seasonIndex]) {
      return SEASONS[this.engine.seasonIndex].temp;
    }
    if (
      typeof globalThis !== 'undefined' &&
      globalThis.engine &&
      globalThis.engine.climate === this &&
      SEASONS[globalThis.engine.seasonIndex]
    ) {
      return SEASONS[globalThis.engine.seasonIndex].temp;
    }
    return this.currentSeasonTemp;
  }

  /**
   * Calcula a temperatura efetiva de uma GridCell:
   * temperatura da estação + offset global + cell.localTempOffset.
   * @param {import('../world/GridCell.js').GridCell|null} cell
   * @param {number|object|null} [seasonOverride=null]
   * @returns {number}
   */
  getCellTemperature(cell, seasonOverride = null) {
    const seasonTemp = this.getSeasonTemperature(seasonOverride);
    const globalOffset = this.climateOffset || 0.0;
    const localOffset = cell?.localTempOffset ?? 0.0;
    return seasonTemp + globalOffset + localOffset;
  }

  /**
   * Converte temperatura interna para escala aproximada em °C exibida na UI.
   * @param {number} internalTemp
   * @returns {number}
   */
  toCelsius(internalTemp) {
    return Math.round(18 + internalTemp * 16);
  }

  /**
   * Computa a tendência climática atual baseada em geração e tick.
   * @param {number} tick — tickCount atual do motor
   * @param {number} generation — geração atual
   * @returns {number} climateTrend
   */
  computeTrend(tick, generation) {
    return (this.climateOffset || 0) + (-0.00015 * generation + Math.sin(tick * 0.0012) * 0.25);
  }
}
