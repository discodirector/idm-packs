#!/bin/zsh
# ab.sh <before.f32> <after.f32> <start s> <seconds> <out.mp3> : the same segment of two renders back to back (before
# first), each loudness-matched to -14 LUFS, short fades, 1 s of silence between them.
a=$1; b=$2; st=$3; len=$4; out=$5
tmp=$(mktemp -d)
for x in a b; do
  src=${(P)x}
  ffmpeg -hide_banner -loglevel error -y -f f32le -ar 44100 -ac 2 -ss $st -t $len -i $src -af "afade=t=in:d=0.15,afade=t=out:st=$((len - 0.4)):d=0.4,loudnorm=I=-14:TP=-1.5:LRA=20,aresample=44100" -c:a pcm_f32le $tmp/$x.wav
done
ffmpeg -hide_banner -loglevel error -y -i $tmp/a.wav -f lavfi -t 1 -i anullsrc=r=44100:cl=stereo -i $tmp/b.wav -filter_complex "[0][1][2]concat=n=3:v=0:a=1,alimiter=limit=0.89[o]" -map "[o]" -c:a libmp3lame -b:a 320k $out
rm -rf $tmp
