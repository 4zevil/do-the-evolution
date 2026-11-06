package com.evolucao.model;

/**
 * Entidade base no espaço bidimensional da simulação.
 * Estabelece contrato de posição, cinemática, ciclo vital e despacho polimórfico.
 */
public abstract class Entity {
    protected final String id;
    protected double x;
    protected double y;
    protected double vx;
    protected double vy;
    protected boolean alive;

    public Entity(String id, double x, double y) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.vx = 0.0;
        this.vy = 0.0;
        this.alive = true;
    }

    /**
     * Atualização de ciclo vital da entidade regida pelo ambiente e estação.
     */
    public abstract void tick(Season season, GridCell cell);

    public String getId() { return id; }
    public double getX() { return x; }
    public void setX(double x) { this.x = x; }
    public double getY() { return y; }
    public void setY(double y) { this.y = y; }
    public double getVx() { return vx; }
    public void setVx(double vx) { this.vx = vx; }
    public double getVy() { return vy; }
    public void setVy(double vy) { this.vy = vy; }
    public boolean isAlive() { return alive; }
    public void setAlive(boolean alive) { this.alive = alive; }

    public double distanceTo(Entity other) {
        return Math.hypot(this.x - other.x, this.y - other.y);
    }
}
