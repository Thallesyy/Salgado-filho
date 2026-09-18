import { frame } from "./frame";
import { journey } from "./journey";
import { clamp, smoothstep, window4 } from "./math";
import { PHASE } from "./world";

/**
 * A fully synthesised soundscape (Web Audio, no audio files):
 * kerb ambience with passing cars, the terminal's reverberant murmur and
 * PA chime, the security beep, cabin hum and seatbelt chimes, a jet engine
 * that spools with the aircraft's thrust, wind at altitude, and a slow pad
 * score that swells over the Guaíba. Every layer's level is a function of
 * scroll progress, so scrubbing backwards rewinds the mix too.
 */
class Soundscape {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private layers!: Record<string, GainNode>;
  private engine!: { lowpass: BiquadFilterNode; whine: OscillatorNode; whineGain: GainNode; hiss: BiquadFilterNode };
  private reverbSend!: GainNode;
  private pad!: { filter: BiquadFilterNode; voices: OscillatorNode[] };
  private raf = 0;
  private muted = false;
  private lastP = 0;
  private nextCar = 0;
  private nextChime = 6;
  private carBuf: AudioBuffer | null = null;
  private listeners = new Set<(muted: boolean) => void>();

  get isMuted() {
    return this.muted;
  }

  onChange(fn: (muted: boolean) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  start(muted: boolean) {
    this.muted = muted;
    if (!this.ctx) this.build();
    this.ctx!.resume();
    this.applyMute();
    cancelAnimationFrame(this.raf);
    const loop = () => {
      this.update();
      this.raf = requestAnimationFrame(loop);
    };
    loop();
    this.listeners.forEach((l) => l(this.muted));
  }

  toggle() {
    if (!this.ctx) return this.start(false);
    this.muted = !this.muted;
    this.ctx.resume();
    this.applyMute();
    this.listeners.forEach((l) => l(this.muted));
  }

  private applyMute() {
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, this.ctx.currentTime, 0.4);
  }

  private noiseBuffer(ctx: AudioContext, color: "white" | "pink" | "brown", seconds = 4) {
    const len = ctx.sampleRate * seconds;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (color === "white") d[i] = w * 0.5;
        else if (color === "pink") {
          b0 = 0.99886 * b0 + w * 0.0555179;
          b1 = 0.99332 * b1 + w * 0.0750759;
          b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856;
          b4 = 0.55 * b4 + w * 0.5329522;
          b5 = -0.7616 * b5 - w * 0.016898;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
          b6 = w * 0.115926;
        } else {
          last = (last + 0.02 * w) / 1.02;
          d[i] = last * 3.5;
        }
      }
    }
    return buf;
  }

  private loop(buf: AudioBuffer) {
    const s = this.ctx!.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    s.loopStart = Math.random();
    s.start(0, Math.random() * buf.duration);
    return s;
  }

  private build() {
    const ctx = new AudioContext();
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 3;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(comp).connect(ctx.destination);

    // generated impulse response for a large, soft hall
    const irLen = ctx.sampleRate * 3.2;
    const ir = ctx.createBuffer(2, irLen, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < irLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 3.2);
    }
    const reverb = ctx.createConvolver();
    reverb.buffer = ir;
    const reverbOut = ctx.createGain();
    reverbOut.gain.value = 0.55;
    reverb.connect(reverbOut).connect(this.master);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 1;
    this.reverbSend.connect(reverb);

    const white = this.noiseBuffer(ctx, "white");
    const pink = this.noiseBuffer(ctx, "pink");
    const brown = this.noiseBuffer(ctx, "brown");
    const layer = (name: string, toReverb = 0) => {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(this.master);
      if (toReverb) {
        const send = ctx.createGain();
        send.gain.value = toReverb;
        g.connect(send).connect(this.reverbSend);
      }
      return [name, g] as const;
    };
    this.layers = Object.fromEntries([
      layer("outdoor"),
      layer("jets"),
      layer("hall", 0.8),
      layer("cabin"),
      layer("engine"),
      layer("wind"),
      layer("pad", 0.9),
      layer("fx", 0.6),
    ]);

    // kerb: brown rumble of traffic
    const out = this.loop(brown);
    const outLp = ctx.createBiquadFilter();
    outLp.type = "lowpass";
    outLp.frequency.value = 420;
    out.connect(outLp).connect(this.layers.outdoor);

    // distant jets: slow swells of band-limited pink noise
    const jets = this.loop(pink);
    const jetBp = ctx.createBiquadFilter();
    jetBp.type = "bandpass";
    jetBp.frequency.value = 650;
    jetBp.Q.value = 0.6;
    const jetLfo = ctx.createOscillator();
    const jetLfoGain = ctx.createGain();
    jetLfo.frequency.value = 0.045;
    jetLfoGain.gain.value = 0.4;
    const jetAmp = ctx.createGain();
    jetAmp.gain.value = 0.6;
    jetLfo.connect(jetLfoGain).connect(jetAmp.gain);
    jetLfo.start();
    jets.connect(jetBp).connect(jetAmp).connect(this.layers.jets);

    // terminal murmur: formant-ish band of pink noise with a breathing LFO
    const hall = this.loop(pink);
    const hallBp = ctx.createBiquadFilter();
    hallBp.type = "bandpass";
    hallBp.frequency.value = 520;
    hallBp.Q.value = 0.9;
    const hallBp2 = ctx.createBiquadFilter();
    hallBp2.type = "peaking";
    hallBp2.frequency.value = 1600;
    hallBp2.gain.value = 6;
    const hallAmp = ctx.createGain();
    hallAmp.gain.value = 0.8;
    const hallLfo = ctx.createOscillator();
    const hallLfoGain = ctx.createGain();
    hallLfo.frequency.value = 0.23;
    hallLfoGain.gain.value = 0.18;
    hallLfo.connect(hallLfoGain).connect(hallAmp.gain);
    hallLfo.start();
    hall.connect(hallBp).connect(hallBp2).connect(hallAmp).connect(this.layers.hall);

    // cabin: low electrical hum + air-conditioning hiss
    const hum = ctx.createOscillator();
    hum.type = "sine";
    hum.frequency.value = 118;
    const humGain = ctx.createGain();
    humGain.gain.value = 0.08;
    hum.connect(humGain).connect(this.layers.cabin);
    hum.start();
    const air = this.loop(pink);
    const airLp = ctx.createBiquadFilter();
    airLp.type = "lowpass";
    airLp.frequency.value = 900;
    air.connect(airLp).connect(this.layers.cabin);

    // engine: rumble (brown noise through a thrust-driven low-pass), N2 whine, intake hiss
    const rumble = this.loop(brown);
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 120;
    lowpass.Q.value = 0.7;
    rumble.connect(lowpass).connect(this.layers.engine);
    const whine = ctx.createOscillator();
    whine.type = "sawtooth";
    whine.frequency.value = 160;
    const whineBp = ctx.createBiquadFilter();
    whineBp.type = "bandpass";
    whineBp.Q.value = 6;
    whineBp.frequency.value = 1200;
    const whineGain = ctx.createGain();
    whineGain.gain.value = 0;
    whine.connect(whineBp).connect(whineGain).connect(this.layers.engine);
    whine.start();
    const hissSrc = this.loop(white);
    const hiss = ctx.createBiquadFilter();
    hiss.type = "bandpass";
    hiss.frequency.value = 2400;
    hiss.Q.value = 0.8;
    const hissGain = ctx.createGain();
    hissGain.gain.value = 0.05;
    hissSrc.connect(hiss).connect(hissGain).connect(this.layers.engine);
    this.engine = { lowpass, whine, whineGain, hiss };

    // wind at altitude
    const wind = this.loop(pink);
    const windLp = ctx.createBiquadFilter();
    windLp.type = "lowpass";
    windLp.frequency.value = 700;
    const windLfo = ctx.createOscillator();
    const windLfoGain = ctx.createGain();
    windLfo.frequency.value = 0.08;
    windLfoGain.gain.value = 260;
    windLfo.connect(windLfoGain).connect(windLp.frequency);
    windLfo.start();
    wind.connect(windLp).connect(this.layers.wind);

    // pad: Dmaj9 voicing, detuned saws through a slowly breathing low-pass
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = "lowpass";
    padFilter.frequency.value = 700;
    padFilter.Q.value = 0.4;
    const padLfo = ctx.createOscillator();
    const padLfoGain = ctx.createGain();
    padLfo.frequency.value = 0.035;
    padLfoGain.gain.value = 380;
    padLfo.connect(padLfoGain).connect(padFilter.frequency);
    padLfo.start();
    padFilter.connect(this.layers.pad);
    const notes = [73.42, 146.83, 220.0, 277.18, 329.63, 440.0];
    const voices: OscillatorNode[] = [];
    notes.forEach((f, i) => {
      for (const det of [-6, 7]) {
        const o = ctx.createOscillator();
        o.type = i < 2 ? "triangle" : "sawtooth";
        o.frequency.value = f;
        o.detune.value = det;
        const g = ctx.createGain();
        g.gain.value = i < 2 ? 0.05 : 0.018;
        o.connect(g).connect(padFilter);
        o.start();
        voices.push(o);
      }
    });
    this.pad = { filter: padFilter, voices };
  }

  private tone(freq: number, start: number, dur: number, gain: number, type: OscillatorType = "sine") {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(gain, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(this.layers.fx);
    o.start(start);
    o.stop(start + dur + 0.05);
  }

  /** Brazilian-airport style three-note PA chime. */
  private chime() {
    const t = this.ctx!.currentTime + 0.05;
    [659.25, 523.25, 392.0].forEach((f, i) => {
      this.tone(f, t + i * 0.42, 1.6, 0.16);
      this.tone(f * 2, t + i * 0.42, 0.8, 0.03);
    });
  }

  private seatbelt() {
    const t = this.ctx!.currentTime + 0.02;
    this.tone(1046.5, t, 1.2, 0.14);
    this.tone(1318.5, t + 0.02, 1.0, 0.05);
  }

  private beep() {
    const t = this.ctx!.currentTime + 0.01;
    this.tone(1760, t, 0.18, 0.06, "square");
  }

  private car() {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.carBuf ??= this.noiseBuffer(ctx, "pink", 3);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 0.7;
    bp.frequency.setValueAtTime(260, t);
    bp.frequency.linearRampToValueAtTime(900, t + 1.2);
    bp.frequency.linearRampToValueAtTime(300, t + 2.8);
    const pan = ctx.createStereoPanner();
    const dir = Math.random() > 0.5 ? 1 : -1;
    pan.pan.setValueAtTime(-dir, t);
    pan.pan.linearRampToValueAtTime(dir, t + 2.8);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.5, t + 1.3);
    g.gain.linearRampToValueAtTime(0, t + 2.8);
    src.connect(bp).connect(pan).connect(g).connect(this.layers.outdoor);
    src.start(t);
    src.stop(t + 3);
  }

  private update() {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const p = journey.render;
    const f = journey.finaleRender;
    const set = (name: string, v: number, tc = 0.25) => this.layers[name].gain.setTargetAtTime(v, now, tc);

    const outdoor = (1 - smoothstep(0.112, 0.134, p)) + 0.25 * window4(p, 0.505, 0.54, 0.6, 0.62);
    const hall = window4(p, 0.108, 0.135, 0.435, 0.455);
    const cabin = window4(p, 0.44, 0.47, 0.852, 0.872);
    const inside = frame.shot.inAircraft;
    const thrust = frame.pose.thrust;

    set("outdoor", outdoor * 0.5);
    set("jets", (0.35 * (1 - smoothstep(0.12, 0.14, p)) + 0.12 * hall + 0.25 * window4(p, 0.3, 0.34, 0.44, 0.46) + 0.2 * smoothstep(0.9, 1, p)) * 0.8);
    set("hall", hall * 0.26);
    set("cabin", cabin * 0.22 * (1 - 0.5 * smoothstep(0.62, 0.66, p)));
    const engineLevel = thrust > 0 ? (0.08 + Math.pow(thrust, 1.6) * 0.75) * (inside > 0.5 ? 1 : 0.35) : 0;
    set("engine", engineLevel * (1 - smoothstep(0.86, 0.95, p)) + (f > 0 ? 0 : 0), 0.6);
    set("wind", window4(p, PHASE.liftoff, 0.7, 0.85, 0.9) * 0.18 + smoothstep(0.86, 0.95, p) * 0.12 * (1 - f * 0.5));
    set("pad", 0.05 + 0.1 * window4(p, 0.2, 0.3, 0.42, 0.5) + 0.35 * smoothstep(0.7, 0.82, p) + 0.25 * f, 1.2);
    set("fx", 1, 0.1);

    // engine spool: filter & whine follow thrust with inertia
    this.engine.lowpass.frequency.setTargetAtTime(90 + thrust * 1100, now, 0.8);
    this.engine.whine.frequency.setTargetAtTime(140 + thrust * 1650, now, 1.2);
    this.engine.whineGain.gain.setTargetAtTime(clamp(thrust - 0.06) * 0.05, now, 0.8);
    this.engine.hiss.frequency.setTargetAtTime(1800 + thrust * 3200, now, 0.8);
    this.pad.filter.Q.setTargetAtTime(0.4 + 0.6 * smoothstep(0.84, 1, p), now, 1);

    // one-shot events on crossing points (in either direction only when moving forward)
    const crossed = (x: number) => this.lastP < x && p >= x;
    if (!this.muted) {
      if (crossed(0.281)) this.beep();
      if (crossed(0.506) || crossed(PHASE.lineUp + 0.002)) this.seatbelt();
      if (hall > 0.5 && now > this.nextChime) {
        this.chime();
        this.nextChime = now + 18 + Math.random() * 10;
      }
      if (outdoor > 0.4 && now > this.nextCar) {
        this.car();
        this.nextCar = now + 1.2 + Math.random() * 3;
      }
    }
    this.lastP = p;
  }
}

export const soundscape = new Soundscape();
