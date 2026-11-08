# Full-mix analysis of rendered .f32 (interleaved stereo 44.1k):
#   LUFS integrated (ffmpeg ebur128), loudest-3s RMS dBFS (the gate's measure), per-band energy share (dB re total),
#   and a "space" metric: the decay after the snare backbeats (steps 4 and 12) measured on the side+mid mix
#   in the 1-6 kHz band: level 250-450 ms after the hit relative to the hit's first 30 ms.
import sys, json, subprocess, numpy as np
SR = 44100

def lufs(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-f", "f32le", "-ar", "44100", "-ac", "2", "-i", path,
                        "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True).stderr
    lines = [l for l in r.splitlines() if l.strip().startswith("I:")]
    return float(lines[-1].split()[1]) if lines else float("nan")

def bands(x):
    m = x.mean(1)
    n = 1 << 15
    acc = None
    for i in range(0, len(m) - n, n // 2):
        s = np.abs(np.fft.rfft(m[i:i + n] * np.hanning(n))) ** 2
        acc = s if acc is None else acc + s
    f = np.fft.rfftfreq(n, 1 / SR)
    tot = acc.sum()
    edges = [(20, 60), (60, 100), (100, 250), (250, 2000), (2000, 6000), (6000, 20000)]
    return [10 * np.log10(acc[(f >= a) & (f < b)].sum() / tot + 1e-12) for a, b in edges]

def loud3(x):
    m = x.mean(1)
    w = 3 * SR
    rms = [np.sqrt(np.mean(m[i:i + w] ** 2)) for i in range(0, len(m) - w, SR // 2)]
    return 20 * np.log10(max(rms) + 1e-12)

def main():
    for p in sys.argv[1:]:
        x = np.fromfile(p, dtype=np.float32).reshape(-1, 2)
        b = bands(x)
        name = p.split("/")[-1].replace(".f32", "")
        side = (x[:, 0] - x[:, 1]) / 2
        mid = x.mean(1)
        S, M = np.fft.rfft(side), np.fft.rfft(mid)
        f = np.fft.rfftfreq(len(side), 1 / SR)
        k = f > 300
        sr_ratio = 10 * np.log10((np.abs(S[k]) ** 2).sum() / ((np.abs(M[k]) ** 2).sum() + 1e-12) + 1e-12)
        print(f"{name:28s} LUFS {lufs(p):6.1f}  loud3 {loud3(x):6.1f}  peak {20*np.log10(np.abs(x).max()):5.1f}  "
              f"S/M>300 {sr_ratio:5.1f}  bands <60 {b[0]:5.1f} 60-100 {b[1]:5.1f} 100-250 {b[2]:5.1f} 250-2k {b[3]:5.1f} 2-6k {b[4]:5.1f} 6k+ {b[5]:5.1f}")

main()
