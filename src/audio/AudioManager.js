export class AudioManager {
  constructor(settings) {
    this.settings = settings;
  }
  async unlock() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.connect(this.context.destination);
      this.noise = this.context.createBuffer(
        1,
        this.context.sampleRate * 0.25,
        this.context.sampleRate,
      );
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    await this.context.resume();
  }
  play(type, volume = 1) {
    if (!this.context || this.context.state !== "running") return;
    const ctx = this.context,
      now = ctx.currentTime;
    this.master.gain.value = this.settings.volume * this.settings.effects;
    const gain = ctx.createGain();
    gain.connect(this.master);
    const gunshot = ["shot", "heavyPistol", "sniper"].includes(type);
    const noisy = gunshot || ["step", "land", "reload", "bolt"].includes(type);
    const duration =
      {
        shot: 0.16,
        heavyPistol: 0.22,
        sniper: 0.25,
        bolt: 0.1,
        scope: 0.04,
        step: 0.065,
        land: 0.1,
        reload: 0.12,
        hit: 0.055,
        kill: 0.2,
        empty: 0.04,
        jump: 0.07,
        ready: 0.14,
      }[type] || 0.07;
    let source, filter;
    if (noisy) {
      source = ctx.createBufferSource();
      source.buffer = this.noise;
      filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value =
        type === "sniper"
          ? 1400
          : type === "heavyPistol"
            ? 2100
            : type === "shot"
              ? 2800
              : 600;
      source.connect(filter);
      filter.connect(gain);
    } else {
      source = ctx.createOscillator();
      source.type = "triangle";
      const frequency =
        { hit: 780, kill: 1050, empty: 180, jump: 130, ready: 600 }[type] ||
        400;
      source.frequency.setValueAtTime(frequency, now);
      source.frequency.exponentialRampToValueAtTime(
        frequency * 0.65,
        now + duration,
      );
      source.connect(gain);
    }
    gain.gain.setValueAtTime(
      (type === "sniper"
        ? 0.65
        : type === "heavyPistol"
          ? 0.52
          : type === "shot"
            ? 0.42
            : 0.18) * volume,
      now,
    );
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.start(now);
    source.stop(now + duration);
    source.onended = () => {
      source.disconnect();
      filter?.disconnect();
      gain.disconnect();
    };
    if (type === "sniper" || type === "heavyPistol") {
      const body = ctx.createOscillator(),
        envelope = ctx.createGain();
      body.type = "triangle";
      body.frequency.setValueAtTime(type === "sniper" ? 105 : 150, now);
      body.frequency.exponentialRampToValueAtTime(40, now + 0.16);
      envelope.gain.setValueAtTime(0.28 * volume, now);
      envelope.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      body.connect(envelope);
      envelope.connect(this.master);
      body.start(now);
      body.stop(now + 0.2);
      body.onended = () => {
        body.disconnect();
        envelope.disconnect();
      };
    }
  }
  suspend() {
    if (this.context?.state === "running")
      this.context.suspend().catch(() => {});
  }
}
