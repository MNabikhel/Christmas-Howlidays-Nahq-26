/* ================================================================
   Scene extras: environments (EXTRAS-ENV).
   Appended after tree.js in the same module by build/build_tree.py, so it uses the
   documented Extras API (registerRoom / registerExtra / core) and tree.js helpers.
   Everything here is for fun and never touches the shopping list or the totals:
   no tag(), no pickables, no instancesOf, no SEL.
     - Setting "Cabin porch": a snowy log-cabin porch at blue hour (registerRoom 'porch').
     - Setting "Northern-lights forest": aurora sky, stars and moon, snow, a spruce ring
       beyond the orbit, falling snow kept out of the tree (registerRoom 'forest').
     - "Window snow" (living room): snow falling behind the two back windows.
     - "Fireplace & stockings" (living room): a fieldstone fireplace on the left wall with
       a crackling fire (crossed flame planes), mantel garland, three paw-print mini
       stockings, a wreath and a "Dear Santa Paws" card; its flicker drives accent[1].
     - "Snow globe": the whole display in a glass globe on a walnut base; spinning the
       view swirls the snow.
   The whole file is one block so none of its names clash with tree.js or other extras.
   ================================================================ */
{
const RM = REDUCED_MOTION, LQ = LOW;
const V2 = new THREE.Vector2(), V3 = new THREE.Vector3(), V3b = new THREE.Vector3();
const clamp01 = v => Math.min(1, Math.max(0, v));
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lin = (r, g, b) => new THREE.Color().setRGB(r, g, b);   // linear working-space colour
const f4 = v => Number(v).toFixed(4);
const isShown = o => { for (let x = o; x; x = x.parent) if (!x.visible) return false; return true; };
// pixels per world unit at distance 1 (for size-attenuated snow points)
const pxScale = () => { renderer.getDrawingBufferSize(V2); return V2.y / (2 * Math.tan(camera.fov * Math.PI / 360)); };
const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.8, envMapIntensity: 0.4, ...o });
// merge geometries that share one material into a single mesh (one draw call)
function meshOf(geos, material, { cast = false, receive = true } = {}) {
  const m = new THREE.Mesh(geos.length === 1 ? geos[0] : mergeGeometries(geos), material);
  m.castShadow = cast; m.receiveShadow = receive; return m;
}
const boxG = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
// planar UVs from position by dominant normal (s = world units per texture repeat): textures run on continuously across parts
function worldUV(geo, s = 1, ox = 0, oy = 0) {
  const P = geo.attributes.position, N = geo.attributes.normal, U = geo.attributes.uv;
  for (let i = 0; i < P.count; i++) {
    const nx = Math.abs(N.getX(i)), ny = Math.abs(N.getY(i)), nz = Math.abs(N.getZ(i)), x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    if (nx >= ny && nx >= nz) U.setXY(i, (z + ox) / s, (y + oy) / s); else if (ny >= nz) U.setXY(i, (x + ox) / s, (z + oy) / s); else U.setXY(i, (x + ox) / s, (y + oy) / s);
  }
  U.needsUpdate = true; return geo;
}
function paint(geo, fn) {   // per-vertex colour from fn(x, y, z, nx, ny, nz) -> [r, g, b] (linear)
  const P = geo.attributes.position, N = geo.attributes.normal, c = new Float32Array(P.count * 3);
  for (let i = 0; i < P.count; i++) c.set(fn(P.getX(i), P.getY(i), P.getZ(i), N.getX(i), N.getY(i), N.getZ(i)), i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); return geo;
}
// text on a canvas, fitted to a width
function fitText(g, text, x, y, maxW, font, size, color, align = 'center') {
  let s = size; g.font = font.replace('#', s); while (g.measureText(text).width > maxW && s > 8) { s -= 2; g.font = font.replace('#', s); }
  g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle'; g.fillText(text, x, y);
}

/* ---------------- Shared GLSL: value noise / fbm ---------------- */
const NOISE_GLSL = `
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), u.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), u.x), u.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < FBM_OCT; i++){ s += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; } return s / (1.0 - pow(0.5, float(FBM_OCT))); }`;

/* ---------------- Falling snow (THREE.Points + ShaderMaterial) ----------------
   y = mod(y0 - t*v, H) with a gentle sway; soft round flakes; size-attenuated.
   CULL 0: none; 1: kept out of the tree (canopy cone, the presents under it, the topper);
   2: also kept out from under the porch roof; 3: inside the snow globe (swirl + sphere clamp + canopy). */
const SNOW_VS = `
attribute vec4 aR;   // fall speed, phase, size, sway
uniform float uTime, uPx, uSize, uH, uYB, uSwirl; uniform vec4 uSph;
varying float vA;
float coneR(float y){ return ${f4(RB)} * pow(max(0.0, 1.0 - (y - ${f4(Y0)}) / ${f4(YTOP - Y0)}), 0.92); }
void main(){
  vec3 p = position;
  float y = uYB + mod(p.y - uYB - uTime * aR.x, uH);
  float sw = 0.6 + aR.w;
  p.x += sin(uTime * 0.9 * sw + aR.y) * 0.1 * aR.w;
  p.z += cos(uTime * 0.7 * sw + aR.y * 1.7) * 0.1 * aR.w;
  p.y = y;
  float a = smoothstep(0.0, 0.4, y - uYB) * smoothstep(0.0, 0.4, uYB + uH - y);
#if CULL == 3
  float ang = uSwirl * (0.55 + 0.45 * fract(aR.y * 7.13));
  float c = cos(ang), s = sin(ang); p.xz = mat2(c, -s, s, c) * p.xz;
  float dy = p.y - uSph.y; float rmax = sqrt(max(0.0, uSph.w * uSph.w - dy * dy)) - 0.15;
  float rr = length(p.xz); if (rr > rmax) p.xz *= rmax / max(rr, 1e-3);
#endif
#if CULL >= 1
  float r = length(p.xz);
  float lim = p.y < ${f4(Y0)} ? ${f4(RB + 0.3)} : (p.y < ${f4(YTOP + 1.1)} ? max(coneR(p.y) + 0.3, 0.8) : 0.0);
  if (r < lim) a = 0.0;
#endif
#if CULL == 2
  if (abs(p.x) < 6.35 && p.z > -3.95 && p.z < 5.3 && p.y > -1.2) a = 0.0;
#endif
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float sz = uSize * aR.z * uPx / max(0.05, -mv.z);
  a *= smoothstep(0.3, 1.0, -mv.z) * clamp(sz / 1.6, 0.0, 1.0);
  gl_PointSize = clamp(sz, 1.6, 40.0);
  vA = a;
  if (a < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;
const SNOW_FS = `
uniform vec3 uColor; uniform float uOpacity; varying float vA;
void main(){ vec2 q = gl_PointCoord - 0.5; float d = length(q) * 2.0;
  float a = (1.0 - smoothstep(0.2, 1.0, d)) * vA * uOpacity; if (a < 0.01) discard;
  gl_FragColor = vec4(uColor * (1.0 + 0.25 * (1.0 - d)), a); }`;
function snowPoints({ n, seed, gen, size = 0.05, color = [0.82, 0.88, 1.0], opacity = 0.9, cull = 0, yb = 0, H = 8, speed = [0.55, 1.1] }) {
  const r = rng(seed), P = new Float32Array(n * 3), A = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { P.set(gen(r), i * 3); A.set([speed[0] + r() * (speed[1] - speed[0]), r() * 6.283, 0.55 + r() * r() * 1.3, 0.3 + r() * 0.9], i * 4); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('aR', new THREE.BufferAttribute(A, 4));
  const m = new THREE.ShaderMaterial({
    defines: { CULL: cull },
    uniforms: { uTime: { value: 0 }, uPx: { value: 800 }, uSize: { value: size }, uH: { value: H }, uYB: { value: yb }, uSwirl: { value: 0 }, uSph: { value: new THREE.Vector4(0, 2.6, 0, 5.5) },
      uColor: { value: lin(...color) }, uOpacity: { value: opacity } },
    vertexShader: SNOW_VS, fragmentShader: SNOW_FS, transparent: true, depthWrite: false,
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 4;
  pts.userData.tick = (t) => { m.uniforms.uTime.value = RM ? t * 0.25 : t; m.uniforms.uPx.value = pxScale(); };
  return pts;
}
// uniform points in a ring r0..r1 (area-uniform), y0..y1
const ringGen = (r0, r1, y0, y1) => r => { const a = r() * Math.PI * 2, rr = Math.sqrt(r0 * r0 + r() * (r1 * r1 - r0 * r0)); return [Math.cos(a) * rr, y0 + r() * (y1 - y0), Math.sin(a) * rr]; };

/* ---------------- Night / twilight sky dome ---------------- */
function skyMaterial(mode) {   // 0: aurora night (forest), 1: blue-hour twilight (porch)
  return new THREE.ShaderMaterial({
    defines: { MODE: mode, FBM_OCT: LQ ? 3 : 4, AUR_N: LQ ? 2 : 3, STAR_T: mode === 0 ? '0.972' : '0.985' },
    uniforms: { uTime: { value: 0 }, uDay: { value: 0 }, uAur: { value: 1 }, uMoon: { value: new THREE.Vector3(0, 0.3, -1).normalize() } },
    side: THREE.BackSide, depthWrite: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec3 vDir; uniform float uTime, uDay, uAur; uniform vec3 uMoon;
${NOISE_GLSL}
float h31(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void main(){
  vec3 d = normalize(vDir); float e = d.y; vec2 cxz = normalize(d.xz + vec2(1e-5));
#if MODE == 0
  vec3 zen = vec3(0.0016, 0.0042, 0.016), hor = vec3(0.010, 0.032, 0.050);
#else
  vec3 zen = vec3(0.004, 0.010, 0.045), hor = vec3(0.075, 0.085, 0.16);
#endif
  vec3 col = mix(hor, zen, pow(clamp(e, 0.0, 1.0), 0.42));
#if MODE == 1
  float sun = max(0.0, dot(cxz, normalize(vec2(0.85, -0.55))));
  col += vec3(0.42, 0.13, 0.05) * pow(sun, 3.0) * exp(-max(e, 0.0) * 8.0);
  col += vec3(0.10, 0.05, 0.08) * pow(sun, 1.5) * exp(-max(e, 0.0) * 3.0);
#endif
  if (e < 0.0) col = mix(hor * 1.15, hor * 0.7, clamp(-e * 6.0, 0.0, 1.0));
  // stars
  vec3 sp = d * 230.0, cell = floor(sp); float hs = h31(cell), st = 0.0;
  if (hs > STAR_T) { vec3 cp = cell + 0.5 + (vec3(h31(cell + 11.1), h31(cell + 23.7), h31(cell + 37.3)) - 0.5) * 0.5;
    float k = (hs - STAR_T) / (1.0 - STAR_T);
    st = smoothstep(0.34, 0.0, length(sp - cp)) * (0.35 + 2.4 * k * k * k) * (0.75 + 0.25 * sin(uTime * (1.0 + hs * 40.0) + hs * 90.0)); }
#if MODE == 1
  st *= smoothstep(0.12, 0.45, e);
#endif
  col += vec3(0.85, 0.9, 1.0) * st * smoothstep(0.02, 0.2, e) * (1.0 - uDay);
#if MODE == 0
  // aurora: vertical curtains with a sharp lower edge, green below fading to violet above
  vec3 aur = vec3(0.0);
  for (int i = 0; i < AUR_N; i++) {
    float fi = float(i);
    vec2 q = cxz * (1.7 + fi * 0.45);
    float base = 0.12 + 0.065 * fi + 0.12 * (fbm(q + vec2(fi * 3.1, uTime * 0.018)) - 0.5);
    float above = e - base;
    float prof = above > 0.0 ? exp(-above / (0.085 + 0.05 * fi)) : exp(above / 0.014);
    float rays = 0.35 + 0.9 * fbm(cxz * (30.0 + fi * 9.0) + vec2(uTime * 0.035, fi * 5.0));
    float mask = smoothstep(0.32, 0.62, fbm(q * 1.25 + vec2(-uTime * 0.012, fi * 7.7)) + 0.22 * max(0.0, -d.z));
    vec3 c = mix(vec3(0.10, 1.0, 0.42), vec3(0.62, 0.16, 0.95), smoothstep(0.015, 0.2, above));
    aur += c * prof * rays * mask * (1.0 - 0.28 * fi);
  }
  col += aur * uAur * smoothstep(-0.02, 0.05, e) * (1.0 - uDay);
  // a faint green airglow on the horizon under the curtains
  col += vec3(0.0, 0.03, 0.015) * uAur * exp(-abs(e) * 14.0) * (1.0 - uDay);
#endif
  // the moon (a crescent at blue hour)
  float md = dot(d, uMoon);
  vec3 mx = normalize(cross(uMoon, vec3(0.0, 1.0, 0.0))), my = cross(mx, uMoon);
  vec2 m2 = vec2(dot(d, mx), dot(d, my)) / 0.0215;
  float disc = (1.0 - smoothstep(0.92, 1.0, length(m2))) * step(0.0, md);
#if MODE == 1
  disc *= smoothstep(0.85, 1.05, length(m2 - vec2(-0.38, 0.22)));
#endif
  float mar = fbm(m2 * 1.6 + 4.0);
  col = mix(col, vec3(2.4, 2.35, 2.15) * (0.72 + 0.38 * mar) * (1.0 - 0.75 * uDay), disc);
  col += vec3(0.22, 0.27, 0.40) * pow(max(md, 0.0), 1400.0) * 0.8 * (1.0 - uDay) + vec3(0.025, 0.03, 0.05) * pow(max(md, 0.0), 60.0) * (1.0 - uDay);
  // daytime (tree lights off): pale overcast winter sky
  vec3 day = e > 0.0 ? mix(vec3(0.62, 0.68, 0.78), vec3(0.26, 0.36, 0.55), pow(e, 0.6)) : vec3(0.58, 0.62, 0.70);
  col = mix(col, day, uDay);
  gl_FragColor = vec4(col, 1.0);
}`,
  });
}
function makeSky(mode, moonDir) {
  const m = skyMaterial(mode);
  m.uniforms.uMoon.value.copy(moonDir).normalize();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(90, 48, 24), m); sky.renderOrder = -10; sky.frustumCulled = false; sky.userData.globeKeep = true;
  return sky;
}

/* ---------------- Snow ground, snowy spruces, rocks ---------------- */
const snowTex = () => canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#e9eef6'; g.fillRect(0, 0, w, h); noise(g, w, h, 9000, 0.22, ['#c9d3e3', '#ffffff', '#d7deea', '#b9c6da']); });
const sparkleTex = () => canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); for (let i = 0; i < 420; i++) { g.fillStyle = `rgba(255,255,255,${0.4 + Math.random() * 0.6})`; g.fillRect(Math.random() * w, Math.random() * h, 1.2, 1.2); } });
let SNOW_MAT = null;
function snowMat() {
  if (SNOW_MAT) return SNOW_MAT;
  const t = snowTex(); t.repeat.set(36, 36); const s = sparkleTex(); s.repeat.set(52, 52);
  return (SNOW_MAT = std({ map: t, color: lin(0.86, 0.9, 0.98), roughness: 0.88, emissiveMap: s, emissive: lin(0.55, 0.65, 0.9), emissiveIntensity: 0.35, envMapIntensity: 0.35 }));
}
// gentle drifts away from the display (flat within r 3.8 so the presents sit level), rising to low hills far out
const driftH = (x, z) => { const r = Math.hypot(x, z);
  const n = 0.22 * Math.sin(x * 0.31 + 1.2) * Math.sin(z * 0.27 + 0.4) + 0.14 * Math.sin(x * 0.73 + z * 0.41) + 0.08 * Math.sin(z * 1.1 - x * 0.5) + 0.05 * Math.sin(x * 2.3 + z * 1.7);
  return (n + 0.12) * sstep(3.8, 10, r) + sstep(26, 70, r) * 2.2; };
function snowGround(yBase = 0, R = 70, hole = null) {
  const geo = new THREE.RingGeometry(0.02, R, LQ ? 96 : 128, LQ ? 36 : 48);
  const P = geo.attributes.position;
  for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), r = Math.hypot(x, y); if (r < 1e-4) continue; const k = R * Math.pow(r / R, 1.7) / r; P.setXY(i, x * k, y * k); }
  geo.rotateX(-Math.PI / 2);
  for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i); P.setY(i, yBase + driftH(x, z) * (hole ? hole(x, z) : 1)); }
  geo.computeVertexNormals();
  const U = geo.attributes.uv; for (let i = 0; i < P.count; i++) U.setXY(i, P.getX(i) / (2 * R) + 0.5, P.getZ(i) / (2 * R) + 0.5);
  const m = new THREE.Mesh(geo, snowMat()); m.receiveShadow = true; return m;
}
function snowMound(R = 2.4, H = 0.13) {
  const pts = []; for (let i = 16; i >= 0; i--) { const r = R * i / 16; pts.push(new THREE.Vector2(Math.max(0.001, r), 0.002 + H * Math.pow(Math.max(0, 1 - (r / R) ** 2), 2))); }
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), snowMat()); m.receiveShadow = true; return m;
}
// one snowy spruce, 1 unit tall: drooping, jagged tiers with snow on their upper faces
function spruceGeometry(seed) {
  const r = rng(seed), parts = [];
  const trunk = new THREE.CylinderGeometry(0.016, 0.03, 0.16, 6, 1); trunk.translate(0, 0.08, 0); paint(trunk, () => [0.05, 0.03, 0.018]); parts.push(trunk);
  const N = 10, green = [0.010, 0.030, 0.018], green2 = [0.016, 0.045, 0.026], snow = [0.70, 0.76, 0.86];
  for (let i = 0; i < N; i++) {
    const t = i / N, yb = 0.07 + t * 0.81, h = 0.22 - t * 0.1, rad = 0.37 * Math.pow(1 - t, 0.9) + 0.035;
    const g = new THREE.ConeGeometry(rad, h, 18, 2, false); g.translate(0, yb + h / 2, 0);
    const P = g.attributes.position, ph = r() * 6.28, k = 5 + (i % 3), cover = 0.55 + r() * 0.35;
    const cols = new Float32Array(P.count * 3), Nn = g.attributes.normal;
    for (let v = 0; v < P.count; v++) {
      const x = P.getX(v), y = P.getY(v), z = P.getZ(v), a = Math.atan2(z, x), rel = (y - yb) / h;
      const jag = 1 + 0.15 * Math.sin(a * k + ph) + 0.08 * Math.sin(a * (k + 4) + ph * 2.3) + 0.06 * Math.sin(a * (2 * k + 1) + ph * 0.7);
      const s = rel < 0.02 ? jag : 1 + (jag - 1) * (1 - rel);
      P.setXYZ(v, x * s, y - (rel < 0.02 ? Math.max(0, jag - 0.95) * 0.12 : 0), z * s);
      let c;
      if (Nn.getY(v) < -0.5) c = green;   // underside
      else { const sn = clamp01((rel - 0.28) / 0.4) * cover * (0.75 + 0.25 * Math.sin(a * 3 + ph)); const gc = (i + v) % 2 ? green : green2; c = gc.map((q, j) => q + (snow[j] - q) * sn); }
      cols.set(c, v * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); parts.push(g);
  }
  const top = new THREE.ConeGeometry(0.03, 0.12, 6, 1); top.translate(0, 0.94, 0); paint(top, () => snow); parts.push(top);
  return mergeGeometries(parts);
}
// far spruces fade into the night haze (no scene.fog: that would recompile every material)
function hazeMat(haze) {
  const m = std({ vertexColors: true, roughness: 0.95, envMapIntensity: 0.2 });
  m.userData.uHaze = { value: haze };
  m.onBeforeCompile = sh => {
    sh.uniforms.uHaze = m.userData.uHaze;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vHz;').replace('#include <project_vertex>', '#include <project_vertex>\nvHz = length(mvPosition.xyz);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vHz; uniform vec3 uHaze;')
      .replace('#include <dithering_fragment>', 'gl_FragColor.rgb = mix(gl_FragColor.rgb, uHaze, clamp((vHz - 15.0) / 42.0, 0.0, 0.7));\n#include <dithering_fragment>');
  };
  m.customProgramCacheKey = () => 'envx-haze';
  return m;
}
// a ring of spruces, every one past the camera orbit (r >= rMin) so none can come between the camera and the tree
function spruceRing({ seed, n, rMin = 16.5, rMax = 40, behind = null, avoid = null, haze, yAt = () => 0 }) {
  const r = rng(seed), list = [];
  let tries = 0;
  while (list.length < n && tries++ < n * 40) {
    const a = r() * Math.PI * 2, dx = Math.sin(a), dz = -Math.cos(a);   // a = 0 is straight behind the tree (-z)
    const back = Math.abs(Math.atan2(dx, -dz)) < 0.75;
    let rr = rMin + Math.pow(r(), 0.8) * (rMax - rMin), hh;
    if (back && behind) { rr = behind.r0 + r() * (behind.r1 - behind.r0); hh = behind.h0 + r() * (behind.h1 - behind.h0); }
    else hh = 8 + (rr - rMin) / (rMax - rMin) * 9 + r() * 4;
    const x = dx * rr, z = dz * rr;
    if (avoid && avoid(x, z)) continue;
    if (list.some(p => Math.hypot(p.x - x, p.z - z) < 1.6 + hh * 0.12)) continue;
    list.push({ x, z, h: hh, w: hh * (0.62 + r() * 0.22), ry: r() * 6.28, s: r() });
  }
  const geos = [spruceGeometry(seed + 1), spruceGeometry(seed + 2)];
  const mat = hazeMat(haze);
  const grp = new THREE.Group(), d = new THREE.Object3D();
  geos.forEach((geo, k) => {
    const sub = list.filter((_, i) => i % 2 === k);
    const im = new THREE.InstancedMesh(geo, mat, sub.length);
    sub.forEach((p, i) => { d.position.set(p.x, yAt(p.x, p.z) - 0.15, p.z); d.rotation.set(0, p.ry, 0); d.scale.set(p.w, p.h, p.w); d.updateMatrix(); im.setMatrixAt(i, d.matrix);
      const v = 0.8 + p.s * 0.4; im.setColorAt(i, new THREE.Color(v, v, v)); });
    im.castShadow = false; im.receiveShadow = false; im.frustumCulled = false; grp.add(im);
  });
  grp.userData.mat = mat;
  return grp;
}
function snowyRock(seed, s) {
  const r = rng(seed), g = new THREE.SphereGeometry(1, 22, 14), P = g.attributes.position;
  for (let i = 0; i < P.count; i++) { V3.fromBufferAttribute(P, i); const k = 1 + 0.18 * Math.sin(V3.x * 3 + seed) * Math.sin(V3.z * 2.6) + 0.08 * (r() - 0.5); V3.multiplyScalar(k); V3.y = V3.y < 0 ? V3.y * 0.3 : V3.y * 0.62; P.setXYZ(i, V3.x, V3.y, V3.z); }
  g.computeVertexNormals(); g.scale(s, s, s * (0.8 + r() * 0.4));
  paint(g, (x, y, z, nx, ny) => { const sn = sstep(0.35, 0.7, ny); return [0.06 + sn * 0.66, 0.06 + sn * 0.71, 0.065 + sn * 0.82]; });
  return g;
}

/* ---------------- Evergreen sprigs, berries and baubles (garlands, wreaths, window boxes) ---------------- */
let SPRIG_TEX = null;
function sprigTex() {
  return SPRIG_TEX ||= (() => { const t = canvasTex(128, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h); const greens = ['#123020', '#173a25', '#1d452c', '#245134', '#2d5d3c', '#3a6b45'];
    g.strokeStyle = '#3b2a18'; g.lineWidth = 3; g.beginPath(); g.moveTo(w / 2, h); g.lineTo(w / 2, 6); g.stroke();
    for (let y = h - 6; y > 10; y -= 5) for (const s of [-1, 1]) { const L = (18 + Math.random() * 16) * (0.55 + 0.45 * (y / h)); const a = -Math.PI / 2 + s * (0.75 + Math.random() * 0.35);
      g.strokeStyle = greens[(Math.random() * greens.length) | 0]; g.lineWidth = 2.2 + Math.random(); g.beginPath(); g.moveTo(w / 2, y); g.lineTo(w / 2 + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke(); }
  }, { clamp: true }); return t; })();
}
function greenery(seed) {   // collects instances, then builds 3 instanced meshes
  const r = rng(seed), sprigs = [], berries = [], baubles = [], cones = [];
  const up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), q2 = new THREE.Quaternion();
  return {
    r,
    sprig(p, dir, s = 1) { q.setFromUnitVectors(up, dir.clone().normalize()); q2.setFromAxisAngle(up, r() * 6.28); sprigs.push({ p: p.clone(), q: q.clone().multiply(q2), s }); },
    berry(p, s = 1) { berries.push({ p: p.clone(), s }); },
    bauble(p, s = 1) { baubles.push({ p: p.clone(), s }); },
    cone(p, dir, s = 1) { q.setFromUnitVectors(up, dir.clone().normalize()); cones.push({ p: p.clone(), q: q.clone(), s }); },
    build() {
      const grp = new THREE.Group(), d = new THREE.Object3D();
      const inst = (geo, mat, list, setup) => { if (!list.length) return; const im = new THREE.InstancedMesh(geo, mat, list.length);
        list.forEach((it, i) => { d.position.copy(it.p); d.quaternion.copy(it.q || q.identity()); d.scale.setScalar(it.s); d.updateMatrix(); im.setMatrixAt(i, d.matrix); if (setup) setup(im, i, it); });
        im.castShadow = false; im.receiveShadow = true; grp.add(im); };
      const sg = mergeGeometries([new THREE.PlaneGeometry(0.11, 0.24).translate(0, 0.12, 0), new THREE.PlaneGeometry(0.11, 0.24).translate(0, 0.12, 0).rotateY(Math.PI / 2)]);
      inst(sg, std({ map: sprigTex(), alphaTest: 0.35, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.75, envMapIntensity: 0.3 }), sprigs,
        (im, i) => { const v = 0.95 + r() * 0.6; im.setColorAt(i, new THREE.Color(v, v * (0.95 + r() * 0.1), v)); });
      inst(new THREE.SphereGeometry(0.022, 10, 8), new THREE.MeshPhysicalMaterial({ color: 0x8e0f17, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 0.9 }), berries);
      inst(new THREE.SphereGeometry(0.045, 14, 10), std({ color: 0xc9973f, metalness: 1, roughness: 0.28, envMapIntensity: 1.1 }), baubles);
      if (cones.length) { const cg = new THREE.LatheGeometry([0, 0.3, 0.5, 0.7, 0.85, 1].map((v, i) => new THREE.Vector2(i === 0 ? 0.001 : 0.035 * Math.sin(v * Math.PI) + 0.004, v * 0.1)), 9);
        paint(cg, (x, y) => (Math.floor(y * 90) % 2 ? [0.12, 0.06, 0.025] : [0.2, 0.11, 0.05])); inst(cg, std({ vertexColors: true, roughness: 0.9 }), cones); }
      return grp;
    },
  };
}
// a wreath: radius R (to the ring centre line), facing +z, centred at the origin
function wreath(G, R, n, { berries = 26, baubles = 8, cones = 6 } = {}) {
  const r = G.r, P = new THREE.Vector3(), D = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, rr = R + (r() - 0.5) * R * 0.38, zz = (r() - 0.3) * 0.08;
    P.set(Math.cos(a) * rr, Math.sin(a) * rr, zz);
    const tang = new THREE.Vector3(-Math.sin(a), Math.cos(a), 0).multiplyScalar(r() < 0.5 ? 1 : -1);
    D.set(Math.cos(a), Math.sin(a), 0).multiplyScalar((rr - R) / R * 1.2).add(tang).add(new THREE.Vector3(0, 0, 0.35 + r() * 0.4)).normalize();
    G.sprig(P.clone().addScaledVector(D, -0.05), D, 0.75 + r() * 0.5);
  }
  for (let i = 0; i < berries; i++) { const a = (i / berries) * 6.28 + r() * 0.3, c = new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, 0.1); for (let k = 0; k < 3; k++) G.berry(c.clone().add(new THREE.Vector3((r() - 0.5) * 0.06, (r() - 0.5) * 0.06, r() * 0.02)), 0.8 + r() * 0.5); }
  for (let i = 0; i < baubles; i++) { const a = (i / baubles) * 6.28 + 0.4; G.bauble(new THREE.Vector3(Math.cos(a) * R * 1.02, Math.sin(a) * R * 1.02, 0.1), 0.8 + r() * 0.3); }
  for (let i = 0; i < cones; i++) { const a = (i / cones) * 6.28 + 1.1; G.cone(new THREE.Vector3(Math.cos(a) * R * 0.95, Math.sin(a) * R * 0.95, 0.09), new THREE.Vector3(Math.cos(a), Math.sin(a), 0.6), 1.6); }
}
const tartan = (rep = 2) => {   // a clone of the shop tartan photo; bump it once the photo has loaded (no warnings, and it still uploads)
  const t = tartanTex.clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep);
  const ready = () => { const im = tartanTex.image; return im && (im.complete === undefined || im.complete) && (im.width || im.naturalWidth); };
  if (ready()) t.needsUpdate = true; else { const iv = setInterval(() => { if (ready()) { t.needsUpdate = true; clearInterval(iv); } }, 120); }
  return t; };
let TARTAN_BOW_MAT = null;
const tartanBowMat = () => TARTAN_BOW_MAT ||= std({ map: tartan(1), color: lin(1.3, 1.18, 1.18), roughness: 0.75, side: THREE.DoubleSide, envMapIntensity: 0.4 });

/* ---------------- Wood, stone and fabric textures ---------------- */
function grainTex(w, h, tones, { streaks = 260, along = 'x', knots = 6, seedDark = 'rgba(25,12,5,' } = {}) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = tones[0]; g.fillRect(0, 0, w, h);
    for (let i = 0; i < streaks; i++) { const a = 0.04 + Math.random() * 0.14; g.strokeStyle = Math.random() < 0.65 ? seedDark + a + ')' : `rgba(255,220,170,${a * 0.6})`; g.lineWidth = 0.6 + Math.random() * 2.4; g.beginPath();
      if (along === 'x') { const y = Math.random() * h; g.moveTo(0, y); for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x / 90 + i) * 2.5 + Math.sin(x / 23 + i * 3) * 0.8); }
      else { const x = Math.random() * w; g.moveTo(x, 0); for (let y = 0; y <= h; y += 32) g.lineTo(x + Math.sin(y / 90 + i) * 2.5 + Math.sin(y / 23 + i * 3) * 0.8, y); }
      g.stroke(); }
    for (let i = 1; i < tones.length; i++) { g.globalAlpha = 0.25; g.fillStyle = tones[i]; for (let k = 0; k < 8; k++) along === 'x' ? g.fillRect(0, Math.random() * h, w, 4 + Math.random() * 18) : g.fillRect(Math.random() * w, 0, 4 + Math.random() * 18, h); g.globalAlpha = 1; }
    for (let i = 0; i < knots; i++) { const x = Math.random() * w, y = Math.random() * h, rg = g.createRadialGradient(x, y, 0, x, y, 10); rg.addColorStop(0, 'rgba(30,14,6,.75)'); rg.addColorStop(1, 'rgba(30,14,6,0)'); g.fillStyle = rg; g.beginPath(); g.ellipse(x, y, along === 'x' ? 16 : 7, along === 'x' ? 7 : 16, 0, 0, 7); g.fill(); }
  });
}
const endGrainTex = (core = '#b07a45', bark = '#3a2414') => canvasTex(256, 256, (g, w) => {
  g.fillStyle = core; g.fillRect(0, 0, w, w);
  for (let r = 4; r < w / 2; r += 4 + Math.random() * 5) { g.strokeStyle = `rgba(90,45,15,${0.18 + Math.random() * 0.25})`; g.lineWidth = 1 + Math.random() * 1.5; g.beginPath(); g.ellipse(w / 2 + Math.random() * 2, w / 2, r, r * (0.96 + Math.random() * 0.06), 0, 0, 7); g.stroke(); }
  for (let i = 0; i < 5; i++) { const a = Math.random() * 6.28; g.strokeStyle = 'rgba(40,20,8,.45)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(w / 2, w / 2); g.lineTo(w / 2 + Math.cos(a) * w * 0.45, w / 2 + Math.sin(a) * w * 0.45); g.stroke(); }
  g.strokeStyle = bark; g.lineWidth = 14; g.beginPath(); g.arc(w / 2, w / 2, w / 2 - 7, 0, 7); g.stroke();
}, { clamp: true });
function stoneTex() {   // seamless fieldstone in warm greys and craft-paper tans, dark mortar
  return canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#3b332c'; g.fillRect(0, 0, w, h); noise(g, w, h, 8000, 0.3, ['#2a241f', '#574d43']);
    const tones = ['#b9ab98', '#a39686', '#8f8273', '#c8bba5', '#9a8a78', '#7d7266', '#b49a7c', '#a88f72', '#cbbfa9'];
    const rows = []; let tot = 0; while (tot < h) { const rh = 80 + Math.random() * 70; rows.push(rh); tot += rh; }
    const ks = h / tot; let y = 0;
    rows.forEach(rh0 => { const rh = rh0 * ks; const ws = []; let tw = 0; while (tw < w) { const rw = 100 + Math.random() * 150; ws.push(rw); tw += rw; } const kw = w / tw; let x = Math.random() * w;
      ws.forEach(rw0 => { const rw = rw0 * kw;
        for (const dx of [0, -w]) for (const dy of y + rh > h ? [0, -h] : [0]) {
          const x0 = x + dx + 5, y0 = y + dy + 5, sw = rw - 10, sh = rh - 10, j = () => (Math.random() - 0.5) * 14;
          g.save(); g.beginPath(); g.moveTo(x0 + sw * 0.15 + j(), y0 + j()); g.lineTo(x0 + sw * 0.85 + j(), y0 + j()); g.quadraticCurveTo(x0 + sw + j(), y0 + j(), x0 + sw + j(), y0 + sh * 0.3); g.lineTo(x0 + sw + j(), y0 + sh * 0.75);
          g.quadraticCurveTo(x0 + sw + j(), y0 + sh, x0 + sw * 0.8 + j(), y0 + sh + j()); g.lineTo(x0 + sw * 0.2 + j(), y0 + sh + j()); g.quadraticCurveTo(x0 + j(), y0 + sh, x0 + j(), y0 + sh * 0.7); g.lineTo(x0 + j(), y0 + sh * 0.25); g.quadraticCurveTo(x0, y0, x0 + sw * 0.15, y0); g.closePath();
          g.fillStyle = tones[(Math.random() * tones.length) | 0]; g.fill(); g.clip();
          const sg = g.createLinearGradient(x0, y0, x0 + sw * 0.4, y0 + sh); sg.addColorStop(0, 'rgba(255,245,225,.22)'); sg.addColorStop(0.6, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,.3)'); g.fillStyle = sg; g.fillRect(x0 - 10, y0 - 10, sw + 20, sh + 20);
          noise(g, w, h, 0, 0, ['#000']); for (let k = 0; k < 160; k++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(40,32,24,.18)' : 'rgba(255,250,235,.14)'; g.fillRect(x0 + Math.random() * sw, y0 + Math.random() * sh, 2 + Math.random() * 3, 2 + Math.random() * 3); }
          g.restore(); g.strokeStyle = 'rgba(20,16,12,.55)'; g.lineWidth = 3; g.stroke();
        }
        x = (x + rw) % w; });
      y += rh; });
  });
}
const knitTex = (base, lo, hi) => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h); const cw = 10, ch = 9;
  for (let y = 0; y < h; y += ch) for (let x = 0; x < w; x += cw) { g.strokeStyle = lo; g.lineWidth = 2.2; g.beginPath(); g.moveTo(x + 1, y + 1); g.lineTo(x + cw / 2, y + ch - 1); g.lineTo(x + cw - 1, y + 1); g.stroke(); g.strokeStyle = hi; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 2.5, y); g.lineTo(x + cw / 2, y + ch - 2.5); g.stroke(); }
  noise(g, w, h, 1600, 0.16, [lo, hi]);
}, { repeat: [4, 4] });
const sherpaTex = () => canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#ece2d0'; g.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { const x = Math.random() * w, y = Math.random() * h, r = 2 + Math.random() * 4; g.strokeStyle = Math.random() < 0.5 ? 'rgba(160,140,110,.35)' : 'rgba(255,255,250,.6)'; g.lineWidth = 1.2; g.beginPath(); g.arc(x, y, r, Math.random() * 6, Math.random() * 6 + 3); g.stroke(); } }, { repeat: [4, 4] });
const feltMat = c => std({ color: c, roughness: 0.95, envMapIntensity: 0.25 });
// paw-print shapes (pad + 4 toes) in a s x s box centred at the origin
function pawShapes(s) {
  const out = [], el = (x, y, rx, ry, rot = 0) => { const sh = new THREE.Shape(); sh.absellipse(x * s, y * s, rx * s, ry * s, 0, Math.PI * 2, false, rot); out.push(sh); };
  el(0, -0.2, 0.32, 0.26); [[-0.36, 0.14, -0.4], [-0.13, 0.38, -0.12], [0.13, 0.38, 0.12], [0.36, 0.14, 0.4]].forEach(([x, y, r]) => el(x, y, 0.12, 0.16, r));
  return out;
}

/* ================================================================
   1. Window snow (living room): snow falling in the slab between the window glass and the night backdrop.
   ================================================================ */
registerExtra({
  id: 'window_snow', label: 'Window snow', kind: 'setting', default: true, rooms: ['living'],
  build(c) {
    const S = ROOM.snow, spans = ROOM.windows.map(w => [w.x - w.w / 2 - 0.25, w.x + w.w / 2 + 0.25]), tot = spans.reduce((s, [a, b]) => s + b - a, 0);
    const pts = snowPoints({ n: LQ ? 700 : 1600, seed: 77, size: 0.055, opacity: 0.95, color: [0.95, 0.97, 1.0], yb: 1.7, H: 5.9, speed: [0.5, 1.0], cull: 0,
      gen: r => { let u = r() * tot, x = 0; for (const [a, b] of spans) { if (u <= b - a) { x = a + u; break; } u -= b - a; } return [x, 1.7 + r() * 5.9, S.z0 - r() * (S.z0 - S.z1)]; } });
    pts.name = 'extra.window_snow';
    pts.renderOrder = 4;   // before the frosted panes (renderOrder 5), so the frost lies over the flakes
    (ROOM.groups.back || extrasGroup).add(pts);   // hides with the back wall in the dollhouse cut-away
    return pts;
  },
  tick(t, dt, c) { const o = this.obj; if (o) o.userData.tick(t); },
});

/* ================================================================
   2. Fireplace (living room, left wall): fieldstone chimney breast, firebox, logs, fire,
      oak mantel with a garland, three paw-print mini stockings, a wreath and a card.
      Its flicker drives accent[1] (moved into the firebox while it is on).
   ================================================================ */
const FIRE_MAT = new THREE.ShaderMaterial({
  defines: { FBM_OCT: 4 },
  uniforms: { uTime: { value: 0 }, uGain: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  vertexShader: `attribute float aSeed; varying vec2 vUv; varying float vSeed; void main(){ vUv = uv; vSeed = aSeed; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `varying vec2 vUv; varying float vSeed; uniform float uTime, uGain;
${NOISE_GLSL}
void main(){
  vec2 uv = vUv; float t = uTime;
  float n1 = fbm(vec2(uv.x * 3.2 + vSeed * 5.0, uv.y * 2.4 - t * 1.7));
  float n2 = fbm(vec2(uv.x * 7.0 - vSeed * 3.0, uv.y * 5.5 - t * 3.1));
  float x = (uv.x - 0.5) * 2.0 + (n1 - 0.5) * 0.5 * uv.y;
  float wdt = 0.95 * pow(1.0 - uv.y, 0.8) + 0.05;
  float body = 1.0 - smoothstep(0.35, 1.0, abs(x) / wdt);
  float h = uv.y + (n1 - 0.5) * 0.6 + (n2 - 0.5) * 0.3;
  float f = body * (1.0 - smoothstep(0.2, 0.92, h)) * smoothstep(0.0, 0.06, uv.y);
  f = clamp(f * 1.7, 0.0, 1.0);
  vec3 col = mix(vec3(0.9, 0.12, 0.015), vec3(2.0, 0.75, 0.13), smoothstep(0.15, 0.6, f));
  col = mix(col, vec3(2.3, 1.6, 0.75), smoothstep(0.8, 1.0, f));
  gl_FragColor = vec4(col * uGain, f * 0.75);
}`,
});
const FIRE = { light: null, intensity: 2.6, flick: 1, n: 0, mats: [], world: new THREE.Vector3() };
function buildFireplace(c) {
  const F = ROOM.fire, grp = new THREE.Group(); grp.name = 'extra.fireplace';
  grp.position.set(F.x, 0, F.z); grp.rotation.y = Math.PI / 2;   // local +z = into the room (+x), local x runs along the wall (world -z)
  const r = rng(4242);
  const W = 3.0, D = 0.62, Hc = ROOM.h, oW = 2.0, hearthT = 0.18, oH = 1.95, mY = F.mantelY;
  // fieldstone chimney breast: two piers beside the opening and the breast above it (texture runs on across the parts)
  const sTex = stoneTex(); sTex.repeat.set(1, 1);
  const stoneM = std({ map: sTex, roughness: 0.92, envMapIntensity: 0.25 });
  const sp = [boxG((W - oW) / 2, oH, D, -(oW + W) / 4, hearthT + oH / 2, D / 2), boxG((W - oW) / 2, oH, D, (oW + W) / 4, hearthT + oH / 2, D / 2), boxG(W, Hc - hearthT - oH, D, 0, hearthT + oH + (Hc - hearthT - oH) / 2, D / 2)];
  grp.add(meshOf(sp.map(g => worldUV(g, 2.2)), stoneM));
  // raised flagstone hearth
  const hTex = stoneTex(); const hearthM = std({ map: hTex, color: lin(0.62, 0.6, 0.58), roughness: 0.8, envMapIntensity: 0.35 });
  grp.add(meshOf([worldUV(boxG(F.w, hearthT, F.hearth, 0, hearthT / 2, F.hearth / 2), 1.6)], hearthM));
  // firebox: sooty firebrick, splayed sides, warm glow from below (emissive, flickered)
  const brick = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#140d0a'; g.fillRect(0, 0, w, h); const bh = 32, bw = 96;
    for (let y = 0, k = 0; y < h; y += bh, k++) for (let x = -(k % 2) * bw / 2; x < w; x += bw) { const l = 20 + Math.random() * 18; g.fillStyle = `hsl(${12 + Math.random() * 8}, 40%, ${l * (0.35 + 0.65 * y / h)}%)`; g.fillRect(x + 3, y + 3, bw - 6, bh - 6); }
    const sg = g.createLinearGradient(0, 0, 0, h); sg.addColorStop(0, 'rgba(0,0,0,.92)'); sg.addColorStop(0.7, 'rgba(0,0,0,.35)'); sg.addColorStop(1, 'rgba(0,0,0,.1)'); g.fillStyle = sg; g.fillRect(0, 0, w, h); });
  const glow = canvasTex(64, 256, (g, w, h) => { const gg = g.createLinearGradient(0, h, 0, 0); gg.addColorStop(0, '#ff9a40'); gg.addColorStop(0.35, '#7a3010'); gg.addColorStop(1, '#000'); g.fillStyle = gg; g.fillRect(0, 0, w, h); }, { clamp: true });
  const fbM = std({ map: brick, emissiveMap: glow, emissive: lin(1, 0.45, 0.15), emissiveIntensity: 0.55, roughness: 0.95, side: THREE.DoubleSide, envMapIntensity: 0.05 }); FIRE.mats.push([fbM, 0.55]);
  const bk = 0.06, bW = 1.36, top = hearthT + oH, quad = (a, b, cc, d) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...cc, ...a, ...cc, ...d], 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2)); g.computeVertexNormals(); return g; };
  const fb = [quad([-bW / 2, hearthT, bk], [bW / 2, hearthT, bk], [bW / 2, top - 0.3, bk], [-bW / 2, top - 0.3, bk]),                 // back
    quad([-bW / 2, top - 0.3, bk], [bW / 2, top - 0.3, bk], [oW / 2, top, D], [-oW / 2, top, D]),                                    // smoke shelf / top, sloping forward
    quad([-oW / 2, hearthT, D], [-bW / 2, hearthT, bk], [-bW / 2, top - 0.3, bk], [-oW / 2, top, D]),                                 // left splay
    quad([bW / 2, hearthT, bk], [oW / 2, hearthT, D], [oW / 2, top, D], [bW / 2, top - 0.3, bk])];                                    // right splay
  grp.add(meshOf(fb, fbM));
  // ember bed and grate
  const ember = canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#1a1210'; g.fillRect(0, 0, w, h); noise(g, w, h, 2200, 0.5, ['#3a2a22', '#0c0806', '#55443a']);
    for (let i = 0; i < 260; i++) { const x = w * (0.15 + Math.random() * 0.7), y = h * (0.2 + Math.random() * 0.6), s = 1 + Math.random() * 3.5; g.fillStyle = `rgba(255,${80 + Math.random() * 110},20,${0.4 + Math.random() * 0.6})`; g.beginPath(); g.arc(x, y, s, 0, 7); g.fill(); } });
  const emberM = new THREE.MeshBasicMaterial({ map: ember, color: lin(1.6, 1.2, 1.0) }); FIRE.mats.push([emberM, 1.6, 'color']);
  const eb = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.48), emberM); eb.rotation.x = -Math.PI / 2; eb.position.set(0, hearthT + 0.004, 0.33); grp.add(eb);
  const iron = std({ color: 0x141414, metalness: 0.7, roughness: 0.55, envMapIntensity: 0.4 });
  const grate = []; for (let i = 0; i < 6; i++) grate.push(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6).rotateX(Math.PI / 2).translate(-0.5 + i * 0.2, hearthT + 0.12, 0.34));
  [-0.55, 0.55].forEach(x => { grate.push(new THREE.CylinderGeometry(0.014, 0.014, 0.12, 6).translate(x, hearthT + 0.06, 0.16)); grate.push(new THREE.CylinderGeometry(0.014, 0.014, 0.12, 6).translate(x, hearthT + 0.06, 0.52)); });
  grate.push(new THREE.CylinderGeometry(0.014, 0.014, 1.1, 6).rotateZ(Math.PI / 2).translate(0, hearthT + 0.12, 0.12)); grate.push(new THREE.CylinderGeometry(0.014, 0.014, 1.1, 6).rotateZ(Math.PI / 2).translate(0, hearthT + 0.12, 0.56));
  grp.add(meshOf(grate, iron));
  // three logs (charred bark with glowing cracks, end grain on the cut faces)
  const barkMap = grainTex(256, 256, ['#2a1c14', '#1a110c', '#3b2a1e'], { streaks: 200, along: 'y', knots: 4 });
  const crack = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); for (let i = 0; i < 26; i++) { g.strokeStyle = `rgba(255,${90 + Math.random() * 90},30,${0.5 + Math.random() * 0.5})`; g.lineWidth = 1 + Math.random() * 2.5; g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 30; y += 8 + Math.random() * 18; g.lineTo(x, y); } g.stroke(); }
  });
  const logM = std({ map: barkMap, emissiveMap: crack, emissive: lin(1, 0.38, 0.08), emissiveIntensity: 1.6, roughness: 0.95, envMapIntensity: 0.1 }); FIRE.mats.push([logM, 1.6]);
  const capM = std({ map: endGrainTex('#3a2618', '#140c08'), roughness: 0.9, envMapIntensity: 0.1 });
  [[-0.2, hearthT + 0.25, 0.36, 0.13, 1.25, 0.32, 0.12], [0.22, hearthT + 0.25, 0.32, 0.12, 1.2, -0.28, -0.1], [0.0, hearthT + 0.43, 0.38, 0.11, 1.1, 0.06, 0.05]].forEach(([x, y, z, rr, L, ry, rz]) => {
    const lg = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr * 1.06, L, 14, 1), [logM, capM, capM]); lg.rotation.set(0, ry, Math.PI / 2 + rz); lg.position.set(x, y, z); grp.add(lg); });
  // the flames: 3 pairs of crossed planes with the scrolling-noise shader (never edge-on from any orbit angle)
  const fl = [], seeds = [];
  [[-0.38, 0.62, 0.85, 0.3], [0.0, 0.78, 1.15, 0.38], [0.38, 0.6, 0.8, 0.28]].forEach(([x, w, h, z], i) => [Math.PI / 4, -Math.PI / 4].forEach((a, k) => {
    const q = new THREE.PlaneGeometry(w, h); q.translate(0, h / 2, 0); q.rotateY(a); q.translate(x, hearthT + 0.2, z); fl.push(q); seeds.push(...Array(q.attributes.position.count).fill(i * 1.7 + k * 0.63)); }));
  const fg = mergeGeometries(fl); fg.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
  const flames = new THREE.Mesh(fg, FIRE_MAT); flames.renderOrder = 6; flames.frustumCulled = false; grp.add(flames);
  // oak mantel beam on two corbels
  const oak = grainTex(1024, 256, ['#6a4426', '#4e301a', '#7a5130'], { streaks: 320, along: 'x', knots: 5 });
  const oakM = std({ map: oak, roughness: 0.62, envMapIntensity: 0.35 });
  const mH = 0.45, mD = 0.6, mW = 3.45;
  grp.add(meshOf([worldUV(boxG(mW, mH, mD, 0, mY - mH / 2, D + mD / 2 - 0.08), 1.8), worldUV(boxG(0.22, 0.42, 0.42, -1.25, mY - mH - 0.21, D + 0.17), 1.8), worldUV(boxG(0.22, 0.42, 0.42, 1.25, mY - mH - 0.21, D + 0.17), 1.8)], oakM, { cast: false }));
  const mFront = D + mD - 0.08;   // mantel front face (local z)
  // garland on the mantel: lying along the shelf, two swags over the front, ends trailing down the sides
  const G = greenery(91), P = new THREE.Vector3(), Dd = new THREE.Vector3();
  const pathPts = [new THREE.Vector3(-1.82, mY - 0.75, mFront + 0.05), new THREE.Vector3(-1.8, mY - 0.25, mFront + 0.06), new THREE.Vector3(-1.72, mY + 0.03, mFront - 0.02),
    new THREE.Vector3(-0.86, mY - 0.34, mFront + 0.1), new THREE.Vector3(0, mY + 0.03, mFront), new THREE.Vector3(0.86, mY - 0.34, mFront + 0.1),
    new THREE.Vector3(1.72, mY + 0.03, mFront - 0.02), new THREE.Vector3(1.8, mY - 0.25, mFront + 0.06), new THREE.Vector3(1.82, mY - 0.75, mFront + 0.05)];
  const path = new THREE.CatmullRomCurve3(pathPts, false, 'catmullrom', 0.3), nG = LQ ? 200 : 330;
  for (let i = 0; i < nG; i++) {
    const u = (i + r()) / nG; path.getPointAt(u, P); const T = path.getTangentAt(u);
    const side = new THREE.Vector3(r() - 0.5, r() - 0.5, r() * 0.8).normalize();
    Dd.copy(T).multiplyScalar(r() < 0.5 ? 1 : -1).addScaledVector(side, 1.1).normalize();
    G.sprig(P.clone().addScaledVector(side, 0.04), Dd, 0.85 + r() * 0.45);
  }
  for (let i = 0; i < 22; i++) { path.getPointAt((i + 0.5) / 22, P); for (let k = 0; k < 3; k++) G.berry(P.clone().add(new THREE.Vector3((r() - 0.5) * 0.07, (r() - 0.5) * 0.07, 0.06 + r() * 0.03)), 0.9 + r() * 0.4); }
  for (let i = 0; i < 9; i++) { path.getPointAt((i + 0.3) / 9, P); G.bauble(P.clone().add(new THREE.Vector3(0, -0.02, 0.08)), 0.9); }
  for (let i = 0; i < 6; i++) { path.getPointAt((i + 0.75) / 6.5, P); G.cone(P.clone().add(new THREE.Vector3(0, -0.03, 0.07)), new THREE.Vector3(r() - 0.5, -1, 0.5), 1.4); }
  // wreath on the stone above the mantel
  const WR = new THREE.Vector3(0, mY + 1.45, D + 0.06);
  const GW = greenery(57); wreath(GW, 0.46, LQ ? 160 : 260);
  const wg = GW.build(); wg.position.copy(WR); grp.add(wg);
  grp.add(G.build());
  // tartan bows: the garland's swag joints and the wreath's foot
  const bow = (sz, x, y, z, s = 1) => { const b = new THREE.Mesh(bowGeo({ ribbon: 2.5 * sz, span: 8 * sz, tail: 7 * sz, loops: 2, seed: 7 + x * 10 }), tartanBowMat()); b.position.set(x, y, z); b.scale.setScalar(s); grp.add(b); return b; };
  bow(1, 0, mY - 0.02, mFront + 0.12); bow(0.8, -1.72, mY - 0.02, mFront + 0.06); bow(0.8, 1.72, mY - 0.02, mFront + 0.06);
  bow(1.35, 0, WR.y - 0.46, WR.z + 0.12);
  // three mini pet stockings with paw-print appliqués, hung on brass hooks under the shelf
  const stockShape = (() => { const s = new THREE.Shape(); s.moveTo(-0.16, 0); s.lineTo(0.16, 0); s.lineTo(0.165, -0.45); s.quadraticCurveTo(0.18, -0.55, 0.3, -0.57); s.quadraticCurveTo(0.45, -0.6, 0.45, -0.69);
    s.quadraticCurveTo(0.44, -0.79, 0.3, -0.79); s.lineTo(-0.02, -0.79); s.quadraticCurveTo(-0.19, -0.79, -0.18, -0.63); s.lineTo(-0.16, 0); return s; })();
  const ext = (shape, depth, bevel = 0.018) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 18 });
  const bodyG = ext(stockShape, 0.06); const cuffS = new THREE.Shape(); cuffS.moveTo(-0.2, -0.17); cuffS.lineTo(0.2, -0.17); cuffS.lineTo(0.2, 0.02); cuffS.lineTo(-0.2, 0.02); cuffS.closePath(); const cuffG = ext(cuffS, 0.07, 0.04);
  const pawG = new THREE.ExtrudeGeometry(pawShapes(0.17), { depth: 0.008, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 12 });
  const cream = feltMat(0xefe3c8), red = feltMat(0x8e1a22);
  const tartanBody = std({ map: tartan(2.4), color: lin(1.3, 1.18, 1.18), roughness: 0.85, envMapIntensity: 0.3 });
  const sherpa = std({ map: sherpaTex(), roughness: 1, envMapIntensity: 0.2 });
  const kits = [
    { x: -1.05, body: std({ map: knitTex('#ece0c4', '#c9b894', '#fffaf0'), roughness: 0.95, envMapIntensity: 0.25 }), cuff: std({ map: tartan(2.4), color: lin(1.3, 1.18, 1.18), roughness: 0.85, envMapIntensity: 0.3 }), paw: red, flip: 1 },
    { x: 0.0, body: std({ map: knitTex('#8a1820', '#5e0e14', '#b0303a'), roughness: 0.95, envMapIntensity: 0.25 }), cuff: sherpa, paw: cream, flip: 1 },
    { x: 1.05, body: tartanBody, cuff: sherpa, paw: cream, flip: 1 },
  ];
  const brass = std({ color: 0xc89b4a, metalness: 1, roughness: 0.3, envMapIntensity: 1 });
  const hooks = [];
  kits.forEach((k, i) => {
    const sg = new THREE.Group(); sg.position.set(k.x, mY - mH - 0.06, mFront + 0.02); sg.rotation.z = (r() - 0.5) * 0.06; grp.add(sg);
    const b = new THREE.Mesh(bodyG, k.body); b.position.set(0, -0.06, 0); sg.add(b);
    const cf = new THREE.Mesh(cuffG, k.cuff); cf.position.set(0, -0.06, -0.012); sg.add(cf);
    const pw = new THREE.Mesh(pawG, k.paw); pw.position.set(0.0, -0.40, 0.06 + 0.02 + 0.004); pw.rotation.z = 0.12 * (i - 1); sg.add(pw);
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 6, 16), k.paw === red ? red : cream); loop.position.set(-0.13, -0.02, 0.05); sg.add(loop);
    hooks.push(new THREE.CylinderGeometry(0.01, 0.01, 0.07, 6).rotateX(Math.PI / 2).translate(k.x - 0.13, mY - mH + 0.0, mFront + 0.03), new THREE.TorusGeometry(0.022, 0.006, 6, 12, Math.PI).rotateZ(Math.PI).translate(k.x - 0.13, mY - mH - 0.02, mFront + 0.065));
  });
  grp.add(meshOf(hooks, brass));
  // "Dear Santa Paws" tent card and a pair of brass candlesticks with cream tapers (unlit) on the shelf
  const card = canvasTex(512, 360, (g, w, h) => { g.fillStyle = '#f3ead6'; g.fillRect(0, 0, w, h); g.strokeStyle = '#b8893a'; g.lineWidth = 8; g.strokeRect(16, 16, w - 32, h - 32); g.lineWidth = 2; g.strokeRect(30, 30, w - 60, h - 60);
    fitText(g, 'Dear Santa Paws,', w / 2, h * 0.38, w - 90, 'italic 700 #px Georgia, "Times New Roman", serif', 62, '#8e1a22');
    fitText(g, 'we have been very good this year', w / 2, h * 0.6, w - 110, 'italic #px Georgia, serif', 28, '#5a3a22');
    drawPaw(g, w / 2, h * 0.8, 46, '#1f3a26'); }, { clamp: true });
  const cardM = std({ map: card, roughness: 0.85, side: THREE.DoubleSide, envMapIntensity: 0.2 });
  const cg = new THREE.Group(); cg.position.set(1.08, mY, D + 0.3); cg.rotation.y = -0.3; grp.add(cg);
  [[1, 0.17], [-1, -0.17]].forEach(([s, a]) => { const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.32), s > 0 ? cardM : std({ color: 0xf3ead6, roughness: 0.85, side: THREE.DoubleSide })); pl.position.set(0, 0.155, s * 0.028); pl.rotation.x = -a; if (s < 0) pl.rotation.y = Math.PI; cg.add(pl); });
  const stick = [], wax = [];
  [-1.3, -0.98].forEach((x, i) => { const h = i ? 0.42 : 0.5; stick.push(new THREE.LatheGeometry([[0.001, 0], [0.07, 0], [0.07, 0.02], [0.03, 0.05], [0.022, 0.12], [0.035, 0.15], [0.02, 0.2], [0.02, 0.26], [0.04, 0.28], [0.04, 0.3], [0.001, 0.3]].map(([a, b]) => new THREE.Vector2(a, b * (h / 0.5))), 16).translate(x, mY, D + 0.25));
    wax.push(new THREE.CylinderGeometry(0.018, 0.022, 0.42, 12).translate(x, mY + 0.3 * (h / 0.5) + 0.21, D + 0.25)); });
  grp.add(meshOf(stick, brass)); grp.add(meshOf(wax, std({ color: 0xf1e3c8, roughness: 0.55, envMapIntensity: 0.3 })));
  // on the hearth: an iron tool stand and a few split logs
  const tools = [new THREE.CylinderGeometry(0.1, 0.12, 0.03, 12).translate(0, 0.015, 0), new THREE.CylinderGeometry(0.012, 0.012, 0.9, 6).translate(0, 0.45, 0), new THREE.TorusGeometry(0.05, 0.01, 6, 14).translate(0, 0.92, 0)];
  [-0.05, 0, 0.05].forEach((dx, i) => { tools.push(new THREE.CylinderGeometry(0.008, 0.008, 0.72, 6).translate(dx, 0.42, 0.04)); tools.push(new THREE.BoxGeometry(i === 1 ? 0.07 : 0.03, 0.09, 0.012).translate(dx, 0.07, 0.04)); });
  const tm = meshOf(tools, iron); tm.position.set(1.48, hearthT, 0.82); grp.add(tm);
  const split = new THREE.CylinderGeometry(0.075, 0.075, 0.55, 5);
  const wood = new THREE.InstancedMesh(split, [std({ map: grainTex(128, 128, ['#4a3020', '#2e1e14'], { along: 'y' }), roughness: 0.9 }), std({ map: endGrainTex(), roughness: 0.9 }), std({ map: endGrainTex(), roughness: 0.9 })], 6);
  const dd = new THREE.Object3D(); [[0, 0], [0.15, 0], [0.3, 0], [0.075, 1], [0.225, 1], [0.15, 2]].forEach(([x, row], i) => { dd.position.set(-1.62 + x, hearthT + 0.075 + row * 0.13, 0.84); dd.rotation.set(Math.PI / 2, 0, r() * 1.2); dd.updateMatrix(); wood.setMatrixAt(i, dd.matrix); });
  wood.receiveShadow = true; grp.add(wood);
  // hide with the left wall in the dollhouse cut-away
  (ROOM.groups.left || extrasGroup).add(grp);
  grp.updateMatrixWorld(true); FIRE.world.set(0, 1.05, D + 1.0).applyMatrix4(grp.matrixWorld);
  return grp;
}
registerExtra({
  id: 'fireplace', label: 'Fireplace & mini stockings', kind: 'setting', default: true, rooms: ['living'],
  build: buildFireplace,
  setOn(on, c) {
    if (on) { const L = FIRE.light = c.claimAccent(1, 'fireplace'); L.color.set(0xff8a3d); L.position.copy(FIRE.world); L.distance = 8; L.intensity = FIRE.intensity; }
    else if (FIRE.light) { FIRE.light.distance = 3; FIRE.light = null; c.releaseAccent(1, 'fireplace'); }
  },
  tick(t, dt, c) {
    const L = FIRE.light; if (!L) return;
    FIRE_MAT.uniforms.uTime.value = RM ? 4.2 : t;
    // a smoothed random walk on top of two sines: no strobing
    FIRE.n += ((Math.random() - 0.5) - FIRE.n) * Math.min(1, dt * 9);
    const f = RM ? 1 : 1 + 0.17 * (Math.sin(7.1 * t) + Math.sin(12.9 * t + 1)) * 0.5 + 0.22 * FIRE.n;
    const vis = this.obj && isShown(this.obj.parent || this.obj) ? 1 : 0.55;   // still glows on the room when the wall is cut away
    L.intensity = FIRE.intensity * f * vis;
    FIRE_MAT.uniforms.uGain.value = 0.9 + 0.12 * (f - 1) * 3;
    FIRE.mats.forEach(([m, b, k]) => { if (k === 'color') m.color.setRGB(b * f, b * 0.75 * f, b * 0.62 * f); else m.emissiveIntensity = b * f; });
  },
});

/* ================================================================
   3. Setting: Northern-lights forest
   ================================================================ */
const FOREST = { sky: null, snow: null, spruces: null, moon: new THREE.Vector3(-0.42, 0.24, -0.88).normalize() };
function forestEnv() {
  if (ENV.forest) return ENV.forest;
  const t = canvasTex(1024, 512, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h / 2); sky.addColorStop(0, '#050b1c'); sky.addColorStop(0.75, '#0f2a3a'); sky.addColorStop(1, '#1d3d4a'); g.fillStyle = sky; g.fillRect(0, 0, w, h / 2);
    for (let i = 0; i < 14; i++) { const x = Math.random() * w, ag = g.createRadialGradient(x, h * 0.36, 0, x, h * 0.36, 90); ag.addColorStop(0, 'rgba(60,255,150,.55)'); ag.addColorStop(1, 'rgba(60,255,150,0)'); g.fillStyle = ag; g.fillRect(x - 90, h * 0.22, 180, h * 0.25); }
    const gr = g.createLinearGradient(0, h / 2, 0, h); gr.addColorStop(0, '#9fb1c9'); gr.addColorStop(0.3, '#7d8fab'); gr.addColorStop(1, '#43506a'); g.fillStyle = gr; g.fillRect(0, h / 2, w, h / 2);
    g.fillStyle = '#0b1a14'; for (let i = 0; i < 60; i++) { const x = Math.random() * w, th = 14 + Math.random() * 30; g.beginPath(); g.moveTo(x - th * 0.3, h / 2 + 2); g.lineTo(x, h / 2 - th); g.lineTo(x + th * 0.3, h / 2 + 2); g.fill(); }
  });
  t.mapping = THREE.EquirectangularReflectionMapping;
  return (ENV.forest = pmremGen.fromEquirectangular(t).texture);
}
function buildForest(c) {
  const g = new THREE.Group(); g.name = 'room.forest';
  FOREST.sky = makeSky(0, FOREST.moon); g.add(FOREST.sky);
  g.add(snowGround(0));
  g.add(snowMound(2.5, 0.13));
  FOREST.spruces = spruceRing({ seed: 11, n: LQ ? 70 : 140, rMin: 16.5, rMax: 42, behind: { r0: 27, r1: 42, h0: 6, h1: 11 }, haze: lin(0.012, 0.03, 0.05), yAt: driftH });
  g.add(FOREST.spruces);
  // a few snowy boulders and a log bench, all outside the display (r >= 4.5) and clear of the home-view line of sight
  const rocks = [];
  [[-6.5, -5.5, 0.55, 3], [-7.8, -4.2, 0.35, 4], [7.2, -6.0, 0.6, 5], [8.6, -3.2, 0.3, 6], [-9.5, 2.5, 0.45, 7], [10.2, 3.5, 0.5, 8]].forEach(([x, z, s, sd]) => rocks.push(snowyRock(sd, s).translate(x, driftH(x, z) + s * 0.05, z)));
  g.add(meshOf(rocks, std({ vertexColors: true, roughness: 0.9, envMapIntensity: 0.3 }), { cast: true }));
  { // log bench: a split-log seat on two stumps, with a cap of snow on the far end
    const bench = new THREE.Group(); bench.position.set(-5.4, 0, 0.9); bench.rotation.y = 0.45;
    const bark = std({ map: grainTex(256, 256, ['#7a5a40', '#5a3e2a', '#8c6a4c'], { along: 'y' }), roughness: 0.95, envMapIntensity: 0.3 });
    const ends = std({ map: endGrainTex('#b98c5a', '#3a2414'), roughness: 0.85 });
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 2.6, 18, 1, false, Math.PI / 2, Math.PI).rotateX(-Math.PI / 2).rotateY(Math.PI / 2), [bark, ends, ends]); seat.position.y = 1.18; seat.castShadow = true; bench.add(seat);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.48), std({ map: grainTex(512, 128, ['#a77b4e', '#8a6038'], { along: 'x' }), roughness: 0.8 })); top.rotation.x = -Math.PI / 2; top.position.y = 1.18 + 0.001; bench.add(top);
    [-0.85, 0.85].forEach(x => { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 1.0, 16), [bark, ends, ends]); s.position.set(x, 0.5, 0); s.castShadow = true; bench.add(s); });
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 10, 0, 6.29, 0, Math.PI / 2), snowMat()); cap.scale.set(1.1, 0.25, 0.8); cap.position.set(1.0, 1.2, 0); bench.add(cap);
    bench.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
    g.add(bench);
  }
  FOREST.snow = snowPoints({ n: LQ ? 800 : 2500, seed: 5, size: 0.05, cull: 1, yb: 0, H: 12, speed: [0.45, 0.95], color: [0.78, 0.85, 1.0], gen: ringGen(0.5, 16, 0, 12) });
  g.add(FOREST.snow);
  return g;
}
registerRoom({
  id: 'forest', label: 'Northern-lights forest', order: 50, maxDist: 14.5, build: buildForest,
  look: { env: forestEnv, bg: 0x03070f, hemi: [0x8fa8e8, 0xc8d6f0, 0.42], key: { color: 0xffd2a0, intensity: 38, angle: 0.6, penumbra: 1, decay: 2, pos: [1.6, 9, 5.5], target: [0, 2.6, 0] }, rim: [0xa8bcff, 0.75],
    base: [0xffb070, 2.6], interior: 1, accent: [[0xff9a40, 0], [0xff9a40, 0]], exp: 1.05, bloom: 0.85, warm: 0.25,
    day: { hemi: 1.1, key: 0.6, rim: 0.9, exp: 1.12 } },
  setMode(mode) { const day = mode === 'off' ? 1 : 0; if (FOREST.sky) FOREST.sky.material.uniforms.uDay.value = day; if (day) { hemi.color.set(0xdfe6f2); hemi.groundColor.set(0xe6ecf4); } if (FOREST.spruces) FOREST.spruces.userData.mat.userData.uHaze.value.setRGB(...(day ? [0.5, 0.56, 0.66] : [0.012, 0.03, 0.05])); },
  tick(t) { if (FOREST.sky) FOREST.sky.material.uniforms.uTime.value = RM ? t * 0.2 : t; if (FOREST.snow) FOREST.snow.userData.tick(t); },
});

/* ================================================================
   4. Setting: Snowy cabin porch at blue hour (my third setting)
      A log-cabin porch: honey-stained log wall with a glowing window and a red plank door
      with a wreath, a porch roof with snow and icicles, a rocking chair with a patchwork
      paw quilt, a leaning sled, a lantern, a firewood stack, a paw-print doormat and a
      window box; beyond it a snowy yard, spruces past the orbit and a twilight sky.
      Walls/rails/roof hide when the camera is outside them (dollhouse cut-away).
   ================================================================ */
const PORCH = { x0: -6.0, x1: 6.0, zWall: -3.6, zFront: 5.4, roofY: 7.34, groundY: -0.9, postX: 5.8, postZ: 5.05,
  win: { x0: -4.3, x1: -1.7, y0: 2.25, y1: 5.55 }, door: { x0: 2.05, x1: 4.55, y0: 0, y1: 5.9 },
  sky: null, snow: null, spruces: null, cut: [], flame: null, moon: new THREE.Vector3(-0.62, 0.36, -0.7).normalize() };
function porchEnv() {
  if (ENV.porch) return ENV.porch;
  const t = canvasTex(1024, 512, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h / 2); sky.addColorStop(0, '#0a1430'); sky.addColorStop(0.7, '#2a3560'); sky.addColorStop(1, '#6a5a78'); g.fillStyle = sky; g.fillRect(0, 0, w, h / 2);
    const sun = g.createRadialGradient(w * 0.15, h / 2, 0, w * 0.15, h / 2, 200); sun.addColorStop(0, 'rgba(255,150,90,.6)'); sun.addColorStop(1, 'rgba(255,150,90,0)'); g.fillStyle = sun; g.fillRect(0, 0, w, h / 2);
    g.fillStyle = '#5a3a22'; g.fillRect(w * 0.65, h * 0.18, w * 0.2, h * 0.36);   // the log wall behind
    const wg = g.createRadialGradient(w * 0.72, h * 0.35, 0, w * 0.72, h * 0.35, 40); wg.addColorStop(0, 'rgba(255,200,120,1)'); wg.addColorStop(1, 'rgba(255,170,80,0)'); g.fillStyle = wg; g.fillRect(w * 0.66, h * 0.25, 80, 80);
    const gr = g.createLinearGradient(0, h / 2, 0, h); gr.addColorStop(0, '#8d97b3'); gr.addColorStop(1, '#3a3f55'); g.fillStyle = gr; g.fillRect(0, h / 2, w, h / 2);
    g.fillStyle = '#4a3424'; g.fillRect(0, h * 0.62, w, h * 0.38);   // deck boards below
  });
  t.mapping = THREE.EquirectangularReflectionMapping;
  return (ENV.porch = pmremGen.fromEquirectangular(t).texture);
}
function quiltTex() {   // patchwork in the board palette: tartan-ish plaid, cream with red paws, kraft with cream dots, deep red, green; cream stitching, red binding
  return canvasTex(768, 1024, (g, w, h) => {
    const cols = 4, rows = 6, cw = w / cols, ch = h / rows;
    const plaid = (x, y) => { g.fillStyle = '#8e1a22'; g.fillRect(x, y, cw, ch); g.globalAlpha = 0.5; g.fillStyle = '#1f3a26'; for (let k = 0; k < cw; k += 48) { g.fillRect(x + k + 8, y, 16, ch); } for (let k = 0; k < ch; k += 48) g.fillRect(x, y + k + 8, cw, 16); g.globalAlpha = 0.6; g.fillStyle = '#e9dcbf'; for (let k = 0; k < cw; k += 48) g.fillRect(x + k + 30, y, 3, ch); for (let k = 0; k < ch; k += 48) g.fillRect(x, y + k + 30, cw, 3); g.globalAlpha = 1; };
    const types = ['plaid', 'paw', 'kraft', 'red', 'paw2', 'green'];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = c * cw, y = r * ch, t = types[(r * 2 + c * 3 + (r % 2)) % types.length];
      if (t === 'plaid') plaid(x, y);
      else if (t === 'paw' || t === 'paw2') { g.fillStyle = '#efe4cc'; g.fillRect(x, y, cw, ch); noise(g, w, h, 0, 0, ['#000']); drawPaw(g, x + cw / 2, y + ch / 2, cw * 0.42, t === 'paw' ? '#8e1a22' : '#1f3a26', (r - c) * 0.2); }
      else if (t === 'kraft') { g.fillStyle = '#b48a5a'; g.fillRect(x, y, cw, ch); g.fillStyle = '#efe4cc'; for (let i = 0; i < 26; i++) { g.beginPath(); g.arc(x + 12 + ((i * 37) % (cw - 24)), y + 12 + ((i * 53) % (ch - 24)), 4, 0, 7); g.fill(); } }
      else if (t === 'red') { g.fillStyle = '#7b141c'; g.fillRect(x, y, cw, ch); g.strokeStyle = 'rgba(255,230,200,.25)'; g.lineWidth = 2; for (let k = -ch; k < cw; k += 22) { g.beginPath(); g.moveTo(x + k, y); g.lineTo(x + k + ch, y + ch); g.stroke(); } }
      else { g.fillStyle = '#21402b'; g.fillRect(x, y, cw, ch); }
      g.setLineDash([9, 7]); g.strokeStyle = 'rgba(245,236,214,.85)'; g.lineWidth = 2.5; g.strokeRect(x + 7, y + 7, cw - 14, ch - 14); g.setLineDash([]);
      g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2; g.strokeRect(x, y, cw, ch);
    }
    noise(g, w, h, 12000, 0.12, ['#000000', '#ffffff']);
    g.strokeStyle = '#7b141c'; g.lineWidth = 22; g.strokeRect(0, 0, w, h);
  });
}
function rockingChair() {
  const ch = new THREE.Group();
  const woodM = std({ map: grainTex(256, 512, ['#3e2416', '#2a170d', '#4d2e1c'], { along: 'y', streaks: 180 }), roughness: 0.55, envMapIntensity: 0.45 });
  const parts = [];
  // rockers: curved boards along z
  [-0.6, 0.6].forEach(x => { const s = new THREE.Shape(), N = 24, L = 1.05; for (let i = 0; i <= N; i++) { const z = -L + 2 * L * i / N; if (i) s.lineTo(z, 0.17 * (z / L) ** 2); else s.moveTo(z, 0.17); } for (let i = N; i >= 0; i--) { const z = -L + 2 * L * i / N; s.lineTo(z, 0.17 * (z / L) ** 2 + 0.09); }
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: false }); g.translate(0, 0, -0.035); g.rotateY(-Math.PI / 2); g.translate(x, 0, 0); parts.push(g); });
  const leg = (x, z, y0, y1, r = 0.045, tilt = 0) => parts.push(new THREE.CylinderGeometry(r, r * 1.05, y1 - y0, 10).translate(0, (y1 - y0) / 2, 0).rotateX(tilt).translate(x, y0, z));
  [-0.6, 0.6].forEach(x => { leg(x, 0.5, 0.12, 1.22); leg(x, -0.40, 0.12, 2.92, 0.05, -0.13); leg(x, 0.52, 1.22, 1.85, 0.035); });
  parts.push(boxG(1.32, 0.08, 1.15, 0, 1.22, 0.02));                         // seat
  [-0.62, 0.62].forEach(x => parts.push(boxG(0.1, 0.06, 1.2, x, 1.88, 0.08)));   // arms
  for (let i = 0; i < 5; i++) parts.push(new THREE.CylinderGeometry(0.022, 0.022, 1.5, 8).translate(0, 0.75, 0).rotateX(-0.16).translate(-0.4 + i * 0.2, 1.28, -0.52));   // spindles
  parts.push(new THREE.BoxGeometry(1.32, 0.2, 0.08).rotateX(-0.16).translate(0, 2.82, -0.74));   // top rail
  [0.35, 0.55].forEach(y => parts.push(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 8).rotateZ(Math.PI / 2).translate(0, y + 0.08, y === 0.35 ? 0.5 : -0.45)));
  const wm = meshOf(parts.map(p => p.index ? p.toNonIndexed() : p), woodM, { cast: true }); ch.add(wm);
  // the quilt: draped over the top rail, down the back, across the seat and over the front edge
  const path = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 2.35, -1.02), new THREE.Vector3(0, 2.9, -0.9), new THREE.Vector3(0, 2.97, -0.72), new THREE.Vector3(0, 2.3, -0.6), new THREE.Vector3(0, 1.6, -0.47), new THREE.Vector3(0, 1.32, -0.3), new THREE.Vector3(0, 1.31, 0.35), new THREE.Vector3(0, 1.25, 0.64), new THREE.Vector3(0, 0.95, 0.72), new THREE.Vector3(0, 0.62, 0.74)], false, 'catmullrom', 0.4);
  const NU = 18, NV = 60, Wq = 1.04, pos = [], uv = [], idx = [], T = new THREE.Vector3(), Pp = new THREE.Vector3(), Nn = new THREE.Vector3(), X = new THREE.Vector3(1, 0, 0);
  for (let j = 0; j <= NV; j++) { const v = j / NV; path.getPointAt(v, Pp); path.getTangentAt(v, T); Nn.crossVectors(X, T).normalize();
    for (let i = 0; i <= NU; i++) { const u = i / NU, x = (u - 0.5) * Wq * (1 + 0.06 * Math.sin(v * 9)); const fold = 0.035 * Math.sin(u * 15 + v * 4) * (0.4 + 0.6 * Math.abs(u - 0.5) * 2) + (Math.abs(u - 0.5) > 0.45 ? -0.03 : 0);
      pos.push(x, Pp.y + Nn.y * fold - (v > 0.75 ? Math.abs(u - 0.5) * 0.18 * (v - 0.75) * 4 : 0), Pp.z + Nn.z * fold); uv.push(u, 1 - v); } }
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const a = j * (NU + 1) + i, b = a + NU + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const qg = new THREE.BufferGeometry(); qg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); qg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); qg.setIndex(idx); qg.computeVertexNormals();
  const quilt = new THREE.Mesh(qg, std({ map: quiltTex(), roughness: 0.92, side: THREE.DoubleSide, envMapIntensity: 0.25 })); quilt.castShadow = true; quilt.receiveShadow = true; ch.add(quilt);
  return ch;
}
function sled() {
  const s = new THREE.Group();
  const slatM = std({ map: grainTex(128, 512, ['#b98a55', '#9a6c3c', '#c99a62'], { along: 'y', streaks: 120 }), roughness: 0.6, envMapIntensity: 0.4 });
  const sl = []; for (let i = 0; i < 4; i++) sl.push(boxG(0.17, 2.3, 0.04, -0.3 + i * 0.2, 1.25, 0.12));
  [0.5, 1.4, 2.25].forEach(y => sl.push(boxG(0.82, 0.12, 0.05, 0, y, 0.07)));
  s.add(meshOf(sl, slatM, { cast: true }));
  const runM = std({ color: 0x9a1c1c, metalness: 0.55, roughness: 0.35, envMapIntensity: 0.8 });
  [-0.4, 0.4].forEach(x => { const c = new THREE.CatmullRomCurve3([new THREE.Vector3(x, 0.05, 0), new THREE.Vector3(x, 1.5, 0), new THREE.Vector3(x, 2.45, 0.02), new THREE.Vector3(x, 2.7, 0.16), new THREE.Vector3(x, 2.68, 0.32), new THREE.Vector3(x, 2.52, 0.3), new THREE.Vector3(x, 2.5, 0.18)]);
    const m = new THREE.Mesh(new THREE.TubeGeometry(c, 40, 0.035, 8, false), runM); m.castShadow = true; s.add(m);
    for (let k = 0; k < 3; k++) s.add(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.1, 6).rotateX(Math.PI / 2).translate(x, 0.4 + k * 0.85, 0.05), runM)); });
  const rope = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.38, 2.55, 0.2), new THREE.Vector3(-0.2, 2.2, 0.32), new THREE.Vector3(0.2, 2.15, 0.32), new THREE.Vector3(0.38, 2.55, 0.2)]);
  s.add(new THREE.Mesh(new THREE.TubeGeometry(rope, 24, 0.018, 6, false), std({ color: 0xcdb48a, roughness: 1 })));
  return s;
}
function lantern() {
  const L = new THREE.Group(), blk = std({ color: 0x161412, metalness: 0.6, roughness: 0.45, envMapIntensity: 0.6 }), s = 0.21, H = 0.78;
  const fr = [boxG(0.5, 0.06, 0.5, 0, 0.03, 0), boxG(0.46, 0.04, 0.46, 0, H, 0)];
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => fr.push(boxG(0.035, H, 0.035, a * s, H / 2, b * s)));
  const roof = new THREE.ConeGeometry(0.34, 0.2, 4, 1).rotateY(Math.PI / 4).translate(0, H + 0.12, 0); fr.push(roof); fr.push(new THREE.CylinderGeometry(0.04, 0.04, 0.06, 10).translate(0, H + 0.25, 0));
  L.add(meshOf(fr.map(g => g.index ? g.toNonIndexed() : g), blk, { cast: true }));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 20), blk); ring.position.set(0, H + 0.37, 0); L.add(ring);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(2 * s, H - 0.08, 2 * s), new THREE.MeshPhysicalMaterial({ color: 0xfff4e0, transparent: true, opacity: 0.16, roughness: 0.05, depthWrite: false, envMapIntensity: 1.2 })); glass.position.y = H / 2 + 0.02; glass.renderOrder = 7; L.add(glass);
  const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.3, 18), std({ color: 0xf1e3c8, roughness: 0.55, emissive: 0xff9a40, emissiveIntensity: 0.12 })); candle.position.y = 0.21; L.add(candle);
  const fq = [], sd = []; [0, Math.PI / 2].forEach(a => { const q = new THREE.PlaneGeometry(0.06, 0.15); q.translate(0, 0.15 * 0.25, 0); q.rotateY(a + 0.4); q.translate(0, 0.37, 0); fq.push(q); sd.push(...Array(q.attributes.position.count).fill(2.2)); });
  const fg = mergeGeometries(fq); fg.setAttribute('aSeed', new THREE.Float32BufferAttribute(sd, 1));
  PORCH.flame = FLAME_MAT.clone(); const fl = new THREE.Mesh(fg, PORCH.flame); fl.renderOrder = 8; fl.frustumCulled = false; L.add(fl);
  return L;
}
function buildPorch(c) {
  const P = PORCH, root = new THREE.Group(); root.name = 'room.porch';
  const G = {}; ['deck', 'wall', 'left', 'right', 'roof', 'yard'].forEach(k => { G[k] = new THREE.Group(); G[k].name = 'porch.' + k; root.add(G[k]); });
  P.sky = makeSky(1, P.moon); root.add(P.sky);
  // the yard: snow ground below the deck, spruces past the orbit
  G.yard.add(snowGround(P.groundY, 70, (x, z) => (Math.abs(x) < 7 && z > -6 && z < 6.6 ? 0 : 1)));
  P.spruces = spruceRing({ seed: 23, n: LQ ? 60 : 120, rMin: 17, rMax: 42, behind: { r0: 22, r1: 42, h0: 14, h1: 24 }, haze: lin(0.03, 0.04, 0.09), yAt: (x, z) => P.groundY + driftH(x, z), avoid: (x, z) => Math.abs(x) < 9 && z < -4 && z > -16 });
  G.yard.add(P.spruces);
  // deck: weathered boards along x, fascia, steps, lattice skirt
  const deckTex = canvasTex(1024, 1024, (g, w) => { const bw = w / 10;
    for (let i = 0; i < 10; i++) { let x = -Math.random() * 300; while (x < w) { const L = 300 + Math.random() * 500; g.fillStyle = `hsl(${26 + Math.random() * 8}, ${22 + Math.random() * 10}%, ${30 + Math.random() * 9}%)`; g.fillRect(x, i * bw, L, bw);
      for (let k = 0; k < 40; k++) { g.fillStyle = Math.random() < 0.6 ? 'rgba(20,10,5,.14)' : 'rgba(255,230,200,.07)'; g.fillRect(x + Math.random() * L, i * bw + Math.random() * bw, 30 + Math.random() * 120, 1 + Math.random()); }
      g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(x, i * bw, 3, bw); x += L; } g.fillStyle = 'rgba(8,4,2,.85)'; g.fillRect(0, i * bw, w, 4); } }, { repeat: [1, 1] });
  const deckM = std({ map: deckTex, roughness: 0.72, envMapIntensity: 0.35 });
  const dW = P.x1 - P.x0 + 0.5, dD = P.zFront - P.zWall;
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(dW, dD), deckM); deck.rotation.x = -Math.PI / 2; deck.position.set(0, 0, (P.zWall + P.zFront) / 2); deck.receiveShadow = true;
  deckTex.repeat.set(dW / (10 * 5.5 * IN), dD / (10 * 5.5 * IN)); deckTex.rotation = 0; G.deck.add(deck);
  const trimM = std({ color: 0xe6dcc4, roughness: 0.6, envMapIntensity: 0.35 });   // cream painted trim, like the doghouse trim on the board
  const fascia = [boxG(dW, 0.28, 0.1, 0, -0.14, P.zFront + 0.05), boxG(0.1, 0.28, dD, P.x0 - 0.25, -0.14, (P.zWall + P.zFront) / 2), boxG(0.1, 0.28, dD, P.x1 + 0.25, -0.14, (P.zWall + P.zFront) / 2)];
  G.deck.add(meshOf(fascia, trimM));
  const lat = canvasTex(256, 256, (g, w) => { g.clearRect(0, 0, w, w); g.strokeStyle = '#d8cdb5'; g.lineWidth = 14; for (let k = -w; k < 2 * w; k += 64) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + w, w); g.stroke(); g.beginPath(); g.moveTo(k + w, 0); g.lineTo(k, w); g.stroke(); } });
  const latM = std({ map: lat, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8, envMapIntensity: 0.3 });
  [[dW, 0, P.zFront, 0], [dD, P.x0 - 0.25, (P.zWall + P.zFront) / 2, Math.PI / 2], [dD, P.x1 + 0.25, (P.zWall + P.zFront) / 2, Math.PI / 2]].forEach(([L, x, z, ry]) => { const t = lat.clone(); t.needsUpdate = true; t.repeat.set(L / 0.9, 0.7); const m = new THREE.Mesh(new THREE.PlaneGeometry(L, 0.62), latM.clone()); m.material.map = t; m.position.set(x, -0.59, z); m.rotation.y = ry; G.deck.add(m); });
  const steps = []; for (let i = 0; i < 3; i++) steps.push(worldUV(boxG(5.2, 0.3, 0.42, 0, -0.15 - 0.3 * (i), P.zFront + 0.21 + 0.42 * i), 1.6));
  G.deck.add(meshOf(steps, deckM));
  const snowCaps = []; for (let i = 0; i < 3; i++) snowCaps.push(new THREE.CapsuleGeometry(0.06, 4.6, 4, 8).rotateZ(Math.PI / 2).scale(1, 0.6, 1.4).translate(0, -0.3 * i + 0.02, P.zFront + 0.36 + 0.42 * i));
  [[-3.6, 0.5], [3.2, 0.7], [-1.2, 0.4], [5.0, 0.6], [-5.3, 0.6]].forEach(([x, s]) => snowCaps.push(new THREE.SphereGeometry(s, 14, 8, 0, 6.29, 0, Math.PI / 2).scale(1.4, 0.32, 0.7).translate(x, 0, P.zFront - 0.12)));
  G.deck.add(meshOf(snowCaps, snowMat()));
  // the log wall: honey-stained round logs with chinking, split round the window and the door, corner log ends
  const logTex = grainTex(512, 512, ['#9a6a3a', '#7c522a', '#b07c46', '#8a5a30'], { along: 'y', streaks: 300, knots: 10, seedDark: 'rgba(50,25,8,' });
  const logM = std({ map: logTex, roughness: 0.72, envMapIntensity: 0.4 });
  const capM = std({ map: endGrainTex('#c29560', '#5a3a20'), roughness: 0.8, envMapIntensity: 0.3 });
  const chinkM = std({ color: 0xd9cfb8, roughness: 1, envMapIntensity: 0.2 });
  const LR = 0.3, zc = P.zWall - LR, logs = [], caps = [], chink = [], r = rng(31), ops = [P.win, P.door];
  const rows = []; for (let yc = LR; yc + LR <= P.roofY - 0.25; yc += 0.575) rows.push(yc);
  rows.forEach((yc, i) => {
    let segs = [[-6.6, 6.6]];
    ops.forEach(o => { if (yc + LR * 0.5 > o.y0 && yc - LR * 0.5 < o.y1) segs = segs.flatMap(([a, b]) => (o.x1 <= a || o.x0 >= b) ? [[a, b]] : [[a, Math.max(a, o.x0)], [Math.min(b, o.x1), b]].filter(([p, q]) => q - p > 0.05)); });
    segs.forEach(([a, b]) => {
      const L = b - a, rr = LR * (0.94 + r() * 0.1), g = new THREE.CylinderGeometry(rr, rr, L, 16, 1, true);
      const U = g.attributes.uv, du = r(); for (let k = 0; k < U.count; k++) U.setXY(k, U.getX(k) + du, U.getY(k) * L / 2.6 + r() * 0.0);
      g.rotateZ(Math.PI / 2).translate((a + b) / 2, yc, zc); logs.push(g);
      [a, b].forEach((x, s) => caps.push(new THREE.CircleGeometry(rr, 16).rotateY(s ? Math.PI / 2 : -Math.PI / 2).translate(x, yc, zc)));
      if (i < rows.length - 1) chink.push(boxG(L, 0.16, 0.06, (a + b) / 2, yc + 0.2875, zc + 0.16));
    });
    // corner logs of the cabin's side walls: their ends stick out past the front wall
    if (i % 1 === 0) [-6.25, 6.25].forEach(x => { const g = new THREE.CylinderGeometry(LR * 0.97, LR * 0.97, 1.3, 16, 1, true); g.rotateX(Math.PI / 2).translate(x, yc + 0.29, zc - 0.25); logs.push(g); caps.push(new THREE.CircleGeometry(LR * 0.97, 16).translate(x, yc + 0.29, zc + 0.4)); });
  });
  logs.push(new THREE.BoxGeometry(13.4, 0.3, 0.7).translate(0, P.roofY - 0.15, zc));   // top plate
  const backing = new THREE.Shape(); backing.moveTo(-6.6, 0); backing.lineTo(6.6, 0); backing.lineTo(6.6, P.roofY); backing.lineTo(-6.6, P.roofY); backing.closePath();
  ops.forEach(o => { const h = new THREE.Path(); h.moveTo(o.x0, Math.max(0.001, o.y0)); h.lineTo(o.x0, o.y1); h.lineTo(o.x1, o.y1); h.lineTo(o.x1, Math.max(0.001, o.y0)); h.closePath(); backing.holes.push(h); });
  const bk = new THREE.Mesh(new THREE.ShapeGeometry(backing), std({ color: 0x2a1a10, roughness: 1 })); bk.position.z = zc - 0.05; G.wall.add(bk);
  G.wall.add(meshOf(logs.map(g => g.index ? g.toNonIndexed() : g), logM));
  G.wall.add(meshOf(caps, capM)); G.wall.add(meshOf(chink, chinkM));
  // window: cream casing and sash, mullions, frosty glass, tartan curtains, a warm interior behind; window box below
  const W = P.win, wx = (W.x0 + W.x1) / 2, ww = W.x1 - W.x0, wh = W.y1 - W.y0, wy = (W.y0 + W.y1) / 2, zf = P.zWall + 0.04, cas = 0.22;
  const trim = [boxG(cas, wh + 2 * cas, 0.08, W.x0 - cas / 2, wy, zf), boxG(cas, wh + 2 * cas, 0.08, W.x1 + cas / 2, wy, zf), boxG(ww + 2 * cas + 0.12, cas * 1.3, 0.1, wx, W.y1 + cas * 0.65, zf + 0.01),
    boxG(ww + 2 * cas + 0.25, 0.08, 0.3, wx, W.y0 - 0.04, zf + 0.1), boxG(0.04, wh, 0.7, W.x0 + 0.02, wy, zc), boxG(0.04, wh, 0.7, W.x1 - 0.02, wy, zc), boxG(ww, 0.04, 0.7, wx, W.y1 - 0.02, zc), boxG(ww, 0.04, 0.7, wx, W.y0 + 0.02, zc)];
  const glassZ = zc - 0.1, bar = 0.06; for (let k = 0; k <= 2; k++) trim.push(boxG(k % 2 ? bar : 2 * bar, wh, bar, W.x0 + ww * k / 2, wy, glassZ)); for (let k = 0; k <= 3; k++) trim.push(boxG(ww, k % 3 ? bar : 2 * bar, bar, wx, W.y0 + wh * k / 3, glassZ));
  // door casing
  const Dd = P.door, dx = (Dd.x0 + Dd.x1) / 2, dw = Dd.x1 - Dd.x0, dh = Dd.y1;
  trim.push(boxG(cas, dh + cas, 0.08, Dd.x0 - cas / 2, (dh + cas) / 2, zf), boxG(cas, dh + cas, 0.08, Dd.x1 + cas / 2, (dh + cas) / 2, zf), boxG(dw + 2 * cas + 0.12, cas * 1.3, 0.1, dx, dh + cas * 0.65, zf + 0.01),
    boxG(0.04, dh, 0.7, Dd.x0 + 0.02, dh / 2, zc), boxG(0.04, dh, 0.7, Dd.x1 - 0.02, dh / 2, zc), boxG(dw, 0.04, 0.7, dx, dh - 0.02, zc));
  G.wall.add(meshOf(trim.map(g => g.index ? g.toNonIndexed() : g), trimM));
  const interior = canvasTex(512, 512, (g, w, h) => { const c2 = document.createElement('canvas'); c2.width = w; c2.height = h; const q = c2.getContext('2d');
    const bg = q.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#5a3218'); bg.addColorStop(0.55, '#8a5228'); bg.addColorStop(1, '#3a200e'); q.fillStyle = bg; q.fillRect(0, 0, w, h);
    q.fillStyle = '#2e1a0c'; q.fillRect(w * 0.08, h * 0.25, w * 0.22, h * 0.6); q.fillStyle = '#6a3a1a'; for (let k = 0; k < 4; k++) q.fillRect(w * 0.09, h * (0.3 + k * 0.14), w * 0.2, h * 0.02);
    q.fillStyle = '#7a1c1c'; q.fillRect(w * 0.4, h * 0.62, w * 0.5, h * 0.2); q.fillRect(w * 0.42, h * 0.52, w * 0.46, h * 0.12);
    q.fillStyle = '#1e3a24'; q.beginPath(); q.moveTo(w * 0.78, h * 0.15); q.lineTo(w * 0.95, h * 0.6); q.lineTo(w * 0.61, h * 0.6); q.fill();
    for (let k = 0; k < 18; k++) { const x = w * (0.66 + Math.random() * 0.24), y = h * (0.22 + Math.random() * 0.36), gg = q.createRadialGradient(x, y, 0, x, y, 9); gg.addColorStop(0, 'rgba(255,220,150,1)'); gg.addColorStop(1, 'rgba(255,180,90,0)'); q.fillStyle = gg; q.fillRect(x - 9, y - 9, 18, 18); }
    const lg = q.createRadialGradient(w * 0.32, h * 0.3, 0, w * 0.32, h * 0.3, w * 0.35); lg.addColorStop(0, 'rgba(255,214,150,.95)'); lg.addColorStop(1, 'rgba(255,170,80,0)'); q.fillStyle = lg; q.fillRect(0, 0, w, h);
    g.filter = 'blur(5px)'; g.drawImage(c2, 0, 0); g.filter = 'none'; }, { clamp: true });
  const inM = new THREE.MeshBasicMaterial({ map: interior, color: lin(1.35, 1.15, 0.95) });
  const inPl = new THREE.Mesh(new THREE.PlaneGeometry(ww + 2.8, wh + 2.4), inM); inPl.position.set(wx, wy, zc - 1.2); G.wall.add(inPl);
  const frost = canvasTex(256, 256, (g, w) => { g.clearRect(0, 0, w, w); const rg = g.createRadialGradient(w / 2, w / 2, w * 0.2, w / 2, w / 2, w * 0.72); rg.addColorStop(0, 'rgba(240,245,255,.03)'); rg.addColorStop(0.75, 'rgba(240,245,255,.22)'); rg.addColorStop(1, 'rgba(250,252,255,.7)'); g.fillStyle = rg; g.fillRect(0, 0, w, w); });
  frost.repeat.set(2, 3);
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), new THREE.MeshBasicMaterial({ map: frost, color: lin(0.95, 0.97, 1.05), transparent: true, depthWrite: false })); pane.position.set(wx, wy, glassZ + 0.04); pane.renderOrder = 5; G.wall.add(pane);
  [[W.x0 + 0.3, 1], [W.x1 - 0.3, -1]].forEach(([x, s]) => { const g = new THREE.PlaneGeometry(0.62, wh + 0.2, 14, 1), Pq = g.attributes.position; for (let k = 0; k < Pq.count; k++) Pq.setZ(k, 0.04 * Math.sin(Pq.getX(k) * 26 + s)); g.computeVertexNormals();
    const tt = tartan(1.6), cm = new THREE.Mesh(g, std({ map: tt, emissiveMap: tt, color: lin(1.1, 1.0, 1.0), side: THREE.DoubleSide, roughness: 0.85, emissive: lin(0.5, 0.3, 0.15), emissiveIntensity: 1 })); cm.position.set(x, wy - 0.05, glassZ - 0.2); G.wall.add(cm); });
  // window box with evergreens, berries and pinecones
  const boxM = std({ map: grainTex(256, 128, ['#7a1c1c', '#661616'], { along: 'x', streaks: 60, seedDark: 'rgba(30,5,5,' }), roughness: 0.65, envMapIntensity: 0.35 });
  G.wall.add(meshOf([boxG(ww + 0.25, 0.36, 0.36, wx, W.y0 - 0.32, P.zWall + 0.2), boxG(0.06, 0.18, 0.06, W.x0 + 0.2, W.y0 - 0.62, P.zWall + 0.06), boxG(0.06, 0.18, 0.06, W.x1 - 0.2, W.y0 - 0.62, P.zWall + 0.06)], boxM));
  const GB = greenery(73); for (let k = 0; k < (LQ ? 110 : 170); k++) { const x = W.x0 + 0.02 + r() * (ww - 0.04); GB.sprig(new THREE.Vector3(x, W.y0 - 0.2, P.zWall + 0.1 + r() * 0.2), new THREE.Vector3((r() - 0.5) * 1.6, 0.45 + r() * 0.6, 0.5 + r() * 0.8), 1.3 + r() * 0.7); }
  for (let k = 0; k < 18; k++) GB.berry(new THREE.Vector3(W.x0 + 0.15 + r() * (ww - 0.3), W.y0 - 0.06 + r() * 0.12, P.zWall + 0.33 + r() * 0.06), 1.1);
  for (let k = 0; k < 5; k++) GB.cone(new THREE.Vector3(W.x0 + 0.3 + k * (ww - 0.6) / 4, W.y0 - 0.1, P.zWall + 0.36), new THREE.Vector3(0, 1, 0.4), 1.7);
  G.wall.add(GB.build());
  // the door: red painted planks, a lit four-light window, strap hinges, a brass knob, a wreath
  const doorTex = canvasTex(512, 1024, (g, w, h) => { const pw = w / 5; for (let i = 0; i < 5; i++) { g.fillStyle = `hsl(${356 + Math.random() * 4}, ${55 + Math.random() * 8}%, ${24 + Math.random() * 4}%)`; g.fillRect(i * pw, 0, pw, h); noise(g, w, h, 0, 0, ['#000']); for (let k = 0; k < 60; k++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.12)' : 'rgba(255,200,180,.06)'; g.fillRect(i * pw + Math.random() * pw, Math.random() * h, 1 + Math.random() * 2, 30 + Math.random() * 120); } g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(i * pw, 0, 4, h); }
    g.fillStyle = '#1a0806'; g.fillRect(w * 0.22, h * 0.07, w * 0.56, h * 0.2); });
  const doorGlow = canvasTex(64, 128, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); const x0 = w * 0.22 + 2, y0 = h * 0.07 + 2, ww2 = w * 0.56 - 4, hh2 = h * 0.2 - 4; const gg = g.createRadialGradient(x0 + ww2 / 2, y0 + hh2 / 2, 0, x0 + ww2 / 2, y0 + hh2 / 2, ww2 * 0.7); gg.addColorStop(0, '#ffd28c'); gg.addColorStop(1, '#b8682a'); g.fillStyle = gg; g.fillRect(x0, y0, ww2, hh2); }, { clamp: true });
  const doorM = std({ map: doorTex, emissiveMap: doorGlow, emissive: lin(1.4, 1.0, 0.6), emissiveIntensity: 1, roughness: 0.55, envMapIntensity: 0.35 });
  const door = new THREE.Mesh(new THREE.BoxGeometry(dw - 0.04, dh - 0.03, 0.14), doorM); door.position.set(dx, (dh - 0.03) / 2, zc - 0.08); door.receiveShadow = true; G.wall.add(door);
  const dz = zc - 0.01, dm = [], dwin = { x0: dx - dw * 0.28, x1: dx + dw * 0.28, y0: dh * 0.73, y1: dh * 0.93 };
  dm.push(boxG(0.05, dwin.y1 - dwin.y0, 0.05, dx, (dwin.y0 + dwin.y1) / 2, dz), boxG(dwin.x1 - dwin.x0, 0.05, 0.05, dx, (dwin.y0 + dwin.y1) / 2, dz));
  G.wall.add(meshOf(dm, trimM));
  const hw = []; [1.0, 4.4].forEach(y => hw.push(boxG(1.2, 0.09, 0.03, Dd.x0 + 0.62, y, dz + 0.01), new THREE.CylinderGeometry(0.03, 0.03, 0.03, 8).rotateX(Math.PI / 2).translate(Dd.x0 + 1.15, y, dz + 0.02)));
  G.wall.add(meshOf(hw, std({ color: 0x151311, metalness: 0.7, roughness: 0.5 })));
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), std({ color: 0xc89b4a, metalness: 1, roughness: 0.3, envMapIntensity: 1.1 })); knob.position.set(Dd.x1 - 0.32, 2.85, dz + 0.06); G.wall.add(knob);
  const GD = greenery(19); wreath(GD, 0.4, LQ ? 140 : 220); const dwg = GD.build(); dwg.position.set(dx, 3.25, dz + 0.04); G.wall.add(dwg);
  const db = new THREE.Mesh(bowGeo({ ribbon: 3.2, span: 10, tail: 11, loops: 2, seed: 9 }), tartanBowMat()); db.position.set(dx, 2.86, dz + 0.16); G.wall.add(db);
  // props on the deck (all at r >= 3.5 from the trunk, none between the home camera and the tree)
  const chair = rockingChair(); chair.position.set(-4.1, 0, -0.9); chair.rotation.y = 0.55; G.deck.add(chair);
  const sl = sled(); sl.position.set(5.3, 0, P.zWall + 0.62); sl.rotation.x = -0.2; G.deck.add(sl);
  const lt = lantern(); lt.position.set(1.65, 0, P.zWall + 0.42); G.deck.add(lt);
  { // firewood stack in an iron hoop rack
    const n = 24, fw = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.115, 0.115, 0.7, 5), [std({ map: grainTex(128, 128, ['#4a3020', '#2e1e14'], { along: 'y' }), roughness: 0.9 }), std({ map: endGrainTex(), roughness: 0.9 }), std({ map: endGrainTex(), roughness: 0.9 })], n);
    const d = new THREE.Object3D(); let i = 0; for (let row = 0; row < 5 && i < n; row++) for (let k = 0; k < 6 - (row % 2) && i < n; k++, i++) { d.position.set(-5.95 + 0.22 + k * 0.23 + (row % 2) * 0.115, 0.115 + row * 0.2, P.zWall + 0.42); d.rotation.set(Math.PI / 2, 0, r() * 1.3); d.updateMatrix(); fw.setMatrixAt(i, d.matrix); }
    fw.count = i; fw.castShadow = true; fw.receiveShadow = true; G.deck.add(fw);
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.022, 6, 32, Math.PI), std({ color: 0x151311, metalness: 0.7, roughness: 0.5 })); hoop.position.set(-5.95 + 0.82, 0.02, P.zWall + 0.42); G.deck.add(hoop);
  }
  { // coir doormat with a little trail of paw prints
    const mt = canvasTex(512, 320, (g, w, h) => { g.fillStyle = '#a07a48'; g.fillRect(0, 0, w, h); noise(g, w, h, 16000, 0.4, ['#6e4f2a', '#c9a46c', '#87653a']); g.strokeStyle = '#3a2614'; g.lineWidth = 18; g.strokeRect(9, 9, w - 18, h - 18);
      [[0.3, 0.68, -0.5], [0.45, 0.42, -0.6], [0.6, 0.66, -0.5], [0.74, 0.38, -0.6]].forEach(([x, y, a]) => drawPaw(g, w * x, h * y, 62, '#2a1a0c', a + Math.PI / 2)); }, { clamp: true });
    const mat = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.035, 1.2), [std({ color: 0x3a2614, roughness: 1 }), std({ color: 0x3a2614, roughness: 1 }), std({ map: mt, roughness: 1, envMapIntensity: 0.1 }), std({ color: 0x3a2614 }), std({ color: 0x3a2614 }), std({ color: 0x3a2614 })]);
    mat.position.set(dx, 0.018, P.zWall + 0.75); mat.receiveShadow = true; G.deck.add(mat);
  }
  // posts and side railings (hide with their side), with snow on the top rails
  const postM = std({ map: logTex, roughness: 0.7, envMapIntensity: 0.4 });
  [[-1, G.left], [1, G.right]].forEach(([s, grp]) => {
    const x = s * P.postX, parts = [worldUV(boxG(0.42, P.roofY - 0.34, 0.42, x, (P.roofY - 0.34) / 2, P.postZ), 1.4)];
    const z0 = P.zWall + 0.05, z1 = P.postZ - 0.21, L = z1 - z0;
    parts.push(boxG(0.14, 0.1, L, x, 2.6, (z0 + z1) / 2), boxG(0.1, 0.08, L, x, 0.3, (z0 + z1) / 2));
    for (let z = z0 + 0.2; z < z1 - 0.1; z += 0.33) parts.push(boxG(0.08, 2.26, 0.08, x, 1.47, z));
    grp.add(meshOf(parts.map(g => g.index ? g.toNonIndexed() : g), trimM, { cast: false }));
    grp.add(meshOf([new THREE.CapsuleGeometry(0.07, L - 0.1, 4, 10).rotateX(Math.PI / 2).scale(1.1, 0.55, 1).translate(x, 2.67, (z0 + z1) / 2)], snowMat()));
    // a corner bracket where the post meets the beam
    grp.add(meshOf([boxG(0.1, 0.1, 0.9, x, P.roofY - 0.62, P.postZ - 0.4).rotateX(0)], trimM));
  });
  // roof: beams, beadboard ceiling, snow slab, rounded snow edge, icicles; a ceiling lantern (the key light's source)
  const ceilTex = canvasTex(512, 512, (g, w) => { const bw = w / 12; for (let i = 0; i < 12; i++) { g.fillStyle = `hsl(${30 + Math.random() * 4}, 38%, ${52 + Math.random() * 6}%)`; g.fillRect(0, i * bw, w, bw); g.fillStyle = 'rgba(40,20,5,.45)'; g.fillRect(0, i * bw, w, 2); } noise(g, w, w, 3000, 0.12, ['#000', '#fff']); });
  ceilTex.repeat.set(4, 3);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(13.2, P.postZ - P.zWall + 0.6), std({ map: ceilTex, roughness: 0.75, envMapIntensity: 0.3 })); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, P.roofY, (P.zWall + P.postZ + 0.6) / 2); G.roof.add(ceil);
  const beams = [boxG(13.0, 0.34, 0.42, 0, P.roofY - 0.17, P.postZ), boxG(0.36, 0.3, P.postZ - P.zWall, -P.postX, P.roofY - 0.15, (P.zWall + P.postZ) / 2), boxG(0.36, 0.3, P.postZ - P.zWall, P.postX, P.roofY - 0.15, (P.zWall + P.postZ) / 2)];
  G.roof.add(meshOf(beams.map(g => worldUV(g, 1.4)), postM));
  const rz0 = P.zWall - 0.6, rz1 = P.postZ + 0.65, rd = rz1 - rz0;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(13.6, 0.22, rd), std({ color: 0x3a2a1e, roughness: 0.9 })); slab.position.set(0, P.roofY + 0.11, (rz0 + rz1) / 2); G.roof.add(slab);
  G.roof.add(meshOf([boxG(13.7, 0.3, rd, 0, P.roofY + 0.37, (rz0 + rz1) / 2), new THREE.CapsuleGeometry(0.16, 13.4, 4, 12).rotateZ(Math.PI / 2).translate(0, P.roofY + 0.36, rz1)], snowMat()));
  const ice = [], ir = rng(5); for (let x = -6.6; x < 6.6; x += 0.12 + ir() * 0.25) { const L = 0.1 + Math.pow(ir(), 2) * 0.8; ice.push(new THREE.ConeGeometry(0.028 + L * 0.03, L, 6, 1).rotateX(Math.PI).translate(x, P.roofY + 0.18 - L / 2, rz1 + 0.08)); }
  G.roof.add(meshOf(ice, new THREE.MeshPhysicalMaterial({ color: 0xdfefff, roughness: 0.08, transmission: 0, transparent: true, opacity: 0.82, clearcoat: 1, envMapIntensity: 1.4, emissive: 0x2a3a55, emissiveIntensity: 0.3 })));
  const lampG = new THREE.Group(); lampG.position.set(0.9, P.roofY, 3.6); G.roof.add(lampG);
  const lm = std({ color: 0x161412, metalness: 0.6, roughness: 0.45 });
  lampG.add(meshOf([new THREE.CylinderGeometry(0.12, 0.12, 0.04, 12).translate(0, -0.02, 0), new THREE.CylinderGeometry(0.015, 0.015, 0.18, 6).translate(0, -0.12, 0), new THREE.ConeGeometry(0.2, 0.1, 4).rotateY(Math.PI / 4).translate(0, -0.25, 0), boxG(0.26, 0.03, 0.26, 0, -0.62, 0)], lm));
  const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.22), new THREE.MeshBasicMaterial({ color: lin(3.2, 2.2, 1.2) })); bulb.position.y = -0.45; lampG.add(bulb);
  // snow falling in the yard (not under the roof, not in the tree)
  P.snow = snowPoints({ n: LQ ? 800 : 2400, seed: 9, size: 0.05, cull: 2, yb: P.groundY, H: 13, speed: [0.45, 0.95], color: [0.82, 0.86, 1.0], gen: ringGen(0.5, 17, P.groundY, P.groundY + 13) });
  root.add(P.snow);
  root.traverse(o => { if (o.isMesh && !o.material.isShaderMaterial) o.receiveShadow = true; });
  P.cut = [[G.wall, [0, 0, 1], [0, 0, P.zWall - 0.6]], [G.left, [1, 0, 0], [-P.postX - 0.25, 0, 0]], [G.right, [-1, 0, 0], [P.postX + 0.25, 0, 0]], [G.roof, [0, -1, 0], [0, P.roofY + 0.5, 0]]]
    .map(([g, n, p]) => ({ g, n: new THREE.Vector3(...n), p: new THREE.Vector3(...p) }));
  PORCH.groups = G;
  return root;
}
registerRoom({
  id: 'porch', label: 'Cabin porch', order: 30, maxDist: 11.5, build: buildPorch,
  look: { env: porchEnv, bg: 0x070b18, hemi: [0x9fb2e0, 0x4a3426, 0.42], key: { color: 0xffcf98, intensity: 34, angle: 0.85, penumbra: 1, decay: 2, pos: [0.9, 6.85, 3.6], target: [0, 2.8, 0] }, rim: [0x7f9ad8, 0.4],
    base: [0xffb070, 2.2], interior: 1, accent: [[0xffa050, 1.6, [-3.0, 3.6, -3.05]], [0xff9a40, 0.9, [1.65, 0.62, -3.18]]], exp: 1.15, bloom: 0.9, warm: 0.45,
    day: { hemi: 0.9, key: 0.8, rim: 0.6, exp: 1.08 } },
  setMode(mode) { const day = mode === 'off' ? 1 : 0; if (PORCH.sky) PORCH.sky.material.uniforms.uDay.value = day; if (day) hemi.color.set(0xe4e8f0); if (PORCH.spruces) PORCH.spruces.userData.mat.userData.uHaze.value.setRGB(...(day ? [0.52, 0.58, 0.68] : [0.03, 0.04, 0.09])); },
  tick(t, dt) {
    const cam = camera.position;
    PORCH.cut.forEach(w => { w.g.visible = V3.subVectors(cam, w.p).dot(w.n) > -0.02; });
    if (PORCH.sky) PORCH.sky.material.uniforms.uTime.value = RM ? 0 : t;
    if (PORCH.flame) PORCH.flame.uniforms.uTime.value = RM ? 0 : t;
    if (PORCH.snow) PORCH.snow.userData.tick(t);
    const own = typeof ACCENT_OWNER !== 'undefined' ? ACCENT_OWNER : [null, null];
    if (!own[1]) { const l = accent[1], b = l.userData.base || 0; l.intensity = RM ? b : b * (1 + 0.16 * Math.sin(t * 8.3) * Math.sin(t * 3.1) + 0.05 * Math.sin(t * 21)); }
  },
});

/* ================================================================
   5. Snow globe: the display inside a glass globe on a walnut base with a gold plaque.
      The room (walls, floor, ground) hides; a forest or porch sky stays behind it.
      Spinning the view swirls the snow, which then settles.
   ================================================================ */
const GLOBE = { on: false, R: 5.5, cy: 2.6, snow: null, w: 0, ang: 0, lastAz: null, anim: null, hidden: new Set(), max: 20, target: new THREE.Vector3(0, 2.35, 0), restoring: false };
function globeFit() {   // distance that fits the globe (radius ~5.9 with the base) in both the height and the width of the view
  const vh = camera.fov * Math.PI / 360, hh = Math.atan(Math.tan(vh) * camera.aspect), half = Math.min(vh, hh);
  return 6.15 / Math.sin(half);
}
function buildGlobe(c) {
  const g = new THREE.Group(); g.name = 'extra.snow_globe';
  const R = GLOBE.R, cy = GLOBE.cy, rFloor = Math.sqrt(R * R - cy * cy);
  // glass: only the part above the base; fresnel rim so the edge reads as glass; drawn after the tree
  const gm = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.06, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.6, depthWrite: false });
  gm.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `#include <opaque_fragment>
    { float fr = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 3.0); gl_FragColor.rgb += fr * vec3(0.32, 0.36, 0.42); gl_FragColor.a = clamp(gl_FragColor.a + fr * 0.55, 0.0, 1.0); }`); };
  gm.customProgramCacheKey = () => 'envx-globe-glass';
  const glass = new THREE.Mesh(new THREE.SphereGeometry(R, LQ ? 64 : 96, LQ ? 40 : 64, 0, Math.PI * 2, 0, Math.acos(-cy / R) + 0.01), gm); glass.position.y = cy; glass.renderOrder = 20; g.add(glass);
  // snowy floor inside, drifting up against the glass
  const fl = []; [[0, 0], [3.3, 0], [4.1, 0.05], [4.55, 0.16], [rFloor - 0.04, 0.3], [rFloor - 0.02, 0.0]].forEach(([x, y]) => fl.push(new THREE.Vector2(Math.max(0.001, x), y)));
  const floor = new THREE.Mesh(new THREE.LatheGeometry(fl.reverse(), 64), snowMat()); floor.receiveShadow = true; g.add(floor);
  // walnut base (lathe), gold bands, curved gold plaque facing the home view
  const walnut = grainTex(1024, 256, ['#4a2c1a', '#36200f', '#5c3820'], { along: 'x', streaks: 320, knots: 3 }); walnut.repeat.set(5, 1);
  const prof = [[rFloor + 0.02, 0.03], [5.3, 0.03], [5.36, -0.04], [5.44, -0.2], [5.6, -0.42], [5.63, -0.6], [5.6, -0.9], [5.5, -1.0], [5.66, -1.12], [5.8, -1.32], [5.82, -1.45], [5.6, -1.5], [0.001, -1.5]].map(([x, y]) => new THREE.Vector2(x, y));
  const baseM = std({ map: walnut, roughness: 0.38, envMapIntensity: 0.7 });
  const base = new THREE.Mesh(new THREE.LatheGeometry(prof.reverse(), 120), baseM); base.castShadow = false; base.receiveShadow = true; g.add(base);
  const gold = std({ color: 0xd4a84a, metalness: 1, roughness: 0.25, envMapIntensity: 1.2 });
  g.add(meshOf([new THREE.TorusGeometry(5.33, 0.035, 8, 180).rotateX(Math.PI / 2).translate(0, 0.02, 0), new THREE.TorusGeometry(5.52, 0.03, 8, 180).rotateX(Math.PI / 2).translate(0, -1.0, 0)], gold));
  const plaque = canvasTex(1280, 136, (q, w, h) => { const gg = q.createLinearGradient(0, 0, 0, h); gg.addColorStop(0, '#f1d48a'); gg.addColorStop(0.5, '#c9973f'); gg.addColorStop(1, '#a87a2e'); q.fillStyle = gg; q.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) { q.fillStyle = `rgba(255,255,255,${Math.random() * 0.08})`; q.fillRect(Math.random() * w, Math.random() * h, 40 + Math.random() * 120, 1); }
    q.strokeStyle = '#7a5418'; q.lineWidth = 4; q.strokeRect(10, 10, w - 20, h - 20);
    fitText(q, 'Home for the Howlidays', w / 2, h / 2 + 3, w - 260, '700 #px "Helvetica Neue", Arial, sans-serif', 74, '#7e1a1c');
    drawPaw(q, 70, h / 2, 54, '#7e1a1c', -0.3); drawPaw(q, w - 70, h / 2, 54, '#7e1a1c', 0.3); }, { clamp: true });
  const pq = new THREE.Mesh(new THREE.CylinderGeometry(5.655, 5.655, 0.36, 40, 1, true, -0.31, 0.62), std({ map: plaque, metalness: 0.85, roughness: 0.32, envMapIntensity: 1.1 })); pq.position.y = -0.62; g.add(pq);
  // a dark velvet display table under the globe, fading out
  const tbl = canvasTex(256, 256, (q, w) => { const rg = q.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); rg.addColorStop(0, 'rgba(70,20,22,1)'); rg.addColorStop(0.55, 'rgba(46,14,16,.9)'); rg.addColorStop(1, 'rgba(20,8,8,0)'); q.fillStyle = rg; q.fillRect(0, 0, w, w); }, { clamp: true });
  const table = new THREE.Mesh(new THREE.CircleGeometry(13, 64), new THREE.MeshStandardMaterial({ map: tbl, transparent: true, depthWrite: false, roughness: 0.9, envMapIntensity: 0.2 })); table.rotation.x = -Math.PI / 2; table.position.y = -1.501; table.renderOrder = -1; g.add(table);
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(13.5, 13.5), new THREE.MeshBasicMaterial({ map: SHADOW_TEX, transparent: true, depthWrite: false, opacity: 0.85 })); sh.rotation.x = -Math.PI / 2; sh.position.y = -1.498; g.add(sh);
  // snow inside the globe
  GLOBE.snow = snowPoints({ n: LQ ? 600 : 1500, seed: 3, size: 0.07, cull: 3, yb: 0.05, H: 8.0, speed: [0.12, 0.32], color: [0.95, 0.97, 1.0], opacity: 0.95, gen: ringGen(0.3, 5.3, 0.05, 8.05) });
  GLOBE.snow.material.uniforms.uSph.value.set(0, cy, 0, R);
  g.add(GLOBE.snow);
  controls.addEventListener('start', () => { GLOBE.anim = null; });
  // shim (no API for it): applyLook() resets controls.maxDistance to the room's value on every room or lights change,
  // and OrbitControls clamps before extras tick. While the globe is on, the room value gets a floor that fits the globe.
  if (!controls.userData) controls.userData = {};
  if (!controls.userData.envxMax) { let v = controls.maxDistance; Object.defineProperty(controls, 'maxDistance', { configurable: true, get() { return GLOBE.on ? Math.max(v, GLOBE.max) : v; }, set(x) { v = x; } }); controls.userData.envxMax = true; }
  return g;
}
function globeCamera(toGlobe) {   // ease the camera out to fit the globe, or back to the home view
  const from = camera.position.clone(), fromT = controls.target.clone(), t0 = performance.now();
  let toP, toT;
  if (toGlobe) { const dir = (typeof HOME_POS !== 'undefined' ? HOME_POS.clone().sub(HOME_TARGET) : new THREE.Vector3(0.04, -0.05, 1)).normalize(); toT = GLOBE.target.clone(); toP = toT.clone().addScaledVector(dir, globeFit()); }
  else { toP = typeof HOME_POS !== 'undefined' ? HOME_POS.clone() : from; toT = typeof HOME_TARGET !== 'undefined' ? HOME_TARGET.clone() : fromT; }
  GLOBE.anim = { from, fromT, toP, toT, t0, dur: RM ? 1 : 1100 };
}
registerExtra({
  id: 'snow_globe', label: 'Snow globe', kind: 'toggle', default: false,
  build: buildGlobe,
  setOn(on, c) {
    if (on) { GLOBE.max = Math.max(20, globeFit() * 1.12); GLOBE.on = true; GLOBE.lastAz = controls.getAzimuthalAngle(); GLOBE.restoring = false; globeCamera(true); }
    else {
      GLOBE.hidden.forEach(o => { o.visible = true; }); GLOBE.hidden.clear();
      const room = ROOMS[XS.room]; if (room && room.group) room.group.visible = true;
      globeCamera(false);
      if (RM) { camera.position.copy(GLOBE.anim.toP); controls.target.copy(GLOBE.anim.toT); GLOBE.anim = null; GLOBE.on = false; c.applyLook(); } else GLOBE.restoring = true;
    }
  },
  tick(t, dt, c) {
    // the room hides while the globe is on (a sky marked globeKeep stays as the backdrop)
    const room = ROOMS[XS.room];
    if (room && room.group && !GLOBE.restoring) {
      const keep = room.group.children.filter(o => o.userData.globeKeep);
      room.group.visible = keep.length > 0;
      room.group.children.forEach(o => { if (!o.userData.globeKeep && o.visible) { o.visible = false; GLOBE.hidden.add(o); } });
    }
    // swirl: spinning the view (drag or auto-spin) stirs the snow; it decays and settles
    const az = controls.getAzimuthalAngle(); if (GLOBE.lastAz === null) GLOBE.lastAz = az;
    const dA = Math.atan2(Math.sin(az - GLOBE.lastAz), Math.cos(az - GLOBE.lastAz)); GLOBE.lastAz = az;
    GLOBE.w = (GLOBE.w + dA * (RM ? 1.5 : 7)) * Math.exp(-dt * 0.9); GLOBE.ang += GLOBE.w * dt * 4;
    if (GLOBE.snow) { GLOBE.snow.material.uniforms.uSwirl.value = GLOBE.ang; GLOBE.snow.userData.tick(t + Math.abs(GLOBE.ang) * 0.15); }
    if (GLOBE.anim && !GLOBE.restoring) { const a = GLOBE.anim, k = Math.min(1, (performance.now() - a.t0) / a.dur), e = 1 - Math.pow(1 - k, 3);
      camera.position.lerpVectors(a.from, a.toP, e); controls.target.lerpVectors(a.fromT, a.toT, e);
      if (k >= 1) GLOBE.anim = null; }
  },
});
// the globe's tick must keep running while it eases back home after being switched off
frameHooks.push((t, dt) => {
  if (!GLOBE.restoring) return;
  const a = GLOBE.anim; if (!a) { GLOBE.restoring = false; GLOBE.on = false; core.applyLook(); return; }
  const k = Math.min(1, (performance.now() - a.t0) / a.dur), e = 1 - Math.pow(1 - k, 3);
  camera.position.lerpVectors(a.from, a.toP, e); controls.target.lerpVectors(a.fromT, a.toT, e);
  if (k >= 1) { GLOBE.anim = null; GLOBE.restoring = false; GLOBE.on = false; core.applyLook(); }
});
// for other extras: where things are in the settings this file adds
core.envx = { forest: { bench: { x: -5.4, z: 0.9, ry: 0.45, seatY: 1.18 }, moon: FOREST.moon }, porch: PORCH, fire: ROOM.fire, globe: GLOBE };
}
