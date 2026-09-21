export const WORLD = {
  mapSize: 320,
  half: 160,
  segments: 200,
  spawnRadius: 18,
  playableHalf: 150,
};

export const TERRAIN = {
  baseAmp: 5.2,
  baseFreq: 0.0062,
  detailAmp: 1.35,
  detailFreq: 0.021,
  noiseSeed: 20260921,
  edgeRise: 7.5,
  edgeStart: 118,
};

export const PLAYER = {
  radius: 0.42,
  height: 1.72,
  accel: 58,
  airAccel: 14,
  maxWalk: 9.2,
  maxSprint: 13.4,
  friction: 11,
  airFriction: 1.2,
  gravity: 32,
  jumpSpeed: 11.5,
  dodgeSpeed: 26,
  dodgeTime: 0.22,
  dodgeCooldown: 0.75,
  maxSlope: 0.72,
  rotationLambda: 14,
  maxHp: 100,
};

export const CAMERA = {
  fov: 58,
  sprintFov: 66,
  distance: 6.8,
  height: 1.9,
  lookHeight: 1.05,
  pitch: 0.72,
  pitchMin: 0.3,
  pitchMax: 1.2,
  positionLambda: 9,
  targetLambda: 12,
  fovLambda: 4,
  offsetFromMovement: 0.42,
};

export const VEGETATION = {
  shortGrass: 24000,
  tallGrass: 16000,
  flowers: 3000,
  broadleaf: 1600,
  shortRadius: 62,
  tallRadius: 150,
  cullRadius: 0,
};

export const RENDER = {
  shadowMapSize: 2048,
  shadowRange: 46,
  fogNear: 70,
  fogFar: 320,
  fogColor: 0xd2e3f2,
  exposure: 1.06,
};

export const SUN = {
  azimuth: 0.72,
  elevation: 0.62,
  color: 0xfff1d6,
  intensity: 2.75,
};

export const ENEMY = {
  radius: 0.5,
  cylinder: 0.7,
  speed: 4.2,
  hp: 24,
  separation: 1.9,
  separationForce: 30,
  knockDamping: 6,
  wolfHeight: 1.15,
};

export const AMBIENT = {
  sky: 0xbcd9ff,
  ground: 0x5c6640,
  intensity: 1.15,
};
