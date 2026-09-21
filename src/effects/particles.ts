import * as THREE from 'three';

type Particle = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  gravity: number;
  drag: number;
  r: number;
  g: number;
  b: number;
  alive: boolean;
};

function dotTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.7)');
  grad.addColorStop(0.65, 'rgba(255,255,255,0.18)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export type SpawnOptions = {
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
  life?: number;
  size?: number;
  gravity?: number;
  drag?: number;
  color?: number;
  spread?: number;
  speed?: number;
};

export class Particles {
  readonly mesh: THREE.InstancedMesh;
  private pool: Particle[] = [];
  private dummy = new THREE.Object3D();
  private scratch = new THREE.Color();
  private cursor = 0;
  private capacity: number;

  constructor(capacity = 1500) {
    this.capacity = capacity;
    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({
      map: dotTexture(),
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, capacity);
    this.mesh.name = 'particles';
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = capacity;

    const color = new THREE.Color(0xffffff);
    for (let i = 0; i < capacity; i++) {
      this.pool.push({
        x: 0, y: -9999, z: 0, vx: 0, vy: 0, vz: 0,
        life: 0, maxLife: 1, size: 1, gravity: 0, drag: 1,
        r: 1, g: 1, b: 1, alive: false,
      });
      this.dummy.position.set(0, -9999, 0);
      this.dummy.scale.setScalar(0.0001);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, color);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  spawnBatch(opts: SpawnOptions, count: number, rng: () => number): void {
    const spread = opts.spread ?? 0.35;
    const speed = opts.speed ?? 3;
    for (let i = 0; i < count; i++) {
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(1 - 2 * rng());
      const dirX = Math.sin(phi) * Math.cos(theta);
      const dirY = Math.abs(Math.cos(phi)) * 0.9 + 0.25;
      const dirZ = Math.sin(phi) * Math.sin(theta);
      const s = speed * (0.45 + rng() * 0.9);
      this.spawn({
        x: opts.x + (rng() - 0.5) * spread,
        y: opts.y + (rng() - 0.5) * spread,
        z: opts.z + (rng() - 0.5) * spread,
        vx: (opts.vx ?? 0) + dirX * s,
        vy: (opts.vy ?? 0) + dirY * s,
        vz: (opts.vz ?? 0) + dirZ * s,
        life: (opts.life ?? 0.5) * (0.7 + rng() * 0.6),
        size: (opts.size ?? 0.2) * (0.7 + rng() * 0.7),
        gravity: opts.gravity ?? 9,
        drag: opts.drag ?? 2.2,
        color: opts.color,
      });
    }
  }

  spawn(opts: SpawnOptions): void {
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.capacity;
    const color = new THREE.Color(opts.color ?? 0xffffff);
    p.x = opts.x;
    p.y = opts.y;
    p.z = opts.z;
    p.vx = opts.vx ?? 0;
    p.vy = opts.vy ?? 0;
    p.vz = opts.vz ?? 0;
    p.maxLife = opts.life ?? 0.5;
    p.life = p.maxLife;
    p.size = opts.size ?? 0.2;
    p.gravity = opts.gravity ?? 9;
    p.drag = opts.drag ?? 2.2;
    p.r = color.r;
    p.g = color.g;
    p.b = color.b;
    p.alive = true;
  }

  update(dt: number, camera: THREE.Camera): void {
    const dummy = this.dummy;
    for (let i = 0; i < this.capacity; i++) {
      const p = this.pool[i];
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        dummy.position.set(0, -9999, 0);
        dummy.scale.setScalar(0.0001);
        dummy.updateMatrix();
        this.mesh.setMatrixAt(i, dummy.matrix);
        continue;
      }
      const drag = Math.exp(-p.drag * dt);
      p.vx *= drag;
      p.vz *= drag;
      p.vy = p.vy * drag - p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const t = p.life / p.maxLife;
      const scale = p.size * (0.35 + t * 0.85);
      dummy.position.set(p.x, p.y, p.z);
      dummy.quaternion.copy(camera.quaternion);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
      this.scratch.setRGB(p.r * t, p.g * t, p.b * t);
      this.mesh.setColorAt(i, this.scratch);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
