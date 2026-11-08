# fix.py <stemdir> : per style, bus dB deltas toward the targets (re the kick), accumulated into mixfix.json.
import sys, json, os, subprocess
sys.argv = [sys.argv[0], sys.argv[1]]
exec(open("stemana.py").read().split("d=sys.argv[1]")[0])
d = sys.argv[1]
T = {"snare": -4, "hat": -13, "glitch": -9, "bass": -2, "pad": -6, "lead": -5}
BUS = {"snare": "snare", "hat": "hat", "glitch": "perc", "bass": "bass", "pad": "harm", "lead": "lead"}
fix = json.load(open("mixfix.json")) if os.path.exists("mixfix.json") else {}
styles = sorted({os.path.basename(f).rsplit("-", 1)[0] for f in __import__("glob").glob(d + "/*-lead.f32")})
for s in styles:
    k = lufs(f"{d}/{s}-kick.f32")
    f = fix.setdefault(s, {})
    for p, b in BUS.items():
        delta = T[p] - (lufs(f"{d}/{s}-{p}.f32") - k)
        if abs(delta) > 0.5: f[b] = round(f.get(b, 0) + delta, 1)
    print(s, f)
json.dump(fix, open("mixfix.json", "w"), indent=1)
