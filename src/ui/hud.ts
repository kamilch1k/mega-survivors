const STYLE = `
.ms-hud { position: fixed; inset: 0; pointer-events: none; font-family: 'Segoe UI', system-ui, sans-serif; color: #e8eefc; }
.ms-panel {
  position: absolute; background: linear-gradient(180deg, rgba(16,20,32,0.86), rgba(10,13,22,0.9));
  border: 1px solid rgba(150,178,220,0.28);
  box-shadow: 0 6px 22px rgba(0,0,0,0.5), inset 0 1px 0 rgba(190,215,255,0.14);
  border-radius: 4px;
}
.ms-tl { top: 18px; left: 18px; padding: 10px 14px 12px; min-width: 232px; }
.ms-tc { top: 18px; left: 50%; transform: translateX(-50%); padding: 8px 22px; text-align: center; }
.ms-bc { bottom: 22px; left: 50%; transform: translateX(-50%); width: 46vw; min-width: 320px; padding: 6px 8px 8px; }
.ms-br { bottom: 22px; right: 18px; padding: 10px; display: flex; gap: 8px; }
.ms-name { font-size: 11px; letter-spacing: 2.4px; text-transform: uppercase; color: #9db4d8; margin-bottom: 6px; }
.ms-row { display: flex; align-items: center; gap: 10px; }
.ms-level {
  width: 30px; height: 30px; display: grid; place-items: center; font-weight: 700; font-size: 14px;
  color: #dce9ff; border-radius: 50%;
  background: radial-gradient(circle at 35% 28%, rgba(120,170,255,0.5), rgba(20,28,46,0.9));
  border: 1px solid rgba(150,190,255,0.5); box-shadow: 0 0 12px rgba(80,140,255,0.35) inset;
}
.ms-hpwrap { flex: 1; }
.ms-bar { position: relative; height: 13px; border-radius: 3px; overflow: hidden; background: rgba(6,9,16,0.9); border: 1px solid rgba(140,170,210,0.3); }
.ms-fill { position: absolute; inset: 0; transform-origin: left center; transition: transform 0.12s linear; }
.ms-hp .ms-fill { background: linear-gradient(180deg, #ff6b62, #b8241d 55%, #7d1410); box-shadow: 0 0 10px rgba(255,90,80,0.5); }
.ms-xp .ms-fill { background: linear-gradient(180deg, #8fd4ff, #3b86ff 55%, #1f4fd0); box-shadow: 0 0 12px rgba(90,160,255,0.6); }
.ms-bar-label { position: absolute; inset: 0; display: grid; place-items: center; font-size: 10px; letter-spacing: 0.6px; text-shadow: 0 1px 2px #000; }
.ms-timer { font-size: 27px; font-weight: 300; letter-spacing: 3px; font-variant-numeric: tabular-nums; }
.ms-sub { font-size: 10px; letter-spacing: 1.8px; text-transform: uppercase; color: #93a9cb; margin-top: 2px; }
.ms-xpmeta { display: flex; justify-content: space-between; font-size: 10px; letter-spacing: 1.4px; color: #9db4d8; padding: 0 2px 4px; text-transform: uppercase; }
.ms-slot {
  width: 42px; height: 42px; border-radius: 4px; display: grid; place-items: center; font-size: 9px;
  letter-spacing: 0.6px; color: #cfdbf0; text-align: center; line-height: 1.15;
  background: linear-gradient(180deg, rgba(28,36,56,0.9), rgba(14,18,30,0.92));
  border: 1px solid rgba(150,180,220,0.3); box-shadow: inset 0 1px 0 rgba(190,215,255,0.12);
}
.ms-slot.on { border-color: rgba(130,190,255,0.75); box-shadow: 0 0 12px rgba(80,150,255,0.4); color: #eaf3ff; }
.ms-abilities { display: flex; gap: 8px; }
.ms-num { position: absolute; font-weight: 700; font-size: 15px; text-shadow: 0 2px 4px rgba(0,0,0,0.85); will-change: transform, opacity; }
.ms-fps { position: absolute; top: 18px; right: 18px; font: 11px ui-monospace, monospace; color: rgba(180,205,240,0.6); }
`;

export type HudState = {
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  xpToNext: number;
  time: number;
  enemies: number;
  fps: number;
  abilities: { name: string; cooldown01: number }[];
};

export class Hud {
  private hpFill: HTMLElement;
  private xpFill: HTMLElement;
  private hpLabel: HTMLElement;
  private xpMeta: HTMLElement;
  private levelEl: HTMLElement;
  private timerEl: HTMLElement;
  private enemyEl: HTMLElement;
  private fpsEl: HTMLElement;
  private abilityRow: HTMLElement;
  private popups: HTMLElement[] = [];

  constructor(parent: HTMLElement = document.body) {
    const style = document.createElement('style');
    style.textContent = STYLE;
    document.head.appendChild(style);

    const root = document.createElement('div');
    root.className = 'ms-hud';
    root.innerHTML = `
      <div class="ms-panel ms-tl">
        <div class="ms-name">Arcane Vanguard</div>
        <div class="ms-row">
          <div class="ms-level"><span id="ms-level">1</span></div>
          <div class="ms-hpwrap">
            <div class="ms-bar ms-hp"><div class="ms-fill"></div><div class="ms-bar-label"></div></div>
          </div>
        </div>
      </div>
      <div class="ms-panel ms-tc">
        <div class="ms-timer">00:00</div>
        <div class="ms-sub">Enemies <span id="ms-enemies">0</span></div>
      </div>
      <div class="ms-panel ms-bc">
        <div class="ms-xpmeta"><span>XP</span><span id="ms-xpmeta">0 / 12</span></div>
        <div class="ms-bar ms-xp"><div class="ms-fill"></div></div>
      </div>
      <div class="ms-panel ms-br"><div class="ms-abilities"></div></div>
      <div class="ms-fps">-- fps</div>
    `;
    parent.appendChild(root);

    this.hpFill = root.querySelector('.ms-hp .ms-fill') as HTMLElement;
    this.hpLabel = root.querySelector('.ms-hp .ms-bar-label') as HTMLElement;
    this.xpFill = root.querySelector('.ms-xp .ms-fill') as HTMLElement;
    this.xpMeta = root.querySelector('#ms-xpmeta') as HTMLElement;
    this.levelEl = root.querySelector('#ms-level') as HTMLElement;
    this.timerEl = root.querySelector('.ms-timer') as HTMLElement;
    this.enemyEl = root.querySelector('#ms-enemies') as HTMLElement;
    this.fpsEl = root.querySelector('.ms-fps') as HTMLElement;
    this.abilityRow = root.querySelector('.ms-abilities') as HTMLElement;
    this.popupLayer = root;
  }

  private popupLayer: HTMLElement;

  update(s: HudState): void {
    const hp01 = Math.max(0, s.hp / s.maxHp);
    this.hpFill.style.transform = `scaleX(${hp01})`;
    this.hpLabel.textContent = `${Math.ceil(Math.max(0, s.hp))} / ${s.maxHp}`;
    this.xpFill.style.transform = `scaleX(${Math.min(1, s.xpToNext > 0 ? s.xp / s.xpToNext : 0)})`;
    this.xpMeta.textContent = `${Math.floor(s.xp)} / ${s.xpToNext}`;
    this.levelEl.textContent = String(s.level);
    const total = Math.max(0, s.time);
    const mm = String(Math.floor(total / 60)).padStart(2, '0');
    const ss = String(Math.floor(total % 60)).padStart(2, '0');
    this.timerEl.textContent = `${mm}:${ss}`;
    this.enemyEl.textContent = String(s.enemies);
    this.fpsEl.textContent = `${Math.round(s.fps)} fps`;

    while (this.abilityRow.children.length < s.abilities.length) {
      const slot = document.createElement('div');
      slot.className = 'ms-slot on';
      this.abilityRow.appendChild(slot);
    }
    s.abilities.forEach((ab, i) => {
      const slot = this.abilityRow.children[i] as HTMLElement;
      slot.textContent = ab.name;
      slot.style.opacity = ab.cooldown01 < 1 ? '0.45' : '1';
    });
  }

  damageNumber(screenX: number, screenY: number, amount: number, crit: boolean): void {
    let el = this.popups.find((p) => !p.dataset.active);
    if (!el) {
      el = document.createElement('div');
      el.className = 'ms-num';
      this.popupLayer.appendChild(el);
      this.popups.push(el);
    }
    el.dataset.active = '1';
    el.textContent = crit ? `${Math.round(amount)}!` : String(Math.round(amount));
    el.style.color = crit ? '#ffd977' : '#ffffff';
    el.style.fontSize = crit ? '22px' : '15px';
    el.style.left = `${screenX}px`;
    el.style.top = `${screenY}px`;
    el.style.transform = 'translate(-50%,-50%)';
    el.style.opacity = '1';

    const start = performance.now();
    const drift = (Math.random() - 0.5) * 46;
    const rise = crit ? 74 : 52;
    const tick = () => {
      const t = (performance.now() - start) / (crit ? 900 : 720);
      if (t >= 1) {
        el!.dataset.active = '';
        el!.style.opacity = '0';
        return;
      }
      el!.style.transform = `translate(calc(-50% + ${drift * t}px), calc(-50% - ${rise * t}px)) scale(${1 + (1 - t) * (crit ? 0.5 : 0.25)})`;
      el!.style.opacity = String(1 - t * t);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}
