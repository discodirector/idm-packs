# hatmeas.py <dir> <style>... : the hat bus of each style from its solo stem (<style>-hat.f32, render.mjs with
# MUTES = every part but "hat", BAR_OFFSET 0, one 32-bar form) and its full mix (<style>-mix.f32, same span):
# With MIXDIR set, the mix is the first span of <MIXDIR>/<style>.f32 instead (a 3-min render.mjs demo).
#   onsets per bar (all bars, and the full section 16-23), hat stem LUFS re the mix, the stem's 6-12 kHz energy re the
#   whole mix (dB), the mix's 6-12 kHz share (dB), and the stem's spectral centroid.
import sys, os, json, subprocess, tempfile, numpy as np
SR = 44100

def lufs(p):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-f", "f32le", "-ar", "44100", "-ac", "2", "-i", p, "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True).stderr
    l = [x for x in r.splitlines() if x.strip().startswith("I:")]
    return float(l[-1].split()[1]) if l else float("nan")

def spec(x):
    n = 1 << 14
    acc = None
    for i in range(0, len(x) - n, n // 2):
        s = np.abs(np.fft.rfft(x[i:i + n] * np.hanning(n))) ** 2
        acc = s if acc is None else acc + s
    return np.fft.rfftfreq(n, 1 / SR), acc

def onsets(x):
    hop = 88
    e = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2)) for i in range(0, len(x) - hop, hop)]) + 1e-9
    db = 20 * np.log10(e)
    pk = np.percentile(db, 99.5)
    out = []
    for i in range(3, len(db)):
        if db[i] - db[i - 3] > 6 and db[i] > pk - 40 and (not out or i - out[-1] > 30):
            out.append(i)
    return np.array(out) * hop / SR

d = sys.argv[1]
print(f"{'style':14s} {'on/bar':>7s} {'full':>6s} {'hat-mix':>8s} {'hatHF':>7s} {'mixHF':>7s} {'centroid':>9s}")
for s in sys.argv[2:]:
    h = np.fromfile(f"{d}/{s}-hat.f32", dtype=np.float32).reshape(-1, 2).mean(1)
    mixp = f"{d}/{s}-mix.f32"
    if os.environ.get("MIXDIR"):
        n = os.path.getsize(f"{d}/{s}-hat.f32")
        mixp = tempfile.mktemp(suffix=".f32")
        open(mixp, "wb").write(open(f"{os.environ['MIXDIR']}/{s}.f32", "rb").read(n))
    m = np.fromfile(mixp, dtype=np.float32).reshape(-1, 2).mean(1)
    bars = json.load(open(f"{d}/{s}-hat.json"))["bars"]
    t = [b["t"] for b in bars] + [len(h) / SR]
    on = onsets(h)
    per = [((on >= t[i]) & (on < t[i + 1])).sum() for i in range(len(bars)) if t[i + 1] <= len(h) / SR]
    full = [per[i] for i in range(len(per)) if 16 <= bars[i]["fbar"] <= 23]
    f, H = spec(h)
    _, M = spec(m)
    band = (f >= 6000) & (f < 12000)
    hf = 10 * np.log10(H[band].sum() / M.sum())
    mhf = 10 * np.log10(M[band].sum() / M.sum())
    cen = (f * H).sum() / H.sum()
    print(f"{s:14s} {np.mean(per):7.2f} {np.mean(full) if full else float('nan'):6.2f} {lufs(f'{d}/{s}-hat.f32') - lufs(mixp):8.1f} {hf:7.1f} {mhf:7.1f} {cen:9.0f}")
