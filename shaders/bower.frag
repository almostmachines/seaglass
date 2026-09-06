// bower — a planted border that grows and decays with the music.
//
// It is laid out the way a real border is: tall things at the back,
// short at the front, and left to right it is the spectrum — bass at
// the left in big architectural foliage, treble at the right in grasses
// and lace. Each plant lives a whole life on the clock of uFlow, which
// only runs while music is playing. It germinates, throws a stem,
// unrolls its leaves from the bottom up, opens a flower, then browns
// from the tip and the margin inward, stands a while as a seed head and
// is replaced. Silence stops the clock, so the garden holds its breath
// rather than resetting. Moment to moment the band beneath a plant
// decides its vigour: how turgid the leaves are, how wide the flower
// opens, how hard it leans into the light.
//
// One low sun sits behind the whole thing, which is when a garden is at
// its best — leaves are lit *through* rather than lit *on*, so the green
// you see is transmitted, the margins burn, and the seed heads go to
// filament. Variegation is a property of the cross-leaf coordinate: a
// cream margin, a central splash, a speckle, a bronze flush — and it
// browns the way a real variegated leaf does, the pale tissue first.
// The waveform is a thread of spider silk slung across the border,
// sagging between its spans and beaded with dew.
//
// A border is mostly mass with a few legible individuals rising out of
// it, and it is drawn the same way. The back of it is spires and a bank
// of foliage that cost one hash apiece; only the two front ranks are
// grown plant by plant, which is where the detail is actually looked at.

// ---- the palette of a border in low sun ----
const vec3 SHADE = vec3(0.016, 0.034, 0.026);
const vec3 MOSS  = vec3(0.055, 0.170, 0.070);
const vec3 LEAFG = vec3(0.200, 0.440, 0.105);
const vec3 LIME  = vec3(0.620, 0.800, 0.180);
const vec3 CREAM = vec3(0.970, 0.950, 0.800);
const vec3 STRAW = vec3(0.880, 0.690, 0.320);
const vec3 RUST  = vec3(0.580, 0.270, 0.100);
const vec3 SUNC  = vec3(1.000, 0.790, 0.430);
const vec3 SKYZ  = vec3(0.300, 0.520, 0.800);
const vec3 SKYH  = vec3(0.990, 0.870, 0.680);

float lobe(float d, float w) { return (w * w) / (d * d + w * w); }
float h11(float x) { return hash12(vec2(x, x * 1.713 + 3.19)); }

// four decorrelated randoms for about the price of one — seeding a plant
// is done per pixel, so this is worth having
vec4 hash41(float n) {
    vec4 p = fract(vec4(n * 0.1031, n * 0.1030, n * 0.0973, n * 0.1099));
    p += dot(p, p.wzxy + 33.33);
    return fract((p.xxyz + p.yzzw) * p.zywx);
}

// the wind, as three travelling waves rather than a noise field: gusts
// cross the border left to right and every plant reads the same air
float gustAt(float x, float t) {
    return 0.55 * sin(x * 1.9 - t * 0.85)
         + 0.30 * sin(x * 4.3 + t * 0.55 + 1.7)
         + 0.15 * sin(x * 8.7 - t * 1.30 + 4.1);
}

// the border reads as a spectrum: x across the frame chooses a band,
// eased so the dead air above ~10 kHz never gets a whole planting bay
float bandOf(float x) { return 0.02 + 0.80 * pow(clamp(x, 0.0, 1.0), 0.90); }

// flower colours you would actually find in one border: violets and
// pinks through coral to white and old gold
vec3 petalHue(float h) {
    vec3 c = mix(vec3(0.50, 0.26, 0.95), vec3(0.98, 0.30, 0.56), smoothstep(0.00, 0.30, h));
    c = mix(c, vec3(1.00, 0.46, 0.18), smoothstep(0.28, 0.55, h));
    c = mix(c, vec3(1.00, 0.94, 0.86), smoothstep(0.52, 0.76, h));
    c = mix(c, vec3(1.00, 0.76, 0.12), smoothstep(0.74, 1.00, h));
    return c;
}

// ------------------------------------------------------------- a plant
struct Plant {
    vec2  base;    // where it meets the soil
    float H;       // full height
    float lw;      // leaf length
    float sw;      // stem half-width
    float lean, swayx, beatx;     // the stem's whole horizontal story
    float shp, tip, arch, curl;   // leaf profile and posture
    vec3  green;                  // this drift's own green
    float varieg, hue, seed, band, vig;
    float rise, leafy, bloom, sen, alive;
    float form, headR, headOn, stalks;
};

// px is where it stands in the frame; xn is the same in 0..1, which is
// what picks its band out of the spectrum
Plant seedPlant(float key, float px, float xn, float gy, float sc, float hj, float gust) {
    Plant P;
    vec4 r = hash41(key * 1.37 + 4.1);
    // borders are planted in drifts, not one-of-everything: neighbouring
    // bays share a species and only jitter around it
    vec4 g = hash41(floor(key * 0.55) * 9.77 + 4.1);

    P.seed = r.x * 37.0;
    P.base = vec2(px, gy);
    P.band = bandOf(clamp(xn, 0.0, 1.0));
    P.vig = spec(P.band);

    // a life, measured in musical time: ~25 flow-units, which is most of
    // a minute of playing. every plant is born at its own point in it
    float life = fract(uFlow * (0.030 + 0.026 * r.y) + r.z + key * 0.137);
    P.rise  = smoothstep(0.010, 0.22, life);
    P.leafy = smoothstep(0.030, 0.30, life);
    P.bloom = smoothstep(0.30, 0.48, life) * (1.0 - smoothstep(0.70, 0.90, life));
    P.sen   = smoothstep(0.58, 0.99, life);
    P.alive = smoothstep(0.004, 0.022, life) * (1.0 - smoothstep(0.93, 1.00, life));

    // low frequencies build the architecture, high ones the froth
    float coarse = 1.0 - P.band;                    // 1 at the bass end
    float vg = 0.55 + 0.85 * P.vig;                 // this moment's vigour

    P.H  = sc * hj * (0.55 + 0.45 * coarse * coarse) * (0.80 + 0.30 * vg);
    P.lw = sc * (0.065 + 0.085 * coarse * coarse + 0.040 * fract(r.x * 7.31));
    P.sw = sc * (0.0034 + 0.0070 * coarse + 0.0020 * r.x);
    P.stalks = 1.0 + step(0.28, r.x) + step(0.66, r.x);   // a crown, not a cane

    // the whole horizontal story of the stem, worked out once: a static
    // lean, a private sway, the shared gust, and the kick of a beat
    P.lean = (fract(r.y * 5.17) - 0.5) * 0.26 * P.H;
    float give = mix(0.30, 1.30, P.band) * P.H;     // fine things move most
    float pv = r.z * 40.0, rate = 0.55 + 0.9 * r.w;
    float own = sin(uFlow * rate + pv) * 0.055 + sin(uFlow * rate * 2.7 + pv * 1.7) * 0.018;
    P.swayx = give * (own * (0.35 + 0.85 * uMid) + gust * 0.070);
    P.beatx = give * 0.10 * uBeat;

    // one profile function, two exponents: grass blade to hosta
    P.shp = mix(0.40, 0.98, g.x) + (r.x - 0.5) * 0.10;
    P.tip = mix(2.30, 0.28, clamp(0.28 * coarse + 0.86 * g.y, 0.0, 1.0));
    P.arch = mix(0.14, 0.90, g.y) + 0.55 * P.sen;
    P.curl = 0.35 + 0.70 * g.x;

    // every drift keeps its own green — blue-grey, deep, or acid
    P.green = mix(MOSS, LEAFG, 0.30 + 0.60 * g.z);
    P.green = mix(P.green, P.green * vec3(0.72, 0.95, 1.05), smoothstep(0.62, 1.0, g.w));
    P.green = mix(P.green, mix(P.green, LIME, 0.45), smoothstep(0.62, 0.10, g.w) * 0.7);

    P.varieg = g.w;
    P.hue = clamp(0.84 - 0.62 * coarse + (fract(r.z * 3.79) - 0.5) * 0.34, 0.0, 1.0);

    // form follows frequency: heavy globes and daisies low, lace and
    // plumes high; a quarter of the drifts are grown for leaf alone
    P.form = floor(mix(0.0, 4.999, clamp(P.band * 0.72 + 0.20 + (g.z - 0.5) * 1.05, 0.0, 1.0)));
    if (g.x > 0.80) P.form = -1.0;
    P.headR = sc * (0.026 + 0.058 * coarse * coarse + 0.022 * r.w) * (0.7 + 0.5 * vg);
    P.headR = min(P.headR, sc * 0.130);
    // the head is there from bud to seed head; only the petals come and go
    P.headOn = smoothstep(0.26, 0.44, life) * (1.0 - smoothstep(0.94, 1.00, life));
    return P;
}

// the stem's horizontal offset at height t — no transcendentals left in
// here, which matters when it is called twenty times per plant
float stemX(Plant P, float t) {
    float s = t * t;
    return (P.lean + P.swayx) * s + P.beatx * s * t;
}

// ------------------------------------------------------------- a leaf
// half-width w(u) = wid * sin(pi * u^shp)^tip. shp slides the widest
// point along the leaf, tip decides whether it ends blunt or drawn out;
// between them the two exponents cover a whole border's worth of foliage.
vec4 leafOf(vec2 q, Plant P, float t0, float side, float ls, vec3 L,
            float aa, float sunAmt, float span) {
    // leaves unroll from the bottom of the plant upward
    float em = smoothstep(t0 * 0.80, t0 * 0.80 + 0.34, P.leafy * 1.30);
    if (em < 0.004) return vec4(0.0);

    float stemH = P.H * P.rise;
    float ax = stemX(P, t0);
    vec2 d = q - (P.base + vec2(ax, t0 * stemH));
    if (dot(d, d) > span * span) return vec4(0.0);

    float len = P.lw * mix(1.40, 0.52, sqrt(t0)) * em * (1.0 - 0.22 * P.sen);
    float wid = P.lw * mix(0.065, 0.44, clamp((1.72 - P.tip) / 1.38, 0.0, 1.0)) * sqrt(em)
              * (0.86 + 0.28 * P.vig) * (1.0 - 0.14 * P.sen);
    float slope = (stemX(P, min(t0 + 0.08, 1.0)) - ax) / (0.08 * max(stemH, 1e-4));

    // held out from the stem, all but flat at the crown, steeper up it,
    // and following whichever way the stem is leaning
    float ang = side * (0.38 + 1.00 * (1.0 - t0) + 0.28 * ls) + atan(slope) * 0.7;
    float ca = cos(ang), sa = sin(ang);
    float u = (d.x * sa + d.y * ca) / len;
    float v = (d.x * ca - d.y * sa);
    float arch = P.arch * (0.7 + 0.6 * ls);
    v -= side * arch * u * u * len;

    float uu = clamp(u, 0.0, 1.0);
    float prof = sin(PI * pow(uu, P.shp));
    float w = wid * pow(max(prof, 1e-4), P.tip);
    // an undulating margin with a fine tooth to it — nothing in a garden
    // has a ruled edge
    w *= 1.0 + 0.055 * sin(uu * 9.0 + ls * 19.0) + 0.030 * sin(uu * 31.0 + ls * 7.0);

    float sd = max(abs(v) - w, max(-u, u - 1.0) * len * 0.6);
    float cov = smoothstep(aa, -aa, sd);
    if (cov < 0.004) return vec4(0.0);

    float vn = clamp(v / max(w, 1e-5), -1.0, 1.0);
    float m = abs(vn);

    // a leaf is a curved surface, not a decal: it troughs about the
    // midrib and tilts as it arches over
    vec3 nl = normalize(vec3(P.curl * vn, -1.1 * arch * u, 0.95));
    vec3 n = vec3(nl.x * ca + nl.y * sa, -nl.x * sa + nl.y * ca, nl.z);

    // --- colour before light ---
    float young = 1.0 - smoothstep(0.0, 0.55, em);
    vec3 green = mix(P.green, LIME, young * 0.55 + 0.14 * P.vig);

    // variegation, by drift
    float pale = 0.0;
    vec3 palec = CREAM;
    if (P.varieg < 0.56) {
        pale = 0.0;                                                   // plain
    } else if (P.varieg < 0.70) {
        pale = smoothstep(0.60, 0.86, m + 0.10 * vnoise(vec2(uu * 12.0, ls * 9.0)));
        palec = mix(CREAM, vec3(0.96, 0.93, 0.58), P.seed * 0.03);    // cream margin
    } else if (P.varieg < 0.81) {
        pale = smoothstep(0.46, 0.14, m);                             // central splash
        palec = mix(CREAM, LIME, 0.40);
    } else if (P.varieg < 0.91) {
        pale = smoothstep(0.50, 0.74, vnoise(vec2(uu * 6.0, vn * 2.6) + ls * 21.0))
             * smoothstep(0.95, 0.70, m);                             // speckled
    } else {
        green = mix(green, vec3(0.20, 0.085, 0.14), 0.62);            // bronze flush
        green = mix(green, vec3(0.34, 0.16, 0.22), smoothstep(0.55, 0.95, m));
    }
    vec3 c = mix(green, palec, pale * 0.96);

    // midrib and the laterals leaving it on the slant
    float rib = smoothstep(0.09, 0.0, m);
    float lat = fract(uu * (5.0 + 4.0 * ls) - m * 0.60 + ls);
    lat = smoothstep(0.10, 0.0, min(lat, 1.0 - lat)) * smoothstep(0.06, 0.22, m);
    c = mix(c, mix(c * 1.45 + LIME * 0.06, c * 0.66, pale), max(rib * 0.85, lat * 0.60));

    // senescence: the tip and the margin first, the pale tissue soonest
    float dry = clamp(P.sen * (0.30 + 1.45 * uu) * (0.55 + 0.85 * m)
                    * (1.0 + 0.6 * pale) - 0.22, 0.0, 1.0);
    c = mix(c, mix(RUST, STRAW, fract(ls * 13.0 + uu)), dry);

    // --- light ---
    // deep in the clump nothing reaches; near the top of the plant the
    // sun comes straight through
    float canopy = mix(0.42, 1.0, smoothstep(0.02, 0.52, t0));
    float back = max(-dot(n, L), 0.0);
    float front = max(dot(n, L), 0.0);
    float sky = 0.30 + 0.70 * clamp(n.y * 0.45 + n.z * 0.55, 0.0, 1.0);

    vec3 lit = c * mix(vec3(0.013, 0.023, 0.026), vec3(0.070, 0.105, 0.072), sky)
             * (0.30 + 1.00 * canopy);
    // transmitted light — the whole point of a low sun. thin tissue at
    // the margins and the pale variegation let far more of it through,
    // and the high exponent is what separates a leaf that is lit through
    // from one that merely faces the right way
    float thin = (0.68 + 0.55 * m) * (1.0 + 1.0 * pale) * (0.70 + 0.55 * uu);
    vec3 trans = mix(c, mix(LIME, vec3(1.0, 0.90, 0.45), 0.22 + 0.42 * pale), 0.40);
    trans = mix(trans, mix(STRAW, RUST, 0.4), dry * 0.85);
    lit += trans * SUNC * pow(back, 2.0) * thin * (2.60 + 2.10 * uLevel) * sunAmt * canopy;
    // the cuticle's own sheen, and the hairs burning along the edge
    lit += SUNC * pow(front, 26.0) * 0.40 * sunAmt;
    // the hairs along a leaf's edge are the brightest thing in a backlit
    // garden. only the edge that faces the sun catches them, though —
    // rimming both sides is what makes a leaf look like a cut-out
    float sunSide = clamp(-sign(vn) * ca * 1.6 + 0.30, 0.0, 1.0);
    float rim = pow(m, 5.0) * smoothstep(0.04, 0.45, back) * sunSide;
    lit += mix(SUNC, CREAM, 0.30) * rim * (1.55 + 1.30 * uLevel)
         * (0.6 + 1.0 * pale) * sunAmt * (0.40 + 0.75 * canopy);

    return vec4(lit, cov * P.alive);
}

// ----------------------------------------------------------- a flower
vec4 flowerOf(vec2 fq, Plant P, float R, float open, float aa, float sunAmt) {
    if (R < 1e-5 || dot(fq, fq) > 12.0 * R * R) return vec4(0.0);
    vec3 pc = petalHue(P.hue);
    float sd = P.seed;
    // `open` is how far the petals are spread; `os` is how much head is
    // there at all, so a spent flower stands on as a seed head
    float os = max(open, P.sen * 0.90);
    float cov = 0.0, core = 0.0, glow = 0.0;
    vec3 c = pc;

    if (P.form < 0.5) {
        // umbel: a lace dome of florets on radiating pedicels
        vec2 e = fq / vec2(R * 1.25, R * 0.72);
        float env = 1.0 - dot(e, e);
        if (env < -0.55) return vec4(0.0);
        vec2 g = fq / (R * 0.20);
        vec2 id = floor(g);
        float k = dot(id, vec2(1.0, 57.0)) + sd;
        vec2 jt = vec2(h11(k), h11(k + 9.1)) - 0.5;
        float dd = length(fract(g) - 0.5 - jt * 0.72);
        cov = smoothstep(0.36, 0.14, dd) * smoothstep(-0.15, 0.42, env) * os;
        float a = atan(fq.y + R * 0.55, fq.x);
        float ray = abs(fract(a * 2.2 + sd) - 0.5) * 2.0;
        cov = max(cov, smoothstep(0.92, 1.0, ray) * smoothstep(0.0, 0.30, env) * 0.35);
        c = mix(pc, CREAM, 0.32);
        glow = 1.6;
    } else if (P.form < 1.5) {
        // daisy: a ring of petals about a raised disc
        float r = length(fq) / R;
        if (r > 1.35) return vec4(0.0);
        float a = atan(fq.y, fq.x);
        float np = 9.0 + floor(h11(sd) * 8.0);
        float pet = pow(abs(cos(a * np * 0.5)), 0.42);
        float rho = mix(0.46, 0.30 + 0.78 * pet, open);
        cov = smoothstep(aa / R, -aa / R, r - rho);
        core = smoothstep(aa / R, -aa / R, r - 0.27 * (0.7 + 0.4 * open));
        float crease = abs(fract(a * np * 0.5 / PI) * 2.0 - 1.0);
        c = mix(pc * 0.74, mix(pc, CREAM, 0.35), smoothstep(0.1, 0.9, crease));
        c = mix(c, c * vec3(1.15, 0.95, 0.85), smoothstep(0.9, 0.3, r));
        glow = 1.35;
    } else if (P.form < 2.5) {
        // spike: florets opening up the raceme from the bottom
        float s = fq.y / (R * 3.2);
        if (s < -0.12 || s > 1.12 || abs(fq.x) > R * 0.9) return vec4(0.0);
        float taper = pow(clamp(1.0 - s, 0.0, 1.0), 0.55);
        vec2 g = vec2(fq.x / (R * 0.34), fq.y / (R * 0.30));
        vec2 id = floor(g);
        float k = dot(id, vec2(1.0, 41.0)) + sd;
        float hh = h11(k);
        vec2 jt = vec2(hh, h11(k + 3.3)) - 0.5;
        float dd = length((fract(g) - 0.5 - jt * 0.55) * vec2(1.0, 1.25));
        float opened = smoothstep(s - 0.10, s + 0.28, os * 1.25);
        cov = smoothstep(0.42, 0.18, dd) * step(abs(fq.x), R * 0.85 * taper)
            * step(0.0, s) * step(s, 1.0) * opened;
        c = mix(pc, mix(pc, CREAM, 0.4), hh);
        c = mix(c * 0.7, c, opened);
        glow = 1.4;
    } else if (P.form < 3.5) {
        // allium: a globe of little stars on their own stalks
        float r = length(fq) / R;
        if (r > 1.45) return vec4(0.0);
        vec2 g = fq / (R * 0.20);
        vec2 id = floor(g);
        float k = dot(id, vec2(1.0, 71.0)) + sd;
        vec2 fp = fract(g) - 0.5 - (vec2(h11(k), h11(k + 5.7)) - 0.5) * 0.8;
        float dd = length(fp);
        float star = smoothstep(0.30, 0.10, dd)
                   + 0.5 * smoothstep(0.42, 0.0, dd) * pow(abs(cos(atan(fp.y, fp.x) * 3.0)), 3.0);
        float shell = smoothstep(1.12, 0.62, r) * (0.55 + 0.45 * h11(k + 1.1));
        cov = clamp(star, 0.0, 1.0) * shell * smoothstep(0.10, 0.50, os);
        c = mix(pc, mix(pc, CREAM, 0.5), h11(k + 2.2));
        c *= 0.72 + 0.55 * smoothstep(1.0, 0.1, r);   // a globe has a shaded side
        glow = 1.5;
    } else {
        // plume: a grass panicle, all filament and light
        vec2 e = fq / vec2(R * 0.85, R * 2.6);
        float env = 1.0 - length(e);
        if (env < -0.30) return vec4(0.0);
        float st = vnoise(vec2(fq.x / (R * 0.055), fq.y / (R * 0.85) + sd * 6.0));
        float st2 = vnoise(vec2(fq.x / (R * 0.024) + 3.0, fq.y / (R * 1.6) - sd * 4.0));
        cov = smoothstep(0.0, 0.40, env) * (smoothstep(0.44, 0.80, st) * 0.85
            + smoothstep(0.55, 0.85, st2) * 0.45);
        cov *= 0.35 + 0.65 * os;
        c = mix(mix(STRAW, pc, 0.50), CREAM, 0.22);
        glow = 2.3;
    }

    if (cov < 0.004) return vec4(0.0);

    // going over: colour drains to straw, the head keeps its shape as a
    // seed head and burns brighter against the sun than the flower did
    c = mix(c, mix(STRAW, CREAM, 0.35), smoothstep(0.15, 0.85, P.sen));
    c = mix(c, RUST * 1.2, smoothstep(0.70, 1.0, P.sen) * 0.5);
    glow *= 1.0 + 1.1 * smoothstep(0.3, 0.9, P.sen);

    vec3 lit = c * (0.06 + 0.14 * uLevel);
    lit += c * SUNC * glow * (0.70 + 0.85 * uLevel + 0.55 * P.vig) * sunAmt;  // lit through
    if (core > 0.0) {
        vec3 dk = mix(vec3(0.30, 0.17, 0.04), vec3(0.95, 0.68, 0.14), 0.35 + 0.5 * P.bloom);
        lit = mix(lit, dk * (0.4 + 1.3 * uLevel) + SUNC * 0.22 * sunAmt, core);
    }
    return vec4(lit, clamp(cov, 0.0, 1.0) * P.alive);
}

// ------------------------------------------------------- a whole plant
vec4 plantOf(vec2 q, Plant P, vec3 L, float aa, float sunAmt, float cw,
             int nleaf, float nstalk) {
    float stemH = P.H * P.rise;
    if (stemH < 1e-4 || P.alive < 0.004) return vec4(0.0);
    float span = P.lw * 1.70;
    if (q.y < P.base.y - span * 0.5 || q.y > P.base.y + stemH + P.headR * 3.8) return vec4(0.0);
    float dxb = abs(q.x - P.base.x);
    if (dxb > cw) return vec4(0.0);

    vec4 acc = vec4(0.0);      // premultiplied, back to front
    float spread = P.lw * 0.34;
    float open = clamp(P.bloom * (0.55 + 0.65 * P.vig), 0.0, 1.0);
    float R0 = P.headR * (0.35 + 0.65 * P.headOn) * (1.0 - 0.12 * P.sen);
    float sx1 = stemX(P, 1.0);

    // a clump throws two or three stalks of slightly different height,
    // which is most of the difference between a plant and a cane
    for (int s = 0; s < 3; s++) {
        float fs = float(s);
        if (fs >= min(P.stalks, nstalk)) break;
        float sk = fract(P.seed * (0.618 + 0.31 * fs) + fs * 0.437);
        float dx = (fs == 0.0) ? 0.0 : (sk - 0.5) * 2.0 * spread;
        float hf = (fs == 0.0) ? 1.0 : 0.58 + 0.34 * sk;
        float bend = 0.75 + 0.5 * sk;
        float sH = stemH * hf;
        float t = (q.y - P.base.y) / max(sH, 1e-4);
        if (t >= -0.02 && t <= 1.0) {
            float tt = clamp(t, 0.0, 1.0);
            float sx = P.base.x + dx * tt + stemX(P, tt) * bend;
            float hw = P.sw * (1.0 - 0.55 * tt) * (0.75 + 0.45 * P.vig) * hf;
            float cv = smoothstep(aa, -aa, abs(q.x - sx) - hw) * P.alive;
            if (cv > 0.002) {
                vec3 stemc = mix(MOSS * 1.15, LIME * 0.55, 0.25 + 0.35 * P.vig);
                stemc = mix(stemc, STRAW * 0.85, P.sen * 0.85);
                // a stem is a cylinder: bright down one side, dark the other
                float across = clamp((q.x - sx) / max(hw, 1e-5), -1.0, 1.0);
                float lt = 0.30 + 0.85 * sqrt(max(1.0 - across * across, 0.0));
                vec3 c = stemc * lt * (0.14 + 0.38 * uLevel)
                       + SUNC * 0.32 * smoothstep(0.25, 1.0, -across) * lt * sunAmt;
                acc.rgb += c * cv * (1.0 - acc.a);
                acc.a += cv * (1.0 - acc.a);
            }
        }
        // its head
        if (P.form >= -0.5 && P.headOn > 0.02) {
            vec2 head = P.base + vec2(dx + sx1 * bend, sH);
            vec4 fl = flowerOf(q - head, P, R0 * (fs == 0.0 ? 1.0 : 0.62 + 0.25 * sk),
                               open * (fs == 0.0 ? 1.0 : 0.80), aa, sunAmt);
            acc.rgb += fl.rgb * fl.a * (1.0 - acc.a);
            acc.a += fl.a * (1.0 - acc.a);
        }
    }

    // leaves: bottom-heavy, so the crown is a mound and the stems rise
    // out of it rather than standing bare
    for (int i = 0; i < nleaf; i++) {
        float fi = float(i);
        float lh = fract(P.seed * (0.618 * (fi + 1.0)) + fi * 0.371);
        float u0 = (fi + 0.4 * lh) / float(nleaf);
        float t0 = 0.060 + 0.80 * u0 * (0.45 + 0.55 * u0);
        if (abs(q.y - (P.base.y + t0 * stemH)) > span) continue;
        float side = (mod(fi, 2.0) < 0.5) ? 1.0 : -1.0;
        vec4 lf = leafOf(q, P, t0, side, lh, L, aa, sunAmt, span);
        acc.rgb += lf.rgb * lf.a * (1.0 - acc.a);
        acc.a += lf.a * (1.0 - acc.a);
    }
    // the outermost leaves of the biggest plants reach past the bay they
    // are drawn in; fade rather than cut them
    acc *= smoothstep(cw, cw * 0.88, dxb);
    return acc;
}


// -------------------------------------------------- the foliage mass
// A border is mostly mass. One jittered lattice of little rotated leaf
// ellipses gives that mass for the price of a hash: each blob keeps its
// own tone, and the ring near its rim is the light coming round its
// edge, which is what makes a bank of backlit foliage read as leaves
// rather than as fog.
// returns (tone, rim, coverage). The field textures the mass rather than
// cutting it into separate shapes — a bank of foliage is a tone that
// happens to be made of leaves, not a pile of discs.
vec3 leafField(vec2 g, float seed) {
    vec2 id = floor(g);
    vec4 h = hash41(dot(id, vec2(1.0, 57.0)) + seed);
    vec2 fp = fract(g) - 0.5 - (h.xy - 0.5) * 0.40;
    float ca = cos(h.z * 6.2831), sa = sin(h.z * 6.2831);
    float sz = 0.58 + 0.75 * h.w;              // no two the same size
    float d = length(vec2(fp.x * ca - fp.y * sa, fp.x * sa + fp.y * ca)
                     / (vec2(0.48, 0.28) * sz));
    return vec3(0.10 + 1.15 * h.x * (0.32 + 0.9 * h.w),          // which way it faces
                smoothstep(0.48, 0.98, d) * smoothstep(1.06, 0.88, d),
                smoothstep(1.04, 0.70, d));
}



// A bank of foliage: two lattices at frankly different scales, so the
// gaps in one are filled by the other and neither shows its grid. The
// per-blob tone is gated by that blob's coverage — applied to the whole
// cell instead, it tiles the screen with squares.
vec3 foliage(vec2 g, float seed, float lam, float mz, vec3 dark, vec3 warm, out float cov) {
    vec3 f1 = leafField(g, seed);
    vec3 f2 = leafField(g * 2.37 + 7.3, seed + 19.0);
    vec3 f3 = leafField(g * 0.26 + 2.1, seed + 53.0);   // whole clumps, not leaves
    float c1 = f1.z, c2 = f2.z * 0.85;
    cov = max(c1, c2);
    float tone = mix(0.26, mix(f2.x, f1.x, c1), cov);
    float clump = 0.55 + 0.85 * mix(0.4, f3.x, f3.z);   // some clumps in, some out
    float rim = max(f1.y * c1, f2.y * c2 * 0.7);
    // light falls off fast into a clump, so the underside of any mass of
    // foliage is simply dark and the texture in it goes with the light
    float fade = exp(-mz * 2.3);
    vec3 mc = dark * (0.55 + 0.52 * mix(0.4, tone, fade)) * clump;
    mc += warm * lam * (0.04 + 1.05 * tone * tone) * clump;
    mc += mix(CREAM, warm, 0.60) * rim * lam * 1.15 * clump;
    return mc * (0.10 + 0.90 * fade);
}

// ------------------------------------------------------------ spires
// The back of a border is read as silhouette: stems, and the seed heads
// on top of them, against the light. One per lattice column and no loop,
// which is what lets the rank exist at all.
vec4 spires(vec2 p, float gy, float lightAmt, float wind, float aa, vec3 sunc) {
    const float CW = 0.075;
    float sid = floor((p.x + 1.2) / CW);
    vec4 h = hash41(sid * 7.31 + 2.9);
    float bx = (sid + 0.5 + (h.x - 0.5) * 0.40) * CW - 1.2;
    float life = fract(uFlow * (0.030 + 0.026 * h.y) + h.z + sid * 0.137);
    float rise = smoothstep(0.015, 0.24, life);
    float alive = smoothstep(0.008, 0.030, life) * (1.0 - smoothstep(0.93, 1.00, life));
    float sen = smoothstep(0.58, 0.99, life);
    float H = (0.13 + 0.26 * h.w) * rise;
    float t = (p.y - gy) / max(H, 1e-4);
    float sway = (gustAt(bx, wind) * 0.055 + sin(uFlow * (0.6 + h.y) + h.z * 30.0) * 0.020
                + uBeat * 0.05) * (0.4 + 0.9 * h.w);
    if (t < -0.05 || t > 1.6 || alive < 0.01) return vec4(0.0);

    float band = spec(0.03 + 0.20 * fract(h.x * 3.7));
    vec3 acc = vec3(0.0);
    float cov = 0.0;
    // the stem
    if (t <= 1.0) {
        float sx = bx + sway * t * t;
        float c = smoothstep(aa, -aa, abs(p.x - sx) - 0.0011 * (1.0 - 0.4 * t));
        acc = mix(MOSS, STRAW, sen * 0.8) * (0.20 + 0.55 * lightAmt);
        cov = c;
    }
    // the head: a little plume, or a lace disc of florets
    float open = smoothstep(0.28, 0.48, life);
    vec2 fq = p - vec2(bx + sway, gy + H);
    float R = (0.008 + 0.016 * h.w) * (0.35 + 0.75 * open) * (0.7 + 0.6 * band);
    float hc = 0.0;
    vec3 hcol = mix(CREAM, sunc, 0.35);
    if (h.y < 0.55) {
        vec2 e = fq / vec2(R * 1.1, R * 3.0);
        float env = 1.0 - length(e);
        float st = vnoise(vec2(fq.x / (R * 0.10), fq.y / (R * 1.2) + h.z * 9.0));
        hc = smoothstep(0.0, 0.45, env) * smoothstep(0.40, 0.80, st);
        hcol = mix(mix(STRAW, CREAM, 0.5), sunc, 0.30);
    } else {
        vec2 g = fq / (R * 0.42);
        vec4 fh = hash41(dot(floor(g), vec2(1.0, 57.0)) + h.z * 13.0);
        float dd = length(fract(g) - 0.5 - (fh.xy - 0.5) * 0.7);
        hc = smoothstep(0.40, 0.14, dd) * smoothstep(1.25, 0.55, length(fq) / R);
        hcol = mix(CREAM, petalHue(0.55 + 0.4 * h.w), 0.35 - 0.3 * sen);
    }
    hc = clamp(hc, 0.0, 1.0);
    if (hc > 0.002) {
        vec3 c = mix(hcol, mix(STRAW, RUST, 0.4), sen * 0.6)
               * (0.10 + 1.5 * lightAmt * (0.5 + 0.7 * band) + 0.6 * uLevel * lightAmt);
        acc = mix(acc, c, hc / max(hc + cov * (1.0 - hc), 1e-4));
        cov = cov + hc * (1.0 - cov);
    }
    return vec4(acc, cov * alive);
}

// ------------------------------------------------------------- motes
// pollen while it flowers, seed fluff once it goes over
vec3 motes(vec2 p, float sc, float dens, vec3 tint) {
    vec2 g = p * sc + vec2(uFlow * 0.10, uFlow * 0.045 + uTime * 0.012);
    vec2 id = floor(g);
    vec4 h = hash41(dot(id, vec2(1.0, 113.0)));
    vec2 wob = vec2(sin(uTime * (0.5 + h.x) + h.x * 30.0),
                    cos(uTime * (0.4 + h.x * 0.7) + h.x * 12.0)) * 0.10;
    float d = length(fract(g) - 0.5 - (h.yz - 0.5) * 0.7 - wob);
    float sz = 0.030 + 0.070 * h.x * h.x;
    float on = smoothstep(1.0 - dens, 1.0 - dens * 0.35, h.w);
    return tint * (smoothstep(sz, sz * 0.25, d) + smoothstep(sz * 3.5, 0.0, d) * 0.22)
         * on * (0.55 + 0.45 * sin(uTime * (2.0 + 4.0 * h.x) + h.x * 50.0));
}

vec4 render(vec2 fc) {
    vec2 uv = fc / uRes;
    float aspect = uRes.x / uRes.y;
    vec2 p = vec2((uv.x - 0.5) * aspect, uv.y);
    float aa = 1.25 / uRes.y;

    // the sun: low, behind everything, left of centre. bright music
    // lifts it and cools it; dark music drops it into amber
    float el = mix(0.09, 0.26, uCentroid);
    vec3 L = normalize(vec3(-0.82, el, -0.44));
    vec2 sunp = vec2(-0.27 * aspect - 0.02, 0.700 + 0.05 * el + 0.012 * sin(uFlow * 0.05));
    vec3 sunc = mix(vec3(1.00, 0.62, 0.26), vec3(1.00, 0.93, 0.80), uCentroid);
    float bright = 0.35 + 0.75 * uLevel;
    float srad = length(p - sunp);

    // ---------------------------------------------------------- the sky
    float sky = smoothstep(0.52, 1.18, uv.y);
    vec3 col = mix(mix(SKYH, sunc, 0.48), SKYZ * 0.50, pow(sky, 0.80));
    col = mix(col, mix(SKYH, sunc, 0.65), exp(-srad * 2.4) * 0.60);
    col += sunc * exp(-length((p - sunp) * vec2(1.0, 1.35)) * 11.0) * (0.55 + 0.60 * bright);
    col += sunc * smoothstep(0.026, 0.010, srad) * 1.4;

    // ------------------------------------------------- the hedge behind
    // a yew hedge is a wall of small out-of-focus billows, and it is the
    // dark that the whole backlit border gets read against
    float hy = 0.600 + 0.032 * sin(p.x * 2.1 + 0.7) + 0.020 * sin(p.x * 5.3 - 1.9)
         + 0.011 * sin(p.x * 11.7 + 3.4);
    float hedge = smoothstep(hy + 0.010, hy - 0.010, uv.y);
    vec3 bilf = leafField(p * 22.0, 3.0);
    float bil = 0.20 + 0.42 * bilf.x + 0.34 * bilf.z + 0.30 * bilf.y;
    vec3 hcol = mix(SHADE * 0.40, MOSS * 0.24, bil);
    hcol += mix(MOSS, LIME, 0.45) * 0.34 * smoothstep(hy - 0.085, hy + 0.005, uv.y)
          * (0.35 + 1.0 * bil) * (0.4 + 0.8 * uLevel);         // sunlit crown
    hcol = mix(hcol, mix(SKYH, sunc, 0.55) * 0.74, 0.30);      // depth haze
    hcol += sunc * 0.45 * exp(-srad * 3.4);
    col = mix(col, hcol, hedge);
    // a nearer ridge, a shade darker, to give the distance some depth
    float hy2 = 0.545 + 0.026 * sin(p.x * 1.6 - 2.2) + 0.014 * sin(p.x * 4.1 + 0.9);
    vec3 h2col = mix(hcol * 0.62, mix(SKYH, sunc, 0.5) * 0.36, 0.30);
    h2col += mix(MOSS, LIME, 0.5) * 0.22 * smoothstep(hy2 - 0.055, hy2 + 0.004, uv.y)
           * (0.4 + 0.9 * bil) * (0.4 + 0.8 * uLevel);
    col = mix(col, h2col, smoothstep(hy2 + 0.008, hy2 - 0.008, uv.y));

    // ---------------------------------------------------- light shafts
    vec2 sd = p - sunp;
    float shv = vnoise(vec2(atan(sd.y, sd.x) * 6.5, srad * 0.9 - uFlow * 0.035));
    float shaft = pow(smoothstep(0.40, 0.90, shv), 2.0) * exp(-srad * 1.8);
    col += mix(sunc, CREAM, 0.20) * shaft * (0.17 + 0.55 * uLevel + 0.30 * uBeat);

    // -------------------------------------------------- the planting
    // Three things stand between the hedge and the viewer: spires at the
    // back that are all silhouette and seed head, and two ranks of full
    // plants, few enough and large enough to be read as plants. Each
    // rank gets a low edging of foliage at its foot, which is all it
    // takes for a border never to show its soil.
    vec3 hazec = mix(mix(SKYH, sunc, 0.50), SKYZ, 0.10) * 0.66;
    float wind = uFlow;

    float gys[2];  gys[0] = 0.330; gys[1] = 0.070;
    float scs[2];  scs[0] = 0.54;  scs[1] = 0.84;
    float hzs[2];  hzs[0] = 0.12;  hzs[1] = 0.00;
    float lts[2];  lts[0] = 1.25;  lts[1] = 0.62;
    int   nls[2];  nls[0] = 5;     nls[1] = 9;
    float nss[2];  nss[0] = 2.0;   nss[1] = 3.0;
    float mhs[2];  mhs[0] = 0.030; mhs[1] = 0.044;

    // ---- the spires at the back
    {
        float lt = 1.85 * (0.48 + 0.90 * exp(-abs(p.x - sunp.x) * 0.9)) * (0.7 + 0.5 * uLevel);
        vec4 sp = spires(p, 0.436, lt, wind, aa, sunc);
        if (sp.a > 0.001) {
            sp.rgb = mix(sp.rgb, hazec, 0.28);
            col = mix(col, sp.rgb, clamp(sp.a, 0.0, 1.0));
        }
        // and the soft bank they stand in
        float mh = 0.038 * (0.75 + 0.40 * uLevel);
        float mtop = 0.430 + mh * (0.5 + 1.3 * (0.5 + 0.5 *
                     (0.34 * sin(p.x * 2.1 - 1.7) + 0.32 * sin(p.x * 6.3 + 3.1)
                    + 0.22 * sin(p.x * 15.0 + wind * 0.04))));
        if (uv.y < mtop + 0.012 && uv.y > max(0.326, mtop - mh * 3.1)) {
            float mz = clamp((mtop - uv.y) / mh, 0.0, 1.0);
            float lam = 1.90 * exp(-mz * 2.0) * (0.14 + 0.95 * uLevel);
            float fc;
            vec3 mc = foliage(p * 62.0, 11.0, lam, mz,
                              mix(MOSS * 0.70, SHADE * 0.40, mz * 0.80),
                              mix(LIME, sunc, 0.52), fc);
            mc = mix(mc, hazec, 0.15);
            col = mix(col, mc, smoothstep(mtop + 0.005, mtop - 0.012, uv.y)
                     * smoothstep(mtop - mh * 3.0, mtop - mh * 1.8, uv.y)
                     * mix(1.0, clamp(0.18 + 1.40 * fc, 0.0, 1.0), smoothstep(0.26, 0.0, mz))
                     * smoothstep(0.326, 0.346, uv.y));
        }
    }

    for (int Li = 0; Li < 2; Li++) {
        if (Li == 0 && uv.y < gys[1] + 0.030) continue;   // buried by the rank in front


        float gy = gys[Li], sc = scs[Li], hz = hzs[Li], lt = lts[Li];
        float cw = (Li == 0 ? 0.21 : 0.26) * sc;
        float fl = float(Li);
        float fl2 = 1.0 - fl;     // the front rank is the one in shadow

        // the soil, which should barely ever be seen
        float onsoil = smoothstep(gy + 0.014, gy - 0.014, uv.y)
                     * (Li == 0 ? smoothstep(gy - 0.13, gy - 0.055, uv.y) : 1.0);
        float depth = clamp((gy - uv.y) / 0.16, 0.0, 1.0);
        vec3 soil = mix(vec3(0.020, 0.016, 0.011), vec3(0.0025, 0.0035, 0.0030), depth);
        soil *= 0.55 + 0.60 * fract(sin(p.x * 431.0 + uv.y * 197.0) * 4371.0);
        col = mix(col, mix(soil, hazec, hz * 0.40), onsoil * (Li == 0 ? 0.80 : 1.0));

        // --- the individuals
        float ci = floor((p.x + 0.5 * aspect) / cw);
        for (int j = -1; j <= 1; j++) {
            float idx = ci + float(j);
            float key = idx + fl * 131.0;
            vec4 jr = hash41(key * 3.11 + 7.7);
            float px = (idx + 0.5 + (jr.x - 0.5) * 0.60) * cw - 0.5 * aspect;
            if (abs(p.x - px) > cw) continue;
            // most plants are modest and a few are accents. deciding that
            // here rather than inside the seeding makes the bound below
            // exact, so most of the frame never seeds the plant at all
            float scj = sc * (0.86 + 0.30 * jr.y);
            float hj = 0.55 + 0.85 * jr.z * jr.z;
            float gyj = gy + (jr.w - 0.5) * 0.036;              // not a row
            if (uv.y < gyj - 0.55 * scj || uv.y > gyj + 1.24 * scj * hj + 0.34 * scj)
                continue;
            float gust = gustAt(px, wind) + uBeat * 0.9 * sin(px * 3.0 + wind);
            Plant P = seedPlant(key, px, (px + 0.5 * aspect) / aspect, gyj, scj, hj, gust);
            // how much sun it stands in: nearer the sun in the frame, and
            // further back in the border, means more comes through
            float sunAmt = lt * (0.36 + 1.05 * exp(-abs(px - sunp.x) * 0.85))
                         * (0.68 + 0.52 * uLevel) * (0.50 + 0.95 * jr.w);
            vec4 pl = plantOf(p, P, L, aa, sunAmt, cw, nls[Li], nss[Li]);
            if (pl.a > 0.001) {
                pl.a = clamp(pl.a, 0.0, 1.0);
                pl.rgb = mix(pl.rgb, hazec * pl.a, hz);   // premultiplied
                col = col * (1.0 - pl.a) + pl.rgb;
            }
        }

        // --- the edging at its foot, which the stems come up out of
        float mh = mhs[Li] * (0.72 + 0.42 * uLevel + 0.20 * uBass);
        float mtop = gy - 0.004 + mh * (0.5 + 1.3 * (0.5 + 0.5 *
                     (0.34 * sin(p.x * (3.1 / sc) + fl * 2.3)
                    + 0.30 * sin(p.x * (7.7 / sc) - fl * 1.1)
                    + 0.22 * sin(p.x * (18.0 / sc) + wind * 0.05))));
        if (uv.y < mtop + 0.012 && uv.y > mtop - mh * 2.5) {
            float mz = clamp((mtop - uv.y) / mh, 0.0, 1.0);
            float lam = lt * exp(-mz * 2.6) * (0.12 + 0.92 * uLevel);
            float fc;
            vec3 mc = foliage((p + vec2(gustAt(p.x, wind) * 0.024 * (1.0 - mz), 0.0)) * (17.0 / sc),
                              fl * 5.0 + 3.0, lam, mz,
                              mix(MOSS * 0.85, SHADE, 0.30 + 0.60 * mz) * (0.35 + 0.60 * fl2),
                              mix(LIME, sunc, 0.44), fc);
            mc = mix(mc, hazec, hz * 0.5);
            col = mix(col, mc, smoothstep(mtop + 0.005, mtop - 0.014, uv.y)
                     * smoothstep(mtop - mh * 2.4, mtop - mh * 1.5, uv.y)
                     * mix(1.0, clamp(0.16 + 1.40 * fc, 0.0, 1.0), smoothstep(0.30, 0.0, mz)));
        }

        // the air standing in front of this rank
        if (Li == 0) {
            // between the near planting you are looking into lit haze,
            // which is the whole reason a border photographs well at all
            float glow = smoothstep(0.04, 0.26, uv.y) * smoothstep(0.38, 0.24, uv.y);
            col = mix(col, mix(hazec, sunc, 0.40) * (0.09 + 0.24 * uLevel), glow * 0.88);
            // and the middle distance is not empty air: it is more of the
            // same planting, going out of focus and into the light
            if (glow > 0.003) {
            float mdc;
            vec3 md = foliage((p + vec2(gustAt(p.x, wind) * 0.02, 0.0)) * 88.0, 71.0,
                              0.90 * (0.16 + 0.85 * uLevel), 0.42,
                              MOSS * 0.50, mix(LIME, sunc, 0.50), mdc);
            col = mix(col, mix(md, mix(MOSS * 0.6, hazec, 0.45) * 0.42, 0.34),
                      glow * 0.72 * clamp(0.35 + 0.80 * mdc, 0.0, 1.0));
            }
            col += mix(hazec, sunc, 0.5) * 0.018 * (0.3 + 0.9 * uLevel)
                 * smoothstep(0.04, 0.26, uv.y) * smoothstep(0.30, 0.10, uv.y);
            float veil = (0.018 + 0.040 * uLevel) * smoothstep(0.10, 0.32, uv.y)
                       * smoothstep(0.60, 0.34, uv.y) * (0.35 + 0.75 * shaft * 3.0);
            col = mix(col, mix(hazec, sunc, 0.45), clamp(veil, 0.0, 0.26));
            float mist = exp(-abs(uv.y - 0.330) * 110.0) * (0.06 + 0.15 * uLevel);
            col += mix(CREAM, sunc, 0.60) * mist
                 * (0.55 + 0.55 * sin(p.x * 5.0 - wind * 0.3) * sin(p.x * 2.0 + 1.0));
        }
    }

    // the shadow at the foot of the border, with just enough bounce in it
    // to read as shade rather than as a hole cut in the picture
    col += mix(MOSS, sunc, 0.30) * 0.016 * (0.25 + 0.85 * uLevel)
         * smoothstep(0.34, 0.08, uv.y) * smoothstep(0.02, 0.10, uv.y);

    // ------------------------------------------------------- the path
    float pathTop = 0.040;
    float onpath = smoothstep(pathTop + 0.004, pathTop - 0.004, uv.y);
    float pd = clamp((pathTop - uv.y) / 0.11, 0.0, 1.0);
    // mown grass in the border's own shadow, with the light only just
    // reaching over the top of the planting
    vec3 path = mix(vec3(0.048, 0.058, 0.032), vec3(0.008, 0.012, 0.008), pd);
    path *= 0.65 + 0.70 * fract(sin(p.x * 311.0 + uv.y * 91.0) * 3711.0);
    // long shadows thrown forward off the planting, raking with the sun
    float shadow = smoothstep(0.24, 0.78, vnoise(vec2((p.x + pd * 0.75) * 3.0 - uFlow * 0.03, 7.0)));
    path += mix(sunc, LIME, 0.30) * (0.16 + 0.42 * uLevel) * exp(-pd * 3.2) * (1.0 - 0.85 * shadow);
    col = mix(col, path, onpath);

    // ------------------------- the waveform: silk across the border ---
    float wsm = (wav(uv.x - 0.0045) + 2.0 * wav(uv.x) + wav(uv.x + 0.0045)) * 0.25;
    // strung between spans, and sagging between them the way silk does
    float ty = 0.335 + wsm * (0.050 + 0.070 * uLevel)
             - 0.026 * sin(PI * fract(uv.x * 2.5 + 0.15));
    float dy = uv.y - ty;
    float silk = lobe(dy, 0.0011 + 0.0014 * uLevel);
    float catchl = 0.30 + 0.70 * exp(-abs(p.x - sunp.x) * 0.9);   // only where it catches
    col += mix(CREAM, sunc, 0.40) * silk * catchl * (0.35 + 1.20 * uLevel);
    // dew, strung along it, splitting the light
    float bs = 46.0 + 18.0 * uCentroid;
    float bi = floor(uv.x * bs);
    float bh = h11(bi * 3.7);
    float bd = length(vec2((fract(uv.x * bs) - 0.5 - (bh - 0.5) * 0.5) / bs * aspect, dy));
    float bead = smoothstep(0.0045 * (0.5 + bh), 0.0, bd) * step(0.45, bh);
    vec3 fire = 0.5 + 0.5 * cos(6.2831 * (bh + uCentroid * 0.5) + vec3(0.0, 2.1, 4.2));
    col += mix(mix(CREAM, sunc, 0.4), fire, 0.55) * bead * (0.6 + 2.2 * uLevel + 1.2 * uBeat);

    // ----------------------------------------------- pollen and fluff
    float airy = 0.10 + 0.55 * uTreble;
    col += motes(p, 15.0, airy * 0.55, mix(SUNC, CREAM, 0.4)) * (0.5 + 1.3 * uLevel);
    col += motes(p * 1.7 + 5.0, 26.0, airy * 0.40, sunc) * (0.4 + 1.1 * uLevel) * 0.7;

    // --------------------------------- a leaf out of focus, up close:
    // the frame of a photograph taken from inside the planting
    for (int i = 0; i < 2; i++) {
        float fi2 = float(i);
        float sgn = fi2 * 2.0 - 1.0;
        vec2 d2 = p - vec2(sgn * (aspect * 0.5 + 0.02), -0.06 + 0.42 * fi2);
        float ang = sgn * (1.05 + 0.10 * sin(uFlow * 0.08 + fi2 * 3.0)) + 0.30;
        float ca = cos(ang), sa2 = sin(ang);
        float u = (d2.x * sa2 + d2.y * ca) / 1.05;
        float v = (d2.x * ca - d2.y * sa2);
        float uc = clamp(u, 0.0, 1.0);
        float w = 0.40 * sqrt(max(uc * (1.0 - uc), 0.0)) * (1.25 - 0.5 * uc);
        float m2 = smoothstep(0.09, -0.02, max(abs(v) - w, max(-u, u - 1.0) * 0.5));
        vec3 bc = SHADE * 1.6 * (0.4 + 0.7 * uLevel);
        bc += mix(LIME, SUNC, 0.35) * 0.22 * smoothstep(w, 0.0, abs(v)) * (0.2 + 0.6 * uLevel);
        col = mix(col, bc, m2 * 0.88);
    }
    // near-camera bokeh, wide open
    vec2 bp = p * 3.1 + vec2(uFlow * 0.02, 0.0);
    vec4 bk = hash41(dot(floor(bp), vec2(1.0, 37.0)) + 4.0);
    float bkd = length(fract(bp) - 0.5 - (bk.yz - 0.5) * 0.8);
    float disc = smoothstep(0.30, 0.26, bkd) * (0.55 + 0.45 * smoothstep(0.18, 0.29, bkd));
    col += mix(sunc, CREAM, bk.x) * disc * step(0.978, bk.w) * (0.06 + 0.22 * uLevel);

    // the foot of a border is always the darkest part of it
    col *= 0.42 + 0.58 * smoothstep(-0.04, 0.44, uv.y);
    col *= 1.0 + 0.10 * uBeat + 0.05 * uLevel;
    // a tonemap always takes some colour out; this puts it back
    col = mix(vec3(dot(col, vec3(0.2126, 0.7152, 0.0722))), col, 1.24);
    return vec4(max(col, 0.0), 1.0);
}
