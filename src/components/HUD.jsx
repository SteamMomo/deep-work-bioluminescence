import { useMemo, useRef, useEffect, useState } from 'react';
import { PHASE_NAMES } from '../engine/colors.js';

// ─── Helpers ────────────────────────────────────────────────────────────────
function fmt2(n) { return String(n | 0).padStart(2, '0'); }
function fmt3(n) { return String(n | 0).padStart(3, '0'); }
function fmtTime(sec) {
  const h = (sec / 3600) | 0;
  const m = ((sec % 3600) / 60) | 0;
  const s = sec % 60 | 0;
  return `${fmt2(h)}:${fmt2(m)}:${fmt2(s)}`;
}
function calcFocusScore(longestStreak, scareCount) {
  const raw = Math.min(100, (longestStreak / 1800) * 100);
  return Math.max(0, Math.round(raw - scareCount * 1.5));
}

// ─── Focus Arc Gauge ────────────────────────────────────────────────────────
function FocusGauge({ score, accent }) {
  const R    = 38;
  const cx   = 50, cy = 52;
  const circ = Math.PI * R;
  const offset = circ * (1 - score / 100);

  return (
    <svg className="focus-gauge" width="100" height="66" viewBox="0 0 100 66">
      {/* Track */}
      <path
        d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`}
        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4"
      />
      {/* Progress */}
      <path
        d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`}
        fill="none"
        stroke={accent}
        strokeWidth="4"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 5px ${accent})`, transition: 'stroke-dashoffset 0.8s ease' }}
      />
      {/* Score text */}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="20" fontWeight="600"
        fill={accent} fontFamily="'Oxanium', monospace"
        style={{ filter: `drop-shadow(0 0 8px ${accent})` }}>
        {score}
      </text>
      <text x={cx} y={cy + 13} textAnchor="middle" fontSize="7" letterSpacing="2.5"
        fill="rgba(255,255,255,0.3)" fontFamily="'Share Tech Mono', monospace">
        FOCUS
      </text>
    </svg>
  );
}

// ─── Animated Number ────────────────────────────────────────────────────────
function AnimNum({ value, pad = 3 }) {
  const displayRef = useRef(value);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (value === displayRef.current) return;
    displayRef.current = value;
    setDisplay(value);
  }, [value]);

  return <span className="anim-num">{String(display | 0).padStart(pad, '0')}</span>;
}

// ─── Phase pips ────────────────────────────────────────────────────────────
function PhasePips({ phase, warm }) {
  return (
    <div className="phase-pips">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className={`pip ${phase >= i ? (warm ? 'lit-warm' : 'lit') : ''}`} />
      ))}
    </div>
  );
}

// ─── Mini bar ───────────────────────────────────────────────────────────────
function MiniBar({ value, max, warm }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="mini-bar">
      <div className={`mini-bar-fill ${warm ? 'warm' : ''}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── Ad Stream ──────────────────────────────────────────────────────────────
function AdStream({ stillnessSec, phase }) {
  const imp = Math.floor(stillnessSec * 1.4);
  const ctr = (0.4 + phase * 0.35).toFixed(1);
  const cpm = (1.10 + phase * 0.92).toFixed(2);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="ad-section">
      <div className="section-label">
        <span className="dot dot-purple" />
        Ad Sensor Stream
      </div>
      <div className="ad-box">
        <div className="ad-scanline" />
        <div className="ad-corner tl" /><div className="ad-corner tr" />
        <div className="ad-corner bl" /><div className="ad-corner br" />
        <div className="ad-inner">
          <div className="ad-badge">[AD STREAM: SENSORS ACTIVE]</div>
          <div className="ad-dims">300 × 250</div>
          <div className="ad-sub">DISPLAY UNIT // READY</div>
          <div className="ad-metrics">
            <div className="ad-metric">
              <span className="ad-metric-val">{ctr}%</span>
              <span>CTR</span>
            </div>
            <div className="ad-metric">
              <span className="ad-metric-val">${cpm}</span>
              <span>CPM</span>
            </div>
            <div className="ad-metric">
              <span className="ad-metric-val">{fmt3(Math.min(imp, 999))}</span>
              <span>IMP</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main HUD ───────────────────────────────────────────────────────────────
export default function HUD({
  stats, scareCount, longestStreak,
  sessionSec, accent, accentWarm, accentAlt,
  onSettingsOpen, onHudHide, onAudioToggle, audioEnabled,
}) {
  const { spores, jellies, phase, stillnessSec, fps, isScared, warm } = stats;
  const focusScore = useMemo(
    () => calcFocusScore(longestStreak, scareCount),
    [longestStreak, scareCount],
  );
  const currentAccent = warm ? accentWarm : accent;
  const phasePct = Math.min(100, (stillnessSec / 30) * 100);
  const densityPct = Math.min(100, ((spores + jellies) / 212) * 100);

  return (
    <aside className="hud" style={{ '--accent': accent, '--accent-warm': accentWarm, '--accent-alt': accentAlt }}>

      {/* HUD scan line */}
      <div className="hud-scan" />

      {/* Header */}
      <div className="hud-header">
        <div className="hud-logo">
          <div className="logo-dot" style={{ background: currentAccent, boxShadow: `0 0 10px ${currentAccent}` }} />
          <div>
            <div className="logo-title">DEEP WORK BIO</div>
            <div className="logo-sub">LUMINESCENCE // v3.0</div>
          </div>
        </div>
        <button className="icon-btn" onClick={onHudHide} title="Hide HUD (H)">╌</button>
      </div>

      {/* Stillness Monitor */}
      <div className="hud-section">
        <div className="section-label">
          <span className="dot" style={{ background: currentAccent, boxShadow: `0 0 6px ${currentAccent}` }} />
          Biometric Stillness Monitor
        </div>

        <div className="timer-wrap">
          <div className="timer-display" style={{ color: warm ? accentWarm : '#a5fdf2', textShadow: `0 0 30px ${currentAccent}80` }}>
            {fmtTime(stillnessSec)}
          </div>
          <div className="timer-sub">Stillness Duration</div>
        </div>

        <div className="phase-row">
          <PhasePips phase={phase} warm={warm} />
          <span className="phase-name" style={{ color: warm ? accentWarm : accent }}>
            {PHASE_NAMES[phase]}
          </span>
        </div>

        <div className="bar-row">
          <span>Biome</span>
          <MiniBar value={phasePct} max={100} warm={warm} />
          <span className="bar-val">{phasePct | 0}%</span>
        </div>
      </div>

      {/* Species Panel */}
      <div className="hud-section">
        <div className="section-label">
          <span className="dot" style={{ background: accent, boxShadow: `0 0 6px ${accent}` }} />
          Active Organisms
        </div>

        <div className="species-grid">
          <FocusGauge score={focusScore} accent={currentAccent} />
          <div className="species-list">
            <div className="species-row">
              <span className="sp-dot" style={{ background: accent, boxShadow: `0 0 5px ${accent}` }} />
              <span>Drifters</span>
              <AnimNum value={spores} pad={3} />
            </div>
            <div className="species-row">
              <span className="sp-dot" style={{ background: accentAlt, boxShadow: `0 0 5px ${accentAlt}` }} />
              <span>Jellies</span>
              <AnimNum value={jellies} pad={3} />
            </div>
            <div className="bar-row" style={{ marginTop: 8 }}>
              <span>Density</span>
              <MiniBar value={densityPct} max={100} warm={warm} />
              <span className="bar-val">{densityPct | 0}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Session Analytics */}
      <div className="hud-section">
        <div className="section-label">
          <span className="dot" style={{ background: accentAlt, boxShadow: `0 0 6px ${accentAlt}` }} />
          Session Analytics
        </div>
        <div className="analytics-grid">
          <div className="analytic">
            <div className="analytic-val" style={{ color: currentAccent }}>{fmtTime(longestStreak)}</div>
            <div className="analytic-label">Longest Streak</div>
          </div>
          <div className="analytic">
            <div className="analytic-val" style={{ color: isScared ? '#e05050' : accentAlt }}>{scareCount}</div>
            <div className="analytic-label">Disturbances</div>
          </div>
          <div className="analytic">
            <div className="analytic-val" style={{ color: '#a5fdf2' }}>{fmtTime(sessionSec)}</div>
            <div className="analytic-label">Session Time</div>
          </div>
          <div className="analytic">
            <div className="analytic-val" style={{ color: currentAccent }}>{focusScore}</div>
            <div className="analytic-label">Focus Score</div>
          </div>
        </div>
      </div>

      {/* Ad Stream */}
      <AdStream stillnessSec={stillnessSec} phase={phase} />

      {/* Footer */}
      <div className="hud-footer">
        <div className="footer-left">
          <div className={`led ${isScared ? 'led-red' : stillnessSec > 3 ? 'led-green' : ''}`} />
          <span>{isScared ? 'DISTURBED' : stillnessSec > 3 ? 'STILL' : 'DORMANT'}</span>
        </div>
        <div className="footer-actions">
          <button className="footer-btn" onClick={onAudioToggle} title="Toggle audio (M)">
            {audioEnabled ? '♪' : '♩'}
          </button>
          <button className="footer-btn" onClick={onSettingsOpen} title="Settings (S)">
            ⚙
          </button>
        </div>
        <div className="footer-fps">{fmt2(fps)} fps</div>
      </div>

    </aside>
  );
}
