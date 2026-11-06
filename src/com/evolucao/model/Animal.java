package com.evolucao.model;

/**
 * Modelo de organismo animal regido pela Lei de Alometria de Kleiber (B ~ M^0.75),
 * Curvas de Desempenho Térmico Gaussianas (TPC) e Dieta Trófica Estrita.
 */
public class Animal extends Organism {
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

    private int mateCooldown;
    private String stateLabel;

    public Animal(String id, String name, String speciesName, double x, double y,
                  double size, double carnivore, double plant, double speed,
                  double perception, double gestation, double offspringCount,
                  double aggression, double health, double thermal) {
        super(id, name, speciesName, x, y, 85.0, 100.0 + carnivore * 80.0, thermal);
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

        this.mateCooldown = 30;
        this.stateLabel = "Forrageando";
    }

    public double calculateMetabolicCost(Season season) {
        double massKg = 5.0 + size * 80.0;
        double b0 = 0.06;
        double basalMetabolism = b0 * Math.pow(massKg / 40.0, 0.75);

        double curSpeed = Math.hypot(vx, vy);
        double locomotionCost = 0.04 * Math.pow(curSpeed / 2.0, 1.5);

        double deltaT = Math.abs(thermal - season.getTemperature());
        double thermalCost = Math.exp(deltaT * deltaT / 0.5) * 0.02 * season.getThermalCostMultiplier();

        return basalMetabolism + locomotionCost + thermalCost;
    }

    @Override
    public void tick(Season season, GridCell cell) {
        ageOneTick();
        if (mateCooldown > 0) mateCooldown--;

        double cost = calculateMetabolicCost(season);
        consumeEnergy(cost);

        if (this.energy <= 0.0 || this.age > (700 + size * 200)) {
            this.alive = false;
        }
    }

    public void tick(Season season) {
        tick(season, null);
    }

    public void move(double maxX, double maxY) {
        x += vx;
        y += vy;
        if (x < 12.0) { x = 12.0; vx = -vx; }
        if (x > maxX) { x = maxX; vx = -vx; }
        if (y < 12.0) { y = 12.0; vy = -vy; }
        if (y > maxY) { y = maxY; vy = -vy; }
    }

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
    public int getMateCooldown() { return mateCooldown; }
    public void setMateCooldown(int cd) { this.mateCooldown = cd; }
    public String getStateLabel() { return stateLabel; }
    public void setStateLabel(String label) { this.stateLabel = label; }
}
