import * as THREE from 'three';
import { terrainHeight } from '../rendering/terrain';

type Orb = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  value: number;
  life: number;
  active: boolean;
  phase: number;
};

export class Pickups {
  readonly mesh: THREE.InstancedMesh;
  private orbs: Orb[] = [];
  private dummy = new THREE.Object3D();
  private capacity: number;
  private cursor = 0;
  private time = 0;

  constructor(capacity = 700) {
    this.capacity = capacity;
    const geometry = new THREE.OctahedronGeometry(0.17, 0);
    const material = new THREE.MeshStandardMaterial({
      color: 0xbfe8ff,
      emissive: 0x3d9bff,
      emissiveIntensity: 2.6,
      roughness: 0.2,
      metalness: 0.1,
    });
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.name = 'xp-orbs';
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = capacity;
    for (let i = 0; i < capacity; i++) {
      this.orbs.push({ x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, value: 1, life: 0, active: false, phase: 0 });
      this.dummy.position.set(0, -999, 0);
      this.dummy.scale.setScalar(0.001);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  spawn(x: number, z: number, value: number, rng: () => number): void {
    const orb = this.orbs[this.cursor];
    this.cursor = (this.cursor + 1) % this.capacity;
    orb.x = x;
    orb.z = z;
    orb.y = terrainHeight(x, z) + 0.45;
    const a = rng() * Math.PI * 2;
    const s = 1.4 + rng() * 1.6;
    orb.vx = Math.cos(a) * s;
    orb.vz = Math.sin(a) * s;
    orb.vy = 3.4 + rng() * 2.2;
    orb.value = value;
    orb.life = 26;
    orb.active = true;
    orb.phase = rng() * Math.PI * 2;
  }

  get activeCount(): number {
    let n = 0;
    for (const o of this.orbs) if (o.active) n++;
    return n;
  }

  update(
    dt: number,
    playerX: number,
    playerY: number,
    playerZ: number,
    pickupRadius: number,
    onCollect: (value: number, x: number, y: number, z: number) => void,
  ): void {
    this.time += dt;
    const magnet = pickupRadius;
    const magnetSq = magnet * magnet;
    for (let i = 0; i < this.capacity; i++) {
      const o = this.orbs[i];
      if (!o.active) continue;
      o.life -= dt;
      if (o.life <= 0) {
        o.active = false;
        this.dummy.position.set(0, -999, 0);
        this.dummy.scale.setScalar(0.001);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(i, this.dummy.matrix);
        continue;
      }
      const dx = playerX - o.x;
      const dy = playerY + 0.9 - o.y;
      const dz = playerZ - o.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < magnetSq) {
        const d = Math.sqrt(d2) || 0.001;
        const pull = 52 * (1 - d / magnet) + 16;
        o.vx += (dx / d) * pull * dt;
        o.vz += (dz / d) * pull * dt;
        o.vy += (dy / 1.5) * pull * dt * 0.55;
      } else {
        o.vy -= 16 * dt;
      }
      const drag = Math.exp(-2.6 * dt);
      o.vx *= drag;
      o.vz *= drag;
      o.vy *= drag;
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      o.z += o.vz * dt;
      const ground = terrainHeight(o.x, o.z) + 0.34;
      if (o.y < ground) {
        o.y = ground;
        o.vy = Math.abs(o.vy) * 0.34;
      }
      const distToPlayer = Math.hypot(playerX - o.x, playerZ - o.z);
      if (distToPlayer < 0.95) {
        o.active = false;
        this.dummy.position.set(0, -999, 0);
        this.dummy.scale.setScalar(0.001);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(i, this.dummy.matrix);
        onCollect(o.value, o.x, o.y, o.z);
        continue;
      }
      const bob = Math.sin(this.time * 3.1 + o.phase) * 0.09;
      this.dummy.position.set(o.x, o.y + bob, o.z);
      this.dummy.rotation.set(0, this.time * 2.4 + o.phase, 0.3);
      const scale = 1 + Math.sin(this.time * 5.5 + o.phase) * 0.09;
      this.dummy.scale.setScalar(scale);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
