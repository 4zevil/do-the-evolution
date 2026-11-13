// ====================================================
//  CONSTANTS.JS — Constantes globais da simulação
// ====================================================

export const SEASONS = [
  { name: 'Primavera', icon: '🌸', temp: 0.0, rain: 1.5, sunlight: 1.4, thermalCost: 1.0 },
  { name: 'Verão',     icon: '☀️', temp: 0.8, rain: 0.6, sunlight: 1.7, thermalCost: 1.2 },
  { name: 'Outono',    icon: '🍂', temp: -0.2, rain: 1.1, sunlight: 0.9, thermalCost: 1.0 },
  { name: 'Inverno',   icon: '❄️', temp: -0.7, rain: 0.5, sunlight: 0.6, thermalCost: 1.35 }
];

export const HARD_CRASH_FAILSAFE = 600;

export const SPECIES_PALETTE = [
  '#58a6ff', '#3fb950', '#ffa657', '#d2a8ff', '#f78166',
  '#79c0ff', '#56d364', '#e3b341', '#f0883e', '#db61a2',
  '#2ea043', '#388bfd', '#bc8cff', '#ff7b72', '#238636'
];
