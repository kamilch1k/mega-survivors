import * as THREE from 'three';
import { emptyInput, InputSource, type InputFrame } from './core/input';
import { makeRng } from './core/rng';
import { Player } from './gameplay/player';
import { EnemyField, type Enemy } from './gameplay/enemies';
import { Combat } from './gameplay/combat';
import { Director } from './gameplay/director';
import { Pickups } from './gameplay/pickups';
import { buildGlaive, CharacterRig } from './rendering/character';
import { FollowCamera } from './rendering/camera';
import { buildTerrain, terrainHeight } from './rendering/terrain';
import { Vegetation } from './rendering/vegetation';
import { buildProps } from './rendering/props';
import { applyFog, buildLighting, buildSky, sunDirection } from './rendering/sky';
import {
  filterClipToRig,
  loadGLTF,
  loadModel,
  meshToInstanced,
  prepareModel,
  rescaleClipPositions,
  skeletonUnitScale,
} from './rendering/assets';
import { Particles } from './effects/particles';
import { SlashArcs } from './effects/slash';
import { ENEMY, PLAYER, RENDER } from './data/config';
import { rollUpgrades } from './data/upgrades';
import { Hud } from './ui/hud';
import { LevelUpUI } from './ui/levelup';
import { installHarness } from './debug/harness';

const TICK = 1 / 60;

const canvas = document.getElementById('view') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = RENDER.exposure;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
applyFog(scene);
const sky = buildSky();
const envScene = new THREE.Scene();
envScene.add(sky);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(envScene, 0.04, 1, 2000).texture;
scene.environmentIntensity = 0.85;
pmrem.dispose();
scene.add(sky);
const sun = buildLighting(scene);
scene.add(buildTerrain());
const vegetation = new Vegetation();
const SANDBOX = true;
if (!SANDBOX) scene.add(vegetation.group);
scene.add(buildProps());

const particles = new Particles(1800);
scene.add(particles.mesh);
const slashArcs = new SlashArcs(8, 0.8, 4.2, 150);
scene.add(slashArcs.group);
const pickups = new Pickups(800);
scene.add(pickups.mesh);

const player = new Player();
const playerGroup = new THREE.Group();
const weaponPivot = new THREE.Group();
weaponPivot.position.set(0, 1.05, 0);
const rig = new CharacterRig();
playerGroup.add(rig.root);
playerGroup.add(weaponPivot);
scene.add(playerGroup);

const enemyField = new EnemyField();
scene.add(enemyField.group);

const combat = new Combat();
const director = new Director();
const cam = new FollowCamera(window.innerWidth / window.innerHeight, canvas);
const hud = new Hud();
const levelUpUI = new LevelUpUI();

const inputSource = new InputSource();
inputSource.attach(window);
const input = emptyInput();
const rng = makeRng(20260921);
const upgradeLevels: Record<string, number> = {};

let gltfHolder: THREE.Group | null = null;
let playerModelRoot: THREE.Object3D | null = null;
let modelStatus = 'pending';
let modelHeight = 0;
let mixer: THREE.AnimationMixer | null = null;
let currentClip = '';
let playerClips = '';
let boneNames = '';
let handBone: THREE.Object3D | null = null;
let glaiveRef: THREE.Group | null = null;
let weaponInHand = false;
let weaponBaseQuat = new THREE.Quaternion();
let useBaseQuat = false;
let handBoneName = '';
let lockedClip: string | null = null;
let weaponLocal: [number, number, number, number, number, number, number] = [0, 0, 0, 1.5708, 0, 0, 2];
let glaiveNativeLen = 1;
const actions: Record<string, THREE.AnimationAction> = {};
const _ws = new THREE.Vector3();

function reoriginGlaive(g: THREE.Group, grip01: number): number {
  const box = new THREE.Box3().setFromObject(g);
  const len = box.max.y - box.min.y;
  const pivot = box.min.y + len * grip01;
  for (const child of g.children) child.position.y -= pivot;
  return len;
}

function applyWeaponLocal(): void {
  if (!glaiveRef || !handBone) return;
  handBone.getWorldScale(_ws);
  const s = _ws.x || 1;
  const [px, py, pz, rx, ry, rz, len] = weaponLocal;
  glaiveRef.position.set(px / s, py / s, pz / s);
  if (useBaseQuat) glaiveRef.quaternion.copy(weaponBaseQuat);
  else glaiveRef.rotation.set(rx, ry, rz);
  glaiveRef.scale.setScalar(len / glaiveNativeLen / s);
}

const PLAYER_MODEL_URL = './assets/characters/her_rigged.glb';
const PLAYER_CLIP_URLS = ['./assets/oss/Soldier.glb'];

function pickHandBone(root: THREE.Object3D, groundY: number): THREE.Object3D | null {
  root.updateMatrixWorld(true);
  const bones: { o: THREE.Object3D; n: string }[] = [];
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone) {
      bones.push({ o, n: o.name.toLowerCase().replace(/[^a-z]/g, '') });
    }
  });
  const right = bones.find((b) => b.n.includes('righthand'));
  if (right) return right.o;
  const left = bones.find((b) => b.n.includes('lefthand'));
  if (left) return left.o;
  const v = new THREE.Vector3();
  let best: THREE.Object3D | null = null;
  let bestScore = -Infinity;
  root.traverse((o) => {
    if (!(o as THREE.Bone).isBone) return;
    if (!/limb/i.test(o.name)) return;
    o.getWorldPosition(v);
    const h = v.y - groundY;
    if (h < 0.58 || h > 1.05) return;
    const score = v.z;
    if (score > bestScore) {
      bestScore = score;
      best = o;
    }
  });
  return best;
}

function clipKey(raw: string): string {
  const n = raw.toLowerCase();
  for (const key of ['idle', 'walk', 'run', 'jump', 'slash', 'dive', 'hurt', 'fall', 'turn']) {
    if (n.includes(key)) return key;
  }
  return '';
}

void (async () => {
  const anim = await loadGLTF(PLAYER_MODEL_URL);
  const model = anim?.scene ?? (await loadGLTF('./assets/characters/player.glb'))?.scene ?? null;
  if (!model) {
    modelStatus = 'procedural-fallback';
    return;
  }
  prepareModel(model, PLAYER.height);
  const measured = new THREE.Box3().setFromObject(model);
  modelHeight = Number((measured.max.y - measured.min.y).toFixed(3));

  const clips: THREE.AnimationClip[] = [...(anim?.animations ?? [])];
  const ownUnit = skeletonUnitScale(model);
  for (const url of PLAYER_CLIP_URLS) {
    const src = await loadGLTF(url);
    if (!src) continue;
    const factor = ownUnit / skeletonUnitScale(src.scene);
    for (const clip of src.animations) {
      clips.push(rescaleClipPositions(filterClipToRig(clip, model), factor));
    }
  }

  if (clips.length > 0) {
    mixer = new THREE.AnimationMixer(model);
    playerClips = clips.map((c) => c.name).join(' | ');
    for (const clip of clips) {
      const key = clipKey(clip.name);
      if (key && !actions[key]) {
        const action = mixer.clipAction(clip);
        action.enabled = true;
        actions[key] = action;
      }
    }
    modelStatus = 'gltf-animated';
  } else {
    modelStatus = anim ? 'gltf-noclips' : 'gltf-static';
  }

  const names: string[] = [];
  model.traverse((o) => {
    if ((o as THREE.Bone).isBone) names.push(o.name);
  });
  boneNames = names.join(',');

  const holder = new THREE.Group();
  holder.add(model);
  playerModelRoot = model;
  glaiveRef = buildGlaive();
  glaiveNativeLen = reoriginGlaive(glaiveRef, 0.34);
  const hand = pickHandBone(model, 0);
  if (hand) {
    handBone = hand;
    handBoneName = hand.name;
    weaponInHand = true;
    model.updateMatrixWorld(true);
    const bq = new THREE.Quaternion();
    hand.getWorldQuaternion(bq);
    weaponBaseQuat.copy(bq.invert());
    applyWeaponLocal();
    hand.add(glaiveRef);
  } else {
    glaiveRef.scale.setScalar(0.42);
    glaiveRef.position.set(0, -0.03, -0.19);
    glaiveRef.rotation.set(0.16, 0, -0.86);
    weaponPivot.add(glaiveRef);
  }
  gltfHolder = holder;
  playerGroup.add(holder);
  rig.root.visible = false;
})();

let enemyStatus = 'pending';

void (async () => {
  if (SANDBOX) {
    enemyStatus = 'sandbox';
    return;
  }
  const wolf = await loadModel('./assets/enemies/wolf.glb');
  const source = wolf ? meshToInstanced(wolf, ENEMY.wolfHeight) : null;
  if (source) {
    enemyField.setModel(source, 900);
    enemyStatus = 'gltf';
  } else {
    enemyField.setFallback(900);
    enemyStatus = 'procedural-fallback';
  }
})();

const orbGeometry = new THREE.OctahedronGeometry(0.26, 0);
const orbMaterial = new THREE.MeshStandardMaterial({
  color: 0xcfe8ff,
  emissive: 0x4aa8ff,
  emissiveIntensity: 3.2,
  roughness: 0.15,
});
let orbMesh: THREE.InstancedMesh | null = null;
let orbAngle = 0;
let orbDamageTimer = 0;
const orbDummy = new THREE.Object3D();

let lightningTimer = 1.5;
let frostTimer = 3;

let paused = false;
let dead = false;
let elapsed = 0;
let ticks = 0;
let fpsAvg = 60;
let last = performance.now();
let accumulator = 0;
let hitstop = 0;
let firstFrame = true;
let levelQueue = 0;
let shakeAccum = 0;

const sunDir = sunDirection();
const projected = new THREE.Vector3();
const enemyScratch: Enemy[] = [];

function damageNumber(x: number, y: number, z: number, amount: number, crit: boolean): void {
  projected.set(x, y, z).project(cam.camera);
  if (projected.z > 1) return;
  const sx = (projected.x * 0.5 + 0.5) * window.innerWidth;
  const sy = (-projected.y * 0.5 + 0.5) * window.innerHeight;
  hud.damageNumber(sx, sy, amount, crit);
}

function openCards(): void {
  if (levelQueue <= 0 || levelUpUI.isOpen) return;
  levelQueue--;
  const choices = rollUpgrades(upgradeLevels, 3, rng);
  if (choices.length === 0) return;
  levelUpUI.show(choices, (u) => {
    u.apply(player);
    upgradeLevels[u.id] = (upgradeLevels[u.id] ?? 0) + 1;
    particles.spawnBatch(
      {
        x: player.position.x,
        y: player.position.y + 1.1,
        z: player.position.z,
        color: 0xffe6a8,
        spread: 1.1,
        speed: 8,
        life: 0.9,
        size: 0.3,
        gravity: 5,
      },
      40,
      rng,
    );
    if (levelQueue > 0) openCards();
  });
}

function onCollectXp(value: number, x: number, y: number, z: number): void {
  particles.spawnBatch(
    { x, y, z, color: 0x9fd8ff, spread: 0.2, speed: 3.4, life: 0.35, size: 0.14, gravity: 5 },
    5,
    rng,
  );
  if (player.addXp(value)) {
    levelQueue++;
    openCards();
  }
}

function updateOrbs(dt: number): void {
  const n = player.orbCount;
  if (n === 0) {
    if (orbMesh) orbMesh.visible = false;
    return;
  }
  if (!orbMesh || orbMesh.count < n) {
    if (orbMesh) scene.remove(orbMesh);
    orbMesh = new THREE.InstancedMesh(orbGeometry, orbMaterial, n);
    orbMesh.frustumCulled = false;
    orbMesh.count = n;
    scene.add(orbMesh);
  }
  orbMesh.visible = true;
  orbAngle += dt * 1.9;
  const radius = 2.4;
  for (let i = 0; i < n; i++) {
    const a = orbAngle + (i / n) * Math.PI * 2;
    const x = player.position.x + Math.cos(a) * radius;
    const z = player.position.z + Math.sin(a) * radius;
    const y = player.position.y + 1.15 + Math.sin(orbAngle * 2.6 + i) * 0.16;
    orbDummy.position.set(x, y, z);
    orbDummy.rotation.set(orbAngle * 1.4, orbAngle * 2.1, 0);
    orbDummy.scale.setScalar(1);
    orbDummy.updateMatrix();
    orbMesh.setMatrixAt(i, orbDummy.matrix);
  }
  orbMesh.instanceMatrix.needsUpdate = true;

  orbDamageTimer -= dt;
  if (orbDamageTimer > 0) return;
  orbDamageTimer = 0.22;
  for (let i = 0; i < n; i++) {
    const a = orbAngle + (i / n) * Math.PI * 2;
    const x = player.position.x + Math.cos(a) * radius;
    const z = player.position.z + Math.sin(a) * radius;
    enemyField.damageArea(x, z, 0.85, player.orbDamage, 4, (e) => {
      damageNumber(e.x, player.position.y + 1.4, e.z, player.orbDamage, false);
    });
  }
}

function updateLightning(dt: number): void {
  if (player.lightningLevel === 0) return;
  lightningTimer -= dt;
  if (lightningTimer > 0) return;
  lightningTimer = Math.max(0.55, 2.5 - player.lightningLevel * 0.34);
  const strikes = player.lightningLevel;
  enemyScratch.length = 0;
  for (const e of enemyField.enemies) enemyScratch.push(e);
  enemyScratch.sort(
    (a, b) =>
      Math.hypot(a.x - player.position.x, a.z - player.position.z) -
      Math.hypot(b.x - player.position.x, b.z - player.position.z),
  );
  const count = Math.min(strikes, enemyScratch.length);
  for (let i = 0; i < count; i++) {
    const e = enemyScratch[i];
    const dmg = player.damage * (0.8 + player.lightningLevel * 0.3);
    e.hp -= dmg;
    e.flash = 1;
    damageNumber(e.x, player.position.y + 1.9, e.z, dmg, false);
    particles.spawnBatch(
      { x: e.x, y: player.position.y + 1.5, z: e.z, color: 0xbfe4ff, spread: 0.3, speed: 7, life: 0.34, size: 0.2, gravity: 12 },
      10,
      rng,
    );
  }
}

function updateFrost(dt: number): void {
  if (player.frostLevel === 0) return;
  frostTimer -= dt;
  if (frostTimer > 0) return;
  frostTimer = Math.max(1.4, 6.4 - player.frostLevel * 0.9);
  const radius = 6 + player.frostLevel * 0.85;
  const dmg = 10 + player.frostLevel * 9;
  enemyField.applySlow(player.position.x, player.position.z, radius, 0.6);
  enemyField.damageArea(player.position.x, player.position.z, radius, dmg, 3, (e) => {
    damageNumber(e.x, player.position.y + 1.3, e.z, dmg, false);
  });
  slashArcs.trigger(player.position.x, player.position.y + 0.5, player.position.z, orbAngle, radius / 4.2, 0.5);
  particles.spawnBatch(
    {
      x: player.position.x,
      y: player.position.y + 0.4,
      z: player.position.z,
      color: 0xa8e8ff,
      spread: radius * 0.8,
      speed: 5,
      life: 0.7,
      size: 0.3,
      gravity: 3,
    },
    34,
    rng,
  );
}

function simulate(dt: number): void {
  inputSource.sample(input);
  player.update(dt, input, cam.yaw);

  if (SANDBOX) {
    elapsed += dt;
    ticks++;
    player.hp = Math.min(player.maxHp, player.hp + dt * 4);
    return;
  }

  enemyField.update(dt, player.position.x, player.position.z);

  if (enemyField.contactDps > 0 && player.invuln <= 0 && !dead) {
    player.hp -= enemyField.contactDps * dt;
    shakeAccum += enemyField.contactDps * 0.0016;
    if (player.hp <= 0) {
      player.hp = 0;
      dead = true;
    }
  }

  combat.update(dt, player, enemyField, particles, slashArcs, hooks, rng);
  director.update(dt, player, enemyField, rng);
  pickups.update(dt, player.position.x, player.position.y, player.position.z, player.pickupRadius, onCollectXp);
  updateOrbs(dt);
  updateLightning(dt);
  updateFrost(dt);

  elapsed += dt;
  ticks++;
}

const hooks = {
  hitstop: (s: number) => {
    hitstop = Math.max(hitstop, s);
  },
  shake: (a: number) => {
    shakeAccum += a;
  },
  damageNumber,
  onKill: (e: Enemy) => {
    player.kills++;
    pickups.spawn(e.x, e.z, e.kind.xp, rng);
    if (e.kind.xp >= 14) {
      pickups.spawn(e.x + 0.7, e.z, e.kind.xp * 0.5, rng);
    }
  },
  heal: (amount: number) => {
    player.hp = Math.min(player.maxHp, player.hp + amount);
  },
};

const renderPos = new THREE.Vector3();
let visualTime = 0;

function syncVisuals(dt: number, immediate: boolean, alpha: number): void {
  visualTime += dt;
  renderPos.set(
    player.prevPosition.x + (player.position.x - player.prevPosition.x) * alpha,
    player.prevPosition.y + (player.position.y - player.prevPosition.y) * alpha,
    player.prevPosition.z + (player.position.z - player.prevPosition.z) * alpha,
  );

  playerGroup.position.copy(renderPos);
  playerGroup.rotation.y = player.facing;

  const swing = combat.swingProgress;
  if (weaponInHand) {
    applyWeaponLocal();
  } else if (swing >= 0) {
    const p = Math.min(1, swing / 0.72);
    const wind = Math.min(1, p / 0.42);
    const cut = Math.max(0, (p - 0.42) / 0.58);
    weaponPivot.rotation.y = 1.35 * wind - 2.9 * cut;
    weaponPivot.rotation.z = -0.35 * wind + 0.85 * cut;
    weaponPivot.rotation.x = -0.25 + 0.5 * cut;
  } else {
    weaponPivot.rotation.y += (0 - weaponPivot.rotation.y) * Math.min(1, dt * 9);
    weaponPivot.rotation.z += (0 - weaponPivot.rotation.z) * Math.min(1, dt * 7);
    weaponPivot.rotation.x += (0 - weaponPivot.rotation.x) * Math.min(1, dt * 7);
  }

  if (mixer) {
    let want = 'idle';
    if (lockedClip && actions[lockedClip]) want = lockedClip;
    else if (combat.swingProgress >= 0 && actions.slash) want = 'slash';
    else if (!player.grounded && actions.jump) want = 'jump';
    else if (player.speed01 > 0.55 && actions.run) want = 'run';
    else if (player.speed01 > 0.05 && actions.walk) want = 'walk';
    if (want !== currentClip && actions[want]) {
      const prev = actions[currentClip];
      const next = actions[want];
      next.reset();
      next.setEffectiveWeight(1);
      next.setEffectiveTimeScale(want === 'slash' ? next.getClip().duration / 0.5 : 1);
      next.fadeIn(0.16).play();
      if (prev && prev !== next) prev.fadeOut(0.16);
      currentClip = want;
    }
    if (currentClip === 'walk' || currentClip === 'run') {
      const speed = player.speed01 * PLAYER.maxSprint;
      const ref = currentClip === 'run' ? PLAYER.maxSprint : PLAYER.maxWalk;
      actions[currentClip].setEffectiveTimeScale(Math.max(0.65, Math.min(1.75, speed / ref)));
    }
    mixer.update(dt);
  } else if (gltfHolder) {
    const s = Math.min(1, player.speed01 * 2.4);
    const stride = visualTime * (3 + player.speed01 * 11);
    gltfHolder.position.y = Math.abs(Math.sin(stride)) * 0.07 * s + Math.sin(visualTime * 1.6) * 0.012;
    gltfHolder.rotation.x = 0.02 + player.speed01 * 0.13;
    gltfHolder.rotation.z = Math.sin(stride) * 0.05 * s;
    if (!player.grounded) {
      gltfHolder.position.y += 0.06;
      gltfHolder.rotation.x -= 0.12;
    }
  } else {
    rig.update(dt, {
      speed01: player.speed01,
      grounded: player.grounded,
      airTime: player.airTime,
      attack: swing,
      hurt: 0,
      dead,
    });
  }

  particles.update(dt, cam.camera);
  slashArcs.update(dt);

  cam.update(dt, renderPos, player.velocity, player.sprint01, immediate);
  if (shakeAccum > 0.01) {
    cam.addShake(shakeAccum);
    shakeAccum = 0;
  }

  sun.position.set(
    renderPos.x + sunDir.x * 120,
    sunDir.y * 120,
    renderPos.z + sunDir.z * 120,
  );
  sun.target.position.set(renderPos.x, 0, renderPos.z);
  sun.target.updateMatrixWorld();

  if (!SANDBOX) vegetation.update(renderPos.x, renderPos.y, renderPos.z, visualTime);

  const abilities: { name: string; cooldown01: number }[] = [];
  if (player.orbCount > 0) abilities.push({ name: 'ORB', cooldown01: 1 });
  if (player.lightningLevel > 0) abilities.push({ name: 'BOLT', cooldown01: 1 });
  if (player.frostLevel > 0) abilities.push({ name: 'FROST', cooldown01: 1 });
  if (player.echoBlades > 0) abilities.push({ name: 'ECHO', cooldown01: 1 });

  hud.update({
    hp: player.hp,
    maxHp: player.maxHp,
    level: player.level,
    xp: player.xp,
    xpToNext: player.xpToNext,
    time: elapsed,
    enemies: enemyField.count,
    fps: fpsAvg,
    abilities,
  });
}

function frame(now: number): void {
  const raw = (now - last) / 1000;
  last = now;
  const dt = Math.min(raw, 0.25);
  fpsAvg = fpsAvg * 0.9 + (1 / Math.max(raw, 0.0001)) * 0.1;

  const blocked = paused || dead || levelUpUI.isOpen;
  if (!blocked) {
    if (hitstop > 0) {
      hitstop -= dt;
      accumulator = 0;
    } else {
      accumulator += dt;
      let steps = 0;
      while (accumulator >= TICK && steps < 5) {
        simulate(TICK);
        accumulator -= TICK;
        steps++;
      }
    }
  }

  const alpha = blocked || hitstop > 0 ? 1 : Math.min(1, accumulator / TICK);
  syncVisuals(dt, firstFrame, alpha);
  renderer.render(scene, cam.camera);

  if (firstFrame) {
    firstFrame = false;
    document.getElementById('boot')?.remove();
    harness.ready = true;
  }
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  cam.resize(window.innerWidth / window.innerHeight);
});

const harness = installHarness({
  setPaused: (v) => {
    paused = v;
    last = performance.now();
    accumulator = 0;
  },
  stepTicks: (n) => {
    const was = paused;
    paused = true;
    for (let i = 0; i < n; i++) simulate(TICK);
    syncVisuals(TICK, false, 1);
    paused = was;
    return n;
  },
  setInput: (f) => {
    inputSource.useScripted(f as Partial<InputFrame> | null);
  },
  snapshot: () => ({
    tick: ticks,
    time: Number(elapsed.toFixed(2)),
    paused,
    dead,
    playerModel: modelStatus,
    playerHeight: modelHeight,
    clips: playerClips,
    activeClip: currentClip,
    boneY: (() => {
      if (!playerModelRoot) return 'none';
      playerModelRoot.updateMatrixWorld(true);
      const v = new THREE.Vector3();
      const rows: { n: string; x: number; y: number; z: number }[] = [];
      playerModelRoot.traverse((o) => {
        if (!(o as THREE.Bone).isBone) return;
        o.getWorldPosition(v);
        rows.push({ n: o.name, x: v.x, y: v.y, z: v.z });
      });
      rows.sort((a, b) => b.y - a.y);
      const g = player.position.y;
      const limbs = rows.filter((r) => /limb/i.test(r.n));
      return `count=${rows.length} LIMBS[${limbs
        .map((r) => `${r.n}@${(r.y - g).toFixed(2)}h/${r.x.toFixed(2)}x/${r.z.toFixed(2)}z`)
        .join(' ')}]`;
    })(),
    weapon: (() => {
      if (!glaiveRef) return 'none';
      const ws = new THREE.Vector3();
      if (handBone) handBone.getWorldScale(ws);
      const wp = new THREE.Vector3();
      glaiveRef.getWorldPosition(wp);
      const hs = ws.x || 1;
      return `hand=${handBoneName || 'none'} native=${glaiveNativeLen.toFixed(3)} handWorldScale=${hs.toFixed(4)} localScale=${(weaponLocal[6] / glaiveNativeLen / hs).toFixed(4)} len=${weaponLocal[6]} parent=${glaiveRef.parent ? glaiveRef.parent.name : 'none'} world=(${wp.x.toFixed(2)},${wp.y.toFixed(2)},${wp.z.toFixed(2)}) visible=${glaiveRef.visible}`;
    })(),
    bones: boneNames.slice(0, 600),
    enemyModel: enemyStatus,
    player: {
      x: Number(player.position.x.toFixed(2)),
      y: Number(player.position.y.toFixed(2)),
      z: Number(player.position.z.toFixed(2)),
      speed: Number(Math.hypot(player.velocity.x, player.velocity.z).toFixed(2)),
      grounded: player.grounded,
      hp: Number(player.hp.toFixed(1)),
      level: player.level,
      xp: player.xp,
      damage: Number(player.damage.toFixed(1)),
      kills: player.kills,
    },
    enemies: enemyField.count,
    enemiesRendered: enemyField.renderCount,
    nearestEnemy: Number(enemyField.nearestDistance.toFixed(2)),
    enemyAvgSpeed: Number(enemyField.avgSpeed.toFixed(2)),
    enemySample: enemyField.firstEnemy,
    orbs: pickups.activeCount,
    upgrades: { ...upgradeLevels },
    camera: { yaw: Number(cam.yaw.toFixed(3)), pitch: Number(cam.pitch.toFixed(3)) },
    fps: Math.round(fpsAvg),
    draw: {
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
    },
  }),
  teleport: (x, z) => {
    player.position.set(x, terrainHeight(x, z), z);
    player.velocity.set(0, 0, 0);
    syncVisuals(TICK, true, 1);
  },
  setCamera: (yaw, pitch) => {
    if (yaw !== undefined) cam.yaw = yaw;
    if (pitch !== undefined) cam.pitch = pitch;
    syncVisuals(TICK, true, 1);
  },
  setCameraDistance: (d) => {
    cam.distance = d;
    syncVisuals(TICK, true, 1);
  },
  forceClip: (name) => {
    lockedClip = name ?? null;
    syncVisuals(TICK, true, 1);
  },
  setWeaponLocal: (px, py, pz, rx, ry, rz, scale) => {
    useBaseQuat = false;
    weaponLocal = [px, py, pz, rx, ry, rz, scale];
    applyWeaponLocal();
    syncVisuals(TICK, true, 1);
  },
  spawnEnemies: (n) => {
    enemyField.spawnRing(n, player.position.x, player.position.z, 14, 34, rng, ['wolf', 'goblin', 'wisp']);
    return enemyField.count;
  },
  setVegetation: (visible) => {
    vegetation.group.visible = visible;
  },
  fps: () => fpsAvg,
});

window.addEventListener('error', (e) => harness.errors.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => harness.errors.push(String(e.reason)));

requestAnimationFrame(frame);
