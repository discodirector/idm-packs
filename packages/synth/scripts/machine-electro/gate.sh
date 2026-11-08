#!/bin/zsh
# gate.sh <log>: waits for port 5197 to be free, then runs the pack gate (retrying if it lost the race); a passing or
# failing run's output is kept in <log>, each lost race in <log>.race; "GATE-END" closes <log>.
log=${1:a}
cd ${0:a:h}/../../../..
while true; do
  until ! lsof -iTCP:5197 -sTCP:LISTEN >/dev/null 2>&1; do sleep 10; done
  node web/scripts/station-check-pack.mjs machine-electro > $log.try 2>&1
  if grep -q "already in use" $log.try; then mv $log.try $log.race; continue; fi
  mv $log.try $log
  break
done
echo GATE-END >> $log
