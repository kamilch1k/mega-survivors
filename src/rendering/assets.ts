import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

let loader: GLTFLoader | null = null;

export type LoadedModel = {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
};

export async function loadGLTF(url: string): Promise<LoadedModel | null> {
  try {
    loader ??= new GLTFLoader();
    const gltf = await loader.loadAsync(url);
    return { scene: gltf.scene, animations: gltf.animations ?? [] };
  } catch {
    return null;
  }
}

export async function loadModel(url: string): Promise<THREE.Object3D | null> {
  const loaded = await loadGLTF(url);
  return loaded ? loaded.scene : null;
}

function tuneMaterials(root: THREE.Object3D, envIntensity: number, shadows: boolean): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = shadows;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      const std = mat as THREE.MeshStandardMaterial;
      if (std.isMeshStandardMaterial) {
        std.envMapIntensity = envIntensity;
        if (std.map) std.map.anisotropy = 4;
      }
    }
  });
}

function measureBox(model: THREE.Object3D): THREE.Box3 {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  model.traverse((o) => {
    const skinned = o as THREE.SkinnedMesh;
    if (skinned.isSkinnedMesh) {
      skinned.computeBoundingBox();
      const bb = skinned.boundingBox;
      if (bb && !bb.isEmpty()) {
        for (let i = 0; i < 8; i++) {
          v.set(
            i & 1 ? bb.max.x : bb.min.x,
            i & 2 ? bb.max.y : bb.min.y,
            i & 4 ? bb.max.z : bb.min.z,
          );
          box.expandByPoint(v.applyMatrix4(skinned.matrixWorld));
        }
      }
      return;
    }
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && mesh.geometry) {
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      const bb = mesh.geometry.boundingBox;
      if (bb && !bb.isEmpty()) {
        for (let i = 0; i < 8; i++) {
          v.set(
            i & 1 ? bb.max.x : bb.min.x,
            i & 2 ? bb.max.y : bb.min.y,
            i & 4 ? bb.max.z : bb.min.z,
          );
          box.expandByPoint(v.applyMatrix4(mesh.matrixWorld));
        }
      }
    }
  });
  return box;
}

export function prepareModel(model: THREE.Object3D, targetHeight: number, envIntensity = 1): number {
  let box = measureBox(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  const scale = size.y > 0.0001 ? targetHeight / size.y : 1;
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);

  box = measureBox(model);
  const center = new THREE.Vector3();
  box.getCenter(center);
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box.min.y;

  tuneMaterials(model, envIntensity, true);
  return scale;
}

function firstMesh(root: THREE.Object3D): THREE.Mesh | null {
  let found: THREE.Mesh | null = null;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (found === null && mesh.isMesh) found = mesh;
  });
  return found as THREE.Mesh | null;
}

export type InstancedSource = {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
};

export function meshToInstanced(model: THREE.Object3D, targetHeight: number): InstancedSource | null {
  const mesh = firstMesh(model);
  if (!mesh) return null;

  model.updateMatrixWorld(true);
  const geometry = mesh.geometry.clone();
  geometry.applyMatrix4(mesh.matrixWorld);
  if (geometry.index) geometry.toNonIndexed();

  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const box = new THREE.Box3().setFromBufferAttribute(pos);
  const size = new THREE.Vector3();
  box.getSize(size);
  const scale = size.y > 0.0001 ? targetHeight / size.y : 1;

  geometry.scale(scale, scale, scale);
  geometry.computeBoundingBox();
  const box2 = geometry.boundingBox as THREE.Box3;
  const cx = (box2.min.x + box2.max.x) * 0.5;
  const cz = (box2.min.z + box2.max.z) * 0.5;
  geometry.translate(-cx, -box2.min.y, -cz);
  geometry.computeBoundingSphere();
  geometry.computeVertexNormals();

  const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material).clone();
  const std = material as THREE.MeshStandardMaterial;
  if (std.isMeshStandardMaterial) {
    std.envMapIntensity = 1;
    std.vertexColors = false;
  }
  return { geometry, material };
}
