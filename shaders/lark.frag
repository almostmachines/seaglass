// lark — daybreak above the shore. the sun is still below the sand,
// so the spectrum fans out of it as rays of light; nacreous clouds
// catch the colour from beneath, a murmuration wheels overhead, and
// the waveform is a swift's path drawn in vapour. the loud one.

const float YH = 0.15; // a thin dark shore holds the foot of the frame

// the dawn palette: night at the zenith, fire at the horizon
const vec3 INDIGO = vec3(0.050, 0.070, 0.240);
const vec3 VIOLET = vec3(0.280, 0.150, 0.500);
const vec3 MAUVE  = vec3(0.600, 0.380, 0.640);
const vec3 ROSE   = vec3(0.960, 0.470, 0.580);
const vec3 EMBER  = vec3(1.000, 0.520, 0.260);
const vec3 GOLD   = vec3(1.000, 0.880, 0.600);

vec3 dawn(float t) {
    t = clamp(t, 0.0, 1.0);
    vec3 c = mix(INDIGO, VIOLET, smoothstep(0.00, 0.30, t));
    c = mix(c, MAUVE, smoothstep(0.25, 0.50, t));
    c = mix(c, ROSE,  smoothstep(0.45, 0.70, t));
    c = mix(c, EMBER, smoothstep(0.65, 0.86, t));
    c = mix(c, GOLD,  smoothstep(0.84, 1.00, t));
    return c;
}

vec4 render(vec2 fc) {
    vec2 uv = fc / uRes;
    float aspect = uRes.x / uRes.y;
    vec2 p = vec2((uv.x - 0.5) * aspect, uv.y);

    // the sun waits just under the shore, wandering a little
    vec2 sunp = vec2(0.12 * sin(uFlow * 0.04), YH - 0.10);
    vec2 sd = p - sunp;
    float slen = length(sd);
    float sang = atan(sd.x, sd.y); // 0 = straight up from the sun

    // how far into daybreak we are: bright music gilds the sky
    float day = clamp(0.30 + 0.45 * uCentroid + 0.25 * uLevel, 0.0, 1.0);

    // --- the sky: indigo overhead falling to fire at the horizon ---
    float up = smoothstep(YH, 1.0, uv.y);
    vec3 col = dawn(pow(1.0 - up, 1.25) * (0.45 + 0.40 * day));

    // the sun's glow, gathered and broad
    col += dawn(0.92) * 0.60 * exp(-slen * slen * 10.0) * (0.6 + 0.4 * uLevel);
    col += EMBER * 0.28 * exp(-slen * 2.6) * (0.4 + 0.6 * day);

    // --- crepuscular rays: the spectrum itself, fanned across the sky.
    // angle from the sun maps to frequency — bass climbs straight up,
    // treble rakes out to the sides
    float fan = abs(sang) / 1.45;
    float s = spec(fan);
    float shaft = pow(s, 1.4)
                * exp(-slen * 1.2)
                * smoothstep(1.0, 0.85, fan)
                * (0.85 + 0.15 * vnoise(vec2(sang * 30.0, slen * 2.0 - uFlow * 0.6)));
    col += dawn(0.55 + 0.30 * s) * shaft * (0.30 + 0.60 * uLevel + 0.45 * uBeat);

    // the last stars at the zenith, giving way to the light
    vec2 sg = p * 220.0;
    float st = hash12(floor(sg));
    float ptt = smoothstep(0.40, 0.10, length(fract(sg) - 0.5));
    float tw = smoothstep(0.9975, 1.0, st) * (0.5 + 0.5 * sin(uTime * 2.5 + st * 90.0));
    col += vec3(0.90, 0.92, 1.00) * tw * ptt * smoothstep(0.55, 0.95, uv.y)
           * (1.0 - day) * (0.3 + 0.6 * uTreble);

    // --- nacreous clouds: two drifting layers lit from below ---
    for (int i = 0; i < 2; i++) {
        float fi = float(i);
        vec2 cp = vec2(p.x, (uv.y - YH) * (1.2 + 0.3 * fi)) * (2.0 + 1.5 * fi);
        cp.x -= uFlow * (0.040 + 0.030 * fi);
        vec2 wp = vec2(fbm(cp * 0.85 + 17.0 * fi),
                       fbm(cp * 0.85 + vec2(4.2, 9.1) - 13.0 * fi));
        vec2 cq = cp + (wp - 0.5) * 1.6;
        float den = fbm(cq);
        float lit = clamp((fbm(cq + vec2(0.0, 0.14)) - den) * 5.0, 0.0, 1.0);
        float cov = smoothstep(0.50 - 0.08 * uMid, 0.78, den)
                  * smoothstep(YH + 0.02, YH + 0.14, uv.y);
        float horiz = exp(-(uv.y - YH) * 2.2);
        vec3 cloud = mix(mix(INDIGO * 0.70, VIOLET * 0.75, den),
                         dawn(0.45 + 0.30 * horiz + 0.35 * lit + 0.15 * day),
                         clamp(lit * 1.2 + 0.25 * horiz, 0.0, 1.0));
        // mother-of-pearl shimmer along the thin fringes
        float edge = cov * (1.0 - cov) * 4.0;
        float tri = abs(fract(den * 2.4 + uCentroid * 0.7) * 2.0 - 1.0);
        cloud += dawn(tri) * 0.15 * edge * (0.25 + 0.75 * uMid);
        col = mix(col, cloud, cov * (0.60 + 0.20 * fi));
    }

    // --- the murmuration: birds wheeling on an unseen wind ---
    float band = smoothstep(YH + 0.10, YH + 0.28, uv.y) * smoothstep(0.95, 0.70, uv.y);
    vec2 gust = vec2(fbm(p * 1.6 + vec2(uFlow * 0.11, 0.0)),
                     fbm(p * 1.6 + vec2(3.3, uFlow * 0.09)));
    vec2 fp = p * 9.0 + (gust - 0.5) * (2.5 + 2.5 * uMid);
    fp.x -= uFlow * 0.9;
    float clump = smoothstep(0.45 - 0.10 * uBeat, 0.80,
                             fbm(p * 2.2 + vec2(uFlow * 0.07, -uFlow * 0.05) + 31.0));
    vec2 id = floor(fp);
    float h = hash12(id);
    vec2 b = (fract(fp) - 0.5 - (vec2(hash12(id + 11.1), hash12(id + 23.7)) - 0.5) * 0.5)
           * (5.0 + 3.0 * hash12(id + 5.5));
    float flap = sin(uTime * (9.0 + 8.0 * h) + h * 44.0);
    float k = 0.12 + (0.38 + 0.30 * uTreble) * flap; // treble deepens the wingbeat
    float bird = smoothstep(0.20, 0.05, abs(b.y + abs(b.x) * k))
               * smoothstep(1.05, 0.80, abs(b.x))
               * step(0.60, h) * clump * band;
    col = mix(col, INDIGO * 0.30, bird * 0.85);

    // --- the waveform: a swift's path drawn in vapour ---
    float fy = 0.64 + wav(uv.x) * (0.05 + 0.05 * uMid);
    float dyw = uv.y - fy;
    float th = 0.0035 + 0.0030 * uLevel;
    col += mix(GOLD, ROSE, 0.5 + 0.5 * sin(uv.x * 7.0 - uFlow * 0.4))
           * (th * th) / (dyw * dyw + th * th)
           * (0.25 + 0.85 * uLevel + 0.30 * uBeat);
    float th2 = 0.020; // the sun-warmed haze the path leaves behind
    col += ROSE * 0.30 * (th2 * th2) / (dyw * dyw + th2 * th2) * (0.2 + 0.8 * uLevel);

    // --- the shore: a dark edge holding all that light ---
    float shoreY = YH + 0.018 * fbm(vec2(uv.x * 3.5, 5.2)) - 0.009;
    float land = smoothstep(shoreY + 0.003, shoreY - 0.003, uv.y);
    vec3 shore = INDIGO * 0.18 * (0.5 + 0.5 * uv.y / YH);
    // wet sand remembering the glow above it
    shore += dawn(0.80) * exp(-abs(p.x - sunp.x) * 5.0) * exp(-(shoreY - uv.y) * 14.0)
             * (0.30 + 0.60 * uLevel)
             * (0.7 + 0.3 * vnoise(vec2(uv.x * 160.0, uv.y * 50.0 + uFlow * 1.2)));
    col = mix(col, shore, land);

    // the incandescent line where the sun is about to break
    col += dawn(0.88) * 0.35 * exp(-abs(uv.y - shoreY) * 90.0) * (0.4 + 0.6 * uLevel);

    col *= 1.0 + 0.12 * uBeat;
    return vec4(col, 1.0);
}
