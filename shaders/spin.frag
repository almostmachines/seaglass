// spin — the laundromat at the end of the signal.
//
// Every frequency has been put through its own front-loader. Bass makes
// the drums knock against their cabinets, mids tumble the impossible
// contents, and treble liberates bubbles and the occasional lost sock.
// The waveform is the badly-wired neon cable above the machines. Nobody
// knows what the sign says; it rewrites itself when the music dreams.

const vec3 NIGHT     = vec3(0.014, 0.008, 0.045);
const vec3 TILEBLUE  = vec3(0.035, 0.055, 0.120);
const vec3 ENAMEL    = vec3(0.270, 0.310, 0.370);
const vec3 CHROME    = vec3(0.680, 0.810, 0.900);
const vec3 ELECTRIC  = vec3(0.050, 0.930, 1.000);
const vec3 ACID      = vec3(0.710, 1.000, 0.120);
const vec3 CANDY     = vec3(1.000, 0.075, 0.570);
const vec3 TANGERINE = vec3(1.000, 0.410, 0.080);
const vec3 VIOLET    = vec3(0.460, 0.100, 1.000);

float lobe(float d, float w) { return (w * w) / (d * d + w * w); }

float sdRoundBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

float sdSegment(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
}

vec3 neon(float t) {
    t = fract(t);
    vec3 c = mix(CANDY, TANGERINE, smoothstep(0.00, 0.22, t));
    c = mix(c, ACID,      smoothstep(0.20, 0.43, t));
    c = mix(c, ELECTRIC,  smoothstep(0.41, 0.68, t));
    c = mix(c, VIOLET,    smoothstep(0.66, 0.86, t));
    c = mix(c, CANDY,     smoothstep(0.84, 1.00, t));
    return c;
}

// A seven-ish segment alphabet with too many diagonals. The glyphs are
// deterministic for a while, then musical time gives the sign a new word.
float rune(vec2 p, float id, float epoch) {
    float seed = id * 17.13 + epoch * 31.7;
    float d = 10.0;
    float on;
    on = step(0.38, hash12(vec2(seed, 1.0)));
    d = min(d, mix(10.0, sdSegment(p, vec2(-0.28,  0.42), vec2( 0.28,  0.42)), on));
    on = step(0.48, hash12(vec2(seed, 2.0)));
    d = min(d, mix(10.0, sdSegment(p, vec2(-0.30,  0.38), vec2(-0.30,  0.00)), on));
    on = step(0.48, hash12(vec2(seed, 3.0)));
    d = min(d, mix(10.0, sdSegment(p, vec2( 0.30,  0.38), vec2( 0.30,  0.00)), on));
    on = step(0.42, hash12(vec2(seed, 4.0)));
    d = min(d, mix(10.0, sdSegment(p, vec2(-0.25,  0.00), vec2( 0.25,  0.00)), on));
    on = step(0.48, hash12(vec2(seed, 5.0)));
    d = min(d, mix(10.0, sdSegment(p, vec2(-0.30,  0.00), vec2(-0.30, -0.40)), on));
    on = step(0.48, hash12(vec2(seed, 6.0)));
    d = min(d, mix(10.0, sdSegment(p, vec2( 0.30,  0.00), vec2( 0.30, -0.40)), on));
    on = step(0.38, hash12(vec2(seed, 7.0)));
    d = min(d, mix(10.0, sdSegment(p, vec2(-0.28, -0.42), vec2( 0.28, -0.42)), on));
    on = step(0.64, hash12(vec2(seed, 8.0)));
    d = min(d, mix(10.0, sdSegment(p, vec2(-0.25,  0.36), vec2( 0.25, -0.36)), on));
    on = step(0.68, hash12(vec2(seed, 9.0)));
    d = min(d, mix(10.0, sdSegment(p, vec2( 0.25,  0.36), vec2(-0.25, -0.36)), on));
    return d;
}

// One machine. Coordinates are normalized so the enamel case is about a
// unit square. RGB is its surface and alpha is the silhouette; halo is
// allowed to escape that silhouette and is added by the room.
vec4 washer(vec2 q, float band, float seed, float aa, out vec3 halo) {
    float e = spec(band);
    float a = aa;
    float knock = uBeat * (0.010 + 0.018 * (1.0 - band)) * sin(seed * 19.0 + uFlow * 2.0);
    q.x += knock;

    float bodyD = sdRoundBox(q, vec2(0.455, 0.485), 0.055);
    float body = smoothstep(a, -a, bodyD);
    float edge = lobe(abs(bodyD), 0.010 + 0.004 * uBeat);

    // Baked enamel, lit by the machines on either side.
    float face = 0.72 + 0.23 * q.x - 0.18 * q.y;
    float stipple = hash12(floor((q + seed) * 90.0));
    vec3 c = ENAMEL * (face + 0.055 * stipple);
    c += CHROME * edge * 0.22;
    c = mix(c, NIGHT * 0.5, smoothstep(0.405, 0.455, abs(q.x)));

    // Recessed control strip.
    float panelD = sdRoundBox(q - vec2(0.0, 0.345), vec2(0.395, 0.072), 0.018);
    float panel = smoothstep(a, -a, panelD);
    vec3 pc = mix(vec3(0.025, 0.033, 0.060), vec3(0.075, 0.090, 0.125), q.x * 0.8 + 0.5);
    c = mix(c, pc, panel * 0.96);

    // Eight tiny analyzer lamps. Each machine looks around its own band.
    float lampCell = floor((q.x + 0.245) * 15.5);
    float lx = fract((q.x + 0.245) * 15.5) - 0.5;
    float lampBand = clamp(band + (lampCell - 3.5) * 0.010, 0.0, 1.0);
    float lampE = spec(lampBand);
    float lamp = smoothstep(0.25, 0.08, length(vec2(lx, (q.y - 0.345) * 15.5)))
               * step(abs(q.x), 0.255) * panel;
    vec3 lc = neon(lampBand + uCentroid * 0.24);
    c += lc * lamp * (0.20 + 2.3 * lampE + 0.8 * uBeat);

    // An unnecessarily important knob and coin eye.
    float knobR = length(q - vec2(0.327, 0.345));
    float knob = smoothstep(a, -a, knobR - 0.040);
    c = mix(c, CHROME * (0.18 + 0.82 * smoothstep(0.04, 0.0, knobR)), knob);
    c += neon(seed) * lobe(abs(knobR - 0.025), 0.005) * (0.2 + e);
    float coin = smoothstep(a, -a, sdRoundBox(q - vec2(-0.340, 0.345), vec2(0.030, 0.043), 0.008));
    c = mix(c, vec3(0.015, 0.020, 0.035), coin);
    c += ACID * lobe(abs(q.y - 0.345), 0.003) * coin * (0.2 + 1.4 * e);

    // The porthole. It is not entirely agreed what is being washed.
    vec2 z = q - vec2(0.0, -0.065);
    float r = length(z);
    float ang = atan(z.y, z.x);
    float doorR = 0.292 + 0.014 * uBass + 0.010 * uBeat;
    float inside = smoothstep(doorR - 0.020, doorR - 0.035, r);
    float ring = lobe(abs(r - doorR), 0.014) + 0.45 * lobe(abs(r - doorR * 0.87), 0.008);

    float spin = uFlow * (0.75 + 1.8 * band) + seed * 8.0;
    vec2 rz = rot(spin + 0.25 * sin(uFlow + seed)) * z / max(doorR, 0.001);
    float soup = fbm(rz * 2.9 + vec2(seed * 9.0, uFlow * 0.16));
    float spiral = 0.5 + 0.5 * sin(ang * (3.0 + floor(seed * 3.0))
                   - spin * 3.0 + r * 31.0 + 2.5 * soup);
    float waterline = smoothstep(-0.12 + 0.11 * sin(ang + spin), -0.21, rz.y);
    vec3 abyss = mix(NIGHT * 0.35, VIOLET * 0.32, soup);
    vec3 wash = mix(abyss, neon(band + spiral * 0.28 + uCentroid * 0.2),
                    (0.18 + 0.72 * spiral) * (0.30 + 0.70 * e));
    wash += mix(ELECTRIC, CHROME, 0.55) * waterline * (0.12 + 0.65 * e);

    // Three soft impossible garments chase one another in the drum.
    float blobs = 0.0;
    vec3 cloth = vec3(0.0);
    for (int i = 0; i < 3; i++) {
        float fi = float(i);
        float ph = spin * (0.75 + fi * 0.11) + fi * 2.094 + seed;
        vec2 bp = vec2(cos(ph), sin(ph)) * (0.25 + 0.22 * sin(ph * 1.7 + seed));
        vec2 bd = rz - bp;
        bd = rot(-ph * 0.7) * bd;
        float bl = exp(-dot(bd / vec2(0.30 + 0.08 * fi, 0.13 + 0.05 * e),
                            bd / vec2(0.30 + 0.08 * fi, 0.13 + 0.05 * e)) * 2.4);
        blobs += bl;
        cloth += neon(band + fi * 0.27 + seed) * bl;
    }
    wash = mix(wash, cloth / max(blobs, 1.0), clamp(blobs * (0.38 + 0.50 * uMid), 0.0, 0.88));

    // Aerated little cells gather at the top of loud drums.
    vec2 bg = rz * 12.0 + vec2(seed * 17.0, -uFlow * 0.8);
    vec2 bid = floor(bg);
    vec2 bf = fract(bg) - 0.5;
    float bh = hash12(bid + seed * 29.0);
    float bubble = lobe(abs(length(bf) - (0.10 + 0.17 * bh)), 0.035)
                 * step(0.63 - 0.35 * e, bh) * smoothstep(-0.4, 0.75, rz.y);
    wash += CHROME * bubble * (0.25 + 1.2 * e);

    c = mix(c, wash, inside);
    // Convex smoked glass and two travelling reflections.
    float glass = smoothstep(doorR - 0.025, 0.0, r);
    c *= 1.0 - 0.28 * glass * smoothstep(-0.2, 0.75, z.x + z.y);
    float slash = lobe(abs(z.x + z.y * 0.48 - 0.105), 0.010) * glass;
    c += CHROME * slash * (0.20 + 0.32 * uLevel);
    c += mix(CHROME, neon(band), 0.40) * ring * (0.32 + 0.85 * e + 0.50 * uBeat);

    // Rubber seal, feet, seams and one warning light that panics on beats.
    c *= 1.0 - 0.46 * smoothstep(0.018, 0.0, abs(r - doorR * 0.81));
    float seam = lobe(abs(q.y + 0.444), 0.004) + 0.4 * lobe(abs(q.x), 0.003);
    c += CHROME * seam * body * 0.08;
    float panic = smoothstep(a, -a, length(q - vec2(0.225, 0.345)) - 0.016);
    c += mix(ACID, CANDY, uBeat) * panic * (0.25 + 2.0 * e + 2.0 * uBeat);

    halo = neon(band + 0.15 * uCentroid) * lobe(max(bodyD, 0.0), 0.040)
         * (0.015 + 0.12 * e + 0.12 * uBeat);
    halo += neon(band) * lobe(abs(r - doorR), 0.060) * body
          * (0.018 + 0.14 * e);
    return vec4(max(c, 0.0), body);
}

// Lost socks escaping through the ceiling. The shape is a bent union of
// two rounded boxes; from a distance that is, scientifically, a sock.
vec3 escapedLaundry(vec2 p, float aspect) {
    vec2 g = p * vec2(7.0, 8.5) + vec2(-uFlow * 0.11, uFlow * 0.20);
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    float h = hash12(id);
    f -= (vec2(hash12(id + 7.1), hash12(id + 19.3)) - 0.5) * 0.45;
    f = rot((h - 0.5) * 4.0 + uFlow * (h - 0.5) * 0.4) * f;
    float leg = sdRoundBox(f - vec2(0.0, 0.08), vec2(0.075, 0.18), 0.045);
    float foot = sdRoundBox(f - vec2(0.075, -0.075), vec2(0.145, 0.070), 0.050);
    float sock = smoothstep(0.020, -0.005, min(leg, foot));
    float rare = step(0.970 - 0.035 * uTreble, h);
    float high = smoothstep(0.40, 0.58, p.y);
    vec3 c = neon(h + uCentroid * 0.2) * sock * rare * high;
    c *= 0.25 + 1.5 * uTreble + 0.8 * uBeat;
    // A bright cuff makes the silhouettes legible.
    c += CHROME * lobe(abs(f.y - 0.255), 0.018) * step(abs(f.x), 0.08)
       * rare * high * (0.1 + uTreble);
    return c;
}

vec4 render(vec2 fc) {
    vec2 uv = fc / uRes;
    float aspect = uRes.x / uRes.y;
    vec2 p = vec2((uv.x - 0.5) * aspect, uv.y);
    float aa = 1.35 / uRes.y;

    // Ceramic midnight: a tiled room whose grout is faintly alive.
    float cloud = fbm(p * 1.6 + vec2(uFlow * 0.018, -uFlow * 0.011));
    vec3 col = mix(NIGHT, TILEBLUE, uv.y * 0.72 + cloud * 0.17);
    col += mix(VIOLET, CANDY, uv.x) * 0.045 * cloud * cloud * (0.3 + uLevel);

    vec2 tile = vec2((p.x + 0.035 * sin(uv.y * 7.0)) / 0.205, uv.y / 0.135);
    vec2 tf = abs(fract(tile) - 0.5);
    float grout = max(smoothstep(0.485, 0.497, tf.x), smoothstep(0.475, 0.496, tf.y));
    float tileId = hash12(floor(tile));
    col = mix(col, mix(vec3(0.025, 0.055, 0.090), VIOLET * 0.28, tileId), grout * 0.34);
    // Every so often one grout line conducts the song.
    float liveWire = step(0.89, hash12(vec2(floor(tile.x), 81.0)));
    col += ELECTRIC * grout * liveWire * (0.010 + 0.075 * uTreble);

    // The unknowable shop sign.
    vec2 signp = p - vec2(0.0, 0.862);
    vec2 signb = vec2(min(0.72, aspect * 0.43), 0.092);
    float signD = sdRoundBox(signp, signb, 0.025);
    float sign = smoothstep(aa, -aa, signD);
    float signRim = lobe(abs(signD), 0.007);
    vec3 signFace = mix(vec3(0.012, 0.006, 0.035), vec3(0.055, 0.012, 0.095), uv.x);
    col = mix(col, signFace, sign * 0.96);
    col += mix(VIOLET, ELECTRIC, uCentroid) * signRim * (0.18 + 0.32 * uLevel + 0.7 * uBeat);

    float gx = (signp.x / signb.x * 0.5 + 0.5) * 11.0;
    float gid = floor(gx);
    vec2 gp = vec2((fract(gx) - 0.5) * 1.25, signp.y / signb.y);
    float epoch = floor(uFlow * 0.055);
    float gd = rune(gp, gid, epoch);
    float gs = spec(clamp((gid + 0.5) / 11.0, 0.0, 1.0));
    float glyphMask = step(0.0, gx) * step(gx, 11.0) * sign;
    vec3 gc = neon(gid / 11.0 + uCentroid * 0.17);
    col += gc * lobe(gd, 0.028) * glyphMask * (0.18 + 1.25 * gs + 0.55 * uLevel);
    col += CHROME * smoothstep(0.036, 0.012, gd) * glyphMask * (0.20 + 0.55 * gs);

    // Ceiling tubes — innocent until a beat makes them overexpose.
    for (int i = 0; i < 3; i++) {
        float fi = float(i);
        float x = (fi - 1.0) * min(0.62, aspect * 0.34);
        float tube = sdRoundBox(p - vec2(x, 0.985), vec2(0.20, 0.008), 0.008);
        col += mix(CHROME, neon(fi * 0.31 + uCentroid), 0.28)
             * lobe(tube, 0.009) * (0.20 + 0.38 * uLevel + 0.95 * uBeat);
    }

    // A bad neon cable carries the raw waveform across the room.
    float wy = 0.735 + wav(uv.x) * (0.035 + 0.055 * uLevel)
             + 0.010 * sin(uv.x * 27.0 + uFlow);
    float wd = abs(uv.y - wy);
    vec3 wc = neon(uv.x * 0.72 + uCentroid * 0.25);
    col += wc * lobe(wd, 0.0035 + 0.002 * uLevel) * (0.20 + 0.95 * uLevel);
    col += wc * lobe(wd, 0.018) * (0.025 + 0.12 * uLevel);
    // Little clips pin it to the wall, but not very convincingly.
    float clipx = abs(fract(uv.x * 13.0) - 0.5);
    float clip = smoothstep(0.075, 0.02, clipx) * lobe(uv.y - 0.735, 0.006);
    col += CHROME * clip * (0.08 + 0.25 * uLevel);

    // Back row: many small high-frequency machines.
    {
        float scale = 0.235;
        float cw2 = scale * 1.02;
        float id = floor((p.x + 0.5 * aspect) / cw2);
        float cx = (id + 0.5) * cw2 - 0.5 * aspect;
        float xn = clamp((cx + 0.5 * aspect) / aspect, 0.0, 1.0);
        vec2 q = (p - vec2(cx, 0.535)) / scale;
        vec3 halo;
        vec4 m = washer(q, 0.08 + 0.88 * xn, id * 0.173 + 0.31, aa / scale, halo);
        col += halo;
        col = mix(col, m.rgb, m.a);
        // Their cast light stains the grout beneath them.
        col += neon(xn) * exp(-abs(p.x - cx) / scale) * exp(-abs(p.y - 0.405) * 35.0)
             * (0.008 + 0.055 * spec(0.08 + 0.88 * xn));
    }

    // Front row: fewer, enormous, bass-heavier machines. The slight
    // overlap with the back row is what turns a grid into a real place.
    {
        float scale = 0.345;
        float cw2 = scale * 1.025;
        float id = floor((p.x + 0.5 * aspect) / cw2);
        float cx = (id + 0.5) * cw2 - 0.5 * aspect;
        float xn = clamp((cx + 0.5 * aspect) / aspect, 0.0, 1.0);
        vec2 q = (p - vec2(cx, 0.215)) / scale;
        vec3 halo;
        vec4 m = washer(q, 0.015 + 0.72 * pow(xn, 1.12), id * 0.219 + 0.73,
                        aa / scale, halo);
        col += halo;
        col = mix(col, m.rgb, m.a);
    }

    // Soap bubbles have ignored depth ordering and entered the audience.
    vec2 bg = p * vec2(19.0, 15.0) + vec2(uFlow * 0.09, uFlow * 0.42);
    vec2 bid = floor(bg);
    vec2 bf = fract(bg) - 0.5;
    float bh = hash12(bid);
    vec2 bo = (vec2(hash12(bid + 3.1), hash12(bid + 8.7)) - 0.5) * 0.55;
    float br = 0.055 + 0.17 * bh;
    float bd = abs(length(bf - bo) - br);
    float bubbles = lobe(bd, 0.018) * step(0.91 - 0.10 * uTreble, bh);
    vec3 prism = 0.55 + 0.45 * cos(6.2831 * (bh + uCentroid * 0.3) + vec3(0.0, 2.1, 4.2));
    col += mix(CHROME, prism, 0.72) * bubbles * (0.08 + 0.65 * uTreble + 0.45 * uLevel);

    col += escapedLaundry(p, aspect);

    // Bass shakes loose a thin line of candy-coloured static at the foot.
    float staticN = hash12(vec2(floor(fc.x * 0.45), floor(uTime * 18.0)));
    float staticLine = exp(-uv.y * (70.0 - 25.0 * uBass)) * step(0.62, staticN);
    col += neon(staticN + uCentroid) * staticLine * (0.04 + 0.30 * uBass + 0.28 * uBeat);

    // The entire laundromat blinks at once, because all its clocks agree.
    col *= 1.0 + 0.13 * uBeat + 0.055 * uLevel;
    return vec4(max(col, 0.0), 1.0);
}
