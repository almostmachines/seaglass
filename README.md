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
    ./seaglass -s prism     # start on a specific scene
    ./seaglass --selftest   # headless DSP sanity check

Play music from anywhere and it lights up.

## Keys

| key | action |
|-----|--------|
| 1 … 7 | choose scene (tide, bloom, drift, lark, prism, swell, bower) |
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
- **prism** — a kinetic idea-engine: radial spectrum architecture,
  waveform lightning spirals, stained-glass lattice cells that choose
  their own bands, treble sparks, bass reactor, and beat shockwaves. The
  wild one.
- **swell** — the spectrum resynthesized as deep water: every band is a
  travelling wave obeying the real deep-water dispersion relation, so
  bass rolls through as broad coherent swell and treble scatters into
  chop. Sun glitter, caustic filaments, and breaking foam all emerge
  from one field's derivatives; the waveform is a thread of light
  refracted from below, and every beat drops a stone into the sea. The
  physical one.
- **bower** — a planted border in a low backlit sun, laid out the way a
  real one is: tall at the back, short at the front, and left to right
  it is the spectrum, so bass grows big architectural foliage and treble
  grows grasses and lace. Every plant lives a whole life on the clock of
  `uFlow`, which only runs while music is playing — it germinates,
  throws a stem, unrolls its leaves from the bottom up, opens a flower,
  browns from the tip and the margin inward and stands a while as a seed
  head before the next generation takes the bay. Silence stops the
  clock, so the garden holds rather than resets. The band beneath a
  plant sets its vigour moment to moment. The waveform is a thread of
  spider silk slung across the border, beaded with dew. The slow one —
  it changes over minutes, not bars.

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
