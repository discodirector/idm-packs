#!/bin/zsh
# enc.sh in.f32 out.mp3 : loudness-match to -14 LUFS (two-pass loudnorm, linear), true peak -1 dBTP, 320k mp3
in=$1; out=$2
j=$(ffmpeg -hide_banner -nostats -f f32le -ar 44100 -ac 2 -i $in -af loudnorm=I=-14:TP=-1:LRA=20:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
mi=$(echo $j | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['input_i'],d['input_tp'],d['input_lra'],d['input_thresh'],d['target_offset'])")
set -- ${=mi}
ffmpeg -hide_banner -loglevel error -y -f f32le -ar 44100 -ac 2 -i $in -af loudnorm=I=-14:TP=-1:LRA=20:measured_I=${1}:measured_TP=${2}:measured_LRA=${3}:measured_thresh=${4}:offset=${5}:linear=true,aresample=44100 -c:a libmp3lame -b:a 320k $out
r=$(ffmpeg -hide_banner -nostats -i $out -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+I:|^\s+Peak:" | tr -s ' ' | tr '\n' ' ')
echo "$(basename $out): source $1 LUFS -> $r"
