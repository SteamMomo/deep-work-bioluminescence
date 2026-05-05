export const THEMES = {
  ocean: {
    name: 'Ocean Deep',
    sporeCool: ['#00e8d0', '#0af2d4', '#30ffe8', '#00c8b8', '#6bffe0'],
    sporeWarm: ['#ff72b8', '#ffb84d', '#f0c84a', '#ff9060', '#ff60a0'],
    jellyCool: [
      { r: 80,  g: 160, b: 255, a: 0.55 },
      { r: 60,  g: 200, b: 220, a: 0.50 },
      { r: 120, g: 90,  b: 255, a: 0.52 },
      { r: 40,  g: 180, b: 200, a: 0.48 },
    ],
    jellyWarm: [
      { r: 255, g: 100, b: 180, a: 0.55 },
      { r: 255, g: 185, b: 70,  a: 0.50 },
      { r: 255, g: 140, b: 100, a: 0.52 },
    ],
    bgStops: {
      cool: ['#020912', '#030810', '#02050c'],
      warm: ['#050610', '#060314', '#02050c'],
    },
    accent:      '#00d4b8',
    accentWarm:  '#f0c840',
    accentAlt:   '#8b5cf6',
    hudBorder:   'rgba(0,212,184,0.18)',
    hudGlow:     'rgba(0,212,184,0.06)',
  },
  aurora: {
    name: 'Aurora Borealis',
    sporeCool: ['#40ffb0', '#00ff80', '#80ffc0', '#20e090', '#60ffaa'],
    sporeWarm: ['#ff40ff', '#c040ff', '#8040ff', '#ff80ff', '#d080ff'],
    jellyCool: [
      { r: 40,  g: 255, b: 140, a: 0.50 },
      { r: 100, g: 200, b: 100, a: 0.48 },
      { r: 60,  g: 240, b: 180, a: 0.52 },
    ],
    jellyWarm: [
      { r: 200, g: 40,  b: 255, a: 0.55 },
      { r: 150, g: 80,  b: 255, a: 0.50 },
      { r: 180, g: 60,  b: 220, a: 0.52 },
    ],
    bgStops: {
      cool: ['#010a04', '#020c06', '#010503'],
      warm: ['#080108', '#0a0210', '#050108'],
    },
    accent:      '#40ffb0',
    accentWarm:  '#c040ff',
    accentAlt:   '#8040ff',
    hudBorder:   'rgba(64,255,176,0.18)',
    hudGlow:     'rgba(64,255,176,0.06)',
  },
  inferno: {
    name: 'Volcanic Vent',
    sporeCool: ['#ff6030', '#ff4020', '#ff8040', '#ffb060', '#ff5020'],
    sporeWarm: ['#ffff40', '#ffe020', '#ffc000', '#ffdd60', '#ffee80'],
    jellyCool: [
      { r: 255, g: 80,  b: 20,  a: 0.55 },
      { r: 255, g: 120, b: 40,  a: 0.50 },
      { r: 220, g: 60,  b: 10,  a: 0.52 },
    ],
    jellyWarm: [
      { r: 255, g: 220, b: 20,  a: 0.55 },
      { r: 255, g: 180, b: 0,   a: 0.50 },
      { r: 255, g: 200, b: 40,  a: 0.52 },
    ],
    bgStops: {
      cool: ['#0c0300', '#0a0200', '#080100'],
      warm: ['#100400', '#0d0300', '#080200'],
    },
    accent:      '#ff6030',
    accentWarm:  '#ffdd20',
    accentAlt:   '#ff4080',
    hudBorder:   'rgba(255,96,48,0.18)',
    hudGlow:     'rgba(255,96,48,0.06)',
  },
};

export const PHASE_NAMES = [
  'DORMANT',
  'DRIFTER EMERGENCE',
  'JELLY BLOOM',
  'BIOLUMINESCENT BLOOM',
];

export const PHASE_THRESHOLDS = [0, 5, 15, 30];

export function fmtColor(c, a) {
  return `rgba(${c.r},${c.g},${c.b},${a !== undefined ? a : c.a})`;
}

export function pickRand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
