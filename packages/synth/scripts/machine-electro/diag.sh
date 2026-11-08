#!/bin/zsh
# diag.sh <port> <part>... : Black Circuit, 90 s from bar 0, once without each machine part (tag = no-<part>)
port=$1; shift
for p in $@; do
  OVERRIDE="{\"mach-circuit\":{\"data.machine.$p\":null}}" TAG=no-$p PORT=$port node render.mjs diag 90 mach-circuit 2>&1 | grep -v "^mach"
done
