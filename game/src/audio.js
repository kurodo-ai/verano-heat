// All sound is synthesized with WebAudio — no audio files. One-shots (gunshot, crash, chime)
// are built from oscillators and filtered noise on the spot; the engine hum and the police
// siren are two standing nodes whose pitch and gain follow the game state each frame.
// The context is created lazily on the first user gesture, as browsers require.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let engine = null;
  let siren = null;

  function unlock() {
    if (context !== null) {
      if (context.state === 'suspended') context.resume();
      return;
    }
    try {
      context = new (window.AudioContext || window.webkitAudioContext)();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
    } catch {
      context = null;
    }
  }

  function noiseBuffer() {
    const length = context.sampleRate * 0.5;
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1;
    return buffer;
  }

  function burst(duration, filterFreq, gainValue, type = 'lowpass') {
    if (context === null) return;
    const source = context.createBufferSource();
    source.buffer = noiseBuffer();
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const gain = context.createGain();
    const now = context.currentTime;
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(filter).connect(gain).connect(master);
    source.start(now);
    source.stop(now + duration);
  }

  function tone(freqFrom, freqTo, duration, gainValue, type = 'sine') {
    if (context === null) return;
    const osc = context.createOscillator();
    osc.type = type;
    const gain = context.createGain();
    const now = context.currentTime;
    osc.frequency.setValueAtTime(freqFrom, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqTo), now + duration);
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain).connect(master);
    osc.start(now);
    osc.stop(now + duration);
  }

  function startEngine() {
    const osc = context.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    const gain = context.createGain();
    gain.gain.value = 0;
    osc.connect(filter).connect(gain).connect(master);
    osc.start();
    engine = { osc, gain, filter };
  }

  function startSiren() {
    const osc = context.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 700;
    const gain = context.createGain();
    gain.gain.value = 0;
    osc.connect(gain).connect(master);
    osc.start();
    siren = { osc, gain, phase: 0 };
  }

  return {
    unlock,
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (master !== null) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    /** Per-frame: engine pitch follows the player's car; the siren swells with nearby police. */
    update(dt, drivingSpeed, policeNear) {
      if (context === null) return;
      if (engine === null) startEngine();
      if (siren === null) startSiren();
      const speedRatio = Math.min(1, Math.abs(drivingSpeed) / 470);
      engine.osc.frequency.value = 52 + speedRatio * 130;
      engine.filter.frequency.value = 280 + speedRatio * 700;
      engine.gain.gain.value = drivingSpeed === null ? 0 : 0.05 + speedRatio * 0.05;
      siren.phase += dt * 2.4;
      siren.osc.frequency.value = Math.sin(siren.phase * Math.PI) > 0 ? 715 : 955;
      siren.gain.gain.value = policeNear ? 0.028 : 0;
    },
    shot() {
      burst(0.16, 2600, 0.5, 'highpass');
      tone(160, 40, 0.12, 0.4, 'square');
    },
    punch() {
      burst(0.09, 500, 0.35);
    },
    crash(strength) {
      burst(0.22, 700, Math.min(0.6, 0.2 + strength * 0.4));
      tone(90, 34, 0.25, 0.35, 'sine');
    },
    door() {
      tone(220, 140, 0.07, 0.18, 'square');
    },
    chime() {
      tone(880, 880, 0.09, 0.16);
      setTimeout(() => tone(1320, 1320, 0.12, 0.16), 70);
    },
    success() {
      tone(523, 523, 0.11, 0.18);
      setTimeout(() => tone(659, 659, 0.11, 0.18), 100);
      setTimeout(() => tone(784, 784, 0.2, 0.2), 200);
    },
    alarm() {
      tone(392, 392, 0.14, 0.2, 'triangle');
      setTimeout(() => tone(311, 311, 0.24, 0.2, 'triangle'), 150);
    },
  };
}
