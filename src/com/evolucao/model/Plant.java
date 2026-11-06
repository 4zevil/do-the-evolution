package com.evolucao.model;

/**
 * Entidade vegetal fundamentada na Lei do Mínimo de Liebig
 * e partição de biomassa radicular, foliar e defensiva.
 */
public class Plant extends Organism {
    private final int r;
    private final int c;

    private double height;
    private double rootEfficiency;
    private double growthSpeed;
    private double defense;
    private double fruitAttraction;
    private double parasiteResistance;

    private double growth;
    private boolean hasFruit;

    public Plant(String id, String name, int r, int c, double height, double rootEfficiency,
                 double growthSpeed, double defense, double fruitAttraction,
                 double parasiteResistance, double thermal) {
        super(id, name, name, (c + 0.5) * 26.0, (r + 0.5) * 26.0, 40.0, 45.0, thermal);
        this.r = r;
        this.c = c;
        this.height = height;
        this.rootEfficiency = rootEfficiency;
        this.growthSpeed = growthSpeed;
        this.defense = defense;
        this.fruitAttraction = fruitAttraction;
        this.parasiteResistance = parasiteResistance;

        this.growth = 0.35;
        this.hasFruit = false;
    }

    public double getMaintenanceCost() {
        return 0.02 + (height * 0.02) + (defense * 0.015);
    }

    @Override
    public void tick(Season season, GridCell cell) {
        ageOneTick();
        double cost = getMaintenanceCost();

        double nitrogenFactor = cell.getSoilNitrogen() / (10.0 + cell.getSoilNitrogen());
        double waterFactor = Math.min(1.0, cell.getMoisture() * (0.7 + rootEfficiency * 0.6));
        double lightFactor = season.getPlantGrowthMultiplier() / (0.4 + season.getPlantGrowthMultiplier());

        double liebigBottleneck = Math.min(lightFactor, Math.min(nitrogenFactor, waterFactor));

        if (cell.getSoilNitrogen() >= cost) {
            cell.consumeNitrogen(cost);
            double leafAreaFactor = Math.max(0.20, growth);
            double deltaGrowth = 0.016 * leafAreaFactor * (0.5 + growthSpeed * 0.8) * liebigBottleneck;
            growth = Math.min(1.0, growth + deltaGrowth);

            if (growth >= 0.70) {
                hasFruit = true;
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

        if (energy <= 0.0) {
            this.alive = false;
        }
    }

    public double beEaten(double biteAmount) {
        double eaten = Math.min(growth, biteAmount);
        growth -= eaten;
        if (growth <= 0.05) {
            this.alive = false;
        }
        return eaten;
    }

    public int getR() { return r; }
    public int getC() { return c; }
    public double getHeight() { return height; }
    public double getRootEfficiency() { return rootEfficiency; }
    public double getGrowthSpeed() { return growthSpeed; }
    public double getDefense() { return defense; }
    public double getFruitAttraction() { return fruitAttraction; }
    public double getParasiteResistance() { return parasiteResistance; }
    public double getGrowth() { return growth; }
    public void setGrowth(double growth) { this.growth = growth; }
    public boolean hasFruit() { return hasFruit; }
    public void setHasFruit(boolean hasFruit) { this.hasFruit = hasFruit; }
}
