import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SAMPLE_RATE = 22050;
const TAU = Math.PI * 2;
const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../client/public/audio');

function makeBuffer(seconds) {
  return new Float32Array(Math.ceil(seconds * SAMPLE_RATE));
}

function envelope(t, duration, attack = 0.004, release = 0.06, decay = 0) {
  const inGain = attack > 0 ? Math.min(1, t / attack) : 1;
  const outGain = release > 0 ? Math.min(1, (duration - t) / release) : 1;
  const decayGain = decay > 0 ? Math.exp(-decay * t) : 1;
  return Math.max(0, Math.min(inGain, outGain)) * decayGain;
}

function wave(type, phase) {
  if (type === 'square') return Math.sin(phase) >= 0 ? 1 : -1;
  if (type === 'triangle') return (2 / Math.PI) * Math.asin(Math.sin(phase));
  if (type === 'saw') return 2 * ((phase / TAU) % 1) - 1;
  return Math.sin(phase);
}

function addTone(buffer, start, duration, frequency, options = {}) {
  const {
    gain = 0.2,
    type = 'sine',
    attack = 0.004,
    release = 0.06,
    decay = 0,
    glide = null,
    wobble = 0
  } = options;
  const from = Math.round(start * SAMPLE_RATE);
  const count = Math.round(duration * SAMPLE_RATE);
  let phase = 0;
  for (let i = 0; i < count; i += 1) {
    const t = i / SAMPLE_RATE;
    const progress = i / Math.max(1, count - 1);
    const currentFrequency = glide == null ? frequency : frequency + (glide - frequency) * progress;
    const vibrato = wobble ? 1 + Math.sin(TAU * 5.2 * t) * wobble : 1;
    phase += (TAU * currentFrequency * vibrato) / SAMPLE_RATE;
    const index = from + i;
    if (index >= buffer.length) break;
    buffer[index] += wave(type, phase) * envelope(t, duration, attack, release, decay) * gain;
  }
}

function addNoise(buffer, start, duration, options = {}) {
  const { gain = 0.1, attack = 0.001, release = 0.04, decay = 0, smoothing = 0.35 } = options;
  const from = Math.round(start * SAMPLE_RATE);
  const count = Math.round(duration * SAMPLE_RATE);
  let seed = 0x9e3779b9;
  let filtered = 0;
  for (let i = 0; i < count; i += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const raw = (seed / 0xffffffff) * 2 - 1;
    filtered = filtered * smoothing + raw * (1 - smoothing);
    const t = i / SAMPLE_RATE;
    const index = from + i;
    if (index >= buffer.length) break;
    buffer[index] += filtered * envelope(t, duration, attack, release, decay) * gain;
  }
}

function addChord(buffer, start, duration, frequencies, options = {}) {
  for (const frequency of frequencies) addTone(buffer, start, duration, frequency, options);
}

function addKick(buffer, start, gain = 0.25) {
  addTone(buffer, start, 0.22, 120, { gain, type: 'sine', glide: 46, attack: 0.002, release: 0.12 });
  addNoise(buffer, start, 0.05, { gain: gain * 0.22, smoothing: 0.7 });
}

function addHat(buffer, start, gain = 0.04) {
  addNoise(buffer, start, 0.055, { gain, smoothing: 0.05, release: 0.04 });
}

function normalize(buffer, target = 0.9) {
  let peak = 0;
  for (const sample of buffer) peak = Math.max(peak, Math.abs(sample));
  if (peak <= target || peak === 0) return buffer;
  const scale = target / peak;
  for (let i = 0; i < buffer.length; i += 1) buffer[i] *= scale;
  return buffer;
}

function writeWav(name, buffer) {
  const samples = normalize(buffer);
  const dataSize = samples.length * 2;
  const wav = Buffer.alloc(44 + dataSize);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(SAMPLE_RATE, 24);
  wav.writeUInt32LE(SAMPLE_RATE * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i += 1) {
    const value = Math.max(-1, Math.min(1, samples[i]));
    wav.writeInt16LE(Math.round(value * 32767), 44 + i * 2);
  }
  fs.writeFileSync(path.join(OUT_DIR, `${name}.wav`), wav);
}

function makeMenuTheme() {
  const buffer = makeBuffer(12);
  const chords = [
    [261.63, 329.63, 392.0, 493.88],
    [220.0, 261.63, 329.63, 392.0],
    [174.61, 220.0, 261.63, 329.63],
    [196.0, 246.94, 293.66, 392.0]
  ];
  const arpPattern = [0, 2, 1, 3, 2, 1, 3, 0];
  chords.forEach((chord, chordIndex) => {
    const start = chordIndex * 3;
    addChord(buffer, start, 3, chord, { gain: 0.035, type: 'triangle', attack: 0.24, release: 0.36, wobble: 0.003 });
    addTone(buffer, start, 3, chord[0] / 2, { gain: 0.05, type: 'sine', attack: 0.18, release: 0.4 });
    for (let step = 0; step < 8; step += 1) {
      const frequency = chord[arpPattern[step]] * 2;
      addTone(buffer, start + step * 0.375, 0.28, frequency, { gain: 0.025, type: 'sine', attack: 0.02, release: 0.2, decay: 1.1 });
    }
  });
  return buffer;
}

function makeGameTheme() {
  const buffer = makeBuffer(8);
  const bass = [110, 110, 130.81, 98, 110, 110, 146.83, 130.81];
  const lead = [440, 523.25, 659.25, 587.33, 493.88, 440, 392, 329.63];
  bass.forEach((frequency, step) => {
    addTone(buffer, step, 0.42, frequency, { gain: 0.09, type: 'triangle', attack: 0.004, release: 0.08, decay: 2.5 });
    addKick(buffer, step, step % 2 === 0 ? 0.22 : 0.16);
  });
  for (let step = 0; step < 16; step += 1) {
    const frequency = lead[step % lead.length];
    addTone(buffer, step * 0.5, 0.22, frequency, { gain: 0.04, type: 'square', attack: 0.006, release: 0.12, decay: 2.4 });
    addHat(buffer, step * 0.5 + 0.25, step % 2 === 0 ? 0.035 : 0.02);
  }
  for (let chord = 0; chord < 4; chord += 1) {
    addChord(buffer, chord * 2, 2, [220, 277.18, 329.63], { gain: 0.016, type: 'saw', attack: 0.08, release: 0.2 });
  }
  return buffer;
}

function createEffects() {
  const click = makeBuffer(0.08);
  addTone(click, 0, 0.07, 1600, { gain: 0.25, type: 'triangle', glide: 1050, release: 0.045 });
  addNoise(click, 0, 0.035, { gain: 0.05, smoothing: 0.2 });

  const back = makeBuffer(0.18);
  addTone(back, 0, 0.16, 520, { gain: 0.24, type: 'triangle', glide: 250, release: 0.09 });

  const join = makeBuffer(0.48);
  [523.25, 659.25, 783.99].forEach((frequency, index) => {
    addTone(join, index * 0.085, 0.3, frequency, { gain: 0.18, type: 'triangle', release: 0.16, decay: 1.3 });
  });

  const leave = makeBuffer(0.42);
  [392, 329.63, 261.63].forEach((frequency, index) => {
    addTone(leave, index * 0.085, 0.3, frequency, { gain: 0.17, type: 'triangle', release: 0.15 });
  });

  const countdown = makeBuffer(0.2);
  addTone(countdown, 0, 0.18, 880, { gain: 0.18, type: 'square', attack: 0.002, release: 0.08, decay: 2 });
  addTone(countdown, 0, 0.18, 1760, { gain: 0.05, type: 'sine', release: 0.08 });

  const go = makeBuffer(0.52);
  addChord(go, 0, 0.46, [523.25, 659.25, 783.99], { gain: 0.13, type: 'triangle', attack: 0.004, release: 0.18, decay: 1.4 });
  addNoise(go, 0, 0.18, { gain: 0.06, smoothing: 0.5 });

  const tag = makeBuffer(0.24);
  addTone(tag, 0, 0.22, 140, { gain: 0.3, type: 'sine', glide: 58, attack: 0.002, release: 0.12, decay: 4 });
  addNoise(tag, 0, 0.12, { gain: 0.14, smoothing: 0.4, decay: 6 });

  const tagged = makeBuffer(0.52);
  addTone(tagged, 0, 0.48, 500, { gain: 0.22, type: 'saw', glide: 130, release: 0.18, decay: 2 });
  addNoise(tagged, 0, 0.2, { gain: 0.1, smoothing: 0.55, decay: 3 });

  const freeze = makeBuffer(0.55);
  addNoise(freeze, 0, 0.4, { gain: 0.11, smoothing: 0.12, release: 0.18, decay: 2.5 });
  addTone(freeze, 0.01, 0.5, 1760, { gain: 0.08, type: 'sine', glide: 2380, release: 0.2 });
  addTone(freeze, 0.06, 0.45, 2637, { gain: 0.04, type: 'triangle', release: 0.2 });

  const rescue = makeBuffer(0.55);
  [783.99, 1046.5, 1318.51].forEach((frequency, index) => {
    addTone(rescue, index * 0.09, 0.3, frequency, { gain: 0.13, type: 'triangle', release: 0.16, decay: 2 });
  });

  const win = makeBuffer(1.5);
  [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
    addTone(win, index * 0.13, 0.5, frequency, { gain: 0.16, type: 'triangle', release: 0.28, decay: 1.1 });
  });
  addChord(win, 0.42, 1.02, [523.25, 659.25, 783.99, 1046.5], { gain: 0.07, type: 'sine', attack: 0.02, release: 0.3 });

  const lose = makeBuffer(1.25);
  [392, 349.23, 311.13, 261.63].forEach((frequency, index) => {
    addTone(lose, index * 0.16, 0.48, frequency, { gain: 0.14, type: 'triangle', release: 0.24, decay: 1.2 });
  });

  const footstep = makeBuffer(0.1);
  addNoise(footstep, 0, 0.08, { gain: 0.2, smoothing: 0.62, release: 0.06, decay: 8 });
  addTone(footstep, 0, 0.075, 95, { gain: 0.08, type: 'sine', glide: 62, release: 0.05 });

  const error = makeBuffer(0.34);
  addTone(error, 0, 0.16, 196, { gain: 0.17, type: 'square', release: 0.05 });
  addTone(error, 0.18, 0.14, 146.83, { gain: 0.17, type: 'square', release: 0.05 });

  const ready = makeBuffer(0.18);
  addTone(ready, 0, 0.14, 660, { gain: 0.14, type: 'triangle', glide: 880, release: 0.08 });
  addTone(ready, 0.05, 0.12, 990, { gain: 0.06, type: 'sine', release: 0.07 });

  return { click, back, join, leave, countdown, go, tag, tagged, freeze, rescue, win, lose, footstep, error, ready };
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const [name, buffer] of Object.entries(createEffects())) writeWav(name, buffer);
writeWav('menu-theme', makeMenuTheme());
writeWav('game-theme', makeGameTheme());

const files = fs.readdirSync(OUT_DIR).filter((file) => file.endsWith('.wav'));
const bytes = files.reduce((sum, file) => sum + fs.statSync(path.join(OUT_DIR, file)).size, 0);
console.log(`Generated ${files.length} audio files (${(bytes / 1024 / 1024).toFixed(2)} MB) in ${OUT_DIR}`);
