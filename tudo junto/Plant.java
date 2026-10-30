package com.evolucao.model;

/**
 * Entidade vegetal fundamentada na Lei do Mínimo de Liebig
 * e partição de biomassa radicular, foliar e defensiva.
 */
public class Plant {
    private final String id;
    private final String name;
    private final int r;
    private final int c;

    private double height;
    private double rootEfficiency;
    private double growthSpeed;
    private double defense;
    private double fruitAttraction;
    private double parasiteResistance;
    private double thermal;

    private double energy;
    private double growth;
    private boolean hasFruit;
    private int age;

    public Plant(String id, String name, int r, int c, double height, double rootEfficiency,
                 double growthSpeed, double defense, double fruitAttraction,
                 double parasiteResistance, double thermal) {
        this.id = id;
        this.name = name;
        this.r = r;
        this.c = c;
        this.height = height;
        this.rootEfficiency = rootEfficiency;
        this.growthSpeed = growthSpeed;
        this.defense = defense;
        this.fruitAttraction = fruitAttraction;
        this.parasiteResistance = parasiteResistance;
        this.thermal = thermal;

        this.energy = 40.0;
        this.growth = 0.35;
        this.hasFruit = false;
        this.age = 0;
    }

    public double getMaintenanceCost() {
        return 0.02 + (height * 0.02) + (defense * 0.015);
    }

    public void tick(Season season, GridCell cell) {
        age++;
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
        } else {
            energy -= 0.20;
        }
    }

    public boolean isDead() {
        return energy <= 0.0 || age > 500;
    }

    public String getId() { return id; }
    public String getName() { return name; }
    public int getR() { return r; }
    public int getC() { return c; }
    public double getGrowth() { return growth; }
    public boolean isHasFruit() { return hasFruit; }
    public void setHasFruit(boolean hasFruit) { this.hasFruit = hasFruit; }
    public double getDefense() { return defense; }
    public double getEnergy() { return energy; }
    public void setGrowth(double growth) { this.growth = growth; }
}