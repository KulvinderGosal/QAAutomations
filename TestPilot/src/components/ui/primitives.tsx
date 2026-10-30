import * as React from "react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils";
import type { Tone } from "@/lib/tone";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-card bg-card shadow-[inset_0_0_0_1px_rgba(15,23,42,0.09)]", className)}
      {...props}
    />
  );
}

export function CardHover({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <Card className={cn("cp-card-hover cursor-pointer", className)} {...props} />;
}

type ButtonVariant = "primary" | "outline" | "ghost" | "destructive" | "link" | "magic";
type ButtonSize = "sm" | "md" | "icon";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground border border-transparent hover:brightness-[1.06]",
  outline: "bg-card text-foreground border border-border hover:bg-surface-2",
  ghost: "bg-transparent text-muted-foreground border border-transparent hover:bg-surface-2",
  destructive:
    "bg-card text-destructive border border-[color-mix(in_srgb,var(--destructive)_35%,transparent)] hover:bg-destructive-surface",
  magic: "bg-magic text-white border border-transparent hover:brightness-[1.06]",
  link: "bg-transparent text-primary border-none p-0 h-auto font-medium hover:underline",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[12.5px] gap-1.5 rounded-control",
  md: "h-9 px-3.5 text-[13px] gap-2 rounded-control",
  icon: "h-[34px] w-[34px] rounded-control",
};

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }
>(({ className, variant = "outline", size = "md", ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center font-semibold cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap",
      VARIANT_CLASS[variant],
      variant !== "link" && SIZE_CLASS[size],
      className,
    )}
    {...props}
  />
));
Button.displayName = "Button";

export function Chip({
  tone,
  icon,
  children,
  className,
  style,
}: {
  tone?: Pick<Tone, "color" | "surface">;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-chip px-2 py-[3px] text-[12px] font-medium",
        className,
      )}
      style={{ color: tone?.color, background: tone?.surface, ...style }}
    >
      {icon}
      {children}
    </span>
  );
}

export function StatusBadge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-chip px-2.5 py-1 text-[12px] font-semibold"
      style={{ color: tone.color, background: tone.surface }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: "currentColor" }} />
      {children}
    </span>
  );
}

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const hue = Math.abs(hashCode(name)) % 360;
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `oklch(0.55 0.1 ${hue})`,
      }}
    >
      {initials(name)}
    </div>
  );
}

function hashCode(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex items-center gap-0.5 rounded-control border border-border bg-surface-2 p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-[7px] px-3 py-1.5 text-[12.5px] font-semibold transition-colors cursor-pointer",
            value === o.value ? "bg-card text-foreground shadow-[inset_0_0_0_1px_rgba(15,23,42,0.09)]" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ProgressBar({ value, striped, tone = "var(--primary)" }: { value: number; striped?: boolean; tone?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
      <div
        className={cn("h-full rounded-full transition-[width] duration-300", striped && "cp-striped")}
        style={{ width: `${value}%`, background: tone }}
      />
    </div>
  );
}

export function EyebrowLabel({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={cn("text-[10px] font-bold uppercase tracking-[0.07em] text-muted-foreground", className)} style={style}>
      {children}
    </div>
  );
}

export function Dot({ className }: { className?: string }) {
  return <span className={cn("h-[3px] w-[3px] rounded-full bg-[oklch(0.78_0_0)]", className)} />;
}
