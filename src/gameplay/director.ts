import type { Player } from './player';
import type { EnemyField } from './enemies';
import { BOSS_TIME, WAVE_TIERS, type WaveTier } from '../data/enemies';

export class Director {
  time = 0;
  private spawnTimer = 2;
  private eliteTimer = 0;
  private bossSpawned = false;
  private boss: import('./enemies').Enemy | null = null;
  spawnedTotal = 0;

  reset(): void {
    this.time = 0;
    this.spawnTimer = 2;
    this.eliteTimer = 0;
    this.bossSpawned = false;
    this.boss = null;
    this.spawnedTotal = 0;
  }

  get bossAlive(): boolean {
    return this.boss !== null && this.boss.hp > 0;
  }

  get bossRef(): import('./enemies').Enemy | null {
    return this.boss;
  }

  private tier(): WaveTier {
    for (const t of WAVE_TIERS) {
      if (this.time >= t.from && this.time < t.to) return t;
    }
    return WAVE_TIERS[WAVE_TIERS.length - 1];
  }

  update(dt: number, player: Player, field: EnemyField, rng: () => number): void {
    this.time += dt;
    const tier = this.tier();
    const hpMul = 1 + this.time / 220;
    const px = player.position.x;
    const pz = player.position.z;

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = tier.interval;
      const budget = tier.batch + Math.floor(this.time / 90);
      for (let i = 0; i < budget; i++) {
        const a = rng() * Math.PI * 2;
        const r = 26 + rng() * 14;
        const kindId = tier.kinds[Math.floor(rng() * tier.kinds.length)];
        const e = field.spawn(px + Math.cos(a) * r, pz + Math.sin(a) * r, rng, kindId);
        if (e) {
          e.hp *= hpMul;
          e.maxHp = e.hp;
          this.spawnedTotal++;
        }
      }
    }

    if (tier.eliteEvery > 0) {
      this.eliteTimer -= dt;
      if (this.eliteTimer <= 0) {
        this.eliteTimer = tier.eliteEvery;
        const a = rng() * Math.PI * 2;
        const r = 30 + rng() * 8;
        const e = field.spawn(px + Math.cos(a) * r, pz + Math.sin(a) * r, rng, 'knight');
        if (e) {
          e.hp *= hpMul;
          e.maxHp = e.hp;
        }
      }
    }

    if (!this.bossSpawned && this.time >= BOSS_TIME) {
      this.bossSpawned = true;
      const a = rng() * Math.PI * 2;
      const e = field.spawn(px + Math.cos(a) * 26, pz + Math.sin(a) * 26, rng, 'knight', 2.6);
      if (e) {
        e.hp = 4200;
        e.maxHp = 4200;
        e.kind = { ...e.kind, speed: 3.6, contactDps: 40, xp: 120 };
        this.boss = e;
      }
    }
  }
}
