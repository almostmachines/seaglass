CC      ?= cc
CFLAGS  ?= -O2 -g -Wall -Wextra
PKGCONF ?= pkg-config

SDL_CFLAGS := $(shell $(PKGCONF) --cflags sdl2)
SDL_LIBS   := $(shell $(PKGCONF) --libs sdl2)

SRC = src/main.c src/audio.c src/dsp.c src/fft.c
OBJ = $(SRC:.c=.o)

seaglass: $(OBJ)
	$(CC) -o $@ $(OBJ) $(SDL_LIBS) -lGL -lm -lpthread

src/%.o: src/%.c src/audio.h src/dsp.h src/fft.h
	$(CC) $(CFLAGS) $(SDL_CFLAGS) -c -o $@ $<

clean:
	rm -f seaglass $(OBJ)

.PHONY: clean
