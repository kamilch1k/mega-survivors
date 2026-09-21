import type { UpgradeDef } from '../data/upgrades';

const STYLE = `
.lv-root {
  position: fixed; inset: 0; display: none; place-items: center;
  background: radial-gradient(ellipse at center, rgba(10,14,26,0.72), rgba(4,6,12,0.92));
  backdrop-filter: blur(3px); z-index: 40;
  font-family: 'Segoe UI', system-ui, sans-serif;
}
.lv-root.open { display: grid; }
.lv-wrap { text-align: center; }
.lv-title { font-size: 13px; letter-spacing: 6px; text-transform: uppercase; color: #9fc0ea; margin-bottom: 4px; }
.lv-sub { font-size: 30px; font-weight: 300; letter-spacing: 2px; color: #eaf2ff; margin-bottom: 4px;
  text-shadow: 0 0 22px rgba(90,150,255,0.55); }
.lv-hint { font-size: 11px; letter-spacing: 2px; color: #7f95b8; margin-bottom: 26px; text-transform: uppercase; }
.lv-cards { display: flex; gap: 18px; justify-content: center; }
.lv-card {
  width: 224px; min-height: 218px; padding: 20px 18px 22px; cursor: pointer;
  background: linear-gradient(180deg, rgba(24,32,50,0.96), rgba(11,15,26,0.98));
  border: 1px solid rgba(140,175,220,0.32); border-radius: 5px;
  box-shadow: 0 14px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(190,215,255,0.14);
  transition: transform 0.14s ease, border-color 0.14s ease, box-shadow 0.14s ease;
  display: flex; flex-direction: column; align-items: center; gap: 12px;
}
.lv-card:hover {
  transform: translateY(-6px);
  border-color: rgba(140,200,255,0.9);
  box-shadow: 0 18px 50px rgba(0,0,0,0.7), 0 0 26px rgba(80,150,255,0.4), inset 0 1px 0 rgba(200,225,255,0.2);
}
.lv-icon {
  width: 62px; height: 62px; border-radius: 50%;
  display: grid; place-items: center; font-size: 22px; font-weight: 700; color: #dceaff;
  background: radial-gradient(circle at 34% 28%, rgba(120,175,255,0.55), rgba(16,22,38,0.95));
  border: 1px solid rgba(150,195,255,0.55); box-shadow: 0 0 20px rgba(70,140,255,0.35) inset;
}
.lv-name { font-size: 15px; font-weight: 600; color: #f0f6ff; letter-spacing: 0.4px; }
.lv-desc { font-size: 12px; color: #a8bcd8; line-height: 1.5; }
.lv-level { font-size: 10px; letter-spacing: 1.6px; text-transform: uppercase; color: #7d94b6; margin-top: auto; }
.lv-card.rare .lv-icon { background: radial-gradient(circle at 34% 28%, rgba(255,210,120,0.6), rgba(30,20,10,0.95)); border-color: rgba(255,205,120,0.7); }
.lv-card.rare .lv-name { color: #ffe6ad; }
`;

export class LevelUpUI {
  private root: HTMLElement;
  private cards: HTMLElement;
  private open = false;
  private pending: UpgradeDef[] = [];
  private onPick: ((u: UpgradeDef) => void) | null = null;

  constructor() {
    const style = document.createElement('style');
    style.textContent = STYLE;
    document.head.appendChild(style);

    this.root = document.createElement('div');
    this.root.className = 'lv-root';
    this.root.innerHTML = `
      <div class="lv-wrap">
        <div class="lv-title">Level Ascended</div>
        <div class="lv-sub">Choose Your Path</div>
        <div class="lv-hint">Click a card &nbsp;·&nbsp; game paused</div>
        <div class="lv-cards"></div>
      </div>
    `;
    document.body.appendChild(this.root);
    this.cards = this.root.querySelector('.lv-cards') as HTMLElement;

    window.addEventListener('keydown', (e) => {
      if (!this.open) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 3 && this.pending[n - 1]) this.pick(this.pending[n - 1]);
    });
  }

  get isOpen(): boolean {
    return this.open;
  }

  show(choices: UpgradeDef[], onPick: (u: UpgradeDef) => void): void {
    this.pending = choices;
    this.onPick = onPick;
    this.open = true;
    this.cards.innerHTML = '';
    choices.forEach((u, i) => {
      const card = document.createElement('div');
      card.className = `lv-card${u.weight >= 8 ? '' : ' rare'}`;
      card.innerHTML = `
        <div class="lv-icon">${u.name.charAt(0)}</div>
        <div class="lv-name">${u.name}</div>
        <div class="lv-desc">${u.desc}</div>
        <div class="lv-level">${i + 1} &nbsp;·&nbsp; max ${u.maxLevel}</div>
      `;
      card.addEventListener('click', () => this.pick(u));
      this.cards.appendChild(card);
    });
    this.root.classList.add('open');
    if (document.pointerLockElement) document.exitPointerLock();
  }

  private pick(u: UpgradeDef): void {
    this.open = false;
    this.root.classList.remove('open');
    const cb = this.onPick;
    this.onPick = null;
    this.pending = [];
    cb?.(u);
  }
}
