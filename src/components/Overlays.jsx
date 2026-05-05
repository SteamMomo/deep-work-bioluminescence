import { useState, useEffect, useRef } from 'react';

// ─── Custom Cursor ──────────────────────────────────────────────────────────
export function Cursor({ mouseX, mouseY, accent }) {
  const ringRef = useRef({ x: mouseX, y: mouseY });
  const [ring, setRing] = useState({ x: mouseX, y: mouseY });
  const rafRef = useRef(null);

  useEffect(() => {
    function animate() {
      ringRef.current.x += (mouseX - ringRef.current.x) * 0.13;
      ringRef.current.y += (mouseY - ringRef.current.y) * 0.13;
      setRing({ x: ringRef.current.x, y: ringRef.current.y });
      rafRef.current = requestAnimationFrame(animate);
    }
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [mouseX, mouseY]);

  return (
    <>
      <div className="cursor-dot" style={{ left: mouseX, top: mouseY, background: accent, boxShadow: `0 0 12px 4px ${accent}` }} />
      <div className="cursor-ring" style={{ left: ring.x, top: ring.y, borderColor: `${accent}66` }} />
    </>
  );
}

// ─── Scare Flash ────────────────────────────────────────────────────────────
export function ScareFlash({ active }) {
  return <div className={`scare-flash ${active ? 'visible' : ''}`} />;
}

// ─── Hint ───────────────────────────────────────────────────────────────────
export function Hint({ visible }) {
  return (
    <div className={`hint-text ${visible ? '' : 'faded'}`}>
      Be still — the deep will awaken
    </div>
  );
}

// ─── Phase Toast ────────────────────────────────────────────────────────────
const PHASE_TOASTS = [
  null,
  'DRIFTER EMERGENCE DETECTED',
  'DEEP JELLY BLOOM INITIATED',
  'BIOLUMINESCENT BLOOM — MAXIMUM STILLNESS',
];

export function PhaseToast({ phase, accent }) {
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState('');
  const prevPhase = useRef(0);
  const timerRef  = useRef(null);

  useEffect(() => {
    if (phase > prevPhase.current && PHASE_TOASTS[phase]) {
      setText(PHASE_TOASTS[phase]);
      setVisible(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setVisible(false), 3500);
    }
    prevPhase.current = phase;
    return () => clearTimeout(timerRef.current);
  }, [phase]);

  return (
    <div className={`phase-toast ${visible ? 'visible' : ''}`} style={{ color: accent, borderColor: `${accent}44`, boxShadow: `0 0 30px ${accent}22` }}>
      <span className="toast-arrow">▶</span>
      {text}
    </div>
  );
}

// ─── Show-HUD button (when HUD is hidden) ───────────────────────────────────
export function ShowHUDButton({ onClick, accent }) {
  return (
    <button className="show-hud-btn" onClick={onClick} style={{ borderColor: `${accent}44`, color: accent, boxShadow: `0 0 20px ${accent}22` }}>
      ◉
    </button>
  );
}
