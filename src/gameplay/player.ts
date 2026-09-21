import * as THREE from 'three';
import { PLAYER, WORLD } from '../data/config';
import { clamp, dampAngle } from '../core/mathx';
import { terrainHeight, terrainSlope } from '../rendering/terrain';
import type { InputFrame } from '../core/input';

export class Player {
  readonly position = new THREE.Vector3(0, 0, 0);
  readonly prevPosition = new THREE.Vector3(0, 0, 0);
  readonly velocity = new THREE.Vector3();
  facing = 0;
  grounded = true;
  airTime = 0;
  sprint01 = 0;
  hp = PLAYER.maxHp;
  maxHp = PLAYER.maxHp;
  level = 1;
  xp = 0;
  xpToNext = 12;
  kills = 0;
  damage = 10;
  attackSpeed = 1;
  moveSpeedMul = 1;
  pickupRadius = 2.2;
  critChance = 0.08;
  critMul = 2.1;
  arcBonus = 0;
  echoBlades = 0;
  orbCount = 0;
  orbDamage = 0;
  lightningLevel = 0;
  frostLevel = 0;
  lifesteal = 0;
  attackRange = 4.6;
  dashCooldown = 0;
  invuln = 0;
  private dodgeTimer = 0;
  private dodgeDir = new THREE.Vector3();
  private jumpHeld = false;
  private dashHeld = false;

  constructor() {
    this.position.y = terrainHeight(0, 0);
  }

  get speed01(): number {
    return Math.hypot(this.velocity.x, this.velocity.z) / PLAYER.maxSprint;
  }

  update(dt: number, input: InputFrame, cameraYaw: number): void {
    this.prevPosition.copy(this.position);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.invuln = Math.max(0, this.invuln - dt);

    const sin = Math.sin(cameraYaw);
    const cos = Math.cos(cameraYaw);
    const wishX = input.moveX * cos + input.moveZ * sin;
    const wishZ = input.moveZ * cos - input.moveX * sin;
    const wishLen = Math.hypot(wishX, wishZ);
    const hasWish = wishLen > 0.001;
    const dirX = hasWish ? wishX / wishLen : 0;
    const dirZ = hasWish ? wishZ / wishLen : 0;

    const sprinting = hasWish && !input.dash;
    const targetSpeed = (sprinting ? PLAYER.maxSprint : PLAYER.maxWalk) * this.moveSpeedMul;
    this.sprint01 = dampAngle(this.sprint01, sprinting ? 1 : 0, 5, dt);

    if (input.dash && !this.dashHeld && this.dashCooldown <= 0 && this.dodgeTimer <= 0) {
      this.dodgeTimer = PLAYER.dodgeTime;
      this.dashCooldown = PLAYER.dodgeCooldown;
      this.invuln = PLAYER.dodgeTime + 0.12;
      const fx = hasWish ? dirX : -Math.sin(this.facing);
      const fz = hasWish ? dirZ : -Math.cos(this.facing);
      this.dodgeDir.set(fx, 0, fz);
      this.velocity.x = fx * PLAYER.dodgeSpeed;
      this.velocity.z = fz * PLAYER.dodgeSpeed;
    }
    this.dashHeld = input.dash;

    if (this.dodgeTimer > 0) {
      this.dodgeTimer -= dt;
      const t = clamp(this.dodgeTimer / PLAYER.dodgeTime, 0, 1);
      const burst = 0.35 + t * 0.65;
      this.velocity.x = this.dodgeDir.x * PLAYER.dodgeSpeed * burst;
      this.velocity.z = this.dodgeDir.z * PLAYER.dodgeSpeed * burst;
    } else {
      const accel = this.grounded ? PLAYER.accel : PLAYER.airAccel;
      if (hasWish) {
        this.velocity.x += dirX * accel * dt;
        this.velocity.z += dirZ * accel * dt;
        const speed = Math.hypot(this.velocity.x, this.velocity.z);
        if (speed > targetSpeed) {
          const k = targetSpeed / speed;
          this.velocity.x *= k;
          this.velocity.z *= k;
        }
      } else {
        const friction = this.grounded ? PLAYER.friction : PLAYER.airFriction;
        const drop = friction * dt;
        const speed = Math.hypot(this.velocity.x, this.velocity.z);
        if (speed > 0.001) {
          const k = Math.max(0, speed - drop * Math.max(1, speed * 0.35)) / speed;
          this.velocity.x *= k;
          this.velocity.z *= k;
        }
      }
    }

    if (input.jump && !this.jumpHeld && this.grounded) {
      this.velocity.y = PLAYER.jumpSpeed;
      this.grounded = false;
    }
    this.jumpHeld = input.jump;
    this.velocity.y -= PLAYER.gravity * dt;

    const prevX = this.position.x;
    const prevZ = this.position.z;
    let nextX = this.position.x + this.velocity.x * dt;
    let nextZ = this.position.z + this.velocity.z * dt;

    const limit = WORLD.playableHalf;
    nextX = clamp(nextX, -limit, limit);
    nextZ = clamp(nextZ, -limit, limit);

    const slope = terrainSlope(nextX, nextZ);
    const slider = this.velocity.y > 1 ? 0.6 : 1;
    if (slope > PLAYER.maxSlope && slider > 0) {
      const backX = prevX + (nextX - prevX) * 0.25;
      const backZ = prevZ + (nextZ - prevZ) * 0.25;
      nextX = backX;
      nextZ = backZ;
      this.velocity.x *= 0.6;
      this.velocity.z *= 0.6;
    }

    this.position.x = nextX;
    this.position.z = nextZ;
    this.position.y += this.velocity.y * dt;

    const ground = terrainHeight(this.position.x, this.position.z);
    if (this.position.y <= ground) {
      if (!this.grounded && this.velocity.y < -14) {
        this.velocity.y = 0;
      }
      this.position.y = ground;
      this.velocity.y = 0;
      this.grounded = true;
      this.airTime = 0;
    } else {
      this.grounded = this.position.y - ground < 0.06;
      this.airTime += dt;
    }

    const moving = Math.hypot(this.velocity.x, this.velocity.z);
    if (moving > 0.6) {
      const target = Math.atan2(-this.velocity.x, -this.velocity.z);
      this.facing = dampAngle(this.facing, target, PLAYER.rotationLambda, dt);
    }
  }

  addXp(amount: number): boolean {
    this.xp += amount;
    let leveled = false;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      this.xpToNext = Math.round(this.xpToNext * 1.32 + 5);
      leveled = true;
    }
    return leveled;
  }

  radialDir(): THREE.Vector3 {
    return new THREE.Vector3(-Math.sin(this.facing), 0, -Math.cos(this.facing));
  }
}
