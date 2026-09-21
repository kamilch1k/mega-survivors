import * as THREE from 'three';
import { clamp, damp, dampAngle } from '../core/mathx';

const M = {
  armorDark: new THREE.MeshStandardMaterial({ color: 0x5e1b24, metalness: 0.55, roughness: 0.42 }),
  armorPlate: new THREE.MeshStandardMaterial({ color: 0x3a3f4b, metalness: 0.65, roughness: 0.38 }),
  silver: new THREE.MeshStandardMaterial({ color: 0xbfc9d6, metalness: 0.72, roughness: 0.3, envMapIntensity: 0.55 }),
  cloth: new THREE.MeshStandardMaterial({ color: 0x2b2436, roughness: 0.86, metalness: 0.05 }),
  clothRed: new THREE.MeshStandardMaterial({ color: 0x7a2230, roughness: 0.8, metalness: 0.05, side: THREE.DoubleSide }),
  skin: new THREE.MeshStandardMaterial({ color: 0xf0cbb0, roughness: 0.62 }),
  hair: new THREE.MeshStandardMaterial({ color: 0xe6eaf1, roughness: 0.55, metalness: 0.08 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xd0a659, metalness: 0.88, roughness: 0.3 }),
  gem: new THREE.MeshStandardMaterial({
    color: 0x7fc8ff,
    emissive: 0x2f8bff,
    emissiveIntensity: 2.6,
    metalness: 0.2,
    roughness: 0.15,
  }),
  blade: new THREE.MeshStandardMaterial({ color: 0x93a0b4, metalness: 0.68, roughness: 0.26, envMapIntensity: 0.42 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x24262c, metalness: 0.6, roughness: 0.5 }),
};

function add(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = false;
  parent.add(m);
  return m;
}

function glowTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(214,240,255,0.85)');
  grad.addColorStop(0.22, 'rgba(120,190,255,0.5)');
  grad.addColorStop(0.55, 'rgba(40,110,230,0.16)');
  grad.addColorStop(1, 'rgba(10,40,140,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildGlaive(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'glaive';

  add(root, new THREE.CylinderGeometry(0.026, 0.032, 1.5, 8), M.dark, 0, -0.35, 0);
  add(root, new THREE.CylinderGeometry(0.038, 0.038, 0.1, 8), M.gold, 0, 0.34, 0);
  add(root, new THREE.CylinderGeometry(0.036, 0.042, 0.09, 8), M.gold, 0, -0.86, 0);

  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(0, 0);
  bladeShape.quadraticCurveTo(0.21, 0.62, 0.07, 1.46);
  bladeShape.quadraticCurveTo(0.01, 1.58, -0.1, 1.42);
  bladeShape.quadraticCurveTo(-0.035, 0.62, 0, 0);
  const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, {
    depth: 0.028,
    bevelEnabled: true,
    bevelThickness: 0.009,
    bevelSize: 0.011,
    bevelSegments: 1,
  });
  bladeGeo.translate(0, 0, -0.014);
  add(root, bladeGeo, M.blade, 0.02, 0.4, 0);
  add(root, new THREE.OctahedronGeometry(0.115, 0), M.gem, 0.06, 0.52, 0);
  add(root, new THREE.OctahedronGeometry(0.062, 0), M.gem, 0.02, 0.86, 0);

  const auraMat = new THREE.MeshBasicMaterial({
    map: glowTexture(),
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    opacity: 0.18,
  });
  const aura = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.95), auraMat);
  aura.position.set(0.06, 0.9, 0);
  root.add(aura);
  const auraBack = aura.clone();
  auraBack.rotation.y = Math.PI / 2;
  root.add(auraBack);

  const tip = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.18), auraMat);
  tip.position.set(0.1, 1.38, 0);
  root.add(tip);

  return root;
}

export type PoseState = {
  speed01: number;
  grounded: boolean;
  airTime: number;
  attack: number;
  hurt: number;
  dead: boolean;
};

export class CharacterRig {
  readonly root = new THREE.Group();
  readonly weapon: THREE.Group;
  private hips = new THREE.Group();
  private torso = new THREE.Group();
  private neck = new THREE.Group();
  private head = new THREE.Group();
  private shoulderL = new THREE.Group();
  private shoulderR = new THREE.Group();
  private elbowL = new THREE.Group();
  private elbowR = new THREE.Group();
  private handL = new THREE.Group();
  private handR = new THREE.Group();
  private legL = new THREE.Group();
  private legR = new THREE.Group();
  private kneeL = new THREE.Group();
  private kneeR = new THREE.Group();
  private footL = new THREE.Group();
  private footR = new THREE.Group();
  private cape = new THREE.Group();
  private ponytail = new THREE.Group();
  private stride = 0;
  private hurtFlash = 0;
  private flashMats: THREE.MeshStandardMaterial[] = [];

  constructor() {
    this.root.name = 'player-character';
    this.root.add(this.hips);
    this.hips.position.y = 0.94;

    const pelvis = add(this.hips, new THREE.BoxGeometry(0.26, 0.16, 0.19), M.cloth, 0, -0.02, 0);
    pelvis.scale.set(1, 1, 1);
    add(this.hips, new THREE.BoxGeometry(0.3, 0.12, 0.22), M.armorDark, 0, -0.07, 0);
    add(this.hips, new THREE.BoxGeometry(0.09, 0.16, 0.08), M.silver, -0.15, -0.06, 0.04);
    add(this.hips, new THREE.BoxGeometry(0.09, 0.16, 0.08), M.silver, 0.15, -0.06, 0.04);

    this.hips.add(this.torso);

    add(this.torso, new THREE.BoxGeometry(0.27, 0.24, 0.18), M.cloth, 0, 0.11, 0);
    add(this.torso, new THREE.BoxGeometry(0.31, 0.2, 0.21), M.armorDark, 0, 0.3, 0);
    add(this.torso, new THREE.BoxGeometry(0.2, 0.14, 0.16), M.armorPlate, 0, 0.14, 0.02);
    add(this.torso, new THREE.BoxGeometry(0.12, 0.12, 0.05), M.gold, 0, 0.29, 0.11);
    add(this.torso, new THREE.OctahedronGeometry(0.055, 0), M.gem, 0, 0.3, 0.14);
    add(this.torso, new THREE.BoxGeometry(0.36, 0.055, 0.19), M.silver, 0, 0.4, 0);
    add(this.torso, new THREE.BoxGeometry(0.2, 0.05, 0.16), M.clothRed, 0, -0.02, 0);

    this.cape.position.set(0, 0.42, -0.09);
    this.torso.add(this.cape);
    add(this.cape, new THREE.BoxGeometry(0.34, 0.62, 0.02), M.clothRed, 0, -0.31, 0);
    add(this.cape, new THREE.BoxGeometry(0.28, 0.34, 0.02), M.cloth, 0, -0.78, 0.01);

    this.neck.position.y = 0.44;
    this.torso.add(this.neck);
    add(this.neck, new THREE.CylinderGeometry(0.045, 0.05, 0.08, 8), M.skin);

    this.head.position.y = 0.11;
    this.neck.add(this.head);
    const skull = add(this.head, new THREE.SphereGeometry(0.115, 16, 14), M.skin, 0, 0.03, 0);
    skull.scale.set(1, 1.08, 0.92);
    add(this.head, new THREE.ConeGeometry(0.03, 0.16, 5), M.skin, -0.11, 0.05, 0).rotation.z = 1.35;
    add(this.head, new THREE.ConeGeometry(0.03, 0.16, 5), M.skin, 0.11, 0.05, 0).rotation.z = -1.35;
    const hairCap = add(this.head, new THREE.SphereGeometry(0.125, 16, 14), M.hair, 0, 0.05, -0.01);
    hairCap.scale.set(1, 1.05, 1);
    add(this.head, new THREE.BoxGeometry(0.24, 0.06, 0.2), M.hair, 0, 0.11, -0.01);
    add(this.head, new THREE.BoxGeometry(0.06, 0.3, 0.12), M.hair, -0.115, -0.04, 0.02);
    add(this.head, new THREE.BoxGeometry(0.06, 0.3, 0.12), M.hair, 0.115, -0.04, 0.02);
    this.ponytail.position.set(0, 0.09, -0.1);
    this.head.add(this.ponytail);
    add(this.ponytail, new THREE.CylinderGeometry(0.045, 0.028, 0.46, 8), M.hair, 0, -0.23, -0.03);
    add(this.ponytail, new THREE.CylinderGeometry(0.028, 0.012, 0.26, 8), M.hair, 0, -0.55, -0.08);
    add(this.head, new THREE.BoxGeometry(0.13, 0.03, 0.04), M.silver, 0, 0.1, 0.1);
    add(this.head, new THREE.OctahedronGeometry(0.03, 0), M.gem, 0, 0.1, 0.13);

    this.buildArm(this.shoulderL, this.elbowL, this.handL, -1);
    this.buildArm(this.shoulderR, this.elbowR, this.handR, 1);

    this.buildLeg(this.legL, this.kneeL, this.footL, -1);
    this.buildLeg(this.legR, this.kneeR, this.footR, 1);

    this.torso.add(this.shoulderL);
    this.torso.add(this.shoulderR);
    this.hips.add(this.legL);
    this.hips.add(this.legR);

    this.weapon = buildGlaive();
    this.weapon.position.set(0.02, -0.12, 0.04);
    this.weapon.rotation.set(-1.28, 0.16, 0.1);
    this.handR.add(this.weapon);

    this.collectMaterials(this.root);
  }

  private buildArm(shoulder: THREE.Group, elbow: THREE.Group, hand: THREE.Group, side: number): void {
    shoulder.position.set(0.225 * side, 0.38, 0);
    add(shoulder, new THREE.SphereGeometry(0.075, 12, 10), M.skin);
    const pauldronScale = side < 0 ? 1.35 : 0.95;
    const pauldron = add(
      shoulder,
      new THREE.SphereGeometry(0.17 * pauldronScale, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.62),
      M.armorDark,
      0.03 * side,
      0.03,
      0,
    );
    pauldron.scale.set(1, 0.9, 1.05);
    add(shoulder, new THREE.BoxGeometry(0.15, 0.05, 0.16), M.silver, 0.04 * side, 0.1, 0);
    if (side < 0) {
      add(shoulder, new THREE.ConeGeometry(0.05, 0.26, 5), M.silver, -0.12, 0.13, 0).rotation.z = 0.5;
      add(shoulder, new THREE.ConeGeometry(0.04, 0.2, 5), M.silver, -0.02, 0.16, -0.08).rotation.set(-0.35, 0, 0.2);
      add(shoulder, new THREE.OctahedronGeometry(0.045, 0), M.gem, -0.09, 0.06, 0.02);
    }

    shoulder.add(elbow);
    elbow.position.y = -0.29;
    add(elbow, new THREE.CapsuleGeometry(0.052, 0.24, 4, 10), M.armorPlate);
    add(elbow, new THREE.BoxGeometry(0.09, 0.18, 0.09), M.armorDark, 0, 0.14, 0);
    add(elbow, new THREE.CylinderGeometry(0.062, 0.058, 0.07, 10), M.silver, 0, 0.22, 0);

    elbow.add(hand);
    hand.position.y = -0.16;
    add(hand, new THREE.CapsuleGeometry(0.048, 0.16, 4, 10), M.skin);
    add(hand, new THREE.BoxGeometry(0.1, 0.12, 0.1), M.armorPlate, 0, 0.02, 0);
    add(hand, new THREE.CylinderGeometry(0.058, 0.054, 0.06, 10), M.gold, 0, -0.09, 0);
  }

  private buildLeg(leg: THREE.Group, knee: THREE.Group, foot: THREE.Group, side: number): void {
    leg.position.set(0.105 * side, -0.02, 0);
    add(leg, new THREE.CapsuleGeometry(0.078, 0.3, 4, 10), M.cloth);
    add(leg, new THREE.BoxGeometry(0.17, 0.22, 0.15), M.armorDark, 0, -0.12, 0.01);

    leg.add(knee);
    knee.position.y = -0.44;
    add(knee, new THREE.CapsuleGeometry(0.062, 0.3, 4, 10), M.armorPlate);
    add(knee, new THREE.BoxGeometry(0.15, 0.3, 0.13), M.armorDark, 0, -0.1, 0);

    knee.add(foot);
    foot.position.y = -0.44;
    add(foot, new THREE.BoxGeometry(0.14, 0.1, 0.28), M.armorPlate, 0, -0.02, 0.05);
    add(foot, new THREE.BoxGeometry(0.15, 0.26, 0.16), M.armorDark, 0, 0.12, -0.01);
    add(foot, new THREE.BoxGeometry(0.13, 0.04, 0.3), M.silver, 0, -0.06, 0.06);
  }

  private collectMaterials(root: THREE.Object3D): void {
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat && mat.isMeshStandardMaterial && !this.flashMats.includes(mat)) {
        const clone = mat.clone();
        mesh.material = clone;
        this.flashMats.push(clone);
      }
    });
  }

  update(dt: number, state: PoseState): void {
    const speed01 = clamp(state.speed01, 0, 1.6);
    this.stride += dt * (2.2 + speed01 * 9.5) * clamp(speed01 * 2.4, 0, 1);

    const t = performance.now() * 0.001;
    const air = !state.grounded;
    const strideAmp = clamp(speed01 * 1.25, 0, 1);
    const s = Math.sin(this.stride);
    const c = Math.cos(this.stride);

    if (air) {
      const tuck = clamp(state.airTime * 3.4, 0, 1);
      this.legL.rotation.x = damp(this.legL.rotation.x, -0.62 * tuck, 9, dt);
      this.legR.rotation.x = damp(this.legR.rotation.x, 0.34 * tuck, 9, dt);
      this.kneeL.rotation.x = damp(this.kneeL.rotation.x, 1.15 * tuck, 9, dt);
      this.kneeR.rotation.x = damp(this.kneeR.rotation.x, 0.42 * tuck, 9, dt);
      this.footL.rotation.x = damp(this.footL.rotation.x, 0.3 * tuck, 9, dt);
      this.footR.rotation.x = damp(this.footR.rotation.x, -0.16 * tuck, 9, dt);
      this.shoulderL.rotation.x = damp(this.shoulderL.rotation.x, -0.5 * tuck, 8, dt);
      this.shoulderR.rotation.x = damp(this.shoulderR.rotation.x, -0.28 * tuck, 8, dt);
      this.elbowL.rotation.x = damp(this.elbowL.rotation.x, -0.55 * tuck, 8, dt);
      this.elbowR.rotation.x = damp(this.elbowR.rotation.x, -0.35 * tuck, 8, dt);
      this.hips.position.y = damp(this.hips.position.y, 0.94 - 0.04 * tuck, 8, dt);
    } else {
      this.legL.rotation.x = s * 0.78 * strideAmp;
      this.legR.rotation.x = -s * 0.78 * strideAmp;
      this.kneeL.rotation.x = Math.max(0, -Math.sin(this.stride + 0.5)) * 1.25 * strideAmp;
      this.kneeR.rotation.x = Math.max(0, -Math.sin(this.stride + 0.5 + Math.PI)) * 1.25 * strideAmp;
      this.footL.rotation.x = -0.12 + s * 0.3 * strideAmp;
      this.footR.rotation.x = -0.12 - s * 0.3 * strideAmp;
      this.shoulderL.rotation.x = -s * 0.6 * strideAmp - 0.05;
      this.shoulderR.rotation.x = s * 0.6 * strideAmp - 0.05;
      this.shoulderL.rotation.z = 0.16 + strideAmp * 0.05;
      this.shoulderR.rotation.z = -0.16 - strideAmp * 0.05;
      this.elbowL.rotation.x = -0.28 - Math.max(0, s) * 0.4 * strideAmp;
      this.elbowR.rotation.x = -0.3 - Math.max(0, -s) * 0.4 * strideAmp;
      this.hips.position.y = damp(
        this.hips.position.y,
        0.94 + Math.abs(Math.sin(this.stride)) * 0.05 * strideAmp + Math.sin(t * 1.5) * 0.006,
        12,
        dt,
      );
    }

    const breath = Math.sin(t * 1.55) * 0.02;
    this.torso.rotation.x = damp(this.torso.rotation.x, 0.04 + strideAmp * 0.17, 8, dt);
    this.torso.rotation.y = damp(this.torso.rotation.y, c * 0.11 * strideAmp, 8, dt);
    this.torso.rotation.z = damp(this.torso.rotation.z, -s * 0.04 * strideAmp, 8, dt);
    this.torso.position.y = breath * 0.5;

    this.head.rotation.y = damp(this.head.rotation.y, -c * 0.07 * strideAmp, 7, dt);
    this.head.rotation.x = damp(this.head.rotation.x, -0.05 + breath * 0.6, 7, dt);

    const sway = Math.sin(t * 1.3) * 0.05 + speed01 * 0.16;
    this.ponytail.rotation.x = damp(this.ponytail.rotation.x, 0.36 + speed01 * 0.5 + Math.sin(t * 2.2) * 0.05, 6, dt);
    this.ponytail.rotation.z = damp(this.ponytail.rotation.z, Math.sin(t * 1.7) * 0.09 + sway * 0.3, 6, dt);
    this.cape.rotation.x = damp(this.cape.rotation.x, -0.12 - speed01 * 0.7, 5, dt);
    this.cape.rotation.z = damp(this.cape.rotation.z, Math.sin(t * 1.1) * 0.04 - 0.02, 5, dt);

    if (state.attack >= 0) {
      const p = clamp(state.attack, 0, 1);
      let windup = 0;
      let slash = 0;
      let recover = 0;
      if (p < 0.34) {
        windup = p / 0.34;
      } else if (p < 0.58) {
        windup = 1 - (p - 0.34) / 0.24;
        slash = (p - 0.34) / 0.24;
      } else {
        recover = 1 - (p - 0.58) / 0.42;
      }
      const wind = windup * 1.0;
      const cut = slash * 1.0;

      this.shoulderR.rotation.x = -1.25 * wind - 0.15 + 2.1 * cut + recover * -0.35;
      this.shoulderR.rotation.z = -0.2 - 1.0 * wind + 1.5 * cut;
      this.shoulderR.rotation.y = -0.5 * wind + 1.15 * cut;
      this.elbowR.rotation.x = -0.9 * wind - 0.25 - 0.5 * cut;
      this.shoulderL.rotation.x = 0.45 * wind + 0.2 - 0.5 * cut;
      this.shoulderL.rotation.z = 0.5 + 0.4 * wind;
      this.elbowL.rotation.x = -0.7 - 0.5 * wind;
      this.torso.rotation.y = -0.55 * wind + 0.85 * cut;
      this.torso.rotation.x = 0.1 + 0.1 * wind + 0.22 * cut;
      this.hips.rotation.y = -0.22 * wind + 0.34 * cut;
      this.legR.rotation.x = -0.3 * cut + 0.2 * wind;
      this.legL.rotation.x = 0.25 * wind - 0.2 * cut;
    } else {
      this.hips.rotation.y = damp(this.hips.rotation.y, 0, 9, dt);
    }

    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 3.4);
    const flash = Math.max(this.hurtFlash, state.hurt);
    for (const mat of this.flashMats) {
      mat.emissive.setRGB(flash * 0.9, flash * 0.12, flash * 0.12);
      mat.emissiveIntensity = flash > 0.01 ? 1.4 : 0;
    }

    if (state.dead) {
      this.root.rotation.z = dampAngle(this.root.rotation.z, Math.PI * 0.42, 4, dt);
      this.root.position.y = damp(this.root.position.y, -0.25, 3, dt);
    }
  }

  triggerHurt(): void {
    this.hurtFlash = 1;
  }
}
