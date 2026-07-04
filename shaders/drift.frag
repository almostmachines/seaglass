// drift — a night shoreline: slow nebula sky, stars that answer the
// treble, and the waveform as the light along the horizon

const float YH = 0.42;

vec3 skyAt(vec2 su, float aspect) {
    vec2 p = vec2(su.x * aspect, su.y);
    vec2 warp = vec2(fbm(p * 1.2 + uFlow * 0.020),
                     fbm(p * 1.2 + 7.3 - uFlow * 0.015));
    float n = fbm(p * 1.9 + (warp - 0.5) * 1.6 + vec2(uFlow * 0.03, 0.0));
    float nn = smoothstep(0.35, 0.95, n);
    vec3 sky = mix(DEEP * 0.55, DEEP * 1.6, clamp(su.y, 0.0, 1.0));
    sky += seaglass(0.20 + 0.55 * nn + 0.20 * uCentroid) * nn
           * (0.16 + 0.42 * uMid + 0.25 * uLevel);

    // stars: rare cells lit as small round points
    vec2 sg = p * 240.0;
    float st = hash12(floor(sg));
    vec2 sf = fract(sg) - 0.5;
    float pt = smoothstep(0.45, 0.10, length(sf));
    float tw = smoothstep(0.9972, 1.0, st)
             * (0.55 + 0.45 * sin(uTime * 3.0 + st * 80.0));
    sky += FROST * tw * pt * (0.25 + 0.55 * uTreble)
           * smoothstep(YH + 0.03, 0.75, su.y);

    // a faint band of light hugging the horizon
    sky += AQUA * 0.05 * exp(-abs(su.y - YH) * 9.0);
    return sky;
}

vec4 render(vec2 fc) {
    vec2 uv = fc / uRes;
    float aspect = uRes.x / uRes.y;

    vec3 col;
    if (uv.y >= YH) {
        col = skyAt(uv, aspect);
    } else {
        // the sea: the sky mirrored, jittered, and dimmed with depth
        float depth = YH - uv.y;
        float jig = (vnoise(vec2(uv.x * 90.0, uv.y * 160.0 - uFlow * 0.8)) - 0.5)
                  * 0.012 * (1.0 + 2.0 * depth) * (0.6 + 0.8 * uBass);
        vec2 su = vec2(uv.x + jig, YH + depth * 1.15);
        col = skyAt(su, aspect) * 0.42 * exp(-depth * 2.6);
        col = mix(col, DEEP * 0.45, 0.30);

        // shimmer under the horizon light
        float shim = 0.75 + 0.25 * vnoise(vec2(uv.x * 140.0, uTime * 2.0));
        col += AMBER * 0.06 * exp(-depth * 7.0) * (0.25 + 0.75 * uLevel) * shim;
        col += AQUA * 0.05 * exp(-depth * 3.0) * (0.3 + 0.7 * uMid);
    }

    // the waveform is the light on the horizon
    float wv = wav(uv.x) * 0.035 * (1.0 + 0.5 * uBass);
    float dh = uv.y - (YH + wv);
    float wt = 0.0035 + 0.0025 * uLevel;
    float gh = (wt * wt) / (dh * dh + wt * wt);
    col += mix(FROST, AMBER, 0.25 + 0.35 * uBass) * gh
           * (0.30 + 0.80 * uLevel + 0.25 * uBeat);

    col *= 1.0 + 0.10 * uBeat;
    return vec4(col, 1.0);
}
