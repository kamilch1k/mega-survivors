import * as THREE from 'three';
import { fbm, clamp, smoothstep, lerp } from '../core/mathx';
import { TERRAIN, WORLD } from '../data/config';
import { dryGrassMask, tallGrassMask } from '../data/masks';

const SEED = TERRAIN.noiseSeed;

type Hill = { x: number; z: number; h: number; r: number };

const HILLS: Hill[] = [
  { x: 74, z: -58, h: 12.5, r: 46 },
  { x: -92, z: 44, h: 8.4, r: 40 },
  { x: 34, z: 96, h: 6.2, r: 34 },
  { x: -24, z: -22, h: 3.1, r: 26 },
];

const DIPS: Hill[] = [
  { x: 8, z: 66, h: 3.8, r: 38 },
  { x: -48, z: -70, h: 3.0, r: 42 },
  { x: 62, z: 34, h: 2.4, r: 30 },
];

function bump(x: number, z: number, hill: Hill): number {
  const dx = x - hill.x;
  const dz = z - hill.z;
  const d2 = (dx * dx + dz * dz) / (hill.r * hill.r);
  return hill.h * Math.exp(-d2 * 1.35);
}

export function terrainHeight(x: number, z: number): number {
  let h = 0;
  h += (fbm(x * TERRAIN.baseFreq, z * TERRAIN.baseFreq, 4, SEED) - 0.5) * 2 * TERRAIN.baseAmp;
  h += (fbm(x * TERRAIN.detailFreq, z * TERRAIN.detailFreq, 3, SEED + 77) - 0.5) * 2 * TERRAIN.detailAmp;
  h += (fbm(x * 0.0043, z * 0.0043, 2, SEED + 311) - 0.5) * 2 * 3.4;

  for (const hill of HILLS) h += bump(x, z, hill);
  for (const dip of DIPS) h -= bump(x, z, dip);

  const dist = Math.hypot(x, z);
  const edge = smoothstep(TERRAIN.edgeStart, WORLD.half, dist);
  h += edge * edge * TERRAIN.edgeRise;

  const clearing = 1 - smoothstep(0, WORLD.spawnRadius * 0.85, dist);
  if (clearing > 0) {
    const flat = terrainFlatBase();
    h = lerp(h, flat, clearing * 0.6);
  }
  return h;
}

function terrainFlatBase(): number {
  let h = 0;
  h += (fbm(0, 0, 4, SEED) - 0.5) * 2 * TERRAIN.baseAmp;
  h += (fbm(0, 0, 3, SEED + 77) - 0.5) * 2 * TERRAIN.detailAmp;
  return h;
}

export function terrainNormal(x: number, z: number, out: THREE.Vector3): THREE.Vector3 {
  const e = 0.6;
  const hL = terrainHeight(x - e, z);
  const hR = terrainHeight(x + e, z);
  const hD = terrainHeight(x, z - e);
  const hU = terrainHeight(x, z + e);
  return out.set(hL - hR, 2 * e, hD - hU).normalize();
}

export function terrainSlope(x: number, z: number): number {
  const e = 0.6;
  const hL = terrainHeight(x - e, z);
  const hR = terrainHeight(x + e, z);
  const hD = terrainHeight(x, z - e);
  const hU = terrainHeight(x, z + e);
  const dx = (hR - hL) / (2 * e);
  const dz = (hU - hD) / (2 * e);
  return Math.hypot(dx, dz);
}

function detailTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(x * 0.09, y * 0.09, 4, 991) * 0.55 + fbm(x * 0.42, y * 0.42, 3, 313) * 0.45;
      const v = 152 + (n - 0.5) * 88;
      const i = (y * size + x) * 4;
      img.data[i] = v;
      img.data[i + 1] = v * 0.99;
      img.data[i + 2] = v * 0.95;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(96, 96);
  tex.anisotropy = 8;
  return tex;
}

const GRASS_COLOR = new THREE.Color(0x365c22);
const DRY_COLOR = new THREE.Color(0x93914f);
const PALE_FIELD_COLOR = new THREE.Color(0xbdb78c);
const DIRT_COLOR = new THREE.Color(0x6d5a41);
const STONE_COLOR = new THREE.Color(0x7c7a72);
const DARK_COLOR = new THREE.Color(0x35502a);

export function buildTerrain(): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(
    WORLD.mapSize,
    WORLD.mapSize,
    WORLD.segments,
    WORLD.segments,
  );
  geometry.rotateX(-Math.PI / 2);

  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const tmp = new THREE.Color();
  const normal = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, terrainHeight(x, z));
  }
  geometry.computeVertexNormals();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = terrainHeight(x, z);
    terrainNormal(x, z, normal);
    const slope = terrainSlope(x, z);

    const macro = fbm(x * 0.013, z * 0.013, 3, 555);
    const patch = fbm(x * 0.05, z * 0.05, 2, 812);

    tmp.copy(GRASS_COLOR);
    tmp.lerp(DRY_COLOR, clamp(macro * 1.25 - 0.12 + (patch - 0.5) * 0.55, 0, 1));
    tmp.lerp(DARK_COLOR, clamp((0.33 - macro) * 1.25, 0, 0.6));
    tmp.lerp(DRY_COLOR, dryGrassMask(x, z) * 0.35);
    tmp.lerp(PALE_FIELD_COLOR, tallGrassMask(x, z) * 0.18);

    tmp.lerp(DIRT_COLOR, smoothstep(0.42, 0.95, slope) * 0.75);
    tmp.lerp(STONE_COLOR, smoothstep(0.95, 1.9, slope) * 0.8);

    tmp.offsetHSL(0, 0, clamp((h + 4) * 0.02, -0.08, 0.12));
    tmp.multiplyScalar(0.88 + normal.y * 0.14);

    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: detailTexture(),
    roughness: 0.96,
    metalness: 0,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.name = 'terrain';
  return mesh;
}
