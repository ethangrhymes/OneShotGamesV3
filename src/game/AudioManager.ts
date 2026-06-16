/**
 * AudioManager — Web Audio with a synthesized fallback for every sound.
 *
 * Design priorities (mobile Safari first):
 *  - The synth engine ALWAYS works, even where .ogg can't decode (older iOS).
 *  - Kenney .ogg clips are loaded best-effort and preferred when they decode.
 *  - The AudioContext is only created/resumed after a user gesture.
 *  - Nothing here ever throws into the game loop.
 */

export type Sfx =
  | "attack"
  | "hit"
  | "hurt"
  | "bosshit"
  | "coin"
  | "pickup"
  | "door"
  | "unlock"
  | "gate"
  | "lore"
  | "checkpoint"
  | "select"
  | "shortcut"
  | "victory"
  | "gameover";

/** A music "biome" picks the base bed; combat/safe modulate intensity on top. */
type Biome = "explore" | "boss" | "region" | "reach";

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private combatGain: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private sources: Record<string, string> = {};
  private muted = false;
  private unlocked = false;

  // music state
  private musicNodes: AudioNode[] = [];
  private currentMusic: Biome | null = null;
  private droneTimer: number | null = null;
  // adaptive combat layer
  private combatTimer: number | null = null;
  private combatLevel = 0; // smoothed 0..1
  private combatTarget = 0;
  private safe = false;

  setSources(sources: Record<string, string>): void {
    this.sources = sources;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master) {
      this.master.gain.value = m ? 0 : 1;
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  /** Call from the first user gesture. Safe to call repeatedly. */
  async unlock(): Promise<void> {
    if (this.unlocked) {
      if (this.ctx && this.ctx.state === "suspended") await this.ctx.resume();
      return;
    }
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.0;
      this.musicGain.connect(this.master);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.55;
      this.sfxGain.connect(this.master);

      // adaptive combat tension layer (a dark pulse that fades in during fights)
      this.combatGain = this.ctx.createGain();
      this.combatGain.gain.value = 0.0001;
      this.combatGain.connect(this.master);
      this.startCombatLayer();

      if (this.ctx.state === "suspended") await this.ctx.resume();
      this.unlocked = true;
      // Decode any available Kenney clips in the background.
      void this.decodeAll();
    } catch {
      this.ctx = null;
    }
  }

  private async decodeAll(): Promise<void> {
    if (!this.ctx) return;
    await Promise.all(
      Object.entries(this.sources).map(async ([name, url]) => {
        try {
          const res = await fetch(url, { cache: "force-cache" });
          if (!res.ok) return;
          const arr = await res.arrayBuffer();
          const buf = await this.ctx!.decodeAudioData(arr.slice(0));
          this.buffers.set(name, buf);
          // If music is requested and now available, swap from synth drone.
          if (
            (name === "music_explore" && this.currentMusic === "explore") ||
            (name === "music_boss" && this.currentMusic === "boss") ||
            (name === "music_region2" && this.currentMusic === "region") ||
            (name === "music_reach" && this.currentMusic === "reach")
          ) {
            this.startMusic(this.currentMusic, true);
          }
        } catch {
          /* unsupported codec — synth fallback stays */
        }
      })
    );
  }

  private now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  // ---- low-level synth helpers ------------------------------------------
  private tone(opts: {
    freq: number;
    to?: number;
    dur: number;
    type?: OscillatorType;
    gain?: number;
    delay?: number;
    attack?: number;
  }): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.now() + (opts.delay ?? 0);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = opts.type ?? "square";
    osc.frequency.setValueAtTime(opts.freq, t);
    if (opts.to !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.to), t + opts.dur);
    }
    const peak = opts.gain ?? 0.3;
    const atk = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + opts.dur + 0.02);
  }

  private noise(opts: {
    dur: number;
    gain?: number;
    filter?: number;
    type?: BiquadFilterType;
    delay?: number;
  }): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.now() + (opts.delay ?? 0);
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * opts.dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = opts.type ?? "bandpass";
    filt.frequency.value = opts.filter ?? 1200;
    const g = this.ctx.createGain();
    const peak = opts.gain ?? 0.25;
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.sfxGain);
    src.start(t);
    src.stop(t + opts.dur + 0.02);
  }

  private playBuffer(name: string, gain = 0.6, rate = 1): boolean {
    if (!this.ctx || !this.sfxGain) return false;
    const buf = this.buffers.get(name);
    if (!buf) return false;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(g);
    g.connect(this.sfxGain);
    src.start();
    return true;
  }

  // ---- public sfx -------------------------------------------------------
  play(sfx: Sfx): void {
    if (!this.ctx || this.muted) return;
    // Prefer a Kenney clip when one decoded for this event.
    const clip: Partial<Record<Sfx, string>> = {
      attack: "attack",
      hit: "hit",
      hurt: "hurt",
      bosshit: "bosshit",
      coin: "coin",
      pickup: "pickup",
      door: "door",
      unlock: "unlock",
      gate: "gate",
      lore: "lore",
      checkpoint: "checkpoint",
      select: "select",
    };
    const clipName = clip[sfx];
    if (clipName && this.buffers.has(clipName)) {
      this.playBuffer(clipName, 0.6);
      return;
    }
    // Synth fallback per event.
    switch (sfx) {
      case "attack":
        this.noise({ dur: 0.12, gain: 0.18, filter: 2600, type: "bandpass" });
        this.tone({ freq: 520, to: 240, dur: 0.12, type: "triangle", gain: 0.14 });
        break;
      case "hit":
        this.tone({ freq: 180, to: 90, dur: 0.12, type: "square", gain: 0.22 });
        this.noise({ dur: 0.08, gain: 0.12, filter: 900, type: "lowpass" });
        break;
      case "hurt":
        this.tone({ freq: 220, to: 70, dur: 0.28, type: "sawtooth", gain: 0.26 });
        break;
      case "bosshit":
        this.tone({ freq: 130, to: 70, dur: 0.2, type: "square", gain: 0.22 });
        this.noise({ dur: 0.16, gain: 0.16, filter: 1600, type: "bandpass" });
        break;
      case "coin":
        this.tone({ freq: 880, dur: 0.06, type: "square", gain: 0.16 });
        this.tone({ freq: 1320, dur: 0.09, type: "square", gain: 0.16, delay: 0.05 });
        break;
      case "pickup":
        this.tone({ freq: 660, to: 990, dur: 0.14, type: "triangle", gain: 0.2 });
        break;
      case "door":
        this.noise({ dur: 0.3, gain: 0.18, filter: 700, type: "lowpass" });
        this.tone({ freq: 160, to: 120, dur: 0.3, type: "sawtooth", gain: 0.1 });
        break;
      case "unlock":
        this.tone({ freq: 300, dur: 0.05, type: "square", gain: 0.18 });
        this.tone({ freq: 760, to: 1100, dur: 0.16, type: "triangle", gain: 0.18, delay: 0.06 });
        break;
      case "gate":
        this.tone({ freq: 90, to: 60, dur: 0.6, type: "sawtooth", gain: 0.16 });
        this.noise({ dur: 0.5, gain: 0.1, filter: 400, type: "lowpass" });
        break;
      case "shortcut":
        this.tone({ freq: 110, dur: 0.18, type: "square", gain: 0.16 });
        this.tone({ freq: 440, to: 700, dur: 0.3, type: "triangle", gain: 0.18, delay: 0.1 });
        this.noise({ dur: 0.3, gain: 0.1, filter: 500, type: "lowpass", delay: 0.05 });
        break;
      case "lore":
        this.tone({ freq: 520, dur: 0.5, type: "sine", gain: 0.12 });
        this.tone({ freq: 780, dur: 0.6, type: "sine", gain: 0.08, delay: 0.04 });
        break;
      case "checkpoint":
        this.chord([392, 523, 659], 0.7, 0.12, "sine");
        break;
      case "select":
        this.tone({ freq: 600, to: 760, dur: 0.07, type: "square", gain: 0.16 });
        break;
      case "victory":
        this.fanfare();
        break;
      case "gameover":
        this.tone({ freq: 330, to: 110, dur: 1.0, type: "sawtooth", gain: 0.2 });
        this.tone({ freq: 247, to: 90, dur: 1.1, type: "triangle", gain: 0.14, delay: 0.06 });
        break;
    }
  }

  private chord(freqs: number[], dur: number, gain: number, type: OscillatorType): void {
    freqs.forEach((f, i) => this.tone({ freq: f, dur, type, gain, delay: i * 0.04, attack: 0.02 }));
  }

  private fanfare(): void {
    const seq = [523, 659, 784, 1047];
    seq.forEach((f, i) =>
      this.tone({ freq: f, dur: i === seq.length - 1 ? 0.5 : 0.18, type: "square", gain: 0.18, delay: i * 0.13 })
    );
    this.tone({ freq: 392, dur: 0.6, type: "triangle", gain: 0.12, delay: 0.4 });
  }

  // ---- music ------------------------------------------------------------
  /**
   * The single adaptive entry point. Game calls this each time context changes:
   *   biome  — base bed: explore (dark dungeon), boss (deeper/faster), region (cold/wide)
   *   safe   — at a checkpoint/safe room: calm, no combat layer
   *   combat — 0..1 tension; fades in a dark percussion/noise layer
   */
  setMusicScene(biome: Biome, safe: boolean, combat: number): void {
    this.safe = safe;
    this.combatTarget = safe ? 0 : Math.max(0, Math.min(1, combat));
    if (this.combatGain && this.ctx) {
      const t = this.now();
      const tgt = 0.0001 + this.combatTarget * 0.22;
      this.combatGain.gain.cancelScheduledValues(t);
      this.combatGain.gain.setTargetAtTime(tgt, t, 0.6);
    }
    if (this.currentMusic !== biome) this.startMusic(biome);
  }

  startMusic(name: Biome, force = false): void {
    if (!this.ctx || !this.musicGain) {
      this.currentMusic = name;
      return;
    }
    if (this.currentMusic === name && !force) return;
    this.currentMusic = name;
    this.stopMusicNodes();

    const bufName =
      name === "explore"
        ? "music_explore"
        : name === "boss"
        ? "music_boss"
        : name === "reach"
        ? "music_reach"
        : "music_region2";
    const buf = this.buffers.get(bufName);
    const target = name === "boss" ? 0.3 : 0.24;

    if (buf) {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      // a touch slower + a gentle low-pass keeps Kenney loops dark, not loud.
      // The Reach runs slowest + murkiest — a drowned, tidal hush.
      src.playbackRate.value = name === "boss" ? 0.95 : name === "reach" ? 0.85 : 0.9;
      const lp = this.ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = name === "boss" ? 2600 : name === "reach" ? 1650 : 1900;
      src.connect(lp);
      lp.connect(this.musicGain);
      src.start();
      this.musicNodes.push(src, lp);
    } else {
      this.startDrone(name);
    }
    const t = this.now();
    this.musicGain.gain.cancelScheduledValues(t);
    this.musicGain.gain.setValueAtTime(Math.max(0.0001, this.musicGain.gain.value), t);
    this.musicGain.gain.linearRampToValueAtTime(target, t + 1.4);
  }

  /** Darker synthesized ambient bed used when no Kenney music decoded. */
  private startDrone(name: Biome): void {
    if (!this.ctx || !this.musicGain) return;
    // lower roots + minor intervals = darker than Round 1.
    // reach = E1, a deep tidal swell (lowest, widest of the beds).
    const root = name === "boss" ? 43.65 : name === "region" ? 48.99 : name === "reach" ? 41.2 : 55.0;
    const intervals =
      name === "boss"
        ? [1, 1.5, 1.189]
        : name === "region"
        ? [1, 1.335, 2]
        : name === "reach"
        ? [1, 1.498, 1.122] // fifth + a beating minor second: unsettled, tidal
        : [1, 1.5, 1.189];
    intervals.forEach((mult, i) => {
      const osc = this.ctx!.createOscillator();
      osc.type = i === 0 ? "sine" : i === 1 ? "triangle" : "sawtooth";
      osc.frequency.value = root * mult;
      const g = this.ctx!.createGain();
      g.gain.value = i === 0 ? 0.55 : i === 1 ? 0.2 : 0.08;
      const lp = this.ctx!.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 900;
      const lfo = this.ctx!.createOscillator();
      lfo.frequency.value = 0.04 + i * 0.025;
      const lfoG = this.ctx!.createGain();
      lfoG.gain.value = i === 0 ? 0.12 : 0.07;
      lfo.connect(lfoG);
      lfoG.connect(g.gain);
      osc.connect(lp);
      lp.connect(g);
      g.connect(this.musicGain!);
      osc.start();
      lfo.start();
      this.musicNodes.push(osc, lfo, lp);
    });
    // sparse, unresolved bell motif
    const step = name === "boss" ? 2.6 : name === "region" ? 4.8 : name === "reach" ? 5.4 : 4.4;
    const notes =
      name === "boss"
        ? [196, 233, 174.6]
        : name === "region"
        ? [293.7, 220, 329.6]
        : name === "reach"
        ? [220, 164.8, 246.9] // low, slow tide-bells
        : [261.6, 196, 311.1];
    let idx = 0;
    const tick = () => {
      if (this.currentMusic !== name || !this.ctx) return;
      this.tone({ freq: notes[idx % notes.length], dur: name === "boss" ? 1.0 : 1.8, type: "sine", gain: 0.045, attack: 0.25 });
      idx++;
      this.droneTimer = window.setTimeout(tick, step * 1000);
    };
    this.droneTimer = window.setTimeout(tick, 900);
  }

  /** Persistent dark combat pulse, gated by combatGain (0 when not fighting). */
  private startCombatLayer(): void {
    if (!this.ctx || !this.combatGain) return;
    let beat = 0;
    const loop = () => {
      if (!this.ctx || !this.combatGain) return;
      // smooth the level toward target (for tempo decisions)
      this.combatLevel += (this.combatTarget - this.combatLevel) * 0.25;
      const t = this.now();
      // low kick on the beat
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.16);
      g.gain.setValueAtTime(0.9, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(g);
      g.connect(this.combatGain);
      osc.start(t);
      osc.stop(t + 0.2);
      // off-beat noise tick when intensity is high
      if (beat % 2 === 1 && this.combatTarget > 0.4) {
        const len = Math.floor(this.ctx.sampleRate * 0.05);
        const b = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = b.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const ns = this.ctx.createBufferSource();
        ns.buffer = b;
        const hp = this.ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 4000;
        const ng = this.ctx.createGain();
        ng.gain.value = 0.5;
        ns.connect(hp);
        hp.connect(ng);
        ng.connect(this.combatGain);
        ns.start(t);
      }
      beat++;
      // faster pulse as the fight intensifies
      const interval = 620 - this.combatLevel * 200;
      this.combatTimer = window.setTimeout(loop, interval);
    };
    this.combatTimer = window.setTimeout(loop, 600);
  }

  private stopMusicNodes(): void {
    if (this.droneTimer != null) {
      clearTimeout(this.droneTimer);
      this.droneTimer = null;
    }
    for (const n of this.musicNodes) {
      try {
        (n as OscillatorNode).stop?.();
        n.disconnect();
      } catch {
        /* ignore */
      }
    }
    this.musicNodes = [];
  }

  stopMusic(): void {
    this.combatTarget = 0;
    if (this.combatGain && this.ctx) {
      const ct = this.now();
      this.combatGain.gain.cancelScheduledValues(ct);
      this.combatGain.gain.setTargetAtTime(0.0001, ct, 0.3);
    }
    if (!this.musicGain || !this.ctx) {
      this.currentMusic = null;
      return;
    }
    const t = this.now();
    this.musicGain.gain.cancelScheduledValues(t);
    this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, t);
    this.musicGain.gain.linearRampToValueAtTime(0.0001, t + 0.6);
    const nodes = this.musicNodes;
    this.musicNodes = [];
    if (this.droneTimer != null) {
      clearTimeout(this.droneTimer);
      this.droneTimer = null;
    }
    window.setTimeout(() => {
      for (const n of nodes) {
        try {
          (n as OscillatorNode).stop?.();
          n.disconnect();
        } catch {
          /* ignore */
        }
      }
    }, 700);
    this.currentMusic = null;
  }
}
