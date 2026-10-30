package com.evolucao.model;

/**
 * Célula da grade 2D que gerencia o solo, pool de nitrogênio e decomposição.
 */
public class GridCell {
    private final int r;
    private final int c;
    private final BiomeType biome;
    private double moisture;
    private double soilNitrogen;
    private double maxSoilNitrogen;
    private double organicBiomass;

    public GridCell(int r, int c, BiomeType biome) {
        this.r = r;
        this.c = c;
        this.biome = biome;
        this.moisture = biome.getBaseMoisture();
        this.maxSoilNitrogen = biome.getMaxNativeEnergy();
        this.soilNitrogen = maxSoilNitrogen * 0.75;
        this.organicBiomass = 0.0;
    }

    public void addOrganicBiomass(double amount) {
        this.organicBiomass = Math.min(80.0, this.organicBiomass + amount);
    }

    public void addDecomposedBiomass(double amount) {
        addOrganicBiomass(amount);
    }

    public void regenerateNativeEnergy(double rate) {
        if (biome != BiomeType.WATER) {
            this.soilNitrogen = Math.min(maxSoilNitrogen, this.soilNitrogen + rate);
        }
    }

    public double consumeNitrogen(double amount) {
        double consumed = Math.min(soilNitrogen, amount);
        soilNitrogen -= consumed;
        return consumed;
    }

    public double consumeEnergy(double amount) {
        return consumeNitrogen(amount);
    }

    public double getTotalAvailableEnergy() {
        return soilNitrogen + (organicBiomass * 0.5);
    }

    public int getR() { return r; }
    public int getC() { return c; }
    public BiomeType getBiome() { return biome; }
    public double getMoisture() { return moisture; }
    public double getSoilNitrogen() { return soilNitrogen; }
    public double getNativeEnergy() { return soilNitrogen; }
    public double getOrganicBiomass() { return organicBiomass; }
    public double getDecomposedEnergy() { return organicBiomass; }
}