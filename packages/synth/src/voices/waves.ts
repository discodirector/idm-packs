/** Saw / pulse / sine PeriodicWave coefficients at phase k / 16 (64 harmonics; the browser band-limits them). */
export function waveCoefficients(kind: "saw" | "pulse" | "sine", k: number, duty = 0.5): { real: Float32Array; imag: Float32Array } {
  const N = kind === "sine" ? 2 : 64;
  const real = new Float32Array(N);
  const imag = new Float32Array(N);
  const phi = (k / 16) * 2 * Math.PI;
  for (let m = 1; m < N; m++) {
    // b_m sin(m(wt + phi)) = b_m cos(m phi) sin(m wt) + b_m sin(m phi) cos(m wt).
    let b = 0;
    let a = 0;
    if (kind === "sine") b = 1;
    else if (kind === "saw") b = ((m % 2 ? 1 : -1) * 2) / (Math.PI * m);
    else {
      // A pulse of width `duty`, centred: cosine series 2 sin(pi m d) / (pi m).
      a = (2 * Math.sin(Math.PI * m * duty)) / (Math.PI * m);
    }
    real[m] = a * Math.cos(m * phi) + b * Math.sin(m * phi);
    imag[m] = b * Math.cos(m * phi) - a * Math.sin(m * phi);
  }
  return { real, imag };
}
