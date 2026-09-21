import * as THREE from 'three';

type Arc = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
  active: boolean;
};

export class SlashArcs {
  readonly group = new THREE.Group();
  private arcs: Arc[] = [];

  constructor(count = 6, inner = 0.7, outer = 3.5, arcDeg = 130) {
    const theta = (arcDeg * Math.PI) / 180;
    const thetaStart = -theta * 0.5;
    const geometry = new THREE.RingGeometry(inner, outer, 28, 3, thetaStart, theta);
    geometry.rotateX(-Math.PI / 2);

    const colors = new Float32Array(geometry.attributes.position.count * 3);
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getZ(i));
      const t = (r - inner) / (outer - inner);
      const a = 0.15 + t * 0.85;
      colors[i * 3] = 0.42 * a;
      colors[i * 3 + 1] = 0.78 * a;
      colors[i * 3 + 2] = 1.0 * a;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    for (let i = 0; i < count; i++) {
      const material = new THREE.MeshBasicMaterial({
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        opacity: 0,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.arcs.push({ mesh, material, life: 0, maxLife: 0.3, active: false });
    }
  }

  trigger(x: number, y: number, z: number, facing: number, scale = 1, life = 0.28): void {
    const arc = this.arcs.find((a) => !a.active) ?? this.arcs[0];
    arc.active = true;
    arc.life = life;
    arc.maxLife = life;
    arc.mesh.visible = true;
    arc.mesh.position.set(x, y, z);
    arc.mesh.rotation.y = facing;
    arc.mesh.scale.setScalar(scale);
  }

  update(dt: number): void {
    for (const arc of this.arcs) {
      if (!arc.active) continue;
      arc.life -= dt;
      if (arc.life <= 0) {
        arc.active = false;
        arc.mesh.visible = false;
        continue;
      }
      const t = arc.life / arc.maxLife;
      arc.material.opacity = t * t * 0.95;
      const grow = 1 + (1 - t) * 0.22;
      arc.mesh.scale.multiplyScalar(1 + (grow - 1) * 0.35);
    }
  }
}
