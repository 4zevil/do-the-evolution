// ====================================================
//  ENTITY.JS — Entidade base no plano 2D (POO)
// ====================================================

/**
 * Entidade base no plano 2D.
 */
export class Entity {
  constructor(id, x, y) {
    this.id = id || ('ent_' + Math.random().toString(36).substr(2, 9));
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.alive = true;
  }

  distanceTo(other) {
    return Math.hypot(this.x - other.x, this.y - other.y);
  }

  clampToBounds(margin, maxX, maxY) {
    if (this.x < margin) { this.x = margin; this.vx *= -1; }
    if (this.x > maxX)   { this.x = maxX;   this.vx *= -1; }
    if (this.y < margin) { this.y = margin; this.vy *= -1; }
    if (this.y > maxY)   { this.y = maxY;   this.vy *= -1; }
  }
}
