import * as THREE from 'three';
import { CAMERA } from '../data/config';
import { clamp, damp } from '../core/mathx';

export class FollowCamera {
  readonly camera: THREE.PerspectiveCamera;
  yaw = 0;
  pitch = CAMERA.pitch;
  distance = CAMERA.distance;
  private position = new THREE.Vector3(0, 20, 20);
  private target = new THREE.Vector3();
  private shakeAmp = 0;
  private shakeTime = 0;
  private fov = CAMERA.fov;

  constructor(aspect: number, private domElement: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(CAMERA.fov, aspect, 0.1, 1400);
    this.domElement.addEventListener('click', () => {
      if (document.pointerLockElement !== this.domElement) {
        void this.domElement.requestPointerLock();
      }
    });
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== this.domElement) return;
      this.yaw -= e.movementX * 0.0026;
      this.pitch = clamp(this.pitch + e.movementY * 0.0021, CAMERA.pitchMin, CAMERA.pitchMax);
    });
  }

  addShake(amount: number): void {
    this.shakeAmp = Math.min(this.shakeAmp + amount, 0.6);
  }

  update(
    dt: number,
    targetPos: THREE.Vector3,
    velocity: THREE.Vector3,
    sprint01: number,
    immediate = false,
  ): void {
    const look = targetPos.clone();
    look.y += CAMERA.lookHeight;
    look.x += velocity.x * CAMERA.offsetFromMovement * 0.1;
    look.z += velocity.z * CAMERA.offsetFromMovement * 0.1;

    if (immediate) this.target.copy(look);
    else {
      this.target.x = damp(this.target.x, look.x, CAMERA.targetLambda, dt);
      this.target.y = damp(this.target.y, look.y, CAMERA.targetLambda * 0.7, dt);
      this.target.z = damp(this.target.z, look.z, CAMERA.targetLambda, dt);
    }

    const cosPitch = Math.cos(this.pitch);
    const offset = new THREE.Vector3(
      Math.sin(this.yaw) * cosPitch,
      Math.sin(this.pitch),
      Math.cos(this.yaw) * cosPitch,
    ).multiplyScalar(this.distance);
    offset.y += CAMERA.height * 0.18;

    const desired = this.target.clone().add(offset);
    if (immediate) this.position.copy(desired);
    else {
      this.position.x = damp(this.position.x, desired.x, CAMERA.positionLambda, dt);
      this.position.y = damp(this.position.y, desired.y, CAMERA.positionLambda * 0.8, dt);
      this.position.z = damp(this.position.z, desired.z, CAMERA.positionLambda, dt);
    }

    this.shakeAmp = Math.max(0, this.shakeAmp - dt * 1.9);
    this.shakeTime += dt;
    let shakeX = 0;
    let shakeY = 0;
    if (this.shakeAmp > 0.001) {
      const a = this.shakeAmp * this.shakeAmp;
      shakeX = Math.sin(this.shakeTime * 46) * a * 0.42;
      shakeY = Math.cos(this.shakeTime * 39) * a * 0.34;
    }

    this.camera.position.copy(this.position);
    this.camera.position.x += shakeX;
    this.camera.position.y += shakeY;
    this.camera.lookAt(this.target);
    this.camera.rotateZ(shakeX * 0.25);

    const targetFov = CAMERA.fov + (CAMERA.sprintFov - CAMERA.fov) * sprint01;
    this.fov = damp(this.fov, targetFov, CAMERA.fovLambda, dt);
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  forward(preview = false): THREE.Vector3 {
    const yaw = this.yaw;
    void preview;
    return new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)).normalize();
  }
}
