import * as THREE from 'three';
import { terrainHeight } from '../rendering/terrain';
import { dampAngle } from '../core/mathx';
import { ENEMY } from '../data/config';
import { ENEMY_KINDS, type EnemyKind } from '../data/enemies';
import type { InstancedSource } from '../rendering/assets';

export type Enemy = {
  x: number;
  z: number;
  prevX: number;
  prevZ: number;
  vx: number;
  vz: number;
  sx: number;
  sz: number;
  kx: number;
  kz: number;
  hp: number;
  maxHp: number;
  flash: number;
  slow: number;
  scale: number;
  face: number;
  kind: EnemyKind;
};

const CELL = 2.2;
const SEP_STRENGTH = 1.15;

function cellKey(cx: number, cz: number): number {
  return (Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663)) | 0;
}

export class EnemyField {
  readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh | null = null;
  private dummy = new THREE.Object3D();
  private grid = new Map<number, number[]>();
  private color = new THREE.Color();
  readonly enemies: Enemy[] = [];
  private time = 0;
  contactDps = 0;
  private maxCapacity = 900;

  setModel(source: InstancedSource, capacity: number): void {
    this.createMesh(source.geometry, source.material, capacity);
  }

  setFallback(capacity: number): void {
    const geometry = new THREE.CapsuleGeometry(ENEMY.radius, ENEMY.cylinder, 4, 8);
    geometry.translate(0, ENEMY.radius + ENEMY.cylinder * 0.5, 0);
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
    this.createMesh(geometry, material, capacity);
  }

  private createMesh(geometry: THREE.BufferGeometry, material: THREE.Material, capacity: number): void {
    this.maxCapacity = capacity;
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.name = 'enemies';
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = false;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.dummy.position.set(0, -999, 0);
    this.dummy.scale.setScalar(0.001);
    this.dummy.updateMatrix();
    for (let i = 0; i < capacity; i++) this.mesh.setMatrixAt(i, this.dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.mesh);
  }

  spawnRing(
    count: number,
    cx: number,
    cz: number,
    minR: number,
    maxR: number,
    rng: () => number,
    kindIds: string[] = ['wolf'],
  ): void {
    for (let i = 0; i < count; i++) {
      const a = rng() * Math.PI * 2;
      const r = minR + rng() * (maxR - minR);
      const kindId = kindIds[Math.floor(rng() * kindIds.length)];
      this.spawn(cx + Math.cos(a) * r, cz + Math.sin(a) * r, rng, kindId);
    }
  }

  spawn(x: number, z: number, rng: () => number, kindId = 'wolf', scaleMul = 1): Enemy | null {
    if (this.enemies.length >= this.maxCapacity - 1) return null;
    const kind = ENEMY_KINDS[kindId] ?? ENEMY_KINDS.wolf;
    const hp = kind.hp;
    const e: Enemy = {
      x,
      z,
      prevX: x,
      prevZ: z,
      vx: 0,
      vz: 0,
      sx: 0,
      sz: 0,
      kx: 0,
      kz: 0,
      hp,
      maxHp: hp,
      flash: 0,
      slow: 0,
      scale: kind.scale * scaleMul * (0.94 + rng() * 0.12),
      face: rng() * Math.PI * 2,
      kind,
    };
    this.enemies.push(e);
    return e;
  }

  get count(): number {
    return this.enemies.length;
  }

  get renderCount(): number {
    return this.mesh ? this.mesh.count : -1;
  }

  private lastTargetX = 0;
  private lastTargetZ = 0;

  get nearestDistance(): number {
    let best = Infinity;
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - this.lastTargetX, e.z - this.lastTargetZ);
      if (d < best) best = d;
    }
    return best;
  }

  get avgSpeed(): number {
    if (this.enemies.length === 0) return 0;
    let sum = 0;
    for (const e of this.enemies) sum += Math.hypot(e.vx, e.vz);
    return sum / this.enemies.length;
  }

  get firstEnemy(): string {
    const e = this.enemies[0];
    if (!e) return 'none';
    return `${e.kind.id} x=${e.x.toFixed(1)} z=${e.z.toFixed(1)} hp=${e.hp.toFixed(0)}`;
  }

  damageArea(
    x: number,
    z: number,
    radius: number,
    damage: number,
    knockback: number,
    onHit: (e: Enemy, dist: number) => void,
  ): number {
    let hits = 0;
    for (const e of this.enemies) {
      const dx = e.x - x;
      const dz = e.z - z;
      const dist = Math.hypot(dx, dz);
      if (dist > radius + e.kind.radius) continue;
      const kd = dist || 1;
      e.kx += (dx / kd) * knockback;
      e.kz += (dz / kd) * knockback;
      e.hp -= damage;
      e.flash = 1;
      hits++;
      onHit(e, dist);
    }
    return hits;
  }

  applySlow(x: number, z: number, radius: number, amount: number): number {
    let hits = 0;
    for (const e of this.enemies) {
      const dist = Math.hypot(e.x - x, e.z - z);
      if (dist > radius + e.kind.radius) continue;
      e.slow = Math.max(e.slow, amount);
      hits++;
    }
    return hits;
  }

  update(dt: number, targetX: number, targetZ: number, alpha = 1): void {
    this.time += dt;
    this.lastTargetX = targetX;
    this.lastTargetZ = targetZ;
    const list = this.enemies;
    const n = list.length;

    for (let i = n - 1; i >= 0; i--) {
      if (list[i].hp <= 0) {
        const last = list.pop() as Enemy;
        if (i < list.length) list[i] = last;
      }
    }

    if (!this.mesh || list.length === 0) {
      if (this.mesh) this.mesh.count = 0;
      this.contactDps = 0;
      return;
    }

    const alive = list.length;
    this.grid.clear();
    for (let i = 0; i < alive; i++) {
      const e = list[i];
      const key = cellKey(Math.floor(e.x / CELL), Math.floor(e.z / CELL));
      const bucket = this.grid.get(key);
      if (bucket) bucket.push(i);
      else this.grid.set(key, [i]);
    }

    const sepSq = ENEMY.separation * ENEMY.separation;
    for (let i = 0; i < alive; i++) {
      const e = list[i];
      const cx = Math.floor(e.x / CELL);
      const cz = Math.floor(e.z / CELL);
      let sx = 0;
      let sz = 0;
      for (let ox = -1; ox <= 1; ox++) {
        for (let oz = -1; oz <= 1; oz++) {
          const bucket = this.grid.get(cellKey(cx + ox, cz + oz));
          if (!bucket) continue;
          for (let b = 0; b < bucket.length; b++) {
            const j = bucket[b];
            if (j === i) continue;
            const o = list[j];
            const dx = e.x - o.x;
            const dz = e.z - o.z;
            const d2 = dx * dx + dz * dz;
            if (d2 > sepSq || d2 < 0.00001) continue;
            const d = Math.sqrt(d2);
            const w = (1 - d / ENEMY.separation) / d;
            sx += dx * w;
            sz += dz * w;
          }
        }
      }
      e.sx = sx;
      e.sz = sz;
    }

    for (let i = 0; i < alive; i++) {
      const item = list[i];
      const sepLen = Math.hypot(item.sx, item.sz);
      if (sepLen > 0.0001) {
        const ramp = Math.min(sepLen, 1);
        item.sx = (item.sx / sepLen) * ramp;
        item.sz = (item.sz / sepLen) * ramp;
      }
    }

    let dps = 0;
    for (let i = 0; i < alive; i++) {
      const e = list[i];
      e.prevX = e.x;
      e.prevZ = e.z;
      let dx = targetX - e.x;
      let dz = targetZ - e.z;
      const dist = Math.hypot(dx, dz) || 1;
      dx /= dist;
      dz /= dist;
      const stop = dist < 1.02 ? 0 : 1;
      const slowMul = 1 - e.slow;
      const speed = e.kind.speed * slowMul;
      e.vx = dx * speed * stop + e.sx * SEP_STRENGTH;
      e.vz = dz * speed * stop + e.sz * SEP_STRENGTH;
      const damp = Math.exp(-ENEMY.knockDamping * dt);
      e.kx *= damp;
      e.kz *= damp;
      e.x += (e.vx + e.kx) * dt;
      e.z += (e.vz + e.kz) * dt;
      e.slow *= Math.exp(-1.6 * dt);
      if (e.slow < 0.001) e.slow = 0;
      if (e.flash > 0) e.flash = Math.max(0, e.flash - dt * 4.5);
      const limit = 150;
      if (e.x > limit) e.x = limit;
      if (e.x < -limit) e.x = -limit;
      if (e.z > limit) e.z = limit;
      if (e.z < -limit) e.z = -limit;
      if (dist < e.kind.radius + 0.95) dps += e.kind.contactDps;
    }
    this.contactDps = dps;

    this.mesh.count = alive;
    const smooth = Math.min(1, dt * 12);
    for (let i = 0; i < alive; i++) {
      const e = list[i];
      const rx = e.prevX + (e.x - e.prevX) * alpha;
      const rz = e.prevZ + (e.z - e.prevZ) * alpha;
      const mvx = e.x - e.prevX;
      const mvz = e.z - e.prevZ;
      if (mvx * mvx + mvz * mvz > 1e-6) {
        e.face = dampAngle(e.face, Math.atan2(-mvx, -mvz), 10, dt);
      }
      const hop = e.kind.id === 'wisp' ? 3 : 1;
      const bob = Math.sin(this.time * (6 + e.kind.speed) + i * 1.7) * 0.04 * hop;
      const y = terrainHeight(rx, rz) + bob;
      this.dummy.position.set(rx, y, rz);
      this.dummy.rotation.set(0, e.face, 0);
      this.dummy.scale.setScalar(e.scale);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      const boost = 1 + e.flash * 2.6;
      const slowTint = e.slow > 0 ? 0.75 + e.slow * 0.4 : 1;
      this.color.setHex(e.kind.tint);
      this.color.multiplyScalar(boost * slowTint);
      this.mesh.setColorAt(i, this.color);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    void smooth;
  }

  clear(): void {
    this.enemies.length = 0;
    if (this.mesh) this.mesh.count = 0;
  }
}
