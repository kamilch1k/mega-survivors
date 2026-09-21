import * as THREE from 'three';
import { terrainHeight } from './terrain';
import { fbm } from '../core/mathx';

type Place = {
  x: number;
  z: number;
  rotY: number;
  sx: number;
  sy: number;
  sz: number;
  y?: number;
};

const MAT = {
  stone: new THREE.MeshStandardMaterial({ color: 0x8b887c, roughness: 0.94, metalness: 0.02 }),
  paleStone: new THREE.MeshStandardMaterial({ color: 0xa8a496, roughness: 0.9, metalness: 0.02 }),
  mossStone: new THREE.MeshStandardMaterial({ color: 0x76845f, roughness: 0.96, metalness: 0.02 }),
  darkStone: new THREE.MeshStandardMaterial({ color: 0x63615a, roughness: 0.95, metalness: 0.03 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x54422f, roughness: 0.92, metalness: 0.02 }),
  crystal: new THREE.MeshStandardMaterial({
    color: 0x9fdcff,
    emissive: 0x2f86ff,
    emissiveIntensity: 2.2,
    roughness: 0.18,
    metalness: 0.15,
    transparent: true,
    opacity: 0.92,
  }),
  gold: new THREE.MeshStandardMaterial({ color: 0xc9a45a, roughness: 0.34, metalness: 0.85 }),
};

function glowTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(240,250,255,1)');
  grad.addColorStop(0.22, 'rgba(140,205,255,0.7)');
  grad.addColorStop(0.55, 'rgba(50,130,255,0.22)');
  grad.addColorStop(1, 'rgba(10,40,140,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function rngFrom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function buildProps(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'props';
  const rng = rngFrom(987654321);
  const glow = glowTexture();

  const rocks: Place[] = [];
  const stones: Place[] = [];
  const pillars: Place[] = [];
  const shards: Place[] = [];
  const trees: Place[] = [];
  const walls: Place[] = [];
  const path: Place[] = [];
  const bushes: Place[] = [];

  const distFromSpawn = (x: number, z: number) => Math.hypot(x, z);

  for (let i = 0; i < 420; i++) {
    const x = (rng() - 0.5) * 300;
    const z = (rng() - 0.5) * 300;
    if (distFromSpawn(x, z) < 13) continue;
    const s = 0.4 + rng() * 1.5;
    rocks.push({ x, z, rotY: rng() * Math.PI * 2, sx: s * (0.8 + rng() * 0.6), sy: s * (0.5 + rng() * 0.7), sz: s * (0.8 + rng() * 0.6) });
  }

  for (let i = 0; i < 130; i++) {
    const a = rng() * Math.PI * 2;
    const r = 55 + rng() * 90;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const h = 2.2 + rng() * 2.6;
    stones.push({ x, z, rotY: rng() * Math.PI * 2, sx: 0.7 + rng() * 0.5, sy: h / 3.4, sz: 0.7 + rng() * 0.4 });
  }

  const ruinSites = [
    { x: 34, z: 52, n: 11 },
    { x: -58, z: -34, n: 9 },
    { x: 96, z: 76, n: 8 },
    { x: -120, z: 88, n: 7 },
    { x: 22, z: -108, n: 8 },
  ];
  for (const site of ruinSites) {
    for (let i = 0; i < site.n; i++) {
      const a = rng() * Math.PI * 2;
      const r = 3 + rng() * 12;
      const x = site.x + Math.cos(a) * r;
      const z = site.z + Math.sin(a) * r;
      const h = 3.4 + rng() * 4.4;
      pillars.push({ x, z, rotY: rng() * 0.4, sx: 0.8 + rng() * 0.35, sy: h / 5.2, sz: 0.8 + rng() * 0.35 });
    }
    for (let i = 0; i < 5; i++) {
      const a = rng() * Math.PI * 2;
      const r = 2 + rng() * 9;
      shards.push({
        x: site.x + Math.cos(a) * r,
        z: site.z + Math.sin(a) * r,
        rotY: rng() * Math.PI * 2,
        sx: 0.5 + rng() * 0.8,
        sy: 1.2 + rng() * 2.4,
        sz: 0.5 + rng() * 0.8,
      });
    }
  }

  for (let i = 0; i < 70; i++) {
    const a = rng() * Math.PI * 2;
    const r = 25 + rng() * 45;
    shards.push({
      x: Math.cos(a) * r,
      z: Math.sin(a) * r,
      rotY: rng() * Math.PI * 2,
      sx: 0.4 + rng() * 0.6,
      sy: 0.8 + rng() * 1.5,
      sz: 0.4 + rng() * 0.6,
    });
  }

  for (let i = 0; i < 62; i++) {
    const a = rng() * Math.PI * 2;
    const r = 68 + rng() * 82;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (Math.hypot(x - 74, z + 58) < 16) continue;
    trees.push({ x, z, rotY: rng() * Math.PI * 2, sx: 0.8 + rng() * 0.6, sy: 0.8 + rng() * 0.8, sz: 0.8 + rng() * 0.6 });
  }

  for (const site of ruinSites.slice(0, 3)) {
    const segs = 3 + Math.floor(rng() * 3);
    for (let s = 0; s < segs; s++) {
      const a = rng() * Math.PI * 2;
      const r = 7 + s * 3.4;
      for (let b = -3; b <= 3; b++) {
        if (rng() < 0.22) continue;
        const bx = site.x + Math.cos(a) * r - Math.sin(a) * b * 2.3;
        const bz = site.z + Math.sin(a) * r + Math.cos(a) * b * 2.3;
        walls.push({
          x: bx,
          z: bz,
          rotY: -a,
          sx: 1,
          sy: 0.55 + rng() * 0.75,
          sz: 1,
          y: b === 0 ? 1.15 : rng() < 0.5 ? 0 : 1.15,
        });
      }
    }
  }

  const pathCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 14),
    new THREE.Vector3(12, 0, 26),
    new THREE.Vector3(24, 0, 40),
    new THREE.Vector3(34, 0, 52),
  ]);
  const pathPts = pathCurve.getPoints(150);
  for (let i = 0; i < pathPts.length; i += 2) {
    const p = pathPts[i];
    path.push({
      x: p.x + (rng() - 0.5) * 1.1,
      z: p.z + (rng() - 0.5) * 1.1,
      rotY: rng() * Math.PI,
      sx: 0.85 + rng() * 0.35,
      sy: 1,
      sz: 0.85 + rng() * 0.35,
    });
  }

  for (let i = 0; i < 150; i++) {
    const x = (rng() - 0.5) * 290;
    const z = (rng() - 0.5) * 290;
    if (distFromSpawn(x, z) < 15) continue;
    if (rng() > fbm(x * 0.02, z * 0.02, 2, 4242) * 1.4) continue;
    bushes.push({
      x,
      z,
      rotY: rng() * Math.PI * 2,
      sx: 0.7 + rng() * 0.9,
      sy: 0.5 + rng() * 0.7,
      sz: 0.7 + rng() * 0.9,
    });
  }

  const addInstanced = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    places: Place[],
    name: string,
    shadow = true,
  ): THREE.InstancedMesh | null => {
    if (places.length === 0) return null;
    const mesh = new THREE.InstancedMesh(geo, mat, places.length);
    mesh.name = name;
    mesh.castShadow = shadow;
    mesh.receiveShadow = false;
    const dummy = new THREE.Object3D();
    places.forEach((p, i) => {
      const y = terrainHeight(p.x, p.z) + (p.y ?? 0);
      dummy.position.set(p.x, y, p.z);
      dummy.rotation.set(0, p.rotY, 0);
      dummy.scale.set(p.sx, p.sy, p.sz);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
    return mesh;
  };

  addInstanced(new THREE.IcosahedronGeometry(1, 0), MAT.stone, rocks, 'rocks');
  addInstanced(new THREE.CylinderGeometry(0.55, 0.78, 3.4, 6), MAT.paleStone, stones, 'standing-stones');
  addInstanced(new THREE.CylinderGeometry(0.66, 0.8, 5.2, 8), MAT.mossStone, pillars, 'pillars');
  addInstanced(new THREE.OctahedronGeometry(1, 0), MAT.crystal, shards, 'crystals', false);
  addInstanced(new THREE.CylinderGeometry(0.2, 0.42, 4.6, 6), MAT.wood, trees, 'dead-trunks');
  addInstanced(new THREE.BoxGeometry(2.2, 1.15, 1.15), MAT.darkStone, walls, 'walls');
  addInstanced(new THREE.BoxGeometry(1.7, 0.2, 1.35), MAT.paleStone, path, 'path', false);
  addInstanced(new THREE.IcosahedronGeometry(1, 0), MAT.mossStone, bushes, 'bushes');

  const glowMat = new THREE.SpriteMaterial({
    map: glow,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    opacity: 0.75,
  });
  for (const shard of shards) {
    if (rng() > 0.55) continue;
    const sprite = new THREE.Sprite(glowMat);
    sprite.position.set(shard.x, terrainHeight(shard.x, shard.z) + shard.sy * 0.9, shard.z);
    sprite.scale.setScalar(2.4 + shard.sy * 1.6);
    group.add(sprite);
  }

  const treeBranches: Place[] = [];
  for (const tree of trees) {
    const branches = 2 + Math.floor(rng() * 3);
    for (let b = 0; b < branches; b++) {
      treeBranches.push({
        x: tree.x,
        z: tree.z,
        rotY: rng() * Math.PI * 2,
        sx: 0.55,
        sy: 0.5 + rng() * 0.5,
        sz: 0.55,
        y: 2.2 + rng() * 1.6,
      });
    }
  }
  addInstanced(new THREE.CylinderGeometry(0.07, 0.16, 2.6, 5), MAT.wood, treeBranches, 'dead-branches');

  const shrine = new THREE.Group();
  shrine.name = 'shrine';
  const sx = 30;
  const sz = 48;
  const sy = terrainHeight(sx, sz);
  const step1 = new THREE.Mesh(new THREE.BoxGeometry(14, 0.6, 14), MAT.paleStone);
  step1.position.set(sx, sy + 0.3, sz);
  const step2 = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.6, 10.5), MAT.paleStone);
  step2.position.set(sx, sy + 0.85, sz);
  const step3 = new THREE.Mesh(new THREE.BoxGeometry(7, 0.6, 7), MAT.stone);
  step3.position.set(sx, sy + 1.4, sz);
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.1, 1.1, 8), MAT.darkStone);
  dais.position.set(sx, sy + 2.2, sz);
  for (const m of [step1, step2, step3, dais]) {
    m.castShadow = true;
    m.receiveShadow = true;
    shrine.add(m);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.4;
    const px = sx + Math.cos(a) * 4.6;
    const pz = sz + Math.sin(a) * 4.6;
    const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 1.6 + (i % 3) * 1.1, 8), MAT.mossStone);
    pil.position.set(px, terrainHeight(px, pz) + 2.4, pz);
    pil.castShadow = true;
    shrine.add(pil);
  }
  const floating = new THREE.Mesh(new THREE.OctahedronGeometry(1.35, 0), MAT.crystal);
  floating.position.set(sx, sy + 5.6, sz);
  floating.name = 'shrine-crystal';
  shrine.add(floating);
  const shrineGlow = new THREE.Sprite(glowMat);
  shrineGlow.position.copy(floating.position);
  shrineGlow.scale.setScalar(11);
  shrine.add(shrineGlow);
  const shrineLight = new THREE.PointLight(0x5aa8ff, 260, 45, 2);
  shrineLight.position.copy(floating.position);
  shrine.add(shrineLight);
  group.add(shrine);

  const tower = new THREE.Group();
  tower.name = 'landmark-tower';
  const tx = 74;
  const tz = -58;
  const ty = terrainHeight(tx, tz);
  const towerParts: [THREE.BufferGeometry, THREE.Material, number, number][] = [
    [new THREE.CylinderGeometry(6.6, 8.2, 9, 14), MAT.stone, 4.5, 0],
    [new THREE.CylinderGeometry(5.2, 6.4, 9.5, 14), MAT.mossStone, 13.5, 0.4],
    [new THREE.CylinderGeometry(4.4, 5.1, 4.2, 14), MAT.paleStone, 20, -0.3],
  ];
  for (const [geo, mat, y, rot] of towerParts) {
    const part = new THREE.Mesh(geo, mat);
    part.position.set(tx, ty + y, tz);
    part.rotation.y = rot;
    part.castShadow = true;
    part.receiveShadow = true;
    tower.add(part);
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const px = tx + Math.cos(a) * 3.6;
    const pz = tz + Math.sin(a) * 3.6;
    const arch = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 9.5, 8), MAT.mossStone);
    arch.position.set(px, ty + 25.5, pz);
    arch.rotation.z = 0.03 * Math.cos(a);
    arch.castShadow = true;
    tower.add(arch);
  }
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.9, 1.5, 12), MAT.darkStone);
  crown.position.set(tx, ty + 30.6, tz);
  crown.castShadow = true;
  tower.add(crown);
  const bigCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(2.6, 0), MAT.crystal);
  bigCrystal.position.set(tx, ty + 35.5, tz);
  bigCrystal.name = 'tower-crystal';
  tower.add(bigCrystal);
  const towerGlow = new THREE.Sprite(glowMat);
  towerGlow.position.copy(bigCrystal.position);
  towerGlow.scale.setScalar(22);
  tower.add(towerGlow);
  const towerLight = new THREE.PointLight(0x6ab4ff, 900, 90, 2);
  towerLight.position.copy(bigCrystal.position);
  tower.add(towerLight);
  group.add(tower);

  return group;
}
