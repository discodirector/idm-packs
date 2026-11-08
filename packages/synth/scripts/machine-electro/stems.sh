#!/bin/zsh
# stems.sh <outdir> <seconds> <styles> [port] : each part solo (the rest muted), tag = part
out=$1; sec=$2; only=$3; port=${4:-5244}
all=(kick snare hat glitch bass pad lead fx)
for p in kick snare hat glitch bass pad lead; do
  m=$(python3 -c "import json,sys;a=sys.argv[1:];print(json.dumps([x for x in a if x!='$p']))" $all)
  MUTES=$m TAG=$p BAR_OFFSET=16 PORT=$port node render.mjs $out $sec $only 2>&1 | grep -v "^mach"
done
