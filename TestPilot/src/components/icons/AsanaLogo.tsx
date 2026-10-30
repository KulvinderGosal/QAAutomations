// Asana brand mark — three dots. Rendered in Asana coral (#F06A6A) by default;
// pass a color to theme it (e.g. currentColor inside a tinted chip).
export function AsanaLogo({ size = 16, color = "#F06A6A", className }: { size?: number; color?: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill={color} aria-hidden="true">
      <circle cx="12" cy="6.4" r="4.2" />
      <circle cx="6.6" cy="15.4" r="4.2" />
      <circle cx="17.4" cy="15.4" r="4.2" />
    </svg>
  );
}
