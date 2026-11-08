# Per-part levels: LUFS-ish (ffmpeg ebur128 integrated) of each solo stem, relative to the kick, and the space metric:
# for snare / pad / lead: level 250-500 ms after each onset relative to its onset peak (higher = more tail).
import sys, glob, subprocess, numpy as np, os, re
SR=44100
def lufs(p):
    r=subprocess.run(["ffmpeg","-hide_banner","-nostats","-f","f32le","-ar","44100","-ac","2","-i",p,"-af","ebur128","-f","null","-"],capture_output=True,text=True).stderr
    l=[x for x in r.splitlines() if x.strip().startswith("I:")]
    return float(l[-1].split()[1]) if l else float('nan')
def tail(p):
    x=np.fromfile(p,dtype=np.float32).reshape(-1,2).mean(1)
    hop=441; e=np.array([np.sqrt(np.mean(x[i:i+hop]**2)) for i in range(0,len(x)-hop,hop)])+1e-9
    db=20*np.log10(e); pk=db.max()
    ons=[i for i in range(3,len(db)-50) if db[i]-db[i-3]>10 and db[i]>pk-30]
    o2=[]
    for i in ons:
        if not o2 or i-o2[-1]>20: o2.append(i)
    r=[db[i+25:i+50].mean()-db[i:i+3].max() for i in o2]
    return (np.median(r) if r else float('nan')), len(o2)
d=sys.argv[1]
styles=sorted({os.path.basename(f).rsplit("-",1)[0] for f in glob.glob(d+"/*-lead.f32")})
parts=["kick","snare","hat","glitch","bass","pad","lead"]
print(f"{'style':14s}"+"".join(f"{p:>8s}" for p in parts)+"   tails: snare / pad / lead (dB at 250-500 ms)")
for s in styles:
    L={p:lufs(f"{d}/{s}-{p}.f32") for p in parts if os.path.exists(f"{d}/{s}-{p}.f32")}
    k=L["kick"]
    tl=[tail(f"{d}/{s}-{p}.f32")[0] for p in ("snare","pad","lead")]
    print(f"{s:14s}"+"".join(f"{L[p]-k:8.1f}" if p!="kick" else f"{k:8.1f}" for p in parts)+"   "+" / ".join(f"{t:6.1f}" for t in tl))
