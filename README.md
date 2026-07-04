# seaglass

An algorithmic audio visualiser for the desktop. It taps whatever is
playing on the system — any player, any browser — by recording the
PipeWire default sink's monitor, runs it through an FFT, and drives
full-screen GLSL scenes with the spectrum, waveform, and beat.

Named for the glass the sea polishes: the palette lives between deep
water, jade, aqua, frost, and a little amber.

## Build

    make

Needs SDL2, OpenGL 3.3, and PipeWire (`pw-record`; falls back to
`parec`). All present on a normal Arch desktop.

## Run

    ./seaglass              # windowed
    ./seaglass -f           # fullscreen
    ./seaglass -s drift     # start on a specific scene
    ./seaglass --selftest   # headless DSP sanity check

Play music from anywhere and it lights up.

## Keys

| key | action |
|-----|--------|
| 1 / 2 / 3 / 4 | choose scene (tide, bloom, drift, lark) |
| space | next scene |
| f or F11 | toggle fullscreen |
| r | reload shaders |
| a | restart audio capture (e.g. after switching output device) |
| q / Esc | quit |

## Scenes

- **tide** — layered drifting ribbons (bass low, treble high) under a
  luminous waveform thread.
- **bloom** — a breathing mandala: the spectrum as a corona, the
  waveform as an inner ring, a molten core that warms with bass.
- **drift** — a night shoreline: slow nebula sky, stars that answer the
  treble, and the waveform as the light on the horizon. The quietest one.
- **lark** — daybreak above the shore: the spectrum fans out of the
  not-yet-risen sun as rays of light, nacreous clouds catch the colour
  from beneath, a murmuration wheels overhead, and the waveform is a
  swift's path drawn in vapour. The loud one.

## Live tweaking

The files in `shaders/` are watched while the app runs — edit and save,
and seaglass recompiles on the fly (it checks about twice a second). If
an edit fails to compile, the error goes to the terminal and the
previous version keeps rendering.

`shaders/common.glsl` holds the palette and the shared uniforms:

    uBass uMid uTreble   band envelopes, 0..1
    uLevel               overall loudness envelope
    uBeat                1.0 at a bass onset, decaying
    uCentroid            spectral centroid, 0 dark .. 1 bright
    uFlow                accumulated "musical time" — use it instead of
                         uTime for motion that breathes with the music
    spec(x), wav(x)      spectrum / waveform lookups, x in 0..1

## How the capture works

`pw-record -P '{ stream.capture.sink = true }'` records from the
monitor of the default sink — exactly what the speakers get, already
mixed, regardless of which application is playing. If pw-record is
missing it falls back to `parec` against `<default sink>.monitor`.
Auto-gain in the DSP keeps quiet and loud sources equally alive, and
true silence fades the scenes to their idle state instead of
amplifying the noise floor.
