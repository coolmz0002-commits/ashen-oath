class ProceduralAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientStarted = false;
  public muted = false;

  public unlock() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.55;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (!this.ambientStarted && this.ctx && this.masterGain) {
      this.startAmbientDrone();
    }
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.55, this.ctx.currentTime, 0.04);
    }
  }

  public setAmbientActive(active: boolean) {
    if (!this.ambientGain || !this.ctx) return;
    this.ambientGain.gain.setTargetAtTime(active ? 0.07 : 0.015, this.ctx.currentTime, 0.25);
  }

  private startAmbientDrone() {
    if (!this.ctx || !this.masterGain) return;
    this.ambientStarted = true;
    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.02;
    this.ambientGain.connect(this.masterGain);

    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = 55;

    const osc2 = this.ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = 82.4;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 145;

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(this.ambientGain);
    osc1.start();
    osc2.start();
  }

  private createNoiseBuffer(duration: number): AudioBuffer | null {
    if (!this.ctx) return null;
    const sampleRate = this.ctx.sampleRate;
    const length = Math.max(1, Math.floor(sampleRate * duration));
    const buf = this.ctx.createBuffer(1, length, sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  public playSwing(heavy = false) {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const dur = heavy ? 0.26 : 0.14;
    const buf = this.createNoiseBuffer(dur);
    if (!buf) return;

    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const pitchJitter = 0.92 + Math.random() * 0.16;
    filter.frequency.setValueAtTime((heavy ? 520 : 950) * pitchJitter, now);
    filter.frequency.exponentialRampToValueAtTime((heavy ? 180 : 320) * pitchJitter, now + dur);
    filter.Q.value = 2.2;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(heavy ? 0.36 : 0.22, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(now);
  }

  public playHit(heavy = false) {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const jitter = 0.92 + Math.random() * 0.16;

    // Low visceral thud
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime((heavy ? 135 : 175) * jitter, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + (heavy ? 0.22 : 0.12));

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(heavy ? 0.55 : 0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (heavy ? 0.24 : 0.13));

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + (heavy ? 0.25 : 0.14));

    // Crisp flesh/steel tear noise burst
    const buf = this.createNoiseBuffer(heavy ? 0.15 : 0.08);
    if (buf) {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.value = heavy ? 1400 : 2100;
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(heavy ? 0.32 : 0.2, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + (heavy ? 0.15 : 0.08));
      src.connect(hp);
      hp.connect(nGain);
      nGain.connect(this.masterGain);
      src.start(now);
    }
  }

  public playExecute() {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    // Deep cinematic sub boom + razor steel shear
    const sub = this.ctx.createOscillator();
    sub.type = 'triangle';
    sub.frequency.setValueAtTime(110, now);
    sub.frequency.exponentialRampToValueAtTime(26, now + 0.45);
    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0.65, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.46);
    sub.connect(subGain);
    subGain.connect(this.masterGain);
    sub.start(now);
    sub.stop(now + 0.47);

    const ring = this.ctx.createOscillator();
    ring.type = 'sawtooth';
    ring.frequency.setValueAtTime(780, now + 0.04);
    ring.frequency.exponentialRampToValueAtTime(180, now + 0.36);
    const ringGain = this.ctx.createGain();
    ringGain.gain.setValueAtTime(0.24, now + 0.04);
    ringGain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
    ring.connect(ringGain);
    ringGain.connect(this.masterGain);
    ring.start(now + 0.04);
    ring.stop(now + 0.38);
  }

  public playParry() {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    [980, 1470, 2240].forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.96, now + 0.38);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.22 / (idx + 1), now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.4);
    });
  }

  public playShieldClang() {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(210, now + 0.16);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  public playJump(doubleJump = false) {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(doubleJump ? 220 : 140, now);
    osc.frequency.exponentialRampToValueAtTime(doubleJump ? 360 : 230, now + 0.11);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  public playDash() {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const buf = this.createNoiseBuffer(0.18);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1200, now);
    lp.frequency.exponentialRampToValueAtTime(240, now + 0.18);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.24, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    src.connect(lp);
    lp.connect(g);
    g.connect(this.masterGain);
    src.start(now);
  }

  public playHurt() {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.2);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.32, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.23);
  }

  public playShrine() {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    [330, 440, 659].forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, now + i * 0.06);
      g.gain.linearRampToValueAtTime(0.14, now + i * 0.06 + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.7);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.72);
    });
  }

  public playGateShatter() {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.6);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.4, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.62);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.65);
  }
}

export const audioEngine = new ProceduralAudioEngine();
