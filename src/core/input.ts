export type InputFrame = {
  moveX: number;
  moveZ: number;
  jump: boolean;
  dash: boolean;
};

export const emptyInput = (): InputFrame => ({
  moveX: 0,
  moveZ: 0,
  jump: false,
  dash: false,
});

export class InputSource {
  private keys = new Set<string>();
  private scripted: InputFrame | null = null;

  attach(target: Window): void {
    target.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.code === 'Space') e.preventDefault();
      this.keys.add(e.code);
    });
    target.addEventListener('keyup', (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    });
    target.addEventListener('blur', () => {
      this.keys.clear();
    });
  }

  useScripted(frame: Partial<InputFrame> | null): void {
    this.scripted = frame
      ? {
          moveX: frame.moveX ?? 0,
          moveZ: frame.moveZ ?? 0,
          jump: frame.jump ?? false,
          dash: frame.dash ?? false,
        }
      : null;
  }

  isScripted(): boolean {
    return this.scripted !== null;
  }

  sample(out: InputFrame): InputFrame {
    if (this.scripted) {
      out.moveX = this.scripted.moveX;
      out.moveZ = this.scripted.moveZ;
      out.jump = this.scripted.jump;
      out.dash = this.scripted.dash;
      return out;
    }

    let x = 0;
    let z = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) z -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) z += 1;
    const len = Math.hypot(x, z);

    out.moveX = len > 0 ? x / len : 0;
    out.moveZ = len > 0 ? z / len : 0;
    out.jump = this.keys.has('Space');
    out.dash = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    return out;
  }
}
