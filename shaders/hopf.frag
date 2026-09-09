// hopf — music drawn as a bundle of circles that cannot be unlinked.
//
// The scene starts in four dimensions.  A screen ray is inverse-
// stereographically lifted from R3 onto the unit 3-sphere S3, turned in
// four independent coordinate planes, and sent through the Hopf map
//
//              S3  --Hopf-->  S2.
//
// The inverse image of any point on S2 is a circle.  More strangely, the
// inverse images of *any two* points are linked exactly once.  Nine points
// chosen by a golden-angle walk on S2 therefore become nine mutually linked
// fibres when projected back into the three-dimensional picture.  They can
// swell, pass through infinity, and return, but no continuous motion can
// unlink them.  The apparent tube distance below includes the conformal
// scale of stereographic projection, so sphere tracing can walk this map as
// though the fibres were ordinary geometry.
//
// Each fibre owns a slice of the spectrum.  The waveform is written around
// its otherwise invisible complex phase; bass changes the tubes' radius,
// mids turn S3 in its second isoclinic plane, treble reveals the coordinate
// chart behind them, and a beat sends one phase pulse around every circle.
// This is not a simulation of an object.  It is a picture of a fibration.

const int NFIBRE = 9;
const float TAU = 6.283185307179586;

const vec3 PAPER     = vec3(0.64, 0.59, 0.50);
const vec3 PAPERBLUE = vec3(0.42, 0.52, 0.59);
const vec3 GRAPHITE  = vec3(0.008, 0.011, 0.020);
const vec3 COBALT    = vec3(0.025, 0.13, 0.95);
const vec3 VERMILION = vec3(1.00, 0.075, 0.018);
const vec3 CITRON    = vec3(1.00, 0.76, 0.035);
const vec3 MINTINK   = vec3(0.015, 0.72, 0.50);

// A Fibonacci sphere.  These are deliberately not arranged in a ring:
// uniform base points make the projected fibres very different sizes while
// preserving their pairwise linking number.
const vec3 BASE[NFIBRE] = vec3[NFIBRE](
    vec3( 0.45812285,  0.88888889,  0.00000000),
    vec3(-0.54960231,  0.66666667,  0.50348074),
    vec3( 0.07831653,  0.44444444, -0.89237641),
    vec3( 0.59322548,  0.22222222,  0.77375759),
    vec3(-0.98471349,  0.00000000, -0.17418195),
    vec3( 0.82265807, -0.22222222, -0.52330773),
    vec3(-0.23255520, -0.44444444,  0.86509376),
    vec3(-0.34353981, -0.66666667, -0.66146500),
    vec3( 0.43032455, -0.88888889,  0.15715383)
);

float lobe(float d, float w) { return (w * w) / (d * d + w * w); }

// A subtractive-looking cycle rather than the usual emissive rainbow.
vec3 fibreHue(float t) {
    t = fract(t);
    vec3 c = mix(COBALT, MINTINK, smoothstep(0.00, 0.28, t));
    c = mix(c, CITRON,             smoothstep(0.25, 0.52, t));
    c = mix(c, VERMILION,         smoothstep(0.49, 0.76, t));
    c = mix(c, COBALT,            smoothstep(0.73, 1.00, t));
    return c;
}

// Inverse stereographic projection R3 -> S3.  The north pole of S3 is
// infinity in ordinary space.
vec4 liftS3(vec3 p) {
    float r2 = dot(p, p);
    return vec4(2.0 * p, r2 - 1.0) / (r2 + 1.0);
}

// An SO(4) motion has two independent rotation rates.  Ordinary 3D rotation
// cannot do this: here xw/yz and xy/zw are counter-rotated isoclinic pairs.
vec4 turnS3(vec4 z) {
    float a = 0.115 * uFlow + 0.21 * sin(uFlow * 0.071) + 0.12 * uBeat;
    float b = -0.073 * uFlow + 0.26 * sin(uFlow * 0.043 + 1.7)
            + 0.42 * uMid - 0.16 * uCentroid;
    z.xw = rot(a) * z.xw;
    z.yz = rot(-a * (0.72 + 0.18 * uBass)) * z.yz;
    z.xy = rot(b) * z.xy;
    z.zw = rot(-b * (1.08 + 0.16 * uMid)) * z.zw;
    return normalize(z);
}

// Hopf map, treating z.xy and z.zw as two complex numbers.  The result is
// exactly on S2 (up to floating point error).
vec3 hopfMap(vec4 z) {
    return vec3(2.0 * (z.x * z.z + z.y * z.w),
                2.0 * (z.y * z.z - z.x * z.w),
                z.x * z.x + z.y * z.y - z.z * z.z - z.w * z.w);
}

vec3 hopfAt(vec3 p) {
    vec3 h = hopfMap(turnS3(liftS3(p)));
    // A slow rigid turn of the base sphere changes which fibres visit the
    // stereographic pole without disturbing the bundle.
    h.xz = rot(0.16 * sin(uFlow * 0.031) + 0.15 * uCentroid) * h.xz;
    h.xy = rot(-0.12 * uFlow + 0.10 * sin(uFlow * 0.067)) * h.xy;
    return normalize(h);
}

// Returns signed tube distance and fibre id.  The Hopf map magnifies local
// distance by 4/(1+|p|^2), hence its reciprocal below.  Near a fibre this is
// a first-order Euclidean distance, accurate enough for guarded ray steps.
vec2 fibreMap(vec3 p) {
    vec3 h = hopfAt(p);
    float scale = 0.25 * (1.0 + dot(p, p));
    float best = 1e5;
    float id = 0.0;
    for (int i = 0; i < NFIBRE; i++) {
        float d = length(h - BASE[i]) * scale;
        if (d < best) {
            best = d;
            id = float(i);
        }
    }
    float radius = 0.030 + 0.012 * uBass + 0.006 * uLevel + 0.006 * uBeat;
    return vec2(best - radius, id);
}

// Tetrahedral normal: four map calls instead of the usual six.
vec3 fibreNormal(vec3 p) {
    float e = 0.0022;
    vec2 k = vec2(1.0, -1.0);
    return normalize(k.xyy * fibreMap(p + k.xyy * e).x
                   + k.yyx * fibreMap(p + k.yyx * e).x
                   + k.yxy * fibreMap(p + k.yxy * e).x
                   + k.xxx * fibreMap(p + k.xxx * e).x);
}

// The common complex phase along a Hopf fibre.  It winds exactly once.  At
// the rare chart singularity z.xy=0, z.zw supplies the same phase instead.
float fibrePhase(vec3 p) {
    vec4 z = turnS3(liftS3(p));
    vec2 a = z.xy;
    vec2 b = z.zw;
    float useB = step(dot(a, a), 0.035);
    return fract(mix(atan(a.y, a.x), atan(b.y, b.x), useB) / TAU);
}

float chartLine(float x, float count) {
    float d = abs(fract(x * count + 0.5) - 0.5);
    float aa = max(fwidth(x * count), 0.0015);
    return 1.0 - smoothstep(aa * 0.55, aa * 1.65, d);
}

vec4 render(vec2 fc) {
    vec2 uv = fc / uRes;
    vec2 q = (fc - 0.5 * uRes) / uRes.y;

    // The raw waveform acts as a weak gravitational lens.  Four taps keep
    // its corners physical enough that the ray marcher does not shimmer.
    float px = 2.0 / uRes.x;
    float wx = (wav(uv.x - px) + 2.0 * wav(uv.x) + wav(uv.x + px)) * 0.25;
    float wy = wav(fract(0.17 + uv.y * 0.71));
    vec2 lens = vec2(wx, wy) * (0.018 + 0.045 * uLevel);

    vec3 ro = vec3(0.0, 0.0, 3.65);
    vec3 rd = normalize(vec3(q * 1.62 + lens, -2.15));
    // A gentle ordinary camera roll makes the two kinds of rotation easy to
    // tell apart: this one never changes the circles' projected sizes.
    float cam = 0.08 * sin(uFlow * 0.052);
    ro.xz = rot(cam) * ro.xz;
    rd.xz = rot(cam) * rd.xz;
    ro.yz = rot(-0.07 * cos(uFlow * 0.037)) * ro.yz;
    rd.yz = rot(-0.07 * cos(uFlow * 0.037)) * rd.yz;

    float t = 0.0;
    float fid = -1.0;
    float halo = 0.0;
    bool hit = false;
    for (int i = 0; i < 84; i++) {
        vec3 p = ro + rd * t;
        vec2 m = fibreMap(p);
        if (m.x < 0.0016) {
            hit = true;
            fid = m.y;
            break;
        }
        float stepLen = clamp(m.x * 0.62, 0.005, 0.22);
        // Integrate nearness with the actual step length, so the halo does
        // not depend on how many sphere-tracing iterations happened here.
        halo += exp(-max(m.x, 0.0) * 13.0) * stepLen;
        t += stepLen;
        if (t > 8.2) break;
    }

    // Uncoated paper carrying a moving coordinate chart of the Hopf base
    // sphere.  There is no global continuous chart on S2; its unavoidable
    // seam wanders through the image as the four-dimensional rotation turns.
    vec3 bp = ro + rd * 4.15;
    vec3 bh = hopfAt(bp * 0.58);
    float longitude = atan(bh.y, bh.x) / TAU;
    float latitude = asin(clamp(bh.z, -1.0, 1.0)) / PI;
    float meridian = chartLine(longitude + 0.011 * uFlow, 17.0);
    float parallel = chartLine(latitude, 11.0);
    float chart = max(meridian, parallel);
    float wash = 0.5 + 0.5 * bh.z;
    vec3 col = mix(PAPER, PAPERBLUE, 0.12 + 0.14 * wash + 0.08 * uCentroid);
    col *= 0.92 + 0.08 * vnoise(fc * 0.018 + bh.xy * 3.0);
    col = mix(col, mix(GRAPHITE, COBALT, 0.30), chart * (0.035 + 0.10 * uTreble));

    // Near misses leave a cool contact-print stain rather than a neon glow.
    float contact = 1.0 - exp(-halo * (0.52 + 0.72 * uLevel));
    col = mix(col, mix(PAPERBLUE, COBALT, 0.22) * 0.62,
              clamp(contact * (0.14 + 0.16 * uLevel), 0.0, 0.34));

    if (hit) {
        vec3 p = ro + rd * t;
        vec3 n = fibreNormal(p);
        vec3 v = -rd;
        vec3 l1 = normalize(vec3(-0.55, 0.72, 0.95));
        vec3 l2 = normalize(vec3( 0.80, -0.22, 0.40));

        float band = 0.025 + 0.93 * ((fid + 0.5) / float(NFIBRE));
        float e = spec(band);
        float phase = fibrePhase(p);
        float wave = wav(fract(phase + band * 0.23));

        vec3 hue = fibreHue(band + 0.10 * uCentroid + 0.035 * wave);
        float nd1 = max(dot(n, l1), 0.0);
        float nd2 = max(dot(n, l2), 0.0);
        float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        float gloss = pow(max(dot(reflect(-l1, n), v), 0.0), 72.0);
        float broad = pow(max(dot(reflect(-l2, n), v), 0.0), 10.0);

        // Integer phase winding marks reveal that every apparent ring is a
        // single fibre.  The waveform shifts those marks around the circle.
        float turns = 3.0 + mod(fid, 4.0);
        float phaseInk = pow(0.5 + 0.5 * cos(TAU * (phase * turns
                         - uFlow * (0.035 + band * 0.028) + wave * 0.10)), 15.0);

        vec3 surf = mix(GRAPHITE, hue * (0.34 + 0.90 * e), 0.26 + 0.58 * e);
        surf *= 0.20 + 0.70 * nd1 + 0.22 * nd2;
        surf += mix(hue, CITRON, 0.22) * phaseInk * (0.10 + 1.15 * e + 0.30 * uLevel);
        surf += vec3(1.0, 0.96, 0.86) * gloss * (0.55 + 1.50 * e);
        surf += mix(COBALT, MINTINK, band) * broad * 0.10;
        surf += hue * fres * (0.16 + 0.45 * e);

        // uBeat decays while the head advances once around each phase circle.
        float head = fract((1.0 - uBeat) * 0.92 + band * 0.17);
        float pd = abs(fract(phase - head + 0.5) - 0.5);
        float pulse = exp(-pd * pd / (0.0012 + 0.012 * (1.0 - uBeat))) * uBeat;
        surf += mix(VERMILION, CITRON, uBass) * pulse * (0.65 + 1.60 * uBass);

        // A little ambient occlusion at crossings makes the linking legible.
        float ao = 1.0;
        for (int i = 1; i <= 4; i++) {
            float h = 0.025 * float(i);
            ao -= (h - fibreMap(p + n * h).x) * (0.72 / float(i));
        }
        surf *= clamp(ao, 0.38, 1.0);

        // Stereographic infinity is shown as whitening depth, not black fog.
        float paperFog = smoothstep(3.8, 7.4, t) * 0.34;
        col = mix(surf, col, paperFog);
    }

    // Beat inversion: the paper briefly takes the complementary ink colour.
    col = mix(col, col.bgr * vec3(0.86, 0.94, 1.05), 0.055 * uBeat);
    return vec4(max(col, 0.0), 1.0);
}
