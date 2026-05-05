import { useRef, useState, useCallback, useEffect } from 'react';
import Canvas from './components/Canvas.jsx';
import HUD from './components/HUD.jsx';
import Settings from './components/Settings.jsx';
import { Cursor, ScareFlash, Hint, PhaseToast, ShowHUDButton } from './components/Overlays.jsx';
import { useEngine } from './hooks/useEngine.js';
import { useAudio } from './hooks/useAudio.js';
import { THEMES } from './engine/colors.js';

const INIT_CONFIG = { sensitivity: 5, maxDensity: 1.0, theme: 'ocean' };

export default function App() {
  const canvasRef     = useRef(null);
  const sessionStart  = useRef(Date.now());

  const [config,       setConfig]       = useState(INIT_CONFIG);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hudVisible,   setHudVisible]   = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioVolume,  setAudioVolume]  = useState(0.45);
  const [scareFlash,   setScareFlash]   = useState(false);
  const [hintVisible,  setHintVisible]  = useState(true);
  const [mousePos,     setMousePos]     = useState({ x: -100, y: -100 });
  const [sessionSec,   setSessionSec]   = useState(0);

  // Audio hook
  const { initAudio, playScareSound } = useAudio(audioEnabled, audioVolume, 0);

  // Scare callback (stable ref)
  const onScare = useCallback(() => {
    playScareSound();
    setScareFlash(true);
    setTimeout(() => setScareFlash(false), 300);
  }, [playScareSound]);

  // Phase change callback
  const onPhaseChange = useCallback((phase) => {
    if (phase >= 1) setHintVisible(false);
  }, []);

  // Engine hook
  const { stats, scareCount, longestStreak, resetStreak } = useEngine(
    canvasRef, config, onScare, onPhaseChange,
  );

  // Session clock
  useEffect(() => {
    const id = setInterval(() => {
      setSessionSec(((Date.now() - sessionStart.current) / 1000) | 0);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Mouse tracking for cursor overlay
  useEffect(() => {
    const onMove = (e) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      switch (e.key.toLowerCase()) {
        case 'h': setHudVisible(v => !v);        break;
        case 's': setSettingsOpen(v => !v);       break;
        case 'm':
          if (!audioEnabled) { initAudio(); setAudioEnabled(true); }
          else setAudioEnabled(v => !v);
          break;
        case 'f':
          if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
          else document.exitFullscreen?.();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [audioEnabled, initAudio]);

  const handleConfigChange = useCallback((key, val) => {
    setConfig(prev => ({ ...prev, [key]: val }));
  }, []);

  const handleAudioToggle = useCallback(() => {
    if (!audioEnabled) { initAudio(); setAudioEnabled(true); }
    else setAudioEnabled(false);
  }, [audioEnabled, initAudio]);

  const theme = THEMES[config.theme];
  const { accent, accentWarm, accentAlt } = theme;

  return (
    <div className="app" data-theme={config.theme}>

      {/* Canvas fills everything left of HUD */}
      <Canvas ref={canvasRef} />

      {/* Cursor overlays */}
      <Cursor mouseX={mousePos.x} mouseY={mousePos.y} accent={stats.warm ? accentWarm : accent} />

      {/* Flash on scare */}
      <ScareFlash active={scareFlash} />

      {/* Ambient hint */}
      <Hint visible={hintVisible} />

      {/* Phase transition toast */}
      <PhaseToast phase={stats.phase} accent={stats.warm ? accentWarm : accent} />

      {/* HUD */}
      {hudVisible && (
        <HUD
          stats={stats}
          scareCount={scareCount}
          longestStreak={longestStreak}
          sessionSec={sessionSec}
          accent={accent}
          accentWarm={accentWarm}
          accentAlt={accentAlt}
          onSettingsOpen={() => setSettingsOpen(true)}
          onHudHide={() => setHudVisible(false)}
          onAudioToggle={handleAudioToggle}
          audioEnabled={audioEnabled}
        />
      )}

      {/* Restore HUD button */}
      {!hudVisible && (
        <ShowHUDButton onClick={() => setHudVisible(true)} accent={accent} />
      )}

      {/* Settings panel */}
      <Settings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        config={config}
        onConfigChange={handleConfigChange}
        audioEnabled={audioEnabled}
        onAudioToggle={handleAudioToggle}
        audioVolume={audioVolume}
        onVolumeChange={setAudioVolume}
        onResetStats={() => { resetStreak(); setSettingsOpen(false); }}
      />

    </div>
  );
}
