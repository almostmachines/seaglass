#pragma once

#include <stdint.h>

#define DSP_FFT_N 4096
#define DSP_BANDS 96
#define DSP_WAVE_N 512

typedef struct {
    float spec[DSP_BANDS];  /* smoothed log-spaced spectrum, 0..1 */
    float wave[DSP_WAVE_N]; /* recent waveform, auto-gained, -1..1 */
    float bass, mid, treble; /* band envelopes, 0..1 */
    float level;    /* overall loudness envelope, 0..1 */
    float beat;     /* 1.0 at a bass onset, exponential decay */
    float centroid; /* spectral centroid, 0 dark .. 1 bright */
    float flow;     /* accumulated "musical time" for shader motion */
} DspOut;

typedef struct Dsp Dsp;

Dsp *dsp_new(void);
void dsp_free(Dsp *d);

/* samples: the DSP_FFT_N most recent mono samples.
   total_captured: monotonic sample count from audio_latest(), used to
   detect a stalled capture. dt: seconds since the previous call. */
void dsp_process(Dsp *d, const float *samples, uint64_t total_captured,
                 float dt, DspOut *out);
