import { useEffect, useRef } from 'react';
import { THEMES } from '../engine/colors.js';

function SliderRow({ label, value, min, max, step = 1, onChange, unit = '' }) {
  return (
    <div className="setting-row">
      <div className="setting-label-row">
        <span className="setting-label">{label}</span>
        <span className="setting-val">{value}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        className="setting-slider"
        onChange={e => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function Toggle({ label, value, onChange }) {
  return (
    <div className="setting-row toggle-row">
      <span className="setting-label">{label}</span>
      <button
        className={`toggle-btn ${value ? 'on' : ''}`}
        onClick={() => onChange(!value)}
        aria-pressed={value}
      >
        <span className="toggle-knob" />
      </button>
    </div>
  );
}

const SHORTCUT_ROWS = [
  ['H', 'Toggle HUD'],
  ['S', 'Settings Panel'],
  ['M', 'Mute / Unmute'],
  ['F', 'Fullscreen'],
];

export default function Settings({
  open, onClose, config, onConfigChange,
  audioEnabled, onAudioToggle, audioVolume, onVolumeChange,
  onResetStats,
}) {
  const panelRef = useRef(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Focus trap
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      {open && <div className="settings-backdrop" onClick={onClose} />}

      <div className={`settings-panel ${open ? 'open' : ''}`} ref={panelRef} tabIndex={-1}>
        <div className="settings-header">
          <div className="settings-title">
            <span className="dot dot-accent" />
            SYSTEM CONFIGURATION
          </div>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>

        <div className="settings-body">

          {/* Creature Controls */}
          <div className="settings-group">
            <div className="settings-group-label">Creature Controls</div>
            <SliderRow
              label="Sensitivity"
              value={config.sensitivity}
              min={1} max={20} step={1}
              unit=" px"
              onChange={v => onConfigChange('sensitivity', v)}
            />
            <SliderRow
              label="Max Density"
              value={Math.round(config.maxDensity * 100)}
              min={10} max={100} step={5}
              unit="%"
              onChange={v => onConfigChange('maxDensity', v / 100)}
            />
          </div>

          {/* Color Theme */}
          <div className="settings-group">
            <div className="settings-group-label">Color Theme</div>
            <div className="theme-grid">
              {Object.entries(THEMES).map(([key, t]) => (
                <button
                  key={key}
                  className={`theme-btn ${config.theme === key ? 'active' : ''}`}
                  style={{ '--t-accent': t.accent }}
                  onClick={() => onConfigChange('theme', key)}
                >
                  <div className="theme-swatch" style={{ background: `radial-gradient(circle at 40% 40%, ${t.sporeCool[0]}, ${t.bgStops.cool[2]})` }} />
                  <span>{t.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Audio */}
          <div className="settings-group">
            <div className="settings-group-label">Audio</div>
            <Toggle
              label="Ambient Sound"
              value={audioEnabled}
              onChange={onAudioToggle}
            />
            {audioEnabled && (
              <SliderRow
                label="Volume"
                value={Math.round(audioVolume * 100)}
                min={0} max={100} step={5}
                unit="%"
                onChange={v => onVolumeChange(v / 100)}
              />
            )}
          </div>

          {/* Session */}
          <div className="settings-group">
            <div className="settings-group-label">Session</div>
            <div className="setting-row">
              <button className="reset-btn" onClick={onResetStats}>
                Reset Session Stats
              </button>
            </div>
          </div>

          {/* Keyboard Shortcuts */}
          <div className="settings-group">
            <div className="settings-group-label">Keyboard Shortcuts</div>
            <div className="shortcuts-grid">
              {SHORTCUT_ROWS.map(([key, desc]) => (
                <div key={key} className="shortcut-row">
                  <kbd>{key}</kbd>
                  <span>{desc}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
