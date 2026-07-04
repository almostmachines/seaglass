#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif
#include "audio.h"

#include <errno.h>
#include <math.h>
#include <pthread.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

#define N_BACKENDS 2

static const char *BACKEND_NAMES[N_BACKENDS] = { "pw-record", "parec" };

struct Audio {
    pthread_mutex_t lock;
    float ring[AUDIO_RING];
    uint64_t wpos;

    pthread_t thread;
    int thread_live;
    int fd;
    pid_t pid;
    int backend;      /* backend of the running / last process */
    int next_backend; /* what to try on the next spawn */
    int have_data;    /* current process delivered samples */
    int ever_data;    /* any process ever delivered samples */
    int fails;        /* consecutive spawns that produced no data */
    volatile int stop;
    volatile int dead;
    double last_spawn;
};

static double now_sec(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (double)ts.tv_sec + (double)ts.tv_nsec * 1e-9;
}

static void *reader_main(void *ud) {
    Audio *a = ud;
    unsigned char buf[8192];
    float f[2048];
    size_t have = 0;
    while (!a->stop) {
        ssize_t r = read(a->fd, buf + have, sizeof buf - have);
        if (r <= 0) {
            if (r < 0 && errno == EINTR)
                continue;
            break;
        }
        have += (size_t)r;
        size_t frames = have / 8; /* interleaved stereo f32 */
        if (frames == 0)
            continue;
        memcpy(f, buf, frames * 8);
        pthread_mutex_lock(&a->lock);
        for (size_t i = 0; i < frames; i++) {
            float m = 0.5f * (f[2 * i] + f[2 * i + 1]);
            if (!isfinite(m))
                m = 0.0f;
            a->ring[a->wpos & (AUDIO_RING - 1)] = m;
            a->wpos++;
        }
        a->have_data = 1;
        pthread_mutex_unlock(&a->lock);
        size_t rest = have - frames * 8;
        memmove(buf, buf + frames * 8, rest);
        have = rest;
    }
    a->dead = 1;
    return NULL;
}

static int spawn(Audio *a, int which) {
    int p[2];
    if (pipe(p))
        return -1;
    pid_t pid = fork();
    if (pid < 0) {
        close(p[0]);
        close(p[1]);
        return -1;
    }
    if (pid == 0) {
        dup2(p[1], 1);
        close(p[0]);
        close(p[1]);
        if (which == 0) {
            /* stream.capture.sink=true: record the monitor of the
               default sink, i.e. exactly what the speakers get */
            execlp("pw-record", "pw-record",
                   "-P", "{ stream.capture.sink = true }",
                   "--format", "f32", "--rate", "48000", "--channels", "2",
                   "--latency", "1024",
                   "-", (char *)NULL);
        } else {
            execlp("sh", "sh", "-c",
                   "exec parec --device=\"$(pactl get-default-sink).monitor\""
                   " --format=float32le --rate=48000 --channels=2"
                   " --latency-msec=20",
                   (char *)NULL);
        }
        _exit(127);
    }
    close(p[1]);
    a->fd = p[0];
    a->pid = pid;
    a->backend = which;
    a->have_data = 0;
    a->stop = 0;
    a->dead = 0;
    a->last_spawn = now_sec();
    if (pthread_create(&a->thread, NULL, reader_main, a)) {
        kill(pid, SIGTERM);
        close(a->fd);
        waitpid(pid, NULL, 0);
        a->fd = -1;
        a->pid = -1;
        return -1;
    }
    a->thread_live = 1;
    return 0;
}

static void reap(Audio *a) {
    if (a->pid < 0)
        return;
    a->stop = 1;
    kill(a->pid, SIGTERM);
    if (a->thread_live) {
        struct timespec until;
        clock_gettime(CLOCK_REALTIME, &until);
        until.tv_sec += 1;
        if (pthread_timedjoin_np(a->thread, NULL, &until)) {
            kill(a->pid, SIGKILL);
            pthread_join(a->thread, NULL);
        }
        a->thread_live = 0;
    }
    close(a->fd);
    waitpid(a->pid, NULL, 0);
    a->fd = -1;
    a->pid = -1;
}

void audio_maintain(Audio *a) {
    if (a->have_data)
        a->ever_data = 1;
    if (a->pid >= 0 && a->dead) {
        int had = a->have_data;
        reap(a);
        if (had) {
            a->fails = 0;
            a->next_backend = a->backend; /* it worked; device may just have changed */
        } else {
            a->fails++;
            a->next_backend = (a->backend + 1) % N_BACKENDS;
            if (a->fails == 2 * N_BACKENDS)
                fprintf(stderr,
                        "seaglass: no capture backend is delivering audio "
                        "(tried pw-record and parec); still retrying\n");
        }
    }
    if (a->pid < 0) {
        double backoff = a->fails >= 2 * N_BACKENDS ? 5.0
                       : (a->ever_data ? 1.5 : 0.5);
        if (now_sec() - a->last_spawn >= backoff)
            if (spawn(a, a->next_backend) != 0)
                a->last_spawn = now_sec();
    }
}

Audio *audio_start(void) {
    Audio *a = calloc(1, sizeof *a);
    if (!a)
        return NULL;
    pthread_mutex_init(&a->lock, NULL);
    a->fd = -1;
    a->pid = -1;
    a->last_spawn = now_sec() - 1e6; /* spawn immediately */
    audio_maintain(a);
    return a;
}

void audio_restart(Audio *a) {
    reap(a);
    a->fails = 0;
    a->last_spawn = now_sec() - 1e6;
    audio_maintain(a);
}

void audio_stop(Audio *a) {
    if (!a)
        return;
    reap(a);
    pthread_mutex_destroy(&a->lock);
    free(a);
}

uint64_t audio_latest(Audio *a, float *dst, size_t n) {
    pthread_mutex_lock(&a->lock);
    uint64_t w = a->wpos;
    size_t take = n;
    if (take > AUDIO_RING)
        take = AUDIO_RING;
    if ((uint64_t)take > w)
        take = (size_t)w;
    size_t pad = n - take;
    memset(dst, 0, pad * sizeof *dst);
    for (size_t i = 0; i < take; i++)
        dst[pad + i] = a->ring[(w - take + i) & (AUDIO_RING - 1)];
    pthread_mutex_unlock(&a->lock);
    return w;
}

const char *audio_backend_name(Audio *a) {
    if (a->pid >= 0 && a->have_data)
        return BACKEND_NAMES[a->backend];
    return NULL;
}
