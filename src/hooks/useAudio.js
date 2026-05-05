import { useRef, useEffect, useCallback } from 'react';

export function useAudio(enabled, volume, phase) {
  const actxRef    = useRef(null);
  const nodesRef   = useRef({});
  const startedRef = useRef(false);

  // Lazy-init AudioContext (must be after a user gesture)
  const initAudio = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const actx = new (window.AudioContext || window.webkitAudioContext)();
    actxRef.current = actx;

    const master = actx.createGain();
    master.gain.value = 0;
    master.connect(actx.destination);

    // Deep bass drone — two slightly detuned oscillators for a beating effect
    const drone1 = actx.createOscillator();
    const drone2 = actx.createOscillator();
    drone1.type = drone2.type = 'sine';
    drone1.frequency.value = 55;   // A1
    drone2.frequency.value = 55.5; // tiny detune → slow beat

    const droneGain = actx.createGain();
    droneGain.gain.value = 0;

    drone1.connect(droneGain);
    drone2.connect(droneGain);
    droneGain.connect(master);
    drone1.start(); drone2.start();

    // Mid shimmer — filtered noise-like tone
    const shimmer = actx.createOscillator();
    shimmer.type = 'sine';
    shimmer.frequency.value = 880;

    const shimmerLFO = actx.createOscillator();
    shimmerLFO.frequency.value = 0.15;
    const shimmerLFOGain = actx.createGain();
    shimmerLFOGain.gain.value = 30;
    shimmerLFO.connect(shimmerLFOGain);
    shimmerLFOGain.connect(shimmer.frequency);
    shimmerLFO.start();

    const shimmerGain = actx.createGain();
    shimmerGain.gain.value = 0;

    const shimmerFilter = actx.createBiquadFilter();
    shimmerFilter.type = 'bandpass';
    shimmerFilter.frequency.value = 1000;
    shimmerFilter.Q.value = 6;

    shimmer.connect(shimmerFilter);
    shimmerFilter.connect(shimmerGain);
    shimmerGain.connect(master);
    shimmer.start();

    // Subsonic pad — very low rumble for depth
    const pad = actx.createOscillator();
    pad.type = 'triangle';
    pad.frequency.value = 27.5; // A0

    const padGain = actx.createGain();
    padGain.gain.value = 0;
    pad.connect(padGain);
    padGain.connect(master);
    pad.start();

    nodesRef.current = { master, droneGain, shimmerGain, shimmerFilter, padGain, drone1, drone2, shimmer, pad };

    // Fade master in
    master.gain.setTargetAtTime(volume, actx.currentTime, 1.5);
  }, [volume]);

  // Evolve audio with phase
  useEffect(() => {
    const nodes = nodesRef.current;
    const actx  = actxRef.current;
    if (!actx || !nodes.droneGain) return;

    const t = actx.currentTime;
    const v = enabled ? volume : 0;

    const targetDrone   = phase >= 1 ? (0.025 + phase * 0.012) * v : 0;
    const targetShimmer = phase >= 2 ? (0.007 + (phase - 2) * 0.005) * v : 0;
    const targetPad     = phase >= 3 ? 0.015 * v : 0;

    nodes.droneGain.gain.linearRampToValueAtTime(targetDrone,   t + 3.0);
    nodes.shimmerGain.gain.linearRampToValueAtTime(targetShimmer, t + 3.0);
    nodes.padGain.gain.linearRampToValueAtTime(targetPad,       t + 4.0);
    nodes.shimmerFilter.frequency.linearRampToValueAtTime(600 + phase * 200, t + 4.0);
  }, [phase, enabled, volume]);

  // Volume-only changes
  useEffect(() => {
    const nodes = nodesRef.current;
    const actx  = actxRef.current;
    if (!actx || !nodes.master) return;
    const target = enabled ? volume : 0;
    nodes.master.gain.linearRampToValueAtTime(target, actx.currentTime + 0.5);
  }, [volume, enabled]);

  // Scare — brief pitch drop
  const playScareSound = useCallback(() => {
    const actx = actxRef.current;
    if (!actx || !enabled) return;

    const osc = actx.createOscillator();
    const g   = actx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 220;
    osc.frequency.exponentialRampToValueAtTime(55, actx.currentTime + 0.2);
    g.gain.value = 0.06 * volume;
    g.gain.linearRampToValueAtTime(0, actx.currentTime + 0.35);
    osc.connect(g);
    g.connect(actx.destination);
    osc.start();
    osc.stop(actx.currentTime + 0.35);
  }, [enabled, volume]);

  // Cleanup
  useEffect(() => {
    return () => {
      const nodes = nodesRef.current;
      try {
        nodes.drone1?.stop(); nodes.drone2?.stop();
        nodes.shimmer?.stop(); nodes.pad?.stop();
        actxRef.current?.close();
      } catch (_) { /* ignore stop errors on cleanup */ }
    };
  }, []);

  return { initAudio, playScareSound };
}
