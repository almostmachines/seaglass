// shared uniforms, helpers, and the sea-glass palette
// (a "#version 330 core" line is prepended by the app)

uniform vec2  uRes;      // drawable size in pixels
uniform float uTime;     // wall-clock seconds
uniform float uBass;     // band envelopes, 0..1
uniform float uMid;
uniform float uTreble;
uniform float uLevel;    // overall loudness envelope, 0..1
uniform float uBeat;     // 1.0 at a bass onset, exponential decay
uniform float uCentroid; // spectral centroid, 0 dark .. 1 bright
uniform float uFlow;     // accumulated musical time; prefer over uTime for motion
uniform sampler2D uSpec; // 96x1 log-spaced spectrum, 0..1
uniform sampler2D uWave; // 512x1 recent waveform, -1..1

out vec4 fragColor;

const float PI = 3.141592653589793;

float spec(float x) { return texture(uSpec, vec2(clamp(x, 0.0, 1.0), 0.5)).r; }
float wav(float x)  { return texture(uWave, vec2(clamp(x, 0.0, 1.0), 0.5)).r; }

float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash12(i);
    float b = hash12(i + vec2(1.0, 0.0));
    float c = hash12(i + vec2(0.0, 1.0));
    float d = hash12(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
    float v = 0.0, amp = 0.5;
    mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 5; i++) {
        v += amp * vnoise(p);
        p = r * p * 2.03 + 11.7;
        amp *= 0.5;
    }
    return v;
}

mat2 rot(float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, -s, s, c);
}

// the palette: colours of glass the sea has polished
const vec3 DEEP  = vec3(0.012, 0.045, 0.055);
const vec3 JADE  = vec3(0.13, 0.50, 0.42);
const vec3 AQUA  = vec3(0.36, 0.80, 0.74);
const vec3 FROST = vec3(0.78, 0.93, 0.90);
const vec3 AMBER = vec3(0.98, 0.72, 0.40);

vec3 seaglass(float t) {
    t = clamp(t, 0.0, 1.0);
    vec3 c = mix(DEEP * 2.0, JADE, smoothstep(0.00, 0.35, t));
    c = mix(c, AQUA, smoothstep(0.35, 0.70, t));
    c = mix(c, FROST, smoothstep(0.70, 1.00, t));
    return c;
}

// vignette + tonemap + dither, applied to every scene by the footer
vec3 finish(vec3 col, vec2 fc) {
    vec2 uv = fc / uRes;
    vec2 v = uv * (1.0 - uv);
    col *= 0.35 + 0.65 * pow(clamp(v.x * v.y * 18.0, 0.0, 1.0), 0.35);
    col = 1.0 - exp(-max(col, 0.0) * 1.15);
    col = pow(col, vec3(0.4545));
    col += (hash12(fc + fract(uTime) * 61.7) - 0.5) / 255.0;
    return col;
}
