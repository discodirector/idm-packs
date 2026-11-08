#!/bin/zsh
# hats.sh <outdir> <styles> [port] : one 32-bar form from bar 0 (64 s) of each style, the hat bus alone (tag hat) and
# the full mix on the same renderer (tag mix), for hatmeas.py.
out=$1; only=$2; port=${3:-5291}
MUTES='["kick","snare","glitch","bass","pad","lead","fx"]' TAG=hat PORT=$port node ${0:a:h}/render.mjs $out 64 $only 2>&1 | grep -v "^mach"
MUTES='[]' TAG=mix PORT=$port node ${0:a:h}/render.mjs $out 64 $only 2>&1 | grep -v "^mach"
python3 ${0:a:h}/hatmeas.py $out ${(s:,:)only}
