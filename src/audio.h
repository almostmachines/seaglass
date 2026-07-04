#pragma once

#include <stddef.h>
#include <stdint.h>

#define AUDIO_RATE 48000
#define AUDIO_RING 32768 /* mono samples, power of two */

typedef struct Audio Audio;

Audio *audio_start(void);
void audio_stop(Audio *a);

/* Call once per frame: reaps a dead capture process and respawns,
   cycling between pw-record and parec until one delivers data. */
void audio_maintain(Audio *a);

/* Kill the current capture process; audio_maintain() respawns it.
   Useful after switching the default output device. */
void audio_restart(Audio *a);

/* Copies the most recent n mono samples into dst (zero-padded at the
   front if fewer have been captured). Returns total samples captured. */
uint64_t audio_latest(Audio *a, float *dst, size_t n);

/* Name of the capture backend, or NULL if none has delivered data yet. */
const char *audio_backend_name(Audio *a);
