import type { Player } from './player';
import type { Enemy, EnemyField } from './enemies';
import type { Particles } from '../effects/particles';
import type { SlashArcs } from '../effects/slash';

export type CombatHooks = {
  hitstop: (seconds: number) => void;
  shake: (amount: number) => void;
  damageNumber: (x: number, y: number, z: number, amount: number, crit: boolean) => void;
  onKill: (e: Enemy) => void;
  heal: (amount: number) => void;
};

const SWING_TIME = 0.34;
const IMPACT_AT = 0.42;
const KNOCKBACK = 13;

type PendingEcho = { delay: number; facing: number; damageMul: number };

export class Combat {
  swing = -1;
  swingFacing = 0;
  cooldown = 0;
  attackTimer = 0;
  private impactDone = false;
  private echoes: PendingEcho[] = [];

  get swingProgress(): number {
    return this.swing;
  }

  reset(): void {
    this.swing = -1;
    this.attackTimer = 0;
    this.echoes.length = 0;
  }

  update(
    dt: number,
    player: Player,
    enemies: EnemyField,
    particles: Particles,
    slash: SlashArcs,
    hooks: CombatHooks,
    rng: () => number,
  ): void {
    if (this.swing < 0) {
      this.attackTimer += dt * player.attackSpeed;
      if (this.attackTimer >= 0.85) {
        const target = this.findTarget(player, enemies);
        if (target) {
          this.attackTimer = 0;
          this.swing = 0;
          this.impactDone = false;
          this.swingFacing = Math.atan2(-(target.x - player.position.x), -(target.z - player.position.z));
        }
      }
    } else {
      this.swing += dt / SWING_TIME;
      if (!this.impactDone && this.swing >= IMPACT_AT) {
        this.impactDone = true;
        this.performSweep(player, enemies, particles, slash, hooks, rng, this.swingFacing, 1);
        if (player.echoBlades > 0) {
          for (let i = 0; i < player.echoBlades; i++) {
            this.echoes.push({ delay: 0.11 * (i + 1), facing: this.swingFacing, damageMul: 0.6 });
          }
        }
      }
      if (this.swing >= 1) this.swing = -1;
    }

    for (let i = this.echoes.length - 1; i >= 0; i--) {
      const echo = this.echoes[i];
      echo.delay -= dt;
      if (echo.delay > 0) continue;
      this.performSweep(player, enemies, particles, slash, hooks, rng, echo.facing, echo.damageMul);
      this.echoes.splice(i, 1);
    }
  }

  private findTarget(player: Player, enemies: EnemyField): Enemy | null {
    let best: Enemy | null = null;
    let bestDist = player.attackRange * 1.7;
    const px = player.position.x;
    const pz = player.position.z;
    for (const e of enemies.enemies) {
      const d = Math.hypot(e.x - px, e.z - pz);
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best;
  }

  private performSweep(
    player: Player,
    enemies: EnemyField,
    particles: Particles,
    slash: SlashArcs,
    hooks: CombatHooks,
    rng: () => number,
    facing: number,
    damageMul: number,
  ): void {
    const px = player.position.x;
    const py = player.position.y;
    const pz = player.position.z;
    const range = player.attackRange;
    const halfArc = (0.72 + player.arcBonus * 0.5) * Math.PI;
    const fx = -Math.sin(facing);
    const fz = -Math.cos(facing);

    slash.trigger(px, py + 1.0, pz, facing, range / 3.6, 0.3);

    let hits = 0;
    let kills = 0;
    let lifesteal = 0;
    const dead: Enemy[] = [];

    for (const e of enemies.enemies) {
      const dx = e.x - px;
      const dz = e.z - pz;
      const dist = Math.hypot(dx, dz);
      if (dist > range + e.kind.radius) continue;
      const nxn = dx / (dist || 1);
      const nzn = dz / (dist || 1);
      const dot = nxn * fx + nzn * fz;
      const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
      if (angle > halfArc) continue;

      const crit = rng() < player.critChance;
      const dmg = player.damage * damageMul * (crit ? player.critMul : 1);
      const kd = dist || 1;
      e.kx += (dx / kd) * KNOCKBACK;
      e.kz += (dz / kd) * KNOCKBACK;
      e.hp -= dmg;
      e.flash = 1;
      hits++;
      lifesteal += dmg * player.lifesteal;

      hooks.damageNumber(e.x, py + 1.5 + e.kind.radius, e.z, dmg, crit);
      particles.spawnBatch(
        {
          x: e.x,
          y: py + 0.75,
          z: e.z,
          color: crit ? 0xffdc8a : 0x9fd8ff,
          spread: 0.35,
          speed: crit ? 5.5 : 4,
          life: crit ? 0.5 : 0.36,
          size: crit ? 0.26 : 0.18,
          gravity: 7,
        },
        crit ? 12 : 7,
        rng,
      );
      if (e.hp <= 0) {
        kills++;
        dead.push(e);
      }
    }

    if (hits > 0) {
      hooks.hitstop(kills > 0 ? 0.075 : 0.05);
      hooks.shake(kills > 0 ? 0.34 : 0.2);
      if (lifesteal > 0) hooks.heal(lifesteal);
      for (const e of dead) {
        particles.spawnBatch(
          {
            x: e.x,
            y: py + 0.7,
            z: e.z,
            color: e.kind.id === 'knight' ? 0xffb08a : 0x8fd0ff,
            spread: 0.4,
            speed: 7,
            life: 0.6,
            size: e.kind.id === 'knight' ? 0.4 : 0.24,
            gravity: 8,
          },
          e.kind.id === 'knight' ? 34 : 15,
          rng,
        );
        hooks.onKill(e);
      }
    }
  }
}
