export const playSound = (type: 'coin' | 'task' | 'buy' | 'footstep' | 'interact' | 'pop') => {
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContext) return;
  
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  const now = ctx.currentTime;
  
  if (type === 'coin') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now); // A5
    osc.frequency.exponentialRampToValueAtTime(1760, now + 0.1); // A6
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    
    osc.start(now);
    osc.stop(now + 0.3);
  } else if (type === 'task') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now); // A4
    osc.frequency.setValueAtTime(554.37, now + 0.1); // C#5
    osc.frequency.setValueAtTime(659.25, now + 0.2); // E5
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    
    osc.start(now);
    osc.stop(now + 0.5);
  } else if (type === 'buy') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    
    osc.start(now);
    osc.stop(now + 0.2);
  } else if (type === 'footstep') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.05);
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.05, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    
    osc.start(now);
    osc.stop(now + 0.05);
  } else if (type === 'interact') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.1, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    
    osc.start(now);
    osc.stop(now + 0.2);
  } else if (type === 'pop') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    
    osc.start(now);
    osc.stop(now + 0.1);
  }
};

let bgmCtx: AudioContext | null = null;
let bgmOsc: OscillatorNode | null = null;
let bgmGain: GainNode | null = null;

export const toggleBGM = (play: boolean) => {
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContext) return;

  if (play) {
    if (!bgmCtx) {
      bgmCtx = new AudioContext();
    }
    if (bgmCtx.state === 'suspended') {
      bgmCtx.resume();
    }
    
    if (!bgmOsc) {
      bgmOsc = bgmCtx.createOscillator();
      bgmGain = bgmCtx.createGain();
      
      // Create a warm, low drone/chord for cozy ambient
      bgmOsc.type = 'sine';
      bgmOsc.frequency.value = 110; // A2
      
      // Add a second oscillator for a chord
      const osc2 = bgmCtx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = 164.81; // E3
      
      // Add a slow LFO for volume modulation (breathing effect)
      const lfo = bgmCtx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.1; // 10 seconds per cycle
      const lfoGain = bgmCtx.createGain();
      lfoGain.gain.value = 0.05;
      lfo.connect(lfoGain);
      
      bgmGain.gain.value = 0.1;
      lfoGain.connect(bgmGain.gain);
      
      bgmOsc.connect(bgmGain);
      osc2.connect(bgmGain);
      
      // Add ambient wind/fire noise
      const bufferSize = bgmCtx.sampleRate * 2; // 2 seconds
      const buffer = bgmCtx.createBuffer(1, bufferSize, bgmCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
      }
      const noise = bgmCtx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      
      const noiseFilter = bgmCtx.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.value = 400; // Muffled wind/fire
      
      const noiseGain = bgmCtx.createGain();
      noiseGain.gain.value = 0.015; // Very quiet
      
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(bgmGain);
      
      bgmGain.connect(bgmCtx.destination);
      
      bgmOsc.start();
      osc2.start();
      lfo.start();
      noise.start();
      
      // Store noise to stop it later
      (bgmOsc as any).noiseNode = noise;
    }
  } else {
    if (bgmGain) {
      bgmGain.gain.linearRampToValueAtTime(0, bgmCtx!.currentTime + 1);
      setTimeout(() => {
        if (bgmOsc) {
          bgmOsc.stop();
          if ((bgmOsc as any).noiseNode) {
            (bgmOsc as any).noiseNode.stop();
          }
          bgmOsc.disconnect();
          bgmOsc = null;
        }
        if (bgmCtx) {
          bgmCtx.suspend();
        }
      }, 1000);
    }
  }
};
