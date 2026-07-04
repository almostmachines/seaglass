// bloom — a breathing mandala: spectrum corona, circular oscilloscope,
// and a molten core that warms with the bass

vec4 render(vec2 fc) {
    vec2 q = (fc - 0.5 * uRes) / uRes.y;
    float r = length(q);
    float ang = atan(q.y, q.x);
    float an = mod(ang + 1.5 * PI, 2.0 * PI) - PI;
    float xn = abs(an) / PI; // 0 at the bottom (bass) .. 1 at the top (treble)

    float s = spec(0.03 + 0.94 * xn);
    float R = 0.30 * (1.0 + 0.09 * uBass + 0.02 * uBeat);

    vec3 col = DEEP * 0.8 * (1.0 - 0.5 * r);

    // spectrum corona
    float h = 0.045 + 0.36 * s * s + 0.03 * uBass;
    float dr = r - R;
    float bar = smoothstep(h, h * 0.25, dr) * smoothstep(-0.015, 0.006, dr);
    col += seaglass(0.25 + 0.45 * xn + 0.20 * uCentroid) * bar * (0.18 + 0.75 * s);

    // the ring itself
    float wl = 0.0035 * (1.0 + 1.5 * uBeat);
    col += FROST * (wl * wl / (dr * dr + wl * wl)) * (0.30 + 0.40 * uLevel);

    // circular oscilloscope inside the ring
    float rw = R * 0.62 + wav(xn) * 0.05 * (1.0 + 0.5 * uBass);
    float dw = r - rw;
    float ww = 0.004 + 0.003 * uLevel;
    col += mix(AQUA, FROST, 0.5) * (ww * ww / (dw * dw + ww * ww))
           * (0.30 + 0.80 * uLevel);

    // molten core
    vec2 cq = rot(uFlow * 0.15) * q;
    float n = fbm(cq * 4.0 + uFlow * 0.20);
    vec3 corec = mix(JADE, AMBER, clamp(0.15 + 0.9 * uBass, 0.0, 1.0));
    col += corec * exp(-r * 13.0) * (0.25 + 0.85 * uLevel + 0.55 * uBeat)
           * (0.5 + 0.6 * n);

    // a ripple that runs outward on each beat
    float rip = mix(R * 1.05, 1.25, 1.0 - uBeat);
    col += AQUA * 0.5 * uBeat * exp(-abs(r - rip) * 30.0);

    // slow dust orbiting between core and ring: tiny round motes
    vec2 cell = vec2((ang + uFlow * 0.22) * 22.0, r * 36.0);
    float dust = hash12(floor(cell) + 0.7);
    vec2 cf = fract(cell) - 0.5;
    float pt = smoothstep(0.30, 0.05, length(cf));
    float mask = smoothstep(R * 0.30, R * 0.55, r) * smoothstep(R * 2.2, R * 1.0, r);
    float dtw = smoothstep(0.990, 1.0, dust)
              * (0.5 + 0.5 * sin(uTime * 4.0 + dust * 50.0));
    col += FROST * dtw * pt * mask * (0.08 + 0.40 * uTreble);

    return vec4(col, 1.0);
}
