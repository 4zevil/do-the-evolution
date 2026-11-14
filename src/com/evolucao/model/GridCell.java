package com.evolucao.model;

/**
 * Célula da grade 2D que gerencia microclima local (localTempOffset),
 * retenção hídrica (waterRetention), teto de fertilidade (fertilityCap) e ciclo do nitrogênio.
 */
public class GridCell {
    private final int r;
    private final int c;
    private BiomeType biome;
    private double elevation;
    private double moisture;
    private double waterRetention;
    private double fertilityCap;
    private double maxSoilNitrogen;
    private double soilNitrogen;
    private double organicBiomass;
    private double localTempOffset;
    private Plant plant;

    public GridCell(int r, int c, BiomeType biome) {
        this(
            r,
            c,
            biome,
            biome.getBaseTempOffset(),
            0.5,
            biome.getWaterRetention(),
            biome.getFertilityCap()
        );
    }

    public GridCell(int r, int c, BiomeType biome, double localTempOffset,
                    double elevation, double waterRetention, double fertilityCap) {
        this.r = r;
        this.c = c;
        this.biome = biome != null ? biome : BiomeType.FERTILE_SOIL;
        this.localTempOffset = clamp(localTempOffset, -1.0, 1.0);
        this.elevation = clamp(elevation, 0.0, 1.0);
        this.waterRetention = clamp(waterRetention, 0.0, 1.0);
        this.fertilityCap = Math.max(0.0, fertilityCap);
        this.maxSoilNitrogen = this.fertilityCap;
        this.moisture = this.biome == BiomeType.WATER
            ? 1.0
            : clamp(this.biome.getBaseMoisture() * (0.75 + 0.35 * this.waterRetention), 0.10, 1.0);
        this.soilNitrogen = this.fertilityCap * 0.75;
        this.organicBiomass = this.biome == BiomeType.WATER ? 0.0 : 2.5;
        this.plant = null;
    }

    public double getEffectiveTemperature(Season season, double climateTrend) {
        double baseSeasonTemp = season != null ? season.getTemperature() : 0.0;
        return baseSeasonTemp + climateTrend + localTempOffset;
    }

    /**
     * Atualiza umidade, mineralização de biomassa orgânica e recarga nativa
     * respeitando waterRetention e fertilityCap.
     */
    public void regenerate(Season season, double climateTrend) {
        if (biome == BiomeType.WATER) {
            this.moisture = 1.0;
            this.soilNitrogen = 0.0;
            return;
        }

        double rain = season != null ? season.getRainMultiplier() : 1.0;
        double effTemp = getEffectiveTemperature(season, climateTrend);

        double evaporation = (0.010 + Math.max(0.0, effTemp) * 0.015) * (1.0 - waterRetention * 0.78);
        double precipitation = 0.022 * rain * (0.40 + 0.60 * waterRetention);
        this.moisture = clamp(this.moisture + precipitation - evaporation, 0.08, 1.0);

        if (this.organicBiomass > 0.05) {
            double mineralized = this.organicBiomass * 0.04 * this.moisture * (0.50 + 0.50 * this.waterRetention);
            this.organicBiomass = Math.max(0.0, this.organicBiomass - mineralized);
            this.soilNitrogen = Math.min(this.fertilityCap, this.soilNitrogen + mineralized * 0.90);
        }

        if (this.soilNitrogen < this.fertilityCap) {
            double capRatio = this.fertilityCap / 120.0;
            double nativeRegen = 0.12 * rain * (0.35 + 0.65 * capRatio) * (0.5 + 0.5 * this.moisture);
            this.soilNitrogen = Math.min(this.fertilityCap, this.soilNitrogen + nativeRegen);
        }
    }

    public void addOrganicBiomass(double amount) {
        this.organicBiomass = Math.min(80.0, Math.max(0.0, this.organicBiomass + amount));
    }

    public void addDecomposedBiomass(double amount) {
        addOrganicBiomass(amount);
    }

    public void regenerateNativeEnergy(double rate) {
        if (biome != BiomeType.WATER) {
            double scaledRate = rate * (0.35 + 0.65 * (fertilityCap / 120.0));
            this.soilNitrogen = Math.min(fertilityCap, this.soilNitrogen + scaledRate);
        }
    }

    public double consumeNitrogen(double amount) {
        double consumed = Math.min(soilNitrogen, Math.max(0.0, amount));
        soilNitrogen -= consumed;
        return consumed;
    }

    public double consumeEnergy(double amount) {
        return consumeNitrogen(amount);
    }

    public double getTotalAvailableEnergy() {
        return soilNitrogen + (organicBiomass * 0.5);
    }

    public boolean isHabitable() {
        return biome != BiomeType.WATER;
    }

    public void setBiome(BiomeType newBiome) {
        if (newBiome == null || this.biome == newBiome) return;
        double tempDelta = newBiome.getBaseTempOffset() - this.biome.getBaseTempOffset();
        this.biome = newBiome;
        this.localTempOffset = clamp(this.localTempOffset + tempDelta, -1.0, 1.0);
        this.waterRetention = newBiome.getWaterRetention();
        this.fertilityCap = newBiome.getFertilityCap();
        this.maxSoilNitrogen = this.fertilityCap;
        this.soilNitrogen = Math.min(this.fertilityCap, this.soilNitrogen);
        if (newBiome == BiomeType.WATER) {
            this.moisture = 1.0;
            this.soilNitrogen = 0.0;
        }
    }

    private static double clamp(double val, double min, double max) {
        return Math.max(min, Math.min(max, val));
    }

    public int getR() { return r; }
    public int getC() { return c; }
    public BiomeType getBiome() { return biome; }
    public double getElevation() { return elevation; }
    public void setElevation(double elevation) { this.elevation = clamp(elevation, 0.0, 1.0); }
    public double getMoisture() { return moisture; }
    public void setMoisture(double moisture) { this.moisture = clamp(moisture, 0.0, 1.0); }
    public double getWaterRetention() { return waterRetention; }
    public void setWaterRetention(double waterRetention) { this.waterRetention = clamp(waterRetention, 0.0, 1.0); }
    public double getFertilityCap() { return fertilityCap; }
    public void setFertilityCap(double fertilityCap) {
        this.fertilityCap = Math.max(0.0, fertilityCap);
        this.maxSoilNitrogen = this.fertilityCap;
        this.soilNitrogen = Math.min(this.soilNitrogen, this.fertilityCap);
    }
    public double getMaxSoilNitrogen() { return maxSoilNitrogen; }
    public double getSoilNitrogen() { return soilNitrogen; }
    public void setSoilNitrogen(double soilNitrogen) {
        this.soilNitrogen = Math.max(0.0, Math.min(fertilityCap, soilNitrogen));
    }
    public double getNativeEnergy() { return soilNitrogen; }
    public double getOrganicBiomass() { return organicBiomass; }
    public double getDecomposedEnergy() { return organicBiomass; }
    public double getLocalTempOffset() { return localTempOffset; }
    public void setLocalTempOffset(double localTempOffset) { this.localTempOffset = clamp(localTempOffset, -1.0, 1.0); }
    public Plant getPlant() { return plant; }
    public void setPlant(Plant plant) { this.plant = plant; }
}
