// The wash of "Small squares" (Ambient Town's visuals, live-mix), ported to paint a page.
// Every wash is one instanced quad that outputs the light it lets through, and the quads are
// multiplied onto the paper in order, as glazes are.

export const VERTEX = `#version 300 es
in vec2 aCorner;
in vec4 aRect, aInk, aInk2, aSeed, aState, aDrop, aExtra;
uniform vec4 uTile; // x, y, w, h of what is drawn, in page pixels
out vec2 vP;
flat out vec4 vRect, vInk, vInk2, vSeed, vState, vDrop, vExtra;
void main() {
  float pad = aInk2.w == 5.0 ? 150.0 : aInk2.w == 4.0 ? 60.0 : 34.0;
  vP = aInk2.w < 0.0 ? uTile.xy + aCorner * uTile.zw : aRect.xy - pad + aCorner * (aRect.zw + 2.0 * pad);
  vRect = aRect; vInk = aInk; vInk2 = aInk2; vSeed = aSeed; vState = aState; vDrop = aDrop; vExtra = aExtra;
  vec2 c = (vP - uTile.xy) / uTile.zw * 2.0 - 1.0;
  gl_Position = vec4(c.x, -c.y, 0.0, 1.0);
}`

export const FRAGMENT = `#version 300 es
precision highp float;
in vec2 vP;
flat in vec4 vRect, vInk, vInk2, vSeed, vState, vDrop, vExtra;
uniform vec3 uPaper;
uniform float uPixel;   // one device pixel, in page pixels
uniform vec4 uCreek;    // middle, how far it winds, half its width, how much wider its mouth is
uniform vec2 uMouth;    // where the mouth is, how far down it reaches
uniform sampler2D uMask;
out vec4 fragColor;
#define TAU 6.28318531
#define sat(x) clamp(x, 0.0, 1.0)
const float S = 900.0;  // the picture was drawn for a sheet this many pixels tall

float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  i = mod(i, 1024.0);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y);
}
float smin(float a, float b, float k) { float h = sat(0.5 + 0.5 * (b - a) / k); return mix(b, a, h) - k * h * (1.0 - h); }
float sq(float x) { return x * x; }
float creekAt(float y) { return uCreek.x + uCreek.y * (0.62 * sin(y / 310.0 + 0.6) + 0.38 * sin(y / 173.0 + 2.0)); }

void main() {
  vec2 P = vP, p = P / S;
  float kind = vInk2.w;
  // the paper's tooth: two turned nets, so that neither is seen
  const mat2 T1 = mat2(0.80, 0.60, -0.60, 0.80), T2 = mat2(0.46, -0.89, 0.89, 0.46);
  vec2 t1 = T1 * p * 172.0, t2 = T2 * p * 305.0;
  float tooth = 0.6 * noise(t1) + 0.4 * noise(t2);

  if (kind < 0.0) { // the paper
    float lay = noise(p * vec2(3.1, 2.3)) - 0.5;
    float lit = 0.6 * noise(t1 + T1 * vec2(-0.42, 0.42)) + 0.4 * noise(t2 + T2 * vec2(-0.6, 0.6));
    vec3 c = uPaper * (1.0 + 0.040 * (tooth - lit) + 0.016 * lay + 0.008 * (noise(p * 46.0) - 0.5));
    fragColor = vec4(c, 1.0);
    return;
  }

  float grain = 0.6 * tooth + 0.4 * noise(p * 420.0 + 9.0);
  float lump = noise(p * 34.0);
  float wob = 0.75 * lump + 0.25 * tooth;
  float cloud = 0.65 * noise(p * 11.0 + 3.0) + 0.35 * lump;
  vec2 X = P - vRect.xy, size = vRect.zw;
  vec2 q = X / max(size, vec2(1.0)) * 2.0 - 1.0; // the place in the wash, -1 to 1
  float grow = vState.x, d = -1.0, soft = 1.0, rimK = 1.0, body = 0.0;
  float tiny = clamp(min(size.x, size.y) / 30.0, 0.22, 1.0); // a small wash has a finer hand
  vec4 r = vSeed;

  if (kind == 2.0) { // a pencil line
    float along = size.x > size.y ? X.x : X.y, across = size.x > size.y ? X.y - size.y * 0.5 : X.x - size.x * 0.5;
    float len = max(size.x, size.y);
    across += 0.9 * sin(along / 61.0 + r.x * TAU) + 0.6 * (lump - 0.5);
    float on = (1.0 - smoothstep(0.3, 0.6 + uPixel, abs(across))) * step(0.0, along) * step(along, len * grow);
    float k = 0.24 * on * (0.15 + 1.0 * grain) * vInk.w;
    fragColor = vec4(vec3(1.0 - k), 1.0);
    return;
  }
  if (kind == 3.0) { // a letter
    vec2 uv = X / size;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;
    float m = texture(uMask, vExtra.xy + uv * vExtra.zw).r;
    d = (m - 0.5) * 2.0 * vState.w + (wob - 0.5) * clamp(vState.w * 0.2, 1.0, 5.0);
    tiny = clamp(vState.w / 16.0, 0.35, 1.0); q *= 0.8;
  } else if (kind == 1.0) { // wet into wet: neighbours share one wandering edge
    vec2 w = vec2(noise(p * 9.0 + 4.0), noise(p * 9.0 + 41.0)) - 0.5;
    vec2 w2 = vec2(noise(p * 27.0 + 14.0), noise(p * 27.0 + 61.0)) - 0.5;
    vec2 w3 = vec2(noise(p * 80.0 + 24.0), noise(p * 80.0 + 81.0)) - 0.5;
    vec2 Y = X + 20.0 * w + 13.0 * w2 + 5.0 * w3;
    d = min(min(Y.x, size.x - Y.x), min(Y.y, size.y - Y.y));
    float wet = smoothstep(0.35, 0.7, noise(p * 2.7 + 8.0));   // some seams are wetter than others
    soft = mix(1.2, 17.0, wet); rimK = mix(0.55, 0.16, wet);
  } else if (kind == 4.0) { // a puddle that dried where it lay
    vec2 h = size * 0.5; float R = min(h.x, h.y);
    vec2 v = X - h;
    v += 0.22 * R * (vec2(noise(v * 1.6 / R + r.x * 40.0), noise(v * 1.6 / R + r.y * 40.0 + 21.0)) - 0.5) * 2.0;
    v += 0.05 * R * (vec2(noise(v * 7.0 / R + r.z * 40.0), noise(v * 7.0 / R + r.w * 40.0)) - 0.5) * 2.0;
    vec2 n = abs(v) / h; float e = vExtra.x;
    d = (1.0 - pow(pow(n.x, e) + pow(n.y, e), 1.0 / e)) * R * 0.95;
    d += (lump - 0.5) * 5.0 + (tooth - 0.5) * 2.0;
  } else if (kind == 5.0) { // a bank of sand
    float C = creekAt(P.y), dy = (creekAt(P.y + 2.0) - creekAt(P.y - 2.0)) / 4.0;
    float mouth = uCreek.w * exp(-sq((P.y - uMouth.x) / max(uMouth.y, 1.0)));
    float creek = (abs(P.x - C) - (uCreek.z + mouth + 16.0 * sin(P.y / 97.0) + 9.0 * sin(P.y / 41.0 + sign(P.x - C)))) / sqrt(1.0 + dy * dy);
    float y = P.y - S * (0.034 * sin(p.x * 2.3 + 0.9) + 0.020 * sin(p.x * 4.6 + 2.4 * p.y + 2.0)) - 62.0 * exp(-sq(creek / 190.0));
    float Yc = (y - vRect.y) / size.y - 0.5;
    float px = p.x;
    float h = 0.40 + 0.19 * sin(px * 4.4 + r.x * 41.0) + 0.13 * sin(px * 8.3 - r.x * 23.0);
    h = min(h, 0.55);
    float off = Yc + 0.05 * sin(px * 6.0 + r.x * 30.0);
    d = (h - abs(off)) * size.y;
    if (d < -12.0) discard;
    float gut = 0.7 * smoothstep(0.30, 0.5, h) * smoothstep(-0.3, 0.8, sin(px * 5.1 + r.x * 60.0)) - 0.52;
    d = min(d, (abs(off - 0.1 * sin(px * 5.4 + r.x * 9.0)) - gut) * size.y);
    d = smin(d, creek, 12.0);
    float lx = X.x - 10.0 * (r.y - 0.5) * Yc * 2.0, rx = size.x - X.x + 10.0 * (r.z - 0.5) * Yc * 2.0;
    d = smin(d, min(lx, rx), 7.0);
    d += (wob - 0.5) * 5.4;
    q = vec2(q.x, off * 1.6);
    q = clamp(q, -1.0, 1.0);
  } else if (kind == 6.0) { // a run of paint
    float hw = size.x * 0.5, end = size.y * grow;
    float cx = X.x - hw - 1.8 * sin(X.y / 43.0 + r.x * TAU) - 1.0 * sin(X.y / 17.0 + r.y * TAU);
    float rd = hw * mix(0.62 + 0.38 * exp(-X.y / (hw * 2.0)), 1.0, smoothstep(end - hw * 5.0, end - hw, X.y));
    d = rd - length(vec2(cx, max(X.y - (end - hw), 0.0)));
    d = min(d, X.y + 4.0);
    d += (wob - 0.5) * 2.4;
    body = 0.5 * smoothstep(end - hw * 6.0, end, X.y) - 0.75 * (1.0 - smoothstep(0.0, 12.0, X.y));
    rimK = smoothstep(0.0, 14.0, X.y);
    grow = 1.0;
  } else { // a square laid by hand
    vec2 t = (r.zy - 0.5) * min(vec2(0.10), 11.0 / size.yx);
    float L = X.x + t.x * (X.y - size.y * 0.5), T = X.y + t.y * (X.x - size.x * 0.5);
    float lx = min(L, size.x - L), ly = min(T, size.y - T);
    d = smin(lx, ly, 6.0 * tiny);
    d += ((wob - 0.5) * 4.6 + (noise(p * 7.0 + r.x * 9.0) - 0.5) * 2.4) * tiny;
  }

  // the wet front, while the wash is being laid
  float big = max(min(size.x, size.y), 60.0), reach = length(size);
  if (grow < 1.0) {
    float f = length(X - vState.yz * size) + (cloud - 0.5) * 0.55 * big + (lump - 0.5) * 12.0;
    d = min(d, grow * (reach + 0.4 * big) - f);
  }
  float e = max(uPixel, 0.8) * soft;
  if (d < -e - 1.0) discard;
  float on = smoothstep(-e, e, d);
  float ds = max(d, 0.0);
  float dark = 1.0 - dot(vInk.rgb, vec3(0.3, 0.5, 0.2));
  float rim = exp(-ds / ((2.7 + 1.1 * r.x) * max(tiny, 0.4))) * rimK;
  float inner = exp(-sq((ds - 9.9) / 7.2));
  float lean = dot(clamp(q, -1.2, 1.2), vec2(cos(r.y * TAU), sin(r.y * TAU)) * 0.5);
  float pool = 0.82 + body + 0.30 * lean + 0.40 * (cloud - 0.5);
  float k;
  vec3 ink = mix(vInk.rgb, vInk2.rgb, smoothstep(0.30, 0.72, cloud + 0.22 * lean + 0.12 * (grain - 0.5)));

  if (kind == 4.0) { // the tide rims it left as it drew in
    float R = min(size.x, size.y) * 0.5, off = 0.0, lay = 0.34 + 0.22 * (cloud - 0.5), n = noise(p * 3.4 + r.x * 9.0), n2 = noise(p * 3.1 + 50.0);
    for (int i = 0; i < 4; i++) {
      float fi = float(i), hn = fract(r.z * 3.31 + fi * 0.618);
      float x = d - off * R - fi * 0.10 * R * (mix(n, n2, fract(hn * 7.0)) - 0.4);
      off += 0.09 + 0.15 * fract(r.w * 5.17 + fi * 0.381);
      if (x < -3.0) continue;
      float o = smoothstep(-1.2, 1.2, x); x = max(x, 0.0);
      float fade = 1.0 / (1.0 + x / (30.0 + 50.0 * hn));
      float here = i == 0 ? 0.85 : (0.16 + 0.42 * hn * hn) * smoothstep(0.15, 0.60, mix(n2, 1.0 - n, fract(hn * 19.0)));
      lay += o * (0.05 + (1.25 * exp(-x / 3.6) + 0.50 * fade * fade) * here * vExtra.y);
    }
    k = vInk.w * on * (lay + (grain - 0.5) * (0.16 + 0.4 * dark));
  } else {
    // a bloom: water dropped back into the half dry wash
    float bl = length(q - (r.zw - 0.5) * 1.3) - 0.35 - 0.5 * r.z + (wob - 0.5) * 0.5;
    pool += step(0.66, r.x) * vExtra.y * (-0.22 * (1.0 - smoothstep(-0.5, 0.1, bl)) + 0.24 * exp(-bl * bl * 160.0));
    k = vInk.w * on * (pool + rim - 0.10 * inner * rimK + (grain - 0.5) * (0.28 + 0.6 * dark));
  }
  // and one a visitor let fall
  if (vDrop.w > 0.0) {
    float rr = vDrop.z, b = length(P - vDrop.xy) - rr + (lump - 0.5) * 0.5 * rr + (noise(p * 70.0) - 0.5) * 0.22 * rr;
    k *= 1.0 - 0.62 * vDrop.w * (1.0 - smoothstep(-0.55 * rr, 0.0, b));
    k += 0.55 * vInk.w * on * vDrop.w * exp(-sq(b / 4.2)) + 0.14 * vInk.w * on * vDrop.w * (1.0 - smoothstep(0.0, 26.0, abs(b)));
  }
  k *= 0.45 + 0.55 * smoothstep(0.0, 1.0, grow);
  fragColor = vec4(pow(clamp(ink, 0.02, 1.0), vec3(max(k, 0.0))), 1.0);
}`
