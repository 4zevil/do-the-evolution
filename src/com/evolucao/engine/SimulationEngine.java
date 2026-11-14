package com.evolucao.engine;

import com.evolucao.model.*;
import java.util.*;

/**
 * Motor central de física, ecologia e evolução da simulação em Java.
 * Integra gradiente latitudinal + perturbação espacial FBM 2D, Lei de Kleiber,
 * Lei do Mínimo de Liebig, estágios de vida, stamina, camuflagem e especiação.
 */
public class SimulationEngine {
    public static final double CELL_SIZE = 26.0;
    public static final int HARD_CRASH_FAILSAFE = 600;

    private static final String[] SPECIES_PALETTE = {
        "#58a6ff", "#3fb950", "#ffa657", "#d2a8ff", "#f78166",
        "#79c0ff", "#56d364", "#e3b341", "#f0883e", "#db61a2",
        "#2ea043", "#388bfd", "#bc8cff", "#ff7b72", "#238636"
    };

    public static final class SpeciesInfo {
        public final String speciesId;
        public final String name;
        public final String type; // "animal" | "plant"
        public final String color;
        public final String ancestorId;
        public final String rootName;
        public final String divergentTrait;
        public final int originGeneration;
        public final int originTick;
        public final double founderSizeOrHeight;
        public final double founderSpeedOrRoot;
        public final double founderMeatOrDefense;
        public final double founderThermal;

        public SpeciesInfo(String speciesId, String name, String type, String color,
                           String ancestorId, String rootName, String divergentTrait,
                           int originGeneration, int originTick,
                           double founderSizeOrHeight, double founderSpeedOrRoot,
                           double founderMeatOrDefense, double founderThermal) {
            this.speciesId = speciesId;
            this.name = name;
            this.type = type;
            this.color = color;
            this.ancestorId = ancestorId;
            this.rootName = rootName;
            this.divergentTrait = divergentTrait;
            this.originGeneration = originGeneration;
            this.originTick = originTick;
            this.founderSizeOrHeight = founderSizeOrHeight;
            this.founderSpeedOrRoot = founderSpeedOrRoot;
            this.founderMeatOrDefense = founderMeatOrDefense;
            this.founderThermal = founderThermal;
        }
    }

    private final int rows;
    private final int cols;
    private final GridCell[][] grid;
    private final List<Plant> plants;
    private final List<Animal> animals;
    private final List<Carcass> carcasses;

    private final Map<String, SpeciesInfo> speciesById;
    private final Map<String, String> speciesNameToId;
    private final Set<Long> dirtyCells;

    private Season currentSeason;
    private int seasonTicks;
    private int seasonLength;
    private int generation;
    private int totalTicks;

    private double climateOffset;
    private double climateTrend;
    private int impactWinterTicks;
    private int hydrologyTimer;
    private double mutationRateMultiplier;
    private double predatorSatietyThreshold;
    private double seedBankRate;
    private long worldSeed;

    public SimulationEngine(int rows, int cols, BiomeType defaultBiome) {
        this(rows, cols, defaultBiome, null, System.nanoTime());
    }

    public SimulationEngine(int rows, int cols, String worldPreset, long seed) {
        this(rows, cols, null, worldPreset != null ? worldPreset : "random", seed);
    }

    private SimulationEngine(int rows, int cols, BiomeType defaultBiome, String worldPreset, long seed) {
        this.rows = rows;
        this.cols = cols;
        this.grid = new GridCell[rows][cols];
        this.plants = new ArrayList<>();
        this.animals = new ArrayList<>();
        this.carcasses = new ArrayList<>();
        this.speciesById = new LinkedHashMap<>();
        this.speciesNameToId = new HashMap<>();
        this.dirtyCells = new LinkedHashSet<>();

        this.currentSeason = Season.SPRING;
        this.seasonTicks = 0;
        this.seasonLength = 120;
        this.generation = 1;
        this.totalTicks = 0;

        this.climateOffset = 0.0;
        this.climateTrend = 0.0;
        this.impactWinterTicks = 0;
        this.hydrologyTimer = 0;
        this.mutationRateMultiplier = 1.0;
        this.predatorSatietyThreshold = 0.65;
        this.seedBankRate = 0.14;
        this.worldSeed = seed;

        generateWorld(defaultBiome, worldPreset, seed);
    }

    /**
     * Inicializa o terreno com gradiente latitudinal + perturbação espacial suave (FBM 2D).
     */
    public void generateWorld(BiomeType defaultBiome, String worldPreset, long seed) {
        this.worldSeed = seed;
        this.dirtyCells.clear();

        for (int r = 0; r < rows; r++) {
            // Distância latitudinal normalizada do equador (0.0 no centro, 1.0 nos polos)
            double absLat = Math.abs((r / (double) Math.max(1, rows - 1)) * 2.0 - 1.0);
            // Gradiente térmico latitudinal: +0.35 no equador, -0.35 nos polos
            double latTemp = (0.5 - absLat) * 0.70;

            for (int c = 0; c < cols; c++) {
                double elev = fbm2D(c * 0.14, r * 0.14, seed);
                double moistNoise = fbm2D(c * 0.12 + 31.7, r * 0.12 - 19.3, seed + 101L);
                double tempPerturb = (fbm2D(c * 0.11 - 13.1, r * 0.11 + 47.9, seed + 202L) - 0.5) * 0.50;
                double fertNoise = 0.85 + fbm2D(c * 0.18 + 7.3, r * 0.18 + 11.9, seed + 303L) * 0.30;
                double retentionNoise = (fbm2D(c * 0.16 - 5.2, r * 0.16 + 23.1, seed + 404L) - 0.5) * 0.12;

                BiomeType biome;
                if (defaultBiome != null && worldPreset == null) {
                    biome = defaultBiome;
                } else {
                    biome = resolvePresetBiome(worldPreset, latTemp + tempPerturb, elev, moistNoise);
                }

                double localTempOffset = clamp(latTemp + tempPerturb + biome.getBaseTempOffset(), -0.90, 0.90);
                double waterRetention = biome == BiomeType.WATER
                    ? 1.0
                    : clamp(biome.getWaterRetention() + retentionNoise, 0.08, 0.98);
                double fertilityCap = biome == BiomeType.WATER
                    ? 0.0
                    : Math.max(10.0, biome.getFertilityCap() * fertNoise);

                grid[r][c] = new GridCell(r, c, biome, localTempOffset, elev, waterRetention, fertilityCap);
            }
        }
    }

    private BiomeType resolvePresetBiome(String preset, double regionalTemp, double elev, double moist) {
        String p = preset == null ? "random" : preset.trim().toLowerCase();
        switch (p) {
            case "islands":
                if (elev < 0.48) return BiomeType.WATER;
                if (elev > 0.82) return BiomeType.ROCKY_SOIL;
                return moist > 0.62 ? BiomeType.WETLAND : BiomeType.FERTILE_SOIL;
            case "desert":
                if (elev < 0.16 && moist > 0.72) return BiomeType.WATER;
                if (elev > 0.78) return BiomeType.ROCKY_SOIL;
                return moist > 0.75 ? BiomeType.FERTILE_SOIL : BiomeType.DRY_SOIL;
            case "frozen":
                if (elev < 0.25) return BiomeType.WATER;
                if (elev > 0.72) return BiomeType.ROCKY_SOIL;
                return BiomeType.TUNDRA;
            case "savanna":
                if (elev < 0.18) return BiomeType.WATER;
                if (elev > 0.80) return BiomeType.ROCKY_SOIL;
                if (moist > 0.68) return BiomeType.WETLAND;
                return moist > 0.48 ? BiomeType.FERTILE_SOIL : BiomeType.DRY_SOIL;
            case "fertile":
                if (elev < 0.20) return BiomeType.WATER;
                if (elev > 0.84) return BiomeType.ROCKY_SOIL;
                return moist > 0.72 ? BiomeType.WETLAND : BiomeType.FERTILE_SOIL;
            case "random":
            default:
                if (elev < 0.24) return BiomeType.WATER;
                if (elev > 0.78) return BiomeType.ROCKY_SOIL;
                if (regionalTemp < -0.22) return BiomeType.TUNDRA;
                if (moist < 0.35 || (regionalTemp > 0.22 && moist < 0.50)) return BiomeType.DRY_SOIL;
                if (moist > 0.70) return BiomeType.WETLAND;
                return BiomeType.FERTILE_SOIL;
        }
    }

    // Ruído de Valor 2D suavizado (Fractional Brownian Motion) determinístico
    private static double fbm2D(double x, double y, long seed) {
        double value = 0.0;
        double amplitude = 0.55;
        double frequency = 1.0;
        double norm = 0.0;
        for (int octave = 0; octave < 3; octave++) {
            value += valueNoise2D(x * frequency, y * frequency, seed + octave * 997L) * amplitude;
            norm += amplitude;
            amplitude *= 0.5;
            frequency *= 2.0;
        }
        return value / norm;
    }

    private static double valueNoise2D(double x, double y, long seed) {
        int xi = (int) Math.floor(x);
        int yi = (int) Math.floor(y);
        double xf = x - xi;
        double yf = y - yi;
        double u = xf * xf * (3.0 - 2.0 * xf);
        double v = yf * yf * (3.0 - 2.0 * yf);

        double n00 = hash2D(xi, yi, seed);
        double n10 = hash2D(xi + 1, yi, seed);
        double n01 = hash2D(xi, yi + 1, seed);
        double n11 = hash2D(xi + 1, yi + 1, seed);

        double nx0 = n00 + u * (n10 - n00);
        double nx1 = n01 + u * (n11 - n01);
        return nx0 + v * (nx1 - nx0);
    }

    private static double hash2D(int x, int y, long seed) {
        long h = seed ^ (x * 0x9E3779B97F4A7C15L) ^ (y * 0xC2B2AE3D27D4EB4FL);
        h = (h ^ (h >>> 30)) * 0xBF58476D1CE4E5B9L;
        h = (h ^ (h >>> 27)) * 0x94D049BB133111EBL;
        h = h ^ (h >>> 31);
        return ((h >>> 11) & ((1L << 53) - 1)) / (double) (1L << 53);
    }

    public void updateTick() {
        totalTicks++;
        seasonTicks++;

        if (seasonTicks >= seasonLength) {
            seasonTicks = 0;
            currentSeason = currentSeason.next();
            if (currentSeason == Season.SPRING) {
                generation++;
            }
        }

        double winterPenalty = 0.0;
        double sunlightMultiplier = 1.0;
        if (impactWinterTicks > 0) {
            impactWinterTicks--;
            winterPenalty = -0.40;
            sunlightMultiplier = 0.35;
        }

        climateTrend = climateOffset + (-0.00015 * generation + Math.sin(totalTicks * 0.0012) * 0.25) + winterPenalty;
        double effectiveGlobalTemp = getEffectiveGlobalTemperature();

        // Hidrologia dinâmica ocasional
        hydrologyTimer++;
        if (hydrologyTimer >= 90) {
            hydrologyTimer = 0;
            updateHydrology(effectiveGlobalTemp);
        }

        // 1. Regeneração do solo (com retenção hídrica, teto de fertilidade e mineralização)
        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                grid[r][c].regenerate(currentSeason, climateTrend);
            }
        }

        // 2. Atualiza carcaças e mineralização
        Iterator<Carcass> carcassIt = carcasses.iterator();
        while (carcassIt.hasNext()) {
            Carcass carcass = carcassIt.next();
            int cr = clampInt(carcass.getR(), 0, rows - 1);
            int cc = clampInt(carcass.getC(), 0, cols - 1);
            carcass.tick(currentSeason, grid[cr][cc]);
            if (carcass.isExpired() || !carcass.isAlive()) {
                carcassIt.remove();
            }
        }

        // 3. Atualiza vegetais com Liebig + dispersão de sementes
        List<Plant> sproutedPlants = new ArrayList<>();
        Iterator<Plant> plantIt = plants.iterator();
        while (plantIt.hasNext()) {
            Plant plant = plantIt.next();
            int pr = clampInt(plant.getR(), 0, rows - 1);
            int pc = clampInt(plant.getC(), 0, cols - 1);
            GridCell cell = grid[pr][pc];
            plant.tick(currentSeason, cell, climateTrend, sunlightMultiplier);

            if (plant.isDead()) {
                cell.addOrganicBiomass(plant.getGrowth() * 12.0);
                cell.setSoilNitrogen(Math.min(cell.getFertilityCap(), cell.getSoilNitrogen() + 2.0));
                if (cell.getPlant() == plant) {
                    cell.setPlant(null);
                }
                plantIt.remove();
            } else if (plant.hasFruit()
                    && plants.size() + sproutedPlants.size() < rows * cols * 0.70
                    && Math.random() < 0.015 * plant.getGrowthSpeed()) {
                Plant child = tryDisperseSeed(plant);
                if (child != null) {
                    sproutedPlants.add(child);
                }
            }
        }
        plants.addAll(sproutedPlants);

        // 3.1 Banco de sementes no solo (rede de segurança ecológica)
        runSoilSeedBank();

        // 4. Atualiza animais (Kleiber, lifeStage, stamina, camouflageFactor e IA)
        Set<Animal> deadAnimals = new LinkedHashSet<>();
        List<Animal> newborns = new ArrayList<>();

        for (Animal animal : animals) {
            if (!animal.isAlive()) continue;

            int ar = clampInt((int) (animal.getY() / CELL_SIZE), 0, rows - 1);
            int ac = clampInt((int) (animal.getX() / CELL_SIZE), 0, cols - 1);
            GridCell cell = grid[ar][ac];
            Plant coverPlant = cell.getPlant();
            boolean hasCover = coverPlant != null && coverPlant.isAlive() && coverPlant.getGrowth() > 0.25;
            double coverGrowth = hasCover ? coverPlant.getGrowth() : 0.0;

            animal.tick(currentSeason, cell, climateTrend, hasCover, coverGrowth);
            if (animal.isDead()) {
                deadAnimals.add(animal);
                continue;
            }

            // Gestação e nascimento
            if (animal.isPregnant()) {
                if (animal.getEnergy() < 22.0) {
                    animal.clearPregnancy();
                    animal.setState("foraging");
                    animal.setStateLabel("Aborto por Inanição");
                } else if (animal.getGestationTicks() <= 0) {
                    spawnOffspring(animal, newborns);
                }
            }

            // IA trófica e movimentação
            runAnimalAI(animal, cell, newborns, deadAnimals);

            double newX = animal.getX() + animal.getVx();
            double newY = animal.getY() + animal.getVy();
            double maxX = cols * CELL_SIZE - 12.0;
            double maxY = rows * CELL_SIZE - 12.0;

            if (newX < 12.0 || newX > maxX) {
                animal.setVx(-animal.getVx());
                animal.setX(clamp(newX, 12.0, maxX));
            } else {
                animal.setX(newX);
            }

            if (newY < 12.0 || newY > maxY) {
                animal.setVy(-animal.getVy());
                animal.setY(clamp(newY, 12.0, maxY));
            } else {
                animal.setY(newY);
            }

            // Dispersão zoocórica de sementes ingeridas
            Animal.CarriedSeed seed = animal.getCarriedSeed();
            if (seed != null) {
                seed.dropTimer--;
                if (seed.dropTimer <= 0) {
                    int sr = clampInt((int) (animal.getY() / CELL_SIZE), 0, rows - 1);
                    int sc = clampInt((int) (animal.getX() / CELL_SIZE), 0, cols - 1);
                    GridCell dropCell = grid[sr][sc];
                    if (dropCell.isHabitable() && dropCell.getPlant() == null && plants.size() < rows * cols * 0.70) {
                        Plant germinating = new Plant(
                            "p_" + UUID.randomUUID().toString().substring(0, 8),
                            seed.speciesName,
                            seed.speciesId,
                            sr, sc,
                            seed.height, seed.rootEfficiency, seed.growthSpeed,
                            seed.defense, seed.fruitAttraction, seed.parasiteResistance,
                            seed.thermal, seed.colorHue
                        );
                        germinating.setGrowth(0.22);
                        dropCell.addOrganicBiomass(5.0);
                        dropCell.setPlant(germinating);
                        plants.add(germinating);
                    }
                    animal.setCarriedSeed(null);
                }
            }
        }

        // Remove plantas mortas por sobrepastoreio neste tick
        Iterator<Plant> grazedSweep = plants.iterator();
        while (grazedSweep.hasNext()) {
            Plant p = grazedSweep.next();
            if (!p.isAlive()) {
                GridCell cell = grid[clampInt(p.getR(), 0, rows - 1)][clampInt(p.getC(), 0, cols - 1)];
                if (cell.getPlant() == p) cell.setPlant(null);
                grazedSweep.remove();
            }
        }

        // 5. Remove animais mortos e gera carcaças
        for (Animal dead : deadAnimals) {
            if (animals.remove(dead)) {
                int r = clampInt((int) (dead.getY() / CELL_SIZE), 0, rows - 1);
                int c = clampInt((int) (dead.getX() / CELL_SIZE), 0, cols - 1);
                double carcassE = dead.getCarcassEnergy() > 0.0
                    ? dead.getCarcassEnergy()
                    : (25.0 + dead.getSize() * 50.0);
                carcasses.add(new Carcass(
                    "c_" + UUID.randomUUID().toString().substring(0, 8),
                    dead.getX(),
                    dead.getY(),
                    r, c,
                    carcassE
                ));
            }
        }

        // 6. Insere recém-nascidos respeitando HARD_CRASH_FAILSAFE
        int slots = Math.max(0, HARD_CRASH_FAILSAFE - animals.size());
        for (int i = 0; i < Math.min(slots, newborns.size()); i++) {
            animals.add(newborns.get(i));
        }
    }

    private void runAnimalAI(Animal animal, GridCell currentCell, List<Animal> newborns, Collection<Animal> deadAnimals) {
        boolean isCarnivore = animal.getCarnivore() > 0.45;
        double hungerRatio = Math.max(0.0, 1.0 - (animal.getEnergy() / Math.max(1.0, animal.getMaxEnergy())));
        double viewDist = (45.0 + animal.getPerception() * 130.0)
            * (isCarnivore ? 1.4 * (1.0 + hungerRatio * 0.5) : 1.0);
        double maxSpeed = animal.computeMaxAllowedSpeed(currentCell);

        // Se exausto sem ameaça iminente, prioriza descanso
        if (animal.isExhausted() && animal.getEnergy() > 20.0) {
            animal.setVx(animal.getVx() * 0.45);
            animal.setVy(animal.getVy() * 0.45);
            animal.setState("exhausted");
            animal.setStateLabel("Exausto (Recuperando Stamina)");
            if (isCarnivore) return; // presas ainda tentam fugir mesmo exaustas
        }

        // 1. Fuga de Predadores (afetada por camouflageFactor do predador)
        if (!isCarnivore) {
            double maxFleeDist = Math.min(viewDist, 32.0 + animal.getPerception() * 60.0);
            Animal threat = null;
            double minThreatDist = maxFleeDist;

            for (Animal other : animals) {
                if (other == animal || !other.isAlive()) continue;
                if (other.getCarnivore() > 0.45 && other.getSize() > animal.getSize() * 1.05) {
                    double d = animal.distanceTo(other);
                    double effectiveDetect = maxFleeDist * (1.0 - other.getCamouflageFactor() * 0.50);
                    if (d < effectiveDetect && d < minThreatDist) {
                        minThreatDist = d;
                        threat = other;
                    }
                }
            }

            if (threat != null) {
                animal.setState("fleeing");
                animal.setStateLabel("Fugindo de Predador!");
                animal.setFleeTicks(animal.getFleeTicks() + 1);
                double burst = (!animal.isExhausted() && animal.getFleeTicks() < 25) ? 1.22 : 1.0;
                double desired = maxSpeed * burst;
                double angle = Math.atan2(animal.getY() - threat.getY(), animal.getX() - threat.getX());
                animal.setVx(animal.getVx() * 0.50 + Math.cos(angle) * desired * 0.50);
                animal.setVy(animal.getVy() * 0.50 + Math.sin(angle) * desired * 0.50);
                return;
            } else if (animal.getFleeTicks() > 0) {
                animal.setFleeTicks(Math.max(0, animal.getFleeTicks() - 2));
            }
        }

        double targetX = Double.NaN;
        double targetY = Double.NaN;
        double desiredSpeed = maxSpeed * 0.45;
        animal.setState(animal.getStamina() < animal.getMaxStamina() * 0.40 ? "resting" : "foraging");
        animal.setStateLabel(animal.isDiseased()
            ? "Infectado (" + animal.getDiseaseTimer() + "t)"
            : (animal.isPregnant() ? "Gestante (" + animal.getGestationTicks() + "t)" : "Forrageando"));

        double hungerThreshold = isCarnivore ? (animal.getMaxEnergy() * predatorSatietyThreshold) : 85.0;
        if (animal.getEnergy() < hungerThreshold) {

            // A. Necrofagia
            double carcassThreshold = isCarnivore ? 85.0 : 25.0;
            if (animal.getCarcassDiet() > 0.08 && animal.getEnergy() < carcassThreshold) {
                Carcass bestCarcass = null;
                double minCDist = Math.min(viewDist, 60.0);
                for (Carcass c : carcasses) {
                    if (!c.isAlive() || c.getRemainingEnergy() <= 0.0) continue;
                    double d = animal.distanceTo(c);
                    if (d < minCDist) {
                        minCDist = d;
                        bestCarcass = c;
                    }
                }
                if (bestCarcass != null) {
                    targetX = bestCarcass.getX();
                    targetY = bestCarcass.getY();
                    desiredSpeed = maxSpeed * 0.70;
                    animal.setState("scavenging");
                    animal.setStateLabel("Comendo Carcaça");

                    if (minCDist < 18.0) {
                        animal.setVx(animal.getVx() * 0.1);
                        animal.setVy(animal.getVy() * 0.1);
                        double bite = bestCarcass.consumeBite(4.0);
                        animal.gainEnergy(bite * 0.80);
                        return;
                    }
                }
            }

            // B. Predação (afetada por camouflageFactor da presa e stamina do predador)
            if (isCarnivore && Double.isNaN(targetX) && !animal.isExhausted()) {
                double sizeAdvantage = 1.15 + animal.getAggression() * 0.60;
                Animal bestPrey = null;
                double minPreyDist = viewDist;

                for (Animal other : animals) {
                    if (other == animal || !other.isAlive()) continue;
                    if (other.getSpeciesName().equals(animal.getSpeciesName()) && animal.getEnergy() >= 20.0) continue;
                    boolean vulnerable = (animal.getSize() * sizeAdvantage) > other.getSize();
                    if (vulnerable || animal.getEnergy() < 25.0) {
                        double d = animal.distanceTo(other);
                        double effectiveDetect = viewDist * (1.0 - other.getCamouflageFactor() * 0.55);
                        if (d < effectiveDetect && d < minPreyDist) {
                            minPreyDist = d;
                            bestPrey = other;
                        }
                    }
                }

                if (bestPrey != null) {
                    targetX = bestPrey.getX();
                    targetY = bestPrey.getY();
                    desiredSpeed = maxSpeed * 1.05;
                    animal.setState("hunting");
                    animal.setStateLabel("Caçando Presa!");

                    if (minPreyDist < 22.0 && animal.getAttackCooldown() == 0) {
                        animal.setAttackCooldown(15);
                        animal.setVx(animal.getVx() * 0.2);
                        animal.setVy(animal.getVy() * 0.2);

                        double dmg = (28.0 + animal.getAggression() * 35.0)
                            * (animal.getSize() / Math.max(0.2, bestPrey.getSize()))
                            * animal.getStageDamageMultiplier();
                        bestPrey.setEnergy(bestPrey.getEnergy() - dmg);

                        if (bestPrey.getEnergy() <= 0.0) {
                            bestPrey.setAlive(false);
                            deadAnimals.add(bestPrey);
                            double totalMeat = 35.0 + bestPrey.getSize() * 45.0;
                            animal.gainEnergy(totalMeat * 0.65);
                            bestPrey.setCarcassEnergy(totalMeat * 0.35);
                            animal.setStateLabel("Abateu Presa!");
                            return;
                        } else {
                            animal.setStateLabel("Atacando Presa!");
                            bestPrey.setVx(bestPrey.getVx() + animal.getVx() * 1.4);
                            bestPrey.setVy(bestPrey.getVy() + animal.getVy() * 1.4);
                        }
                    }
                }
            }

            // C. Herbivoria
            if (Double.isNaN(targetX) && animal.getPlant() > 0.15 && !plants.isEmpty()) {
                Plant bestPlant = null;
                double minPlDist = viewDist;
                for (Plant p : plants) {
                    if (!p.isAlive() || p.getGrowth() < 0.15) continue;
                    double d = animal.distanceTo(p);
                    if (d < minPlDist) {
                        minPlDist = d;
                        bestPlant = p;
                    }
                }

                if (bestPlant != null) {
                    targetX = bestPlant.getX();
                    targetY = bestPlant.getY();
                    desiredSpeed = maxSpeed * 0.65;
                    animal.setState("grazing");
                    animal.setStateLabel("Pastando");

                    if (minPlDist < 18.0) {
                        animal.setVx(animal.getVx() * 0.1);
                        animal.setVy(animal.getVy() * 0.1);

                        double defenseFactor = Math.max(0.18, 1.0 - bestPlant.getDefense() * 0.75);
                        double bite = Math.min(bestPlant.getGrowth() * 0.65, 0.30) * defenseFactor;

                        if (bestPlant.getDefense() > 0.40) {
                            double thornDmg = (bestPlant.getDefense() - 0.40) * 14.0;
                            animal.setEnergy(Math.max(1.0, animal.getEnergy() - thornDmg));
                        }

                        boolean hadFruit = bestPlant.hasFruit();
                        double calories = (Math.max(0.06, bite) / 0.20) * (hadFruit ? 26.0 : 18.0);
                        animal.gainEnergy(calories * 0.85 * Math.max(0.35, animal.getPlant()));

                        if (hadFruit && Math.random() < Math.max(0.15, bestPlant.getFruitAttraction())) {
                            animal.setCarriedSeed(new Animal.CarriedSeed(
                                bestPlant.getName(),
                                bestPlant.getSpeciesId(),
                                bestPlant.getHeight(),
                                bestPlant.getRootEfficiency(),
                                bestPlant.getGrowthSpeed(),
                                bestPlant.getDefense(),
                                bestPlant.getFruitAttraction(),
                                bestPlant.getParasiteResistance(),
                                bestPlant.getThermal(),
                                bestPlant.getColorHue(),
                                (int) Math.round(20 + Math.random() * 35)
                            ));
                        }

                        bestPlant.beEaten(bite);
                        if (!bestPlant.isAlive()) {
                            GridCell pCell = grid[clampInt(bestPlant.getR(), 0, rows - 1)][clampInt(bestPlant.getC(), 0, cols - 1)];
                            pCell.addOrganicBiomass(4.0);
                            if (pCell.getPlant() == bestPlant) pCell.setPlant(null);
                        }
                        return;
                    }
                }
            }
        }

        // 2. Reprodução Sexuada (exclusiva de indivíduos no estágio ADULT)
        double reproThreshold = isCarnivore ? 78.0 : 62.0;
        if (animal.canReproduce() && animal.getEnergy() > reproThreshold && Double.isNaN(targetX)) {
            int totalCarn = 0;
            int totalHerb = 0;
            for (Animal other : animals) {
                if (!other.isAlive()) continue;
                if (other.getCarnivore() > 0.45) totalCarn++;
                else totalHerb++;
            }

            boolean allowRepro = isCarnivore
                ? (totalCarn < 15 && (totalCarn <= 3 || totalCarn <= totalHerb * 0.22))
                : (totalHerb < 160);

            if (allowRepro) {
                double mateSearchRadius = isCarnivore ? Math.max(viewDist * 3.0, 500.0) : (viewDist * 1.3);
                Animal bestMate = null;
                double minMateDist = mateSearchRadius;

                for (Animal other : animals) {
                    if (other == animal || !other.canReproduce()) continue;
                    if (other.getEnergy() <= reproThreshold * 0.85) continue;
                    if (other.getSpeciesName().equals(animal.getSpeciesName())) {
                        double d = animal.distanceTo(other);
                        if (d < minMateDist) {
                            minMateDist = d;
                            bestMate = other;
                        }
                    }
                }

                if (bestMate != null) {
                    targetX = bestMate.getX();
                    targetY = bestMate.getY();
                    desiredSpeed = maxSpeed * 0.85;
                    animal.setState("mating");
                    animal.setStateLabel("Buscando Parceiro");

                    if (minMateDist < 18.0) {
                        animal.setVx(animal.getVx() * 0.1);
                        animal.setVy(animal.getVy() * 0.1);
                        double mateCost = isCarnivore ? 24.0 : 16.0;
                        animal.consumeEnergy(mateCost);
                        bestMate.consumeEnergy(mateCost);

                        int cooldown = isCarnivore ? 150 : 85;
                        animal.setMateCooldown(cooldown);
                        bestMate.setMateCooldown(cooldown);

                        Animal.OffspringGenome childGenome = recombineAndMutate(animal, bestMate);
                        String childSpeciesName = animal.getSpeciesName();
                        String childSpeciesId = animal.getSpeciesId();

                        SpeciesInfo founder = speciesById.get(childSpeciesId);
                        if (founder != null && Math.abs(childGenome.size - founder.founderSizeOrHeight) >= 0.28) {
                            String suffix = childGenome.size > founder.founderSizeOrHeight ? "Gigante" : "Pigmeu";
                            childSpeciesName = founder.rootName + " " + suffix;
                            childSpeciesId = registerOrGetSpecies(
                                childSpeciesName, "animal", childSpeciesId, founder.rootName,
                                "Porte " + suffix, childGenome.size, childGenome.speed,
                                childGenome.carnivore, childGenome.thermal
                            );
                        }

                        int clutch = (!isCarnivore && totalHerb < 60 && Math.random() < 0.6) ? 2 : 1;
                        int gestTicks = (int) Math.max(15, Math.round(28 + ((animal.getGestation() + bestMate.getGestation()) / 2.0) * 35.0));
                        animal.startPregnancy(childGenome, childSpeciesName, childSpeciesId, clutch, gestTicks);
                        animal.setStateLabel("Iniciou Gestação");
                        return;
                    }
                }
            }
        }

        // 3. Movimento direcionado ou exploração aleatória
        if (!Double.isNaN(targetX) && !Double.isNaN(targetY)) {
            double angle = Math.atan2(targetY - animal.getY(), targetX - animal.getX());
            animal.setVx(animal.getVx() * 0.55 + Math.cos(angle) * desiredSpeed * 0.45);
            animal.setVy(animal.getVy() * 0.55 + Math.sin(angle) * desiredSpeed * 0.45);
        } else if (Math.random() < 0.07) {
            double randAngle = Math.random() * Math.PI * 2.0;
            animal.setVx(Math.cos(randAngle) * desiredSpeed);
            animal.setVy(Math.sin(randAngle) * desiredSpeed);
        }
    }

    private Animal.OffspringGenome recombineAndMutate(Animal a, Animal b) {
        double m = mutationRateMultiplier;
        double size = mutateGene((a.getSize() + b.getSize()) / 2.0, 0.06 * m, 0.05, 1.0);
        double speed = mutateGene((a.getSpeed() + b.getSpeed()) / 2.0, 0.06 * m, 0.05, 1.0);
        double perception = mutateGene((a.getPerception() + b.getPerception()) / 2.0, 0.06 * m, 0.05, 1.0);
        double gestation = mutateGene((a.getGestation() + b.getGestation()) / 2.0, 0.05 * m, 0.05, 1.0);
        double offspringCount = mutateGene((a.getOffspringCount() + b.getOffspringCount()) / 2.0, 0.05 * m, 0.05, 1.0);
        double aggression = mutateGene((a.getAggression() + b.getAggression()) / 2.0, 0.06 * m, 0.0, 1.0);
        double health = mutateGene((a.getHealth() + b.getHealth()) / 2.0, 0.06 * m, 0.05, 1.0);
        double aquatic = mutateGene((a.getAquatic() + b.getAquatic()) / 2.0, 0.06 * m, 0.0, 1.0);
        double thermal = mutateGene((a.getThermal() + b.getThermal()) / 2.0, 0.05 * m, -1.0, 1.0);

        double avgHue = averageHue(a.getColorHue(), b.getColorHue());
        double colorHue = ((avgHue + (Math.random() * 20.0 - 10.0) * m) % 360.0 + 360.0) % 360.0;

        double rawMeat = Math.max(0.01, (a.getCarnivore() + b.getCarnivore()) / 2.0 + (Math.random() * 0.14 - 0.07) * m);
        double rawPlant = Math.max(0.01, (a.getPlant() + b.getPlant()) / 2.0 + (Math.random() * 0.14 - 0.07) * m);
        double rawCarcass = Math.max(0.01, (a.getCarcassDiet() + b.getCarcassDiet()) / 2.0 + (Math.random() * 0.14 - 0.07) * m);
        double dietSum = rawMeat + rawPlant + rawCarcass;

        return new Animal.OffspringGenome(
            size,
            rawMeat / dietSum,
            rawPlant / dietSum,
            rawCarcass / dietSum,
            speed,
            perception,
            gestation,
            offspringCount,
            aggression,
            health,
            aquatic,
            thermal,
            colorHue
        );
    }

    private void spawnOffspring(Animal mother, List<Animal> newborns) {
        Animal.OffspringGenome g = mother.getPregnantGenome();
        String spName = mother.getPregnantSpeciesName() != null ? mother.getPregnantSpeciesName() : mother.getSpeciesName();
        String spId = mother.getPregnantSpeciesId() != null ? mother.getPregnantSpeciesId() : mother.getSpeciesId();
        int clutch = mother.getPregnantClutchSize();
        mother.clearPregnancy();
        mother.setState("foraging");
        mother.setStateLabel("Deu à luz!");

        if (g == null) return;

        double maxX = cols * CELL_SIZE - 12.0;
        double maxY = rows * CELL_SIZE - 12.0;
        for (int i = 0; i < clutch; i++) {
            double bx = clamp(mother.getX() + (Math.random() * 14.0 - 7.0), 12.0, maxX);
            double by = clamp(mother.getY() + (Math.random() * 14.0 - 7.0), 12.0, maxY);
            Animal baby = new Animal(
                "a_" + UUID.randomUUID().toString().substring(0, 8),
                spName,
                spName,
                spId,
                bx, by,
                g.size, g.carnivore, g.plant, g.speed, g.perception,
                g.gestation, g.offspringCount, g.aggression, g.health,
                g.aquatic, g.thermal, g.colorHue
            );
            baby.setEnergy(g.carnivore > 0.45 ? 58.0 : 42.0);
            baby.setMateCooldown(60);
            baby.setState("foraging");
            baby.setStateLabel("Juvenil (Recém-nascido)");
            int br = clampInt((int) (by / CELL_SIZE), 0, rows - 1);
            int bc = clampInt((int) (bx / CELL_SIZE), 0, cols - 1);
            baby.updateCamouflageFactor(grid[br][bc], baby.computeMaxAllowedSpeed(grid[br][bc]), false, 0.0);
            newborns.add(baby);
        }
    }

    private Plant tryDisperseSeed(Plant parent) {
        int reach = Math.max(1, (int) Math.round(1.0 + parent.getHeight() * 4.0));
        int nr = parent.getR() + ((int) (Math.random() * (reach * 2 + 1)) - reach);
        int nc = parent.getC() + ((int) (Math.random() * (reach * 2 + 1)) - reach);
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) return null;

        GridCell target = grid[nr][nc];
        if (!target.isHabitable() || target.getPlant() != null) return null;

        Plant partner = parent;
        for (int pr = Math.max(0, parent.getR() - 3); pr <= Math.min(rows - 1, parent.getR() + 3); pr++) {
            for (int pc = Math.max(0, parent.getC() - 3); pc <= Math.min(cols - 1, parent.getC() + 3); pc++) {
                Plant candidate = grid[pr][pc].getPlant();
                if (candidate != null && candidate != parent && candidate.isAlive() && candidate.hasFruit()) {
                    partner = candidate;
                    break;
                }
            }
            if (partner != parent) break;
        }

        double m = mutationRateMultiplier;
        double h = mutateGene((parent.getHeight() + partner.getHeight()) / 2.0, 0.06 * m, 0.05, 1.0);
        double root = mutateGene((parent.getRootEfficiency() + partner.getRootEfficiency()) / 2.0, 0.06 * m, 0.05, 1.0);
        double gSpeed = mutateGene((parent.getGrowthSpeed() + partner.getGrowthSpeed()) / 2.0, 0.06 * m, 0.05, 1.0);
        double def = mutateGene((parent.getDefense() + partner.getDefense()) / 2.0, 0.06 * m, 0.0, 1.0);
        double fruit = mutateGene((parent.getFruitAttraction() + partner.getFruitAttraction()) / 2.0, 0.06 * m, 0.0, 1.0);
        double res = mutateGene((parent.getParasiteResistance() + partner.getParasiteResistance()) / 2.0, 0.06 * m, 0.05, 1.0);
        double therm = mutateGene((parent.getThermal() + partner.getThermal()) / 2.0, 0.06 * m, -1.0, 1.0);
        double hue = ((averageHue(parent.getColorHue(), partner.getColorHue()) + (Math.random() * 26.0 - 13.0) * m) % 360.0 + 360.0) % 360.0;

        String spName = parent.getName();
        String spId = parent.getSpeciesId();
        SpeciesInfo founder = speciesById.get(spId);
        if (founder != null) {
            if (Math.abs(def - founder.founderMeatOrDefense) >= 0.28) {
                String desc = def > founder.founderMeatOrDefense ? "Espinhosa" : "Indefesa";
                spName = founder.rootName + " " + desc;
                spId = registerOrGetSpecies(spName, "plant", spId, founder.rootName, "Defesa " + desc, h, root, def, therm);
            } else if (Math.abs(h - founder.founderSizeOrHeight) >= 0.28) {
                String desc = h > founder.founderSizeOrHeight ? "Gigante" : "Rasteira";
                spName = founder.rootName + " " + desc;
                spId = registerOrGetSpecies(spName, "plant", spId, founder.rootName, "Porte " + desc, h, root, def, therm);
            }
        }

        Plant child = new Plant(
            "p_" + UUID.randomUUID().toString().substring(0, 8),
            spName, spId, nr, nc,
            h, root, gSpeed, def, fruit, res, therm, hue
        );
        child.setGrowth(0.14);
        child.setEnergy(28.0);
        target.setPlant(child);
        return child;
    }

    private void runSoilSeedBank() {
        double targetCap = rows * cols * 0.48;
        boolean criticallyLow = plants.size() < Math.max(18, (int) (rows * cols * 0.05));
        double effectiveRate = criticallyLow ? 0.95 : (plants.size() < targetCap ? seedBankRate * 1.4 : seedBankRate * 0.35);
        int bursts = criticallyLow ? 3 : 1;

        for (int b = 0; b < bursts; b++) {
            if (Math.random() >= effectiveRate || plants.size() >= rows * cols * 0.70) continue;
            int rr = (int) (Math.random() * rows);
            int cc = (int) (Math.random() * cols);
            GridCell cell = grid[rr][cc];
            if (!cell.isHabitable() || cell.getPlant() != null) continue;
            if (cell.getSoilNitrogen() <= (criticallyLow ? 5.0 : 12.0) || cell.getMoisture() <= 0.15) continue;

            SpeciesInfo template = null;
            List<SpeciesInfo> plantSpecies = new ArrayList<>();
            for (SpeciesInfo info : speciesById.values()) {
                if ("plant".equals(info.type)) plantSpecies.add(info);
            }
            if (!plantSpecies.isEmpty()) {
                template = plantSpecies.get((int) (Math.random() * plantSpecies.size()));
            }

            String spName = template != null ? template.name : "Grama Pioneira";
            String spId = template != null ? template.speciesId : registerOrGetSpecies(spName, "plant", null, spName, null, 0.35, 0.65, 0.15, 0.0);
            double baseH = template != null ? template.founderSizeOrHeight : 0.35;
            double baseRoot = template != null ? template.founderSpeedOrRoot : 0.65;
            double baseDef = template != null ? template.founderMeatOrDefense : 0.15;
            double baseTherm = template != null ? template.founderThermal : 0.0;

            Plant seedling = new Plant(
                "p_" + UUID.randomUUID().toString().substring(0, 8),
                spName, spId, rr, cc,
                mutateGene(baseH, 0.05, 0.1, 1.0),
                mutateGene(baseRoot, 0.05, 0.1, 1.0),
                0.65,
                mutateGene(baseDef, 0.05, 0.0, 1.0),
                0.35, 0.50,
                mutateGene(baseTherm, 0.05, -1.0, 1.0),
                115.0
            );
            seedling.setGrowth(0.18);
            seedling.setEnergy(34.0);
            cell.setPlant(seedling);
            plants.add(seedling);
        }
    }

    private void updateHydrology(double effectiveGlobalTemp) {
        int r = (int) (Math.random() * rows);
        int c = (int) (Math.random() * cols);
        GridCell cell = grid[r][c];
        boolean isWet = currentSeason.getRainMultiplier() > 1.0;
        boolean isFreezing = effectiveGlobalTemp < -0.6;

        if (isWet && cell.getBiome() == BiomeType.FERTILE_SOIL && !isFreezing) {
            int neighborWater = 0;
            int[][] dirs = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
            for (int[] d : dirs) {
                int nr = r + d[0], nc = c + d[1];
                if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc].getBiome() == BiomeType.WATER) {
                    neighborWater++;
                }
            }
            if (neighborWater >= 1 && cell.getMoisture() > 0.85 && Math.random() < 0.45) {
                cell.setBiome(BiomeType.WATER);
                if (cell.getPlant() != null) {
                    Plant flooded = cell.getPlant();
                    flooded.setAlive(false);
                    plants.remove(flooded);
                    cell.setPlant(null);
                }
                markCellDirty(r, c);
            }
        } else if (!isWet && cell.getBiome() == BiomeType.WATER && effectiveGlobalTemp > 0.1) {
            int neighborDry = 0;
            int[][] dirs = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
            for (int[] d : dirs) {
                int nr = r + d[0], nc = c + d[1];
                if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                    BiomeType nb = grid[nr][nc].getBiome();
                    if (nb == BiomeType.DRY_SOIL || nb == BiomeType.FERTILE_SOIL) neighborDry++;
                }
            }
            if (neighborDry >= 2 && Math.random() < 0.35) {
                cell.setBiome(BiomeType.FERTILE_SOIL);
                cell.setMoisture(0.70);
                cell.setSoilNitrogen(50.0);
                markCellDirty(r, c);
            }
        }
    }

    public void triggerMeteor(double targetX, double targetY) {
        double cx = Double.isNaN(targetX) ? (0.2 + Math.random() * 0.6) * (cols * CELL_SIZE) : clamp(targetX, 25.0, cols * CELL_SIZE - 25.0);
        double cy = Double.isNaN(targetY) ? (0.2 + Math.random() * 0.6) * (rows * CELL_SIZE) : clamp(targetY, 25.0, rows * CELL_SIZE - 25.0);

        double craterCells = 4.5;
        double shockRadiusPx = 220.0;
        double craterRadiusPx = 90.0;

        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                GridCell cell = grid[r][c];
                double cellX = (c + 0.5) * CELL_SIZE;
                double cellY = (r + 0.5) * CELL_SIZE;
                double dist = Math.hypot(cellX - cx, cellY - cy);
                double distCells = dist / CELL_SIZE;

                if (distCells <= craterCells) {
                    cell.setBiome(BiomeType.ROCKY_SOIL);
                    cell.setSoilNitrogen(0.0);
                    cell.setMoisture(0.0);
                    cell.addOrganicBiomass(5.0);
                    if (cell.getPlant() != null) {
                        cell.getPlant().setAlive(false);
                        plants.remove(cell.getPlant());
                        cell.setPlant(null);
                    }
                    markCellDirty(r, c);
                } else if (dist <= shockRadiusPx * 0.45) {
                    cell.setMoisture(cell.getMoisture() * 0.1);
                    cell.setSoilNitrogen(cell.getSoilNitrogen() * 0.15);
                    if (cell.getPlant() != null) {
                        cell.getPlant().setAlive(false);
                        plants.remove(cell.getPlant());
                        cell.setPlant(null);
                    }
                    markCellDirty(r, c);
                } else if (dist <= shockRadiusPx) {
                    double factor = 1.0 - (dist / shockRadiusPx);
                    cell.setMoisture(Math.max(0.05, cell.getMoisture() * (1.0 - factor * 0.7)));
                    cell.setSoilNitrogen(Math.max(2.0, cell.getSoilNitrogen() * (1.0 - factor * 0.5)));
                    if (cell.getPlant() != null && Math.random() < 0.55 + factor * 0.4) {
                        cell.getPlant().setAlive(false);
                        plants.remove(cell.getPlant());
                        cell.setPlant(null);
                    }
                }
            }
        }

        Iterator<Animal> it = animals.iterator();
        while (it.hasNext()) {
            Animal a = it.next();
            double dist = Math.hypot(a.getX() - cx, a.getY() - cy);
            if (dist <= craterRadiusPx) {
                int ar = clampInt((int) (a.getY() / CELL_SIZE), 0, rows - 1);
                int ac = clampInt((int) (a.getX() / CELL_SIZE), 0, cols - 1);
                carcasses.add(new Carcass("c_" + UUID.randomUUID().toString().substring(0, 8), a.getX(), a.getY(), ar, ac, 20.0));
                a.setAlive(false);
                it.remove();
            } else if (dist <= shockRadiusPx) {
                double factor = 1.0 - (dist / shockRadiusPx);
                double dmg = dist <= shockRadiusPx * 0.45 ? (60.0 + factor * 110.0) : (factor * 90.0);
                a.setEnergy(a.getEnergy() - dmg);
                double angle = Math.atan2(a.getY() - cy, a.getX() - cx);
                double impulse = factor * 14.0;
                a.setVx(a.getVx() + Math.cos(angle) * impulse);
                a.setVy(a.getVy() + Math.sin(angle) * impulse);
                if (a.getEnergy() <= 0.0) {
                    a.setAlive(false);
                    it.remove();
                } else if (dist <= shockRadiusPx * 0.45) {
                    a.setDiseased(true, a.getDiseaseTimer() + 180);
                    a.setStateLabel("Queimado por Explosão");
                }
            }
        }

        this.impactWinterTicks = 280;
    }

    public void shiftClimate(double delta) {
        this.climateOffset = clamp(this.climateOffset + delta, -1.5, 1.5);
    }

    public void resetClimate() {
        this.climateOffset = 0.0;
    }

    public String registerOrGetSpecies(String name, String type, String ancestorId, String rootName,
                                       String divergentTrait, double founderSizeOrHeight,
                                       double founderSpeedOrRoot, double founderMeatOrDefense,
                                       double founderThermal) {
        String existing = speciesNameToId.get(name);
        if (existing != null) return existing;

        String slug = "sp_" + name.toLowerCase().replaceAll("[^a-z0-9]+", "_").replaceAll("^_|_$", "");
        String finalId = slug;
        int suffix = 2;
        while (speciesById.containsKey(finalId)) {
            finalId = slug + "_" + suffix++;
        }

        String color = SPECIES_PALETTE[speciesById.size() % SPECIES_PALETTE.length];
        SpeciesInfo info = new SpeciesInfo(
            finalId, name, type, color, ancestorId,
            rootName != null ? rootName : name,
            divergentTrait, generation, totalTicks,
            founderSizeOrHeight, founderSpeedOrRoot, founderMeatOrDefense, founderThermal
        );
        speciesById.put(finalId, info);
        speciesNameToId.put(name, finalId);
        return finalId;
    }

    public void addAnimal(Animal a) {
        if (a == null) return;
        double maxX = cols * CELL_SIZE - 12.0;
        double maxY = rows * CELL_SIZE - 12.0;
        a.setX(clamp(a.getX(), 12.0, maxX));
        a.setY(clamp(a.getY(), 12.0, maxY));
        String spId = registerOrGetSpecies(
            a.getSpeciesName(), "animal", null, a.getSpeciesName(), null,
            a.getSize(), a.getSpeed(), a.getCarnivore(), a.getThermal()
        );
        a.setSpeciesId(spId);
        int ar = clampInt((int) (a.getY() / CELL_SIZE), 0, rows - 1);
        int ac = clampInt((int) (a.getX() / CELL_SIZE), 0, cols - 1);
        GridCell cell = grid[ar][ac];
        Plant cover = cell.getPlant();
        a.updateLifeStage();
        a.updateCamouflageFactor(cell, a.computeMaxAllowedSpeed(cell), cover != null, cover != null ? cover.getGrowth() : 0.0);
        animals.add(a);
    }

    public void addPlant(Plant p) {
        if (p == null) return;
        if (p.getR() < 0 || p.getR() >= rows || p.getC() < 0 || p.getC() >= cols) return;
        GridCell cell = grid[p.getR()][p.getC()];
        if (!cell.isHabitable()) return;
        String spId = registerOrGetSpecies(
            p.getName(), "plant", null, p.getName(), null,
            p.getHeight(), p.getRootEfficiency(), p.getDefense(), p.getThermal()
        );
        p.setSpeciesId(spId);
        if (cell.getPlant() == null) {
            cell.setPlant(p);
        }
        plants.add(p);
    }

    public Entity findEntityById(String id) {
        if (id == null || id.isEmpty()) return null;
        for (Animal a : animals) {
            if (id.equals(a.getId())) return a;
        }
        for (Plant p : plants) {
            if (id.equals(p.getId())) return p;
        }
        for (Carcass c : carcasses) {
            if (id.equals(c.getId())) return c;
        }
        return null;
    }

    public List<GridCell> consumeDirtyCells() {
        if (dirtyCells.isEmpty()) return Collections.emptyList();
        List<GridCell> result = new ArrayList<>(dirtyCells.size());
        for (Long key : dirtyCells) {
            int r = (int) (key >>> 32);
            int c = (int) (long) key;
            if (r >= 0 && r < rows && c >= 0 && c < cols) {
                result.add(grid[r][c]);
            }
        }
        dirtyCells.clear();
        return result;
    }

    private void markCellDirty(int r, int c) {
        dirtyCells.add((((long) r) << 32) | (c & 0xFFFFFFFFL));
    }

    private static double mutateGene(double avg, double maxDelta, double min, double max) {
        double delta = (Math.random() * 2.0 - 1.0) * maxDelta;
        return clamp(avg + delta, min, max);
    }

    private static double averageHue(double h1, double h2) {
        double diff = h2 - h1;
        if (diff > 180.0) diff -= 360.0;
        else if (diff < -180.0) diff += 360.0;
        return ((h1 + diff * 0.5) % 360.0 + 360.0) % 360.0;
    }

    private static double clamp(double v, double min, double max) {
        return Math.max(min, Math.min(max, v));
    }

    private static int clampInt(int v, int min, int max) {
        return Math.max(min, Math.min(max, v));
    }

    // Getters & Setters
    public int getRows() { return rows; }
    public int getCols() { return cols; }
    public double getCellSize() { return CELL_SIZE; }
    public Season getCurrentSeason() { return currentSeason; }
    public int getGeneration() { return generation; }
    public int getTotalTicks() { return totalTicks; }
    public int getSeasonTicks() { return seasonTicks; }
    public int getSeasonLength() { return seasonLength; }
    public void setSeasonLength(int seasonLength) { this.seasonLength = Math.max(20, seasonLength); }
    public double getClimateOffset() { return climateOffset; }
    public void setClimateOffset(double climateOffset) { this.climateOffset = clamp(climateOffset, -1.5, 1.5); }
    public double getClimateTrend() { return climateTrend; }
    public int getImpactWinterTicks() { return impactWinterTicks; }
    public double getEffectiveGlobalTemperature() { return currentSeason.getTemperature() + climateTrend; }
    public double getEffectiveGlobalTemperatureCelsius() { return 18.0 + getEffectiveGlobalTemperature() * 16.0; }
    public long getWorldSeed() { return worldSeed; }

    public List<Animal> getAnimals() { return animals; }
    public List<Plant> getPlants() { return plants; }
    public List<Carcass> getCarcasses() { return carcasses; }
    public GridCell[][] getGrid() { return grid; }
    public Collection<SpeciesInfo> getSpeciesCatalog() { return speciesById.values(); }
    public Map<String, SpeciesInfo> getSpeciesById() { return speciesById; }
}
