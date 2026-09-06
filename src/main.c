#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif
#include <SDL.h>
#include <SDL_opengl.h>

#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <time.h>
#include <unistd.h>

#include "audio.h"
#include "dsp.h"

/* ---- GL core-profile entry points, loaded via SDL ---- */
#define GL_LIST \
    GLF(PFNGLCREATESHADERPROC, CreateShader) \
    GLF(PFNGLSHADERSOURCEPROC, ShaderSource) \
    GLF(PFNGLCOMPILESHADERPROC, CompileShader) \
    GLF(PFNGLGETSHADERIVPROC, GetShaderiv) \
    GLF(PFNGLGETSHADERINFOLOGPROC, GetShaderInfoLog) \
    GLF(PFNGLCREATEPROGRAMPROC, CreateProgram) \
    GLF(PFNGLATTACHSHADERPROC, AttachShader) \
    GLF(PFNGLLINKPROGRAMPROC, LinkProgram) \
    GLF(PFNGLGETPROGRAMIVPROC, GetProgramiv) \
    GLF(PFNGLGETPROGRAMINFOLOGPROC, GetProgramInfoLog) \
    GLF(PFNGLDELETESHADERPROC, DeleteShader) \
    GLF(PFNGLDELETEPROGRAMPROC, DeleteProgram) \
    GLF(PFNGLUSEPROGRAMPROC, UseProgram) \
    GLF(PFNGLGETUNIFORMLOCATIONPROC, GetUniformLocation) \
    GLF(PFNGLUNIFORM1FPROC, Uniform1f) \
    GLF(PFNGLUNIFORM2FPROC, Uniform2f) \
    GLF(PFNGLUNIFORM1IPROC, Uniform1i) \
    GLF(PFNGLGENVERTEXARRAYSPROC, GenVertexArrays) \
    GLF(PFNGLBINDVERTEXARRAYPROC, BindVertexArray) \
    GLF(PFNGLACTIVETEXTUREPROC, ActiveTexture)

#define GLF(T, name) static T p_gl##name;
GL_LIST
#undef GLF

#define glCreateShader p_glCreateShader
#define glShaderSource p_glShaderSource
#define glCompileShader p_glCompileShader
#define glGetShaderiv p_glGetShaderiv
#define glGetShaderInfoLog p_glGetShaderInfoLog
#define glCreateProgram p_glCreateProgram
#define glAttachShader p_glAttachShader
#define glLinkProgram p_glLinkProgram
#define glGetProgramiv p_glGetProgramiv
#define glGetProgramInfoLog p_glGetProgramInfoLog
#define glDeleteShader p_glDeleteShader
#define glDeleteProgram p_glDeleteProgram
#define glUseProgram p_glUseProgram
#define glGetUniformLocation p_glGetUniformLocation
#define glUniform1f p_glUniform1f
#define glUniform2f p_glUniform2f
#define glUniform1i p_glUniform1i
#define glGenVertexArrays p_glGenVertexArrays
#define glBindVertexArray p_glBindVertexArray
#define glActiveTexture p_glActiveTexture

static int load_gl(void) {
#define GLF(T, name) \
    p_gl##name = (T)SDL_GL_GetProcAddress("gl" #name); \
    if (!p_gl##name) { \
        fprintf(stderr, "seaglass: missing GL entry point gl%s\n", #name); \
        return -1; \
    }
    GL_LIST
#undef GLF
    return 0;
}

/* ---- scenes and shader plumbing ---- */
static const char *SCENE_NAMES[] = { "tide", "bloom", "drift", "lark", "prism", "swell", "bower" };
#define N_SCENES ((int)(sizeof SCENE_NAMES / sizeof SCENE_NAMES[0]))

typedef struct {
    GLint res, time, bass, mid, treble, level, beat, centroid, flow, spec, wave;
} Uniforms;

static char shader_dir[900];

static const char *VS_SRC =
    "#version 330 core\n"
    "void main() {\n"
    "    vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));\n"
    "    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);\n"
    "}\n";

static const char *FRAG_FOOTER =
    "\nvoid main() {\n"
    "    vec3 c = render(gl_FragCoord.xy).rgb;\n"
    "    fragColor = vec4(finish(c, gl_FragCoord.xy), 1.0);\n"
    "}\n";

static char *read_file(const char *path) {
    FILE *f = fopen(path, "rb");
    if (!f)
        return NULL;
    fseek(f, 0, SEEK_END);
    long len = ftell(f);
    fseek(f, 0, SEEK_SET);
    if (len < 0) {
        fclose(f);
        return NULL;
    }
    char *buf = malloc((size_t)len + 1);
    if (!buf) {
        fclose(f);
        return NULL;
    }
    if (fread(buf, 1, (size_t)len, f) != (size_t)len) {
        fclose(f);
        free(buf);
        return NULL;
    }
    fclose(f);
    buf[len] = 0;
    return buf;
}

static GLuint compile(GLenum type, const char *src, const char *what) {
    GLuint sh = glCreateShader(type);
    glShaderSource(sh, 1, &src, NULL);
    glCompileShader(sh);
    GLint ok = 0;
    glGetShaderiv(sh, GL_COMPILE_STATUS, &ok);
    if (!ok) {
        char log[4096];
        glGetShaderInfoLog(sh, sizeof log, NULL, log);
        fprintf(stderr, "seaglass: %s failed to compile:\n%s\n", what, log);
        glDeleteShader(sh);
        return 0;
    }
    return sh;
}

static GLuint build_scene(const char *scene) {
    char path[1024];
    snprintf(path, sizeof path, "%.860s/common.glsl", shader_dir);
    char *common = read_file(path);
    if (!common) {
        fprintf(stderr, "seaglass: cannot read %s\n", path);
        return 0;
    }
    snprintf(path, sizeof path, "%.860s/%.32s.frag", shader_dir, scene);
    char *body = read_file(path);
    if (!body) {
        fprintf(stderr, "seaglass: cannot read %s\n", path);
        free(common);
        return 0;
    }

    size_t n = strlen(common) + strlen(body) + 512;
    char *frag = malloc(n);
    if (!frag) {
        free(common);
        free(body);
        return 0;
    }
    snprintf(frag, n, "#version 330 core\n#line 1 0\n%s\n#line 1 1\n%s%s",
             common, body, FRAG_FOOTER);
    free(common);
    free(body);

    GLuint vs = compile(GL_VERTEX_SHADER, VS_SRC, "vertex shader");
    char what[128];
    snprintf(what, sizeof what, "%.32s.frag (0:* = common.glsl, 1:* = scene)", scene);
    GLuint fs = compile(GL_FRAGMENT_SHADER, frag, what);
    free(frag);
    if (!vs || !fs) {
        if (vs) glDeleteShader(vs);
        if (fs) glDeleteShader(fs);
        return 0;
    }

    GLuint prog = glCreateProgram();
    glAttachShader(prog, vs);
    glAttachShader(prog, fs);
    glLinkProgram(prog);
    glDeleteShader(vs);
    glDeleteShader(fs);
    GLint ok = 0;
    glGetProgramiv(prog, GL_LINK_STATUS, &ok);
    if (!ok) {
        char log[4096];
        glGetProgramInfoLog(prog, sizeof log, NULL, log);
        fprintf(stderr, "seaglass: link failed for %s:\n%s\n", scene, log);
        glDeleteProgram(prog);
        return 0;
    }
    return prog;
}

static void fetch_uniforms(GLuint prog, Uniforms *u) {
    u->res = glGetUniformLocation(prog, "uRes");
    u->time = glGetUniformLocation(prog, "uTime");
    u->bass = glGetUniformLocation(prog, "uBass");
    u->mid = glGetUniformLocation(prog, "uMid");
    u->treble = glGetUniformLocation(prog, "uTreble");
    u->level = glGetUniformLocation(prog, "uLevel");
    u->beat = glGetUniformLocation(prog, "uBeat");
    u->centroid = glGetUniformLocation(prog, "uCentroid");
    u->flow = glGetUniformLocation(prog, "uFlow");
    u->spec = glGetUniformLocation(prog, "uSpec");
    u->wave = glGetUniformLocation(prog, "uWave");
    glUseProgram(prog);
    glUniform1i(u->spec, 0);
    glUniform1i(u->wave, 1);
}

static void resolve_shader_dir(void) {
    struct stat st;
    if (stat("shaders/common.glsl", &st) == 0) {
        snprintf(shader_dir, sizeof shader_dir, "shaders");
        return;
    }
    char exe[800];
    ssize_t n = readlink("/proc/self/exe", exe, sizeof exe - 1);
    if (n > 0) {
        exe[n] = 0;
        char *slash = strrchr(exe, '/');
        if (slash) {
            *slash = 0;
            snprintf(shader_dir, sizeof shader_dir, "%.790s/shaders", exe);
            char probe[1024];
            snprintf(probe, sizeof probe, "%.860s/common.glsl", shader_dir);
            if (stat(probe, &st) == 0)
                return;
        }
    }
    snprintf(shader_dir, sizeof shader_dir, "shaders");
}

static void stat_shaders(int scene, time_t *c, time_t *s) {
    struct stat st;
    char path[1024];
    *c = 0;
    *s = 0;
    snprintf(path, sizeof path, "%.860s/common.glsl", shader_dir);
    if (stat(path, &st) == 0)
        *c = st.st_mtime;
    snprintf(path, sizeof path, "%.860s/%.32s.frag", shader_dir, SCENE_NAMES[scene]);
    if (stat(path, &st) == 0)
        *s = st.st_mtime;
}

/* headless DSP sanity check: feed a 440 Hz tone with 60 Hz bursts */
static int selftest(void) {
    Dsp *d = dsp_new();
    float s[DSP_FFT_N];
    DspOut o;
    memset(&o, 0, sizeof o);
    int beats = 0;
    for (int f = 0; f < 120; f++) {
        for (int i = 0; i < DSP_FFT_N; i++) {
            double n = (double)(f * 800 + i);
            float v = 0.30f * sinf(2.0f * (float)M_PI * 440.0f * (float)n / 48000.0f);
            if (f % 30 < 6)
                v += 0.25f * sinf(2.0f * (float)M_PI * 60.0f * (float)n / 48000.0f);
            s[i] = v;
        }
        dsp_process(d, s, (uint64_t)(f + 1) * 800, 1.0f / 60.0f, &o);
        if (o.beat > 0.95f)
            beats++;
    }
    int arg = 0;
    for (int k = 1; k < DSP_BANDS; k++)
        if (o.spec[k] > o.spec[arg])
            arg = k;
    printf("selftest: peak band %d (expect ~39 for 440 Hz), value %.2f\n",
           arg, o.spec[arg]);
    printf("selftest: bass=%.2f mid=%.2f treble=%.2f level=%.2f centroid=%.2f "
           "flow=%.2f beats=%d\n",
           o.bass, o.mid, o.treble, o.level, o.centroid, o.flow, beats);
    dsp_free(d);
    int ok = arg >= 36 && arg <= 43 && o.level > 0.1f && beats >= 2;
    printf("selftest: %s\n", ok ? "OK" : "FAILED");
    return ok ? 0 : 1;
}

int main(int argc, char **argv) {
    int fullscreen = 0, W = 1280, H = 720, scene = 0;
    for (int i = 1; i < argc; i++) {
        if (!strcmp(argv[i], "-f") || !strcmp(argv[i], "--fullscreen")) {
            fullscreen = 1;
        } else if (!strcmp(argv[i], "--selftest")) {
            return selftest();
        } else if (!strcmp(argv[i], "-s") && i + 1 < argc) {
            i++;
            int found = -1;
            for (int k = 0; k < N_SCENES; k++)
                if (!strcmp(argv[i], SCENE_NAMES[k]))
                    found = k;
            if (found < 0 && argv[i][0] >= '1' && argv[i][0] <= '9')
                found = atoi(argv[i]) - 1;
            if (found >= 0 && found < N_SCENES)
                scene = found;
        } else if (!strcmp(argv[i], "-w") && i + 1 < argc) {
            W = atoi(argv[++i]);
        } else if (!strcmp(argv[i], "-h") && i + 1 < argc) {
            H = atoi(argv[++i]);
        } else {
            printf("usage: seaglass [-f] [-s tide|bloom|drift|lark|prism|swell|bower] [-w width] [-h height] [--selftest]\n");
            return strcmp(argv[i], "--help") == 0 ? 0 : 1;
        }
    }
    if (W < 320) W = 320;
    if (H < 200) H = 200;

    resolve_shader_dir();

    if (SDL_Init(SDL_INIT_VIDEO) != 0) {
        fprintf(stderr, "seaglass: SDL_Init: %s\n", SDL_GetError());
        return 1;
    }
    SDL_GL_SetAttribute(SDL_GL_CONTEXT_MAJOR_VERSION, 3);
    SDL_GL_SetAttribute(SDL_GL_CONTEXT_MINOR_VERSION, 3);
    SDL_GL_SetAttribute(SDL_GL_CONTEXT_PROFILE_MASK, SDL_GL_CONTEXT_PROFILE_CORE);
    SDL_GL_SetAttribute(SDL_GL_DOUBLEBUFFER, 1);

    Uint32 flags = SDL_WINDOW_OPENGL | SDL_WINDOW_RESIZABLE | SDL_WINDOW_ALLOW_HIGHDPI;
    if (fullscreen)
        flags |= SDL_WINDOW_FULLSCREEN_DESKTOP;
    SDL_Window *win = SDL_CreateWindow("seaglass", SDL_WINDOWPOS_UNDEFINED,
                                       SDL_WINDOWPOS_UNDEFINED, W, H, flags);
    if (!win) {
        fprintf(stderr, "seaglass: window: %s\n", SDL_GetError());
        return 1;
    }
    SDL_GLContext ctx = SDL_GL_CreateContext(win);
    if (!ctx) {
        fprintf(stderr, "seaglass: GL context: %s\n", SDL_GetError());
        return 1;
    }
    SDL_GL_SetSwapInterval(1);
    if (load_gl() != 0)
        return 1;

    printf("seaglass: GL %s on %s\n", (const char *)glGetString(GL_VERSION),
           (const char *)glGetString(GL_RENDERER));

    GLuint vao;
    glGenVertexArrays(1, &vao);
    glBindVertexArray(vao);

    GLuint tex[2];
    glGenTextures(2, tex);
    glPixelStorei(GL_UNPACK_ALIGNMENT, 1);
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, tex[0]);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_R32F, DSP_BANDS, 1, 0, GL_RED, GL_FLOAT, NULL);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    glActiveTexture(GL_TEXTURE1);
    glBindTexture(GL_TEXTURE_2D, tex[1]);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_R32F, DSP_WAVE_N, 1, 0, GL_RED, GL_FLOAT, NULL);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);

    /* compile every scene once so syntax errors surface immediately */
    GLuint prog = 0;
    Uniforms uni;
    memset(&uni, 0, sizeof uni);
    for (int k = 0; k < N_SCENES; k++) {
        GLuint p = build_scene(SCENE_NAMES[k]);
        if (k == scene && p)
            prog = p;
        else if (p)
            glDeleteProgram(p);
    }
    if (prog)
        fetch_uniforms(prog, &uni);

    Audio *audio = audio_start();
    Dsp *dsp = dsp_new();
    if (!audio || !dsp) {
        fprintf(stderr, "seaglass: out of memory\n");
        return 1;
    }

    printf("seaglass: scenes: 1 tide  2 bloom  3 drift  4 lark  5 prism  6 swell  7 bower  (space cycles)\n");
    printf("seaglass: keys: f fullscreen, r reload shaders, a restart audio, q quit\n");

    Uint64 pf = SDL_GetPerformanceFrequency();
    Uint64 tprev = SDL_GetPerformanceCounter();
    double tsec = 0.0, watch_timer = 0.0, nodata = 0.0;
    int running = 1, isfs = fullscreen, announced = 0, hinted = 0;
    time_t mt_c, mt_s;
    stat_shaders(scene, &mt_c, &mt_s);

    float samples[DSP_FFT_N];
    DspOut out;
    memset(&out, 0, sizeof out);

    while (running) {
        int want_rebuild = 0;
        SDL_Event ev;
        while (SDL_PollEvent(&ev)) {
            if (ev.type == SDL_QUIT) {
                running = 0;
            } else if (ev.type == SDL_KEYDOWN) {
                SDL_Keycode k = ev.key.keysym.sym;
                if (k == SDLK_q || k == SDLK_ESCAPE) {
                    running = 0;
                } else if (k == SDLK_f || k == SDLK_F11) {
                    isfs = !isfs;
                    SDL_SetWindowFullscreen(win, isfs ? SDL_WINDOW_FULLSCREEN_DESKTOP : 0);
                } else if (k == SDLK_r) {
                    want_rebuild = 1;
                } else if (k == SDLK_a) {
                    audio_restart(audio);
                } else if (k == SDLK_SPACE) {
                    scene = (scene + 1) % N_SCENES;
                    want_rebuild = 1;
                } else if (k >= SDLK_1 && k < SDLK_1 + N_SCENES && k <= SDLK_9) {
                    scene = (int)(k - SDLK_1);
                    want_rebuild = 1;
                }
            }
        }

        Uint64 tnow = SDL_GetPerformanceCounter();
        float dt = (float)((double)(tnow - tprev) / (double)pf);
        tprev = tnow;
        if (dt > 0.1f)
            dt = 0.1f;
        tsec += dt;

        /* hot reload: recompile when a watched shader file changes */
        watch_timer += dt;
        if (watch_timer > 0.5) {
            watch_timer = 0.0;
            time_t c, s2;
            stat_shaders(scene, &c, &s2);
            if (c != mt_c || s2 != mt_s)
                want_rebuild = 1;
        }
        if (want_rebuild) {
            GLuint pnew = build_scene(SCENE_NAMES[scene]);
            if (pnew) {
                if (prog)
                    glDeleteProgram(prog);
                prog = pnew;
                fetch_uniforms(prog, &uni);
                printf("seaglass: scene '%s' loaded\n", SCENE_NAMES[scene]);
            }
            stat_shaders(scene, &mt_c, &mt_s);
        }

        audio_maintain(audio);
        if (!announced) {
            const char *bn = audio_backend_name(audio);
            if (bn) {
                printf("seaglass: capturing system audio via %s\n", bn);
                announced = 1;
            } else {
                nodata += dt;
                if (!hinted && nodata > 5.0) {
                    hinted = 1;
                    printf("seaglass: no audio yet — play some music and it will light up\n");
                }
            }
        }

        uint64_t total = audio_latest(audio, samples, DSP_FFT_N);
        dsp_process(dsp, samples, total, dt, &out);

        glActiveTexture(GL_TEXTURE0);
        glTexSubImage2D(GL_TEXTURE_2D, 0, 0, 0, DSP_BANDS, 1, GL_RED, GL_FLOAT, out.spec);
        glActiveTexture(GL_TEXTURE1);
        glTexSubImage2D(GL_TEXTURE_2D, 0, 0, 0, DSP_WAVE_N, 1, GL_RED, GL_FLOAT, out.wave);

        int dw, dh;
        SDL_GL_GetDrawableSize(win, &dw, &dh);
        glViewport(0, 0, dw, dh);
        glClearColor(0.01f, 0.03f, 0.04f, 1.0f);
        glClear(GL_COLOR_BUFFER_BIT);

        if (prog) {
            glUseProgram(prog);
            glUniform2f(uni.res, (float)dw, (float)dh);
            glUniform1f(uni.time, (float)tsec);
            glUniform1f(uni.bass, out.bass);
            glUniform1f(uni.mid, out.mid);
            glUniform1f(uni.treble, out.treble);
            glUniform1f(uni.level, out.level);
            glUniform1f(uni.beat, out.beat);
            glUniform1f(uni.centroid, out.centroid);
            glUniform1f(uni.flow, out.flow);
            glDrawArrays(GL_TRIANGLES, 0, 3);
        }
        SDL_GL_SwapWindow(win);
    }

    audio_stop(audio);
    dsp_free(dsp);
    SDL_GL_DeleteContext(ctx);
    SDL_DestroyWindow(win);
    SDL_Quit();
    return 0;
}
