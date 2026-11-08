# metrics.py f32... : per render: avg simultaneous sources (from the .json census), energy share 200-2k and 2-6k,
# side/mid (dB, >300 Hz), spectral flatness 200 Hz-8 kHz (mean over frames, geometric/arithmetic, 0..1),
# crest factor (peak / RMS dB over the whole render), LUFS (ffmpeg).
import sys, json, subprocess, numpy as np, os
SR = 44100

def lufs(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-f", "f32le", "-ar", "44100", "-ac", "2", "-i", path,
                        "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True).stderr
    lines = [l for l in r.splitlines() if l.strip().startswith("I:")]
    return float(lines[-1].split()[1]) if lines else float("nan")

def main():
    print(f"{'render':26s} {'srcs':>6s} {'200-2k':>7s} {'2-6k':>6s} {'S/M':>6s} {'flat':>6s} {'crest':>6s} {'LUFS':>6s}")
    for p in sys.argv[1:]:
        x = np.fromfile(p, dtype=np.float32).reshape(-1, 2)
        j = p.replace(".f32", ".json")
        srcs = json.load(open(j)).get("census", {}).get("busy", float("nan")) if os.path.exists(j) else float("nan")
        mid = x.mean(1); side = (x[:, 0] - x[:, 1]) / 2
        n = 4096
        f = np.fft.rfftfreq(n, 1 / SR)
        win = np.hanning(n)
        P = np.zeros(len(f)); PS = np.zeros(len(f)); flats = []
        band = (f >= 200) & (f < 8000)
        for i in range(0, len(mid) - n, n):
            M = np.abs(np.fft.rfft(mid[i:i + n] * win)) ** 2
            S = np.abs(np.fft.rfft(side[i:i + n] * win)) ** 2
            P += M; PS += S
            b = M[band] + 1e-14
            if b.mean() > 1e-9:
                flats.append(np.exp(np.mean(np.log(b))) / b.mean())
        tot = P.sum()
        e1 = 100 * P[(f >= 200) & (f < 2000)].sum() / tot
        e2 = 100 * P[(f >= 2000) & (f < 6000)].sum() / tot
        k = f > 300
        sm = 10 * np.log10(PS[k].sum() / P[k].sum())
        crest = 20 * np.log10(np.abs(x).max() / np.sqrt(np.mean(x ** 2)))
        name = os.path.basename(p).replace(".f32", "")
        print(f"{name:26s} {srcs:6.1f} {e1:6.1f}% {e2:5.1f}% {sm:6.1f} {np.mean(flats):6.3f} {crest:6.1f} {lufs(p):6.1f}")

main()
