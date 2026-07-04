// prism — a kinetic idea-engine: radial spectrum architecture, waveform
// lightning spirals, and a field of little generative sparks. Bass opens
// the reactor, mids bend the crystal lattice, treble throws glitter, and
// every beat launches a shockwave through the cathedral.

const vec3 VOID_PURPLE = vec3(0.018, 0.006, 0.055);
const vec3 INK_BLUE    = vec3(0.020, 0.030, 0.120);
const vec3 VOLT        = vec3(0.050, 0.920, 1.000);
const vec3 LIMEFIRE    = vec3(0.280, 1.000, 0.560);
const vec3 HOTPINK     = vec3(1.000, 0.140, 0.540);
const vec3 SUNFORGE    = vec3(1.000, 0.820, 0.240);

float glow(float d, float w) {
    return (w * w) / (d * d + w * w);
}

vec3 muse(float t) {
    t = fract(t);
    vec3 c = mix(HOTPINK, VOLT, smoothstep(0.00, 0.28, t));
    c = mix(c, LIMEFIRE, smoothstep(0.24, 0.52, t));
    c = mix(c, SUNFORGE, smoothstep(0.48, 0.76, t));
    c = mix(c, HOTPINK, smoothstep(0.72, 1.00, t));
    return c;
}

vec4 render(vec2 fc) {
    vec2 uv = fc / uRes;
    vec2 q = (fc - 0.5 * uRes) / uRes.y;
    float r = length(q);
    float a = atan(q.y, q.x);
    float an = fract((a + PI) / (2.0 * PI));

    float energy = clamp(0.12 + 0.82 * uLevel + 0.35 * uBeat, 0.0, 1.0);

    // A living background field: mids pull the paper of space around.
    vec2 warp = vec2(fbm(q * 1.7 + vec2(uFlow * 0.19,  3.1)),
                     fbm(q * 1.7 + vec2(7.4, -uFlow * 0.16))) - 0.5;
    float dream = fbm(q * 2.6 + warp * (1.5 + 3.0 * uMid) + vec2(uFlow * 0.045, 0.0));
    vec3 col = mix(VOID_PURPLE, INK_BLUE, smoothstep(-0.10, 1.12, uv.y + 0.25 * dream));
    col += muse(0.08 + 0.55 * dream + 0.22 * uCentroid) * dream * dream
           * (0.07 + 0.18 * uMid + 0.10 * energy);

    // Kaleidoscopic spectral ribs. The number of ribs follows brightness:
    // dark music is octagonal, bright music unfolds into many-sided glass.
    float sectors = 8.0 + floor(uCentroid * 7.0);
    float sector = 2.0 * PI / sectors;
    float angleWobble = 0.050 * sin(uFlow * 0.48 + r * 9.0)
                      + 0.030 * wav(fract(an + 0.17));
    float folded = abs(mod(a + angleWobble + sector * 0.5, sector) - sector * 0.5);
    float spineD = abs(r * sin(folded));
    float harmonic = fract(an * 0.82 + r * 0.23 - uFlow * 0.035);
    float hs = spec(harmonic);
    float ribs = glow(spineD, 0.0045 + 0.0080 * hs + 0.0040 * uBeat)
               * pow(hs, 1.25)
               * smoothstep(0.055, 0.240, r) * smoothstep(1.18, 0.20, r);
    col += muse(harmonic + 0.12 * uCentroid) * ribs * (0.22 + 1.10 * energy);

    // Fine secondary veins, like lead lines in impossible stained glass.
    float veinD = abs(folded - sector * 0.34) * r;
    float veinSpec = spec(fract(harmonic + 0.19));
    col += muse(harmonic + 0.28) * glow(veinD, 0.0025 + 0.0045 * uTreble)
           * veinSpec * smoothstep(0.10, 0.30, r) * smoothstep(1.05, 0.28, r)
           * (0.05 + 0.35 * uTreble);

    // The spectrum as a rotating crown of architectural bars.
    float fx = fract(an + 0.035 * sin(r * 7.0 - uFlow * 0.45));
    float sx = spec(fx);
    float baseR = 0.225 + 0.018 * sin(6.0 * a + uFlow * 0.7);
    float topR = baseR + 0.105 + 0.430 * sx * sx
               + wav(fx) * (0.022 + 0.035 * uBass);
    float crown = smoothstep(baseR - 0.008, baseR + 0.006, r)
                * smoothstep(topR + 0.012, topR - 0.018, r);
    float facets = pow(0.5 + 0.5 * cos((an * 96.0 + uFlow * 0.28) * 2.0 * PI), 7.0);
    crown *= 0.35 + 0.65 * facets;
    col += muse(fx + 0.08 * uCentroid) * crown * (0.10 + 1.35 * sx) * (0.45 + 0.85 * energy);

    float crownEdge = glow(abs(r - baseR), 0.0035)
                    + glow(abs(r - topR), 0.0040 + 0.0030 * sx);
    col += mix(FROST, muse(fx + 0.15), 0.65) * crownEdge * sx
           * (0.06 + 0.42 * uLevel + 0.25 * uBeat)
           * smoothstep(0.16, 0.32, r) * smoothstep(1.02, 0.22, r);

    // Three skewed lattice layers: each cell samples a different band, so
    // harmonies literally choose which panes light up.
    for (int i = 0; i < 3; i++) {
        float fi = float(i);
        vec2 lp = rot(0.34 + fi * 0.71 + 0.12 * sin(uFlow * 0.13))
                * (q + warp * (0.030 + 0.018 * fi));
        lp *= 5.5 + fi * 3.7 + 2.2 * uCentroid;
        lp += vec2(uFlow * (0.15 + 0.05 * fi), -uFlow * (0.10 + 0.04 * fi));
        vec2 id = floor(lp);
        vec2 gf = fract(lp) - 0.5;
        float grid = max(glow(abs(abs(gf.x) - 0.5), 0.010 + 0.004 * uLevel),
                         glow(abs(abs(gf.y) - 0.5), 0.010 + 0.004 * uLevel));
        float h = hash12(id + 17.0 * fi);
        float cs = spec(fract(h * 0.82 + an * 0.22 + 0.09 * fi));
        float alive = smoothstep(0.18, 0.92, cs + 0.36 * uMid + 0.25 * uBeat - 0.10 * fi);
        col += muse(h + 0.22 * uCentroid) * grid * alive
               * (0.018 + 0.045 * cs) * smoothstep(1.05, 0.12, r);
    }

    // The waveform becomes two electrical spirals: the song writes itself
    // around the reactor rather than merely crossing the screen.
    for (int i = 0; i < 2; i++) {
        float fi = float(i);
        float ph = fract(an + 0.5 * fi + uFlow * (0.045 + 0.015 * fi));
        float wr = 0.105 + 0.760 * ph + wav(ph) * (0.045 + 0.052 * uBass);
        float sd = abs(r - wr);
        float taper = smoothstep(0.075, 0.18, r) * smoothstep(0.96, 0.70, r);
        vec3 wc = mix(FROST, muse(ph + 0.18 + 0.27 * fi), 0.72);
        col += wc * glow(sd, 0.0040 + 0.0045 * uLevel) * taper
               * (0.20 + 1.18 * uLevel + 0.30 * uBeat);
        col += muse(ph + 0.35) * glow(sd, 0.026) * taper * (0.05 + 0.18 * uLevel);
    }

    // Treble sparks: rare little decisions in a travelling probability field.
    vec2 sp = q * (44.0 + 18.0 * uTreble) + warp * 4.0
            + vec2(-uFlow * 2.2, uFlow * 1.35);
    vec2 sid = floor(sp);
    vec2 sf = fract(sp) - 0.5;
    float sh = hash12(sid);
    vec2 off = vec2(hash12(sid + 13.7), hash12(sid + 41.2)) - 0.5;
    float sparkShape = smoothstep(0.18, 0.020, length(sf - off * 0.38));
    float rare = smoothstep(0.989 - 0.010 * uTreble - 0.006 * uBeat, 1.0, sh);
    float twinkle = 0.45 + 0.55 * sin(uTime * (8.0 + 11.0 * sh) + sh * 80.0);
    col += mix(FROST, muse(sh), 0.58) * sparkShape * rare * twinkle
           * (0.22 + 1.70 * uTreble) * smoothstep(1.08, 0.04, r);

    // Beat shockwave and bass reactor.
    float shockR = 0.10 + (1.0 - uBeat) * 0.96;
    float shock = glow(abs(r - shockR), 0.006 + 0.014 * (1.0 - uBeat))
                * uBeat * smoothstep(1.18, 0.18, r);
    col += mix(HOTPINK, SUNFORGE, uBass) * shock * (0.50 + 1.35 * uBass);

    float coreNoise = fbm(q * 8.0 + warp * 3.0 + vec2(0.0, uFlow * 0.30));
    float core = exp(-r * r * (23.0 - 12.0 * uBass));
    col += mix(HOTPINK, SUNFORGE, clamp(0.20 + 0.90 * uBass, 0.0, 1.0))
           * core * (0.38 + 1.60 * uBass + 1.85 * uBeat) * (0.55 + 0.85 * coreNoise);
    col += FROST * glow(abs(r - (0.055 + 0.030 * uBass + 0.026 * uBeat)),
                        0.004 + 0.006 * uBeat)
           * (0.28 + 0.70 * uBeat + 0.52 * uLevel);

    // A little collective lift, because the whole thing should feel like yes.
    col *= 1.0 + 0.18 * uBeat + 0.10 * uLevel;
    return vec4(col, 1.0);
}
