package com.evolucao.model;

/**
 * Organismo vivo dotado de genoma quantitativo, energia celular,
 * ciclo vital (envelhecimento) e necessidade metabólica.
 */
public abstract class Organism extends Entity {
    protected final String name;
    protected final String speciesName;
    protected double energy;
    protected double maxEnergy;
    protected int age;
    protected double thermal;

    public Organism(String id, String name, String speciesName, double x, double y,
                    double initialEnergy, double maxEnergy, double thermal) {
        super(id, x, y);
        this.name = name;
        this.speciesName = speciesName;
        this.energy = initialEnergy;
        this.maxEnergy = maxEnergy;
        this.age = 0;
        this.thermal = thermal;
    }

    public void ageOneTick() {
        this.age++;
    }

    public void consumeEnergy(double amount) {
        this.energy = Math.max(0.0, this.energy - amount);
        if (this.energy <= 0.0) {
            this.alive = false;
        }
    }

    public void gainEnergy(double amount) {
        this.energy = Math.min(this.maxEnergy, this.energy + amount);
    }

    public boolean isDead() {
        return !this.alive || this.energy <= 0.0;
    }

    public String getName() { return name; }
    public String getSpeciesName() { return speciesName; }
    public double getEnergy() { return energy; }
    public void setEnergy(double energy) { this.energy = energy; }
    public double getMaxEnergy() { return maxEnergy; }
    public int getAge() { return age; }
    public double getThermal() { return thermal; }
}
