package com.evolucao.model;

/**
 * Biomas presentes na grade 2D do ecossistema, com retenção hídrica,
 * teto de fertilidade (fertilityCap) e assinatura térmica base.
 */
public enum BiomeType {
    WATER("water", "Água", 1.0, 1.0, 0.0, -0.05, "#1a4a7a"),
    WETLAND("wetland", "Área Úmida / Pântano", 0.85, 0.92, 95.0, 0.05, "#2a6655"),
    FERTILE_SOIL("fertile", "Solo Fértil", 0.75, 0.75, 120.0, 0.0, "#2d6a3f"),
    TUNDRA("tundra", "Tundra Gelada", 0.45, 0.60, 55.0, -0.45, "#3d5a72"),
    DRY_SOIL("arid", "Solo Arenoso/Seco", 0.20, 0.20, 45.0, 0.35, "#7a5c2e"),
    ROCKY_SOIL("rocky", "Solo Rochoso", 0.35, 0.30, 25.0, -0.10, "#4a4a4a");

    private final String key;
    private final String displayName;
    private final double baseMoisture;
    private final double waterRetention;
    private final double fertilityCap;
    private final double baseTempOffset;
    private final String baseColorHex;

    BiomeType(String key, String displayName, double baseMoisture, double waterRetention,
              double fertilityCap, double baseTempOffset, String baseColorHex) {
        this.key = key;
        this.displayName = displayName;
        this.baseMoisture = baseMoisture;
        this.waterRetention = waterRetention;
        this.fertilityCap = fertilityCap;
        this.baseTempOffset = baseTempOffset;
        this.baseColorHex = baseColorHex;
    }

    public String getKey() { return key; }
    public String getDisplayName() { return displayName; }
    public double getBaseMoisture() { return baseMoisture; }
    public double getWaterRetention() { return waterRetention; }
    public double getFertilityCap() { return fertilityCap; }
    public double getMaxNativeEnergy() { return fertilityCap; }
    public double getBaseTempOffset() { return baseTempOffset; }
    public String getBaseColorHex() { return baseColorHex; }
    public boolean isHabitable() { return this != WATER; }

    public static BiomeType fromKey(String rawKey) {
        if (rawKey == null) return FERTILE_SOIL;
        String k = rawKey.trim().toLowerCase();
        switch (k) {
            case "water": return WATER;
            case "wetland": return WETLAND;
            case "fertile":
            case "fertile_soil": return FERTILE_SOIL;
            case "tundra":
            case "frozen": return TUNDRA;
            case "arid":
            case "dry":
            case "dry_soil":
            case "desert":
            case "savanna": return DRY_SOIL;
            case "rocky":
            case "rocky_soil": return ROCKY_SOIL;
            default: return FERTILE_SOIL;
        }
    }
}
