#pragma once

/* In-place iterative radix-2 complex FFT; n must be a power of two. */
void fft_exec(float *re, float *im, int n);
