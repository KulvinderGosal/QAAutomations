import type { ReactNode } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// A reusable filter/group-by dropdown — a compact trigger button that opens a
// panel of grouped facets. Each option can carry a colored status dot + a count,
// and shows a checkmark when active. Supports single-select (radio) and
// multi-select (checkbox) groups. Shared across QA Queue / Bugs / Reports so the
// filter UI is identical everywhere.

export type FilterOption = { value: string; label: string; dot?: string; count?: number };

export type FilterGroup =
  | { key: string; label?: string; type: "radio"; options: FilterOption[]; value: string; onChange: (v: string) => void }
  | { key: string; label?: string; type: "checkbox"; options: FilterOption[]; values: string[]; onChange: (v: string[]) => void };

export function FilterMenu({
  label = "Filter",
  icon,
  groups,
  activeCount,
  align = "start",
}: {
  label?: string;
  icon?: ReactNode;
  groups: FilterGroup[];
  activeCount?: number;
  align?: "start" | "end";
}) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-control border border-border bg-card px-2.5 py-1.5 text-[12.5px] font-medium text-ink-2 transition-colors hover:bg-surface-2 data-[state=open]:border-primary data-[state=open]:text-primary"
          type="button"
        >
          {icon}
          {label}
          {activeCount ? (
            <span className="rounded-full bg-primary px-1.5 text-[10.5px] font-bold leading-[1.35] text-white">{activeCount}</span>
          ) : null}
          <ChevronDown size={13} className="text-muted-foreground" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align={align}
          sideOffset={6}
          className="z-50 min-w-[224px] rounded-card border border-border bg-card p-1.5 shadow-[0_16px_44px_-14px_rgba(15,23,42,0.4)]"
        >
          {groups.map((g, gi) => (
            <div key={g.key} className={gi > 0 ? "mt-1.5 border-t border-border pt-1.5" : ""}>
              {g.label && (
                <div className="px-2 pb-1 pt-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{g.label}</div>
              )}
              {g.options.map((o) => {
                const selected = g.type === "radio" ? g.value === o.value : g.values.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => {
                      if (g.type === "radio") g.onChange(o.value);
                      else g.onChange(selected ? g.values.filter((v) => v !== o.value) : [...g.values, o.value]);
                    }}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-2 rounded-control px-2 py-1.5 text-left text-[12.5px] transition-colors hover:bg-surface-2",
                      selected ? "font-semibold text-ink-1" : "text-ink-2",
                    )}
                  >
                    {o.dot !== undefined && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: o.dot }} />}
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    {typeof o.count === "number" && (
                      <span className="shrink-0 rounded-full bg-surface-3 px-1.5 text-[10px] font-bold text-muted-foreground">{o.count}</span>
                    )}
                    {selected && <Check size={14} className="shrink-0 text-primary" />}
                  </button>
                );
              })}
            </div>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
