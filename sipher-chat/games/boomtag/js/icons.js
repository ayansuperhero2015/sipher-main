// Icons: one hand-drawn 24x24 set used everywhere (DOM as SVG, 3D crates via Path2D).
// Each icon is a list of [mode, path]: 'f' = filled, 's' = stroked (2.4px, round caps).
(() => {
'use strict';
const I = G.ICONS = {
  bomb: [['f', 'M3 14a7 7 0 1 0 14 0a7 7 0 1 0 -14 0z'], ['f', 'M8.5 5.2h3v2.6h-3z'], ['s', 'M10 5.2c0-2 1.6-3 3.6-3H15'], ['f', 'M18.5 0.6l.8 1.7 1.8.3-1.3 1.3.3 1.8-1.6-.9-1.6.9.3-1.8-1.3-1.3 1.8-.3z']],
  coin: [['f', 'M12 2.5a9.5 9.5 0 1 0 .01 0zM12 5.5a6.5 6.5 0 1 1-.01 0z'], ['f', 'M10.8 8h2.4v8h-2.4z']],
  dash: [['f', 'M12.5 4.5l7.5 7.5-7.5 7.5v-4.6H8.5V9.1h4z'], ['f', 'M1.5 9.1h5v2.2h-5zM0.5 12.7h6v2.2h-6zM2.5 16.3h4v2.2h-4z']],
  superjump: [['f', 'M12 2.5l8 8h-5.2L12 7.7l-2.8 2.8H4z'], ['f', 'M12 11l8 8h-5.2L12 16.2l-2.8 2.8H4z']],
  blink: [['f', 'M1 11h2.4v2.4H1zM5.2 11h2.4v2.4H5.2zM9.4 11h2.4v2.4H9.4z'], ['f', 'M18.5 6l1.5 4.5 4 1.5-4 1.5-1.5 4.5-1.5-4.5-4-1.5 4-1.5z']],
  freeze: [['s', 'M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M9 3.8l3 2.4 3-2.4M9 20.2l3-2.4 3 2.4']],
  shockwave: [['f', 'M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0z'], ['s', 'M6.6 6.6a7.6 7.6 0 0 0 0 10.8M17.4 6.6a7.6 7.6 0 0 1 0 10.8M3.2 3.2a12.4 12.4 0 0 0 0 17.6M20.8 3.2a12.4 12.4 0 0 1 0 17.6']],
  invis: [['s', 'M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12zM4 20L20 4'], ['f', 'M9.6 12a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0-4.8 0z']],
  decoy: [['f', 'M8 3.5a3.2 3.2 0 1 1 0 6.4a3.2 3.2 0 1 1 0-6.4zM1.5 21c0-4.4 2.9-7.6 6.5-7.6s6.5 3.2 6.5 7.6z'], ['s', 'M17 5a2.6 2.6 0 1 1 0 5.2A2.6 2.6 0 1 1 17 5zM17.5 13.4c2.6.5 4.3 3.2 4.3 7']],
  toss: [['s', 'M5.5 16.5C8 9 14 6 19.5 8.6'], ['f', 'M22.6 5.4l.6 7.2-6.8-2.6z'], ['f', 'M0.8 19a3.2 3.2 0 1 0 6.4 0a3.2 3.2 0 1 0-6.4 0z']],
  speed: [['f', 'M13.5 1.5L4 14h6.2L9 22.5 19 9.8h-6.3z']],
  shield: [['f', 'M12 1.8l8.5 3.2v6.3c0 5.2-3.6 9.6-8.5 11.2-4.9-1.6-8.5-6-8.5-11.2V5z']],
  jump: [['s', 'M6.5 21h11M6.5 17.5l11-2.2M6.5 13.5l11-2.2'], ['f', 'M12 0.8l5.4 5.4h-3.6v3.2h-3.6V6.2H6.6z']],
  recharge: [['f', 'M2 6.5h16v11H2zM4.3 8.8v6.4h11.4V8.8z', 'evenodd'], ['f', 'M19 10h2.6v4H19z'], ['f', 'M10.8 9.2l-3.3 3.4h2.6l-1 2.4 3.6-3.6h-2.6z']],
  close: [['s', 'M5 5l14 14M19 5L5 19']]
};
G.svgIcon = (name, cls = '') => {
  const def = I[name] || [];
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${def.map(([m, d, rule]) => m === 'f'
    ? `<path d="${d}" fill="currentColor"${rule ? ` fill-rule="${rule}"` : ''}/>`
    : `<path d="${d}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}</svg>`;
};
// Draw an icon onto a 2D canvas context (used for 3D crate faces).
G.drawIcon = (k, name, x, y, size, color) => {
  k.save(); k.translate(x, y); k.scale(size / 24, size / 24);
  k.fillStyle = color; k.strokeStyle = color; k.lineWidth = 2.4; k.lineCap = 'round'; k.lineJoin = 'round';
  for (const [m, d, rule] of I[name] || []) { const p = new Path2D(d); if (m === 'f') k.fill(p, rule || 'nonzero'); else k.stroke(p); }
  k.restore();
};
const texCache = {};
G.iconTex = (name, bg) => {
  const key = name + bg; if (texCache[key]) return texCache[key];
  const c = document.createElement('canvas'); c.width = c.height = 128; const k = c.getContext('2d');
  k.fillStyle = '#121212'; k.fillRect(0, 0, 128, 128);
  k.fillStyle = bg; k.fillRect(8, 8, 112, 112);
  G.drawIcon(k, name, 24, 24, 80, '#121212');
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return (texCache[key] = t);
};
})();
