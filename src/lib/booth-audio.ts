// Tiny WebAudio-based alert beep generator. No asset, works offline.
// Usage:
//   const eng = new AudioEngine();
//   await eng.unlock(); // call from a user gesture
//   eng.setVolume(0.8); eng.setMuted(false);
//   eng.startLoop(); // beeps every interval until stopLoop()
//   eng.stopLoop();

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private loopTimer: ReturnType<typeof setInterval> | null = null;
  private muted = false;
  private volume = 0.8;
  private unlocked = false;
  intervalMs = 2500;

  isUnlocked() {
    return this.unlocked;
  }

  async unlock(): Promise<boolean> {
    try {
      if (typeof window === "undefined") return false;
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return false;
      if (!this.ctx) {
        this.ctx = new Ctor();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.volume;
        this.masterGain.connect(this.ctx.destination);
        // Self-heal if the context gets suspended/interrupted by the OS later.
        this.ctx.onstatechange = () => {
          const state = this.ctx?.state;
          if (this.unlocked && (state === "suspended" || (state as string) === "interrupted")) {
            this.ctx?.resume().catch(() => {});
          }
        };
      }
      if (this.ctx.state !== "running") await this.ctx.resume();
      // Play a silent buffer to fully unlock iOS audio.
      const buf = this.ctx.createBuffer(1, 1, 22050);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.ctx.destination);
      src.start(0);
      this.unlocked = true;
      return true;
    } catch (e) {
      console.error("Audio unlock failed", e);
      return false;
    }
  }

  /** Public hook: call from visibilitychange/focus to wake the context after iOS suspends it. */
  resume() {
    if (!this.unlocked || !this.ctx) return;
    if (this.ctx.state !== "running") {
      this.ctx.resume().catch(() => {});
    }
  }

  /** Fire-and-forget: ensure ctx is running before scheduling sound. */
  private ensureRunning() {
    if (!this.ctx) return;
    if (this.ctx.state !== "running") {
      this.ctx.resume().catch(() => {});
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(m ? 0 : this.volume, this.ctx.currentTime, 0.01);
    }
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.masterGain && this.ctx && !this.muted) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.01);
    }
  }

  beep() {
    if (!this.ctx || !this.masterGain || this.muted) return;
    this.ensureRunning();
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const playOne = (start: number, freq: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.value = freq;
      g.gain.value = 0;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.5, start + 0.01);
      g.gain.setValueAtTime(0.5, start + 0.15);
      g.gain.linearRampToValueAtTime(0, start + 0.18);
      o.connect(g);
      g.connect(this.masterGain!);
      o.start(start);
      o.stop(start + 0.2);
    };
    playOne(t0, 880);
    playOne(t0 + 0.22, 1175);
  }

  // Pleasant ascending two-note bell chime (E6 -> A6). New-order signal.
  chime() {
    if (!this.ctx || !this.masterGain || this.muted) return;
    this.ensureRunning();
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const playBell = (start: number, freq: number, dur: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.6, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      o.connect(g);
      g.connect(this.masterGain!);
      o.start(start);
      o.stop(start + dur + 0.05);
    };
    playBell(t0, 1318.5, 0.45); // E6
    playBell(t0 + 0.18, 1760, 0.6); // A6
  }

  // Distinct descending three-note motif for "order edited" — clearly different from chime().
  editChime() {
    if (!this.ctx || !this.masterGain || this.muted) return;
    this.ensureRunning();
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const playNote = (start: number, freq: number, dur: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sawtooth";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.35, start + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      o.connect(g);
      g.connect(this.masterGain!);
      o.start(start);
      o.stop(start + dur + 0.05);
    };
    playNote(t0, 1760, 0.18);       // A6
    playNote(t0 + 0.16, 1318.5, 0.18); // E6
    playNote(t0 + 0.32, 1046.5, 0.32); // C6
  }

  startLoop() {
    if (this.loopTimer) return;
    this.beep();
    this.loopTimer = setInterval(() => {
      this.ensureRunning();
      this.beep();
    }, this.intervalMs);
  }

  stopLoop() {
    if (this.loopTimer) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
  }

  dispose() {
    this.stopLoop();
    try {
      this.ctx?.close();
    } catch {
      /* noop */
    }
    this.ctx = null;
    this.masterGain = null;
  }
}
