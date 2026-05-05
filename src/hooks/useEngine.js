import { useRef, useEffect, useState, useCallback } from 'react';
import { BioEngine } from '../engine/BioEngine.js';

const EMPTY_STATS = {
  spores: 0, jellies: 0, phase: 0,
  stillnessSec: 0, fps: 0, isScared: false, warm: false,
};

export function useEngine(canvasRef, config, onScare, onPhaseChange) {
  const engineRef  = useRef(null);
  const configRef  = useRef(config);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [scareCount, setScareCount] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const longestRef = useRef(0);

  // Keep configRef in sync so the engine can read the latest config
  useEffect(() => { configRef.current = config; }, [config]);

  // One-time engine lifecycle
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new BioEngine(canvas, configRef.current);
    engineRef.current = engine;

    engine.onStatsUpdate = (s) => {
      setStats(s);
      if (s.stillnessSec > longestRef.current) {
        longestRef.current = s.stillnessSec;
        setLongestStreak(longestRef.current);
      }
    };

    engine.onScare = () => {
      setScareCount(c => c + 1);
      onScare?.();
    };

    engine.onPhaseChange = (phase, prev) => {
      onPhaseChange?.(phase, prev);
    };

    engine.start();

    return () => {
      engine.stop();
      engineRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef]);

  // Forward config changes to the running engine
  useEffect(() => {
    engineRef.current?.setConfig(config);
  }, [config]);

  const resetStreak = useCallback(() => {
    longestRef.current = 0;
    setLongestStreak(0);
    setScareCount(0);
  }, []);

  return { stats, scareCount, longestStreak, engineRef, resetStreak };
}
