'use strict';
// Materials: world-space panel shader (lit, shadowed), hex portal walls, sky dome, canvas textures.
G.mats = {};

// Patches a MeshStandardMaterial with triplanar panel lines, per-cell tint variation and optional glowing seams.
G.panelMat = (o) => {
  const m = new THREE.MeshStandardMaterial({ color: o.color, roughness: o.rough ?? 0.6, metalness: o.metal ?? 0.15 });
  const u = {
    uScale: { value: o.scale ?? 2.0 }, uLine: { value: G.col(o.line ?? 0x222222) }, uLineMix: { value: o.lineMix ?? 0.5 },
    uGlow: { value: G.col(o.glow ?? 0x000000).multiplyScalar(o.glowI ?? 1) }, uVar: { value: o.vary ?? 0.12 },
    uRock: { value: o.rock ? 1 : 0 }, uTime: G.uTime,
  };
  m.userData.u = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN; attribute vec2 aBox; varying vec2 vBox;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal); vBox = aBox;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWP; varying vec3 vWN; varying vec2 vBox;
uniform float uScale, uLineMix, uVar, uRock, uTime; uniform vec3 uLine, uGlow;
float h21(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += vn(p) * a; p *= 2.07; a *= 0.5; } return s; }
float gLine; vec2 gUV;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec3 an = abs(vWN);
  vec2 uv = an.y > 0.5 ? vWP.xz : (an.x > an.z ? vWP.zy : vWP.xy);
  gUV = uv;
  if (uRock > 0.5) {
    float n = fbm(uv * 0.35) * 0.6 + fbm(uv * 1.7) * 0.4;
    float strata = 0.5 + 0.5 * sin(vWP.y * 2.1 + fbm(uv * 0.2) * 6.0);
    float band = smoothstep(0.35, 0.65, fbm(vec2(uv.x * 0.08, vWP.y * 0.9)));
    float pits = smoothstep(0.62, 0.75, fbm(uv * 3.1));
    diffuseColor.rgb *= mix(0.5, 1.22, n) * mix(0.78, 1.1, strata) * mix(0.85, 1.08, band) * (1.0 - pits * 0.35);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.7, 0.52) * diffuseColor.rgb / max(0.001, dot(diffuseColor.rgb, vec3(0.33))) * 0.45, step(0.6, an.y) * 0.5);
    gLine = 0.0;
  } else {
    vec2 su = uv / uScale;
    vec2 g = abs(fract(su - 0.5) - 0.5) / max(fwidth(su), vec2(0.0001));
    gLine = 1.0 - min(min(g.x, g.y), 1.0);
    vec2 cell = floor(su);
    float n = h21(cell);
    vec2 f = fract(su);
    float bevel = smoothstep(0.0, 0.05, min(min(f.x, f.y), min(1.0 - f.x, 1.0 - f.y)));
    float grime = mix(1.0, 0.86 + 0.14 * smoothstep(0.0, 0.6, f.y), step(an.y, 0.5));
    float dirt = mix(0.92, 1.04, fbm(vWP.xz * 0.15 + vWP.y * 0.1));
    diffuseColor.rgb *= (1.0 - uVar + n * uVar * 2.0) * mix(0.84, 1.0, bevel) * grime * dirt;
    diffuseColor.rgb = mix(diffuseColor.rgb, uLine, gLine * uLineMix);
  }
  if (vBox.y > vBox.x + 0.01 && abs(vWN.y) < 0.5) {
    float hb = vWP.y - vBox.x, ht = vBox.y - vWP.y;
    diffuseColor.rgb *= mix(0.42, 1.0, smoothstep(0.0, 1.4, hb)) * (1.0 + 0.16 * smoothstep(0.1, 0.0, ht));
  }}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += uGlow * gLine * (0.75 + 0.25 * sin(uTime * 1.5 + gUV.x * 0.3 + gUV.y * 0.2));`);
  };
  m.customProgramCacheKey = () => 'sdx-panel';
  return m;
};

// Portal-capable surfaces: bright hex tiles with pulsing glowing seams. Readable from across the map.
G.hexMat = (base, glow) => {
  const m = new THREE.MeshStandardMaterial({ color: base, roughness: 0.32, metalness: 0.1 });
  const u = { uGlow: { value: G.col(glow).multiplyScalar(1.1) }, uTime: G.uTime };
  m.userData.u = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN; attribute vec2 aBox; varying vec2 vBox;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal); vBox = aBox;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWP; varying vec3 vWN; varying vec2 vBox; uniform vec3 uGlow; uniform float uTime;
float hexd(vec2 p){ p = abs(p); return max(dot(p, normalize(vec2(1.0, 1.732))), p.x); }
float hEdge; float hPulse; float hId;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec3 an = abs(vWN);
  vec2 uv = (an.y > 0.5 ? vWP.xz : (an.x > an.z ? vWP.zy : vWP.xy)) * 1.25;
  vec2 r = vec2(1.0, 1.732), h = r * 0.5;
  vec2 ga = mod(uv, r) - h, gb = mod(uv - h, r) - h;
  vec2 gv = dot(ga, ga) < dot(gb, gb) ? ga : gb;
  vec2 id = uv - gv;
  float d = hexd(gv);
  float w = fwidth(d) * 1.5;
  hEdge = smoothstep(0.43 - w, 0.47, d);
  hId = fract(sin(dot(id, vec2(7.1, 3.7))) * 437.5);
  hPulse = 0.5 + 0.5 * sin(uTime * 2.0 + id.x * 0.7 + id.y * 0.5);
  diffuseColor.rgb *= (1.0 - hEdge * 0.5) * (0.92 + 0.08 * hId);
  if (vBox.y > vBox.x + 0.01 && abs(vWN.y) < 0.5) {
    float hb = vWP.y - vBox.x, ht = vBox.y - vWP.y;
    diffuseColor.rgb *= mix(0.42, 1.0, smoothstep(0.0, 1.4, hb)) * (1.0 + 0.16 * smoothstep(0.1, 0.0, ht));
  }}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += uGlow * (hEdge * (0.45 + 0.9 * hPulse) + 0.035 + 0.04 * hId);`);
  };
  m.customProgramCacheKey = () => 'sdx-hex';
  return m;
};

G.glowMat = (c, i = 2.5, opts = {}) => {
  const col = G.col(c).multiplyScalar(i);
  return new THREE.MeshBasicMaterial(Object.assign({ color: col, toneMapped: true, fog: false }, opts));
};

// Sky dome: three-stop gradient, sun disc + halo, optional stars and a faint cloud band.
G.skyMat = (t, env) => new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: {
    top: { value: G.col(t.sky[0]) }, hor: { value: G.col(t.sky[1]) }, bot: { value: G.col(t.sky[2]) },
    sunDir: { value: new THREE.Vector3(...t.sunDir).normalize() }, sunCol: { value: G.col(t.sunColor) },
    stars: { value: t.stars ? 1 : 0 }, sunSize: { value: t.sunSize ?? 1 }, clouds: { value: t.clouds ?? 0.5 }, uTime: G.uTime,
  },
  vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = ${env ? 'p' : 'p.xyww'}; }`,
  fragmentShader: `varying vec3 vD; uniform vec3 top, hor, bot, sunDir, sunCol; uniform float stars, sunSize, clouds, uTime;
  float h31(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float h21(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
  void main(){
    vec3 d = normalize(vD);
    float y = d.y;
    vec3 c = y > 0.0 ? mix(hor, top, pow(clamp(y, 0.0, 1.0), 0.55)) : mix(hor, bot, pow(clamp(-y, 0.0, 1.0), 0.4));
    float s = max(dot(d, sunDir), 0.0);
    c += sunCol * (pow(s, 6.0) * 0.35 + pow(s, 64.0) * 0.8) ;
    c += sunCol * smoothstep(0.9994 - 0.0008 * (sunSize - 1.0), 0.9997, s) * 12.0;
    if (stars > 0.5 && y > 0.0) {
      vec3 g = floor(d * 380.0);
      float st = step(0.9975, h31(g)) * (0.5 + 0.5 * sin(uTime * 2.0 + h31(g + 3.0) * 30.0));
      c += vec3(st) * smoothstep(0.0, 0.25, y) * 1.4;
    }
    if (clouds > 0.0) {
      vec2 cp = d.xz / max(abs(d.y) + 0.12, 0.05);
      float n = vn(cp * 1.4 + uTime * 0.01) * 0.6 + vn(cp * 3.7) * 0.4;
      float band = smoothstep(0.55, 0.85, n) * smoothstep(0.45, 0.04, abs(y)) * clouds;
      c = mix(c, mix(hor, sunCol, 0.25) * 1.05, band * 0.6);
    }
    gl_FragColor = vec4(c, 1.0);
  }`,
});

// Canvas texture of lit windows, used on backdrop skyscrapers.
G.windowTex = () => {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#05070c'; x.fillRect(0, 0, 64, 128);
  for (let j = 0; j < 32; j++) for (let i = 0; i < 8; i++) {
    if (Math.random() < 0.38) {
      const w = Math.random();
      x.fillStyle = w < 0.6 ? '#ffcf80' : w < 0.85 ? '#9fd8ff' : '#ffffff';
      x.globalAlpha = 0.35 + Math.random() * 0.65;
      x.fillRect(i * 8 + 2, j * 4 + 1, 4, 2);
    }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  return t;
};

// Soft radial sprite texture (particles, glows, decals).
G.radialTex = (inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', size = 64) => {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'); const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner); g.addColorStop(1, outer); x.fillStyle = g; x.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); return t;
};

G.scorchTex = () => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(10,10,12,0.95)'); g.addColorStop(0.35, 'rgba(20,20,24,0.7)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 14; i++) { x.fillStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); x.arc(32 + G.rand(-20, 20), 32 + G.rand(-20, 20), G.rand(1, 4), 0, 7); x.fill(); }
  return new THREE.CanvasTexture(c);
};

G.makeMaterials = (theme) => {
  const t = theme, M = {};
  M.floor = G.panelMat({ color: t.floor, line: t.floorLine, scale: 4, lineMix: 0.35, glow: t.accent, glowI: t.floorGlow ?? 0.18, rough: 0.5, metal: 0.25, vary: 0.08 });
  M.wall = G.panelMat({ color: t.wall, line: t.wallLine, scale: 3, lineMix: 0.6, rough: 0.65, vary: 0.1 });
  M.base = G.panelMat({ color: t.base, line: t.baseLine, scale: 1.5, lineMix: 0.5, rough: 0.5, metal: 0.25, vary: 0.1 });
  M.metal = G.panelMat({ color: t.metal, line: 0x15171c, scale: 0.75, lineMix: 0.55, rough: 0.35, metal: 0.75, vary: 0.06 });
  M.crate = G.panelMat({ color: t.crate, line: 0x2a1c0c, scale: 0.6, lineMix: 0.7, rough: 0.6, metal: 0.3, vary: 0.12 });
  M.trim = G.panelMat({ color: t.trim, line: t.accent, scale: 1, lineMix: 0.3, glow: t.accent, glowI: 1.4, rough: 0.4, metal: 0.4 });
  M.rock = G.panelMat({ color: t.rock ?? 0x9a7a5c, rock: true, rough: 0.92, metal: 0.0 });
  M.ground = G.panelMat({ color: t.ground ?? t.floor, line: t.floorLine, scale: 6, lineMix: t.groundLine ?? 0.12, rough: 0.85, metal: 0.05, vary: 0.05 });
  M.portal = G.hexMat(t.portalBase, t.portalGlow);
  M.dark = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.7, metalness: 0.4 });
  M.lamp = G.glowMat(t.lamp ?? 0xffe0a8, 3);
  M.accent = G.glowMat(t.accent, 2.4);
  return M;
};
