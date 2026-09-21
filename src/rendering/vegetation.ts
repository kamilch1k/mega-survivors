import * as THREE from 'three';
import { lerp } from '../core/mathx';
import { VEGETATION, WORLD } from '../data/config';
import { broadLeafMask, flowerMask, tallGrassMask } from '../data/masks';

const TILE = 12;

type LayerConfig = {
  name: string;
  count: number;
  rings: { radius: number; density: number }[];
  cardWidth: number;
  cardHeight: number;
  heightJitter: number;
  colorA: number;
  colorB: number;
  stiffness: number;
  flattenMin: number;
  mask?: (x: number, z: number) => number;
  clearSpawn?: number;
  seed: number;
};

function bladeTexture(kind: 'blade' | 'plume' | 'flower' | 'leaf'): THREE.Texture {
  const w = 128;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);

  if (kind === 'blade') {
    ctx.shadowColor = 'rgba(124,164,72,0.6)';
    ctx.shadowBlur = 4;
    for (let i = 0; i < 46; i++) {
      const baseX = (i / 45) * w + (Math.random() - 0.5) * 9;
      const height = h * (0.45 + Math.random() * 0.55);
      const width = 3.6 + Math.random() * 4.2;
      const bend = (Math.random() - 0.5) * 40;
      const grad = ctx.createLinearGradient(0, h, 0, h - height);
      grad.addColorStop(0, 'rgba(84,118,46,1)');
      grad.addColorStop(0.35, 'rgba(126,164,68,1)');
      grad.addColorStop(0.7, 'rgba(168,200,98,1)');
      grad.addColorStop(1, 'rgba(214,232,150,1)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(baseX - width * 0.5, h);
      ctx.quadraticCurveTo(baseX - width * 0.24 + bend * 0.5, h - height * 0.55, baseX + bend, h - height);
      ctx.quadraticCurveTo(baseX + width * 0.24 + bend * 0.5, h - height * 0.55, baseX + width * 0.5, h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  } else if (kind === 'plume') {
    for (let i = 0; i < 11; i++) {
      const baseX = w * 0.12 + (i / 10) * w * 0.76;
      const bend = (baseX - w * 0.5) * 0.75 + (Math.random() - 0.5) * 16;
      const topY = h * (0.03 + Math.random() * 0.2);
      ctx.strokeStyle = 'rgba(172,164,124,0.9)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(w * 0.5, h);
      ctx.quadraticCurveTo(baseX + bend * 0.35, h * 0.5, baseX + bend, topY);
      ctx.stroke();

      for (let f = 0; f < 34; f++) {
        const t = 0.28 + (f / 33) * 0.72;
        const px = lerp(w * 0.5, baseX + bend, t);
        const py = lerp(h, topY, t);
        const spread = (1 - t) * 10 + 5;
        const fx = px + (Math.random() - 0.5) * spread;
        const fy = py + (Math.random() - 0.5) * 9;
        const a = 0.5 + Math.random() * 0.42;
        ctx.fillStyle = `rgba(${236 + Math.random() * 19},${232 + Math.random() * 18},${208 + Math.random() * 24},${a})`;
        ctx.beginPath();
        ctx.ellipse(fx, fy, 3.6 + Math.random() * 4.4, 1.5 + Math.random() * 1.5, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (let i = 0; i < 7; i++) {
      const baseX = w * 0.1 + Math.random() * w * 0.8;
      const grad = ctx.createLinearGradient(0, h, 0, h * 0.4);
      grad.addColorStop(0, 'rgba(72,96,40,0.9)');
      grad.addColorStop(1, 'rgba(150,164,92,0.3)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(baseX - 2.6, h);
      ctx.quadraticCurveTo(baseX - 1 + (Math.random() - 0.5) * 26, h * 0.7, baseX + (Math.random() - 0.5) * 34, h * 0.4);
      ctx.quadraticCurveTo(baseX + 1.5, h * 0.7, baseX + 2.6, h);
      ctx.closePath();
      ctx.fill();
    }
  } else if (kind === 'leaf') {
    for (let i = 0; i < 6; i++) {
      const cx = w * 0.16 + Math.random() * w * 0.68;
      const cy = h * (0.42 + Math.random() * 0.34);
      const r = 9 + Math.random() * 11;
      const grad = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r);
      grad.addColorStop(0, 'rgba(104,134,58,0.95)');
      grad.addColorStop(1, 'rgba(58,80,34,0.85)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r * 0.62, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(44,62,26,0.8)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.8, cy + r * 0.2);
      ctx.lineTo(cx + r * 0.8, cy - r * 0.2);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(84,112,48,0.9)';
    ctx.lineWidth = 2.2;
    for (let i = 0; i < 6; i++) {
      const cx = w * 0.16 + Math.random() * w * 0.68;
      ctx.beginPath();
      ctx.moveTo(cx, h);
      ctx.quadraticCurveTo(cx + 5, h * 0.74, cx - 3, h * 0.52);
      ctx.stroke();
    }
  } else {
    for (let i = 0; i < 9; i++) {
      const cx = w * 0.16 + Math.random() * w * 0.68;
      const cy = h * (0.34 + Math.random() * 0.42);
      const r = 4.5 + Math.random() * 6;
      ctx.fillStyle = i % 3 === 0 ? 'rgba(206,172,240,1)' : 'rgba(154,108,214,1)';
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.6, r * 0.62, r * 0.5, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(244,228,255,1)';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.32, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(92,126,54,0.95)';
    ctx.lineWidth = 1.8;
    for (let i = 0; i < 8; i++) {
      const cx = w * 0.16 + Math.random() * w * 0.68;
      ctx.beginPath();
      ctx.moveTo(cx, h);
      ctx.quadraticCurveTo(cx + 5, h * 0.7, cx - 4, h * 0.48);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function crossedCard(width: number, height: number): THREE.BufferGeometry {
  const w = width * 0.5;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array([
    -w, 0, 0, w, 0, 0, w, height, 0, -w, height, 0,
    0, 0, -w, 0, 0, w, 0, height, w, 0, height, -w,
  ]);
  const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1]);
  const normals = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]);
  const height01 = new Float32Array([0, 0, 1, 1, 0, 0, 1, 1]);
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('aHeight01', new THREE.BufferAttribute(height01, 1));
  geo.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  return geo;
}

export class GrassLayer {
  readonly mesh: THREE.InstancedMesh;
  readonly config: LayerConfig;
  timeUniform: { value: number };
  playerUniform: { value: THREE.Vector3 };
  private tiles = new Map<string, number[]>();
  private free: number[] = [];
  private phase: Float32Array;
  private bend: Float32Array;
  private dummy = new THREE.Object3D();
  private colorA: THREE.Color;
  private colorB: THREE.Color;

  constructor(config: LayerConfig) {
    this.config = config;
    const geo = crossedCard(config.cardWidth, config.cardHeight);
    this.phase = new Float32Array(config.count);
    this.bend = new Float32Array(config.count);
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(this.phase, 1));
    geo.setAttribute('aBend', new THREE.InstancedBufferAttribute(this.bend, 1));

    const material = new THREE.MeshLambertMaterial({
      map: bladeTexture(
        config.name === 'tall' ? 'plume' : config.name === 'flower' ? 'flower' : config.name === 'broadleaf' ? 'leaf' : 'blade',
      ),
      alphaTest: config.name === 'tall' ? 0.18 : 0.22,
      side: THREE.DoubleSide,
      transparent: false,
      depthWrite: true,
    });

    const timeUniform = { value: 0 };
    const playerUniform = { value: new THREE.Vector3() };
    this.timeUniform = timeUniform;
    this.playerUniform = playerUniform;
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uWindTime = timeUniform;
      shader.uniforms.uPlayerPos = playerUniform;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform float uWindTime;
           uniform vec3 uPlayerPos;
           attribute float aHeight01;
           attribute float aPhase;
           attribute float aBend;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           {
             vec3 ipos = instanceMatrix[3].xyz;
             vec3 seg = uPlayerPos - cameraPosition;
             float segT = clamp(dot(ipos - cameraPosition, seg) / max(dot(seg, seg), 0.001), 0.0, 1.0);
             float dLine = distance(ipos, cameraPosition + seg * segT);
             float dPlayer = distance(ipos, uPlayerPos);
             float dCam = distance(ipos, cameraPosition);
             float open_ = smoothstep(0.0, 5.5, dCam);
             open_ = max(open_, smoothstep(1.0, 3.4, min(dLine, dPlayer)));
             transformed.y *= mix(${config.flattenMin.toFixed(3)}, 1.0, open_);
             float t = uWindTime;
             float gust = sin(t * 0.29 + aPhase * 0.31) * 0.5 + 0.5;
             float sway = sin(t * 1.55 + aPhase) * 0.55 + sin(t * 2.7 + aPhase * 1.7) * 0.24;
             float amp = aHeight01 * aHeight01 * aBend * (0.55 + gust * 1.05) * mix(0.3, 1.0, open_);
             transformed.x += sway * amp;
             transformed.z += sway * amp * 0.42;
           }`,
        );
    };

    this.mesh = new THREE.InstancedMesh(geo, material, config.count);
    this.mesh.name = `grass-${config.name}`;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.count = config.count;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    this.colorA = new THREE.Color(config.colorA);
    this.colorB = new THREE.Color(config.colorB);

    for (let i = 0; i < config.count; i++) {
      this.free.push(config.count - 1 - i);
      this.dummy.position.set(0, -999, 0);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.setScalar(0.001);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, this.colorA);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(playerX: number, playerY: number, playerZ: number, time: number): void {
    this.timeUniform.value = time;
    this.playerUniform.value.set(playerX, playerY, playerZ);
    const maxR = this.config.rings[this.config.rings.length - 1].radius;
    const t0 = Math.floor((playerX - maxR) / TILE);
    const t1 = Math.floor((playerX + maxR) / TILE);
    const s0 = Math.floor((playerZ - maxR) / TILE);
    const s1 = Math.floor((playerZ + maxR) / TILE);

    const wanted = new Set<string>();
    const missing: { key: string; tx: number; tz: number; dist: number }[] = [];

    for (let tx = t0; tx <= t1; tx++) {
      for (let tz = s0; tz <= s1; tz++) {
        const cx = tx * TILE + TILE * 0.5;
        const cz = tz * TILE + TILE * 0.5;
        const dist = Math.hypot(cx - playerX, cz - playerZ);
        if (dist > maxR) continue;
        const key = `${tx},${tz}`;
        wanted.add(key);
        if (!this.tiles.has(key)) missing.push({ key, tx, tz, dist });
      }
    }

    let dirty = false;

    if (this.tiles.size !== wanted.size || missing.length > 0) {
      for (const [key, slots] of this.tiles) {
        if (wanted.has(key)) continue;
        for (const s of slots) {
          this.dummy.position.set(0, -999, 0);
          this.dummy.rotation.set(0, 0, 0);
          this.dummy.scale.setScalar(0.001);
          this.dummy.updateMatrix();
          this.mesh.setMatrixAt(s, this.dummy.matrix);
          this.free.push(s);
        }
        this.tiles.delete(key);
      }
      dirty = true;
    }

    if (missing.length > 0) {
      missing.sort((a, b) => a.dist - b.dist);
      for (const tile of missing) {
        const ring = this.config.rings.find((r) => tile.dist <= r.radius);
        if (!ring) continue;
        const count = Math.round(ring.density * TILE * TILE);
        if (count <= 0) continue;
        const slots = this.allocate(count);
        if (slots.length === 0) break;
        this.fillTile(tile.key, tile.tx, tile.tz, slots);
        dirty = true;
      }
    }

    if (dirty) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
  }

  private allocate(count: number): number[] {
    const out: number[] = [];
    for (let i = 0; i < count; i++) {
      const slot = this.free.pop();
      if (slot === undefined) break;
      out.push(slot);
    }
    return out;
  }

  private tileRng(tx: number, tz: number): () => number {
    let s = (Math.imul(tx, 73856093) ^ Math.imul(tz, 19349663) ^ this.config.seed) >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  private fillTile(key: string, tx: number, tz: number, slots: number[]): void {
    const rng = this.tileRng(tx, tz);
    const cfg = this.config;
    const color = new THREE.Color();
    const accepted: number[] = [];
    for (const slot of slots) {
      const x = tx * TILE + rng() * TILE;
      const z = tz * TILE + rng() * TILE;
      if (cfg.clearSpawn && Math.hypot(x, z) < cfg.clearSpawn) {
        this.free.push(slot);
        continue;
      }
      if (cfg.mask && rng() > cfg.mask(x, z)) {
        this.free.push(slot);
        continue;
      }
      const scale = 1 + (rng() - 0.5) * cfg.heightJitter;
      this.dummy.position.set(x, 0, z);
      this.dummy.rotation.set((rng() - 0.5) * 0.3, rng() * Math.PI * 2, (rng() - 0.5) * 0.3);
      this.dummy.scale.set(1 + (rng() - 0.5) * 0.35, scale, 1);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(slot, this.dummy.matrix);
      this.phase[slot] = rng() * Math.PI * 2;
      this.bend[slot] = cfg.stiffness * (0.7 + rng() * 0.6);
      color.copy(this.colorA).lerp(this.colorB, rng()).multiplyScalar(0.88 + rng() * 0.3);
      this.mesh.setColorAt(slot, color);
      accepted.push(slot);
    }
    (this.mesh.geometry.getAttribute('aPhase') as THREE.InstancedBufferAttribute).needsUpdate = true;
    (this.mesh.geometry.getAttribute('aBend') as THREE.InstancedBufferAttribute).needsUpdate = true;
    this.tiles.set(key, accepted);
  }
}

export class Vegetation {
  readonly group = new THREE.Group();
  private layers: GrassLayer[];

  constructor() {
    const short = new GrassLayer({
      name: 'short',
      count: VEGETATION.shortGrass,
      rings: [
        { radius: 26, density: 4.0 },
        { radius: 55, density: 1.1 },
        { radius: 115, density: 0.22 },
      ],
      cardWidth: 0.8,
      cardHeight: 0.5,
      heightJitter: 0.5,
      colorA: 0x7fa04a,
      colorB: 0xbad086,
      stiffness: 0.1,
      flattenMin: 0.45,
      seed: 101,
    });

    const tall = new GrassLayer({
      name: 'tall',
      count: VEGETATION.tallGrass,
      rings: [
        { radius: 30, density: 1.6 },
        { radius: 62, density: 0.5 },
        { radius: 120, density: 0.12 },
      ],
      cardWidth: 0.95,
      cardHeight: 1.0,
      heightJitter: 0.55,
      colorA: 0xd8d3ae,
      colorB: 0xf7f3e4,
      stiffness: 0.2,
      flattenMin: 0.25,
      mask: tallGrassMask,
      clearSpawn: 6,
      seed: 202,
    });

    const flowers = new GrassLayer({
      name: 'flower',
      count: VEGETATION.flowers,
      rings: [
        { radius: 24, density: 1.0 },
        { radius: 55, density: 0.32 },
        { radius: 100, density: 0.08 },
      ],
      cardWidth: 0.5,
      cardHeight: 0.55,
      heightJitter: 0.5,
      colorA: 0xb98fe0,
      colorB: 0xecd8ff,
      stiffness: 0.05,
      flattenMin: 0.5,
      mask: flowerMask,
      seed: 303,
    });

    const broad = new GrassLayer({
      name: 'broadleaf',
      count: VEGETATION.broadleaf,
      rings: [
        { radius: 30, density: 0.14 },
        { radius: 70, density: 0.05 },
        { radius: 130, density: 0.02 },
      ],
      cardWidth: 1.0,
      cardHeight: 0.9,
      heightJitter: 0.55,
      colorA: 0x5d8a44,
      colorB: 0x95b866,
      stiffness: 0.07,
      flattenMin: 0.6,
      mask: broadLeafMask,
      seed: 404,
    });

    this.layers = [short, tall, flowers, broad];
    for (const layer of this.layers) this.group.add(layer.mesh);
  }

  update(playerX: number, playerY: number, playerZ: number, time: number): void {
    for (const layer of this.layers) layer.update(playerX, playerY, playerZ, time);
  }
}

export const MAP_LIMIT = WORLD.playableHalf;
