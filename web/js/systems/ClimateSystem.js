// ====================================================
//  CLIMATESYSTEM.JS — Sistema de mudança climática global
// ====================================================

export class ClimateSystem {
  constructor() {
    this.climateOffset = 0.0;
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
   * Computa a tendência climática atual baseada em geração e tick.
   * @param {number} tick — tickCount atual do motor
   * @param {number} generation — geração atual
   * @returns {number} climateTrend
   */
  computeTrend(tick, generation) {
    return (this.climateOffset || 0) + (-0.00015 * generation + Math.sin(tick * 0.0012) * 0.25);
  }
}
