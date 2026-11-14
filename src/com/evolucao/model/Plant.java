package com.evolucao.model;

/**
 * Entidade vegetal fundamentada na Lei do Mínimo de Liebig,
 * expondo o fator limitante (limitingFactor) e partição de biomassa.
 */
public class Plant extends Organism {

    public enum LimitingFactor {
        NITROGEN("nitrogen"),
        WATER("water"),
        LIGHT("light"),
        TEMPERATURE("temperature");

        private final String key;

        LimitingFactor(String key) {
            this.key = key;
        }

        public String getKey() {
            return key;
        }
    }

    private final int r;
    private final int c;

    private String speciesId;
    private double height;
    private double rootEfficiency;
    private double growthSpeed;
    private double defense;
    private double fruitAttraction;
    private double parasiteResistance;
    private double colorHue;

    private double growth;
    private boolean hasFruit;
    private int fruitCount;
    private int maxAge;

    private LimitingFactor limitingFactor;
    private double liebigScore;
    private double nitrogenFactor;
    private double waterFactor;
    private double lightFactor;
    private double thermalFactor;
    private String state;

    public Plant(String id, String name, int r, int c, double height, double rootEfficiency,
                 double growthSpeed, double defense, double fruitAttraction,
                 double parasiteResistance, double thermal) {
        this(id, name, deriveSpeciesId(name), r, c, height, rootEfficiency,
             growthSpeed, defense, fruitAttraction, parasiteResistance, thermal, 110.0);
    }

    public Plant(String id, String name, String speciesId, int r, int c, double height, double rootEfficiency,
                 double growthSpeed, double defense, double fruitAttraction,
                 double parasiteResistance, double thermal, double colorHue) {
        super(id, name, name, (c + 0.5) * 26.0, (r + 0.5) * 26.0, 40.0, 45.0, thermal);
        this.r = r;
        this.c = c;
        this.speciesId = (speciesId != null && !speciesId.isEmpty()) ? speciesId : deriveSpeciesId(name);
        this.height = clamp(height, 0.05, 1.0);
        this.rootEfficiency = clamp(rootEfficiency, 0.05, 1.0);
        this.growthSpeed = clamp(growthSpeed, 0.05, 1.0);
        this.defense = clamp(defense, 0.0, 1.0);
        this.fruitAttraction = clamp(fruitAttraction, 0.0, 1.0);
        this.parasiteResistance = clamp(parasiteResistance, 0.05, 1.0);
        this.colorHue = ((colorHue % 360.0) + 360.0) % 360.0;

        this.growth = 0.35;
        this.hasFruit = false;
        this.fruitCount = 0;

        double baseLifespan = 320.0 + (this.height * 320.0) + (this.defense * 180.0) - (this.growthSpeed * 140.0);
        this.maxAge = Math.max(180, (int) Math.round(baseLifespan));

        this.limitingFactor = LimitingFactor.NITROGEN;
        this.liebigScore = 0.5;
        this.nitrogenFactor = 0.5;
        this.waterFactor = 0.5;
        this.lightFactor = 0.5;
        this.thermalFactor = 1.0;
        this.state = "growing";
    }

    private static String deriveSpeciesId(String name) {
        if (name == null || name.isEmpty()) return "sp_plant";
        return "sp_" + name.toLowerCase().replaceAll("[^a-z0-9]+", "_").replaceAll("^_|_$", "");
    }

    public double getMaintenanceCost() {
        return 0.02 + (height * 0.02) + (defense * 0.015);
    }

    /**
     * Ciclo fisiológico vegetal regido integralmente pela Lei do Mínimo de Liebig.
     */
    public void tick(Season season, GridCell cell, double climateTrend, double sunlightMultiplier) {
        ageOneTick();
        if (cell == null || !cell.isHabitable()) {
            this.alive = false;
            this.state = "dead";
            return;
        }

        double cost = getMaintenanceCost();

        this.nitrogenFactor = cell.getSoilNitrogen() / (10.0 + cell.getSoilNitrogen());
        this.waterFactor = Math.min(1.0, cell.getMoisture() * (0.7 + rootEfficiency * 0.6));
        double effectiveSun = (season != null ? season.getPlantGrowthMultiplier() : 1.0) * sunlightMultiplier;
        this.lightFactor = effectiveSun / (0.4 + effectiveSun);

        double localTemp = cell.getEffectiveTemperature(season, climateTrend);
        double tempDiff = Math.abs(thermal - localTemp);
        this.thermalFactor = tempDiff > 0.4 ? Math.max(0.15, 1.0 / (1.0 + (tempDiff - 0.4) * 0.6)) : 1.0;

        // Lei do Mínimo de Liebig: identifica o recurso mais restritivo
        LimitingFactor bottleneck = LimitingFactor.LIGHT;
        double minResource = this.lightFactor;
        if (this.nitrogenFactor < minResource) {
            minResource = this.nitrogenFactor;
            bottleneck = LimitingFactor.NITROGEN;
        }
        if (this.waterFactor < minResource) {
            minResource = this.waterFactor;
            bottleneck = LimitingFactor.WATER;
        }
        double liebigBottleneck = minResource * this.thermalFactor;
        if (this.thermalFactor < minResource) {
            bottleneck = LimitingFactor.TEMPERATURE;
        }

        this.limitingFactor = bottleneck;
        this.liebigScore = liebigBottleneck;

        if (cell.getSoilNitrogen() >= cost) {
            cell.consumeNitrogen(cost);
            double leafAreaFactor = Math.max(0.20, growth);
            double deltaGrowth = 0.016 * leafAreaFactor * (0.5 + growthSpeed * 0.8) * liebigBottleneck;
            growth = Math.min(1.0, growth + deltaGrowth);

            if (growth >= 0.68) {
                hasFruit = true;
                fruitCount = (int) Math.round(1.0 + fruitAttraction * 4.0);
            }
            if (liebigBottleneck > 0.35 && energy < maxEnergy) {
                gainEnergy(0.12 * liebigBottleneck);
            }
        } else {
            consumeEnergy(0.32 * (1.0 + height * 0.4));
        }

        if (liebigBottleneck < 0.20) {
            consumeEnergy(0.14);
        }

        if (age > maxAge * 0.85) {
            consumeEnergy(0.18);
        }

        if (age >= maxAge || energy <= 0.0) {
            this.alive = false;
            this.state = "dead";
        } else if (liebigBottleneck < 0.25) {
            this.state = "stressed";
        } else if (age > maxAge * 0.85) {
            this.state = "senescent";
        } else if (hasFruit) {
            this.state = "fruiting";
        } else {
            this.state = "growing";
        }
    }

    @Override
    public void tick(Season season, GridCell cell) {
        tick(season, cell, 0.0, 1.0);
    }

    public double beEaten(double biteAmount) {
        double eaten = Math.min(growth, biteAmount);
        growth = Math.max(0.0, growth - eaten);
        energy = Math.max(0.0, energy - eaten * 16.0);
        hasFruit = false;
        fruitCount = 0;
        if (growth <= 0.05 || energy <= 4.0) {
            this.alive = false;
            this.state = "dead";
        }
        return eaten;
    }

    private static double clamp(double v, double min, double max) {
        return Math.max(min, Math.min(max, v));
    }

    // Getters & Setters
    public int getR() { return r; }
    public int getC() { return c; }
    public String getSpeciesId() { return speciesId; }
    public void setSpeciesId(String speciesId) { this.speciesId = speciesId; }
    public double getHeight() { return height; }
    public double getRootEfficiency() { return rootEfficiency; }
    public double getGrowthSpeed() { return growthSpeed; }
    public double getDefense() { return defense; }
    public double getFruitAttraction() { return fruitAttraction; }
    public double getParasiteResistance() { return parasiteResistance; }
    public double getColorHue() { return colorHue; }
    public double getGrowth() { return growth; }
    public void setGrowth(double growth) { this.growth = clamp(growth, 0.0, 1.0); }
    public boolean hasFruit() { return hasFruit; }
    public void setHasFruit(boolean hasFruit) { this.hasFruit = hasFruit; }
    public int getFruitCount() { return fruitCount; }
    public int getMaxAge() { return maxAge; }
    public LimitingFactor getLimitingFactor() { return limitingFactor; }
    public String getLimitingFactorKey() { return limitingFactor.getKey(); }
    public double getLiebigScore() { return liebigScore; }
    public double getNitrogenFactor() { return nitrogenFactor; }
    public double getWaterFactor() { return waterFactor; }
    public double getLightFactor() { return lightFactor; }
    public double getThermalFactor() { return thermalFactor; }
    public String getState() { return state; }
    public void setState(String state) { this.state = state; }
}
