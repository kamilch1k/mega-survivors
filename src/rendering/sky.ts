import * as THREE from 'three';
import { AMBIENT, RENDER, SUN } from '../data/config';
import { fbm } from '../core/mathx';

export function sunDirection(out = new THREE.Vector3()): THREE.Vector3 {
  const az = SUN.azimuth;
  const el = SUN.elevation;
  return out.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)).normalize();
}

function cloudTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(x * 0.028, y * 0.028, 5, 4242);
      const edge = Math.min(x, y, size - 1 - x, size - 1 - y) / (size * 0.5);
      const a = Math.pow(Math.max(0, n * 1.5 - 0.62), 1.45) * Math.min(1, edge * 3.2);
      const i = (y * size + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 253;
      img.data[i + 2] = 250;
      img.data[i + 3] = Math.min(255, a * 900);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export function buildSky(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'sky';

  const sunDir = sunDirection();

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(900, 32, 20),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uZenith: { value: new THREE.Color(0x4f83d8) },
        uHorizon: { value: new THREE.Color(0xdcecf7) },
        uSunDir: { value: sunDir.clone() },
        uSunColor: { value: new THREE.Color(0xfff3d0) },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vDir;
        uniform vec3 uZenith;
        uniform vec3 uHorizon;
        uniform vec3 uSunColor;
        uniform vec3 uSunDir;
        void main() {
          float t = clamp(vDir.y * 1.15 + 0.06, 0.0, 1.0);
          vec3 col = mix(uHorizon, uZenith, pow(t, 0.72));
          float sun = pow(max(dot(normalize(vDir), normalize(uSunDir)), 0.0), 26.0);
          float halo = pow(max(dot(normalize(vDir), normalize(uSunDir)), 0.0), 4.0);
          col += uSunColor * sun * 0.85;
          col += uSunColor * halo * 0.16;
          col = mix(col, uHorizon * 1.02, pow(1.0 - t, 5.0) * 0.6);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }),
  );
  dome.frustumCulled = false;
  group.add(dome);

  const cloudMat = new THREE.MeshBasicMaterial({
    map: cloudTexture(),
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    fog: false,
    side: THREE.DoubleSide,
  });

  const cloudGeo = new THREE.PlaneGeometry(170, 170);
  cloudGeo.rotateX(-Math.PI / 2);
  const clouds = new THREE.InstancedMesh(cloudGeo, cloudMat, 26);
  clouds.name = 'clouds';
  clouds.frustumCulled = false;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  let seed = 5150;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < 26; i++) {
    p.set((rand() - 0.5) * 900, 110 + rand() * 60, (rand() - 0.5) * 900);
    const scale = 1.1 + rand() * 2.3;
    s.set(scale, 1, scale * (0.7 + rand() * 0.6));
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2);
    m.compose(p, q, s);
    clouds.setMatrixAt(i, m);
  }
  clouds.instanceMatrix.needsUpdate = true;
  group.add(clouds);

  return group;
}

export function buildLighting(scene: THREE.Scene): THREE.DirectionalLight {
  const hemi = new THREE.HemisphereLight(AMBIENT.sky, AMBIENT.ground, AMBIENT.intensity);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(SUN.color, SUN.intensity);
  const dir = sunDirection();
  sun.position.copy(dir.clone().multiplyScalar(120));
  sun.castShadow = true;
  sun.shadow.mapSize.set(RENDER.shadowMapSize, RENDER.shadowMapSize);
  const cam = sun.shadow.camera;
  cam.near = 1;
  cam.far = 320;
  cam.left = -RENDER.shadowRange;
  cam.right = RENDER.shadowRange;
  cam.top = RENDER.shadowRange;
  cam.bottom = -RENDER.shadowRange;
  sun.shadow.bias = -0.0012;
  sun.shadow.normalBias = 0.045;
  scene.add(sun);
  scene.add(sun.target);

  return sun;
}

export function applyFog(scene: THREE.Scene): void {
  scene.fog = new THREE.Fog(RENDER.fogColor, RENDER.fogNear, RENDER.fogFar);
}
