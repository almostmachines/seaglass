#include "dsp.h"
#include "fft.h"

#include <math.h>
#include <stdlib.h>
#include <string.h>

#define F_LO 35.0f
#define F_HI 16000.0f
#define RATE 48000.0f

struct Dsp {
    float hann[DSP_FFT_N];
    float re[DSP_FFT_N], im[DSP_FFT_N];
    float mag[DSP_FFT_N / 2];
    int lo[DSP_BANDS], hi[DSP_BANDS];
    float fcenter[DSP_BANDS];
    float env[DSP_BANDS];
    float wave[DSP_WAVE_N];
    float peak_db;
    float wave_peak;
    float bass, mid, treble, level;
    float bass_slow, bass_prev;
    float beat, beat_cool;
    float centroid;
    float flow;
    uint64_t last_total;
    float stall;
};

static float clamp01(float x) { return x < 0.0f ? 0.0f : (x > 1.0f ? 1.0f : x); }

Dsp *dsp_new(void) {
    Dsp *d = calloc(1, sizeof *d);
    if (!d)
        return NULL;
    for (int i = 0; i < DSP_FFT_N; i++)
        d->hann[i] = 0.5f * (1.0f - cosf(2.0f * (float)M_PI * (float)i / (DSP_FFT_N - 1)));
    for (int k = 0; k < DSP_BANDS; k++) {
        float e0 = F_LO * powf(F_HI / F_LO, (float)k / DSP_BANDS);
        float e1 = F_LO * powf(F_HI / F_LO, (float)(k + 1) / DSP_BANDS);
        int lo = (int)(e0 * DSP_FFT_N / RATE);
        int hi = (int)(e1 * DSP_FFT_N / RATE);
        if (lo < 1) lo = 1;
        if (hi <= lo) hi = lo + 1;
        if (hi > DSP_FFT_N / 2) hi = DSP_FFT_N / 2;
        if (lo >= hi) lo = hi - 1;
        d->lo[k] = lo;
        d->hi[k] = hi;
        d->fcenter[k] = sqrtf(e0 * e1);
    }
    d->peak_db = -34.0f;
    d->wave_peak = 0.02f;
    d->centroid = 0.4f;
    return d;
}

void dsp_free(Dsp *d) { free(d); }

void dsp_process(Dsp *d, const float *s, uint64_t total, float dt, DspOut *out) {
    if (dt < 1e-4f) dt = 1e-4f;
    if (dt > 0.1f) dt = 0.1f;

    /* a stalled capture (no new samples) counts as silence */
    if (total == d->last_total)
        d->stall += dt;
    else
        d->stall = 0.0f;
    d->last_total = total;

    float maxabs = 0.0f;
    for (int i = DSP_FFT_N - 1024; i < DSP_FFT_N; i++) {
        float v = fabsf(s[i]);
        if (v > maxabs)
            maxabs = v;
    }
    int silent = (maxabs < 1.2e-3f) || (d->stall > 0.3f);

    for (int i = 0; i < DSP_FFT_N; i++) {
        d->re[i] = s[i] * d->hann[i];
        d->im[i] = 0.0f;
    }
    fft_exec(d->re, d->im, DSP_FFT_N);
    const float norm = 4.0f / DSP_FFT_N; /* undo hann coherent gain */
    for (int i = 0; i < DSP_FFT_N / 2; i++)
        d->mag[i] = hypotf(d->re[i], d->im[i]) * norm;

    /* log-spaced bands, auto-gained in dB space so quiet and loud
       sources both fill the display; the -34 dB floor on the tracked
       peak keeps true silence from being normalised up */
    float target[DSP_BANDS];
    float frame_max_db = -160.0f;
    for (int k = 0; k < DSP_BANDS; k++) {
        float m = 0.0f;
        for (int i = d->lo[k]; i < d->hi[k]; i++)
            m += d->mag[i];
        m /= (float)(d->hi[k] - d->lo[k]);
        float db = 20.0f * log10f(m + 1e-8f);
        target[k] = db;
        if (db > frame_max_db)
            frame_max_db = db;
    }
    d->peak_db -= 3.0f * dt;
    if (frame_max_db > d->peak_db) d->peak_db = frame_max_db;
    if (d->peak_db < -34.0f) d->peak_db = -34.0f;
    float floor_db = d->peak_db - 52.0f;
    for (int k = 0; k < DSP_BANDS; k++) {
        float n = clamp01((target[k] - floor_db) / 52.0f);
        target[k] = silent ? 0.0f : powf(n, 1.7f);
    }

    float att = 1.0f - expf(-dt / 0.025f);
    float rel = 1.0f - expf(-dt / 0.28f);
    for (int k = 0; k < DSP_BANDS; k++) {
        float c = target[k] > d->env[k] ? att : rel;
        d->env[k] += (target[k] - d->env[k]) * c;
        out->spec[k] = d->env[k];
    }

    /* half mean, half peak: broadband bass reads high, but a single
       strong band (a pure kick) still comes through undiluted */
    float tb = 0.0f, tm = 0.0f, tt = 0.0f;
    float xb = 0.0f, xm = 0.0f, xt = 0.0f;
    int nb = 0, nm = 0, nt = 0;
    for (int k = 0; k < DSP_BANDS; k++) {
        float f = d->fcenter[k];
        float v = target[k];
        if (f < 140.0f) { tb += v; nb++; if (v > xb) xb = v; }
        else if (f >= 300.0f && f < 2000.0f) { tm += v; nm++; if (v > xm) xm = v; }
        else if (f >= 4000.0f && f < 14000.0f) { tt += v; nt++; if (v > xt) xt = v; }
    }
    tb = 0.5f * (tb / (nb ? (float)nb : 1.0f)) + 0.5f * xb;
    tm = 0.5f * (tm / (nm ? (float)nm : 1.0f)) + 0.5f * xm;
    tt = 0.5f * (tt / (nt ? (float)nt : 1.0f)) + 0.5f * xt;
    float attf = 1.0f - expf(-dt / 0.015f);
    float relf = 1.0f - expf(-dt / 0.30f);
    d->bass += (tb - d->bass) * (tb > d->bass ? attf : relf);
    d->mid += (tm - d->mid) * (tm > d->mid ? attf : relf);
    d->treble += (tt - d->treble) * (tt > d->treble ? attf : relf);
    d->bass_slow += (d->bass - d->bass_slow) * (1.0f - expf(-dt / 2.5f));

    /* beat: bass envelope jumping past its own slow average
       (decay first so a fresh beat leaves this frame at full 1.0) */
    d->beat *= expf(-dt / 0.14f);
    d->beat_cool -= dt;
    if (!silent && d->beat_cool <= 0.0f && d->bass > 0.12f &&
        d->bass > d->bass_prev + 0.01f && /* onsets only, not release tails */
        d->bass > d->bass_slow * 1.38f + 0.04f) {
        d->beat = 1.0f;
        d->beat_cool = 0.20f;
    }
    d->bass_prev = d->bass;

    float rms = 0.0f;
    for (int i = DSP_FFT_N - 1024; i < DSP_FFT_N; i++)
        rms += s[i] * s[i];
    rms = sqrtf(rms / 1024.0f);
    d->wave_peak *= expf(-dt / 5.0f);
    if (maxabs > d->wave_peak) d->wave_peak = maxabs;
    if (d->wave_peak < 0.02f) d->wave_peak = 0.02f;
    float gain = 0.9f / d->wave_peak;
    float ltarget = silent ? 0.0f : clamp01(rms * gain * 1.4f);
    d->level += (ltarget - d->level) * (ltarget > d->level ? attf : relf);

    /* waveform trace: trigger on a rising zero crossing so the display
       doesn't scroll wildly frame to frame */
    if (!silent) {
        const float *tail = s + DSP_FFT_N - 2560; /* 512 search + 2048 window */
        int start = 256;
        for (int i = 0; i < 512; i++) {
            if (tail[i] <= 0.0f && tail[i + 1] > 0.0f) {
                start = i;
                break;
            }
        }
        for (int i = 0; i < DSP_WAVE_N; i++) {
            float v = 0.25f * (tail[start + 4 * i] + tail[start + 4 * i + 1] +
                               tail[start + 4 * i + 2] + tail[start + 4 * i + 3]);
            d->wave[i] = tanhf(v * gain * 1.2f);
        }
        float prev = d->wave[0];
        for (int i = 1; i < DSP_WAVE_N - 1; i++) {
            float cur = d->wave[i];
            d->wave[i] = 0.25f * prev + 0.5f * cur + 0.25f * d->wave[i + 1];
            prev = cur;
        }
    } else {
        float k = expf(-dt / 0.35f);
        for (int i = 0; i < DSP_WAVE_N; i++)
            d->wave[i] *= k;
    }
    memcpy(out->wave, d->wave, sizeof d->wave);

    float sw = 0.0f, swf = 0.0f;
    for (int i = 1; i < DSP_FFT_N / 2; i++) {
        float f = (float)i * RATE / DSP_FFT_N;
        if (f > 12000.0f)
            break;
        sw += d->mag[i];
        swf += d->mag[i] * f;
    }
    if (sw > 1e-5f && !silent) {
        float c = swf / sw;
        float x = clamp01(logf(c / 110.0f) / logf(7000.0f / 110.0f));
        d->centroid += (x - d->centroid) * (1.0f - expf(-dt / 0.8f));
    }

    d->flow += dt * (0.05f + 0.65f * d->level + 0.55f * d->bass);

    out->bass = d->bass;
    out->mid = d->mid;
    out->treble = d->treble;
    out->level = d->level;
    out->beat = d->beat;
    out->centroid = d->centroid;
    out->flow = d->flow;
}
