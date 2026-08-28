export class SoundEngine {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;
  private spinInterval: any = null;

  constructor() {
    this.init();
  }

  public init() {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass && !this.ctx) {
        this.ctx = new AudioContextClass();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    } catch (e) {
      console.warn('Audio not supported', e);
    }
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  public isEnabled() {
    return this.enabled;
  }

  private playTone(freq: number, type: OscillatorType, duration: number, vol = 0.1) {
    if (!this.enabled || !this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
      
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }

  public click() {
    this.playTone(600, 'sine', 0.1, 0.1);
  }

  public spin() {
    if (!this.enabled) return;
    let t = 0;
    if (this.spinInterval) clearInterval(this.spinInterval);
    
    this.spinInterval = setInterval(() => {
       this.playTone(200 + Math.random() * 100, 'square', 0.05, 0.02);
       t += 100;
       if (t > 1500) clearInterval(this.spinInterval);
    }, 100);
  }

  public win() {
    if (!this.enabled || !this.ctx) return;
    try {
      // ascending arpeggio
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        setTimeout(() => this.playTone(freq, 'square', 0.3, 0.1), i * 120);
      });
    } catch (e) {}
  }

  public bigWin() {
    if (!this.enabled || !this.ctx) return;
    try {
      [440, 554, 659, 880, 1108, 1318].forEach((freq, i) => {
        setTimeout(() => this.playTone(freq, 'sine', 0.4, 0.15), i * 150);
      });
    } catch (e) {}
  }
}

export const soundEngine = new SoundEngine();
