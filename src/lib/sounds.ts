'use client';

// Synthesized chimes via Web Audio API. No audio files — works offline,
// no asset weight, no licensing. Tones are layered sine + triangle with
// soft attack/release envelopes so they read as "warm" rather than
// "bleep". Each call is a no-op when the user has muted sounds in
// settings, or when running in a non-browser context (SSR).

import { useAppStore } from './store';

export type SoundName =
  | 'tick'        // habit checked on
  | 'untick'      // habit unchecked
  | 'chime'       // streak milestone, reward claimed
  | 'flourish'    // daily 100%, book completed, reset completed
  | 'reward'      // reward earned (queued)
  | 'lowTone'     // punishment triggered, relapse
  | 'softUp'      // punishment resolved
  | 'pulse';      // light tap — reset check-in, page-log

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (ctx) return ctx;
  const Ctor =
    (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    return null;
  }
  return ctx;
}

/** iOS / autoplay-policy: AudioContext starts suspended until a user
 *  gesture. Resume on the first interaction. */
export function unlockAudio(): void {
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
}

interface Note {
  /** Hz */
  freq: number;
  /** Seconds since the start of this play(). */
  start: number;
  /** Seconds. */
  duration: number;
  /** 0–1. Defaults to 0.18. */
  gain?: number;
  type?: OscillatorType;
}

function play(notes: Note[]): void {
  if (typeof window === 'undefined') return;
  const enabled = useAppStore.getState().profile?.soundEnabled ?? true;
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();

  const now = c.currentTime;
  const master = c.createGain();
  master.gain.value = 0.9;
  master.connect(c.destination);

  for (const n of notes) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = n.type ?? 'sine';
    osc.frequency.value = n.freq;
    const peak = n.gain ?? 0.18;
    const t0 = now + n.start;
    const t1 = t0 + n.duration;
    // Soft attack so the onset isn't a click; exp release for a bell-like tail.
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.02, n.duration * 0.3));
    gain.gain.exponentialRampToValueAtTime(0.0001, t1);
    osc.connect(gain).connect(master);
    osc.start(t0);
    osc.stop(t1 + 0.02);
  }
}

const SOUNDS: Record<SoundName, Note[]> = {
  // Two-note rising tick — quick, satisfying.
  tick: [
    { freq: 660, start: 0, duration: 0.06, gain: 0.16 },
    { freq: 880, start: 0.05, duration: 0.1, gain: 0.18 },
  ],
  // Single descending note — quiet "undo" feel.
  untick: [
    { freq: 520, start: 0, duration: 0.08, gain: 0.1 },
    { freq: 392, start: 0.05, duration: 0.08, gain: 0.1 },
  ],
  // C-major triad — warm chime.
  chime: [
    { freq: 523.25, start: 0, duration: 0.5, gain: 0.14 },
    { freq: 659.25, start: 0, duration: 0.5, gain: 0.12 },
    { freq: 783.99, start: 0, duration: 0.5, gain: 0.1 },
    { freq: 1046.5, start: 0.04, duration: 0.45, gain: 0.08, type: 'triangle' },
  ],
  // Quick arpeggio — celebratory but short.
  flourish: [
    { freq: 523.25, start: 0, duration: 0.12, gain: 0.16 },
    { freq: 659.25, start: 0.08, duration: 0.12, gain: 0.16 },
    { freq: 783.99, start: 0.16, duration: 0.12, gain: 0.16 },
    { freq: 1046.5, start: 0.24, duration: 0.5, gain: 0.18 },
    { freq: 1318.51, start: 0.24, duration: 0.5, gain: 0.1, type: 'triangle' },
  ],
  // Bright two-chord ping for "you earned something".
  reward: [
    { freq: 587.33, start: 0, duration: 0.18, gain: 0.16 }, // D5
    { freq: 880, start: 0, duration: 0.18, gain: 0.12 },     // A5
    { freq: 783.99, start: 0.14, duration: 0.5, gain: 0.18 }, // G5
    { freq: 1174.66, start: 0.14, duration: 0.5, gain: 0.1, type: 'triangle' }, // D6
  ],
  // Descending minor — used sparingly so it stays meaningful.
  lowTone: [
    { freq: 220, start: 0, duration: 0.18, gain: 0.16, type: 'triangle' },
    { freq: 174.61, start: 0.14, duration: 0.32, gain: 0.16, type: 'triangle' },
  ],
  // Brief rise — punishment resolved, debt cleared.
  softUp: [
    { freq: 392, start: 0, duration: 0.1, gain: 0.12 },
    { freq: 523.25, start: 0.08, duration: 0.18, gain: 0.14 },
  ],
  // Single muted tap — for low-stakes confirmations.
  pulse: [{ freq: 587.33, start: 0, duration: 0.08, gain: 0.1 }],
};

export function playSound(name: SoundName): void {
  play(SOUNDS[name]);
}
