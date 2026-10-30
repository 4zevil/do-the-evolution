package com.evolucao.model;

/**
 * Biomas presentes na grade 2D do ecossistema.
 */
public enum BiomeType {
    WATER("Água", 1.0, 0.0),
    FERTILE_SOIL("Solo Fértil", 0.8, 100.0),
    DRY_SOIL("Solo Arenoso/Seco", 0.2, 40.0),
    ROCKY_SOIL("Solo Rochoso", 0.35, 25.0);

    private final String displayName;
    private final double baseMoisture;
    private final double maxNativeEnergy;

    BiomeType(String displayName, double baseMoisture, double maxNativeEnergy) {
        this.displayName = displayName;
        this.baseMoisture = baseMoisture;
        this.maxNativeEnergy = maxNativeEnergy;
    }

    public String getDisplayName() { return displayName; }
    public double getBaseMoisture() { return baseMoisture; }
    public double getMaxNativeEnergy() { return maxNativeEnergy; }
}
