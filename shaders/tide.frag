// tide — layered drifting ribbons with a luminous waveform thread

vec4 render(vec2 fc) {
    vec2 uv = fc / uRes;
    float aspect = uRes.x / uRes.y;
    vec2 p = vec2(uv.x * aspect, uv.y);

    vec3 col = mix(DEEP * 0.4, DEEP * 1.3, uv.y);

    // drifting haze
    float haze = fbm(p * 1.1 + vec2(uFlow * 0.06, uFlow * 0.013));
    col += JADE * 0.06 * haze * (0.35 + 0.65 * uMid);

    // five ribbons: bass at the bottom, treble at the top
    for (int i = 0; i < 5; i++) {
        float fi = float(i);
        float e = spec(0.06 + 0.21 * fi + 0.05 * sin(uFlow * 0.4 + fi * 2.1));
        float amp = 0.045 + 0.16 * e;
        float y = 0.20 + 0.15 * fi
                + (fbm(vec2(p.x * 1.35 + uFlow * (0.10 + 0.028 * fi),
                            fi * 9.7 + uFlow * 0.02)) - 0.5) * amp * 2.2
                + (spec(uv.x * 0.85 + 0.05) - 0.35) * 0.04;
        float d = uv.y - y;
        float w = 0.008 + 0.030 * e * (1.0 + 0.7 * uBass);
        float g = (w * w) / (d * d + w * w);
        vec3 rc = seaglass(0.12 + 0.19 * fi + 0.12 * uCentroid);
        if (i == 0) rc = mix(rc, AMBER, 0.45 * uBass);
        col += rc * g * (0.08 + 0.40 * e);
    }

    // the waveform as a bright thread, with a whisper of chroma
    float ampw = 0.16 * (1.0 + 0.4 * uBass);
    float px = 1.5 / uRes.x;
    float yc = 0.5 + wav(uv.x) * ampw;
    float yr = 0.5 + wav(uv.x - px) * ampw;
    float yb = 0.5 + wav(uv.x + px) * ampw;
    float w2 = 0.0045 + 0.004 * uLevel;
    float gc = (w2 * w2) / ((uv.y - yc) * (uv.y - yc) + w2 * w2);
    float gr = (w2 * w2) / ((uv.y - yr) * (uv.y - yr) + w2 * w2);
    float gb = (w2 * w2) / ((uv.y - yb) * (uv.y - yb) + w2 * w2);
    col += (FROST * gc + vec3(0.25, 0.05, 0.02) * gr + vec3(0.02, 0.06, 0.25) * gb)
           * (0.18 + 0.60 * uLevel);

    // treble sparks drifting upward
    vec2 sp = fc * 0.5 + vec2(0.0, -uTime * 9.0);
    float st = hash12(floor(sp / 3.0));
    float tw = smoothstep(0.997, 1.0, st)
             * max(0.0, 0.4 + 0.6 * sin(uTime * 7.0 + st * 40.0));
    col += FROST * tw * uTreble * smoothstep(0.35, 0.95, uv.y) * 0.8;

    col *= 1.0 + 0.22 * uBeat;
    return vec4(col, 1.0);
}
