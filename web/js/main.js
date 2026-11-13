// ====================================================
//  MAIN.JS — Ponto de Entrada Principal (ES Modules & POO)
// ====================================================

import { SimulationEngine } from './SimulationEngine.js';
import { SEASONS, HARD_CRASH_FAILSAFE, SPECIES_PALETTE } from './core/constants.js';
import { UIController } from './controllers/UIController.js';
import { AnimalCreatorController } from './controllers/AnimalCreatorController.js';
import { PlantCreatorController } from './controllers/PlantCreatorController.js';
import { WorldCreatorController } from './controllers/WorldCreatorController.js';
import { SimulationController } from './controllers/SimulationController.js';

// Instância global do motor de simulação (acessível pelo sistema e UI)
const engine = new SimulationEngine();
window.engine = engine;
window.SEASONS = SEASONS;
window.HARD_CRASH_FAILSAFE = HARD_CRASH_FAILSAFE;
window.SPECIES_PALETTE = SPECIES_PALETTE;

// Pontes reativas para paint.js e outros scripts secundários
Object.defineProperty(window, 'currentAnimalImages', {
  get: () => AnimalCreatorController.currentImages,
  set: (v) => { AnimalCreatorController.currentImages = v; },
  configurable: true
});
Object.defineProperty(window, 'currentPlantImages', {
  get: () => PlantCreatorController.currentImages,
  set: (v) => { PlantCreatorController.currentImages = v; },
  configurable: true
});
Object.defineProperty(window, 'currentAnimalGenes', {
  get: () => AnimalCreatorController.currentGenes,
  set: (v) => { AnimalCreatorController.currentGenes = v; },
  configurable: true
});
Object.defineProperty(window, 'currentPlantGenes', {
  get: () => PlantCreatorController.currentGenes,
  set: (v) => { PlantCreatorController.currentGenes = v; },
  configurable: true
});
Object.defineProperty(window, 'savedAnimals', {
  get: () => AnimalCreatorController.savedAnimals,
  set: (v) => { AnimalCreatorController.savedAnimals = v; },
  configurable: true
});
Object.defineProperty(window, 'savedPlants', {
  get: () => PlantCreatorController.savedPlants,
  set: (v) => { PlantCreatorController.savedPlants = v; },
  configurable: true
});

// Exporta classes e controladores
export {
  engine,
  SimulationEngine,
  UIController,
  AnimalCreatorController,
  PlantCreatorController,
  WorldCreatorController,
  SimulationController
};

// ── MAPEAMENTO DE INTERFACE GLOBAL (COMPATIBILIDADE COM HTML INLINE) ──

// UI & Navegação
window.showPage = UIController.showPage.bind(UIController);
window.toast = UIController.toast.bind(UIController);
window.switchSidePanel = UIController.switchSidePanel.bind(UIController);
window.updateSideConsole = UIController.updateSideConsole.bind(UIController);

// Criador de Animais
window.initAnimalCreator = AnimalCreatorController.init.bind(AnimalCreatorController);
window.updateAnimalSliderLabel = AnimalCreatorController.updateSliderLabel.bind(AnimalCreatorController);
window.updateStrictDietUI = AnimalCreatorController.updateStrictDietUI.bind(AnimalCreatorController);
window.syncDietSlidersUI = AnimalCreatorController.syncDietSlidersUI.bind(AnimalCreatorController);
window.renderAnimalPreview = AnimalCreatorController.renderPreview.bind(AnimalCreatorController);
window.clearComponentImage = (type, part) => {
  if (type === 'animal') AnimalCreatorController.clearComponentImage('animal', part);
  else PlantCreatorController.clearComponentImage(part);
};
window.clearComponentImagePlant = PlantCreatorController.clearComponentImage.bind(PlantCreatorController);
window.updateComponentBox = AnimalCreatorController.updateComponentBox.bind(AnimalCreatorController);
window.switchAnimalSidebarTab = AnimalCreatorController.switchSidebarTab.bind(AnimalCreatorController);
window.saveAnimalSpecies = AnimalCreatorController.saveSpecies.bind(AnimalCreatorController);
window.exportAnimalPNG = AnimalCreatorController.exportPNG.bind(AnimalCreatorController);
window.renderSavedAnimalsList = AnimalCreatorController.renderSavedList.bind(AnimalCreatorController);
window.loadAnimal = AnimalCreatorController.load.bind(AnimalCreatorController);
window.deleteAnimal = AnimalCreatorController.delete.bind(AnimalCreatorController);
window.downloadAnimalPNG = AnimalCreatorController.downloadPNG.bind(AnimalCreatorController);
window.randomizeAnimalGenes = AnimalCreatorController.randomizeGenes.bind(AnimalCreatorController);
window.resetAnimalGenes = AnimalCreatorController.resetGenes.bind(AnimalCreatorController);

// Criador de Plantas
window.initPlantCreator = PlantCreatorController.init.bind(PlantCreatorController);
window.updatePlantSliderLabel = PlantCreatorController.updateSliderLabel.bind(PlantCreatorController);
window.renderPlantPreview = PlantCreatorController.renderPreview.bind(PlantCreatorController);
window.switchPlantSidebarTab = PlantCreatorController.switchSidebarTab.bind(PlantCreatorController);
window.savePlantSpecies = PlantCreatorController.saveSpecies.bind(PlantCreatorController);
window.exportPlantPNG = PlantCreatorController.exportPNG.bind(PlantCreatorController);
window.renderSavedPlantsList = PlantCreatorController.renderSavedList.bind(PlantCreatorController);
window.loadPlant = PlantCreatorController.load.bind(PlantCreatorController);
window.deletePlant = PlantCreatorController.delete.bind(PlantCreatorController);
window.downloadPlantPNG = PlantCreatorController.downloadPNG.bind(PlantCreatorController);
window.randomizePlantGenes = PlantCreatorController.randomizeGenes.bind(PlantCreatorController);
window.resetPlantGenes = PlantCreatorController.resetGenes.bind(PlantCreatorController);

// Criador de Mundos
window.initWorldCreator = WorldCreatorController.init.bind(WorldCreatorController);
window.selectWorldBiome = WorldCreatorController.selectBiome.bind(WorldCreatorController);
window.refreshWorldSpeciesCounts = WorldCreatorController.refreshSpeciesCounts.bind(WorldCreatorController);
window.createSpeciesCard = WorldCreatorController.createSpeciesCard.bind(WorldCreatorController);
window.setSpeciesCountSlider = WorldCreatorController.setSpeciesCountSlider.bind(WorldCreatorController);
window.adjustAllSpeciesCounts = WorldCreatorController.adjustAllSpeciesCounts.bind(WorldCreatorController);
window.zeroAllSpeciesCounts = WorldCreatorController.zeroAllSpeciesCounts.bind(WorldCreatorController);
window.updateWorldSpeciesTotals = WorldCreatorController.updateSpeciesTotals.bind(WorldCreatorController);
window.autoBalanceTrophicPopulations = WorldCreatorController.autoBalanceTrophicPopulations.bind(WorldCreatorController);
window.applyTestSpeciesProfile = WorldCreatorController.applyTestSpeciesProfile.bind(WorldCreatorController);
window.saveAndStartWorld = WorldCreatorController.saveAndStartWorld.bind(WorldCreatorController);
window.getSpeciesThumbnail = WorldCreatorController.getSpeciesThumbnail.bind(WorldCreatorController);

// Simulação & Câmera
window.simCamera = SimulationController.camera;
window.initSimulationScreen = SimulationController.init.bind(SimulationController);
window.startOrResumeSimulation = SimulationController.startOrResume.bind(SimulationController);
window.togglePlayPause = SimulationController.togglePlayPause.bind(SimulationController);
window.updatePlayPauseButtonUI = SimulationController.updatePlayPauseButtonUI.bind(SimulationController);
window.setSimSpeed = SimulationController.setSpeed.bind(SimulationController);
window.simFastForward = SimulationController.fastForward.bind(SimulationController);
window.resetSimulation = SimulationController.reset.bind(SimulationController);
window.goToWorldCreatorFromExtinction = SimulationController.goToWorldCreatorFromExtinction.bind(SimulationController);
window.resetSimulationFromExtinction = SimulationController.resetFromExtinction.bind(SimulationController);
window.viewAnalyticsFromExtinction = SimulationController.viewAnalyticsFromExtinction.bind(SimulationController);
window.applyWorldEvoPreset = SimulationController.applyWorldEvoPreset.bind(SimulationController);
window.toggleSimplifiedSprites = SimulationController.toggleSimplifiedSprites.bind(SimulationController);
window.updateSimplifiedButtonUI = SimulationController.updateSimplifiedButtonUI.bind(SimulationController);
window.toggleMeteorMode = SimulationController.toggleMeteorMode.bind(SimulationController);
window.triggerMeteorImpactAt = SimulationController.triggerMeteorImpactAt.bind(SimulationController);
window.shiftClimateGlobal = SimulationController.shiftClimateGlobal.bind(SimulationController);
window.resetClimate = SimulationController.resetClimate.bind(SimulationController);
window.updateClimateButtonStates = SimulationController.updateClimateButtonStates.bind(SimulationController);
window.updateInitTempLabel = SimulationController.updateInitTempLabel.bind(SimulationController);

// ── INICIALIZAÇÃO NO DOM READY ─────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (typeof window.miniPaint !== 'undefined') window.miniPaint.init();
  if (typeof window.systemConsole !== 'undefined') window.systemConsole.init();
  AnimalCreatorController.init();
  PlantCreatorController.init();
  WorldCreatorController.init();
  SimulationController.init();
  SimulationController.updateSimplifiedButtonUI();
  UIController.showPage('menu');
});
