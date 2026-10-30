package com.evolucao.engine;

import com.evolucao.model.*;
import java.util.*;

/**
 * Motor central de física, ecologia e evolução da simulação em Java.
 */
public class SimulationEngine {
    private final int rows;
    private final int cols;
    private final GridCell[][] grid;
    private final List<Plant> plants;
    private final List<Animal> animals;
    private final List<Carcass> carcasses;

    private Season currentSeason;
    private int seasonTicks;
    private int seasonLength;
    private int generation;
    private int totalTicks;

    public SimulationEngine(int rows, int cols, BiomeType defaultBiome) {
        this.rows = rows;
        this.cols = cols;
        this.grid = new GridCell[rows][cols];
        this.plants = new ArrayList<>();
        this.animals = new ArrayList<>();
        this.carcasses = new ArrayList<>();

        this.currentSeason = Season.SPRING;
        this.seasonTicks = 0;
        this.seasonLength = 120;
        this.generation = 1;
        this.totalTicks = 0;

        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                grid[r][c] = new GridCell(r, c, defaultBiome);
            }
        }
    }

    public void updateTick() {
        totalTicks++;
        seasonTicks++;

        if (seasonTicks >= seasonLength) {
            seasonTicks = 0;
            currentSeason = currentSeason.next();
            if (currentSeason == Season.SPRING) {
                generation++;
            }
        }

        // 1. Atualiza carcaças e mineralização
        Iterator<Carcass> carcassIt = carcasses.iterator();
        while (carcassIt.hasNext()) {
            Carcass carcass = carcassIt.next();
            GridCell cell = grid[carcass.getR()][carcass.getC()];
            carcass.tick(cell);
            if (carcass.isExpired()) {
                carcassIt.remove();
            }
        }

        // 2. Regeneração nativa do solo
        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                grid[r][c].regenerateNativeEnergy(0.12 * currentSeason.getRainMultiplier());
            }
        }

        // 3. Atualiza vegetais com Liebig e área foliar
        Iterator<Plant> plantIt = plants.iterator();
        while (plantIt.hasNext()) {
            Plant plant = plantIt.next();
            GridCell cell = grid[plant.getR()][plant.getC()];
            plant.tick(currentSeason, cell);
            if (plant.isDead()) {
                cell.addOrganicBiomass(plant.getGrowth() * 10.0);
                plantIt.remove();
            }
        }

        // 4. Atualiza animais com Kleiber e forrageamento ótimo
        List<Animal> deadAnimals = new ArrayList<>();

        for (Animal animal : animals) {
            animal.tick(currentSeason);
            if (animal.isDead()) {
                deadAnimals.add(animal);
                continue;
            }

            double newX = animal.getX() + animal.getVx();
            double newY = animal.getY() + animal.getVy();
            double maxX = cols * 26.0 - 12.0;
            double maxY = rows * 26.0 - 12.0;

            if (newX < 12 || newX > maxX) animal.setVx(-animal.getVx());
            else animal.setX(newX);

            if (newY < 12 || newY > maxY) animal.setVy(-animal.getVy());
            else animal.setY(newY);

            // Herbivoria proporcional à biomassa real
            if (animal.getPlant() > 0.20 && animal.getEnergy() < 85.0) {
                int r = (int) (animal.getY() / 26.0);
                int c = (int) (animal.getX() / 26.0);
                if (r >= 0 && r < rows && c >= 0 && c < cols) {
                    for (Plant p : plants) {
                        if (p.getR() == r && p.getC() == c && p.getGrowth() > 0.15) {
                            double bite = Math.min(p.getGrowth() * 0.6, 0.25);
                            p.setGrowth(Math.max(0.08, p.getGrowth() - bite));
                            p.setHasFruit(false);
                            double calories = (bite / 0.25) * 18.0;
                            animal.setEnergy(animal.getEnergy() + calories * animal.getPlant());
                            animal.setVx(animal.getVx() * 0.1);
                            animal.setVy(animal.getVy() * 0.1);
                            break;
                        }
                    }
                }
            }
        }

        // 5. Remove mortos e gera carcaças com clamping seguro
        for (Animal dead : deadAnimals) {
            animals.remove(dead);
            int r = Math.max(0, Math.min(rows - 1, (int) (dead.getY() / 26.0)));
            int c = Math.max(0, Math.min(cols - 1, (int) (dead.getX() / 26.0)));
            carcasses.add(new Carcass(UUID.randomUUID().toString(), dead.getX(), dead.getY(), r, c, 25.0 + dead.getSize() * 50.0));
        }
    }

    public void addAnimal(Animal a) { animals.add(a); }
    public void addPlant(Plant p) { plants.add(p); }

    public Season getCurrentSeason() { return currentSeason; }
    public int getGeneration() { return generation; }
    public int getTotalTicks() { return totalTicks; }
    public List<Animal> getAnimals() { return animals; }
    public List<Plant> getPlants() { return plants; }
    public List<Carcass> getCarcasses() { return carcasses; }
    public GridCell[][] getGrid() { return grid; }
}