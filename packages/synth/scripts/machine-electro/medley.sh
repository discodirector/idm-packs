#!/bin/zsh
# medley.sh <out.mp3> [render dir, default new] : 30 s of each demo (from its second "full" section, 2 s before), each loudness-matched, 1.5 s crossfades.
set -e
src=${2:-new}
mkdir -p med
order=(mach-control mach-memory mach-roller mach-system mach-march mach-circuit mach-engine)
args=(); i=0
for s in $order; do
  st=$(python3 -c "
import json;d=json.load(open('$src/$s-new.json'))
f=[b['t'] for b in d['bars'] if b['sec']=='full' and b['fbar']==16]
print(max(0,(f[1] if len(f)>1 else f[0])-2))")
  ffmpeg -hide_banner -loglevel error -y -f f32le -ar 44100 -ac 2 -ss $st -t 31.5 -i $src/$s-new.f32 -af "afade=t=in:d=0.3,loudnorm=I=-14:TP=-1.5:LRA=20,aresample=44100" -c:a pcm_f32le med/$i.wav
  args+=(-i med/$i.wav); i=$((i+1))
done
f="[0][1]acrossfade=d=1.5[a1]"
for j in 2 3 4 5 6; do f="$f;[a$((j-1))][$j]acrossfade=d=1.5[a$j]"; done
ffmpeg -hide_banner -loglevel error -y $args -filter_complex "$f;[a6]afade=t=out:st=208:d=3.4,alimiter=limit=0.89[o]" -map "[o]" -c:a libmp3lame -b:a 320k $1
