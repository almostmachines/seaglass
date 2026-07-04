// swell — the spectrum resynthesized as deep water.
//
// Every band of the spectrum becomes a travelling wave on one surface:
// wavelength log-spaced like the analyser, direction scattered around a
// slowly turning storm heading, and speed set by the dispersion relation
// of real deep water, w = sqrt(g*k). Long waves outrun short ones — which
// is what a swell IS: a distant storm's energy sorted by wavelength on
// the way here. Bass arrives as broad coherent rollers, treble as
// scattered chop riding on top.
//
// Everything visible falls out of that one field and its derivatives:
// the gradient tilts the surface for sun glitter, the negative laplacian
// finds where wavefronts focus into caustic filaments (its k^2 weighting
// makes the caustics dance on the treble without being told to), and
// height plus steepness decide where crests break into foam. The
// waveform lies beneath the surface as a thread of light the water
// refracts — each colour channel bent a little differently, so the sea
// splits it into fringes. On a beat, a circular wave packet is dropped
// onto the field like a stone and disperses as it runs.

const int NWAVE = 28;

float lobe(float d, float w) { return (w * w) / (d * d + w * w); }

// the whole scene reads this one field: h, dh/dx, dh/dy, -laplacian(h)
vec4 sea(vec2 p, float t) {
    float h = 0.0, focus = 0.0;
    vec2 g = vec2(0.0);
    float storm = 1.7 + uFlow * 0.026; // where the weather is coming from
    for (int i = 0; i < NWAVE; i++) {
        float bt = (float(i) + 0.5) / float(NWAVE);
        float k = 2.0 * exp2(4.6 * bt); // wavenumber, ~2 .. ~48
        float e = spec(bt);
        float amp = (0.30 * e * e + 0.005) / (1.0 + k); // silence = calm glass
        float aim = mix(0.30, 2.60, bt * bt); // bass coherent, treble chop
        float th = storm + (hash12(vec2(float(i) * 12.9, 4.7)) - 0.5) * aim;
        vec2 dir = vec2(cos(th), sin(th));
        float ph = dot(dir, p) * k - 2.1 * sqrt(k) * t + float(i) * 2.39996;
        float s = sin(ph), c = cos(ph);
        h += amp * s;
        g += amp * k * c * dir;
        focus += amp * k * k * s;
    }
    // the beat drops a stone: a circular packet, dispersing as it runs
    vec2 rq = p - 0.6 * vec2(sin(uFlow * 0.11), cos(uFlow * 0.073));
    float rr = max(length(rq), 1e-4);
    float R = 0.10 + 2.6 * (1.0 - uBeat);
    float dd = (rr - R) / (0.26 + 0.55 * (1.0 - uBeat));
    float ab = 0.20 * uBeat * (0.35 + 0.95 * uBass) * exp(-dd * dd);
    float phb = (rr - R) * 9.0;
    h += ab * cos(phb);
    g -= ab * 9.0 * sin(phb) * (rq / rr);
    focus += ab * 81.0 * cos(phb);
    return vec4(h, g, focus);
}

vec4 render(vec2 fc) {
    vec2 uv = fc / uRes;
    vec2 q = (fc - 0.5 * uRes) / uRes.y;

    // a gentle warp so the plane waves never feel machine-ruled
    vec2 wr = vec2(fbm(q * 1.3 + vec2(0.0, uFlow * 0.021)),
                   fbm(q * 1.3 + vec2(5.2, -uFlow * 0.017))) - 0.5;
    vec2 p = rot(0.07 * sin(uFlow * 0.043)) * q * 3.0 + 0.4 * wr;

    float t = uFlow * 0.9 + uTime * 0.05;
    vec4 f = sea(p, t);

    // wave sets: real seas arrive in groups, so let regions of the field
    // swell and slacken as slow weather passing through
    float sets = 0.55 + 0.90 * fbm(p * 0.45 + vec2(t * 0.10, -t * 0.06));
    f *= sets;

    float h = f.x;
    vec2 slope = f.yz;
    float steep = length(slope);
    vec3 n = normalize(vec3(-slope * 0.85, 1.0));

    // a low light that wanders; bright music lifts it toward white noon,
    // dark music drops it to an amber rake across the water
    float laz = 0.8 + uFlow * 0.05;
    float lel = mix(0.32, 1.05, uCentroid);
    vec3 L = normalize(vec3(cos(laz) * cos(lel), sin(laz) * cos(lel), sin(lel)));
    vec3 suncol = mix(AMBER, FROST, uCentroid);

    // the water body: troughs keep the deep, crests lift toward aqua
    float lift = smoothstep(-0.30, 0.38, h);
    vec3 col = mix(DEEP * 0.5, JADE * 0.85, lift);
    col = mix(col, AQUA * 0.9, smoothstep(0.55, 1.0, lift) * (0.35 + 0.65 * uLevel));
    col *= 0.45 + 0.75 * max(dot(n, L), 0.0);

    // sky sheen where the surface tips away
    float fres = pow(clamp(1.0 - n.z, 0.0, 1.0), 1.5);
    col += mix(JADE, FROST, uCentroid) * fres * 0.9;

    // caustic filaments where wavefronts focus
    float fo = max(f.w, 0.0) * 0.40;
    float caust = (fo * fo) / (1.0 + fo * fo);
    col += mix(AQUA, FROST, 0.5 + 0.5 * uCentroid) * caust
         * (0.12 + 0.85 * uLevel + 0.35 * uTreble);

    // sun glitter riding the slopes
    vec3 hv = normalize(L + vec3(0.0, 0.0, 1.0));
    float facing = max(dot(n, hv), 0.0);
    col += suncol * pow(facing, 110.0) * (0.35 + 2.6 * uLevel + 1.2 * uBeat);
    col += suncol * pow(facing, 18.0) * 0.18 * (0.3 + 0.7 * uLevel);

    // foam where crests actually break: height AND steepness, granulated
    float crest = smoothstep(0.10, 0.50, h)
                * smoothstep(0.45, 1.25, steep + 0.6 * uBeat);
    float grain = fbm(p * 7.0 + slope * 1.3 + vec2(0.0, uFlow * 0.33));
    col += FROST * crest * smoothstep(0.38, 0.72, grain) * (0.30 + 0.90 * uLevel);

    // the waveform sleeps under the surface; the swell refracts it, each
    // colour bent a little differently — dispersion again, in miniature
    vec3 thread = vec3(0.0);
    for (int ch = 0; ch < 3; ch++) {
        vec2 ru = uv + slope * (0.030 + 0.011 * float(ch));
        float yw = 0.46 + wav(ru.x) * (0.09 + 0.10 * uLevel);
        thread[ch] = lobe(ru.y - yw, 0.0045 + 0.0045 * uLevel);
    }
    col += thread * (0.16 + 0.85 * uLevel);
    col += AQUA * lobe(uv.y + slope.y * 0.036 - 0.46 - wav(uv.x) * 0.09, 0.05)
         * 0.10 * (0.3 + 0.7 * uLevel);

    // spindrift: treble spray torn off the crests, blown downwind
    vec2 sp = p * 9.0 + vec2(uFlow * 1.4, uFlow * 0.55);
    vec2 sid = floor(sp);
    float sh = hash12(sid);
    vec2 soff = (vec2(hash12(sid + 7.3), hash12(sid + 29.1)) - 0.5) * 0.6;
    float star = smoothstep(0.15, 0.02, length(fract(sp) - 0.5 - soff));
    float gate = smoothstep(0.985 - 0.012 * uTreble, 1.0, sh);
    float twinkle = 0.5 + 0.5 * sin(uTime * (6.0 + 9.0 * sh) + sh * 50.0);
    col += mix(FROST, AQUA, sh) * star * gate * twinkle
         * uTreble * (0.35 + 1.1 * smoothstep(0.02, 0.22, h));

    // the sea answers the beat with light as well as water
    col *= 1.0 + 0.15 * uBeat + 0.07 * uLevel;
    return vec4(col, 1.0);
}
