export type HarnessSnapshot = Record<string, unknown>;

export type HarnessImpl = {
  setPaused: (v: boolean) => void;
  stepTicks: (n: number) => number;
  setInput: (frame: Record<string, number | boolean> | null) => void;
  snapshot: () => HarnessSnapshot;
  teleport: (x: number, z: number) => void;
  setCamera: (yaw: number, pitch?: number) => void;
  setCameraDistance: (d: number) => void;
  forceClip: (name: string | null) => void;
  setWeaponLocal: (
    px: number,
    py: number,
    pz: number,
    rx: number,
    ry: number,
    rz: number,
    scale: number,
  ) => void;
  spawnEnemies: (n: number) => number;
  setVegetation: (visible: boolean) => void;
  fps: () => number;
};

export type HarnessApi = HarnessImpl & {
  version: string;
  ready: boolean;
  errors: string[];
};

export const VERSION = '0.1.0';

export function installHarness(impl: HarnessImpl): HarnessApi {
  const api: HarnessApi = {
    version: VERSION,
    ready: false,
    errors: [],
    ...impl,
  };
  (window as unknown as { __ms: HarnessApi }).__ms = api;
  return api;
}
