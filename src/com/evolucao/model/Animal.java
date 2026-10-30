package com.evolucao.model;

/**
 * Modelo de organismo animal regido pela Lei de Alometria de Kleiber (B ~ M^0.75),
 * Curvas de Desempenho Térmico Gaussianas (TPC) e Dieta Trófica Estrita.
 */
public class Animal {
    private final String id;
    private final String name;
    private final String speciesName;

    private double x;
    private double y;
    private double vx;
    private double vy;

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
    private double thermal;

    private double energy;
    private int age;
    private int mateCooldown;
    private String stateLabel;

    public Animal(String id, String name, String speciesName, double x, double y,
                  double size, double carnivore, double plant, double speed,
                  double perception, double gestation, double offspringCount,
                  double aggression, double health, double thermal) {
        this.id = id;
        this.name = name;
        this.speciesName = speciesName;
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 1.5;
        this.vy = (Math.random() - 0.5) * 1.5;

        this.size = size;
        this.carnivore = carnivore;
        this.plant = plant;
        this.carcassDiet = Math.max(0.0, 1.0 - (carnivore + plant));
        this.speed = speed;
        this.perception = perception;
        this.gestation = gestation;
        this.offspringCount = offspringCount;
        this.aggression = aggression;
        this.health = health;
        this.thermal = thermal;

        this.energy = 85.0;
        this.age = 0;
        this.mateCooldown = 30;
        this.stateLabel = "Forrageando";
    }

    public double calculateMetabolicCost(Season season) {
        double massKg = 5.0 + size * 80.0;
        double b0 = 0.06;
        double basalMetabolism = b0 * Math.pow(massKg / 40.0, 0.75);

        double curSpeed = Math.hypot(vx, vy);
        double locomotionCost = 0.04 * Math.pow(curSpeed / 2.0, 1.5);

        double tempDiff = Math.abs(thermal - season.getTemperature());
        double thermalCostFactor = 1.0 + (tempDiff > 0.4 ? 0.3 : 0.0) * season.getThermalCostMultiplier();

        return (basalMetabolism + locomotionCost) * thermalCostFactor;
    }

    public void tick(Season season) {
        age++;
        if (mateCooldown > 0) mateCooldown--;
        energy -= calculateMetabolicCost(season);
    }

    public boolean isDead() {
        return energy <= 0.0 || age > 750;
    }

    public String getId() { return id; }
    public String getName() { return name; }
    public String getSpeciesName() { return speciesName; }
    public double getX() { return x; }
    public double getY() { return y; }
    public void setX(double x) { this.x = x; }
    public void setY(double y) { this.y = y; }
    public double getVx() { return vx; }
    public double getVy() { return vy; }
    public void setVx(double vx) { this.vx = vx; }
    public void setVy(double vy) { this.vy = vy; }
    public double getEnergy() { return energy; }
    public void setEnergy(double energy) { this.energy = Math.min(100.0, energy); }
    public double getSize() { return size; }
    public double getCarnivore() { return carnivore; }
    public double getPlant() { return plant; }
    public double getSpeed() { return speed; }
    public double getPerception() { return perception; }
    public double getHealth() { return health; }
    public double getAggression() { return aggression; }
    public double getThermal() { return thermal; }
    public double getOffspringCount() { return offspringCount; }
    public int getMateCooldown() { return mateCooldown; }
    public void setMateCooldown(int mateCooldown) { this.mateCooldown = mateCooldown; }
    public String getStateLabel() { return stateLabel; }
    public void setStateLabel(String stateLabel) { this.stateLabel = stateLabel; }
    public int getAge() { return age; }
}

