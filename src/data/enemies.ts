export type EnemyKind = {
  id: string;
  name: string;
  hp: number;
  speed: number;
  radius: number;
  scale: number;
  tint: number;
  damage: number;
  xp: number;
  contactDps: number;
};

export const ENEMY_KINDS: Record<string, EnemyKind> = {
  wolf: {
    id: 'wolf',
    name: 'Corrupted Wolf',
    hp: 22,
    speed: 4.7,
    radius: 0.45,
    scale: 1.0,
    tint: 0xffffff,
    damage: 8,
    xp: 1,
    contactDps: 9,
  },
  goblin: {
    id: 'goblin',
    name: 'Goblin Raider',
    hp: 46,
    speed: 3.7,
    radius: 0.45,
    scale: 0.86,
    tint: 0xa8d47c,
    damage: 11,
    xp: 2,
    contactDps: 12,
  },
  wisp: {
    id: 'wisp',
    name: 'Arcane Wisp',
    hp: 20,
    speed: 2.7,
    radius: 0.65,
    scale: 0.74,
    tint: 0x9fe0ff,
    damage: 9,
    xp: 3,
    contactDps: 16,
  },
  knight: {
    id: 'knight',
    name: 'Corrupted Knight',
    hp: 260,
    speed: 3.0,
    radius: 0.9,
    scale: 1.7,
    tint: 0xff9a8a,
    damage: 20,
    xp: 14,
    contactDps: 26,
  },
};

export type WaveTier = {
  from: number;
  to: number;
  interval: number;
  batch: number;
  kinds: string[];
  eliteEvery: number;
};

export const WAVE_TIERS: WaveTier[] = [
  { from: 0, to: 120, interval: 1.5, batch: 3, kinds: ['wolf'], eliteEvery: 0 },
  { from: 120, to: 300, interval: 1.05, batch: 6, kinds: ['wolf', 'goblin'], eliteEvery: 0 },
  { from: 300, to: 480, interval: 0.72, batch: 9, kinds: ['wolf', 'goblin', 'wisp'], eliteEvery: 45 },
  { from: 480, to: 600, interval: 0.5, batch: 12, kinds: ['wolf', 'goblin', 'wisp'], eliteEvery: 30 },
];

export const BOSS_TIME = 600;
