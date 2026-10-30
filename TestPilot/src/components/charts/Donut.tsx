import { useState } from "react";

export type Slice = { label: string; value: number; color: string };

// Dependency-free donut. Segments are drawn as dash-arc strokes with a 2px gap
// between them (the surface-gap rule); a legend with direct labels + counts sits
// beside it so identity is never color-alone. Hovering a segment or legend row
// swaps the center readout to that slice.
export function Donut({
  slices,
  size = 128,
  thickness = 16,
  unit = "total",
  orientation = "row",
}: {
  slices: Slice[];
  size?: number;
  thickness?: number;
  unit?: string;
  orientation?: "row" | "col";
}) {
  const vertical = orientation === "col";
  const [hover, setHover] = useState<number | null>(null);
  const total = slices.reduce((a, s) => a + s.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  const gap = total > 0 && slices.filter((s) => s.value > 0).length > 1 ? 2 : 0;

  let offset = 0;
  const arcs = slices.map((s, i) => {
    const frac = total > 0 ? s.value / total : 0;
    const len = Math.max(0, frac * c - gap);
    const arc = { i, len, dashOffset: -offset, color: s.color, value: s.value };
    offset += frac * c;
    return arc;
  });

  const active = hover != null ? slices[hover] : null;
  const pct = active && total > 0 ? Math.round((active.value / total) * 100) : null;

  return (
    <div className={vertical ? "flex flex-col items-center gap-3" : "flex items-center gap-4"}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={cx} cy={cx} r={r} fill="none" stroke="oklch(0.93 0 0)" strokeWidth={thickness} />
          {total > 0 &&
            arcs.map((a) =>
              a.value > 0 ? (
                <circle
                  key={a.i}
                  cx={cx}
                  cy={cx}
                  r={r}
                  fill="none"
                  stroke={a.color}
                  strokeWidth={hover === a.i ? thickness + 4 : thickness}
                  strokeDasharray={`${a.len} ${c - a.len}`}
                  strokeDashoffset={a.dashOffset}
                  strokeLinecap="butt"
                  onMouseEnter={() => setHover(a.i)}
                  onMouseLeave={() => setHover(null)}
                  style={{ transition: "stroke-width 0.15s ease" }}
                />
              ) : null,
            )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-[22px] font-bold leading-none tracking-tight text-ink-1">
            {active ? active.value : total}
          </div>
          <div className="mt-0.5 max-w-[80px] truncate text-center text-[10px] font-medium text-muted-foreground">
            {active ? (pct != null ? `${active.label} · ${pct}%` : active.label) : unit}
          </div>
        </div>
      </div>

      <div
        className={
          vertical ? "grid w-full grid-cols-2 gap-x-3 gap-y-1" : "flex min-w-0 flex-col gap-1"
        }
      >
        {slices.map((s, i) => (
          <button
            key={s.label}
            type="button"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            className="flex min-w-0 items-center gap-1.5 border-0 bg-transparent p-0 text-left"
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: s.color }} />
            <span
              className={`min-w-0 flex-1 truncate text-[11.5px] ${hover === i ? "font-semibold text-ink-1" : "text-ink-2"}`}
            >
              {s.label}
            </span>
            <span className="shrink-0 pl-1 font-mono text-[11px] tabular-nums text-muted-foreground">{s.value}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
