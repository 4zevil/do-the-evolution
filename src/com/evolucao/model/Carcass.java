package com.evolucao.model;

/**
 * Carcaça física de um animal morto que sofre necrose bacteriana
 * e mineralização, enriquecendo o solo com nitrogênio e biomassa orgânica.
 */
public class Carcass extends Entity {
    private final int r;
    private final int c;
    private double remainingEnergy;
    private int decayTimer;

    public Carcass(String id, double x, double y, int r, int c, double remainingEnergy) {
        super(id, x, y);
        this.r = r;
        this.c = c;
        this.remainingEnergy = remainingEnergy;
        this.decayTimer = 0;
    }

    @Override
    public void tick(Season season, GridCell cell) {
        decayTimer++;
        if (cell != null) {
            cell.addOrganicBiomass(0.20);
        }
        remainingEnergy -= 0.25;
        if (isExpired()) {
            this.alive = false;
        }
    }

    public void tick(GridCell cell) {
        tick(null, cell);
    }

    public boolean isExpired() {
        return remainingEnergy <= 0.0 || decayTimer > 250;
    }

    public double consumeBite(double maxBite) {
        double bite = Math.min(remainingEnergy, maxBite);
        remainingEnergy -= bite;
        if (remainingEnergy <= 0.0) {
            this.alive = false;
        }
        return bite;
    }

    public int getR() { return r; }
    public int getC() { return c; }
    public double getRemainingEnergy() { return remainingEnergy; }
    public int getDecayTimer() { return decayTimer; }
}
