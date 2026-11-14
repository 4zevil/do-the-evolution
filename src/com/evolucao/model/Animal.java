package com.evolucao.model;

/**
 * Modelo de organismo animal regido pela Lei de Alometria de Kleiber (B ~ M^0.75),
 * Curvas de Desempenho Térmico (TPC), Dieta Trófica Estrita, Estágios de Vida (lifeStage),
 * Fadiga/Vigor (stamina) e Camuflagem Dinâmica (camouflageFactor).
 */
public class Animal extends Organism {

    public enum LifeStage {
        JUVENILE("juvenile"),
        ADULT("adult"),
        ELDER("elder");

        private final String key;

        LifeStage(String key) {
            this.key = key;
        }

        public String getKey() {
            return key;
        }
    }

    public static final class OffspringGenome {
        public final double size, carnivore, plant, carcassDiet, speed, perception;
        public final double gestation, offspringCount, aggression, health, aquatic, thermal, colorHue;

        public OffspringGenome(double size, double carnivore, double plant, double carcassDiet,
                               double speed, double perception, double gestation, double offspringCount,
                               double aggression, double health, double aquatic, double thermal, double colorHue) {
            this.size = size;
            this.carnivore = carnivore;
            this.plant = plant;
            this.carcassDiet = carcassDiet;
            this.speed = speed;
            this.perception = perception;
            this.gestation = gestation;
            this.offspringCount = offspringCount;
            this.aggression = aggression;
            this.health = health;
            this.aquatic = aquatic;
            this.thermal = thermal;
            this.colorHue = colorHue;
        }
    }

    public static final class CarriedSeed {
        public final String speciesName;
        public final String speciesId;
        public final double height, rootEfficiency, growthSpeed, defense;
        public final double fruitAttraction, parasiteResistance, thermal, colorHue;
        public int dropTimer;

        public CarriedSeed(String speciesName, String speciesId, double height, double rootEfficiency,
                           double growthSpeed, double defense, double fruitAttraction,
                           double parasiteResistance, double thermal, double colorHue, int dropTimer) {
            this.speciesName = speciesName;
            this.speciesId = speciesId;
            this.height = height;
            this.rootEfficiency = rootEfficiency;
            this.growthSpeed = growthSpeed;
            this.defense = defense;
            this.fruitAttraction = fruitAttraction;
            this.parasiteResistance = parasiteResistance;
            this.thermal = thermal;
            this.colorHue = colorHue;
            this.dropTimer = dropTimer;
        }
    }

    // Genoma Quantitativo
    private double size;
    private double carnivore;
    private double plant;
    private double carcassDiet;
    private double speed;
    private double perception;
    private double gestation;
    private double offspringCount;
    private double aggression;
    private double health;
    private double aquatic;
    private double colorHue;
    private String speciesId;

    // Novos atributos biológicos (Paridade)
    private LifeStage lifeStage;
    private double stamina;
    private double maxStamina;
    private boolean exhausted;
    private double camouflageFactor;
    private int maxLifespan;

    // Estado comportamental e fisiológico
    private int mateCooldown;
    private int attackCooldown;
    private boolean isDiseased;
    private int diseaseTimer;
    private boolean isPregnant;
    private int gestationTicks;
    private OffspringGenome pregnantGenome;
    private String pregnantSpeciesName;
    private String pregnantSpeciesId;
    private int pregnantClutchSize;
    private int fleeTicks;
    private double carcassEnergy;
    private CarriedSeed carriedSeed;
    private String state;
    private String stateLabel;

    // Telemetria metabólica para Inspetor
    private double lastBasalCost;
    private double lastLocomotionCost;
    private double lastThermalCost;
    private double lastTotalCost;

    public Animal(String id, String name, String speciesName, double x, double y,
                  double size, double carnivore, double plant, double speed,
                  double perception, double gestation, double offspringCount,
                  double aggression, double health, double thermal) {
        this(id, name, speciesName, deriveSpeciesId(speciesName), x, y,
             size, carnivore, plant, speed, perception, gestation, offspringCount,
             aggression, health, 0.15, thermal, carnivore > 0.45 ? 15.0 : 120.0);
    }

    public Animal(String id, String name, String speciesName, String speciesId, double x, double y,
                  double size, double carnivore, double plant, double speed,
                  double perception, double gestation, double offspringCount,
                  double aggression, double health, double aquatic, double thermal, double colorHue) {
        super(id, name, speciesName, x, y, 90.0, 100.0 + carnivore * 80.0, thermal);
        this.vx = (Math.random() - 0.5) * 1.5;
        this.vy = (Math.random() - 0.5) * 1.5;

        this.size = clamp(size, 0.05, 1.0);
        double totalDiet = Math.max(0.001, carnivore + plant + Math.max(0.0, 1.0 - (carnivore + plant)));
        this.carnivore = clamp(carnivore / totalDiet, 0.0, 1.0);
        this.plant = clamp(plant / totalDiet, 0.0, 1.0);
        this.carcassDiet = Math.max(0.0, 1.0 - (this.carnivore + this.plant));
        this.speed = clamp(speed, 0.05, 1.0);
        this.perception = clamp(perception, 0.05, 1.0);
        this.gestation = clamp(gestation, 0.05, 1.0);
        this.offspringCount = clamp(offspringCount, 0.05, 1.0);
        this.aggression = clamp(aggression, 0.0, 1.0);
        this.health = clamp(health, 0.05, 1.0);
        this.aquatic = clamp(aquatic, 0.0, 1.0);
        this.colorHue = ((colorHue % 360.0) + 360.0) % 360.0;
        this.speciesId = (speciesId != null && !speciesId.isEmpty()) ? speciesId : deriveSpeciesId(speciesName);

        double baseLifespan = this.carnivore > 0.45
            ? (950.0 + this.size * 300.0)
            : (700.0 + this.size * 200.0);
        this.maxLifespan = (int) Math.round(baseLifespan * (0.90 + this.health * 0.20));

        this.lifeStage = LifeStage.JUVENILE;
        this.maxStamina = calculateMaxStamina();
        this.stamina = this.maxStamina;
        this.exhausted = false;
        this.camouflageFactor = clamp(0.30 + (1.0 - this.size) * 0.25, 0.05, 0.95);

        this.mateCooldown = 30;
        this.attackCooldown = 0;
        this.isDiseased = false;
        this.diseaseTimer = 0;
        this.isPregnant = false;
        this.gestationTicks = 0;
        this.pregnantClutchSize = 1;
        this.fleeTicks = 0;
        this.carcassEnergy = -1.0;
        this.state = "foraging";
        this.stateLabel = "Forrageando";
    }

    private static String deriveSpeciesId(String speciesName) {
        if (speciesName == null || speciesName.isEmpty()) return "sp_animal";
        return "sp_" + speciesName.toLowerCase().replaceAll("[^a-z0-9]+", "_").replaceAll("^_|_$", "");
    }

    public double getStageMassMultiplier() {
        if (lifeStage == LifeStage.JUVENILE) {
            double juvEnd = Math.max(1.0, maxLifespan * 0.15);
            double progress = Math.min(1.0, age / juvEnd);
            return 0.45 + 0.55 * progress;
        }
        if (lifeStage == LifeStage.ELDER) {
            return 0.95;
        }
        return 1.0;
    }

    public double getStageSpeedMultiplier() {
        if (lifeStage == LifeStage.JUVENILE) return 0.88;
        if (lifeStage == LifeStage.ELDER) return 0.78;
        return 1.0;
    }

    public double getStageDamageMultiplier() {
        if (lifeStage == LifeStage.JUVENILE) return 0.60;
        if (lifeStage == LifeStage.ELDER) return 0.80;
        return 1.0;
    }

    public double calculateMaxStamina() {
        double stageFactor = lifeStage == LifeStage.ELDER ? 0.78 : (lifeStage == LifeStage.JUVENILE ? 0.90 : 1.0);
        return (80.0 + health * 40.0) * stageFactor;
    }

    public void updateLifeStage() {
        double ratio = (double) age / Math.max(1, maxLifespan);
        if (ratio < 0.15) {
            this.lifeStage = LifeStage.JUVENILE;
        } else if (ratio < 0.75) {
            this.lifeStage = LifeStage.ADULT;
        } else {
            this.lifeStage = LifeStage.ELDER;
        }
        this.maxStamina = calculateMaxStamina();
        if (this.stamina > this.maxStamina) {
            this.stamina = this.maxStamina;
        }
    }

    public double computeMaxAllowedSpeed(GridCell cell) {
        double penalty = isDiseased ? 0.65 : (isPregnant ? 0.82 : 1.0);
        double staminaPenalty = exhausted ? 0.45 : 1.0;
        boolean inWater = cell != null && cell.getBiome() == BiomeType.WATER;
        double terrainFactor = inWater
            ? (0.30 + aquatic * 0.90)
            : (1.10 - aquatic * 0.55);
        return (0.7 + speed * 2.2) * penalty * staminaPenalty * terrainFactor * getStageSpeedMultiplier();
    }

    public void updateStamina(double curSpeed, double maxAllowedSpeed, boolean inWater) {
        double cruiseThreshold = Math.max(0.25, maxAllowedSpeed * 0.58);
        boolean highExertion = curSpeed > cruiseThreshold
            || (inWater && aquatic < 0.35)
            || "hunting".equals(state)
            || "fleeing".equals(state);

        if (highExertion && !exhausted) {
            double sprintRatio = Math.max(0.15, (curSpeed / Math.max(0.25, maxAllowedSpeed)) - 0.45);
            double waterDrag = (inWater && aquatic < 0.35) ? 1.50 : 1.0;
            double drain = sprintRatio * (1.85 - health * 0.75) * waterDrag;
            this.stamina = Math.max(0.0, this.stamina - drain);
            if (this.stamina <= 12.0) {
                this.exhausted = true;
            }
        } else if (this.energy > 15.0) {
            double stageRecovery = lifeStage == LifeStage.JUVENILE ? 1.15 : (lifeStage == LifeStage.ELDER ? 0.65 : 1.0);
            double energyFactor = clamp(this.energy / Math.max(1.0, this.maxEnergy), 0.0, 1.0);
            double recoveryRate = (0.90 + health * 0.90) * stageRecovery * (0.35 + 0.65 * energyFactor);
            double gained = Math.min(this.maxStamina - this.stamina, recoveryRate);
            if (gained > 0.0) {
                this.stamina += gained;
                consumeEnergy(gained * 0.025);
            }
            if (this.exhausted && this.stamina >= this.maxStamina * 0.35) {
                this.exhausted = false;
            }
        }
    }

    public void updateCamouflageFactor(GridCell cell, double maxAllowedSpeed, boolean hasPlantCover, double plantGrowth) {
        BiomeType biome = cell != null ? cell.getBiome() : BiomeType.FERTILE_SOIL;
        double targetHue;
        double hueTolerance = 110.0;
        switch (biome) {
            case WATER:
                targetHue = 210.0;
                break;
            case WETLAND:
                targetHue = 145.0;
                break;
            case TUNDRA:
                targetHue = 200.0;
                break;
            case DRY_SOIL:
                targetHue = 42.0;
                break;
            case ROCKY_SOIL:
                targetHue = 35.0;
                hueTolerance = 140.0;
                break;
            case FERTILE_SOIL:
            default:
                targetHue = 120.0;
                break;
        }

        double hueDiff = Math.abs(this.colorHue - targetHue);
        if (hueDiff > 180.0) hueDiff = 360.0 - hueDiff;
        double colorMatch = Math.max(0.0, 1.0 - (hueDiff / hueTolerance));

        double sizeStealth = 1.0 - size * 0.55 + (lifeStage == LifeStage.JUVENILE ? 0.10 : 0.0);
        double curSpeed = Math.hypot(vx, vy);
        double motionPenalty = Math.min(0.45, (curSpeed / Math.max(0.30, maxAllowedSpeed)) * 0.45);
        double coverBonus = (hasPlantCover && biome != BiomeType.WATER) ? Math.min(0.22, plantGrowth * 0.22) : 0.0;
        double aquaticBonus = (biome == BiomeType.WATER) ? aquatic * 0.25 : 0.0;

        this.camouflageFactor = clamp(
            0.45 * colorMatch + 0.35 * sizeStealth + coverBonus + aquaticBonus - motionPenalty,
            0.05,
            0.95
        );
    }

    /**
     * Preserva integralmente a Lei de Kleiber (B ~ M^0.75) e as curvas térmicas.
     */
    public double calculateMetabolicCost(Season season, GridCell cell, double climateTrend) {
        double massKg = (5.0 + size * 80.0) * getStageMassMultiplier();
        double b0 = 0.06;
        double basalMetabolism = b0 * Math.pow(massKg / 40.0, 0.75);

        double fastingEfficiency = 1.0 - carnivore * 0.40;
        double elderFrailty = (lifeStage == LifeStage.ELDER) ? 1.15 : 1.0;

        double curSpeed = Math.hypot(vx, vy);
        double locomotionCost = 0.04 * Math.pow(curSpeed / 2.0, 1.5);

        double localTemp = (cell != null)
            ? cell.getEffectiveTemperature(season, climateTrend)
            : ((season != null ? season.getTemperature() : 0.0) + climateTrend);
        double deltaT = Math.abs(thermal - localTemp);
        double thermalMult = season != null ? season.getThermalCostMultiplier() : 1.0;
        double thermalCost = Math.exp(Math.min(4.5, deltaT * deltaT / 0.5)) * 0.02 * thermalMult;

        double aquaticCost = 0.0;
        if (cell != null) {
            boolean inWater = cell.getBiome() == BiomeType.WATER;
            if (inWater && aquatic < 0.35) {
                aquaticCost = (0.35 - aquatic) * 0.25;
            } else if (!inWater && aquatic > 0.70) {
                aquaticCost = (aquatic - 0.70) * 0.20;
            }
        }

        double conditionCost = 0.0;
        if (isDiseased) conditionCost += 0.12;
        if (isPregnant) conditionCost += 0.08;

        this.lastBasalCost = basalMetabolism * fastingEfficiency * elderFrailty;
        this.lastLocomotionCost = locomotionCost + aquaticCost;
        this.lastThermalCost = thermalCost;
        this.lastTotalCost = this.lastBasalCost + this.lastLocomotionCost + this.lastThermalCost + conditionCost;
        return this.lastTotalCost;
    }

    public double calculateMetabolicCost(Season season) {
        return calculateMetabolicCost(season, null, 0.0);
    }

    public void tick(Season season, GridCell cell, double climateTrend, boolean hasPlantCover, double plantGrowth) {
        ageOneTick();
        updateLifeStage();

        if (mateCooldown > 0) mateCooldown--;
        if (attackCooldown > 0) attackCooldown--;
        if (isDiseased) {
            diseaseTimer--;
            if (diseaseTimer <= 0) isDiseased = false;
        }
        if (isPregnant) {
            gestationTicks--;
        }

        boolean inWater = cell != null && cell.getBiome() == BiomeType.WATER;
        double maxAllowedSpeed = computeMaxAllowedSpeed(cell);
        double curSpeed = Math.hypot(vx, vy);

        updateStamina(curSpeed, maxAllowedSpeed, inWater);
        updateCamouflageFactor(cell, maxAllowedSpeed, hasPlantCover, plantGrowth);

        double cost = calculateMetabolicCost(season, cell, climateTrend);
        consumeEnergy(cost);

        if (this.energy <= 0.0 || this.age > maxLifespan) {
            this.alive = false;
            this.state = "dead";
        }
    }

    @Override
    public void tick(Season season, GridCell cell) {
        tick(season, cell, 0.0, false, 0.0);
    }

    public void tick(Season season) {
        tick(season, null, 0.0, false, 0.0);
    }

    public void move(double maxX, double maxY) {
        x += vx;
        y += vy;
        if (x < 12.0) { x = 12.0; vx = -vx; }
        if (x > maxX) { x = maxX; vx = -vx; }
        if (y < 12.0) { y = 12.0; vy = -vy; }
        if (y > maxY) { y = maxY; vy = -vy; }
    }

    public boolean canReproduce() {
        return alive && lifeStage == LifeStage.ADULT && age > 40 && mateCooldown == 0 && !isDiseased && !isPregnant;
    }

    public void setAge(int age) {
        this.age = Math.max(0, age);
        updateLifeStage();
    }

    private static double clamp(double v, double min, double max) {
        return Math.max(min, Math.min(max, v));
    }

    // Getters & Setters
    public double getSize() { return size; }
    public double getCarnivore() { return carnivore; }
    public double getPlant() { return plant; }
    public double getCarcassDiet() { return carcassDiet; }
    public double getSpeed() { return speed; }
    public double getPerception() { return perception; }
    public double getGestation() { return gestation; }
    public double getOffspringCount() { return offspringCount; }
    public double getAggression() { return aggression; }
    public double getHealth() { return health; }
    public double getAquatic() { return aquatic; }
    public double getColorHue() { return colorHue; }
    public String getSpeciesId() { return speciesId; }
    public void setSpeciesId(String speciesId) { this.speciesId = speciesId; }

    public LifeStage getLifeStage() { return lifeStage; }
    public String getLifeStageKey() { return lifeStage.getKey(); }
    public double getStamina() { return stamina; }
    public void setStamina(double stamina) { this.stamina = clamp(stamina, 0.0, maxStamina); }
    public double getMaxStamina() { return maxStamina; }
    public boolean isExhausted() { return exhausted; }
    public double getCamouflageFactor() { return camouflageFactor; }
    public int getMaxLifespan() { return maxLifespan; }

    public int getMateCooldown() { return mateCooldown; }
    public void setMateCooldown(int cd) { this.mateCooldown = cd; }
    public int getAttackCooldown() { return attackCooldown; }
    public void setAttackCooldown(int cd) { this.attackCooldown = cd; }
    public boolean isDiseased() { return isDiseased; }
    public void setDiseased(boolean diseased, int timer) {
        this.isDiseased = diseased;
        this.diseaseTimer = timer;
    }
    public int getDiseaseTimer() { return diseaseTimer; }
    public boolean isPregnant() { return isPregnant; }
    public int getGestationTicks() { return gestationTicks; }
    public void startPregnancy(OffspringGenome genome, String speciesName, String speciesId, int clutchSize, int ticks) {
        this.isPregnant = true;
        this.pregnantGenome = genome;
        this.pregnantSpeciesName = speciesName;
        this.pregnantSpeciesId = speciesId;
        this.pregnantClutchSize = Math.max(1, clutchSize);
        this.gestationTicks = Math.max(15, ticks);
    }
    public void clearPregnancy() {
        this.isPregnant = false;
        this.pregnantGenome = null;
        this.pregnantSpeciesName = null;
        this.pregnantSpeciesId = null;
        this.gestationTicks = 0;
    }
    public OffspringGenome getPregnantGenome() { return pregnantGenome; }
    public String getPregnantSpeciesName() { return pregnantSpeciesName; }
    public String getPregnantSpeciesId() { return pregnantSpeciesId; }
    public int getPregnantClutchSize() { return pregnantClutchSize; }

    public int getFleeTicks() { return fleeTicks; }
    public void setFleeTicks(int fleeTicks) { this.fleeTicks = Math.max(0, fleeTicks); }
    public double getCarcassEnergy() { return carcassEnergy; }
    public void setCarcassEnergy(double carcassEnergy) { this.carcassEnergy = carcassEnergy; }
    public CarriedSeed getCarriedSeed() { return carriedSeed; }
    public void setCarriedSeed(CarriedSeed carriedSeed) { this.carriedSeed = carriedSeed; }

    public String getState() { return state; }
    public void setState(String state) { this.state = state; }
    public String getStateLabel() { return stateLabel; }
    public void setStateLabel(String label) { this.stateLabel = label; }

    public double getLastBasalCost() { return lastBasalCost; }
    public double getLastLocomotionCost() { return lastLocomotionCost; }
    public double getLastThermalCost() { return lastThermalCost; }
    public double getLastTotalCost() { return lastTotalCost; }
}
