import type { Player } from '../gameplay/player';

export type UpgradeDef = {
  id: string;
  name: string;
  desc: string;
  maxLevel: number;
  weight: number;
  apply: (p: Player) => void;
};

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'might',
    name: 'Might of the Ancients',
    desc: '+22% glaive damage',
    maxLevel: 8,
    weight: 10,
    apply: (p) => {
      p.damage *= 1.22;
    },
  },
  {
    id: 'swiftness',
    name: 'Swift Strikes',
    desc: '+16% attack speed',
    maxLevel: 8,
    weight: 10,
    apply: (p) => {
      p.attackSpeed *= 1.16;
    },
  },
  {
    id: 'fleet',
    name: 'Windstep',
    desc: '+11% movement speed',
    maxLevel: 6,
    weight: 8,
    apply: (p) => {
      p.moveSpeedMul *= 1.11;
    },
  },
  {
    id: 'vitality',
    name: 'Vitality',
    desc: '+25 max HP, heal 25',
    maxLevel: 8,
    weight: 9,
    apply: (p) => {
      p.maxHp += 25;
      p.hp = Math.min(p.maxHp, p.hp + 25);
    },
  },
  {
    id: 'magnet',
    name: 'Soul Magnet',
    desc: '+35% pickup radius',
    maxLevel: 5,
    weight: 6,
    apply: (p) => {
      p.pickupRadius *= 1.35;
    },
  },
  {
    id: 'keen',
    name: 'Keen Edge',
    desc: '+7% critical chance',
    maxLevel: 6,
    weight: 7,
    apply: (p) => {
      p.critChance = Math.min(0.85, p.critChance + 0.07);
    },
  },
  {
    id: 'brutal',
    name: 'Brutal Edge',
    desc: '+40% critical damage',
    maxLevel: 5,
    weight: 6,
    apply: (p) => {
      p.critMul += 0.4;
    },
  },
  {
    id: 'wide',
    name: 'Wide Cleave',
    desc: '+20% attack arc',
    maxLevel: 4,
    weight: 7,
    apply: (p) => {
      p.arcBonus += 0.2;
    },
  },
  {
    id: 'echo',
    name: 'Echo Blade',
    desc: '+1 echoing glaive sweep',
    maxLevel: 3,
    weight: 5,
    apply: (p) => {
      p.echoBlades += 1;
    },
  },
  {
    id: 'orb',
    name: 'Shard of the Orb',
    desc: '+1 orbiting arcane shard',
    maxLevel: 5,
    weight: 8,
    apply: (p) => {
      p.orbCount += 1;
      p.orbDamage += 6;
    },
  },
  {
    id: 'lightning',
    name: 'Stormcall',
    desc: 'Periodic lightning strikes nearby foes',
    maxLevel: 5,
    weight: 7,
    apply: (p) => {
      p.lightningLevel += 1;
    },
  },
  {
    id: 'frost',
    name: 'Frost Nova',
    desc: 'Periodic burst that chills enemies',
    maxLevel: 5,
    weight: 7,
    apply: (p) => {
      p.frostLevel += 1;
    },
  },
  {
    id: 'siphon',
    name: 'Siphoning Edge',
    desc: 'Heal 2% of damage dealt',
    maxLevel: 5,
    weight: 5,
    apply: (p) => {
      p.lifesteal += 0.02;
    },
  },
  {
    id: 'reaper',
    name: "Reaper's Reach",
    desc: '+18% damage, +12% crit chance',
    maxLevel: 4,
    weight: 5,
    apply: (p) => {
      p.damage *= 1.18;
      p.critChance = Math.min(0.9, p.critChance + 0.12);
    },
  },
  {
    id: 'overcharge',
    name: 'Overcharge',
    desc: '+30% damage, -10% max HP',
    maxLevel: 3,
    weight: 4,
    apply: (p) => {
      p.damage *= 1.3;
      p.maxHp = Math.max(40, Math.round(p.maxHp * 0.9));
      p.hp = Math.min(p.hp, p.maxHp);
    },
  },
];

export function rollUpgrades(
  levels: Record<string, number>,
  count: number,
  rng: () => number,
): UpgradeDef[] {
  const pool = UPGRADES.filter((u) => (levels[u.id] ?? 0) < u.maxLevel);
  const picked: UpgradeDef[] = [];
  const available = [...pool];
  while (picked.length < count && available.length > 0) {
    let total = 0;
    for (const u of available) total += u.weight;
    let roll = rng() * total;
    let index = 0;
    for (let i = 0; i < available.length; i++) {
      roll -= available[i].weight;
      if (roll <= 0) {
        index = i;
        break;
      }
    }
    picked.push(available[index]);
    available.splice(index, 1);
  }
  return picked;
}
