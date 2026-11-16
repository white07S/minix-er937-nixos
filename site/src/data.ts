// The raw 10-second readings of the full run, bundled at build time.
import rawSamples from "../../results/2026-11-16-performance/samples.csv?raw";

export type Sample = {
  /** Clock time of the reading, HH:MM:SS. */
  time: string;
  phase: string;
  /** Minutes since the first reading. */
  minute: number;
  cpuC: number;
  avgGhz: number;
  /** Package power; the first reading has none because power is a difference of two readings. */
  watts: number | null;
};

export type PhaseSpan = { phase: string; from: number; to: number };

export function parseSamples(csv: string): Sample[] {
  const [header, ...lines] = csv.trim().split("\n");
  const columns = header.split(",");
  const at = (name: string) => columns.indexOf(name);
  let first: number | null = null;
  let previous = -1;
  let dayOffset = 0;

  return lines.map((line) => {
    const cells = line.split(",");
    const time = cells[at("time")];
    const [h, m, s] = time.split(":").map(Number);
    let seconds = h * 3600 + m * 60 + s;
    // The run crosses midnight, so the clock wraps once.
    if (seconds + dayOffset < previous) dayOffset += 86400;
    seconds += dayOffset;
    previous = seconds;
    if (first === null) first = seconds;
    const watts = cells[at("pkg_w")];
    return {
      time,
      phase: cells[at("phase")],
      minute: (seconds - first) / 60,
      cpuC: Number(cells[at("cpu_c")]),
      avgGhz: Number(cells[at("avg_mhz")]) / 1000,
      watts: watts === "" ? null : Number(watts),
    };
  });
}

export function phaseSpans(samples: Sample[]): PhaseSpan[] {
  const spans: PhaseSpan[] = [];
  for (const sample of samples) {
    const last = spans[spans.length - 1];
    if (last && last.phase === sample.phase) last.to = sample.minute;
    else spans.push({ phase: sample.phase, from: sample.minute, to: sample.minute });
  }
  // Each phase runs until the next one starts.
  spans.forEach((span, i) => {
    if (i + 1 < spans.length) span.to = spans[i + 1].from;
  });
  return spans;
}

export const samples = parseSamples(rawSamples);
export const spans = phaseSpans(samples);

export const PHASE_NAMES: Record<string, string> = {
  idle: "Idle",
  bench: "Benchmark",
  cpu: "CPU load",
  cooldown: "Cooldown",
  mem: "Memory test",
  disk: "Disk test",
  after: "Finishing",
};
