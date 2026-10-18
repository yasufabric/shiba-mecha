export class Sfx {
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;

  unlock(): void {
    if (!this.ctx) {
      const Context = window.AudioContext;
      this.ctx = new Context();
      const length = Math.floor(this.ctx.sampleRate * 0.45);
      const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1;
      this.noise = buffer;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  shot(scale: number): void {
    this.blip(480 + scale * 70, 0.055, "square", 0.035);
  }

  explode(big: boolean): void {
    this.burst(big ? 0.42 : 0.2, big ? 0.42 : 0.22, big ? 880 : 1500);
    if (big) this.blip(160, 0.28, "sawtooth", 0.05);
  }

  hurt(): void {
    this.blip(86, 0.16, "sine", 0.07);
    this.burst(0.14, 0.16, 360);
  }

  land(): void {
    this.burst(0.16, 0.18, 280);
  }

  private blip(freq: number, duration: number, type: OscillatorType, gain: number): void {
    if (!this.ctx) return;
    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.55), time + duration);
    amp.gain.setValueAtTime(gain, time);
    amp.gain.exponentialRampToValueAtTime(0.001, time + duration);
    osc.connect(amp);
    amp.connect(this.ctx.destination);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  private burst(duration: number, gain: number, freq: number): void {
    if (!this.ctx || !this.noise) return;
    const time = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(freq, time);
    filter.frequency.exponentialRampToValueAtTime(140, time + duration);
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(gain, time);
    amp.gain.exponentialRampToValueAtTime(0.001, time + duration);
    source.connect(filter);
    filter.connect(amp);
    amp.connect(this.ctx.destination);
    source.start(time);
    source.stop(time + duration + 0.02);
  }
}
