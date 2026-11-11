/** Synthesized sound effects (no audio files to ship). Starts on first user gesture. */
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
const note = (k: number) => 440 * Math.pow(2, SCALE[Math.max(0, Math.min(k, SCALE.length - 1))] / 12);

export class Sfx {
  muted = false;
  private ctx: AudioContext | null = null;

  unlock(): void {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AC();
      } catch {
        return;
      }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  private tone(freq: number, dur = 0.15, type: OscillatorType = 'sine', vol = 0.18, slide = 0, delay = 0): void {
    if (this.muted || !this.ctx) return;
    const a = this.ctx;
    const t = a.currentTime + delay;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  drop(): void {
    this.tone(150, 0.12, 'triangle', 0.25, 0.5);
  }
  /** Pitch climbs with the chain so long cascades sound like they are building. */
  pop(chain: number, i: number): void {
    const d = i * 0.035;
    this.tone(note(chain - 1 + (i % 2)), 0.18, 'triangle', 0.16, 0, d);
    this.tone(note(chain + 1), 0.12, 'sine', 0.06, 0, d);
  }
  rise(): void {
    this.tone(90, 0.4, 'sawtooth', 0.08, 0.6);
  }
  blocked(): void {
    this.tone(110, 0.08, 'square', 0.05);
  }
  over(): void {
    [4, 2, 0].forEach((k, i) => this.tone(note(k) / 2, 0.3, 'triangle', 0.15, 0, i * 0.16));
  }
  toggleChime(): void {
    this.tone(note(4), 0.12, 'triangle', 0.15);
  }
}
