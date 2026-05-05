import { THEMES, PHASE_THRESHOLDS, fmtColor, pickRand } from './colors.js';

// Tuned for performance — shadowBlur is replaced with sprite blitting
const MAX_SPORES  = 120;
const TRAIL_LEN   = 22;
const MAX_JELLIES = 10;

// Keys reserved for app shortcuts — don't trigger scare
const RESERVED_KEYS = new Set(['h', 'H', 's', 'S', 'm', 'M', 'f', 'F']);

// Phase 3 density caps (lower than before)
const SPORE_MAX  = [0, 28, 55, 90];   // per phase
const JELLY_MAX  = [0,  0,  4,  6];
const SPORE_IVLS = [0, 1200, 900, 600]; // ms between spawn batches

export class BioEngine {
  constructor(canvas, config = {}) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');

    this.sensitivity      = config.sensitivity      ?? 5;
    this.maxDensityFactor = config.maxDensity       ?? 1.0;
    this.themeName        = config.theme             ?? 'ocean';
    this.theme            = THEMES[this.themeName];

    this.W = 0; this.H = 0; this.DPR = 1;
    this.running = false;
    this.raf = null;

    this.mouseX = 0; this.mouseY = 0;
    this.lastMX = 0; this.lastMY = 0;
    this.lastMoveTime = 0;

    this.lastActivityTime = performance.now();
    this.stillnessSec = 0;
    this.currentPhase = 0;
    this.isScared = false;

    this.lastFrameTime = performance.now();
    this.fpsFrames = 0;
    this.fpsLast   = performance.now();
    this.fps = 60;

    // Adaptive quality — auto-reduces particle count if FPS tanks
    this._qualityLevel  = 2;   // 0=low 1=med 2=high
    this._lastQualityCheck = performance.now();

    this.bgDirty  = true;
    this.bgCache  = null;
    this.prevWarm = false;

    // Sprite cache: color string → offscreen canvas
    // Avoids all shadowBlur calls — drawImage is GPU-accelerated blitting
    this._spriteCache = new Map();

    this._initPools();

    this.lastSporeSpawn = 0;
    this.lastJellySpawn = 0;
    this.lastStatsEmit  = 0;

    this.onStatsUpdate = null;
    this.onScare       = null;
    this.onPhaseChange = null;

    this._onResize     = () => this._resize();
    this._onMouseMove  = (e) => this._handleMouseMove(e);
    this._onActivity   = (e) => this._handleActivity(e);
    this._onVisibility = () => { if (document.hidden) this._scare(this.mouseX, this.mouseY); };
    this._onBlur       = () => this._scare(this.mouseX, this.mouseY);
    this._loop         = this._loop.bind(this);
  }

  // ─── Pool init ───────────────────────────────────────────────
  _initPools() {
    this.spores = Array.from({ length: MAX_SPORES }, () => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0,
      radius: 0, color: '#00e8d0',
      opacity: 0, targetOpacity: 0,
      trail: new Float32Array(TRAIL_LEN * 2),
      trailHead: 0, trailLen: 0,
      lifetime: 0, maxLife: 0,
      scared: false, scareVx: 0, scareVy: 0,
      wanderAngle: 0,
    }));
    this.activeSpores = 0;

    this.jellies = Array.from({ length: MAX_JELLIES }, () => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0,
      radius: 0, color: { r: 80, g: 160, b: 255, a: 0.55 },
      opacity: 0, targetOpacity: 0,
      pulsePhase: 0, pulseSpeed: 0,
      tentCount: 0,
      tentPhase: new Float32Array(12),
      tentLen:   new Float32Array(12),
      scared: false, scareVx: 0, scareVy: 0,
      lifetime: 0, maxLife: 0,
    }));
    this.activeJellies = 0;
  }

  // ─── Sprite cache ────────────────────────────────────────────
  // Pre-renders a radial gradient glow for each unique color+radius.
  // Called once per unique combination; then drawImage replaces all
  // shadowBlur + arc calls — a 10-30× speedup per particle.
  _getSprite(hexColor, radius) {
    const key = `${hexColor}_${radius | 0}`;
    if (this._spriteCache.has(key)) return this._spriteCache.get(key);

    const size = Math.max(10, Math.ceil(radius * 8));
    const oc   = document.createElement('canvas');
    oc.width   = size;
    oc.height  = size;
    const c    = oc.getContext('2d');
    const cx   = size / 2;

    const ri = parseInt(hexColor.slice(1, 3), 16);
    const gi = parseInt(hexColor.slice(3, 5), 16);
    const bi = parseInt(hexColor.slice(5, 7), 16);

    const gr = c.createRadialGradient(cx, cx, 0, cx, cx, cx);
    gr.addColorStop(0,    `rgba(235,255,252,1)`);           // bright white core
    gr.addColorStop(0.18, `rgba(${ri},${gi},${bi},0.92)`); // full color
    gr.addColorStop(0.50, `rgba(${ri},${gi},${bi},0.32)`); // soft mid glow
    gr.addColorStop(1,    `rgba(${ri},${gi},${bi},0)`);    // transparent edge

    c.fillStyle = gr;
    c.fillRect(0, 0, size, size);

    this._spriteCache.set(key, oc);
    return oc;
  }

  // ─── Public API ──────────────────────────────────────────────
  start() {
    this.running = true;
    this._resize();
    this._attachListeners();
    this.raf = requestAnimationFrame(this._loop);
  }

  stop() {
    this.running = false;
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; }
    this._detachListeners();
    this._spriteCache.clear();
  }

  setConfig(cfg) {
    if (cfg.sensitivity  !== undefined) this.sensitivity      = cfg.sensitivity;
    if (cfg.maxDensity   !== undefined) this.maxDensityFactor = cfg.maxDensity;
    if (cfg.theme !== undefined && THEMES[cfg.theme]) {
      this.themeName = cfg.theme;
      this.theme     = THEMES[cfg.theme];
      this.bgDirty   = true;
      this._spriteCache.clear(); // colours changed
    }
  }

  // ─── Resize ──────────────────────────────────────────────────
  _resize() {
    this.DPR = Math.min(window.devicePixelRatio || 1, 2);
    this.W   = this.canvas.clientWidth;
    this.H   = this.canvas.clientHeight;
    this.canvas.width  = this.W * this.DPR;
    this.canvas.height = this.H * this.DPR;
    this.ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);
    this.bgDirty = true;
  }

  // ─── Listeners ───────────────────────────────────────────────
  _attachListeners() {
    window.addEventListener('resize',             this._onResize);
    document.addEventListener('mousemove',        this._onMouseMove,  { passive: true });
    document.addEventListener('click',            this._onActivity,   { passive: true });
    document.addEventListener('keydown',          this._onActivity,   { passive: true });
    document.addEventListener('scroll',           this._onActivity,   { passive: true });
    document.addEventListener('touchstart',       this._onActivity,   { passive: true });
    document.addEventListener('visibilitychange', this._onVisibility);
    window.addEventListener('blur',               this._onBlur);
  }

  _detachListeners() {
    window.removeEventListener('resize',             this._onResize);
    document.removeEventListener('mousemove',        this._onMouseMove);
    document.removeEventListener('click',            this._onActivity);
    document.removeEventListener('keydown',          this._onActivity);
    document.removeEventListener('scroll',           this._onActivity);
    document.removeEventListener('touchstart',       this._onActivity);
    document.removeEventListener('visibilitychange', this._onVisibility);
    window.removeEventListener('blur',               this._onBlur);
  }

  _handleMouseMove(e) {
    const nx = e.clientX, ny = e.clientY;
    this.mouseX = nx; this.mouseY = ny;
    const now = performance.now();
    if (now - this.lastMoveTime < 16) return;
    this.lastMoveTime = now;
    const speed = Math.hypot(nx - this.lastMX, ny - this.lastMY);
    this.lastMX = nx; this.lastMY = ny;
    if (speed > this.sensitivity) this._scare(nx, ny);
    else this.lastActivityTime = now;
  }

  _handleActivity(e) {
    if (e.type === 'keydown' && RESERVED_KEYS.has(e.key)) return;
    this._scare(this.mouseX, this.mouseY);
  }

  // ─── Scare ───────────────────────────────────────────────────
  _scare(cx, cy) {
    this.isScared       = true;
    this.lastActivityTime = performance.now();
    const prev = this.currentPhase;
    this.currentPhase   = 0;

    for (let i = 0; i < MAX_SPORES; i++) {
      const s = this.spores[i];
      if (!s.active) continue;
      const dx = s.x - cx, dy = s.y - cy;
      const d  = Math.hypot(dx, dy) + 1;
      const f  = 16 + 150 / (d * 0.05 + 1);
      s.scareVx = (dx / d) * f;
      s.scareVy = (dy / d) * f;
      s.scared  = true;
      s.targetOpacity = 0;
    }

    for (let i = 0; i < MAX_JELLIES; i++) {
      const j = this.jellies[i];
      if (!j.active) continue;
      const dx = j.x - cx, dy = j.y - cy;
      const d  = Math.hypot(dx, dy) + 1;
      const f  = 9 + 60 / (d * 0.025 + 1);
      j.scareVx = (dx / d) * f;
      j.scareVy = (dy / d) * f;
      j.scared  = true;
      j.targetOpacity = 0;
    }

    if (this.onScare) this.onScare();
    if (prev !== 0 && this.onPhaseChange) this.onPhaseChange(0, prev);
  }

  // ─── Adaptive quality ────────────────────────────────────────
  // Silently kills excess spores if FPS drops below threshold.
  _adaptQuality(now) {
    if (now - this._lastQualityCheck < 2000) return;
    this._lastQualityCheck = now;

    if (this.fps < 28 && this.activeSpores > 10) {
      // Kill ~20% of active spores
      const target = Math.max(5, this.activeSpores * 0.8 | 0);
      let killed = 0;
      for (let i = MAX_SPORES - 1; i >= 0 && this.activeSpores > target; i--) {
        if (this.spores[i].active && !this.spores[i].scared) {
          this.spores[i].targetOpacity = 0;
          killed++;
        }
      }
    }

    if (this.fps < 24 && this.activeJellies > 1) {
      for (let i = MAX_JELLIES - 1; i >= 0; i--) {
        if (this.jellies[i].active) { this.jellies[i].targetOpacity = 0; break; }
      }
    }
  }

  // ─── Spawn ───────────────────────────────────────────────────
  _spawnSpore(warm) {
    let s = null;
    for (let i = 0; i < MAX_SPORES; i++) {
      if (!this.spores[i].active) { s = this.spores[i]; break; }
    }
    if (!s) return;
    s.active = true;

    if (Math.random() < 0.22) {
      const side = (Math.random() * 4) | 0;
      if      (side === 0) { s.x = Math.random() * this.W; s.y = -12; }
      else if (side === 1) { s.x = this.W + 12; s.y = Math.random() * this.H; }
      else if (side === 2) { s.x = Math.random() * this.W; s.y = this.H + 12; }
      else                 { s.x = -12; s.y = Math.random() * this.H; }
    } else {
      s.x = Math.random() * this.W;
      s.y = Math.random() * this.H;
    }

    s.vx = (Math.random() - 0.5) * 0.5;
    s.vy = (Math.random() - 0.5) * 0.5;
    s.radius = 1.8 + Math.random() * 3.2;
    s.color  = pickRand(warm ? this.theme.sporeWarm : this.theme.sporeCool);
    s.opacity = 0;
    s.targetOpacity = 0.65 + Math.random() * 0.35;
    for (let t = 0; t < TRAIL_LEN; t++) {
      s.trail[t * 2] = s.x; s.trail[t * 2 + 1] = s.y;
    }
    s.trailHead = 0; s.trailLen = 0;
    s.lifetime  = 0; s.maxLife  = 14000 + Math.random() * 20000;
    s.scared    = false; s.scareVx = 0; s.scareVy = 0;
    s.wanderAngle = Math.random() * Math.PI * 2;
    this.activeSpores++;
  }

  _spawnJelly(warm) {
    let j = null;
    for (let i = 0; i < MAX_JELLIES; i++) {
      if (!this.jellies[i].active) { j = this.jellies[i]; break; }
    }
    if (!j) return;
    j.active = true;
    j.x = 80 + Math.random() * (this.W - 160);
    j.y = 60 + Math.random() * (this.H - 120);
    j.vx = (Math.random() - 0.5) * 0.25;
    j.vy = (Math.random() - 0.5) * 0.18 - 0.06;
    j.radius = 20 + Math.random() * 38;
    j.color  = { ...pickRand(warm ? this.theme.jellyWarm : this.theme.jellyCool) };
    j.opacity = 0; j.targetOpacity = 0.72 + Math.random() * 0.22;
    j.pulsePhase = Math.random() * Math.PI * 2;
    j.pulseSpeed = 0.55 + Math.random() * 0.85;
    j.tentCount  = 5 + (Math.random() * 5 | 0);  // 5-9 (was 6-11)
    for (let ti = 0; ti < j.tentCount; ti++) {
      j.tentPhase[ti] = Math.random() * Math.PI * 2;
      j.tentLen[ti]   = j.radius * (1.0 + Math.random() * 1.4);
    }
    j.scared = false; j.scareVx = 0; j.scareVy = 0;
    j.lifetime = 0; j.maxLife  = 28000 + Math.random() * 40000;
    this.activeJellies++;
  }

  _handleSpawning(now, warm) {
    if (this.currentPhase < 1) return;
    const d   = this.maxDensityFactor;
    const ph  = this.currentPhase;

    const sporeMax = Math.round(SPORE_MAX[ph] * d);
    const ivl      = SPORE_IVLS[ph];

    if (now - this.lastSporeSpawn > ivl && this.activeSpores < sporeMax) {
      // Only batch-spawn at phase 3 if FPS is healthy
      const batch = (ph >= 3 && this.fps >= 45) ? 2 : 1;
      for (let b = 0; b < batch; b++) this._spawnSpore(warm);
      this.lastSporeSpawn = now;
    }

    if (ph >= 2) {
      const jellyMax = Math.round(JELLY_MAX[ph] * d);
      const jellyIvl = ph >= 3 ? 5000 : 9000;
      if (now - this.lastJellySpawn > jellyIvl && this.activeJellies < jellyMax) {
        this._spawnJelly(warm);
        this.lastJellySpawn = now;
      }
    }
  }

  // ─── Update: Spore ───────────────────────────────────────────
  _updateSpore(s, dt) {
    s.lifetime += dt;
    if (s.lifetime >= s.maxLife) s.targetOpacity = 0;

    const spd = 0.0025 * dt;
    if      (s.opacity < s.targetOpacity) s.opacity = Math.min(s.targetOpacity, s.opacity + spd);
    else if (s.opacity > s.targetOpacity) s.opacity = Math.max(0, s.opacity - spd);

    if (s.opacity <= 0.004 && s.targetOpacity === 0) {
      s.active = false; this.activeSpores--; return;
    }

    if (s.scared) {
      s.vx += s.scareVx * 0.10; s.vy += s.scareVy * 0.10;
      s.scareVx *= 0.88; s.scareVy *= 0.88;
    } else {
      s.wanderAngle += (Math.random() - 0.5) * 0.04 * dt;
      s.vx += Math.cos(s.wanderAngle) * 0.0004 * dt;
      s.vy += Math.sin(s.wanderAngle) * 0.0004 * dt;
      const dx = this.mouseX - s.x, dy = this.mouseY - s.y;
      const d  = Math.hypot(dx, dy) + 1;
      if (d > 60 && d < 350) {
        const f = 0.000015 * dt;
        s.vx += (dx / d) * f * d;
        s.vy += (dy / d) * f * d;
      }
    }

    const damp = s.scared ? 0.975 : 0.992;
    s.vx *= damp; s.vy *= damp;
    s.x  += s.vx * dt * 0.055;
    s.y  += s.vy * dt * 0.055;

    if (s.x < -40)         s.x = this.W + 40;
    if (s.x > this.W + 40) s.x = -40;
    if (s.y < -40)         s.y = this.H + 40;
    if (s.y > this.H + 40) s.y = -40;

    s.trailHead = (s.trailHead + 1) % TRAIL_LEN;
    s.trail[s.trailHead * 2]     = s.x;
    s.trail[s.trailHead * 2 + 1] = s.y;
    if (s.trailLen < TRAIL_LEN) s.trailLen++;
  }

  // ─── Update: Jelly ───────────────────────────────────────────
  _updateJelly(j, dt, t) {
    j.lifetime += dt;
    if (j.lifetime >= j.maxLife) j.targetOpacity = 0;

    const spd = 0.0018 * dt;
    if      (j.opacity < j.targetOpacity) j.opacity = Math.min(j.targetOpacity, j.opacity + spd);
    else if (j.opacity > j.targetOpacity) j.opacity = Math.max(0, j.opacity - spd * 0.6);

    if (j.opacity <= 0.004 && j.targetOpacity === 0) {
      j.active = false; this.activeJellies--; return;
    }

    j.pulsePhase += j.pulseSpeed * dt * 0.001;
    for (let ti = 0; ti < j.tentCount; ti++) j.tentPhase[ti] += 0.0007 * dt;

    if (j.scared) {
      j.vx += j.scareVx * 0.07; j.vy += j.scareVy * 0.07;
      j.scareVx *= 0.88; j.scareVy *= 0.88;
    } else {
      j.vy -= 0.000008 * dt;
      j.vx += Math.sin(t * 0.0003 + j.x * 0.008) * 0.00004 * dt;
    }

    j.vx *= 0.996; j.vy *= 0.996;
    j.x  += j.vx * dt * 0.055;
    j.y  += j.vy * dt * 0.055;

    const mg = 70;
    if (j.x < mg)          j.vx += 0.004 * dt;
    if (j.x > this.W - mg) j.vx -= 0.004 * dt;
    if (j.y < mg)          j.vy += 0.004 * dt;
    if (j.y > this.H - mg) j.vy -= 0.004 * dt;
  }

  // ─── Draw: Background ────────────────────────────────────────
  _drawBackground(warm) {
    if (this.bgDirty || warm !== this.prevWarm) {
      this.bgDirty  = false;
      this.prevWarm = warm;
      const stops = warm ? this.theme.bgStops.warm : this.theme.bgStops.cool;
      const g = this.ctx.createRadialGradient(
        this.W * 0.28, this.H * 0.65, 0,
        this.W * 0.5,  this.H * 0.5,  Math.max(this.W, this.H) * 0.95,
      );
      g.addColorStop(0, stops[0]); g.addColorStop(0.4, stops[1]); g.addColorStop(1, stops[2]);
      this.bgCache = g;
    }
    this.ctx.fillStyle = this.bgCache;
    this.ctx.fillRect(0, 0, this.W, this.H);
  }

  // ─── Draw: Spore ─────────────────────────────────────────────
  // ZERO shadowBlur calls. Trails are drawImage at decreasing scale.
  _drawSpore(s) {
    if (s.opacity < 0.015) return;

    const sprite = this._getSprite(s.color, s.radius);
    const sz     = sprite.width;
    const half   = sz / 2;
    const tLen   = Math.min(s.trailLen, TRAIL_LEN);

    // Trail — sample every 2nd point to halve draw calls
    for (let i = tLen - 1; i >= 2; i -= 2) {
      const idx  = ((s.trailHead - i + TRAIL_LEN) % TRAIL_LEN);
      const tx   = s.trail[idx * 2];
      const ty   = s.trail[idx * 2 + 1];
      const frac = 1 - i / tLen;
      const dsz  = sz * frac * 0.65;
      if (dsz < 1.5) continue;
      this.ctx.globalAlpha = s.opacity * frac * 0.32;
      this.ctx.drawImage(sprite, tx - dsz * 0.5, ty - dsz * 0.5, dsz, dsz);
    }

    // Core
    this.ctx.globalAlpha = s.opacity;
    this.ctx.drawImage(sprite, s.x - half, s.y - half, sz, sz);

    this.ctx.globalAlpha = 1;
  }

  // ─── Draw: Jelly ─────────────────────────────────────────────
  // shadowBlur used only once per jelly (bell body), removed from tentacles.
  _drawJelly(j, t) {
    if (j.opacity < 0.01) return;
    const op   = j.opacity;
    const c    = j.color;
    const pf   = 0.82 + 0.18 * Math.sin(j.pulsePhase);
    const shrk = j.scared ? 0.65 : 1.0;
    const rX   = j.radius * pf * shrk;
    const rY   = j.radius * (1.85 - pf) * 0.55 * shrk;
    const ctx  = this.ctx;

    ctx.save();
    ctx.translate(j.x, j.y);
    ctx.globalAlpha = op;

    // Outer diffuse glow — single radial gradient, no shadowBlur
    const gR = rX * 1.7;
    const og = ctx.createRadialGradient(0, 0, 0, 0, 0, gR);
    og.addColorStop(0,   fmtColor(c, c.a * 0.45));
    og.addColorStop(0.5, fmtColor(c, c.a * 0.1));
    og.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.ellipse(0, 0, gR, gR * 0.68, 0, 0, 6.2832);
    ctx.fillStyle = og;
    ctx.fill();

    // Bell body — one shadowBlur per jelly (not per tentacle)
    const bg = ctx.createRadialGradient(0, -rY * 0.25, 0, 0, 0, rX);
    bg.addColorStop(0,    fmtColor(c, Math.min(0.96, c.a * 1.7)));
    bg.addColorStop(0.55, fmtColor(c, c.a));
    bg.addColorStop(1,    fmtColor(c, 0.04));
    ctx.shadowBlur  = 16;
    ctx.shadowColor = fmtColor(c, 0.75);
    ctx.beginPath();
    ctx.ellipse(0, 0, rX, rY, 0, Math.PI, 0);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.shadowBlur = 0; // reset immediately

    // Rim
    ctx.globalAlpha = op * 0.5;
    ctx.strokeStyle = fmtColor(c, 0.65);
    ctx.lineWidth   = 0.8;
    ctx.beginPath();
    ctx.ellipse(0, 0, rX, rY, 0, Math.PI, 0);
    ctx.stroke();

    // Tentacles — NO shadowBlur, just alpha-faded strokes (big savings)
    const tShrk = j.scared ? 0.35 : 1.0;
    const SEGS  = 7; // reduced from 10
    for (let ti = 0; ti < j.tentCount; ti++) {
      const angle = Math.PI + (ti / (j.tentCount - 1)) * Math.PI;
      const baseX = Math.cos(angle) * rX * 0.82;
      const baseY = Math.sin(angle) * rY * 0.85;
      const tLen  = j.tentLen[ti] * tShrk;
      const phase = j.tentPhase[ti] + t * 0.0009 * j.pulseSpeed;

      ctx.globalAlpha = op * (j.scared ? 0.18 : Math.max(0.08, 0.5 - ti * 0.04));
      ctx.lineWidth   = Math.max(0.4, 1.3 - ti * 0.08);
      ctx.strokeStyle = fmtColor(c, 0.9);
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);

      for (let seg = 1; seg <= SEGS; seg++) {
        const frac = seg / SEGS;
        ctx.lineTo(
          baseX + Math.sin(phase + frac * 3.2) * rX * 0.2 * frac + Math.cos(angle) * tLen * frac * 0.14,
          baseY + tLen * frac + Math.cos(phase * 0.7 + frac * 2.0) * rX * 0.09 * frac,
        );
      }
      ctx.stroke();
    }

    // Inner rings — lightweight, no shadow
    ctx.globalAlpha = op * 0.12;
    for (let ri = 1; ri <= 2; ri++) {  // 2 rings (was 3)
      const rr = rX * (ri / 2) * 0.82;
      ctx.strokeStyle = fmtColor(c, 0.45);
      ctx.lineWidth   = 0.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, rr, rr * (rY / rX), 0, Math.PI, 0);
      ctx.stroke();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
  }

  // ─── Main loop ───────────────────────────────────────────────
  _loop(now) {
    if (!this.running) return;

    const dt = Math.min(now - this.lastFrameTime, 48);
    this.lastFrameTime = now;

    this.fpsFrames++;
    if (now - this.fpsLast >= 1000) {
      this.fps       = this.fpsFrames;
      this.fpsFrames = 0;
      this.fpsLast   = now;
    }

    this.stillnessSec = (now - this.lastActivityTime) / 1000;

    let newPhase = 0;
    for (let i = PHASE_THRESHOLDS.length - 1; i >= 0; i--) {
      if (this.stillnessSec >= PHASE_THRESHOLDS[i]) { newPhase = i; break; }
    }
    if (newPhase !== this.currentPhase) {
      const prev = this.currentPhase;
      this.currentPhase = newPhase;
      if (this.onPhaseChange) this.onPhaseChange(newPhase, prev);
    }

    const warm = this.currentPhase >= 3;

    // Recover scared organisms after 2s
    if (now - this.lastActivityTime > 2000) {
      this.isScared = false;
      for (let i = 0; i < MAX_SPORES; i++) {
        const s = this.spores[i];
        if (s.active && s.scared) { s.scared = false; s.targetOpacity = 0.65 + Math.random() * 0.35; }
      }
      for (let i = 0; i < MAX_JELLIES; i++) {
        const j = this.jellies[i];
        if (j.active && j.scared) { j.scared = false; j.targetOpacity = 0.72 + Math.random() * 0.22; }
      }
    }

    // Adaptive quality — silently culls particles if FPS tanks
    this._adaptQuality(now);

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);
    this._drawBackground(warm);
    ctx.globalCompositeOperation = 'screen';

    this._handleSpawning(now, warm);

    for (let i = 0; i < MAX_SPORES; i++) {
      const s = this.spores[i];
      if (!s.active) continue;
      this._updateSpore(s, dt);
      if (s.active) this._drawSpore(s);
    }

    for (let i = 0; i < MAX_JELLIES; i++) {
      const j = this.jellies[i];
      if (!j.active) continue;
      this._updateJelly(j, dt, now);
      if (j.active) this._drawJelly(j, now);
    }

    ctx.globalCompositeOperation = 'source-over';

    if (now - this.lastStatsEmit >= 100 && this.onStatsUpdate) {
      this.lastStatsEmit = now;
      this.onStatsUpdate({
        spores: this.activeSpores,
        jellies: this.activeJellies,
        phase: this.currentPhase,
        stillnessSec: this.stillnessSec,
        fps: this.fps,
        isScared: this.isScared,
        warm,
      });
    }

    this.raf = requestAnimationFrame(this._loop);
  }
}
