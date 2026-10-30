package com.evolucao.model;

/**
 * As 4 estações do ano com seus multiplicadores climáticos.
 */
public enum Season {
    SPRING("Primavera", "🌸", 0.0, 1.5, 1.4, 1.0),
    SUMMER("Verão", "☀️", 0.8, 0.5, 1.0, 1.3),
    AUTUMN("Outono", "🍂", -0.2, 1.0, 0.8, 1.0),
    WINTER("Inverno", "❄️", -0.8, 0.4, 0.2, 1.6);

    private final String name;
    private final String icon;
    private final double temperature;
    private final double rainMultiplier;
    private final double plantGrowthMultiplier;
    private final double thermalCostMultiplier;

    Season(String name, String icon, double temperature, double rainMultiplier, double plantGrowthMultiplier, double thermalCostMultiplier) {
        this.name = name;
        this.icon = icon;
        this.temperature = temperature;
        this.rainMultiplier = rainMultiplier;
        this.plantGrowthMultiplier = plantGrowthMultiplier;
        this.thermalCostMultiplier = thermalCostMultiplier;
    }

    public String getName() { return name; }
    public String getIcon() { return icon; }
    public double getTemperature() { return temperature; }
    public double getRainMultiplier() { return rainMultiplier; }
    public double getPlantGrowthMultiplier() { return plantGrowthMultiplier; }
    public double getThermalCostMultiplier() { return thermalCostMultiplier; }

    public Season next() {
        Season[] values = Season.values();
        return values[(this.ordinal() + 1) % values.length];
    }
}
