import { fbm } from '../core/mathx';

export const tallGrassMask = (x: number, z: number): number => {
  const patch = fbm(x * 0.019, z * 0.019, 3, 3131);
  const fine = fbm(x * 0.07, z * 0.07, 2, 6161);
  return Math.max(0, Math.min(1, (patch - 0.33) * 3.6 + (fine - 0.5) * 0.5));
};

export const flowerMask = (x: number, z: number): number => {
  const patch = fbm(x * 0.04, z * 0.04, 2, 7272);
  return Math.max(0, Math.min(1, (patch - 0.42) * 2.6));
};

export const broadLeafMask = (x: number, z: number): number => {
  const patch = fbm(x * 0.03 + 12, z * 0.03 - 7, 2, 9191);
  const edge = Math.max(0, Math.min(0.85, (Math.hypot(x, z) - 70) / 60));
  return Math.max(0, Math.min(1, (patch - 0.5) * 2.4)) * 0.5 + edge * 0.5;
};

export const dryGrassMask = (x: number, z: number): number => {
  const patch = fbm(x * 0.026 + 40, z * 0.026 - 20, 3, 1441);
  return Math.max(0, Math.min(1, (patch - 0.44) * 2.4));
};
