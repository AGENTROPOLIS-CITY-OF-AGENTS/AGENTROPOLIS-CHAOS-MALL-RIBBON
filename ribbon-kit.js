/* Vendored copy of workspace/builds/ribbon-kit/ribbon-kit.js (2026-11-06). Source of truth is the kit; do not edit here. */
/* ============================================================================
   RIBBON KIT — extracted functionality, not a template recreation.
   Source material (do not ship): Vante scroll hero, Marika Lindfors ribbon
   hero, VANTA scroll-scrub hero. What was taken is MECHANISMS ONLY: the
   math, the input models, the render techniques. No template copy, names,
   demo videos, or page layouts were carried over. Brand tokens are
   AGENTROPOLIS (obsidian / cyan / red); each build passes its own config.
   Rule: this file is the source of truth. A build vendors a dated copy
   into its own folder at ship time; it never edits the kit in place.
   Three.js is provided by the host page via import map ('three').
   ============================================================================ */
import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/* 1. Smoothed progress — Vante rule 1. One number drives everything. */
/*    p chases target at .09/frame; scrolling back reverses exactly.   */
/* ------------------------------------------------------------------ */
export function smoothProgress(p, target, rate = 0.09) {
  return p + (target - p) * rate;
}
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const span = (p, a, b) => clamp01((p - a) / (b - a));
export const easeOutCubic = (t) => 1 - (1 - t) ** 3;
export const easeSmooth = (t) => t * t * (3 - 2 * t);

/* ------------------------------------------------------------------ */
/* 2. Virtual scroll + inertia — Marika §8 input model.                */
/*    Wheel / touch / keys push a target; current chases it; velocity   */
/*    (D/V) is derived from the lag. No native scroll is used.         */
/* ------------------------------------------------------------------ */
export class VirtualScroll {
  constructor({ vw, vh, phone, reducedMotion }) {
    this.vw = vw; this.vh = vh; this.phone = phone;
    this.reducedMotion = reducedMotion;
    this.target = 0; this.current = 0;
    this.pending = 0;
    this.lastWheel = 0; this.lastBurst = 0;
    this.touchY = 0; this.lastTouchD = 0;
    this._onWheel = (e) => this.wheel(e);
    this._onTouchStart = (e) => { this.touchY = e.touches[0].clientY; };
    this._onTouchMove = (e) => {
      const y = e.touches[0].clientY;
      const d = (this.touchY - y) * 3.25;
      this.push(d); this.lastTouchD = d; this.touchY = y;
    };
    this._onTouchEnd = () => this.push(this.lastTouchD * 35);
    this._onKey = (e) => this.key(e);
  }
  attach() {
    addEventListener('wheel', this._onWheel, { passive: true });
    addEventListener('touchstart', this._onTouchStart, { passive: true });
    addEventListener('touchmove', this._onTouchMove, { passive: true });
    addEventListener('touchend', this._onTouchEnd, { passive: true });
    addEventListener('keydown', this._onKey);
  }
  detach() {
    removeEventListener('wheel', this._onWheel);
    removeEventListener('touchstart', this._onTouchStart);
    removeEventListener('touchmove', this._onTouchMove);
    removeEventListener('touchend', this._onTouchEnd);
    removeEventListener('keydown', this._onKey);
  }
  setViewport(vw, vh, phone) { this.vw = vw; this.vh = vh; this.phone = phone; }
  resetTo(value) { this.target = value; this.current = value; this.pending = 0; }
  push(d) {
    this.target += d;
    if (!this.phone) {
      this.target = this.current + Math.tanh((this.target - this.current) / this.vw) * this.vw;
    }
  }
  wheel(e) {
    if (e.ctrlKey) return;
    let d = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (e.deltaMode === 1) d *= 16;
    else if (e.deltaMode === 2) d *= this.vh;
    const now = performance.now();
    const burst = now - this.lastWheel < 30;
    if (Math.abs(d) >= 40 && now - this.lastWheel >= 30 && now - this.lastBurst > 500) {
      this.pending += d * 1.25 * 2;
      this.lastBurst = now;
    } else {
      this.push(d * 1.25);
    }
    if (burst) this.lastBurst = now;
    this.lastWheel = now;
  }
  key(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    let d = 0;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') d = 100;
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') d = -100;
    else if (e.key === 'PageDown') d = 0.9 * this.vh;
    else if (e.key === 'PageUp') d = -0.9 * this.vh;
    else if (e.key === ' ') d = (e.shiftKey ? -1 : 1) * 0.9 * this.vh;
    else return;
    e.preventDefault();
    this.push(d);
  }
  /* Per-frame update. Returns { D, V, r } — the bend depth and velocity. */
  update(dt, W, H) {
    if (Math.abs(this.pending) > 0.05) {
      const f = 1 - Math.pow(1 - 0.22, Math.min(dt * 60, 4));
      const d = this.pending * f;
      this.pending -= d;
      this.push(d);
    } else if (this.pending !== 0) { this.push(this.pending); this.pending = 0; }
    const ratio = Math.min(dt * 60, 2);
    if (this.reducedMotion) this.current = this.target;
    else this.current += (this.target - this.current) * 0.1 * ratio;
    this.current = Math.round(this.current * 100) / 100;
    const N = this.phone ? 245 : 550;
    const t = Math.tanh((this.target - this.current) / N);
    const vel = t * Math.abs(t);
    const r = this.reducedMotion ? 0 : Math.min(1, Math.abs(vel));
    const D = this.phone ? H * 0.18 * 1.1 * r : W * 0.2 * (1 + 1.1 * r);
    const V = this.phone ? 0 : r;
    return { D, V, r };
  }
}

/* ------------------------------------------------------------------ */
/* 3. Ribbon bend math — Marika §6 shape functions (pure, testable).   */
/* ------------------------------------------------------------------ */
export const RIBBON = {
  PI: Math.PI, BANK: -0.16, REAR_Y: 0.1, REAR_Z: 0.2,
  VTWIST: 1.8, TAIL: 1.0, SHIFT: -0.2,
  q(wx, W, T) { return wx / W * T + this.SHIFT; },
  shapeMixed(q, C) {
    const bowl = 1 - q * q, ess = Math.sin(Math.PI * q);
    return (bowl + (ess - bowl) * C) * Math.exp(-this.TAIL * q * q);
  },
  shapeSlope(q, C) {
    const bowl = -2 * q * (1 + this.TAIL * (1 - q * q));
    const ess = Math.PI * Math.cos(Math.PI * q) - 2 * this.TAIL * q * Math.sin(Math.PI * q);
    return (bowl + (ess - bowl) * C) * Math.exp(-q * q);
  },
  z(wx, W, T, C, D) { return -D * this.shapeMixed(this.q(wx, W, T), C); },
  roll(wx, W, T, C) { return this.BANK * this.shapeSlope(this.q(wx, W, T), C) / Math.PI * C; },
  ramp(s) { s = Math.min(1, Math.max(-1, s)); return s * (1.5 - 0.5 * s * s); },
  leanSlope(s) { return 1.5 * (1 - Math.pow(Math.min(Math.abs(s), 1), 2)); },
};

/* ------------------------------------------------------------------ */
/* 4. Vante rail — fixed CatmullRom rail + strip deformation + grid    */
/*    landing. The path never moves; the ribbon only slides along it.   */
/* ------------------------------------------------------------------ */
export function buildVanteRail() {
  const PH0 = -1.5, PH1 = Math.PI * 2 + 1.35;
  const pts = [];
  for (let i = 0; i <= 160; i++) {
    const t = i / 160, ph = PH0 + (PH1 - PH0) * t, cs = Math.cos(ph), u = 2 * t - 1;
    const depth = cs > 0 ? 7.6 + 16.4 * Math.pow(cs, 0.9) : 7.6 + 2.2 * cs;
    const edge = 0.84 + 0.5 * span(0.14 - t, 0, 0.14) + 0.8 * span(t, 0.84, 1);
    pts.push(new THREE.Vector3(
      edge * Math.sin(ph) * depth * 0.561,
      0.5 * Math.sign(u) * Math.pow(Math.abs(u), 1.4) * depth * 0.63,
      -depth));
  }
  const path = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  path.arcLengthDivisions = 1500;
  const L = path.getLength();
  const SAMPLES = 1200, P = [], T = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const u = i / SAMPLES;
    P.push(path.getPointAt(u)); T.push(path.getTangentAt(u));
  }
  const at = (s, op, ot) => {
    const f = clamp01(s / L) * SAMPLES, i = Math.min(SAMPLES - 1, Math.floor(f)), k = f - i;
    op.lerpVectors(P[i], P[i + 1], k);
    ot.lerpVectors(T[i], T[i + 1], k).normalize();
  };
  return { path, length: L, at };
}

/* ------------------------------------------------------------------ */
/* 5. Card surface — Marika §5/§6. Cover crop, poster -> video swap,   */
/*    overlay painter, ribbon ShaderMaterial.                          */
/* ------------------------------------------------------------------ */
export function cropFor(mediaW, mediaH, aspect) {
  const ma = mediaW / mediaH;
  let sx, sy;
  if (aspect > ma) { sy = ma / aspect; sx = 1; } else { sx = aspect / ma; sy = 1; }
  return new THREE.Vector4((1 - sx) / 2, (1 - sy) / 2, sx, sy);
}

export function paintOverlay(card, { U, phone, renderer }) {
  const s = 2 * Math.min(devicePixelRatio, 2) / 1.5;
  const w = Math.max(2, Math.round(card.pxW * s));
  const h = Math.max(2, Math.round(card.pxH * s));
  if (!card.overlayCanvas) {
    card.overlayCanvas = document.createElement('canvas');
    card.overlayTex = new THREE.CanvasTexture(card.overlayCanvas);
    card.overlayTex.colorSpace = THREE.SRGBColorSpace;
    card.overlayTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    card.overlayTex.minFilter = THREE.LinearMipmapLinearFilter;
    card.overlayTex.magFilter = THREE.LinearFilter;
    card.mat.uniforms.u_overlay.value = card.overlayTex;
  }
  if (card.overlayCanvas.width !== w || card.overlayCanvas.height !== h) {
    card.overlayCanvas.width = w; card.overlayCanvas.height = h;
    card.overlayTex.dispose();
    card.overlayTex = new THREE.CanvasTexture(card.overlayCanvas);
    card.overlayTex.colorSpace = THREE.SRGBColorSpace;
    card.overlayTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    card.overlayTex.minFilter = THREE.LinearMipmapLinearFilter;
    card.overlayTex.magFilter = THREE.LinearFilter;
    card.mat.uniforms.u_overlay.value = card.overlayTex;
  }
  const ctx = card.overlayCanvas.getContext('2d');
  const u = U;
  const fontPx = (phone ? 16 : 18) * u * s;
  ctx.clearRect(0, 0, w, h);
  ctx.font = `400 ${fontPx}px "Inter Tight", sans-serif`;
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,.5)';
  ctx.shadowBlur = 12 * u * s;
  ctx.fillStyle = '#fff';
  try { ctx.letterSpacing = `${-0.05 * fontPx}px`; } catch (e) {}
  ctx.fillText(card.title, (phone ? 10 : 20) * u * s, h - 10 * u * s - 0.22 * fontPx);
  ctx.shadowBlur = 0;
  const r = 12.5 * u * s;
  const cx = w - (phone ? 10 : 20) * u * s - r;
  const cy = h - 10 * u * s - r;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = '#000'; ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4 * u * s;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const a = 4.5 * u * s;
  ctx.beginPath();
  if (phone) {
    ctx.moveTo(cx - a, cy); ctx.lineTo(cx + a, cy);
    ctx.moveTo(cx + 0.2 * a, cy - 0.8 * a); ctx.lineTo(cx + a, cy); ctx.lineTo(cx + 0.2 * a, cy + 0.8 * a);
  } else {
    ctx.moveTo(cx - a, cy); ctx.lineTo(cx + a, cy);
    ctx.moveTo(cx, cy - a); ctx.lineTo(cx, cy + a);
  }
  ctx.stroke();
  card.overlayTex.needsUpdate = true;
}

export function setupCardMedia(card, { renderer, reducedMotion }) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const tex = new THREE.Texture(img);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    tex.needsUpdate = true;
    card.posterTex = tex;
    if (!card.videoTex) {
      card.mat.uniforms.u_map.value = tex;
      card.mat.uniforms.u_crop.value = cropFor(img.naturalWidth, img.naturalHeight, card.aspect);
    }
    card.posterReady = true;
  };
  img.src = card.poster;
  if (reducedMotion) return;
  const v = document.createElement('video');
  v.crossOrigin = 'anonymous';
  v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true;
  v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
  v.preload = 'auto'; v.src = card.video;
  card.videoEl = v;
  const swap = () => {
    if (card.videoTex || !v.videoWidth) return;
    const tex = new THREE.VideoTexture(v);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    card.videoTex = tex;
    card.mat.uniforms.u_map.value = tex;
    card.mat.uniforms.u_crop.value = cropFor(v.videoWidth, v.videoHeight, card.aspect);
  };
  if ('requestVideoFrameCallback' in v) v.requestVideoFrameCallback(() => swap());
  else v.addEventListener('playing', swap, { once: true });
}

const CARD_VS = /* glsl */`
uniform float u_sheetW, u_sheetD, u_sheetT, u_sheetC, u_sheetP, u_sheetV;
uniform float u_leanA, u_leanW, u_diag, u_axis, u_dent, u_hover;
uniform vec2 u_res;
varying vec2 vUv;
varying vec3 vWorld;
varying float vAxis, vBend, vDome, vRoll;
const float PI = 3.141592653589793;
const float BANK = -0.16, REAR_Y = 0.1, REAR_Z = 0.2, VTWIST = 1.8, TAIL = 1.0, SHIFT = -0.2;
float shapeQ(float wx, float W, float T) { return wx / W * T + SHIFT; }
float shapeFn(float q, float C) { return mix(1.0 - q * q, sin(PI * q), C) * exp(-TAIL * q * q); }
float shapeSlope(float q, float C) {
  float bowl = -2.0 * q * (1.0 + TAIL * (1.0 - q * q));
  float ess = PI * cos(PI * q) - 2.0 * TAIL * q * sin(PI * q);
  return mix(bowl, ess, C) * exp(-q * q);
}
float ramp(float s) { s = clamp(s, -1.0, 1.0); return s * (1.5 - 0.5 * s * s); }
void main() {
  vUv = uv;
  vec2 q2 = 2.0 * uv - 1.0;
  float dome = (1.0 - q2.x * q2.x) * (1.0 - q2.y * q2.y);
  vDome = dome;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  wp.z -= u_hover * u_dent * u_res.y * dome;
  wp.xy = mix(wp.xy, wp.yx, u_axis);
  float ax = wp.x;
  vAxis = ax;
  float q = shapeQ(ax, u_sheetW, u_sheetT);
  float sl = shapeSlope(q, u_sheetC);
  float a = BANK * sl / PI * u_sheetC;
  if (u_sheetV > 0.0) {
    a += VTWIST * u_sheetV * smoothstep(0.3, 0.9, abs(ax / u_sheetW)) * sign(ax / u_sheetW);
  }
  vRoll = a;
  float ca = cos(a), sa = sin(a);
  float y0 = wp.y, z0 = wp.z;
  wp.y = y0 * ca - z0 * sa;
  wp.z = y0 * sa + z0 * ca;
  float bend = -u_sheetD * shapeFn(q, u_sheetC);
  vBend = bend;
  wp.z += bend;
  wp.y += u_diag * ax;
  if (u_sheetV > 0.0) {
    float m = 1.0 - smoothstep(-1.0, 0.3, ax / u_sheetW);
    wp.y += REAR_Y * u_sheetW * u_sheetV * m;
    wp.z += REAR_Z * u_sheetW * u_sheetV * m;
  }
  wp.z += u_leanA * ramp(ax / u_leanW);
  wp.xy = mix(wp.xy, wp.yx, u_axis);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const CARD_FS = /* glsl */`
precision highp float;
uniform sampler2D u_map, u_overlay;
uniform vec4 u_crop;
uniform float u_sheetD, u_sheetW, u_sheetT, u_sheetC, u_shade, u_shadeS;
uniform float u_leanA, u_dent;
uniform float u_corner, u_hover, u_alpha, u_aspect;
uniform vec2 u_res;
varying vec2 vUv;
varying vec3 vWorld;
varying float vAxis, vBend, vDome, vRoll;
const float PI = 3.141592653589793;
void main() {
  vec2 muv = u_crop.xy + vUv * u_crop.zw;
  vec3 rgb = texture2D(u_map, muv).rgb;
  vec4 ov = texture2D(u_overlay, vUv);
  rgb = mix(rgb, ov.rgb, ov.a);
  float depth = clamp((u_sheetD - vBend) / (2.0 * u_sheetD), 0.0, 1.0);
  depth = clamp(depth + u_hover * vDome * 0.5, 0.0, 1.0);
  rgb = mix(rgb, vec3(0.059), u_shade * 0.8 * pow(depth, u_shadeS));
  float q = vAxis / u_sheetW * u_sheetT - 0.2;
  float bowl = -2.0 * q * (1.0 + 1.0 * (1.0 - q * q));
  float ess = PI * cos(PI * q) - 2.0 * q * sin(PI * q);
  float sl = mix(bowl, ess, u_sheetC) * exp(-q * q);
  float dzdx = -u_sheetD * sl * u_sheetT / u_sheetW;
  float s = clamp(vAxis / u_sheetW, -1.0, 1.0);
  dzdx += (u_leanA / u_sheetW) * 1.5 * (1.0 - pow(min(abs(s), 1.0), 2.0));
  vec2 q2 = 2.0 * vUv - 1.0;
  float dDdx = -4.0 * q2.x * (1.0 - q2.y * q2.y) / u_res.x;
  float dDdy = -4.0 * q2.y * (1.0 - q2.x * q2.x) / u_res.y;
  dzdx += -u_hover * u_dent * u_res.y * dDdx;
  float dzdy = -u_hover * u_dent * u_res.y * dDdy;
  vec3 n = normalize(vec3(-dzdx, -dzdy, 1.0));
  float ca = cos(vRoll), sa = sin(vRoll);
  n = vec3(n.x, n.y * ca - n.z * sa, n.y * sa + n.z * ca);
  vec3 L = normalize(vec3(-0.4, 0.5, 1.0));
  float ndl = dot(n, L) * 0.5 + 0.5;
  rgb *= 1.0 - 0.12 * (1.0 - ndl);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 Hv = normalize(L + V);
  float spec = pow(max(dot(n, Hv), 0.0), 48.0) * 0.35;
  rgb += vec3(spec);
  vec2 p = (vUv - 0.5) * vec2(u_aspect, 1.0);
  vec2 b = vec2(u_aspect, 1.0) * 0.5 - u_corner;
  vec2 qq = abs(p) - b;
  float d = length(max(qq, 0.0)) + min(max(qq.x, qq.y), 0.0) - u_corner;
  float aa = fwidth(d);
  float alpha = 1.0 - smoothstep(-aa, aa, d);
  gl_FragColor = vec4(rgb, alpha * u_alpha);
}
`;

export function makeCardMaterial(aspect) {
  return new THREE.ShaderMaterial({
    vertexShader: CARD_VS, fragmentShader: CARD_FS,
    transparent: true, depthTest: false, depthWrite: false,
    uniforms: {
      u_map: { value: null }, u_overlay: { value: null },
      u_crop: { value: new THREE.Vector4(0, 0, 1, 1) },
      u_sheetW: { value: 1 }, u_sheetD: { value: 0 }, u_sheetT: { value: 1.15 },
      u_sheetC: { value: 1 }, u_sheetP: { value: 1 }, u_sheetV: { value: 0 },
      u_leanA: { value: 0 }, u_leanW: { value: 1 }, u_diag: { value: 0.03 },
      u_axis: { value: 0 }, u_dent: { value: 0.035 },
      u_shade: { value: 1 }, u_shadeS: { value: 1 },
      u_corner: { value: 0.05 }, u_hover: { value: 0 }, u_alpha: { value: 0 },
      u_aspect: { value: aspect }, u_res: { value: new THREE.Vector2(1, 1) },
    },
  });
}

/* ------------------------------------------------------------------ */
/* 6. Floor grid + reflection — Marika §7 (desktop only).              */
/* ------------------------------------------------------------------ */
const FLOOR_VS = /* glsl */`
uniform float u_leanA, u_leanW;
uniform float u_o;
varying vec2 vUv;
varying float vFar;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  float s = clamp(wp.x / u_leanW, -1.0, 1.0);
  wp.z += u_leanA * (s * (1.5 - 0.5 * s * s));
  vFar = -wp.z / u_o;
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const FLOOR_FS = /* glsl */`
precision highp float;
uniform sampler2D u_refl;
uniform mat4 u_mirrorVP;
uniform vec2 u_cells;
uniform float u_alpha, u_o, u_sheetW;
varying vec2 vUv;
varying float vFar;
varying vec3 vWorld;
void main() {
  float fade = 1.0 - smoothstep(0.2, 0.95, vFar);
  vec3 col = vec3(0.0);
  col *= 1.0 - 0.55 * exp(-14.0 * abs(vFar));
  vec2 g = vec2(vUv.x * u_cells.x, vFar * u_cells.y);
  vec2 fw = fwidth(g);
  float lx = 1.0 - smoothstep(0.0, 1.5 * fw.x, abs(fract(g.x) - 0.5));
  float ly = 1.0 - smoothstep(0.0, 1.5 * fw.y, abs(fract(g.y) - 0.5));
  float line = max(lx, ly);
  col += line * 0.08 * fade;
  vec4 mp = u_mirrorVP * vec4(vWorld, 1.0);
  vec2 muv = mp.xy / mp.w * 0.5 + 0.5;
  float edge = smoothstep(0.0, 0.1, muv.x) * smoothstep(1.0, 0.9, muv.x)
             * smoothstep(0.0, 0.1, muv.y) * smoothstep(1.0, 0.9, muv.y);
  float weight = vFar >= 0.0 ? exp(-6.0 * vFar) : exp(2.2 * vFar);
  vec3 refl = texture2D(u_refl, muv).rgb;
  col += refl * line * 0.5 * weight * edge * fade;
  gl_FragColor = vec4(col, u_alpha * fade);
}
`;

export function makeFloor(renderer) {
  const geo = new THREE.PlaneGeometry(1, 1, 48, 24);
  geo.rotateX(-Math.PI / 2);
  const reflTarget = new THREE.WebGLRenderTarget(2, 2);
  const mat = new THREE.ShaderMaterial({
    vertexShader: FLOOR_VS, fragmentShader: FLOOR_FS,
    transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
    uniforms: {
      u_refl: { value: reflTarget.texture },
      u_mirrorVP: { value: new THREE.Matrix4() },
      u_cells: { value: new THREE.Vector2(1, 1) },
      u_alpha: { value: 0 }, u_o: { value: 1 }, u_sheetW: { value: 1 },
      u_leanA: { value: 0 }, u_leanW: { value: 1 },
    },
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  const mirrorCam = new THREE.PerspectiveCamera(53.4, 1, 0.1, 2000);
  return { mesh, mat, reflTarget, mirrorCam };
}

/* ------------------------------------------------------------------ */
/* 7. Scroll-scrubbed video — VANTA engine. Lerp + gated seeks; the    */
/*    title wipe and the horizontal re-centering ride on video time.    */
/* ------------------------------------------------------------------ */
export class ScrubVideo {
  constructor(video, { K = 0.1, deadband = 0.02, minSeekMs = 30, maskStart = 0.3, shiftPx = 225, centerBy = 0.6 } = {}) {
    this.video = video;
    this.K = K; this.deadband = deadband; this.minSeekMs = minSeekMs;
    this.maskStart = maskStart; this.shiftPx = shiftPx; this.centerBy = centerBy;
    this.targetTime = 0; this.curTime = 0;
    this.seeking = false; this.lastSeek = 0;
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.mqMobile = matchMedia('(max-width: 900px)');
    video.addEventListener('loadedmetadata', () => {
      video.pause();
      try { video.currentTime = 0.001; } catch (e) {}
      this.curTime = 0.001;
      this.readScroll();
    });
    video.addEventListener('seeked', () => { this.seeking = false; });
    addEventListener('scroll', () => this.readScroll(), { passive: true });
    addEventListener('resize', () => this.readScroll());
    this.readScroll();
  }
  readScroll() {
    const max = document.documentElement.scrollHeight - innerHeight;
    const progress = max > 0 ? clamp01(scrollY / max) : 0;
    this.targetTime = this.video.duration ? progress * this.video.duration : 0;
  }
  /* Call every rAF. Returns { wipe, shiftPx } for the host to apply. */
  tick() {
    if (this.reducedMotion) return { wipe: 0, shiftPx: 0 };
    this.curTime += (this.targetTime - this.curTime) * this.K;
    const now = performance.now();
    if (!this.seeking && Math.abs(this.curTime - this.video.currentTime) > this.deadband && now - this.lastSeek > this.minSeekMs) {
      this.seeking = true;
      this.lastSeek = now;
      try { this.video.currentTime = this.curTime; } catch (e) { this.seeking = false; }
    }
    if (this.mqMobile.matches || !this.video.duration) return { wipe: 0, shiftPx: 0 };
    const p = this.curTime / this.video.duration;
    return {
      wipe: clamp01((p - this.maskStart) / (1 - this.maskStart)),
      shiftPx: -this.shiftPx * (1 - clamp01(p / this.centerBy)),
    };
  }
}
export function applyTitleWipe(el, wipe) {
  const g = `linear-gradient(to right, transparent calc(${wipe} * 85% - 60%), #000 calc(${wipe} * 85%))`;
  el.style.maskImage = g;
  el.style.webkitMaskImage = g;
  el.style.maskRepeat = 'no-repeat';
  el.style.webkitMaskRepeat = 'no-repeat';
}

/* ------------------------------------------------------------------ */
/* 8. Hover dent + CPU outline picking — Marika §9.                    */
/* ------------------------------------------------------------------ */
export function cardScreenBox(card, camera, vw, vh) {
  const cols = 5, pts = [];
  const v = new THREE.Vector3();
  for (let ix = 0; ix < cols; ix++) {
    for (const iy of [0, 1]) {
      const lx = (ix / (cols - 1) - 0.5) * card.worldW;
      const ly = (iy === 0 ? 0.5 : -0.5) * card.worldH;
      v.set(card.mesh.position.x + lx, card.mesh.position.y + ly, card.mesh.position.z);
      v.applyMatrix4(camera.matrixWorldInverse);
      v.applyMatrix4(camera.projectionMatrix);
      pts.push({ x: (v.x + 1) / 2 * vw, y: (1 - v.y) / 2 * vh });
    }
  }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  return { minX, maxX, minY, maxY };
}
export function pickHover(cards, camera, vw, vh, pointer, phone, reducedMotion) {
  if (phone || reducedMotion) return null;
  const px = (pointer.x + 1) / 2 * vw, py = (1 - pointer.y) / 2 * vh;
  for (const c of cards) {
    if (!c.mesh.visible) continue;
    const b = cardScreenBox(c, camera, vw, vh);
    if (px >= b.minX && px <= b.maxX && py >= b.minY && py <= b.maxY) return c;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* 9. Ribbon app — the Marika-style ribbon assembled from the kit.     */
/*    A build passes its own cards + chrome and gets the full engine:  */
/*    virtual scroll, S-curve ribbon, floor + reflection, hover,       */
/*    poster->video media, entrance fades, reduced-motion handling.    */
/*    The build's page stays a thin shell: config + one call.          */
/* ------------------------------------------------------------------ */
export function createRibbonApp(config) {
  const {
    canvas, cards: defs, startDesktop = 100, startPhoneFrac = -0.177,
    onReady,
  } = config;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isPhone = () => innerWidth <= 649;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setClearColor(0x000000, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(53.4, 1, 0.1, 2000);
  camera.position.set(0, 0, 41.18);

  let vw = innerWidth, vh = innerHeight, U = vw / 1500;
  let H = Math.tan(53.4 * Math.PI / 360) * 41.18;
  let W = H * (vw / vh);
  let k = 2 * H / vh;
  let phone = isPhone();

  function applyViewport() {
    vw = innerWidth; vh = innerHeight; phone = isPhone();
    U = phone ? vw / 390 : vw / 1500;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(vw, vh, false);
    camera.aspect = vw / vh;
    camera.updateProjectionMatrix();
    H = Math.tan(53.4 * Math.PI / 360) * 41.18;
    W = H * camera.aspect;
    k = 2 * H / vh;
  }
  applyViewport();

  // cards
  const cards = [];
  const geo = new THREE.PlaneGeometry(1, 1, 96, 24);
  for (const def of defs) {
    const mat = makeCardMaterial(def.aspect);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 0;
    scene.add(mesh);
    const card = {
      ...def, mat, mesh, hover: 0, loaded: false,
      pxW: 100, pxH: 100, worldW: 1, worldH: 1,
      videoEl: null, videoTex: null, posterTex: null,
      overlayCanvas: null, overlayTex: null, alphaStart: -1,
    };
    setupCardMedia(card, { renderer, reducedMotion });
    cards.push(card);
  }

  // floor
  const floor = makeFloor(renderer);
  scene.add(floor.mesh);
  const mirrorCam = floor.mirrorCam;
  let floorA = 0, floorO = 1, floorNear = 1, floorAlphaStart = -1;

  // scroll
  const scroll = new VirtualScroll({ vw, vh, phone, reducedMotion });
  scroll.attach();

  // layout
  let L = 1, left = 0, top = 0, cardH = 100, gapU = 10;
  function layout() {
    applyViewport();
    scroll.setViewport(vw, vh, phone);
    const gap = (phone ? 20 : 10) * U;
    gapU = gap;
    if (phone) {
      const w = vw - 40 * U;
      L = 0;
      for (const c of cards) {
        c.pxW = w; c.pxH = w / c.aspect;
        c.worldW = c.pxW * k; c.worldH = c.pxH * k;
        L += c.pxH + gap;
      }
      top = -(L - vh) / 2;
    } else {
      cardH = Math.min(0.435 * vh, 550 * U);
      L = 0;
      for (const c of cards) {
        c.pxH = cardH; c.pxW = cardH * c.aspect;
        c.worldW = c.pxW * k; c.worldH = c.pxH * k;
        L += c.pxW + gap;
      }
      left = -(L - vw) / 2;
    }
    floorA = -cardH * k / 2 - 0.06 * H;
    floorO = 6 * H;
    floorNear = Math.min(41.18 * (1 - Math.abs(floorA) / H) + 0.2 * H, 41.18 * 0.8);
    const cell = 0.22 * H;
    floor.mesh.scale.set(W * 2 * 4, 1, floorNear + floorO);
    floor.mesh.position.set(0, floorA, (floorNear - floorO) / 2);
    floor.mat.uniforms.u_o.value = floorO;
    floor.mat.uniforms.u_cells.value.set((W * 2 * 4) / cell, floorO / cell);
    floor.mat.uniforms.u_sheetW.value = W;
    floor.reflTarget.setSize(Math.max(2, Math.floor(vw / 2)), Math.max(2, Math.floor(vh / 2)));
    for (const c of cards) paintOverlay(c, { U, phone, renderer });
    for (const c of cards) {
      c.mat.uniforms.u_axis.value = phone ? 1 : 0;
      c.mat.uniforms.u_sheetT.value = phone ? 1 : 1.15;
      c.mat.uniforms.u_sheetC.value = phone ? 0 : 1;
      c.mat.uniforms.u_leanA.value = phone ? 0 : W * -0.12;
      c.mat.uniforms.u_leanW.value = W;
      c.mat.uniforms.u_diag.value = phone ? 0 : 0.03;
      c.mat.uniforms.u_shade.value = phone ? 0 : 1;
      c.mat.uniforms.u_shadeS.value = phone ? 0.6 : 1;
      c.mat.uniforms.u_corner.value = ((phone ? 15 : 20) * U) / c.pxH;
      c.mat.uniforms.u_res.value.set(c.worldW, c.worldH);
    }
    floor.mat.uniforms.u_leanA.value = -0.12 * W;
    floor.mat.uniforms.u_leanW.value = W;
    floor.mesh.visible = !phone;
  }
  function resetToStart() {
    if (phone) scroll.resetTo(startPhoneFrac * vh);
    else scroll.resetTo(startDesktop);
  }
  layout();
  resetToStart();
  let resizeTimer = 0;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const wasPhone = phone;
      layout();
      if (wasPhone !== phone) resetToStart();
    }, 100);
  });

  // hover
  const pointer = new THREE.Vector2(10, 10);
  addEventListener('pointermove', (e) => {
    pointer.x = (e.clientX / vw) * 2 - 1;
    pointer.y = -(e.clientY / vh) * 2 + 1;
  });
  document.addEventListener('mouseleave', () => { pointer.set(10, 10); });

  function placeCards(D, V) {
    let acc = 0;
    for (const c of cards) {
      const size = phone ? c.pxH : c.pxW;
      const base = acc;
      acc += size + gapU;
      let pos;
      if (phone) {
        pos = base - scroll.current;
        pos = ((pos - top) % L + L) % L + top;
        c.mesh.position.set(0, -(pos + c.pxH / 2 - vh / 2) * k, 0);
      } else {
        pos = base - scroll.current;
        pos = ((pos - left) % L + L) % L + left;
        c.mesh.position.set((pos + c.pxW / 2 - vw / 2) * k, 0, 0);
      }
      c.mesh.scale.set(c.worldW, c.worldH, 1);
      c.mesh.visible = true;
      const u = c.mat.uniforms;
      u.u_sheetW.value = phone ? H : W;
      u.u_sheetD.value = D;
      u.u_sheetV.value = phone ? 0 : V;
      u.u_sheetP.value = 1;
      u.u_hover.value = c.hover;
    }
  }

  function managePlayback() {
    if (document.hidden) {
      for (const c of cards) if (c.videoEl && !c.videoEl.paused) c.videoEl.pause();
      return;
    }
    for (const c of cards) {
      if (!c.videoEl) continue;
      let on = false;
      if (phone) {
        const y = c.mesh.position.y / k + vh / 2 - c.pxH / 2;
        on = y + c.pxH > -0.5 * vh && y < 1.5 * vh;
      } else {
        const x = c.mesh.position.x / k + vw / 2 - c.pxW / 2;
        on = x + c.pxW > -0.5 * vw && x < 1.5 * vw;
      }
      if (on && c.videoEl.paused) c.videoEl.play().catch(() => {});
      else if (!on && !c.videoEl.paused) c.videoEl.pause();
    }
  }

  let lastT = performance.now();
  const _mp = new THREE.Matrix4();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(now - lastT, 50) / 1000;
    lastT = now;
    const { D, V } = scroll.update(dt, W, H);
    placeCards(D, V);
    const hov = pickHover(cards, camera, vw, vh, pointer, phone, reducedMotion);
    for (const c of cards) {
      const tgt = (c === hov) ? 1 : 0;
      const rate = tgt === 1 ? 1 - Math.exp(-8 * dt) : 1 - Math.exp(-6 * dt);
      c.hover += (tgt - c.hover) * rate;
    }
    document.body.style.cursor = hov ? 'pointer' : '';
    for (const c of cards) {
      if (c.alphaStart >= 0 && c.mat.uniforms.u_alpha.value < 1) {
        c.mat.uniforms.u_alpha.value = Math.min(1, (now - c.alphaStart) / 600);
      }
    }
    if (floorAlphaStart >= 0 && floor.mat.uniforms.u_alpha.value < 0.9) {
      floor.mat.uniforms.u_alpha.value = Math.min(0.9, (now - floorAlphaStart) / 800);
    }
    managePlayback();
    if (!phone) {
      const m = floorA - 0.07 * H;
      mirrorCam.position.set(0, 2 * m - camera.position.y, camera.position.z);
      mirrorCam.up.set(0, -1, 0);
      mirrorCam.lookAt(0, 2 * m - camera.position.y, 0);
      mirrorCam.aspect = camera.aspect;
      mirrorCam.updateProjectionMatrix();
      mirrorCam.updateMatrixWorld();
      _mp.multiplyMatrices(mirrorCam.projectionMatrix, mirrorCam.matrixWorldInverse);
      floor.mat.uniforms.u_mirrorVP.value.copy(_mp);
      floor.mesh.visible = false;
      renderer.setRenderTarget(floor.reflTarget);
      renderer.render(scene, mirrorCam);
      renderer.setRenderTarget(null);
      floor.mesh.visible = true;
    }
    renderer.render(scene, camera);
  }

  async function boot() {
    try { await document.fonts.load('400 18px "Inter Tight"'); } catch (e) {}
    const posters = cards.map((c) => new Promise((res) => {
      const im = new Image();
      im.onload = res; im.onerror = res;
      im.src = c.poster;
    }));
    await Promise.all(posters);
    const now = performance.now();
    for (const c of cards) {
      paintOverlay(c, { U, phone, renderer });
      c.loaded = true;
      c.alphaStart = now;
    }
    floorAlphaStart = now;
    document.body.classList.add('ready');
    if (onReady) onReady();
  }
  boot();
  setTimeout(() => document.body.classList.add('ready'), 8000);
  requestAnimationFrame(frame);
  return { cards, scroll, renderer, camera };
}
