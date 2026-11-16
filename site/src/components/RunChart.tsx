import { useEffect, useMemo, useRef, useState } from "react";
import { PHASE_NAMES, type PhaseSpan, type Sample } from "../data";

// Three small charts on one time axis, one measure each (never two scales on one chart).
type Panel = {
  key: "cpuC" | "watts" | "avgGhz";
  title: string;
  unit: string;
  min: number;
  max: number;
  ticks: number[];
  digits: number;
};

const PANELS: Panel[] = [
  { key: "cpuC", title: "CPU temperature", unit: "°C", min: 30, max: 100, ticks: [40, 60, 80, 100], digits: 1 },
  { key: "watts", title: "Package power", unit: "W", min: 0, max: 75, ticks: [0, 25, 50, 75], digits: 1 },
  { key: "avgGhz", title: "Average clock speed", unit: "GHz", min: 0, max: 4, ticks: [0, 1, 2, 3, 4], digits: 2 },
];

const SHADED = new Set(["cpu", "mem", "disk"]);
const BAND_LABELS: Record<string, string> = { cpu: "CPU load, 60 min", mem: "Memory, 30 min", disk: "Disk" };

const LEFT = 40;
const RIGHT = 12;
const TOP = 46;
const PANEL_HEIGHT = 124;
const PANEL_GAP = 46;
const BOTTOM = 28;
const HEIGHT = TOP + PANELS.length * PANEL_HEIGHT + (PANELS.length - 1) * PANEL_GAP + BOTTOM;

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Clock-time ticks on round quarter hours, as [minute offset, label]. */
function timeTicks(samples: Sample[], everyMinutes: number): [number, string][] {
  const [h, m, s] = samples[0].time.split(":").map(Number);
  const startMinutes = h * 60 + m + s / 60;
  const last = samples[samples.length - 1].minute;
  const ticks: [number, string][] = [];
  for (let t = Math.ceil(startMinutes / everyMinutes) * everyMinutes; t - startMinutes <= last; t += everyMinutes) {
    const hh = String(Math.floor(t / 60) % 24).padStart(2, "0");
    const mm = String(t % 60).padStart(2, "0");
    ticks.push([t - startMinutes, `${hh}:${mm}`]);
  }
  return ticks;
}

export function RunChart({ samples, spans }: { samples: Sample[]; spans: PhaseSpan[] }) {
  const [ref, width] = useWidth();
  const [active, setActive] = useState<number | null>(null);

  const lastMinute = samples[samples.length - 1].minute;
  const plotWidth = Math.max(0, width - LEFT - RIGHT);
  const x = (minute: number) => LEFT + (minute / lastMinute) * plotWidth;
  const panelTop = (i: number) => TOP + i * (PANEL_HEIGHT + PANEL_GAP);
  const y = (panel: Panel, i: number, value: number) =>
    panelTop(i) + PANEL_HEIGHT - ((value - panel.min) / (panel.max - panel.min)) * PANEL_HEIGHT;

  const paths = useMemo(
    () =>
      PANELS.map((panel, i) => {
        let d = "";
        let pen = false;
        for (const sample of samples) {
          const value = sample[panel.key];
          if (value === null) {
            pen = false;
            continue;
          }
          d += `${pen ? "L" : "M"}${x(sample.minute).toFixed(1)},${y(panel, i, value).toFixed(1)}`;
          pen = true;
        }
        return d;
      }),
    // x and y depend only on the width
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [samples, width],
  );

  const hottest = useMemo(() => samples.reduce((a, b) => (b.cpuC > a.cpuC ? b : a)), [samples]);
  const ticks = timeTicks(samples, plotWidth < 520 ? 30 : 15);
  const current = active === null ? null : samples[active];

  function indexAt(clientX: number, target: Element) {
    const box = target.getBoundingClientRect();
    const minute = ((clientX - box.left - LEFT) / plotWidth) * lastMinute;
    // Readings are evenly spaced, so the nearest one is a division away.
    const guess = Math.round((minute / lastMinute) * (samples.length - 1));
    return Math.min(samples.length - 1, Math.max(0, guess));
  }

  function onKeyDown(event: React.KeyboardEvent) {
    const step = event.shiftKey ? 6 : 1;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const from = active ?? Math.floor(samples.length / 2);
      const next = from + (event.key === "ArrowRight" ? step : -step);
      setActive(Math.min(samples.length - 1, Math.max(0, next)));
    } else if (event.key === "Escape") {
      setActive(null);
    }
  }

  const tooltipLeft = current ? x(current.minute) : 0;
  const flip = tooltipLeft > width - 200;

  return (
    <div ref={ref} className="relative">
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          tabIndex={0}
          aria-label="CPU temperature, package power and average clock speed over the 96-minute run. Use the left and right arrow keys to read values."
          className="block touch-pan-y rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-series"
          onPointerMove={(event) => setActive(indexAt(event.clientX, event.currentTarget))}
          onPointerLeave={() => setActive(null)}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
        >
          {/* phase bands, shared by all panels */}
          {spans
            .filter((span) => SHADED.has(span.phase))
            .map((span) => {
              const bandWidth = x(span.to) - x(span.from);
              const label = BAND_LABELS[span.phase];
              const short = label.split(",")[0];
              const text = bandWidth > label.length * 6.4 ? label : bandWidth > short.length * 6.4 ? short : "";
              return (
                <g key={span.phase}>
                  <rect
                    x={x(span.from)}
                    y={TOP}
                    width={bandWidth}
                    height={HEIGHT - TOP - BOTTOM}
                    fill="var(--surface-2)"
                    opacity={0.7}
                  />
                  {text && (
                    <text x={x(span.from) + 6} y={12} fontSize={11} fill="var(--fg-3)" className="font-mono">
                      {text}
                    </text>
                  )}
                </g>
              );
            })}

          {PANELS.map((panel, i) => (
            <g key={panel.key}>
              <text x={LEFT} y={panelTop(i) - 10} fontSize={12} fontWeight={600} fill="var(--fg)">
                {panel.title}
                <tspan fill="var(--fg-3)" fontWeight={400}>{`  ${panel.unit}`}</tspan>
              </text>
              {panel.ticks.map((tick) => (
                <g key={tick}>
                  <line
                    x1={LEFT}
                    x2={width - RIGHT}
                    y1={y(panel, i, tick)}
                    y2={y(panel, i, tick)}
                    stroke="var(--line)"
                    strokeWidth={1}
                    opacity={tick === panel.min ? 1 : 0.6}
                  />
                  <text
                    x={LEFT - 8}
                    y={y(panel, i, tick) + 4}
                    fontSize={11}
                    textAnchor="end"
                    fill="var(--fg-3)"
                    className="font-mono tabular-nums"
                  >
                    {tick}
                  </text>
                </g>
              ))}
              <path
                d={paths[i]}
                fill="none"
                stroke="var(--series-1)"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </g>
          ))}

          {/* the one reading worth pointing at */}
          <circle
            cx={x(hottest.minute)}
            cy={y(PANELS[0], 0, hottest.cpuC)}
            r={4}
            fill="var(--series-1)"
            stroke="var(--surface)"
            strokeWidth={2}
          />
          <text
            x={x(hottest.minute) - 8}
            y={y(PANELS[0], 0, hottest.cpuC) + 4}
            fontSize={11}
            textAnchor="end"
            fill="var(--fg-2)"
          >
            {`${hottest.cpuC.toFixed(1)} °C, one reading`}
          </text>

          {/* time axis */}
          {ticks.map(([minute, label]) => (
            <text
              key={label}
              x={x(minute)}
              y={HEIGHT - 8}
              fontSize={11}
              textAnchor="middle"
              fill="var(--fg-3)"
              className="font-mono tabular-nums"
            >
              {label}
            </text>
          ))}

          {/* crosshair */}
          {current && (
            <g pointerEvents="none">
              <line
                x1={x(current.minute)}
                x2={x(current.minute)}
                y1={TOP}
                y2={HEIGHT - BOTTOM}
                stroke="var(--fg-3)"
                strokeWidth={1}
              />
              {PANELS.map((panel, i) => {
                const value = current[panel.key];
                return value === null ? null : (
                  <circle
                    key={panel.key}
                    cx={x(current.minute)}
                    cy={y(panel, i, value)}
                    r={4}
                    fill="var(--series-1)"
                    stroke="var(--surface)"
                    strokeWidth={2}
                  />
                );
              })}
            </g>
          )}
        </svg>
      )}

      {current && (
        <div
          role="status"
          className="pointer-events-none absolute top-6 z-10 w-44 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] shadow-sm"
          style={{ left: flip ? tooltipLeft - 12 - 176 : tooltipLeft + 12 }}
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono tabular-nums text-fg">{current.time}</span>
            <span className="text-fg-3">{PHASE_NAMES[current.phase] ?? current.phase}</span>
          </div>
          <dl className="mt-1.5 flex flex-col gap-0.5">
            {PANELS.map((panel) => {
              const value = current[panel.key];
              return (
                <div key={panel.key} className="flex items-baseline justify-between gap-2">
                  <dt className="text-fg-2">{panel.title.replace("Average c", "C").replace("CPU t", "T").replace("Package p", "P")}</dt>
                  <dd className="font-mono font-semibold tabular-nums text-fg">
                    {value === null ? "n/a" : `${value.toFixed(panel.digits)} ${panel.unit}`}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      )}
    </div>
  );
}
